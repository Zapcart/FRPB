// FRPB — checkout resilience + pricing regression checks.
//
//   pnpm --filter @frpb/web exec tsx scripts/verify-checkout.ts
//
// Pins the behaviours behind the "Checkout unavailable" failure class:
//   1. The /checkout entry resolves the session through the FAIL-SAFE helper
//      (`getOptionalUser`), never through the throwing `createClient` — an
//      absent/unreachable auth dependency must not block a purchase.
//   2. The self-hosted UPI rail is reachable without any third-party gateway
//      env, and a DB outage cannot stop the payment (non-persisted fallback).
//   3. Prices are identical across the shared and web tables, and the
//      whole-unit formatters render $20 / $50 / $100.
//
// NOTE: `lib/supabase/server.ts` imports `next/headers`, which only resolves
// inside a Next.js request scope. The auth assertions therefore verify the
// SOURCE contract (which helper is used, and that the helper is failure-safe)
// rather than importing it at runtime. That is intentionally the strongest
// check available outside a running server.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DUAL_PLANS,
  ALLOWED_INR_AMOUNTS,
  ALLOWED_USD_AMOUNTS,
  formatDualUsd,
  formatDualInr,
  formatDualPrice,
  getDualPlan,
  isAllowedUsdAmount,
} from "../src/config/plans";
import { PLANS as SHARED_PLANS } from "@frpb/shared";
import { UPI_PLANS, ALLOWED_UPI_AMOUNTS } from "../src/lib/upi";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    pass++;
    console.log(`PASS | ${name}`);
  } else {
    fail++;
    console.log(`FAIL | ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function source(relPath: string): string {
  try {
    return readFileSync(join(root, relPath), "utf8");
  } catch {
    return "";
  }
}

/**
 * Strip `//` line comments and block comments from source.
 *
 * The Cashfree-removal and fake-stats assertions must test CODE, not prose.
 * Explanatory comments that name the thing being removed ("Cashfree was removed
 * entirely…", "replaces the previously hardcoded 120,000+ devices recovered")
 * are load-bearing documentation of WHY the code looks the way it does — erasing
 * them would destroy the audit trail this cleanup is meant to preserve.
 */
function code(relPath: string): string {
  return source(relPath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

console.log("FRPB — checkout resilience & pricing\n");

// ─── 1. Fail-safe session resolution ─────────────────────────────────────────
const supabaseServer = source("src/lib/supabase/server.ts");
check(
  "supabase/server exports getOptionalUser",
  /export\s+async\s+function\s+getOptionalUser/.test(supabaseServer)
);
check(
  "getOptionalUser never throws (has try/catch + null returns)",
  /try\s*{/.test(supabaseServer) && /return null/.test(supabaseServer)
);
check(
  "createClient guards against missing env instead of throwing raw",
  /isSupabaseConfigured|if \(!env\)/.test(supabaseServer)
);

const checkoutPage = source("src/app/checkout/page.tsx");
check(
  "/checkout uses getOptionalUser (not the throwing createClient)",
  checkoutPage.includes("getOptionalUser") && !checkoutPage.includes("createClient()")
);
check(
  "/checkout renders the UPI rail BEFORE any auth check",
  checkoutPage.indexOf("if (wantsUpi)") > -1 &&
    checkoutPage.indexOf("if (wantsUpi)") < checkoutPage.indexOf("if (!user)")
);

// ─── 2. UPI rail independence ────────────────────────────────────────────────
const createRoute = source("src/app/api/v1/payment/create/route.ts");
check(
  "payment/create uses the fail-safe session helper",
  createRoute.includes("getOptionalUser")
);
check(
  "payment/create can issue a non-persisted order (DB-outage fallback)",
  createRoute.includes("persisted") && /catch\s*\(err\)[\s\S]{0,400}persistence failed/.test(createRoute)
);

const modal = source("src/components/PaymentMethodModal.tsx");
check(
  "modal routes INR straight to /checkout/upi (no pre-flight create call)",
  modal.includes('router.push(`/checkout/upi?plan=${plan.slug}`)') &&
    !modal.includes('fetch("/api/v1/payment/create"')
);

const checkoutClient = source("src/components/checkout/checkout-client.tsx");
check(
  "card client has a request timeout guard",
  checkoutClient.includes("AbortController") && checkoutClient.includes("REQUEST_TIMEOUT_MS")
);
check(
  "card client offers the UPI fallback on failure",
  checkoutClient.includes("/checkout/upi?plan=") && checkoutClient.includes("via UPI instead")
);
check("card client offers a retry", /function retry|const retry/.test(checkoutClient));

// ─── 3. Pricing hard-sync ────────────────────────────────────────────────────
console.log("\nFRPB — pricing hard-sync\n");

const expected: Array<[string, number, number]> = [
  ["MONTH_1", 1900, 20],
  ["YEAR_1", 4900, 50],
  ["LIFETIME", 9999, 100],
];
for (const [slug, inr, usd] of expected) {
  const dual = getDualPlan(slug);
  const shared = SHARED_PLANS.find((p) => p.slug === slug);
  check(`${slug}: web DUAL_PLANS = ₹${inr}/$${usd}`, dual?.inr === inr && dual?.usd === usd);
  check(`${slug}: shared PLANS = ₹${inr}/$${usd}`, shared?.inr === inr && shared?.usd === usd);
  check(
    `${slug}: shared priceCents = ${usd * 100}`,
    shared?.priceCents === usd * 100,
    `got ${shared?.priceCents}`
  );
  check(
    `${slug}: shared priceInr = ${inr * 100}`,
    shared?.priceInr === inr * 100,
    `got ${shared?.priceInr}`
  );
}

check("formatDualUsd(20) = $20", formatDualUsd(20) === "$20", formatDualUsd(20));
check("formatDualUsd(50) = $50", formatDualUsd(50) === "$50", formatDualUsd(50));
check("formatDualUsd(100) = $100", formatDualUsd(100) === "$100", formatDualUsd(100));
check("formatDualInr(1900) = ₹1,900", formatDualInr(1900) === "₹1,900", formatDualInr(1900));
check(
  "modal label = '₹1,900 / $20'",
  formatDualPrice(getDualPlan("MONTH_1")!) === "₹1,900 / $20",
  formatDualPrice(getDualPlan("MONTH_1")!)
);

check(
  "ALLOWED_USD_AMOUNTS = {20,50,100}",
  ALLOWED_USD_AMOUNTS.size === 3 &&
    isAllowedUsdAmount(20) &&
    isAllowedUsdAmount(50) &&
    isAllowedUsdAmount(100)
);
check(
  "ALLOWED_INR_AMOUNTS = {1900,4900,9999}",
  ALLOWED_INR_AMOUNTS.size === 3 && ALLOWED_INR_AMOUNTS.has(1900)
);
check("UPI amount lock mirrors INR tiers", ALLOWED_UPI_AMOUNTS.size === 3);
check("UPI plans resolve without gateway env", UPI_PLANS.length === 3);

// The two plan tables must agree field-for-field.
let drift = 0;
for (const dual of DUAL_PLANS) {
  const shared = SHARED_PLANS.find((p) => p.slug === dual.slug);
  if (!shared || shared.inr !== dual.inr || shared.usd !== dual.usd) drift++;
}
check("no drift between shared and web plan tables", drift === 0, `${drift} mismatches`);

// No stale USD figures may survive in prose/comments.
const filesToScan = [
  "src/config/plans.ts",
  "src/app/pricing/page.tsx",
  "src/lib/payment/orders.ts",
  "src/lib/payments/gateway.ts",
  "src/lib/payments/payglocal.ts",
  "src/app/api/v1/payment/payglocal/init/route.ts",
];
const stale = filesToScan.filter((f) => /\$(25|60|120)\b/.test(source(f)));
check("no stale $25/$60/$120 references remain", stale.length === 0, stale.join(", "));

// ─── 4. Cashfree fully removed ───────────────────────────────────────────────
console.log("\nFRPB — cashfree removal\n");

const gatewaySrc = source("src/lib/payments/gateway.ts");
const indexSrc = source("src/lib/payments/index.ts");
const secretsSrc = source("src/lib/payments/webhook-secrets.ts");
const checkoutSrc = source("src/app/api/v1/checkout/route.ts");

// Comment-stripped views — these test the CODE, so explanatory prose that names
// the removed provider does not produce a false failure.
const gatewayCode = code("src/lib/payments/gateway.ts");
const indexCode = code("src/lib/payments/index.ts");
const secretsCode = code("src/lib/payments/webhook-secrets.ts");
const checkoutCode = code("src/app/api/v1/checkout/route.ts");

// Assert on the RAW declaration line so the check cannot be defeated by
// comment-stripping quirks: the union must be exactly "PAYGLOCAL".
const providerUnion = /export type PaymentProviderName\s*=\s*([^;]+);/.exec(gatewaySrc);
check(
  "gateway.ts PaymentProviderName is exactly PAYGLOCAL (no CASHFREE)",
  providerUnion?.[1]?.trim() === '"PAYGLOCAL"',
  providerUnion?.[1]?.trim() ?? "declaration not found"
);
check(
  "index.ts no longer imports the Cashfree adapter",
  !indexCode.includes("CashfreeGateway") && !indexCode.includes("./cashfree")
);
check(
  "index.ts has no CASHFREE case/env vars",
  !indexCode.includes("CASHFREE_CLIENT_ID") && !indexCode.includes('case "CASHFREE"')
);
check(
  "providerForCurrency(INR) returns null (self-hosted UPI)",
  /currency === "INR" \? null : "PAYGLOCAL"/.test(indexCode)
);
check(
  "webhook-secrets.ts has no CASHFREE entry",
  !secretsCode.includes("CASHFREE")
);
check(
  "checkout route routes INR to /checkout/upi",
  checkoutCode.includes("/checkout/upi") && checkoutCode.includes('currency === "INR"')
);
const inrBranchIdx = checkoutCode.indexOf('currency === "INR"');
const authGateIdx = checkoutCode.indexOf("Please sign in to purchase");
check(
  "checkout route: INR resolves BEFORE the sign-in gate",
  inrBranchIdx !== -1 && authGateIdx !== -1 && inrBranchIdx < authGateIdx,
  `inrBranch@${inrBranchIdx} authGate@${authGateIdx}`
);
check(
  "checkout route CODE no longer references Cashfree",
  !/cashfree/i.test(checkoutCode)
);
// The explanatory comment should survive (audit trail), so only assert code.
check(
  "checkout route documents the Cashfree removal",
  /cashfree/i.test(checkoutSrc)
);

// The dead files themselves must be gone from disk.
import { existsSync } from "node:fs";
check(
  "lib/payments/cashfree.ts is deleted",
  !existsSync(join(root, "src/lib/payments/cashfree.ts"))
);
check(
  "api/v1/webhooks/cashfree route is deleted",
  !existsSync(join(root, "src/app/api/v1/webhooks/cashfree"))
);

// No remaining CASHFREE identifiers in the live payment plumbing.
const cashfreeFree = [
  "src/lib/payments/gateway.ts",
  "src/lib/payments/index.ts",
  "src/lib/payments/webhook-secrets.ts",
  "src/config/plans.ts",
  "src/lib/checkout/currency.ts",
];
const cashfreeLeftovers = cashfreeFree.filter((f) => /cashfree/i.test(code(f)));
check(
  "no cashfree CODE in the live payment config",
  cashfreeLeftovers.length === 0,
  cashfreeLeftovers.join(", ")
);

// ─── 5. Landing page credibility ─────────────────────────────────────────────
console.log("\nFRPB — landing page credibility\n");

const landing = source("src/app/page.tsx");
// Strip comments: the file DOCUMENTS the removed fake stats, which is the point.
const landingCode = code("src/app/page.tsx");
check("no fabricated '120,000+' counter in rendered copy", !landingCode.includes("120,000"));
check("no fabricated '4.9' rating in rendered copy", !landingCode.includes("4.9"));
check("no fabricated '2,000+ reviews' in rendered copy", !landingCode.includes("2,000"));
check(
  "landing no longer claims iOS support",
  !/Android & iOS|and iOS\b/i.test(landingCode)
);
check(
  "landing no longer promises generic boot-loop repair",
  !/boot loops/i.test(landingCode)
);
check(
  "landing describes Android FRP capability",
  /Android FRP/i.test(landingCode)
);
check(
  "landing metrics come from home-metrics",
  landingCode.includes("HOME_METRICS") && source("src/lib/home-metrics.ts").length > 0
);

console.log("\n" + "-".repeat(56));
console.log(`result: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
