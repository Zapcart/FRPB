// FRPB — Direct UPI payment primitives (self-hosted, zero-MDR).
//
// Builds standard NPCI UPI deep-link URIs that settle DIRECTLY to the merchant
// VPA with no third-party aggregator in the middle, plus the app-specific
// intent URLs used to hand the payment off to a native UPI app.
//
// Everything here is PURE and dependency-free so it can be imported by both the
// server (order creation returns the URI) and the client (QR render + intent
// buttons) without pulling Node APIs into the browser bundle.

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
export interface UpiPlan {
  planId: "MONTHLY" | "YEARLY" | "LIFETIME";
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
 * These are the authoritative prices: `POST /api/v1/payment/create` resolves the
 * amount from this table and ignores any client-supplied value, so a tampered
 * payload can never under-pay.
 */
export const UPI_PLANS: readonly UpiPlan[] = [
  { planId: "MONTHLY", planSlug: "MONTH_1", name: "1 Month", amount: 1900, durationDays: 30 },
  { planId: "YEARLY", planSlug: "YEAR_1", name: "1 Year", amount: 4900, durationDays: 365 },
  { planId: "LIFETIME", planSlug: "LIFETIME", name: "Lifetime", amount: 9999, durationDays: null },
] as const;

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

/** A UPI transaction reference (UTR/RRN) is exactly 12 numeric digits. */
export const UTR_PATTERN = /^\d{12}$/;

/** True when `utr` is a structurally valid 12-digit UPI reference. */
export function isValidUtr(utr: string): boolean {
  return UTR_PATTERN.test(`${utr ?? ""}`.trim());
}

/** Strip spaces/dashes a customer may have copied from their bank SMS. */
export function normalizeUtr(utr: string): string {
  return `${utr ?? ""}`.replace(/[\s-]/g, "").trim();
}
