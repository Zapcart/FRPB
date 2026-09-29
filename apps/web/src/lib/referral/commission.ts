// FRPB — VIP cash affiliate commission math (pure, dependency-free).
//
// Post-unlock: future referred sales earn the referrer cash.
//   Monthly Plan  ($20/mo) → 30% cash ($6/mo recurring).
//   Lifetime Plan ($150)    → 50% cash (up to $75 upfront).

import { applyBps, REFERRAL_RULES, type ReferralPlanId } from "./config";

export type CommissionKind = "MONTHLY_RECURRING" | "LIFETIME_UPFRONT";

export interface CommissionComputation {
  kind: CommissionKind;
  baseCents: number;
  rateBps: number;
  amountCents: number;
}

/** Map a plan to its commission kind. */
export function commissionKindForPlan(planId: ReferralPlanId): CommissionKind {
  return planId === "LIFETIME" ? "LIFETIME_UPFRONT" : "MONTHLY_RECURRING";
}

/** Rate (bps) for a referral plan. */
export function commissionRateBps(planId: ReferralPlanId): number {
  return planId === "LIFETIME"
    ? REFERRAL_RULES.commission.lifetimeRateBps
    : REFERRAL_RULES.commission.monthlyRateBps;
}

/**
 * Compute the VIP commission for a settled referred sale.
 *
 * `baseCents` MUST be the actual amount charged (post-discount) — never a
 * client-supplied figure. The rate is applied to the real money collected.
 */
export function computeCommission(
  planId: ReferralPlanId,
  baseCents: number
): CommissionComputation {
  const base = Math.max(0, Math.round(Number.isFinite(baseCents) ? baseCents : 0));
  const kind = commissionKindForPlan(planId);
  const rateBps = commissionRateBps(planId);
  return { kind, baseCents: base, rateBps, amountCents: applyBps(base, rateBps) };
}

/** Sum of released commission cents (defensive against malformed rows). */
export function sumReleasedCents(
  rows: ReadonlyArray<{ status: string; amountCents: number }>
): number {
  return rows.reduce((total, row) => {
    if (row.status !== "RELEASED") return total;
    const amount = Number.isFinite(row.amountCents) ? row.amountCents : 0;
    return total + Math.max(0, Math.floor(amount));
  }, 0);
}
