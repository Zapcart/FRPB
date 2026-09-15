// FRPB — pending-plan persistence for the unauthenticated purchase funnel.
//
// Why this exists: an unauthenticated visitor clicks "Choose Plan", is sent to
// /auth, then must land back on checkout with the SAME plan and currency. Query
// parameters alone are fragile — signup with email confirmation bounces through
// an external inbox, and any intermediate navigation drops the query string.
// Persisting the intent in localStorage makes the funnel survive all of that.
//
// Slugs are the REAL PlanSlug values (MONTH_1 | YEAR_1 | LIFETIME) so the
// /checkout page's validation accepts them instead of bouncing to /pricing.

import { PLAN_TYPE_VALUES, type PlanSlug } from "@frpb/shared";

export type CheckoutCurrency = "USD" | "INR";

export interface PendingPlan {
  planSlug: PlanSlug;
  currency: CheckoutCurrency;
  /** Epoch ms — used to expire a stale intent. */
  savedAt: number;
}

const STORAGE_KEY = "frpb:pending-plan";

/** A pending intent older than this is ignored (avoids surprising resumptions). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function isPlanSlug(value: unknown): value is PlanSlug {
  return (
    typeof value === "string" && (PLAN_TYPE_VALUES as readonly string[]).includes(value)
  );
}

function isCurrency(value: unknown): value is CheckoutCurrency {
  return value === "USD" || value === "INR";
}

/**
 * Persist the plan the visitor intended to buy. Never throws — storage can be
 * unavailable under strict privacy settings, and losing this must not break
 * the redirect.
 */
export function savePendingPlan(planSlug: PlanSlug, currency: CheckoutCurrency): void {
  try {
    const payload: PendingPlan = { planSlug, currency, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal: the URL query parameters still carry the intent.
  }
}

/** Read a still-valid pending plan, or null. Never throws. */
export function readPendingPlan(): PendingPlan | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPlan>;
    if (!isPlanSlug(parsed.planSlug) || !isCurrency(parsed.currency)) return null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (Date.now() - savedAt > MAX_AGE_MS) {
      clearPendingPlan();
      return null;
    }
    return { planSlug: parsed.planSlug, currency: parsed.currency, savedAt };
  } catch {
    return null;
  }
}

/** Clear the pending intent (after it has been consumed). Never throws. */
export function clearPendingPlan(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/** Build the checkout destination for a pending plan. */
export function checkoutUrlFor(plan: PendingPlan): string {
  return `/checkout?plan=${encodeURIComponent(plan.planSlug)}&currency=${encodeURIComponent(
    plan.currency
  )}`;
}
