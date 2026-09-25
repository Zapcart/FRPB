// FRPB — dual-currency plan configuration (single source of truth).
//
// Every checkout surface (pricing grid and the Razorpay checkout flow) resolves
// its price from THIS table. The amounts are
// hardcoded deliberately: a backend recalculation must never trust a
// client-supplied figure, and these are the exact tier rates the business set.
//
// ⚠️ KEEP IN SYNC with PLANS in packages/shared/src/plans.ts — that module is
// the canonical plan definition and this table mirrors it 1:1. Any divergence
// means the price displayed on the landing page disagrees with the price the
// checkout actually charges, which is exactly the class of bug this file is
// meant to prevent. A runtime assertion below fails loudly if they drift.
//
//   Plan        INR        USD
//   2 Months    ₹1,900     $20
//   Lifetime    ₹13,999    $150
//
// GATEWAY:
//   Razorpay Standard Web Checkout is the single, exclusive payment gateway,
//   and it settles EACH currency natively: INR tiers charge ₹1,900 / ₹13,999
//   and USD tiers charge $20 / $150. The currency is chosen by the buyer and
//   locked server-side to the matching tier rate below — never converted with
//   a live FX rate, and never read from the client.

import { PLANS as SHARED_PLANS, type PlanSlug } from "@frpb/shared";

/** Currency a plan can be charged in. */
export type DualCurrency = "INR" | "USD";

/**
 * Narrow an untrusted value (e.g. a request body field) to a DualCurrency.
 * Case-insensitive so "usd"/"INR" from the client both resolve; anything
 * unsupported returns null so the caller can fall back to a safe default
 * rather than charging an unintended currency.
 */
export function isDualCurrency(value: unknown): value is DualCurrency {
  if (typeof value !== "string") return false;
  const needle = value.trim().toUpperCase();
  return needle === "INR" || needle === "USD";
}

/** Payment gateway backing every currency (Razorpay only). */
export type DualProvider = "RAZORPAY";

export interface DualPlan {
  /** Shared PlanSlug — the value stored on PaymentOrder.planId / License.planId. */
  slug: PlanSlug;
  /** Stable per-tier receipt tag used by the Razorpay order notes. */
  orderPlanId: "MONTHLY" | "LIFETIME";
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
    name: "2 Month Plan",
    inr: 1900,
    usd: 20,
    durationDays: 60,
    deviceLimit: 1,
    features: [
      "Full device recovery toolkit",
      "Driver Center + recovery guides",
      "1 device activation",
      "Email support",
    ],
  },
  {
    slug: "LIFETIME",
    orderPlanId: "LIFETIME",
    name: "Lifetime Plan",
    inr: 13999,
    usd: 150,
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

/** Resolve a plan by its public order tag (MONTHLY | LIFETIME). */
export function getDualPlanByOrderId(orderPlanId: string): DualPlan | null {
  const needle = `${orderPlanId ?? ""}`.trim().toUpperCase();
  return DUAL_PLANS.find((p) => p.orderPlanId === needle) ?? null;
}

/** A plan's amount in the requested currency (whole major units). */
export function dualAmount(plan: DualPlan, currency: DualCurrency): number {
  return currency === "INR" ? plan.inr : plan.usd;
}

/**
 * A plan's amount in the smallest gateway sub-unit for the requested currency
 * (INR paise / USD cents) — the exact figure the Razorpay Orders API expects.
 *
 * Razorpay charges in the smallest unit, so ₹1,900 → 190000 paise and
 * $20 → 2000 cents. Both currencies use a 100:1 minor-unit ratio, and the
 * multiplication is rounded to absorb float error on whole-unit tier prices.
 */
export function razorpayAmount(plan: DualPlan, currency: DualCurrency): number {
  return Math.round(dualAmount(plan, currency) * 100);
}

/** The gateway that settles every currency — Razorpay only. */
export function providerForDualCurrency(_currency: DualCurrency): DualProvider {
  return "RAZORPAY";
}

// ─── Strict amount locks ─────────────────────────────────────────────────────

/** Amounts Razorpay will ever charge in INR (₹1900 / ₹13999). */
export const ALLOWED_INR_AMOUNTS: ReadonlySet<number> = new Set(
  DUAL_PLANS.map((p) => p.inr)
);

/** USD price points Razorpay will ever charge ($20 / $150). */
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

/** True when `amount` is a sanctioned tier rate in the given currency. */
export function isAllowedAmount(amount: number, currency: DualCurrency): boolean {
  return currency === "INR" ? isAllowedInrAmount(amount) : isAllowedUsdAmount(amount);
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** "₹1,900" — Indian digit grouping, no decimals. */
export function formatDualInr(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

/** "$20" — US digit grouping, no decimals (all tiers are whole dollars). */
export function formatDualUsd(amount: number): string {
  const value = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

/** "₹1,900 / $20" — the combined label the modal and pricing grid display. */
export function formatDualPrice(plan: DualPlan): string {
  return `${formatDualInr(plan.inr)} / ${formatDualUsd(plan.usd)}`;
}

/** Format any amount in the given currency. */
export function formatDual(amount: number, currency: DualCurrency): string {
  return currency === "INR" ? formatDualInr(amount) : formatDualUsd(amount);
}
