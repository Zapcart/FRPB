// FRPB — limited-time launch promo source of truth.
//
// The $20 tier is advertised as "6 months" during a bounded 30-day launch
// window. The PRICE never changes ($20 USD / ₹1,900 INR); only the
// GRANTED DURATION does (180 days during the offer → 60 days after). Because
// the price is fixed there is no Razorpay amount / order / signature change —
// the switch is entirely a server-side entitlement decision made at grant time.
//
// This module is deliberately dependency-free and pure so it can be imported by
// apps/web (server + client) and apps/desktop, and unit-tested without a DOM or
// a database. It is the ONE place the promo deadline is defined: the marketing
// countdown and the license expiry must agree, and a single constant guarantees
// that, mirroring how `config/plans.ts#assertPlansInSync` guards price drift.

/**
 * The launch offer window and its two duration outcomes.
 *
 * `endsAt` is an instant in UTC. `isPromoActive` compares against `Date.now()`
 * (or a supplied `now`), so the offer closes simultaneously everywhere without
 * a deploy.
 */
export const LAUNCH_PROMO = {
  /** Stable machine code recorded on licenses/webhooks for audit. */
  code: "LAUNCH6",
  /** Human label shown on the pricing/checkout surfaces. */
  label: "Launch Offer — 6 months (30-day launch window)",
  /** Short urgency line for banners. */
  shortLabel: "Launch offer — 6 months, ends in 30 days",
  /**
   * Promo deadline (UTC, inclusive). Fixed 30-day target from the offer start
   * (2026-10-10). After this instant the tier drops to 60 days (2 months).
   */
  endsAt: "2026-11-09T23:59:59.000Z",
  /** Granted access during the offer (6 months). */
  promoDurationDays: 180,
  /** Granted access after the offer (2 months). */
  standardDurationDays: 60,
} as const;

/** Whole days in the launch window — the urgency the banners advertise. */
export const LAUNCH_PROMO_WINDOW_DAYS = 30 as const;

/** Milliseconds from `now` until the promo window closes. `<= 0` when expired. */
export function msUntilPromoEnds(now: Date = new Date()): number {
  return new Date(LAUNCH_PROMO.endsAt).getTime() - now.getTime();
}

/** True while the launch offer is still open. */
export function isPromoActive(now: Date = new Date()): boolean {
  return msUntilPromoEnds(now) > 0;
}

/**
 * The duration, in days, that a MONTH_1 ($20) purchase is entitled to *right
 * now*. Resolved server-side at payment/grant time so a buyer always receives
 * exactly the term advertised at the moment they paid.
 */
export function resolveMonthlyDurationDays(now: Date = new Date()): number {
  return isPromoActive(now)
    ? LAUNCH_PROMO.promoDurationDays
    : LAUNCH_PROMO.standardDurationDays;
}

/** Whole-month granularity label, e.g. 180 → "6 months", 60 → "2 months". */
export function monthlyDurationMonths(days: number): number {
  return Math.round(days / 30);
}

/** Display suffix for the $20 tier, promo-aware. */
export function monthlyDurationLabel(now: Date = new Date()): string {
  const months = monthlyDurationMonths(resolveMonthlyDurationDays(now));
  return `${months} months`;
}
