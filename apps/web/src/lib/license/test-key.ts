// FRPB — master test license key.
//
// ⚠️⚠️ SECURITY WARNING — READ BEFORE DEPLOYING ⚠️⚠️
//
// `MASTER_TEST_LICENSE_KEY` is a HARDCODED PUBLIC STRING that lives in this
// (open-source) repository. The current implementation accepts it in EVERY
// environment, INCLUDING production, by explicit product decision — so that a
// packaged desktop build can always be activated for support/testing.
//
// The consequence is unavoidable and must be understood by whoever ships this:
//
//   ANYONE who can read this repository, or who receives the desktop binary,
//   can activate the product permanently, for free, with a LIFETIME profile —
//   against the live production API, with no purchase and no database row.
//
// It cannot be re-secured by obfuscation: the string is short, greppable, and
// is also compiled into the desktop bundle. The only real mitigations are:
//   1. Rotate this value to something NOT committed, injected at build time
//      via an env var instead of being hardcoded; or
//   2. Accept it as a deliberate, documented free-access path.
//
// Rationale for accepting it here: unconditional acceptance has been requested
// explicitly, and a working activation for the packaged desktop client has been
// treated as higher priority than preventing free activation.
//
// RELATED: prisma/seed.ts writes this key as a real DB licence row only when
// devTestKeysAllowed() — that restriction is intentionally unchanged, so the
// published key never becomes a purchased-looking licence record.

export const MASTER_TEST_LICENSE_KEY = "FRPB-TEST-1234-5678";

/** The only key accepted outside of dev/test mode. */
const EXACT_MASTER_KEY = MASTER_TEST_LICENSE_KEY;

/**
 * Whether dev/test bypasses are enabled in this process.
 *
 * Still fail-closed, and still used by the database seed (see prisma/seed.ts)
 * to decide whether the master key may be written as a real licence row.
 * Note this no longer gates the API shortcut — see `isMasterTestKey`.
 */
export function devTestKeysAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEV_TEST_KEYS === "true";
}

/**
 * True when `key` should be granted the synthetic master-test profile.
 *
 * TWO TIERS, deliberately asymmetric:
 *
 *   1. The EXACT key `FRPB-TEST-1234-5678` → accepted in ALL environments,
 *      including production. This is the operator's explicit requirement; see
 *      the security warning at the top of this file for the trade-off.
 *
 *   2. Any other `FRPB-TEST-*` shaped key → still dev-gated. Accepting the
 *      whole prefix unconditionally would turn it into an open-ended backdoor
 *      (anyone could mint `FRPB-TEST-ANYTHING`) rather than one known string,
 *      so that path keeps the fail-closed check.
 */
export function isMasterTestKey(key: string): boolean {
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return false;

  // Tier 1 — exact key, every environment.
  if (normalized === EXACT_MASTER_KEY) return true;

  // Tier 2 — the broader prefix remains dev-only.
  if (!devTestKeysAllowed()) return false;
  return normalized.startsWith("FRPB-TEST-");
}
