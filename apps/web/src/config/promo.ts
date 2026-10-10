// FRPB — web-facing promo helpers.
//
// Thin, UI-oriented re-export layer over the canonical promo window in
// @frpb/shared. The marketing surfaces (pricing grid, checkout panel, landing
// banner, structured data) import from HERE rather than reaching into the shared
// package directly, so there is exactly one place that composes the
// human-readable copy while the *window* itself still lives in one constant.
//
// ⚠️ The deadline is NOT redeclared here. It is re-exported from the shared
// LAUNCH_PROMO so the countdown a buyer sees and the duration a buyer receives
// can never drift apart (same invariant config/plans.ts#assertPlansInSync
// enforces for prices).

import {
  LAUNCH_PROMO,
  isPromoActive,
  msUntilPromoEnds,
  monthlyDurationLabel,
  monthlyDurationMonths,
  resolveMonthlyDurationDays,
} from "@frpb/shared";

export { LAUNCH_PROMO, isPromoActive, msUntilPromoEnds, resolveMonthlyDurationDays };

/** ISO instant the launch offer closes — fed to the countdown + structured data. */
export const promoEndsAtIso: string = LAUNCH_PROMO.endsAt;

/** Machine code recorded for audit (e.g. license metadata, analytics events). */
export const promoCode: string = LAUNCH_PROMO.code;

/** True while the offer is open, evaluated at call time. */
export function promoActive(now: Date = new Date()): boolean {
  return isPromoActive(now);
}

/** Whole months the $20 tier currently grants (6 during the offer, else 2). */
export function promoMonthlyMonths(now: Date = new Date()): number {
  return monthlyDurationMonths(resolveMonthlyDurationDays(now));
}

/** "6 months" / "2 months" — for suffixes like "/ 6 months". */
export function promoMonthlyLabel(now: Date = new Date()): string {
  return monthlyDurationLabel(now);
}

/**
 * Billing suffix rendered next to the $20 price. Promo-aware so the pricing
 * grid, landing page and checkout all agree without three hardcoded strings.
 *
 * The `*For` variants take an already-resolved boolean so client components can
 * pass usePromoState().active (computed in an effect) instead of reading the
 * clock during render — which would desync server HTML and client hydration.
 */
export function monthlyBillingSuffix(now: Date = new Date()): string {
  return monthlyBillingSuffixFor(isPromoActive(now));
}

/** Boolean-driven variant of monthlyBillingSuffix — hydration-safe. */
export function monthlyBillingSuffixFor(active: boolean): string {
  const days = active ? LAUNCH_PROMO.promoDurationDays : LAUNCH_PROMO.standardDurationDays;
  const months = monthlyDurationMonths(days);
  return active ? `/ ${months} months (launch offer)` : `/ ${months} months`;
}

/** Boolean-driven variant of promoMonthlyMonths — hydration-safe. */
export function promoMonthlyMonthsFor(active: boolean): number {
  return monthlyDurationMonths(
    active ? LAUNCH_PROMO.promoDurationDays : LAUNCH_PROMO.standardDurationDays
  );
}

/** Boolean-driven variant — raw days the $20 tier grants (180 promo / 60 standard). */
export function promoMonthlyDaysFor(active: boolean): number {
  return active ? LAUNCH_PROMO.promoDurationDays : LAUNCH_PROMO.standardDurationDays;
}

/** Headline for the promo banner; switches to a neutral line once expired. */
export function promoHeadline(now: Date = new Date()): string {
  return isPromoActive(now)
    ? "Launch offer — $20 unlocks 6 months"
    : "$20 plan — standard 2-month term";
}

/** One-line urgency/reassurance copy shown under the banner. */
export function promoSubtext(now: Date = new Date()): string {
  return isPromoActive(now)
    ? "Launch offer: $20 unlocks 6 months of full access — but only for the next 30 days. When the countdown hits zero the same plan reverts to 2 months."
    : "The launch offer has ended. The $20 plan now grants 2 months of full access.";
}
