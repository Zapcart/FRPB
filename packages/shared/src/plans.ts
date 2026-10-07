// FRPB — shared plans definition.
// Source of truth for plans + device limits used by the web portal,
// checkout sessions, webhook processor and the desktop app.
// Mirror of the Prisma `Plan` rows — keep in sync with prisma/seed.ts.

export const PLAN_TYPE_VALUES = ["MONTH_1", "LIFETIME"] as const;
export type PlanSlug = (typeof PLAN_TYPE_VALUES)[number];

/** Supported display/charge currencies. */
export const CURRENCY_VALUES = ["USD", "INR"] as const;
export type Currency = (typeof CURRENCY_VALUES)[number];

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  priceCents: number;          // USD in cents ($20 = 2000)
  currency: string;            // "USD"
  priceInr: number;            // INR in paise (₹1,900 = 190000)
  /** Whole US dollars — the value every storefront displays. */
  usd: number;
  /** Whole rupees — the value every storefront displays. */
  inr: number;
  /** null = lifetime */
  durationDays: number | null;
  deviceLimit: number;
  features: string[];
}

/** Minor-unit amount for a plan in the requested currency. */
export function priceFor(plan: PlanDefinition, currency: Currency): number {
  return currency === "INR" ? plan.priceInr : plan.priceCents;
}

/** ISO-4217 code for a plan's charged currency. */
export function currencyFor(currency: Currency): string {
  return currency === "INR" ? "INR" : "USD";
}

/**
 * Format a minor-unit amount for display. USD keeps 2 decimals; INR is grouped
 * with Indian digit grouping and rendered as whole rupees.
 */
export function formatMoney(
  minorUnits: number,
  currency: Currency
): string {
  const major = minorUnits / 100;
  if (currency === "INR") {
    return `₹${new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Math.round(major))}`;
  }
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major)}`;
}

export const PLANS: readonly PlanDefinition[] = [
  {
    slug: "MONTH_1",
    name: "6-Month Plan",
    priceCents: 2000,   // $20
    currency: "USD",
    priceInr: 190000,   // ₹1,900
    usd: 20,
    inr: 1900,
    durationDays: 180,
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
    name: "Lifetime Plan",
    priceCents: 20000,  // $200
    currency: "USD",
    priceInr: 1699900,  // ₹16,999
    usd: 200,
    inr: 16999,
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

export function getPlan(slug: PlanSlug): PlanDefinition {
  const plan = PLANS.find((p) => p.slug === slug);
  if (!plan) throw new Error(`Unknown plan slug: ${slug}`);
  return plan;
}

/** Convert a Prisma PlanType string into a typed PlanSlug. */
export function isPlanSlug(value: string): value is PlanSlug {
  return (PLAN_TYPE_VALUES as readonly string[]).includes(value);
}
