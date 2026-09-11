-- AlterEnum
-- Adds Cashfree as a first-class payment provider (checkout + webhooks).
ALTER TYPE "PaymentProvider" ADD VALUE 'CASHFREE';
