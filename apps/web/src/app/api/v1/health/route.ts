// FRPB — GET /api/v1/health
// Liveness probe for the API surface (used by load balancers + uptime checks).

import { NextResponse } from "next/server";
import type { HealthResponse } from "@frpb/shared";

export async function GET() {
  const body: HealthResponse = {
    status: "ok",
    service: "frpb-web-api",
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: 200 });
}
