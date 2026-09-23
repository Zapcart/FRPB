// FRPB — Admin owner-key verification (shared by Edge middleware, Server
// Components, Server Actions and the analytics API route).
//
// EDGE-SAFE: this module must never import `node:crypto`, `next/headers` or
// Prisma, because `src/middleware.ts` (Edge runtime) imports it. A Node-only
// dependency here would break the build with "Module not found: Can't resolve
// 'crypto'".

/**
 * Development-only recovery key — resolved from the environment, never committed.
 *
 * This module previously exported a hardcoded literal (`PLATFORM_ADMIN_KEY`)
 * that happened to EQUAL the production `ADMIN_LICENSE_KEY` value. Because the
 * literal was compiled into the Edge middleware bundle, its source text landed
 * in the emitted middleware source map, so Netlify's secrets scanner detected
 * the `ADMIN_LICENSE_KEY` value inside the build output and aborted the build.
 *
 * Hardcoding any credential-shaped string is unsafe: a value that is committed
 * can never be secret, and if it is ever reused as a real key (as it was here)
 * it is both leaked and un-rotatable without a code change. The fallback is now
 * read from `ADMIN_DEV_KEY`, which is supplied through the environment (local
 * `.env.local` or Netlify build env) and therefore appears in neither the repo
 * nor the emitted bundle.
 *
 * SECURITY MODEL: `ADMIN_LICENSE_KEY` is the owner credential in every
 * environment. `ADMIN_DEV_KEY` — if set — is accepted ONLY when
 * `NODE_ENV !== "production"`, so a development recovery path can exist without
 * ever weakening a production deployment. When neither variable is present the
 * console fails CLOSED.
 */
function getDevAdminKey(): string {
  const dev = process.env.ADMIN_DEV_KEY;
  return dev && dev.length > 0 ? dev : "";
}

/** Name of the HttpOnly cookie that carries a successfully-verified admin key. */
export const ADMIN_COOKIE = "frpb_admin_key";

/** Cookie lifetime — 12 hours. Short enough that a leaked cookie expires. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * Whether this process is a production deployment.
 *
 * The development fallback (`ADMIN_DEV_KEY`) is a convenience that must never be
 * a usable credential in production. Centralised here so every helper below
 * agrees on the rule.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The active owner key: the configured `ADMIN_LICENSE_KEY`, else the
 * environment-provided development key. Returns `""` when neither is present,
 * signalling a genuinely unconfigured (and therefore closed) console.
 */
export function getAdminKey(): string {
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0) return configured;
  return isProduction() ? "" : getDevAdminKey();
}

/**
 * Whether the admin console has an owner key available.
 *
 * `true` when `ADMIN_LICENSE_KEY` is set, or when running outside production
 * with `ADMIN_DEV_KEY` supplied. In production an unset `ADMIN_LICENSE_KEY`
 * yields `false` — the console stays reachable to no one until configured.
 */
export function isAdminKeyConfigured(): boolean {
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0) return true;
  return !isProduction() && getDevAdminKey().length > 0;
}

/**
 * Constant-time string comparison.
 *
 * Implemented without `node:crypto` so it is safe on the Edge runtime. Length is
 * compared first (a length mismatch is not meaningfully secret-dependent here),
 * then the remainder uses a fixed-cost XOR accumulator so no early exit can leak
 * how many leading characters matched.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify a candidate owner key.
 *
 * In production the candidate MUST equal the configured `ADMIN_LICENSE_KEY`;
 * no fallback credential is honoured, so a repo reader cannot reach a live
 * /admin. Outside production the environment-provided `ADMIN_DEV_KEY` is also
 * accepted so local work never locks out — and only when it is actually set.
 */
export function verifyAdminKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0 && constantTimeEqual(candidate, configured)) {
    return true;
  }
  // Fail CLOSED in production: no fallback credential is honoured.
  if (isProduction()) return false;
  const devKey = getDevAdminKey();
  if (devKey.length === 0) return false;
  return constantTimeEqual(candidate, devKey);
}
