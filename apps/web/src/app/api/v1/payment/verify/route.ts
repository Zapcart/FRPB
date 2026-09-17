// FRPB — POST /api/v1/payment/verify
//
// Claims a direct-UPI order by submitting the customer's 12-digit UPI
// reference (UTR/RRN). On success the order is marked PAID and a license is
// minted exactly once.
//
// Security hardening:
//   1. UTR STRUCTURE — must be exactly 12 numeric digits (spaces/dashes from a
//      copied bank SMS are normalised away first).
//   2. UTR UNIQUENESS  — `PaymentOrder.utr` carries a unique index, so the same
//      reference can never be claimed twice (double-spend protection). We also
//      pre-check for a friendly error instead of leaking a P2002 constraint.
//   3. ORDER EXPIRY    — a PENDING order past its 10-minute window is EXPIRED
//      and refuses the claim.
//   4. IDEMPOTENT GRANT — an already-PAID order returns its existing license
//      rather than minting a second key.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { sha256 } from "@/lib/crypto/sha256";
import { isValidUtr, normalizeUtr } from "@/lib/upi";
import {
  grantLicenseForOrder,
  planNameFor,
  resolveOrderStatus,
} from "@/lib/payment/orders";
import type { PlanSlug } from "@frpb/shared";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const VerifySchema = z.object({
  orderId: z.string().min(3).max(64),
  utrNumber: z.string().min(1).max(32),
});

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleVerify(req));
}

async function handleVerify(req: NextRequest) {
  // 1. Parse + validate the payload.
  let parsed: z.infer<typeof VerifySchema>;
  try {
    parsed = VerifySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Invalid request", detail: (err as Error).message },
      { status: 400 }
    );
  }

  const orderId = parsed.orderId.trim();
  const utr = normalizeUtr(parsed.utrNumber);

  // 2. UTR STRUCTURE — exactly 12 numeric digits.
  if (!isValidUtr(utr)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "That UPI reference doesn't look right. Enter the 12-digit UTR/RRN number from your payment app.",
      },
      { status: 422 }
    );
  }

  // 3. Load the order.
  //
  //    GUARDED: an unhandled rejection here (pooler unreachable, PgBouncer
  //    prepared-statement rejection, schema drift) escaped the handler as an
  //    HTML 500. The client's `res.json()` then threw inside its catch-all and
  //    told the customer "Verification failed. Please check your connection" —
  //    the wrong diagnosis for a server-side DB fault, and invisible in logs.
  let order;
  try {
    order = await prisma.paymentOrder.findUnique({ where: { orderId } });
  } catch (err) {
    const code = (err as { code?: string }).code;
    console.error(
      `[UTR_Verify_Error]: order lookup failed for orderId=${orderId} (code=${code ?? "NONE"}):`,
      err
    );
    if (code === "P2002" || code === "P2021" || code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Payments are being reconciled — the payment database is not fully migrated. Please retry shortly.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: "We couldn't reach the payment database. Please retry in a moment.",
      },
      { status: 503 }
    );
  }
  if (!order) {
    return NextResponse.json(
      { success: false, message: "Order not found. Please start a new checkout." },
      { status: 404 }
    );
  }

  // 4. Already paid → idempotent success (returns the same license).
  if (order.status === "PAID") {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      status: "PAID",
      orderId: order.orderId,
      planId: order.planId,
      planName: planNameFor(order.planId as PlanSlug),
      amount: order.amount,
      utr: order.utr,
      licenseId: order.licenseId,
    });
  }

  // 5. ORDER EXPIRY — never accept a claim against a stale order.
  const status = await resolveOrderStatus(order);
  if (status === "EXPIRED") {
    return NextResponse.json(
      {
        success: false,
        status: "EXPIRED",
        message: "This order expired after 10 minutes. Please start a new checkout.",
      },
      { status: 410 }
    );
  }
  if (status === "FAILED") {
    return NextResponse.json(
      { success: false, status: "FAILED", message: "This order can no longer be verified." },
      { status: 409 }
    );
  }

  // 6. UTR UNIQUENESS — two independent checks, because a reference can be
  //    claimed through more than one flow:
  //      (a) another PaymentOrder already bound to this UTR, and
  //      (b) a License already granted for this UTR (written into its metadata
  //          by the grant helper), which catches the case where the webhook
  //          rail won the race and this UPI flow is now replaying the claim.
  //    Checking only (a) is what previously allowed an overlapping UPI +
  //    webhook flow to mint a duplicate key.
  // The duplicate guards below are READ-ONLY pre-checks. They are wrapped so a
  // transient DB drop returns a retryable 503 rather than bubbling out as an
  // unhandled 500 — the customer has already paid at this point, so the error
  // must be honest and recoverable.
  const utrHash = sha256(utr);
  try {
    const existingClaim = await prisma.paymentOrder.findUnique({ where: { utr } });
    if (existingClaim && existingClaim.orderId !== order.orderId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This UPI reference has already been used for another order. Every payment can be claimed once.",
        },
        { status: 409 }
      );
    }

    // Look up by the durable UTR hash recorded on the granted license. Using the
    // hash (not the raw value) keeps the lookup index-friendly and avoids storing
    // a plaintext reference in an easily-queried column.
    const grantedForUtr = await prisma.license.findFirst({
      where: {
        OR: [
          { metadata: { path: ["utrHash"], equals: utrHash } },
          { metadata: { path: ["utr"], equals: utr } },
        ],
      },
      select: { id: true, userId: true },
    });
    if (grantedForUtr && order.licenseId !== grantedForUtr.id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This UPI reference has already been redeemed. Every payment can be claimed once.",
        },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("[UTR_Verify_Error]: duplicate-claim pre-check failed:", err);
    return NextResponse.json(
      {
        success: false,
        message: "We couldn't verify your payment right now. Please retry.",
        code: "DB_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  // 7. Mark PAID and claim the UTR. The unique index is the race-safe guard: if
  //    a concurrent request binds the same UTR first, Prisma raises P2002 and we
  //    surface the duplicate message rather than double-granting.
  try {
    const updated = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: "PENDING", utr: null },
      data: { status: "PAID", utr, paidAt: new Date() },
    });
    if (updated.count === 0) {
      // Someone else already flipped it — re-read and report the real state.
      const fresh = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
      if (fresh?.status === "PAID") {
        return NextResponse.json({
          success: true,
          alreadyVerified: true,
          status: "PAID",
          orderId: fresh.orderId,
          utr: fresh.utr,
          licenseId: fresh.licenseId,
        });
      }
      return NextResponse.json(
        { success: false, message: "This order is no longer awaiting payment." },
        { status: 409 }
      );
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message: "This UPI reference has already been used for another order.",
        },
        { status: 409 }
      );
    }
    console.error("[payment/verify] DB error while claiming UTR:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't verify your payment right now. Please retry." },
      { status: 503 }
    );
  }

  // 8. Grant the license (idempotent — one key per order).
  let licenseKey: string | undefined;
  let licenseId: string | undefined;
  let grantFailed = false;
  try {
    const granted = await grantLicenseForOrder(orderId);
    licenseId = granted?.licenseId;
    licenseKey = granted?.licenseKey;
    if (!granted) grantFailed = true;
  } catch (err) {
    // The payment is recorded; a grant failure must not lose it. The customer
    // can re-verify (idempotent) or recover the key from the dashboard.
    //
    // `grantFailed` is surfaced to the client so it does not claim "your
    // license is active" while no key was actually minted — a silent success
    // that left paid customers with nothing.
    grantFailed = true;
    console.error("[UTR_Verify_Error]: license grant failed for orderId=" + orderId + ":", err);
  }

  return NextResponse.json({
    success: true,
    status: "PAID",
    orderId: order.orderId,
    planId: order.planId,
    planName: planNameFor(order.planId as PlanSlug),
    amount: order.amount,
    utr,
    licenseId,
    /** Raw key returned once so the checkout can display it immediately. */
    licenseKey,
    /** `true` when payment was claimed but minting the license failed. */
    grantFailed,
    message: grantFailed
      ? "Payment verified — we're finalising your license. It will appear in your dashboard shortly."
      : "Payment verified — your license is active.",
  });
}
