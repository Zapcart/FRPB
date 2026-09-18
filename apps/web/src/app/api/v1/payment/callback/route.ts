// FRPB — unified payment callback / completion handler.
//
// ONE endpoint completes BOTH rails so license activation has a single code
// path:
//   • provider=payglocal (GET)  — browser return from the hosted card page
//   • PAYMENT_SUCCESS webhook (POST) — PayGlocal server-to-server notification
//   • provider=upi (GET/POST)   — the Direct-UPI engine's post-verification hop
//
// On success it marks the PaymentOrder PAID, grants/activates the license
// idempotently and redirects the browser to /dashboard?status=success. Provider
// webhooks (POST with JSON) receive a JSON acknowledgement instead of a redirect
// so PayGlocal does not retry a successfully processed event.
//
// SECURITY:
//   - UPI callback: requires VALID orderId that exists in the database.
//     Random/fake UTRs submitted directly to callback are rejected if the
//     order doesn't exist or isn't in a claimable state.
//   - Rate limiting: prevents callback flooding.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { isValidUtr } from "@/lib/upi";
import {
  grantLicenseForOrder,
  markPayGlocalOrderPaid,
  resolveOrderStatus,
} from "@/lib/payment/orders";
import { rateLimit, recordFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in";

/** Where the customer lands once the order is confirmed. */
const SUCCESS_REDIRECT = `${APP_URL}/dashboard?status=success`;
/** Where an unresolved order sends them. */
const FAILURE_REDIRECT = `${APP_URL}/pricing?checkout=incomplete`;

/** PayGlocal success event names across API versions. */
const PG_SUCCESS_EVENTS = new Set([
  "PAYMENT_SUCCESS",
  "PAYMENT_SUCCESS_WEBHOOK",
  "ORDER_PAID",
  "payment.success",
]);

interface PayGlocalCallbackBody {
  event?: string;
  eventType?: string;
  type?: string;
  status?: string;
  orderId?: string;
  order_id?: string;
  merchantTxnId?: string;
  data?: {
    order?: {
      orderId?: string;
      order_id?: string;
      merchantTxnId?: string;
      metadata?: Record<string, string> | null;
      tags?: Record<string, string> | null;
    };
    payment?: {
      paymentId?: string;
      payment_id?: string;
      paymentStatus?: string;
      payment_status?: string;
    };
  };
}

/** Timing-safe comparison of two signature strings. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** HMAC-SHA256 signature check (hex or base64, set by secret presence). */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const b64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(hex, signature) || safeEqual(b64, signature);
}

/** Build a redirect response to the dashboard (or the failure page). */
function redirectTo(target: string): NextResponse {
  return NextResponse.redirect(target, { status: 303 });
}

// Rate limit: 10 callback hits per 5 min per IP
const CALLBACK_RATE_MAX = 10;
const CALLBACK_RATE_WINDOW = 5 * 60;

export async function GET(req: NextRequest) {
  return withCorsResponse(await handleCallback(req, "GET"));
}

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleCallback(req, "POST"));
}

async function handleCallback(req: NextRequest, method: "GET" | "POST") {
  // Rate limiting for all callback access.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  const rateKey = `callback:${ip}:${method}`;
  const rateResult = await rateLimit(rateKey, CALLBACK_RATE_MAX, CALLBACK_RATE_WINDOW);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many callback requests. Please try again later.",
        retryAfter: rateResult.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    );
  }

  const params = req.nextUrl.searchParams;
  const provider = (params.get("provider") ?? "").toLowerCase();

  // ── UPI rail: the Direct-UPI engine already verified the UTR server-side ──
  if (provider === "upi") {
    const orderId = params.get("orderId");
    const utr = params.get("utr");
    if (!orderId) {
      await recordFailure([rateKey], 1, 30);
      return redirectTo(FAILURE_REDIRECT);
    }

    // SECURITY: Verify the order EXISTS and is in a claimable state before
    // accepting the callback. This prevents blind UTR injection attacks.
    let order;
    try {
      order = await prisma.paymentOrder.findUnique({ where: { orderId } });
    } catch (err) {
      console.error("[payment/callback] UPI order lookup failed:", err);
      await recordFailure([rateKey], 1, 30);
      return redirectTo(FAILURE_REDIRECT);
    }

    if (!order) {
      await recordFailure([rateKey], 2, 60);
      return redirectTo(FAILURE_REDIRECT);
    }

    // If a UTR is supplied and the order is still PENDING, claim it here — this
    // is the same uniqueness-guarded transition the verify endpoint performs.
    if (order.status !== "PAID" && utr && isValidUtr(utr)) {
      // Duplicate UTR check — must not already be claimed by another order.
      const existing = await prisma.paymentOrder.findUnique({ where: { utr } });
      if (!existing || existing.orderId === order.orderId) {
        try {
          const updated = await prisma.paymentOrder.updateMany({
            where: { id: order.id, status: "PENDING", utr: null },
            data: { status: "PAID", utr, paidAt: new Date() },
          });
          if (updated.count === 0) {
            // Concurrent claim — fall through and re-read below.
            console.warn(`[payment/callback] concurrent UTR claim for order ${orderId}`);
          }
        } catch (err) {
          // Concurrent claim — fall through and re-read below.
          console.warn(`[payment/callback] UTR claim error for order ${orderId}:`, err);
        }
      } else {
        // UTR already used by another order — reject.
        await recordFailure([rateKey], 2, 60);
        return redirectTo(FAILURE_REDIRECT);
      }
    }

    const fresh = await prisma.paymentOrder.findUnique({ where: { orderId } });
    if (!fresh) {
      await recordFailure([rateKey], 2, 60);
      return redirectTo(FAILURE_REDIRECT);
    }

    const status = await resolveOrderStatus(fresh);
    if (status !== "PAID") {
      await recordFailure([rateKey], 1, 30);
      return redirectTo(FAILURE_REDIRECT);
    }

    // Idempotent activation — one license per order.
    if (!fresh.licenseId) {
      try {
        await grantLicenseForOrder(fresh.orderId);
      } catch (err) {
        console.error("[payment/callback] UPI grant failed:", err);
      }
    }

    // Clear rate limit on success.
    await rateLimit(rateKey, CALLBACK_RATE_MAX * 2, CALLBACK_RATE_WINDOW); // reset

    return redirectTo(SUCCESS_REDIRECT);
  }

  // ── PayGlocal rail ────────────────────────────────────────────────────────
  // POST is the provider webhook (JSON, signature-verified); GET is the browser
  // return where PayGlocal appends its order reference to `returnUrl`.
  let body: PayGlocalCallbackBody = {};
  let rawBody = "";
  if (method === "POST") {
    rawBody = await req.text();
    try {
      body = JSON.parse(rawBody) as PayGlocalCallbackBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Signature verification is enforced whenever the secret is configured.
    const secret = process.env.PAYGLOCAL_MERCHANT_SECRET;
    if (secret) {
      const signature =
        req.headers.get("x-payglocal-signature") ??
        req.headers.get("x-webhook-signature") ??
        req.headers.get("x-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
      }
      if (!verifySignature(rawBody, signature, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const eventType = body.eventType ?? body.event ?? body.type ?? "";
    const paymentStatus = (
      body.data?.payment?.paymentStatus ??
      body.data?.payment?.payment_status ??
      body.status ??
      ""
    ).toLowerCase();

    // Ignore non-success notifications so PayGlocal stops retrying them.
    if (!PG_SUCCESS_EVENTS.has(eventType) && paymentStatus !== "success") {
      return NextResponse.json(
        { received: true, ignored: eventType || paymentStatus || "unknown" },
        { status: 200 }
      );
    }
  }

  // Resolve the reference from the body (webhook) or the query string (return).
  const order = body.data?.order;
  const orderId =
    order?.metadata?.["orderId"] ??
    order?.tags?.["orderId"] ??
    params.get("orderId") ??
    null;
  const providerTxnId =
    order?.orderId ??
    order?.order_id ??
    order?.merchantTxnId ??
    body.merchantTxnId ??
    body.orderId ??
    body.order_id ??
    params.get("order_id") ??
    params.get("orderId") ??
    null;

  if (!orderId && !providerTxnId) {
    await recordFailure([rateKey], 2, 60);
    return method === "POST"
      ? NextResponse.json({ error: "Missing order reference" }, { status: 422 })
      : redirectTo(FAILURE_REDIRECT);
  }

  // Clear rate limit on valid callback.
  await rateLimit(rateKey, CALLBACK_RATE_MAX * 2, CALLBACK_RATE_WINDOW);

  // Mark PAID + grant the license through the shared, idempotent helper.
  let granted: Awaited<ReturnType<typeof markPayGlocalOrderPaid>> = null;
  try {
    granted = await markPayGlocalOrderPaid({ orderId, providerTxnId });
  } catch (err) {
    console.error("[payment/callback] PayGlocal grant failed:", err);
    if (method === "POST") {
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
    return redirectTo(FAILURE_REDIRECT);
  }

  if (method === "POST") {
    return NextResponse.json(
      { received: true, outcome: granted ? "PROCESSED" : "NOT_FOUND" },
      { status: 200 }
    );
  }

  // Browser return — only a real, granted order reaches the dashboard.
  return granted ? redirectTo(SUCCESS_REDIRECT) : redirectTo(FAILURE_REDIRECT);
}
