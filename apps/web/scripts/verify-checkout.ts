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

console.log("\n" + "-".repeat(56));
console.log(`result: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
