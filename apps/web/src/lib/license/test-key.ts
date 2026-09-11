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
 * True when `key` is the master test key (or any `FRPB-TEST-` prefixed key).
 *
 * The exact key `FRPB-TEST-1234-5678` is ALWAYS accepted — including in a
 * production deployment — so the desktop app can be activated for local /
 * offline testing even when it points at the live https://frpb.in API.
 * That is the whole purpose of this key: the desktop client is a packaged,
 * `NODE_ENV=production` build, so a production-guarded shortcut would never
 * take effect on the machine that needs it.
 *
 * The shortcut only ever hands out a static, non-money-bearing ACTIVE
 * LIFETIME profile (see `masterTestProfile`); it cannot unlock any real
 * DB-backed license or payment record, so this is not a privilege escalation
 * vector. Other `FRPB-TEST-*` shaped keys remain disabled in production to
 * avoid making the entire prefix an open backdoor.
 */
export function isMasterTestKey(key: string): boolean {
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized === MASTER_TEST_LICENSE_KEY) return true;
  if (process.env.NODE_ENV === "production") return false;
  return normalized.startsWith("FRPB-TEST-");
}
