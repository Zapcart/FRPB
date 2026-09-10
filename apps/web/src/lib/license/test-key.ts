// FRPB — master test license key (development / non-production only).
//
// Usage:
//   Desktop App → enter  FRPB-TEST-1234-5678  to unlock the full app
//   (synthetic ACTIVE LIFETIME profile) without live Stripe/Razorpay
//   payment webhooks or a DB-backed license row.
//
// The web route short-circuits BEFORE rate limiting / DB lookups, so no
// UPSTASH_REDIS_* credentials or Supabase connectivity are required on
// local machines.

export const MASTER_TEST_LICENSE_KEY = "FRPB-TEST-1234-5678";

/**
 * True when `key` is the master test key (or any `FRPB-TEST-` prefixed key)
 * AND the app runs outside production. Always false in production.
 */
export function isMasterTestKey(key: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  return normalized.startsWith("FRPB-TEST-");
}
