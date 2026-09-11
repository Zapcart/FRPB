// FRPB — GET /api/v1/license/devices?licenseId=...
// Authenticated: lists bound devices for one of the user's licenses.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { DashboardDeviceItem, ApiEnvelope } from "@frpb/shared";
import { preflight, withCorsResponse } from "@/lib/cors";

// Session + DB work — never statically prerender this route.
export const dynamic = "force-dynamic";

// CORS preflight for cross-origin (desktop) callers.
export const OPTIONS = preflight;

const DB_UNAVAILABLE_MESSAGE =
  "We couldn't load your devices right now. Please try again in a moment.";

export async function GET(req: NextRequest) {
  return withCorsResponse(await handleDevices(req));
}

async function handleDevices(req: NextRequest) {
  // getUser() validates the JWT server-side, so a stale cookie can't pass.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json<ApiEnvelope>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const licenseId = req.nextUrl.searchParams.get("licenseId");
  if (!licenseId) {
    return NextResponse.json<ApiEnvelope>(
      { success: false, message: "Missing licenseId" },
      { status: 400 }
    );
  }

  try {
    // Ownership guard: device rows belong to a license whose user is the caller
    const license = await prisma.license.findFirst({
      where: { id: licenseId, user: { email: user.email } },
      select: { id: true },
    });
    if (!license) {
      return NextResponse.json<ApiEnvelope>(
        { success: false, message: "License not found" },
        { status: 404 }
      );
    }

    const devices = await prisma.licenseDevice.findMany({
      where: { licenseId },
      orderBy: { lastSeenAt: "desc" },
    });

    const items: DashboardDeviceItem[] = devices.map(
      (d: Awaited<ReturnType<typeof prisma.licenseDevice.findMany>>[number]) => ({
        id: d.id,
        deviceName: d.deviceName,
        status: d.status,
        lastSeenAt: d.lastSeenAt.toISOString(),
        unboundAt: d.unboundAt?.toISOString() ?? null,
        unbindCount: d.unbindCount,
      })
    );

    return NextResponse.json<ApiEnvelope<{ devices: DashboardDeviceItem[] }>>(
      { success: true, data: { devices: items } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[license/devices] Failed to load devices:", err);
    return NextResponse.json<ApiEnvelope>(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }
}
