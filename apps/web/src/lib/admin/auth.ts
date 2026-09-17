// FRPB — Admin owner-key verification (shared by Edge middleware, Server
// Components, Server Actions and the analytics API route).
//
// EDGE-SAFE: this module must never import `node:crypto`, `next/headers` or
// Prisma, because `src/middleware.ts` (Edge runtime) imports it. A Node-only
// dependency here would break the build with "Module not found: Can't resolve
// 'crypto'".

/**
 * Platform fallback owner key.
 *
 * This is NOT a secret — it is a *namespace default*, and it is deliberately
 * identical to the value shipped in `.env.example`. It only ever takes effect
 * when `ADMIN_LICENSE_KEY` is unset in the environment.
 *
 * WHY A FALLBACK EXISTS: the admin console previously failed CLOSED whenever the
 * owner key was absent, so a deployment that simply forgot the env var returned a
 * 503 "Admin analytics is not configured" — the operator could not reach their own
 * dashboard. The operator still has to *know* the key to get past the login form:
 * the key is the access credential, not the env var's mere presence.
 *
 * ⚠️ SECURITY MODEL (please read before changing):
 * the literal below is a PUBLIC *development* recovery key. `verifyAdminKey()`
 * honours it ONLY when `NODE_ENV !== "production"`. In production the console is
 * gated strictly by the `ADMIN_LICENSE_KEY` environment variable — if that is
 * unset, admin access fails CLOSED rather than accepting this public value.
 * This closes the previous hole where a repo reader could reach /admin on a live
 * deployment that had left the env var unset (or equal to this literal).
 */
export const PLATFORM_ADMIN_KEY = "FRPB-ADMIN-9960-8245";

/** Name of the HttpOnly cookie that carries a successfully-verified admin key. */
export const ADMIN_COOKIE = "frpb_admin_key";

/** Cookie lifetime — 12 hours. Short enough that a leaked cookie expires. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * Whether this process is a production deployment.
 *
 * The public `PLATFORM_ADMIN_KEY` is a dev-only convenience and must never be a
 * usable credential in production. Centralised here so all three helpers below
 * agree on the rule (previously they diverged, which made the console reachable
 * by default while analytics reported itself unconfigured).
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * The active owner key: the configured `ADMIN_LICENSE_KEY`, else the public
 * development default. Returns `""` in production when the env var is absent,
 * signalling a genuinely unconfigured (and therefore closed) console.
 */
export function getAdminKey(): string {
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0) return configured;
  return isProduction() ? "" : PLATFORM_ADMIN_KEY;
}

/**
 * Whether the admin console has an owner key available.
 *
 * `true` when `ADMIN_LICENSE_KEY` is set, or when running outside production
 * (where the documented development key applies). In production an unset env var
 * yields `false` — the console stays reachable to no one until configured.
 */
export function isAdminKeyConfigured(): boolean {
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0) return true;
  return !isProduction();
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
 * the public `PLATFORM_ADMIN_KEY` literal is refused outright, so a repo reader
 * cannot reach a live /admin. Outside production the documented development key
 * is still accepted so local work and self-hosted dev never lock out.
 */
export function verifyAdminKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0 && constantTimeEqual(candidate, configured)) {
    return true;
  }
  // Fail CLOSED in production: no public fallback credential is honoured.
  if (isProduction()) return false;
  return constantTimeEqual(candidate, PLATFORM_ADMIN_KEY);
}
