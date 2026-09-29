// FRPB — referral engine configuration (pure, dependency-free).
//
// Single source of truth for all gamified-unlock + VIP affiliate constants.
// MONEY IS ALWAYS INTEGER CENTS. This module imports nothing so it can be unit
// tested without any runtime (DB, Redis, network).

export const REFERRAL_RULES = {
  /** Lifetime plan list price in USD cents ($150). */
  lifetimePriceCents: 15000,
  /** Referred-friend discount on the Lifetime plan: 20% off ($150 → $120). */
  lifetimeDiscountBps: 2000,
  /** Monthly plan list price in USD cents ($20). */
  monthlyPriceCents: 2000,
  /** Monthly plan discount is intentionally 0% to fully protect MRR. */
  monthlyDiscountBps: 0,

  /** Route A unlock: 2 Lifetime referrals ($240 upfront). */
  routeA: { lifetimeRequired: 2 },
  /** Route B unlock: 4 Monthly + 1 Lifetime referral ($200 upfront). */
  routeB: { monthlyRequired: 4, lifetimeRequired: 1 },

  /** Partial-credit downsell: 50% off Lifetime = $75. */
  downsellDiscountBps: 5000,

  /** VIP cash affiliate commission rates (basis points). */
  commission: {
    monthlyRateBps: 3000, // 30% of a referred $20/mo sale → $6
    lifetimeRateBps: 5000, // 50% of a referred lifetime sale → up to $75
  },

  /** Referral credits/commissions stay PENDING for this refund-lock window. */
  refundLockDays: 14,
  /** Bonus urgency window shown to users to claim VIP perks. */
  urgencyWindowHours: 48,

  /** Minimum cash payout (USD cents). */
  payoutMinCents: 5000,
} as const;

/** Basis-point denominator: 10000 bps = 100%. */
export const BPS_DENOMINATOR = 10000;

export type ReferralPlanId = "MONTH_1" | "LIFETIME";

/** Apply a basis-point rate to a cent amount, floor-rounded to whole cents. */
export function applyBps(amountCents: number, rateBps: number): number {
  if (!Number.isFinite(amountCents) || !Number.isFinite(rateBps)) return 0;
  if (amountCents <= 0 || rateBps <= 0) return 0;
  return Math.floor((amountCents * rateBps) / BPS_DENOMINATOR);
}

function listPriceCents(planId: ReferralPlanId): number {
  return planId === "LIFETIME"
    ? REFERRAL_RULES.lifetimePriceCents
    : REFERRAL_RULES.monthlyPriceCents;
}

function discountRateBps(planId: ReferralPlanId): number {
  return planId === "LIFETIME"
    ? REFERRAL_RULES.lifetimeDiscountBps
    : REFERRAL_RULES.monthlyDiscountBps;
}

/** The referral discount (cents off list price) for the given plan. */
export function referralDiscountCents(planId: ReferralPlanId): number {
  return applyBps(listPriceCents(planId), discountRateBps(planId));
}

/** The discounted price a referred friend pays for the given plan (cents). */
export function discountedPriceCents(planId: ReferralPlanId): number {
  return listPriceCents(planId) - referralDiscountCents(planId);
}

/** The downsell (partial-credit) price for Lifetime access (cents, $75). */
export function downsellPriceCents(): number {
  return (
    REFERRAL_RULES.lifetimePriceCents -
    applyBps(
      REFERRAL_RULES.lifetimePriceCents,
      REFERRAL_RULES.downsellDiscountBps
    )
  );
}

/** Compute the refund-lock release timestamp from a paid time. */
export function releaseAtFrom(paidAt: Date): Date {
  const ms = REFERRAL_RULES.refundLockDays * 24 * 60 * 60 * 1000;
  return new Date(paidAt.getTime() + ms);
}

/**
 * Whether a charged amount (cents) is a sanctioned referral price for a plan.
 * Used server-side so a client can never invent its own discounted amount.
 */
export function isSanctionedReferralAmount(
  planId: ReferralPlanId,
  amountCents: number
): boolean {
  const value = Math.round(amountCents);
  if (value === listPriceCents(planId)) return true;
  if (value === discountedPriceCents(planId)) return true;
  if (planId === "LIFETIME" && value === downsellPriceCents()) return true;
  return false;
}
