// FRPB — POST /api/v1/payment/verify
//
// Claims a direct-UPI order by submitting the customer's 12-digit UPI
// reference (UTR/RRN). On success the order is marked PAID and a license is
// minted exactly once.
//
// Security hardening:
//   1. RATE LIMITING — prevents brute-force UTR guessing attacks.
//   2. UTR STRUCTURE — must be exactly 12 numeric digits (spaces/dashes from a
//      copied bank SMS are normalised away first).
//   3. UTR UNIQUENESS  — `PaymentOrder.utr` carries a unique index, so the same
//      reference can never be claimed twice (double-spend protection). We also
//      pre-check for a friendly error instead of leaking a P2002 constraint.
//   4. ORDER EXPIRY    — a PENDING order past its 10-minute window is EXPIRED
//      and refuses the claim.
//   5. PAYMENT CONFIRMATION — for self-hosted UPI, the license is ONLY granted
//      when paymentConfirmed=true (admin verified bank statement). This prevents
//      random/fake UTR abuse — the order is marked PAID but NO license until
//      admin confirms the actual bank transfer.
//   6. IDEMPOTENT GRANT — an already-PAID order returns its existing license
//      rather than minting a second key.
//
// NOTE ON UTR VALIDATION:
//   The self-hosted Direct UPI engine accepts a UPI reference (UTR/RRN) from
//   the customer and validates it structurally (12 digits) + uniquely (one
//   claim per reference). True bank-side verification requires NPCI/bank API
//   access which is NOT available in a self-hosted zero-MDR model.
//
//   The solution: order is marked PAID when UTR validates, but license is ONLY
//   granted when paymentConfirmed=true (set by admin after bank statement match,
//   or automatically by hosted gateway webhook for PayGlocal orders).

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
import { rateLimit, checkLockout, recordFailure, clearFailures } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const VerifySchema = z.object({
  orderId: z.string().min(3).max(64),
  utrNumber: z.string().min(1).max(32),
});

// Rate limit: 5 verify attempts per 10 min per IP
const VERIFY_RATE_MAX = 5;
const VERIFY_RATE_WINDOW = 10 * 60;

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleVerify(req));
}

async function handleVerify(req: NextRequest) {
  // 0. Rate limiting — prevent UTR brute-force / random guessing attacks.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  let parsed: z.infer<typeof VerifySchema>;
  try {
    parsed = VerifySchema.parse(await req.json());
  } catch (err) {
    const fakeIpKey = `verify:${ip}:parse_fail`;
    await recordFailure([fakeIpKey], 3, 120);
    return NextResponse.json(
      { success: false, message: "Invalid request", detail: (err as Error).message },
      { status: 400 }
    );
  }

  const orderId = parsed.orderId.trim();
  const utr = normalizeUtr(parsed.utrNumber);
  const rateKeyIp = `verify:${ip}:${orderId}`;

  // Rate limit check BEFORE any DB work.
  const rateResult = await rateLimit(rateKeyIp, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many verification attempts. Please wait before trying again.",
        retryAfter: rateResult.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    );
  }

  // 1. UTR STRUCTURE — exactly 12 numeric digits.
  if (!isValidUtr(utr)) {
    await recordFailure([rateKeyIp], 3, 120);
    return NextResponse.json(
      {
        success: false,
        message:
          "That UPI reference doesn't look right. Enter the 12-digit UTR/RRN number from your payment app.",
      },
      { status: 422 }
    );
  }

  // 2. Load the order.
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
    await recordFailure([rateKeyIp], 2, 60);
    return NextResponse.json(
      { success: false, message: "Order not found. Please start a new checkout." },
      { status: 404 }
    );
  }

  // SECURITY: UTR verification is ONLY for Direct UPI orders (provider="UPI").
  // PayGlocal orders (provider="PAYGLOCAL") are verified via webhook/callback,
  // not via UTR. Reject UPI verification for non-UPI orders.
  if (order.provider !== "UPI") {
    await recordFailure([rateKeyIp], 2, 60);
    return NextResponse.json(
      {
        success: false,
        message: `This order is a ${order.provider} payment and cannot be verified via UPI reference. ` +
          `Please use the payment confirmation link sent to your email.`,
      },
      { status: 400 }
    );
  }

  // Lockout check.
  const lockoutResult = await checkLockout([rateKeyIp]);
  if (lockoutResult) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many failed verification attempts. Please start a new order.",
      },
      { status: 429 }
    );
  }

  // 3. Already paid → idempotent success.
  if (order.status === "PAID") {
    await clearFailures([rateKeyIp]);
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
      paymentConfirmed: order.paymentConfirmed,
    });
  }

  // 4. ORDER EXPIRY.
  const status = await resolveOrderStatus(order);
  if (status === "EXPIRED") {
    await recordFailure([rateKeyIp], 1, 30);
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
    await recordFailure([rateKeyIp], 1, 30);
    return NextResponse.json(
      { success: false, status: "FAILED", message: "This order can no longer be verified." },
      { status: 409 }
    );
  }

  // 5. UTR UNIQUENESS — two independent checks.
  const utrHash = sha256(utr);
  try {
    const existingClaim = await prisma.paymentOrder.findUnique({ where: { utr } });
    if (existingClaim && existingClaim.orderId !== order.orderId) {
      await recordFailure([rateKeyIp], 2, 60);
      return NextResponse.json(
        {
          success: false,
          message:
            "This UPI reference has already been used for another order. Every payment can be claimed once.",
        },
        { status: 409 }
      );
    }

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
      await recordFailure([rateKeyIp], 2, 60);
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

  // 6. Mark PAID and claim the UTR.
  try {
    const updated = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: "PENDING", utr: null },
      data: { status: "PAID", utr, paidAt: new Date() },
    });
    if (updated.count === 0) {
      const fresh = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
      if (fresh?.status === "PAID") {
        await clearFailures([rateKeyIp]);
        return NextResponse.json({
          success: true,
          alreadyVerified: true,
          status: "PAID",
          orderId: fresh.orderId,
          utr: fresh.utr,
          licenseId: fresh.licenseId,
          paymentConfirmed: fresh.paymentConfirmed,
        });
      }
      await recordFailure([rateKeyIp], 2, 60);
      return NextResponse.json(
        { success: false, message: "This order is no longer awaiting payment." },
        { status: 409 }
      );
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      await recordFailure([rateKeyIp], 2, 60);
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

  // 7. PAYMENT CONFIRMATION CHECK (self-hosted UPI fraud protection).
  if (order.provider === "UPI" && !order.paymentConfirmed) {
    await clearFailures([rateKeyIp]);
    return NextResponse.json({
      success: true,
      status: "PAID",
      orderId: order.orderId,
      planId: order.planId,
      planName: planNameFor(order.planId as PlanSlug),
      amount: order.amount,
      utr,
      licenseId: null,
      paymentConfirmed: false,
      paymentPendingConfirmation: true,
      message:
        "Payment reference recorded successfully. Your payment is pending admin confirmation. " +
        "To activate your license, please share your bank statement (showing this UTR: " +
        `${utr}) with support. This usually takes 1-2 hours during business hours. ` +
        "Your money has NOT been charged to us — we are verifying the bank transfer.",
    });
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
    grantFailed = true;
    console.error("[UTR_Verify_Error]: license grant failed for orderId=" + orderId + ":", err);
  }

  await clearFailures([rateKeyIp]);

  return NextResponse.json({
    success: true,
    status: "PAID",
    orderId: order.orderId,
    planId: order.planId,
    planName: planNameFor(order.planId as PlanSlug),
    amount: order.amount,
    utr,
    licenseId,
    licenseKey,
    grantFailed,
    message: grantFailed
      ? "Payment verified — we're finalising your license. It will appear in your dashboard shortly."
      : "Payment verified — your license is active.",
  });
}
