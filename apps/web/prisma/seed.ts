// FRPB — Prisma seed: Plan rows + demo data + master test license.
// Run with: pnpm prisma:seed (uses apps/web/prisma/seed.ts)

import { PrismaClient } from "@prisma/client";
import { PLANS } from "@frpb/shared";
import { sha256 } from "../src/lib/crypto/sha256";
import { devTestKeysAllowed } from "../src/lib/license/test-key";

const prisma = new PrismaClient();

// slug typed as the Prisma PlanType enum values via string literals
type PlanSlug = "MONTH_1" | "YEAR_1" | "LIFETIME";

/**
 * Plan rows are DERIVED from the shared PLANS definition.
 *
 * This file previously held a third hardcoded copy of the prices, which had
 * already drifted from the other two (it still carried the old 1999¢ / 4999¢ /
 * 9999¢ rates after the storefront moved to $20 / $50 / $100). Deriving them
 * means a price change is made in ONE place and the database, the storefront
 * and the checkout payload can no longer disagree.
 */
const plans: Array<{
  slug: PlanSlug;
  name: string;
  priceCents: number;
  priceInr: number;
  currency: string;
  durationDays: number | null;
  deviceLimit: number;
  features: string[];
}> = PLANS.map((plan) => ({
  slug: plan.slug,
  name: plan.name,
  priceCents: plan.priceCents,
  priceInr: plan.priceInr,
  currency: plan.currency,
  durationDays: plan.durationDays,
  deviceLimit: plan.deviceLimit,
  features: plan.features,
}));

// Master test key — the same value the desktop activation screen accepts.
//
// ⚠️ This key is PUBLISHED in the repository, so it is NOT a secret. Seeding it
// into a real database would hand a free lifetime licence to anyone who can read
// the source. The user + licence rows below are therefore written ONLY when
// dev/test mode is enabled (see devTestKeysAllowed in src/lib/license/test-key):
//
//   NODE_ENV !== "production"                          → seeded
//   NODE_ENV === "production" && ALLOW_DEV_TEST_KEYS=true → seeded
//   otherwise                                          → skipped
//
// Plans are ALWAYS seeded — they are required in every environment.
const TEST_KEY = "FRPB-TEST-1234-5678";
const TEST_USER_EMAIL = "test@frpb.local";
const seedTestLicense = devTestKeysAllowed();

async function main() {
  console.log("🌱 Seeding plans…");
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
    console.log(
      `  ✓ ${plan.name} (${plan.priceCents}¢ / ₹${plan.priceInr / 100}, ${plan.deviceLimit} devices)`
    );
  }

  // ── Test user + master licence: DEV/TEST ONLY ───────────────────────────
  // Skipped in production unless ALLOW_DEV_TEST_KEYS=true was set on purpose.
  if (!seedTestLicense) {
    console.log(
      "⏭  Skipping master test licence — the FRPB-TEST-* key is declined in production."
    );
    console.log(
      "   (Set ALLOW_DEV_TEST_KEYS=true only in a throwaway environment if you need it.)"
    );
    console.log("Seed complete.");
    return;
  }

  console.log("👤 Seeding test user…");
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {},
    create: { email: TEST_USER_EMAIL, name: "FRPB Test User" },
  });

  console.log("🔑 Seeding master test license…");
  const lifetimePlan = await prisma.plan.findUniqueOrThrow({
    where: { slug: "LIFETIME" },
  });

  // Same normalization the verify core uses: sha256(key.trim().toUpperCase()).
  const normalizedKey = TEST_KEY.trim().toUpperCase();
  const license = await prisma.license.upsert({
    where: { key: TEST_KEY },
    update: {
      status: "ACTIVE",
      deviceLimit: lifetimePlan.deviceLimit,
      expiresAt: null,
      lastVerifiedAt: new Date(),
    },
    create: {
      key: TEST_KEY,
      keySha256: sha256(normalizedKey),
      userId: user.id,
      planId: lifetimePlan.id,
      status: "ACTIVE",
      deviceLimit: lifetimePlan.deviceLimit,
      maxActivations: 1,
      activatedAt: new Date(),
      expiresAt: null, // LIFETIME → never expires
      lastVerifiedAt: new Date(),
    },
  });

  console.log(`  ✓ License ${license.key} → ${license.status} (LIFETIME, ${license.deviceLimit} devices)`);
  console.log(`  ✓ keySha256 = ${license.keySha256}`);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
