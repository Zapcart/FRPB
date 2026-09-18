-- Manual UTR approval flow.
--
-- Adds the `PENDING_VERIFICATION` state to the Direct-UPI order ledger. When a
-- customer submits their 12-digit UTR the order moves PENDING -> PENDING_VERIFICATION
-- (rather than straight to PAID); NO license is minted until an admin verifies the
-- bank transfer and confirms the order.
--
-- PostgreSQL cannot add a value to an existing enum inside `CREATE TYPE`; the
-- value must be appended with `ALTER TYPE ... ADD VALUE`.

-- AlterEnum
--
-- `IF NOT EXISTS` keeps this script idempotent: it is safe to re-run against a
-- database where the value was already added (e.g. a retried or partially
-- applied deploy), which would otherwise abort with
-- "enum label \"PENDING_VERIFICATION\" already exists".
ALTER TYPE "UpiOrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION';
