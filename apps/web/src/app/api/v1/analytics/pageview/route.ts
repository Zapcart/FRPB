// FRPB — first-party page-view beacon.
//
// Called by the client on each landing (see components/analytics/page-view-tracker).
// Records ONE privacy-preserving PageView row so the admin "VISITORS (30D)"
// metric reflects real traffic instead of only users who filed an FRP request.
//
// PRIVACY / DPDP: the raw IP and user-agent are NEVER stored. Only a salted
// SHA-256 `visitorHash` (lib/analytics/visitor) is persisted, which is enough to
// count distinct and returning visitors but cannot be reversed to an identity.
//
// FAILURE POLICY: a telemetry beacon must never break the page or surface an
// error to a visitor, so the endpoint ALWAYS answers 2xx immediately. All
// persistence — the Upstash Redis rate-limit increment and the PageView insert —
// is deferred to a fire-and-forget background task, so a caller never pays
// Redis/DB latency. Rate limiting is therefore enforced asynchronously: an
// over-limit source is dropped server-side rather than returned a 429.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { preflight, withCorsResponse } from "@/lib/cors";
import {
  clientIpFrom,
  looksLikeBot,
  visitorHash,
} from "@/lib/analytics/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS preflight for cross-origin (desktop) callers.
export const OPTIONS = preflight;

/** Cap the recorded path so a hostile client cannot bloat the column. */
const MAX_PATH_LENGTH = 512;

/** Generous per-IP cap: a real visitor navigates a handful of pages per minute. */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Normalise an arbitrary client-supplied path to a safe, query-less value. */
function sanitizePath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Strip query/hash — only the route shape matters for the metric.
  const withoutQuery = raw.split("?")[0]?.split("#")[0]?.trim() ?? "/";
  const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return path.slice(0, MAX_PATH_LENGTH) || "/";
}

/**
 * Keep the invocation alive for best-effort background work when the runtime
 * exposes `waitUntil` (Vercel/edge-style), otherwise let the promise detach —
 * both are safe for fire-and-forget telemetry that must never block a response.
 */
function deferBackground(promise: Promise<void>): void {
  const settled = promise.catch((err) => {
    console.error(
      "[analytics/pageview] background persistence failed:",
      (err as Error)?.message ?? err
    );
  });
  const runtimeWaitUntil = (
    globalThis as unknown as { waitUntil?: (p: Promise<unknown>) => void }
  ).waitUntil;
  if (typeof runtimeWaitUntil === "function") {
    try {
      runtimeWaitUntil(settled);
      return;
    } catch {
      // Fall through to a detached promise if the runtime rejects it.
    }
  }
  void settled;
}

interface PendingPageView {
  ip: string;
  path: string;
  userAgent: string;
}

/**
 * Fire-and-forget: rate-limit the source, then persist ONE privacy-preserving
 * row. Runs entirely after the response so neither Redis nor Postgres latency is
 * ever on the visitor's critical path. Errors are swallowed and logged.
 */
function persistInBackground(view: PendingPageView): void {
  deferBackground(
    (async () => {
      const rl = await rateLimit(
        `pageview:${view.ip}`,
        RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW_SECONDS
      );
      if (!rl.allowed) {
        // Silent: keep a single noisy source from filling the table.
        return;
      }

      await prisma.pageView.create({
        data: {
          path: view.path,
          visitorHash: visitorHash(view.ip, view.userAgent),
          source: looksLikeBot(view.userAgent) ? "BOT" : "WEB",
        },
      });
    })()
  );
}

export async function POST(req: NextRequest) {
  return withCorsResponse(await handlePageView(req));
}

async function handlePageView(req: NextRequest): Promise<Response> {
  const ip = clientIpFrom(req.headers);

  // Reading the (tiny) request body is local and fast; everything that touches a
  // network — Redis and Postgres — is deferred below.
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // A missing/invalid body is fine — fall back to the root path.
    body = null;
  }
  const path = sanitizePath((body as { path?: unknown } | null)?.path);
  const userAgent = req.headers.get("user-agent") ?? "";

  // Hand off ALL persistence and answer immediately.
  persistInBackground({ ip, path, userAgent });

  // 202: accepted (telemetry need not be awaited by the client).
  return NextResponse.json({ success: true }, { status: 202 });
}
