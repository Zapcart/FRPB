// FRPB — CORS helper for /api/v1 route handlers.
//
// The desktop app (Electron) calls these endpoints cross-origin: the renderer
// runs from an app:// / file:// style origin and the main process issues plain
// `fetch` requests with a node runtime (often no Origin header at all). No
// cookies or credentials are used for machine-facing endpoints — license
// verification is key + hardware-id based — so a wildcard origin is safe here
// and keeps the API reachable from every desktop protocol variant, including
// `OPTIONS` preflights.
//
// Usage:
//   export const OPTIONS = preflight;                       // preflight handler
//   return withCorsResponse(await handle(req));             // wrap once at boundary
//   return NextResponse.json(body, withCors({ status: 200 }));

import type { NextRequest } from "next/server";

/** The exact CORS contract the desktop client expects. */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

interface CorsInit {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Merge the CORS headers into a `ResponseInit` (for `NextResponse.json`).
 * Any headers supplied by the caller win over the shared defaults.
 */
export function withCors(init: CorsInit = {}): { status: number; headers: Record<string, string> } {
  return {
    status: init.status ?? 200,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  };
}

/**
 * Copy the CORS headers onto an already-built response. Route handlers that
 * build many responses internally (validation, rate limit, DB error, success)
 * can wrap a single time at the exported boundary.
 */
export function withCorsResponse<T extends Response>(response: T): T {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Shared `OPTIONS` (preflight) handler. Returns 204 with the CORS headers so
 * the browser/Electron network stack can complete the preflight cleanly.
 * Exported as `export const OPTIONS = preflight;` from each route module.
 *
 * The parameter is required (not optional): Next.js's generated route types
 * assert that an exported HTTP handler's first param is `NextRequest | Request`,
 * and an optional param widens it to `NextRequest | undefined`, which fails
 * `next build` type-checking.
 */
export function preflight(_req: NextRequest): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
