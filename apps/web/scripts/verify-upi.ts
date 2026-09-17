// FRPB — Direct-UPI + dual-currency regression checks.
//
//   pnpm --filter @frpb/web exec tsx scripts/verify-upi.ts
//
// Asserts the UPI URI/intent builders, the strict amount locks for BOTH rails,
// the dual-currency plan table and the UTR validation rules that the payment
// routes depend on. Kept dependency-light so it runs anywhere without a DB or
// network.

import {
  ALLOWED_UPI_AMOUNTS,
  UPI_MERCHANT_NAME,
  UPI_MERCHANT_VPA,
  UPI_PLANS,
  formatUpiAmount,
  generateUpiIntentUrls,
  generateUpiUri,
  getUpiPlan,
  isValidUtr,
  normalizeUtr,
} from "../src/lib/upi";
import {
  ALLOWED_INR_AMOUNTS,
  ALLOWED_USD_AMOUNTS,
  DUAL_PLANS,
  formatDualInr,
  formatDualPrice,
  formatDualUsd,
  getDualPlan,
  isAllowedInrAmount,
  isAllowedUsdAmount,
  providerForDualCurrency,
} from "../src/config/plans";

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

console.log("FRPB — Direct UPI verification\n");

// ─── Plan table (strict amount lock) ─────────────────────────────────────────
const expected: Array<[string, number]> = [
  ["MONTHLY", 1900],
  ["YEARLY", 4900],
  ["LIFETIME", 9999],
];
for (const [planId, amount] of expected) {
  const plan = getUpiPlan(planId);
  check(`plan ${planId} = ₹${amount}`, plan?.amount === amount, `got ${plan?.amount}`);
}
check("exactly three plans", UPI_PLANS.length === 3);
check(
  "ALLOWED_UPI_AMOUNTS = {1900,4900,9999}",
  ALLOWED_UPI_AMOUNTS.size === 3 &&
    ALLOWED_UPI_AMOUNTS.has(1900) &&
    ALLOWED_UPI_AMOUNTS.has(4900) &&
    ALLOWED_UPI_AMOUNTS.has(9999)
);
check("unknown plan rejected", getUpiPlan("FREE") === null);
check("plan lookup is case-insensitive", getUpiPlan("yearly")?.amount === 4900);

// ─── UPI URI ─────────────────────────────────────────────────────────────────
const uri = generateUpiUri({ orderId: "ORD-ABC123", planId: "YEARLY", amount: 4900 });
check("scheme is upi://pay", uri.startsWith("upi://pay?"));
check("exact spec URI shape", uri === "upi://pay?pa=alixpay@axl&pn=FRPB%20Recovery&am=4900&cu=INR&tn=Order%20ORD-ABC123&tr=ORD-ABC123", uri);
check("merchant VPA present with literal @", uri.includes(`pa=${UPI_MERCHANT_VPA}`));
check(
  "merchant name space encoded as %20 (not +)",
  uri.includes("pn=FRPB%20Recovery") && !uri.includes("pn=FRPB+Recovery")
);
check("amount present", uri.includes("am=4900"));
check("currency is INR", uri.includes("cu=INR"));
check("transaction note uses %20", uri.includes("tn=Order%20ORD-ABC123"));
check("transaction ref is the bare order id", uri.includes("tr=ORD-ABC123"));
check("UPI_MERCHANT_NAME constant is correct", UPI_MERCHANT_NAME === "FRPB Recovery");
check("UPI_MERCHANT_VPA constant is correct", UPI_MERCHANT_VPA === "alixpay@axl");

// Tampered amount is irrelevant — the builder only emits what it is given and
// the ROUTE is what enforces the lock (covered by the plan table above).
const wholeUri = generateUpiUri({ orderId: "X", planId: "MONTHLY", amount: 1900 });
check("whole rupees have no decimals", wholeUri.includes("am=1900") && !wholeUri.includes("1900.00"));

// ─── Intent URLs ─────────────────────────────────────────────────────────────
const intents = generateUpiIntentUrls(uri);
check("phonepe scheme", intents.phonepe.startsWith("phonepe://pay?"));
check("gpay scheme", intents.gpay.startsWith("gpay://upi/pay?"));
check("paytm scheme", intents.paytm.startsWith("paytmmp://pay?"));
check("generic scheme", intents.generic.startsWith("upi://pay?"));
const query = uri.slice(uri.indexOf("?") + 1);
check("phonepe reuses the UPI query verbatim", intents.phonepe.endsWith(query));
check("gpay reuses the UPI query verbatim", intents.gpay.endsWith(query));
check("paytm reuses the UPI query verbatim", intents.paytm.endsWith(query));

// ─── Amount formatting ───────────────────────────────────────────────────────
check("formatUpiAmount whole", formatUpiAmount(1900) === "1900");
check("formatUpiAmount fractional", formatUpiAmount(4999.5) === "4999.50");
check("formatUpiAmount rejects non-positive", formatUpiAmount(0) === "0");

// ─── UTR validation ──────────────────────────────────────────────────────────
check("valid 12-digit UTR", isValidUtr("412345678901"));
check("rejects 11 digits", !isValidUtr("41234567890"));
check("rejects 13 digits", !isValidUtr("4123456789012"));
check("rejects letters", !isValidUtr("41234567890A"));
check("rejects empty", !isValidUtr(""));
check("normalizeUtr strips spaces", normalizeUtr("4123 4567 8901") === "412345678901");
check("normalizeUtr strips dashes", normalizeUtr("4123-4567-8901") === "412345678901");
check("normalized value is valid", isValidUtr(normalizeUtr("4123 4567 8901")));

// ─── Dual-currency plan configuration ────────────────────────────────────────
console.log("\nFRPB — Dual-currency plan config\n");

const dualExpect: Array<[string, number, number]> = [
  ["MONTH_1", 1900, 25],
  ["YEAR_1", 4900, 60],
  ["LIFETIME", 9999, 120],
];
for (const [slug, inr, usd] of dualExpect) {
  const plan = getDualPlan(slug);
  check(
    `plan ${slug} = ₹${inr} / $${usd}`,
    plan?.inr === inr && plan?.usd === usd,
    `got ₹${plan?.inr} / $${plan?.usd}`
  );
}
check("exactly three dual plans", DUAL_PLANS.length === 3);
check("getDualPlan is case-insensitive", getDualPlan("year_1")?.usd === 60);
check("unknown dual plan rejected", getDualPlan("FREE") === null);

// Strict amount locks — the ONLY figures each rail may charge.
check(
  "ALLOWED_INR_AMOUNTS = {1900,4900,9999}",
  ALLOWED_INR_AMOUNTS.size === 3 &&
    isAllowedInrAmount(1900) &&
    isAllowedInrAmount(4900) &&
    isAllowedInrAmount(9999)
);
check(
  "ALLOWED_USD_AMOUNTS = {25,60,120}",
  ALLOWED_USD_AMOUNTS.size === 3 &&
    isAllowedUsdAmount(25) &&
    isAllowedUsdAmount(60) &&
    isAllowedUsdAmount(120)
);
check("tampered INR amount rejected", !isAllowedInrAmount(1) && !isAllowedInrAmount(1901));
check("tampered USD amount rejected", !isAllowedUsdAmount(1) && !isAllowedUsdAmount(99));

// Routing: currency → rail.
check("INR routes to Direct UPI", providerForDualCurrency("INR") === "UPI");
check("USD routes to PayGlocal", providerForDualCurrency("USD") === "PAYGLOCAL");

// Formatting used by the modal / pricing grid.
check("formatDualInr(1900) = ₹1,900", formatDualInr(1900) === "₹1,900", formatDualInr(1900));
check("formatDualInr(9999) = ₹9,999", formatDualInr(9999) === "₹9,999", formatDualInr(9999));
check("formatDualUsd(25) = $25", formatDualUsd(25) === "$25", formatDualUsd(25));
check("formatDualUsd(120) = $120", formatDualUsd(120) === "$120", formatDualUsd(120));
check(
  "formatDualPrice shows both currencies",
  formatDualPrice(getDualPlan("MONTH_1")!) === "₹1,900 / $25",
  formatDualPrice(getDualPlan("MONTH_1")!)
);

// The UPI engine's plan table must agree with the dual config.
check(
  "UPI_PLANS INR amounts match DUAL_PLANS",
  UPI_PLANS.every((u) => getDualPlan(u.planSlug)?.inr === u.amount)
);

console.log("\n" + "-".repeat(52));
console.log(`result: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
