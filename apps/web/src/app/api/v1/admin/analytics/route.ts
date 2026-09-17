// FRPB — GET /api/v1/admin/analytics
//
// Owner-only analytics endpoint. Aggregates PostHog metrics + Prisma DB stats
// for the admin dashboard.
//
// SECURITY: This route is protected by a private owner key (ADMIN_LICENSE_KEY)
// supplied as a Bearer token. When that key is not configured the endpoint fails
// CLOSED (503) instead of allowing an empty token to match an empty key. The key
// is only ever read on the server and is never exposed to the browser.
//
// The heavy query logic lives in "@/lib/admin-analytics" and is shared with the
// admin Server Component, so the API and the dashboard always return the same
// shape (AdminQueryResult / AdminAnalyticsResponse).

import { NextRequest, NextResponse } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import {
  getAdminAnalytics,
  isAdminAnalyticsConfigured,
} from "@/lib/admin-analytics";
import { getAdminKey, verifyAdminKey } from "@/lib/admin/auth";
import type { AdminQueryResult } from "@frpb/shared/analytics";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

function extractBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function handleAnalytics(
  req: NextRequest
): Promise<NextResponse<AdminQueryResult | { error: string }>> {
  // There is always an owner key now (configured or platform fallback), so the
  // old "not configured → 503" lockout cannot occur. Kept as a defensive guard.
  if (!isAdminAnalyticsConfigured() || getAdminKey().length === 0) {
    return NextResponse.json(
      { error: "Admin analytics is not configured" },
      { status: 503 }
    );
  }

  const token = extractBearerToken(req);
  // Constant-time comparison, shared with the /admin console gate so the two
  // surfaces can never drift apart.
  if (token.length === 0 || !verifyAdminKey(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAdminAnalytics();
  // getAdminAnalytics() returns null only when unconfigured, which we already
  // rejected above; treat any unexpected null as a server error.
  if (!data) {
    return NextResponse.json(
      { error: "Admin analytics is not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json(data as AdminQueryResult, { status: 200 });
}

export async function GET(req: NextRequest) {
  return withCorsResponse(await handleAnalytics(req));
}
