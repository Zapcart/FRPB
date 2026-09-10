// FRPB — GET /api/v1/frp/status/[requestId]
// Poll FRP unlock request status. Mirrored in the desktop app's useFrpOperation hook.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
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

    return NextResponse.json({
      success: true,
      requestId: request.id,
      status: request.status,
      message: request.statusMessage ?? "",
      completedAt: request.completedAt?.toISOString() ?? null,
      result: request.result ?? null,
    });
  } catch (err) {
    console.error("[frp/status] error:", err);
    return NextResponse.json(
      { success: false, status: "SERVER_ERROR", message: "Status check failed." },
      { status: 500 }
    );
  }
}
