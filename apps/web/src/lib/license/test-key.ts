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
//
// PRODUCTION LOCKDOWN (Task 4 of plans/performance-optimization.md):
// the master shortcut now FAILS CLOSED in production. The built-in constant
// below is honored there only when `ALLOW_DEV_TEST_KEYS=true` is set on
// purpose; otherwise the operator must provision an uncommitted secret via the
// `MASTER_TEST_LICENSE_KEY` env var. Unset in production ⇒ the shortcut is off.

/**
 * The built-in dev/test master key.
 *
 * Kept as a convenience default so local and CI flows need no env setup. It is
 * NO LONGER accepted in production on its own — see `configuredMasterKey`.
 */
export const MASTER_TEST_LICENSE_KEY = "FRPB-TEST-1234-5678";

/** The built-in key, uppercase-normalized. */
const EXACT_MASTER_KEY = MASTER_TEST_LICENSE_KEY;

/**
 * Whether dev/test bypasses are enabled in this process.
 *
 * Fail-closed outside development: production must explicitly opt in with
 * `ALLOW_DEV_TEST_KEYS=true`. Used both here and by the database seed (see
 * prisma/seed.ts) to decide whether the master key may be written as a licence.
 */
export function devTestKeysAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEV_TEST_KEYS === "true";
}

/**
 * Resolve the single master key accepted in THIS process, or `null` when the
 * shortcut is disabled.
 *
 * Resolution order (documented so the security posture is auditable):
 *
 *   1. `MASTER_TEST_LICENSE_KEY` env — an operator-provisioned secret. If set
 *      it defines the master key in ANY environment (this is how production
 *      opts in without committing the value). Unset in production ⇒ off.
 *   2. Dev/test fallback — outside production (or with
 *      `ALLOW_DEV_TEST_KEYS=true`) the built-in published constant is honored
 *      so local/CI flows keep working with zero env setup.
 *   3. Otherwise `null` — production with neither signal means NO master key,
 *      so the published string can never activate the product for free.
 */
function configuredMasterKey(): string | null {
  const envKey = process.env.MASTER_TEST_LICENSE_KEY?.trim().toUpperCase();
  if (envKey) return envKey;
  if (devTestKeysAllowed()) return EXACT_MASTER_KEY;
  return null;
}

/**
 * True when `key` should be granted the synthetic master-test profile.
 *
 * TWO TIERS, both fail-closed in production:
 *
 *   1. The configured master key (see `configuredMasterKey`) → accepted when
 *      explicitly provisioned via env, or in dev/test via the built-in default.
 *
 *   2. Any other `FRPB-TEST-*` shaped key → dev-gated only. Accepting the whole
 *      prefix in production would be an open-ended backdoor (anyone could mint
 *      `FRPB-TEST-ANYTHING`) rather than one known string.
 */
export function isMasterTestKey(key: string): boolean {
  const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return false;

  // Tier 1 — the configured master key (env-provisioned, or built-in in dev).
  const master = configuredMasterKey();
  if (master && normalized === master) return true;

  // Tier 2 — the broader prefix remains dev/test only.
  if (!devTestKeysAllowed()) return false;
  return normalized.startsWith("FRPB-TEST-");
}

/**
 * Emit a loud startup warning when an insecure test configuration is active in
 * production. Called once from instrumentation.ts (see `register`).
 *
 * This is deliberately a NO-OP outside production, and does not throw — a
 * misconfiguration is surfaced in the logs/PM2 console, never a boot crash.
 */
export function warnIfInsecureTestConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env.ALLOW_DEV_TEST_KEYS === "true") {
    console.warn(
      "[security] ALLOW_DEV_TEST_KEYS=true in production — ALL FRPB-TEST-* license " +
        "keys (including the published FRPB-TEST-1234-5678) activate the product " +
        "without a database row. Unset it to fail closed."
    );
    return;
  }

  if (process.env.MASTER_TEST_LICENSE_KEY?.trim()) {
    console.warn(
      "[security] MASTER_TEST_LICENSE_KEY is set in production — a master test " +
        "license bypass is ACTIVE. Unset it to disable the shortcut."
    );
  }
}
