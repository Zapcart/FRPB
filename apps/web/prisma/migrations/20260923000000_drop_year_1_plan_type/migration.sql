-- Retire the "1-Year Plan" tier from the pricing catalogue.
--
-- The storefront now offers exactly two plans (canonical source:
-- packages/shared/src/plans.ts):
--   * MONTH_1  — $20  / ₹1,900   (30 days,  1 device)
--   * LIFETIME — $150 / ₹13,999  (lifetime, 5 devices)
-- The legacy YEAR_1 tier ($50 / ₹4,900) is removed, so its label must be dropped
-- from the `PlanType` enum. That enum is referenced by:
--   Plan.slug, PaymentOrder.planId, Payment.planSlug
--
-- PostgreSQL cannot remove a value from an existing enum in place, so the type is
-- recreated and every dependent column is swapped over. Any surviving YEAR_1
-- references MUST be migrated before the swap, otherwise the cast below fails.
-- Production has had zero YEAR_1 sales, so the reassignment statements are
-- defensive no-ops that keep this script safe to replay.

-- 1. Reassign any lingering YEAR_1 references to the closest surviving tier.
UPDATE "PaymentOrder" SET "planId" = 'MONTH_1' WHERE "planId" = 'YEAR_1';
UPDATE "Payment" SET "planSlug" = 'MONTH_1' WHERE "planSlug" = 'YEAR_1';

-- The Plan table is seed-managed (apps/web/prisma/seed.ts re-upserts the
-- canonical rows from PLANS on every run), so the retired tier's row is simply
-- dropped rather than remapped — remapping could collide with the UNIQUE
-- constraint on Plan.slug if a LIFETIME row already exists.
DELETE FROM "Plan" WHERE "slug" = 'YEAR_1';

-- 2. Recreate the enum without the YEAR_1 label.
ALTER TYPE "PlanType" RENAME TO "PlanType_old";
CREATE TYPE "PlanType" AS ENUM ('MONTH_1', 'LIFETIME');

ALTER TABLE "Plan"
  ALTER COLUMN "slug" TYPE "PlanType" USING ("slug"::text::"PlanType");
ALTER TABLE "PaymentOrder"
  ALTER COLUMN "planId" TYPE "PlanType" USING ("planId"::text::"PlanType");
ALTER TABLE "Payment"
  ALTER COLUMN "planSlug" TYPE "PlanType" USING ("planSlug"::text::"PlanType");

DROP TYPE "PlanType_old";
