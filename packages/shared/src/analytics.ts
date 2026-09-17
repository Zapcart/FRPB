// FRPB — Admin dashboard analytics types.
// Returned by GET /api/v1/admin/analytics (server-side only).

export interface AdminAnalyticsResponse {
  visitors: {
    total30d: number;
    returning30d: number;
  };
  logins: {
    total30d: number;
  };
  licenses: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
    pending: number;
    deviceSlotsUsed: number;
    deviceSlotsTotal: number;
  };
  frp: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
    successRate: number; // 0..100
  };
  frpByBrand: {
    brand: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  frpByAndroidVersion: {
    version: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  recentFrp: {
    id: string;
    brand: string;
    model: string;
    androidVersion: string | null;
    status: string;
    requestedAt: string;
  }[];
  recentLicenses: {
    id: string;
    key: string;
    planName: string;
    status: string;
    userEmail: string;
    createdAt: string;
  }[];
  revenue: RevenueMetrics;
}

/**
 * Revenue for ONE currency.
 *
 * `amount` is expressed in that currency's MAJOR unit (INR rupees / USD dollars)
 * so the two pools are never summed together — ₹1,900 and $20 are not addends.
 * `minorAmount` is the same figure in the currency's minor unit (paise / cents)
 * and is retained for exact accounting reconciliation.
 */
export interface CurrencyRevenue {
  currency: "INR" | "USD";
  /** Successful (settled) revenue, major units. */
  amount: number;
  /** The same successful figure in minor units (paise / cents). */
  minorAmount: number;
  /** Settled transactions that produced this revenue. */
  successfulCount: number;
  /** Successful revenue from historical, now-retired rails in this currency. */
  legacyAmount: number;
  /** Successful revenue from the live rails (Direct UPI / PayGlocal). */
  liveAmount: number;
}

/** Per-plan sales, split by currency so mixed-currency carts stay legible. */
export interface RevenuePlanBreakdown {
  name: string;
  sold: number;
  revenueInr: number;
  revenueUsd: number;
  countInr: number;
  countUsd: number;
}

/**
 * Multi-currency revenue summary.
 *
 * Money is NEVER collapsed into a single figure: INR (Direct UPI, and the
 * retired Cashfree/INR rails) and USD (PayGlocal cards) are reported as separate
 * pools. Comparing them is only meaningful after an explicit FX conversion, which
 * the dashboard deliberately does not perform.
 */
export interface RevenueMetrics {
  inr: CurrencyRevenue;
  usd: CurrencyRevenue;
  /** Per-plan sales, with each currency's revenue reported separately. */
  plans: RevenuePlanBreakdown[];
}

export interface AdminQueryResult {
  visitors: { total30d: number; returning30d: number };
  logins: { total30d: number };
  licenses: { total: number; active: number; expired: number; revoked: number; pending: number; deviceSlotsUsed: number; deviceSlotsTotal: number };
  frp: { total: number; completed: number; failed: number; pending: number; processing: number; successRate: number };
  frpByBrand: { brand: string; total: number; completed: number; failed: number; successRate: number }[];
  frpByAndroidVersion: { version: string; total: number; completed: number; failed: number; successRate: number }[];
  recentFrp: { id: string; brand: string; model: string; androidVersion: string | null; status: string; requestedAt: string }[];
  recentLicenses: { id: string; key: string; planName: string; status: string; userEmail: string; createdAt: string }[];
  revenue: RevenueMetrics;
}
