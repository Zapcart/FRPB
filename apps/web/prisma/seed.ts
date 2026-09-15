// FRPB — Prisma seed: Plan rows + demo data + master test license.
// Run with: pnpm prisma:seed (uses apps/web/prisma/seed.ts)

import { PrismaClient } from "@prisma/client";
import { sha256 } from "../src/lib/crypto/sha256";
import { devTestKeysAllowed } from "../src/lib/license/test-key";

const prisma = new PrismaClient();

// slug typed as the Prisma PlanType enum values via string literals
type PlanSlug = "MONTH_1" | "YEAR_1" | "LIFETIME";

const plans: Array<{
  slug: PlanSlug;
  name: string;
  priceCents: number;
  priceInr: number;
  currency: string;
  durationDays: number | null;
  deviceLimit: number;
  features: string[];
}> = [
  {
    slug: "MONTH_1",
    name: "1-Month Plan",
    priceCents: 1999,
    priceInr: 190000,
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
    priceInr: 490000,
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
    priceInr: 999900,
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
];

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
    console.log(`  ✓ ${plan.name} (${plan.priceCents}¢, ${plan.deviceLimit} devices)`);
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
