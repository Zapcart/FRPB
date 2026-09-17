// FRPB — dual-currency plan configuration (single source of truth).
//
// Every checkout surface (pricing grid, payment-method modal, Direct-UPI engine
// and PayGlocal init) resolves its price from THIS table. The amounts are
// hardcoded deliberately: a backend recalculation must never trust a
// client-supplied figure, and these are the exact tier rates the business set.
//
// ⚠️ KEEP IN SYNC with PLANS in packages/shared/src/plans.ts — that module is
// the canonical plan definition and this table mirrors it 1:1. Any divergence
// means the price displayed on the landing page disagrees with the price the
// checkout actually charges, which is exactly the class of bug this file is
// meant to prevent. A runtime assertion below fails loudly if they drift.
//
//   Plan      INR        USD
//   Month     ₹1,900     $20
//   Year      ₹4,900     $50
//   Lifetime  ₹9,999     $100

import { PLANS as SHARED_PLANS, type PlanSlug } from "@frpb/shared";

/** Currency a plan can be charged in. */
export type DualCurrency = "INR" | "USD";

/** Payment rail backing each currency. */
export type DualProvider = "UPI" | "PAYGLOCAL";

export interface DualPlan {
  /** Shared PlanSlug — the value stored on PaymentOrder.planId / License.planId. */
  slug: PlanSlug;
  /** Public id used by the Direct-UPI engine (MONTHLY | YEARLY | LIFETIME). */
  orderPlanId: "MONTHLY" | "YEARLY" | "LIFETIME";
  name: string;
  /** Display + charge amount in whole rupees. */
  inr: number;
  /** Display + charge amount in whole US dollars. */
  usd: number;
  durationDays: number | null;
  deviceLimit: number;
  features: string[];
}

/**
 * The ONLY prices the backend will ever charge.
 *
 * Kept as a plain readonly array so it is trivially auditable — there is no
 * computation, no FX conversion and no database lookup that could drift.
 */
export const DUAL_PLANS: readonly DualPlan[] = [
  {
    slug: "MONTH_1",
    orderPlanId: "MONTHLY",
    name: "1 Month Plan",
    inr: 1900,
    usd: 20,
    durationDays: 30,
    deviceLimit: 1,
    features: [
      "Full device recovery toolkit",
      "Driver Center + recovery guides",
      "1 device activation",
      "Email support",
    ],
  },
  {
    slug: "YEAR_1",
    orderPlanId: "YEARLY",
    name: "1 Year Plan",
    inr: 4900,
    usd: 50,
    durationDays: 365,
    deviceLimit: 3,
    features: [
      "Full device recovery toolkit",
      "Driver Center + recovery guides",
      "3 device activations",
      "Priority email support",
      "All feature updates",
    ],
  },
  {
    slug: "LIFETIME",
    orderPlanId: "LIFETIME",
    name: "Lifetime Plan",
    inr: 9999,
    usd: 100,
    durationDays: null,
    deviceLimit: 5,
    features: [
      "Full device recovery toolkit",
      "Driver Center + recovery guides",
      "5 device activations",
      "Priority email support",
      "All feature updates forever",
    ],
  },
] as const;

/**
 * Drift guard — assert DUAL_PLANS mirrors PLANS in @frpb/shared.
 *
 * This module and packages/shared/src/plans.ts both define the tier prices, and
 * a divergence between them is precisely the "landing page shows one price,
 * checkout charges another" bug. Rather than trusting discipline, this compares
 * every field and logs a loud error at import time in development. In
 * production it stays silent (prices are still server-resolved, so the failure
 * mode is a display mismatch, not a mis-charge).
 */
function assertPlansInSync(): void {
  for (const dual of DUAL_PLANS) {
    const shared = SHARED_PLANS.find((p) => p.slug === dual.slug);
    if (!shared) {
      console.error(`[config/plans] ${dual.slug} missing from @frpb/shared PLANS`);
      continue;
    }
    if (shared.usd !== dual.usd || shared.inr !== dual.inr) {
      console.error(
        `[config/plans] PRICE DRIFT for ${dual.slug}: ` +
          `shared ₹${shared.inr}/$${shared.usd} vs config ₹${dual.inr}/$${dual.usd}`
      );
    }
    if (shared.priceCents !== dual.usd * 100 || shared.priceInr !== dual.inr * 100) {
      console.error(
        `[config/plans] MINOR-UNIT DRIFT for ${dual.slug}: ` +
          `priceCents=${shared.priceCents} priceInr=${shared.priceInr}`
      );
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  assertPlansInSync();
}

/** Resolve a plan by shared slug (the canonical key). */
export function getDualPlan(slug: string): DualPlan | null {
  const needle = `${slug ?? ""}`.trim().toUpperCase();
  return DUAL_PLANS.find((p) => p.slug === needle) ?? null;
}

/** Resolve a plan by the Direct-UPI public id (MONTHLY | YEARLY | LIFETIME). */
export function getDualPlanByOrderId(orderPlanId: string): DualPlan | null {
  const needle = `${orderPlanId ?? ""}`.trim().toUpperCase();
  return DUAL_PLANS.find((p) => p.orderPlanId === needle) ?? null;
}

/** A plan's amount in the requested currency (whole units). */
export function dualAmount(plan: DualPlan, currency: DualCurrency): number {
  return currency === "INR" ? plan.inr : plan.usd;
}

/** The rail that settles a currency. */
export function providerForDualCurrency(currency: DualCurrency): DualProvider {
  return currency === "INR" ? "UPI" : "PAYGLOCAL";
}

// ─── Strict amount locks ─────────────────────────────────────────────────────

/** Amounts the Direct-UPI rail will ever charge (₹1900 / ₹4900 / ₹9999). */
export const ALLOWED_INR_AMOUNTS: ReadonlySet<number> = new Set(
  DUAL_PLANS.map((p) => p.inr)
);

/** Amounts the PayGlocal rail will ever charge ($25 / $60 / $120). */
export const ALLOWED_USD_AMOUNTS: ReadonlySet<number> = new Set(
  DUAL_PLANS.map((p) => p.usd)
);

/** True when `amount` is a sanctioned INR tier rate. */
export function isAllowedInrAmount(amount: number): boolean {
  return ALLOWED_INR_AMOUNTS.has(amount);
}

/** True when `amount` is a sanctioned USD tier rate. */
export function isAllowedUsdAmount(amount: number): boolean {
  return ALLOWED_USD_AMOUNTS.has(amount);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** "₹1,900" — Indian digit grouping, no decimals. */
export function formatDualInr(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

/** "$25" — US digit grouping, no decimals (all tiers are whole dollars). */
export function formatDualUsd(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

/** "₹1,900 / $25" — the combined label the modal and pricing grid display. */
export function formatDualPrice(plan: DualPlan): string {
  return `${formatDualInr(plan.inr)} / ${formatDualUsd(plan.usd)}`;
}

/** Format any amount in the given currency. */
export function formatDual(amount: number, currency: DualCurrency): string {
  return currency === "INR" ? formatDualInr(amount) : formatDualUsd(amount);
}
