// FRPB — Direct UPI payment primitives (self-hosted, zero-MDR).
//
// Builds standard NPCI UPI deep-link URIs that settle DIRECTLY to the merchant
// VPA with no third-party aggregator in the middle, plus the app-specific
// intent URLs used to hand the payment off to a native UPI app.
//
// Everything here is PURE and dependency-free so it can be imported by both the
// server (order creation returns the URI) and the client (QR render + intent
// buttons) without pulling Node APIs into the browser bundle.
//
// IMPORTANT — UTR VALIDATION LIMITATIONS:
//   The self-hosted Direct UPI engine validates UTRs structurally (12 digits)
//   and uniquely (one claim per reference via DB unique index). It does NOT
//   verify against NPCI/bank systems because:
//   - NPCI does not expose a public UTR verification API
//   - Bank-to-bank UPI settlement is final; there is no "cancel" mechanism
//   - Real-time bank statement access requires bank-level credentials
//
//   To prevent fake/random UTR abuse, this endpoint relies on:
//   1. Rate limiting (5 verify attempts per 10 min per IP)
//   2. Order-bound verification (UTR must match a valid, unexpired order)
//   3. Duplicate UTR protection (unique DB index)
//   4. Optional admin confirmation (paymentConfirmed flag — see schema)
//
//   For HIGH-VALUE transactions, admins should manually verify bank statements
//   before activating licenses, or use a hosted gateway (PayGlocal) that
//   provides server-side payment confirmation.

import { DUAL_PLANS } from "@/config/plans";

/** Merchant VPA that receives every direct-UPI settlement. */
export const UPI_MERCHANT_VPA = "alixpay@axl";

/** Merchant display name shown inside the customer's UPI app. */
export const UPI_MERCHANT_NAME = "FRPB Recovery";

/** Currency for every direct-UPI transaction. UPI settles in INR only. */
export const UPI_CURRENCY = "INR";

/**
 * A plan that may be purchased through the direct-UPI rail.
 *
 * `amount` is in MAJOR units (rupees) because the UPI `am` parameter expects a
 * decimal rupee value (e.g. `am=1900`, `am=9999`) — unlike the paise-based
 * `priceInr` used by the aggregated gateway flow.
 */
/** The three public Direct-UPI plan identifiers. */
export type UpiPlanId = "MONTHLY" | "YEARLY" | "LIFETIME";

export interface UpiPlan {
  planId: UpiPlanId;
  /** Prisma PlanType + shared PlanSlug value stored on the order. */
  planSlug: "MONTH_1" | "YEAR_1" | "LIFETIME";
  name: string;
  /** Rupees. Hardcoded — the client can never supply this. */
  amount: number;
  /** Duration in days (null = lifetime), used for license expiry. */
  durationDays: number | null;
}

/**
 * The ONLY amounts the backend will ever charge, keyed by public plan id.
 *
 * Derived from DUAL_PLANS in @/config/plans so the INR tiers have exactly ONE
 * definition shared by the Direct-UPI engine, the payment-method modal and the
 * PayGlocal rail. `POST /api/v1/payment/create` resolves the amount from this
 * table and ignores any client-supplied value, so a tampered payload can never
 * under-pay.
 */
export const UPI_PLANS: readonly UpiPlan[] = DUAL_PLANS.map((p) => ({
  planId: p.orderPlanId,
  planSlug: p.slug,
  name: p.name,
  amount: p.inr,
  durationDays: p.durationDays,
}));

/** Look up a plan by its public id (case-insensitive). */
export function getUpiPlan(planId: string): UpiPlan | null {
  const needle = `${planId ?? ""}`.trim().toUpperCase();
  return UPI_PLANS.find((p) => p.planId === needle) ?? null;
}

/** The set of amounts the backend accepts — the strict amount lock. */
export const ALLOWED_UPI_AMOUNTS: ReadonlySet<number> = new Set(
  UPI_PLANS.map((p) => p.amount)
);

export interface GenerateUpiUriInput {
  /** Public order reference embedded as `tr` and in the transaction note. */
  orderId: string;
  /** Public plan id (MONTHLY | YEARLY | LIFETIME). */
  planId: string;
  /** Amount in RUPEES — must come from the backend plan table. */
  amount: number;
  /** Optional VPA override; defaults to the merchant VPA. */
  vpa?: string;
  /** Optional payee-name override; defaults to the merchant name. */
  name?: string;
}

/**
 * Percent-encode a UPI parameter value.
 *
 * Uses `encodeURIComponent` (so spaces become `%20`, NOT the `+` produced by
 * `URLSearchParams`) but restores the `@` that every VPA contains — the spec
 * form `pa=alixpay@axl` keeps the at-sign literal, and encoding it to `%40` is
 * rejected by some UPI apps.
 */
export function encodeUpiValue(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, "@");
}

/**
 * Build the standard NPCI UPI payment URI:
 *
 *   upi://pay?pa=alixpay@axl&pn=FRPB%20Recovery&am=<amount>&cu=INR
 *              &tn=Order%20<orderId>&tr=<orderId>
 *
 * Parameters are emitted in the canonical order (pa, pn, am, cu, tn, tr).
 */
export function generateUpiUri({
  orderId,
  planId,
  amount,
  vpa = UPI_MERCHANT_VPA,
  name = UPI_MERCHANT_NAME,
}: GenerateUpiUriInput): string {
  // `planId` is retained in the signature for traceability/validation by
  // callers; the reference itself stays exactly `tr=<orderId>` per spec.
  void planId;
  const pairs: Array<[string, string]> = [
    ["pa", vpa],
    ["pn", name],
    ["am", formatUpiAmount(amount)],
    ["cu", UPI_CURRENCY],
    // Transaction note — surfaced in the payer's UPI history.
    ["tn", `Order ${orderId}`],
    // Transaction reference — echoed back on the settlement record so an
    // operator can reconcile a UTR against the exact order.
    ["tr", orderId],
  ];
  const query = pairs
    .map(([key, value]) => `${key}=${encodeUpiValue(value)}`)
    .join("&");
  return `upi://pay?${query}`;
}

/**
 * The raw query string (everything after the `?`) for a UPI URI, so a native
 * app scheme can be constructed by swapping only the scheme prefix.
 */
export function upiUriQuery(upiUri: string): string {
  const idx = upiUri.indexOf("?");
  return idx >= 0 ? upiUri.slice(idx + 1) : "";
}

export interface UpiIntentUrls {
  /** Generic `upi://` link (works with the OS default UPI handler). */
  generic: string;
  /** PhonePe deep link. */
  phonepe: string;
  /** Google Pay deep link. */
  gpay: string;
  /** Paytm (Paytm MP) deep link. */
  paytm: string;
}

/**
 * Derive the per-app intent URLs from a base UPI URI.
 *
 * Each native app registers its own scheme but accepts the identical UPI query
 * parameters, so the parameters are reused verbatim and only the scheme prefix
 * changes:
 *
 *   phonepe://pay?…   gpay://upi/pay?…   paytmmp://pay?…   upi://pay?…
 */
export function generateUpiIntentUrls(upiUri: string): UpiIntentUrls {
  const query = upiUriQuery(upiUri);
  return {
    generic: `upi://pay?${query}`,
    phonepe: `phonepe://pay?${query}`,
    gpay: `gpay://upi/pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
  };
}

/**
 * Format a rupee amount for the `am` parameter. Whole rupees are emitted without
 * a trailing `.00` (UPI apps render `am=1900` as ₹1,900); any fractional part is
 * preserved to two decimals.
 */
export function formatUpiAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

// ─── UTR validation ──────────────────────────────────────────────────────────

/**
 * A UPI transaction reference (UTR/RRN) is exactly 12 numeric digits.
 *
 * NOTE: This is a STRUCTURAL check only. Real UTRs are 12-digit numbers issued
 * by banks/UPI apps for each transaction. However, ANY 12-digit number passes
 * this check — there is no cryptographic or bank-side validation available in
 * a self-hosted model.
 *
 * To prevent random/fake UTR abuse:
 *   1. Rate limiting on verify endpoint (5 attempts per 10 min per IP)
 *   2. Order-bound verification (UTR must match a valid, unclaimed order)
 *   3. Unique DB index on UTR (prevents double-claim)
 *   4. Optional admin confirmation flag for high-value protection
 */
export const UTR_PATTERN = /^\d{12}$/;

/** True when `utr` is a structurally valid 12-digit UPI reference. */
export function isValidUtr(utr: string): boolean {
  return UTR_PATTERN.test(`${utr ?? ""}`.trim());
}

/** Strip spaces/dashes a customer may have copied from their bank SMS. */
export function normalizeUtr(utr: string): string {
  return `${utr ?? ""}`.replace(/[\s-]/g, "").trim();
}

/**
 * Warn when a UTR passes structural validation but is clearly suspicious.
 * Used for logging/audit — not a rejection criterion.
 *
 * Examples of suspicious patterns:
 *   - All same digits (111111111111, 222222222222, etc.)
 *   - Sequential digits (123456789012)
 *   - Repeated pairs (121212121212)
 */
export function isSuspiciousUtr(utr: string): boolean {
  const digits = Array.from(utr);
  if (digits.length !== 12) return false;

  // All same digit
  if (new Set(digits).size === 1) return true;

  // Sequential (ascending or descending)
  let sequential = true;
  for (let i = 1; i < digits.length; i++) {
    const diff = (parseInt(digits[i]) - parseInt(digits[i - 1])) % 10;
    if (diff !== 1 && diff !== -9) { // -9 handles 9→0 wrap
      sequential = false;
      break;
    }
  }
  if (sequential) return true;

  // Repeated 2-digit pattern (121212121212, 565656565656, etc.)
  const pair = digits.slice(0, 2).join("");
  let repeated = true;
  for (let i = 2; i < digits.length; i += 2) {
    const currentPair = digits.slice(i, i + 2).join("");
    if (currentPair !== pair) {
      repeated = false;
      break;
    }
  }
  if (repeated && digits.length % 2 === 0) return true;

  return false;
}
