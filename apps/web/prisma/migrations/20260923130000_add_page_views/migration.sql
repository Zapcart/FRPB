-- FRPB — first-party page-view tracking (admin "VISITORS (30D)" source).
--
-- ROOT CAUSE this addresses: the admin VISITORS card was derived from
-- `FrpUnlockRequest.ipAddress`, i.e. only users who filed an unlock request. It
-- therefore reported near-zero traffic instead of real site visitation. This
-- additive table records a privacy-preserving page view on every landing.
--
-- PRIVACY: no raw IP or user-agent is stored. `visitorHash` is a salted SHA-256
-- of (IP + user-agent) computed server-side, giving a stable, non-reversible
-- per-visitor key used only for distinct/returning counts.
--
-- Every statement is ADDITIVE (new enum, new table, new indexes, new nullable
-- FK). No existing column or table is altered or dropped.

-- CreateEnum
CREATE TYPE "PageViewSource" AS ENUM ('WEB', 'DESKTOP', 'BOT');

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "source" "PageViewSource" NOT NULL DEFAULT 'WEB',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_visitorHash_createdAt_idx" ON "PageView"("visitorHash", "createdAt");

-- CreateIndex
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
