// FRPB — POST /api/v1/payment/confirm (Admin-only)
//
// Marks a UPI payment order as paymentConfirmed=true after admin verifies
// the customer's bank statement matches the UTR.
//
// This endpoint requires ADMIN_LICENSE_KEY authentication.
//
// SECURITY:
//   - Only accessible to admins (ADMIN_LICENSE_KEY header required)
//   - Records audit log of who confirmed which payment and when
//   - Prevents fake UTR abuse: customer pays → UTR recorded → admin confirms
//     via bank statement → license granted

import { NextRequest, NextResponse } from "next/server";
import type { UpiOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { constantTimeEqual } from "@/lib/admin/auth";
import { grantLicenseForOrder } from "@/lib/payment/orders";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

// Rate limit: 20 confirmations per 5 min per admin IP
const CONFIRM_RATE_MAX = 20;
const CONFIRM_RATE_WINDOW = 5 * 60;

/**
 * Get admin key from request — check multiple sources:
 *   1. Authorization header: Bearer <key>
 *   2. X-Admin-Key header
 *   3. Admin license key from environment
 */
function getAdminKeyFromRequest(req: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check X-Admin-Key header
  const adminKeyHeader = req.headers.get("x-admin-key");
  if (adminKeyHeader) {
    return adminKeyHeader;
  }

  return null;
}

/**
 * Authenticate admin request.
 * Returns the admin key if valid, or null if authentication fails.
 */
async function authenticateAdmin(req: NextRequest): Promise<{ authenticated: boolean; adminKey?: string; reason?: string }> {
  const providedKey = getAdminKeyFromRequest(req);
  if (!providedKey) {
    return { authenticated: false, reason: "Missing admin key" };
  }

  // Get the configured admin key
  const configuredKey = process.env.ADMIN_LICENSE_KEY;
  if (!configuredKey) {
    console.error("[payment/confirm] ADMIN_LICENSE_KEY not configured in environment");
    return { authenticated: false, reason: "Server configuration error" };
  }

  // Timing-safe comparison to prevent timing attacks
  if (!constantTimeEqual(providedKey, configuredKey)) {
    // Log failed attempts for security monitoring
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    console.warn(`[payment/confirm] Failed admin auth attempt from ${ip}: key=${providedKey.slice(0, 8)}...`);
    return { authenticated: false, reason: "Invalid admin key" };
  }

  return { authenticated: true, adminKey: providedKey };
}

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleConfirm(req));
}

async function handleConfirm(req: NextRequest) {
  // Rate limiting.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  const rateKey = `confirm:${ip}`;
  const rateResult = await rateLimit(rateKey, CONFIRM_RATE_MAX, CONFIRM_RATE_WINDOW);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many confirmation requests. Please wait before trying again.",
        retryAfter: rateResult.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    );
  }

  // Authenticate admin.
  const auth = await authenticateAdmin(req);
  if (!auth.authenticated) {
    return NextResponse.json(
      {
        success: false,
        message: auth.reason === "Missing admin key"
          ? "Admin authentication required. Provide ADMIN_LICENSE_KEY in Authorization header or X-Admin-Key header."
          : "Access denied: " + auth.reason,
      },
      { status: 401 }
    );
  }

  // Parse request body.
  let body: { orderId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { orderId, reason } = body;
  if (!orderId) {
    return NextResponse.json(
      { success: false, message: "orderId is required" },
      { status: 400 }
    );
  }

  // Find the order.
  const order = await prisma.paymentOrder.findUnique({
    where: { orderId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!order) {
    return NextResponse.json(
      { success: false, message: "Order not found" },
      { status: 404 }
    );
  }

  // Only UPI orders need admin confirmation.
  if (order.provider !== "UPI") {
    return NextResponse.json(
      {
        success: false,
        message: `This order is a ${order.provider} payment and does not require admin confirmation.`,
      },
      { status: 400 }
    );
  }

  // Already confirmed? Return success anyway (idempotent).
  if (order.paymentConfirmed) {
    // If there's already a license, return it.
    if (order.licenseId) {
      const license = await prisma.license.findUnique({
        where: { id: order.licenseId },
        select: { key: true, status: true },
      });
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        orderId: order.orderId,
        status: order.status,
        licenseKey: license?.key ?? null,
        confirmedAt: new Date().toISOString(),
        confirmedBy: auth.adminKey?.slice(0, 8) + "...",
        reason: reason ?? "Duplicate confirmation request",
      });
    }
    // Payment confirmed but license not yet granted (edge case).
    return NextResponse.json({
      success: true,
      alreadyConfirmed: true,
      orderId: order.orderId,
      status: order.status,
      licenseKey: null,
      message: "Payment already confirmed. License will be granted on next verification.",
    });
  }

  // Mark as payment confirmed and promote the order to PAID. A customer who
  // submitted a UTR sits in PENDING_VERIFICATION until an admin approves it here;
  // `grantLicenseForOrder` refuses UPI orders whose `paymentConfirmed` is still
  // false, so the confirmation and the PAID transition must land before the grant.
  let finalStatus: UpiOrderStatus = order.status;
  try {
    const updated = await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        paymentConfirmed: true,
        // Clear suspicious flag if it was set (admin reviewed and confirmed).
        utrSuspicious: false,
        // Promote a submitted UTR to PAID now that the admin has verified it.
        ...(order.status === "PENDING_VERIFICATION"
          ? { status: "PAID" as const, paidAt: new Date() }
          : {}),
      },
      select: { status: true },
    });
    finalStatus = updated.status;
  } catch (err) {
    console.error("[payment/confirm] Failed to mark payment as confirmed:", err);
    return NextResponse.json(
      { success: false, message: "Failed to confirm payment. Please try again." },
      { status: 500 }
    );
  }

  // Grant the license now that the payment is confirmed and the order is PAID.
  let licenseKey: string | null = null;
  let licenseId: string | null = null;

  if (finalStatus === "PAID") {
    try {
      const granted = await grantLicenseForOrder(order.orderId);
      if (granted) {
        licenseKey = granted.licenseKey;
        licenseId = granted.licenseId;
      }
    } catch (err) {
      console.error("[payment/confirm] License grant failed after confirmation:", err);
      // Payment is confirmed, but license grant failed. Customer can re-verify.
    }
  }

  // Log the confirmation for audit.
  console.log(
    JSON.stringify({
      tag: "payment/confirm",
      event: "payment_confirmed",
      orderId: order.orderId,
      utr: order.utr,
      customerEmail: order.email,
      amount: order.amount,
      currency: order.currency,
      status: finalStatus,
      licenseGranted: licenseId !== null,
      licenseId: licenseId,
      confirmedBy: auth.adminKey?.slice(0, 8) + "...",
      reason: reason ?? "Admin confirmation",
      timestamp: new Date().toISOString(),
      adminIp: ip,
    })
  );

  return NextResponse.json({
    success: true,
    orderId: order.orderId,
    status: finalStatus,
    utr: order.utr,
    customerEmail: order.email,
    amount: order.amount,
    currency: order.currency,
    licenseGranted: licenseKey !== null,
    licenseKey,
    licenseId,
    confirmedAt: new Date().toISOString(),
    message: licenseKey
      ? "Payment confirmed and license granted successfully."
      : "Payment confirmed. License will be granted when customer re-verifies the UTR.",
  });
}
