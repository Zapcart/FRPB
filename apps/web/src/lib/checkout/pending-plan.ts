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
 * Persist the plan the visitor intended to buy.
 *
 * Written to BOTH localStorage and sessionStorage:
 *   - localStorage  survives the email-confirmation round trip (a brand-new
 *     tab) and a browser restart, which is the common signup path.
 *   - sessionStorage is a same-tab safety net for environments where
 *     localStorage is partitioned or blocked (Safari private mode, strict
 *     third-party-cookie settings, embedded webviews).
 *
 * `readPendingPlan` prefers whichever payload is newest, so the two can never
 * disagree in a way that matters. Never throws — losing this must not break
 * the redirect, since the URL query params also carry the intent.
 */
export function savePendingPlan(planSlug: PlanSlug, currency: CheckoutCurrency): void {
  const payload: PendingPlan = { planSlug, currency, savedAt: Date.now() };
  const serialized = JSON.stringify(payload);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Non-fatal: sessionStorage and the URL params are the fallbacks.
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Non-fatal.
  }
}

/** Parse + validate a stored payload, returning null when unusable/stale. */
function parseStored(raw: string | null): PendingPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPlan>;
    if (!isPlanSlug(parsed.planSlug) || !isCurrency(parsed.currency)) return null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (Date.now() - savedAt > MAX_AGE_MS) return null;
    return { planSlug: parsed.planSlug, currency: parsed.currency, savedAt };
  } catch {
    return null;
  }
}

/**
 * Read a still-valid pending plan, or null. Checks both stores and returns the
 * NEWEST valid payload so a stale sessionStorage entry can never override a
 * fresh localStorage one (or vice versa). Never throws.
 */
export function readPendingPlan(): PendingPlan | null {
  let local: PendingPlan | null = null;
  let session: PendingPlan | null = null;

  try {
    local = parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    local = null;
  }
  try {
    session = parseStored(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    session = null;
  }

  if (local && session) return local.savedAt >= session.savedAt ? local : session;
  const found = local ?? session;

  // Expired in both stores → purge so a later visit starts clean.
  if (!found) clearPendingPlan();
  return found;
}

/** Clear the pending intent from BOTH stores. Never throws. */
export function clearPendingPlan(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
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
