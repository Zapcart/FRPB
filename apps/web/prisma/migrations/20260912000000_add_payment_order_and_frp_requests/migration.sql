-- Reconciliation migration.
--
-- ROOT CAUSE: `schema.prisma` had drifted ahead of the committed migration
-- history. The `PaymentOrder` table (the Direct-UPI ledger), `FrpUnlockRequest`,
-- the `UpiOrderStatus` / `FrpRequestStatus` enums, and several `License` / `Plan`
-- / `EmailLog` columns were NEVER created in the deployed database. Because no
-- migration referenced them, `prisma migrate deploy` could not fix the gap and
-- every `prisma.paymentOrder.create` failed with 42P01 ("relation does not
-- exist"), surfacing to customers as the checkout "payment system unreachable"
-- banner routed through code `DB_UNAVAILABLE` (503).
--
-- Generated (read-only) with:
--   prisma migrate diff --from-url <live-db> \
--     --to-schema-datamodel prisma/schema.prisma --script
--
-- Every statement below is ADDITIVE: new tables, new nullable/defaulted columns,
-- and new enum values. No column or table is dropped or altered destructively.
--
-- NOTE: the `CASHFREE` enum value is deliberately NOT declared here — it is added
-- by the preceding migration `20260911120000_add_cashfree_provider`. Declaring it
-- twice would abort with "enum value already exists".

-- CreateEnum
CREATE TYPE "UpiOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FrpRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYGLOCAL';

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "lastRevealedAt" TIMESTAMP(3),
ADD COLUMN     "revealCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "priceInr" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "planId" "PlanType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL DEFAULT 'UPI',
    "status" "UpiOrderStatus" NOT NULL DEFAULT 'PENDING',
    "utr" TEXT,
    "providerTxnId" TEXT,
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrpUnlockRequest" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "androidVersion" TEXT,
    "imeiHash" TEXT,
    "method" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "status" "FrpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "result" JSONB,
    "userId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "refundAmountCents" INTEGER,

    CONSTRAINT "FrpUnlockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_orderId_key" ON "PaymentOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_utr_key" ON "PaymentOrder"("utr");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_providerTxnId_key" ON "PaymentOrder"("providerTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_licenseId_key" ON "PaymentOrder"("licenseId");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_expiresAt_idx" ON "PaymentOrder"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_email_idx" ON "PaymentOrder"("email");

-- CreateIndex
CREATE INDEX "PaymentOrder_provider_status_idx" ON "PaymentOrder"("provider", "status");

-- CreateIndex
CREATE INDEX "FrpUnlockRequest_status_idx" ON "FrpUnlockRequest"("status");

-- CreateIndex
CREATE INDEX "FrpUnlockRequest_userId_idx" ON "FrpUnlockRequest"("userId");

-- CreateIndex
CREATE INDEX "FrpUnlockRequest_imeiHash_idx" ON "FrpUnlockRequest"("imeiHash");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrpUnlockRequest" ADD CONSTRAINT "FrpUnlockRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
