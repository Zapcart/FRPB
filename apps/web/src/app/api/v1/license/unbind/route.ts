// FRPB — POST /api/v1/license/unbind
// Self-service device unbind (HWID reset). Removes a machine from the active
// device pool so the user can activate on a new machine without support tickets.

import { NextRequest, NextResponse } from "next/server";
import { UnbindRequestSchema } from "@frpb/shared";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { UnbindResponse } from "@frpb/shared";

// Session + DB work — never statically prerender this route.
export const dynamic = "force-dynamic";

// CORS preflight for cross-origin (desktop) callers.
export const OPTIONS = preflight;

const DB_UNAVAILABLE_MESSAGE =
  "We couldn't complete that right now. Please try again in a moment.";

/** Rolling window for the unbind quota (30 days). */
const UNBIND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Maximum self-service unbinds per licence per {@link UNBIND_WINDOW_MS}.
 * Chosen to comfortably cover a genuine "I replaced my PC / reimaged Windows"
 * case (the plan device limits are 1–5) while blocking seat-cycling abuse.
 */
const MAX_UNBINDS_PER_WINDOW = 3;

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleUnbind(req));
}

async function handleUnbind(req: NextRequest) {
  // 1. Auth — getUser() validates the JWT server-side on every request.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json<UnbindResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Validate body
  let parsed;
  try {
    parsed = UnbindRequestSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json<UnbindResponse>(
      { success: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!parsed.success) {
    return NextResponse.json<UnbindResponse>(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    // 3. Find the device; ensure it belongs to this user's license.
    //    Ownership is decided by the canonical Prisma user id (supabaseId →
    //    normalized email), not a raw email string comparison.
    const appUser = await resolvePrismaUser(prisma, { id: user.id, email: user.email });
    const device = await prisma.licenseDevice.findUnique({
      where: { id: parsed.data.deviceId },
      include: { license: { include: { user: true } } },
    });

    if (!appUser || !device || device.license.userId !== appUser.id) {
      return NextResponse.json<UnbindResponse>(
        { success: false, message: "Device not found" },
        { status: 404 }
      );
    }

    if (device.status === "UNBOUND") {
      return NextResponse.json<UnbindResponse>(
        { success: false, message: "Device is already unbound" },
        { status: 400 }
      );
    }

    // 4. COOL-DOWN / QUOTA — self-service unbinding is a licence-shuffling lever:
    //    repeatedly unbinding and re-activating lets one seat be cycled across
    //    unlimited machines, which defeats the per-plan device limit. Cap it at
    //    MAX_UNBINDS_PER_WINDOW per licence within a rolling 30-day window.
    //
    //    The count is derived from the durable `unboundAt` timestamps on the
    //    licence's device rows rather than an in-memory counter, so it survives
    //    a restart and cannot be reset by reconnecting.
    const windowStart = new Date(Date.now() - UNBIND_WINDOW_MS);
    const recentUnbinds = await prisma.licenseDevice.count({
      where: {
        licenseId: device.licenseId,
        unboundAt: { gte: windowStart },
      },
    });
    if (recentUnbinds >= MAX_UNBINDS_PER_WINDOW) {
      const oldest = await prisma.licenseDevice.findFirst({
        where: { licenseId: device.licenseId, unboundAt: { gte: windowStart } },
        orderBy: { unboundAt: "asc" },
        select: { unboundAt: true },
      });
      const nextAvailable = oldest?.unboundAt
        ? new Date(oldest.unboundAt.getTime() + UNBIND_WINDOW_MS)
        : undefined;
      return NextResponse.json<UnbindResponse>(
        {
          success: false,
          message:
            `You have reached the limit of ${MAX_UNBINDS_PER_WINDOW} device unbinds per 30 days ` +
            `for this license. Contact support if you need to move to another machine sooner.`,
          data: { availableAt: nextAvailable?.toISOString() },
        },
        { status: 429 }
      );
    }

    // 5. Mark UNBOUND (slot freed; same machine re-binds on next verify)
    await prisma.licenseDevice.update({
      where: { id: device.id },
      data: { status: "UNBOUND", unboundAt: new Date(), unbindCount: { increment: 1 } },
    });

    return NextResponse.json<UnbindResponse>(
      { success: true, message: "Device unbound", data: { availableAt: new Date().toISOString() } },
      { status: 200 }
    );
  } catch (err) {
    console.error("[license/unbind] Failed to unbind device:", err);
    return NextResponse.json<UnbindResponse>(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }
}
