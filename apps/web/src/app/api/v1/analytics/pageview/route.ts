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
// error to a visitor. The endpoint therefore always answers 2xx except when the
// caller is rate-limited (429). A DB failure is logged and swallowed.

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

/** Normalise an arbitrary client-supplied path to a safe, query-less value. */
function sanitizePath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Strip query/hash — only the route shape matters for the metric.
  const withoutQuery = raw.split("?")[0]?.split("#")[0]?.trim() ?? "/";
  const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return path.slice(0, MAX_PATH_LENGTH) || "/";
}

export async function POST(req: NextRequest) {
  return withCorsResponse(await handlePageView(req));
}

async function handlePageView(req: NextRequest): Promise<Response> {
  const ip = clientIpFrom(req.headers);

  // Generous per-IP cap: a real visitor navigates a handful of pages per minute.
  const rl = await rateLimit(`pageview:${ip}`, 60, 60);
  if (!rl.allowed) {
    // Silent for the client; keeps a single noisy source from filling the table.
    return NextResponse.json(
      { success: false, status: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // A missing/invalid body is fine — fall back to the root path.
    body = null;
  }
  const path = sanitizePath((body as { path?: unknown } | null)?.path);

  const userAgent = req.headers.get("user-agent") ?? "";
  const isBot = looksLikeBot(userAgent);

  try {
    await prisma.pageView.create({
      data: {
        path,
        visitorHash: visitorHash(ip, userAgent),
        source: isBot ? "BOT" : "WEB",
      },
    });
  } catch (err) {
    // Never fail the visitor — just record that we could not persist.
    console.error(
      "[analytics/pageview] failed to persist page view:",
      (err as Error)?.message ?? err
    );
  }

  // 202: accepted (telemetry need not be awaited by the client).
  return NextResponse.json({ success: true }, { status: 202 });
}
