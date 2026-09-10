// FRPB — shared plans definition.
// Source of truth for plans + device limits used by the web portal,
// checkout sessions, webhook processor and the desktop app.
// Mirror of the Prisma `Plan` rows — keep in sync with prisma/seed.ts.

export const PLAN_TYPE_VALUES = ["MONTH_1", "YEAR_1", "LIFETIME"] as const;
export type PlanSlug = (typeof PLAN_TYPE_VALUES)[number];

export interface PlanDefinition {
  slug: PlanSlug;
  name: string;
  priceCents: number;
  currency: string;
  /** null = lifetime */
  durationDays: number | null;
  deviceLimit: number;
  features: string[];
}

export const PLANS: readonly PlanDefinition[] = [
  {
    slug: "MONTH_1",
    name: "1-Month Plan",
    priceCents: 1999,
    currency: "USD",
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
    name: "1-Year Plan",
    priceCents: 4999,
    currency: "USD",
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
    name: "Lifetime Plan",
    priceCents: 9999,
    currency: "USD",
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
