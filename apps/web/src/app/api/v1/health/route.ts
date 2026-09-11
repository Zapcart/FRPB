// FRPB — GET /api/v1/health
// Liveness probe for the API surface (used by load balancers + uptime checks).

import { NextResponse } from "next/server";
import type { HealthResponse } from "@frpb/shared";
import { preflight, withCorsResponse } from "@/lib/cors";

// CORS preflight — probes and the desktop client call this cross-origin.
export const OPTIONS = preflight;

export async function GET() {
  const body: HealthResponse = {
    status: "ok",
    service: "frpb-web-api",
    timestamp: new Date().toISOString(),
  };
  return withCorsResponse(NextResponse.json(body, { status: 200 }));
}
