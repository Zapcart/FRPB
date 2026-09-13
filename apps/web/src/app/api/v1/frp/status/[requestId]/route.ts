// FRPB — GET /api/v1/frp/status/[requestId]
// Poll FRP unlock request status. Mirrored in the desktop app's useFrpOperation hook.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import { advanceFrpLifecycle, persistFrpOutcome } from "@/lib/frp/lifecycle";

// CORS preflight for cross-origin (desktop) callers.
export const OPTIONS = preflight;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  return withCorsResponse(await handleStatus(req, { params }));
}

async function handleStatus(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const request = await prisma.frpUnlockRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, status: "NOT_FOUND", message: "Request not found." },
        { status: 404 }
      );
    }

    // Advance the lifecycle on every poll. This is idempotent, so concurrent or
    // repeated polls cannot double-apply a transition; it only writes when the
    // request actually moves between states.
    const outcome = advanceFrpLifecycle({
      id: request.id,
      status: request.status,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      statusMessage: request.statusMessage,
    });

    const current = outcome.transitioned
      ? await persistFrpOutcome(request.id, outcome)
      : request;

    return NextResponse.json({
      success: true,
      requestId: current.id,
      status: current.status,
      message: current.statusMessage ?? "",
      completedAt: current.completedAt?.toISOString() ?? null,
      result: current.result ?? null,
    });
  } catch (err) {
    console.error("[frp/status] error:", err);
    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: "Status check failed." },
      { status: 500 }
    );
  }
}
