// FRPB — GET /api/v1/payment/status?orderId=XYZ
//
// Lightweight polling endpoint used by the checkout page (every 3 seconds). It
// returns the current order status and, once PAID, the granted license so the
// client can redirect to /dashboard?payment=success.
//
// An order past its 10-minute window is reported as EXPIRED (and persisted as
// such by resolveOrderStatus) even if no verifier ever claimed it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { resolveOrderStatus } from "@/lib/payment/orders";
import type { PlanSlug } from "@frpb/shared";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: NextRequest) {
  return withCorsResponse(await handleStatus(req));
}

async function handleStatus(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json(
      { success: false, message: "orderId is required" },
      { status: 400 }
    );
  }

  let order;
  try {
    order = await prisma.paymentOrder.findUnique({
      where: { orderId },
      include: { license: { select: { id: true, expiresAt: true } } },
    });
  } catch (err) {
    // Structured code first — this is the line operators grep for when the
    // checkout tracker reports "temporarily unavailable".
    console.error(
      `[payment/status] DB error (code=${(err as { code?: string }).code ?? "NONE"}):`,
      err
    );
    return NextResponse.json(
      { success: false, message: "We couldn't check the order right now. Please retry." },
      { status: 503 }
    );
  }

  if (!order) {
    return NextResponse.json(
      { success: false, status: "NOT_FOUND", message: "Order not found." },
      { status: 404 }
    );
  }

  // Lazily expire a stale PENDING order so the client stops polling.
  const status = await resolveOrderStatus(order);
  const expiresInSeconds = Math.max(
    0,
    Math.floor((order.expiresAt.getTime() - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      success: true,
      orderId: order.orderId,
      status,
      planId: order.planId as PlanSlug,
      amount: order.amount,
      currency: order.currency,
      provider: order.provider,
      utr: order.utr,
      licenseId: order.licenseId,
      expiresAt: order.expiresAt.toISOString(),
      expiresInSeconds,
    },
    {
      // Explicitly uncacheable. Without this a CDN / intermediary can serve a
      // stale PENDING snapshot to the 3-second poller, which presents as "live
      // tracking is stuck" even though the order was already PAID server-side.
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
