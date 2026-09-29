-- FRPB — Reconcile `PaymentOrder` columns that existed in schema.prisma /
-- application code but were NEVER added by a committed migration.
--
-- ROOT CAUSE (schema drift): the Task J referral engine added
-- `referralCode`, and the manual-UTR approval flow added `paymentConfirmed`
-- and `utrSuspicious` to the `PaymentOrder` model. No migration referenced
-- these columns, so production ran `prisma generate` (types only) against a
-- database whose physical `PaymentOrder` table lacked them, producing the
-- runtime "Database schema is out of date" / 42P01 style failure on
-- `/api/v1/checkout/create-order` and the settlement path.
--
-- Every statement below is ADDITIVE and IDEMPOTENT (safe to re-run):
--   * new columns are nullable or carry a NOT NULL DEFAULT,
--   * columns use IF NOT EXISTS,
--   * indexes use IF NOT EXISTS.
-- No existing column, index, or row is dropped or rewritten.

-- ─── PaymentOrder referral capture (Task J) ───────────────
-- The referral code entered at checkout, persisted BEFORE payment so the
-- referrer can be attributed at settlement (markRazorpayOrderPaid / webhook).
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;

-- ─── PaymentOrder manual-UTR approval flags ───────────────
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaymentOrder" ADD COLUMN IF NOT EXISTS "utrSuspicious" BOOLEAN NOT NULL DEFAULT false;

-- ─── Backing indexes (mirror schema.prisma @@index declarations) ──
CREATE INDEX IF NOT EXISTS "PaymentOrder_referralCode_idx" ON "PaymentOrder"("referralCode");
CREATE INDEX IF NOT EXISTS "PaymentOrder_paymentConfirmed_status_idx" ON "PaymentOrder"("paymentConfirmed", "status");
CREATE INDEX IF NOT EXISTS "PaymentOrder_utrSuspicious_idx" ON "PaymentOrder"("utrSuspicious");
