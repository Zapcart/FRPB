-- FRPB — Add the Tiered Referral / Gamified Unlock / VIP Cash Affiliate engine
-- (Task J models: ReferralCode, Referral, Commission, PayoutRequest).
--
-- ROOT CAUSE: the referral models were added to schema.prisma and shipped in
-- application code, but no matching migration was ever committed. Production
-- therefore ran `prisma generate` (types only) against a PostgreSQL database
-- whose schema lacked these tables, producing the runtime
-- "Database schema is out of date" failure on checkout + referral endpoints.
--
-- Every statement below is ADDITIVE and IDEMPOTENT (safe to re-run): enums are
-- created inside guarded DO blocks, columns use IF NOT EXISTS, and tables /
-- indexes use IF NOT EXISTS. No existing table, column, or row is dropped or
-- rewritten. Money is stored as INTEGER CENTS (no floats).

-- ─── Enums ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "UnlockRoute" AS ENUM ('ROUTE_A', 'ROUTE_B', 'DOWNSELL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionKind" AS ENUM ('MONTHLY_RECURRING', 'LIFETIME_UPFRONT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'RELEASED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── User referral / affiliate state columns ──────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLifetimeUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unlockRoute" "UnlockRoute";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unlockedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- ─── ReferralCode ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCode_userId_key" ON "ReferralCode"("userId");
CREATE INDEX IF NOT EXISTS "ReferralCode_userId_idx" ON "ReferralCode"("userId");

DO $$ BEGIN
  ALTER TABLE "ReferralCode"
    ADD CONSTRAINT "ReferralCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Referral ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "planId" "PlanType" NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "selfReferral" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "visitorHash" TEXT,
    "qualifiesUnlock" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_status_idx" ON "Referral"("referrerId", "status");
CREATE INDEX IF NOT EXISTS "Referral_codeId_idx" ON "Referral"("codeId");
CREATE INDEX IF NOT EXISTS "Referral_status_releaseAt_idx" ON "Referral"("status", "releaseAt");

DO $$ BEGIN
  ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Referral"
    ADD CONSTRAINT "Referral_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Commission ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Commission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "kind" "CommissionKind" NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "releaseAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Commission_referralId_kind_key" ON "Commission"("referralId", "kind");
CREATE INDEX IF NOT EXISTS "Commission_userId_status_idx" ON "Commission"("userId", "status");
CREATE INDEX IF NOT EXISTS "Commission_status_releaseAt_idx" ON "Commission"("status", "releaseAt");

DO $$ BEGIN
  ALTER TABLE "Commission"
    ADD CONSTRAINT "Commission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Commission"
    ADD CONSTRAINT "Commission_referralId_fkey"
    FOREIGN KEY ("referralId") REFERENCES "Referral"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── PayoutRequest ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'UPI',
    "destination" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayoutRequest_userId_status_idx" ON "PayoutRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PayoutRequest"
    ADD CONSTRAINT "PayoutRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
