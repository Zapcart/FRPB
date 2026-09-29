// FRPB — gamified unlock progress (pure, dependency-free).
//
// Track two distinct unlock criteria for FREE $150 Lifetime access:
//   ROUTE A: 2 Lifetime referrals.
//   ROUTE B: 4 Monthly + 1 Lifetime referral.
// Progress % = max(Route A %, Route B %).

import { REFERRAL_RULES, type ReferralPlanId } from "./config";

export interface QualifiedReferralCounts {
  monthly: number;
  lifetime: number;
}

export type UnlockRouteId = "ROUTE_A" | "ROUTE_B";

export interface RouteRequirement {
  current: number;
  required: number;
}

export interface RouteProgress {
  route: UnlockRouteId;
  monthly: RouteRequirement;
  lifetime: RouteRequirement;
  /** 0..100, rounded. */
  percent: number;
  complete: boolean;
}

export interface UnlockProgress {
  monthlyCount: number;
  lifetimeCount: number;
  routeA: RouteProgress;
  routeB: RouteProgress;
  /** max(Route A %, Route B %), rounded to nearest integer. */
  percent: number;
  unlocked: boolean;
  unlockRoute: UnlockRouteId | null;
  /** Partial-credit downsell eligibility (Route A has exactly 1/2 lifetime). */
  downsellEligible: boolean;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function safeCount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function computeProgress(counts: QualifiedReferralCounts): UnlockProgress {
  const monthly = safeCount(counts.monthly);
  const lifetime = safeCount(counts.lifetime);

  const aReq = REFERRAL_RULES.routeA.lifetimeRequired;
  const bMonthlyReq = REFERRAL_RULES.routeB.monthlyRequired;
  const bLifetimeReq = REFERRAL_RULES.routeB.lifetimeRequired;

  const aFrac = clamp01(lifetime / aReq);
  const aComplete = aFrac >= 1;

  const bMonthlyFrac = clamp01(monthly / bMonthlyReq);
  const bLifetimeFrac = clamp01(lifetime / bLifetimeReq);
  // Route B is the average of its two independent requirements.
  const bFrac = (bMonthlyFrac + bLifetimeFrac) / 2;
  const bComplete = bMonthlyFrac >= 1 && bLifetimeFrac >= 1;

  // Route A wins ties (it is the cheaper path in terms of referrals).
  const unlocked = aComplete || bComplete;
  const unlockRoute: UnlockRouteId | null = aComplete
    ? "ROUTE_A"
    : bComplete
      ? "ROUTE_B"
      : null;

  const routeA: RouteProgress = {
    route: "ROUTE_A",
    monthly: { current: monthly, required: 0 },
    lifetime: { current: Math.min(lifetime, aReq), required: aReq },
    percent: Math.round(aFrac * 100),
    complete: aComplete,
  };
  const routeB: RouteProgress = {
    route: "ROUTE_B",
    monthly: { current: Math.min(monthly, bMonthlyReq), required: bMonthlyReq },
    lifetime: {
      current: Math.min(lifetime, bLifetimeReq),
      required: bLifetimeReq,
    },
    percent: Math.round(bFrac * 100),
    complete: bComplete,
  };

  // Partial credit: Route A has exactly 1 of 2 lifetime referrals and the user
  // is not yet unlocked by either route.
  const downsellEligible = !unlocked && lifetime === 1;

  return {
    monthlyCount: monthly,
    lifetimeCount: lifetime,
    routeA,
    routeB,
    percent: Math.round(Math.max(aFrac, bFrac) * 100),
    unlocked,
    unlockRoute,
    downsellEligible,
  };
}

/** Render a battery bar string, e.g. "[▓▓▓▓▓░░░░░] 50% Unlocked". */
export function batteryBar(percent: number, segments = 10): string {
  const cells = Math.max(1, Math.floor(segments));
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((pct / 100) * cells);
  return `[${"▓".repeat(filled)}${"░".repeat(cells - filled)}] ${pct}% Unlocked`;
}

export type { ReferralPlanId };
