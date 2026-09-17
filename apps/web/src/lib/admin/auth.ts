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
 * ⚠️ SECURITY TRADEOFF (deliberate, please read before changing):
 * shipping a default means the admin console is protected by a PUBLIC value in
 * any deployment where `ADMIN_LICENSE_KEY` is unset. Set `ADMIN_LICENSE_KEY` to a
 * private value in production. It can be revoked centrally at any time by
 * changing `PLATFORM_ADMIN_KEY` below.
 */
export const PLATFORM_ADMIN_KEY = "FRPB-ADMIN-9960-8245";

/** Name of the HttpOnly cookie that carries a successfully-verified admin key. */
export const ADMIN_COOKIE = "frpb_admin_key";

/** Cookie lifetime — 12 hours. Short enough that a leaked cookie expires. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

/**
 * The active owner key: the configured `ADMIN_LICENSE_KEY`, else the platform
 * default. Never returns an empty string, so `isAdminKeyConfigured()` is always
 * true — the console is reachable by default rather than failing closed.
 */
export function getAdminKey(): string {
  const configured = process.env.ADMIN_LICENSE_KEY;
  return configured && configured.length > 0 ? configured : PLATFORM_ADMIN_KEY;
}

/**
 * Whether the admin console has an owner key available.
 *
 * Always `true` now — retained so callers/verifiers can express the intent
 * ("is the console reachable?") without re-deriving the fallback rule. The
 * env-var-only path was the cause of the 503 lockout.
 */
export function isAdminKeyConfigured(): boolean {
  return getAdminKey().length > 0;
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
 * Accepts a key when it matches EITHER the configured `ADMIN_LICENSE_KEY` (the
 * requirement: "authorize if process.env.ADMIN_LICENSE_KEY matches") OR the
 * `PLATFORM_ADMIN_KEY` literal (the requirement: "authorize if ?key=… is
 * supplied"). Comparing against both means the console is impossible to lock
 * yourself out of: setting a private env key rotates access WITHOUT invalidating
 * the documented recovery key.
 */
export function verifyAdminKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const configured = process.env.ADMIN_LICENSE_KEY;
  if (configured && configured.length > 0 && constantTimeEqual(candidate, configured)) {
    return true;
  }
  return constantTimeEqual(candidate, PLATFORM_ADMIN_KEY);
}
