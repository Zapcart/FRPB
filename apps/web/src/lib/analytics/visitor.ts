// FRPB — first-party visitor identity (privacy-preserving).
//
// Converts a request's IP + user-agent into a stable, non-reversible
// `visitorHash`. Distinct hashes in a window = distinct visitors; a hash seen
// more than once = a returning visitor. NO raw IP or user-agent is ever
// persisted — only the salted digest.
//
// Salt resolution follows the codebase's env-configuration pattern: a private
// `ANALYTICS_HASH_SALT` is used when provided. When it is absent we fall back to
// a fixed, NON-SECRET namespace constant. The digest is a one-way SHA-256 either
// way; the salt only prevents a party who already knows a candidate IP from
// confirming a match, it is not an authentication secret.

import { sha256 } from "@/lib/crypto/sha256";

/** Fixed, non-secret fallback namespace salt (see header comment). */
const FALLBACK_SALT = "frpb.pageview.v1";

function resolveSalt(): string {
  const configured = process.env.ANALYTICS_HASH_SALT?.trim();
  return configured && configured.length > 0 ? configured : FALLBACK_SALT;
}

/** Extract the best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFrom(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Salted SHA-256 of IP + user-agent. Deterministic for a given visitor within a
 * salt epoch, so repeat visits collapse to the same key.
 */
export function visitorHash(ip: string, userAgent: string): string {
  return sha256(`${resolveSalt()}|${ip}|${userAgent}`);
}

/** Conservative bot heuristic — bot views are recorded but excluded from traffic totals. */
export function looksLikeBot(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|bingpreview|headless|python-requests|curl|wget/i.test(
    userAgent
  );
}
