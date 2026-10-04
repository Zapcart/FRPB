// FRPB — public-origin resolution for absolute redirect URLs.
//
// SECURITY / CORRECTNESS: server route handlers that must issue an absolute
// redirect (most importantly the OAuth callback) cannot trust
// `request.nextUrl.origin` in production. Behind a reverse proxy
// (Nginx / CloudFront / ALB) that value frequently resolves to the *internal*
// upstream host — e.g. `http://localhost:3000` or the private node address —
// because Next.js builds it from the incoming socket rather than the public
// Host header. A redirect to that origin is unreachable for the browser and,
// for OAuth, no longer matches the origin the PKCE flow started on, which
// surfaces as a failed/`401` code exchange.
//
// Resolution order:
//   1. `NEXT_PUBLIC_APP_URL`  — the explicitly-configured canonical public URL.
//   2. `x-forwarded-host` / `x-forwarded-proto` — set by the trusted proxy.
//   3. `request.nextUrl.origin` — last-resort fallback (local dev, direct hits).

import type { NextRequest } from "next/server";

/** Trim a trailing slash so callers can safely concatenate a path. */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Read the first entry of a possibly comma-separated forwarded header. */
function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * Resolve the canonical public origin used to build absolute redirect targets.
 * Never throws — degrades to `request.nextUrl.origin` when nothing else is set.
 */
export function resolveRedirectOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const forwardedProto =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}
