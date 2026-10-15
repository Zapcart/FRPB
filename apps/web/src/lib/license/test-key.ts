// FRPB — master test license key (dev/test bypass).
//
// ⚠️⚠️ SECURITY POLICY — READ BEFORE DEPLOYING ⚠️⚠️
//
// There is NO hardcoded, committed master key any more. The previously published
// constant (`FRPB-TEST-1234-5678`) has been REMOVED from source, so merely reading
// this repository can never yield a working production activation.
//
// A master/test bypass is now available ONLY when explicitly provisioned through
// the environment, and it FAILS CLOSED in production:
//
//   FRPB_MASTER_TEST_KEY — the uncommitted secret that enables Tier 1.
//                          (legacy alias: MASTER_TEST_LICENSE_KEY)
//   ALLOW_DEV_TEST_KEYS  — set to "true" to re-enable the FRPB-TEST-* prefix.
//
// Outside production (`NODE_ENV !== "production"`) dev/CI flows keep working, but
// they too must supply a key via `FRPB_MASTER_TEST_KEY` — nothing is baked in.
//
// The prefix tier (`FRPB-TEST-*`) is a local/CI convenience only and is ALWAYS
// declined in production unless `ALLOW_DEV_TEST_KEYS=true` is set on purpose.
//
// RELATED: prisma/seed.ts writes a real DB licence row only when BOTH dev/test
// mode is enabled AND a key is provisioned via FRPB_SEED_TEST_KEY — so the
// published prefix never becomes a purchased-looking licence record.

/** Env var holding the operator-provisioned master test key (never committed). */
export const MASTER_TEST_KEY_ENV = "FRPB_MASTER_TEST_KEY";

/** Legacy env var name, still honoured for backward compatibility. */
export const LEGACY_MASTER_TEST_KEY_ENV = "MASTER_TEST_LICENSE_KEY";

/** Env opt-in that re-enables the `FRPB-TEST-*` prefix tier in production. */
export const ALLOW_DEV_TEST_KEYS_ENV = "ALLOW_DEV_TEST_KEYS";

/** Key shape accepted by the local/CI prefix tier only. */
export const TEST_KEY_PREFIX = "FRPB-TEST-";

/** Trim / upper-case / strip whitespace, matching the verify core's normalization. */
function normalizeKey(key: string): string {
  return `${key ?? ""}`.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Whether dev/test bypasses are enabled in this process.
 *
 * Fail-closed outside development: production must explicitly opt in with
 * `ALLOW_DEV_TEST_KEYS=true`. Used both here and by the database seed (see
 * prisma/seed.ts) to decide whether a test licence may be written.
 */
export function devTestKeysAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env[ALLOW_DEV_TEST_KEYS_ENV] === "true";
}

/**
 * The operator-provisioned master key for THIS process, or `null` when unset.
 *
 * Never falls back to a committed constant: with no env key configured there is
 * NO master key, in any environment, so nothing activates the product for free.
 * Resolution order: `FRPB_MASTER_TEST_KEY`, then the legacy
 * `MASTER_TEST_LICENSE_KEY`.
 */
function configuredMasterKey(): string | null {
  const raw = (
    process.env[MASTER_TEST_KEY_ENV] ??
    process.env[LEGACY_MASTER_TEST_KEY_ENV] ??
    ""
  ).trim();
  return raw ? normalizeKey(raw) : null;
}

/**
 * True when `key` should be granted the synthetic master-test profile.
 *
 * TWO TIERS, both fail-closed in production:
 *
 *   1. The operator-provisioned master key (see `configuredMasterKey`) → accepted
 *      only when explicitly supplied via env. There is no committed default.
 *
 *   2. Any other `FRPB-TEST-*` shaped key → dev/test-gated only. Accepting the
 *      whole prefix in production would be an open-ended backdoor (anyone could
 *      mint `FRPB-TEST-ANYTHING`) rather than one known string.
 */
export function isMasterTestKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (!normalized) return false;

  // Tier 1 — the env-provisioned master key (never committed).
  const master = configuredMasterKey();
  if (master !== null && normalized === master) return true;

  // Tier 2 — the broader prefix remains dev/test only.
  if (!devTestKeysAllowed()) return false;
  return normalized.startsWith(TEST_KEY_PREFIX);
}

/**
 * Emit a loud startup warning when an insecure test configuration is active in
 * production. Called once from instrumentation.ts (see `register`).
 *
 * Deliberately a NO-OP outside production, and never throws — a misconfiguration
 * is surfaced in the logs/PM2 console, never a boot crash.
 */
export function warnIfInsecureTestConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env[ALLOW_DEV_TEST_KEYS_ENV] === "true") {
    console.warn(
      "[security] ALLOW_DEV_TEST_KEYS=true in production — ANY FRPB-TEST-* " +
        "license key activates the product without a database row. " +
        "Unset it to fail closed."
    );
    return;
  }

  if (configuredMasterKey() !== null) {
    const envName = process.env[MASTER_TEST_KEY_ENV]
      ? MASTER_TEST_KEY_ENV
      : LEGACY_MASTER_TEST_KEY_ENV;
    console.warn(
      `[security] ${envName} is set in production — a master test license ` +
        `bypass is ACTIVE. Unset it to disable the shortcut.`
    );
  }
}
