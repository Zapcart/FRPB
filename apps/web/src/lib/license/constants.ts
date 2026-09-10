// FRPB — plan constants mirrored from @frpb/shared for server-side usage.
// Keep in sync with packages/shared/src/plans.ts and prisma/seed.ts.

import { PLANS, type PlanSlug } from "@frpb/shared";

export const planBySlug = new Map<PlanSlug, (typeof PLANS)[number]>();
for (const plan of PLANS) planBySlug.set(plan.slug, plan);

export function getPlanDefinition(slug: PlanSlug) {
  const plan = planBySlug.get(slug);
  if (!plan) throw new Error(`Unknown plan slug: ${slug}`);
  return plan;
}

export { PLANS } from "@frpb/shared";
