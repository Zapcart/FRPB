// FRPB — master test license key (DEVELOPMENT ONLY).
//
// ⚠️ SECURITY NOTE — this key is PUBLISHED in the open-source repository. It is
// therefore a public string, not a secret, and must never be able to grant a
// real entitlement. It is honoured ONLY when dev/test mode is explicitly
// enabled (see `devTestKeysAllowed`):
//
//   NODE_ENV !== "production"                     → allowed
//   NODE_ENV === "production" && ALLOW_DEV_TEST_KEYS === "true" → allowed
//   otherwise                                     → refused
//
// This replaces an earlier implementation that accepted the exact key in
// production UNCONDITIONALLY. That was exploitable: the same key is seeded as a
// genuine ACTIVE LIFETIME license (prisma/seed.ts), so anyone who could read
// this repo could activate the product for free against the live API.
//
// Usage (local only):
//   Desktop App → enter  FRPB-TEST-1234-5678  to unlock the full app
//   (synthetic ACTIVE LIFETIME profile) without live payment webhooks.
//
// The web route short-circuits BEFORE rate limiting / DB lookups, so no
// UPSTASH_REDIS_* credentials or Supabase connectivity are required locally.

export const MASTER_TEST_LICENSE_KEY = "FRPB-TEST-1234-5678";

/**
 * Whether dev/test bypasses are enabled in this process.
 *
 * Fail-closed by design: a production deployment must set
 * `ALLOW_DEV_TEST_KEYS=true` deliberately before any `FRPB-TEST-*` key is
 * accepted. Absent, empty or any value other than the exact string "true"
 * disables the bypass.
 */
export function devTestKeysAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEV_TEST_KEYS === "true";
}

/**
 * True when `key` is the master test key (or any `FRPB-TEST-` prefixed key)
 * AND dev/test mode is enabled. Never true in a production deployment unless
 * `ALLOW_DEV_TEST_KEYS=true` was set explicitly.
 */
export function isMasterTestKey(key: string): boolean {
  // Gate FIRST — never evaluate the key shape before the mode check, so a
  // production process cannot reach the acceptance branch at all.
  if (!devTestKeysAllowed()) return false;
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  return (
    normalized === MASTER_TEST_LICENSE_KEY || normalized.startsWith("FRPB-TEST-")
  );
}
