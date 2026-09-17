// FRPB — dual-currency plan configuration (single source of truth).
//
// Every checkout surface (pricing grid, payment-method modal, Direct-UPI engine
// and PayGlocal init) resolves its price from THIS table. The amounts are
// hardcoded deliberately: a backend recalculation must never trust a
// client-supplied figure, and these are the exact tier rates the business set.
//
//   Plan      INR        USD
//   Month     ₹1,900     $25
//   Year      ₹4,900     $60
//   Lifetime  ₹9,999     $120

import type { PlanSlug } from "@frpb/shared";

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
    usd: 25,
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
    usd: 60,
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
    usd: 120,
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
