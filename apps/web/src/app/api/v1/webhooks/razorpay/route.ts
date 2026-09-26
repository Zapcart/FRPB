// FRPB — Razorpay webhook endpoint (payment.captured / order.paid license gate).
//
// SECURITY MODEL
//   Licenses are granted ONLY after a server-verified Razorpay signal. There
//   are exactly two such signals:
//     1. the signed Standard Checkout verify callback
//        (app/api/v1/checkout/verify-payment) — the browser-driven happy path;
//     2. THIS webhook — Razorpay's server-to-server `payment.captured` event,
//        the authoritative confirmation that money actually settled.
//
//   A webhook is unauthenticated at the transport layer, so authenticity is
//   established by verifying the `X-Razorpay-Signature` HMAC over the RAW request
//   body (see verifyWebhookSignature in lib/razorpay/server). Any payload that
//   fails verification is rejected with 400 and grants NOTHING.
//
// IDEMPOTENCY
//   Razorpay retries aggressively. Every delivery carries a unique
//   `X-Razorpay-Event-Id`; we reserve it in the `WebhookEvent` table (unique
//   index) so a retry short-circuits with 200 instead of minting a second
//   license. The underlying markRazorpayOrderPaid / grantLicenseForOrder path is
//   independently idempotent, giving defence in depth.

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay/server";
import {
  markRazorpayOrderPaid,
  markWebhookEvent,
  reserveWebhookEvent,
} from "@/lib/payment/orders";

// Node runtime: HMAC verification (node:crypto) and Prisma are server-only.
export const runtime = "nodejs";
// Webhooks must never be statically cached or pre-rendered.
export const dynamic = "force-dynamic";

/** Minimal shape of the Razorpay `payment.captured` payload we rely on. */
interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  email?: string;
  status?: string;
}

/** Minimal shape of the `order.paid` payload's order entity. */
interface RazorpayOrderEntity {
  id?: string;
  amount?: number;
  currency?: string;
  receipt?: string;
  status?: string;
  notes?: Record<string, unknown>;
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: RazorpayOrderEntity };
  };
}

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Verifies the signature, then — for `payment.captured` only — marks the
 * referenced order PAID and grants its license. All other event types are
 * acknowledged and ignored.
 */
export async function POST(req: NextRequest): Promise<Response> {
  // 1. Read the RAW body FIRST. Signature verification must run over the exact
  //    bytes Razorpay signed — re-serialising JSON would change whitespace and
  //    break the HMAC.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[webhooks/razorpay] failed to read request body:", err);
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // 2. Verify authenticity. Fail closed on any problem.
  const signature = req.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature({ rawBody, signature })) {
    console.error("[webhooks/razorpay] rejected webhook with invalid signature.");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  // 3. Parse only after authenticity is established.
  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    console.error("[webhooks/razorpay] verified body was not valid JSON.");
    return NextResponse.json({ ok: false, error: "Malformed payload" }, { status: 400 });
  }

  const eventType = body.event ?? "unknown";
  const payment = body.payload?.payment?.entity ?? {};
  const orderEntity = body.payload?.order?.entity ?? {};

  // Only the two settlement signals grant a license. Any other event type is
  // acknowledged without side effects (a 200 stops Razorpay's retries).
  const SETTLEMENT_EVENTS = new Set(["payment.captured", "order.paid"]);
  if (!SETTLEMENT_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  // Resolve the Razorpay order id from whichever entity this event carries:
  //   - payment.captured → payload.payment.entity.order_id
  //   - order.paid       → payload.order.entity.id
  // Both map to the internal order's `providerTxnId`, so settlement is shared.
  const razorpayOrderId = payment.order_id ?? orderEntity.id;

  // A failed DB connection is handled where it matters: the event reservation
  // below returns a non-2xx so Razorpay RETRIES the capture rather than us
  // silently dropping a paid order. (There is no separate "is DB configured"
  // probe — the codebase maps Prisma failures to 503 at the call site.)

  // Prefer Razorpay's per-delivery event id; fall back to a deterministic
  // composite so idempotency still holds if the header is absent.
  const eventId =
    req.headers.get("x-razorpay-event-id") ??
    `${eventType}:${razorpayOrderId ?? payment.id ?? rawBody.length}`;

  // 5. Idempotency gate — a duplicate delivery exits here.
  let firstDelivery: boolean;
  try {
    firstDelivery = await reserveWebhookEvent({
      provider: "RAZORPAY",
      eventId,
      eventType,
      payload: body,
    });
  } catch (err) {
    console.error("[webhooks/razorpay] failed to reserve event; asking retry:", err);
    return NextResponse.json(
      { ok: false, error: "Temporary failure" },
      { status: 503 }
    );
  }

  if (!firstDelivery) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // 6. Resolve the internal order via the Razorpay order id (stored as
  //    `providerTxnId` at creation). Without it there is nothing to settle.
  if (!razorpayOrderId) {
    await markWebhookEvent(eventId, {
      status: "IGNORED",
      error: `${eventType} payload had no order id`,
    });
    return NextResponse.json({ ok: true, ignored: "missing order_id" });
  }

  // 7. Mark PAID (idempotent) and grant exactly one license. This call also
  //    creates/updates the owning User row and stores the key as ACTIVE, so a
  //    paid order always yields a dashboard-visible key even if the email fails.
  try {
    const grant = await markRazorpayOrderPaid({ providerTxnId: razorpayOrderId });

    await markWebhookEvent(eventId, {
      status: grant ? "PROCESSED" : "IGNORED",
      licenseId: grant?.licenseId ?? null,
      error: grant ? null : `No matching order for ${razorpayOrderId}`,
    });

    // Structured per-transaction log so a future "why didn't my key arrive?"
    // ticket is answered from one grep: Payment ID, customer email, generated
    // Key ID, and whether the delivery email actually went out.
    console.info("[webhooks/razorpay] transaction", {
      event: eventType,
      paymentId: payment.id ?? null,
      orderId: razorpayOrderId,
      email: payment.email ?? null,
      licenseId: grant?.licenseId ?? null,
      emailStatus: grant
        ? grant.emailSent
          ? "SENT"
          : "QUEUED_FOR_RETRY"
        : "NOT_APPLICABLE",
      granted: Boolean(grant),
    });

    return NextResponse.json({
      ok: true,
      granted: Boolean(grant),
      licenseId: grant?.licenseId ?? null,
      // False means the key email could not be dispatched; it is retried by the
      // email-retry cron and is always visible on the customer dashboard.
      emailSent: grant?.emailSent ?? false,
    });
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    console.error("[webhooks/razorpay] transaction failed", {
      event: eventType,
      paymentId: payment.id ?? null,
      orderId: razorpayOrderId,
      email: payment.email ?? null,
      eventId,
      error: message,
    });
    await markWebhookEvent(eventId, { status: "FAILED", error: message });
    // 5xx → Razorpay retries. The event row is already reserved so the retry
    // would be treated as a duplicate; clear it so the retry can re-attempt.
    await prisma.webhookEvent
      .delete({ where: { eventId } })
      .catch((delErr) =>
        console.error(
          "[webhooks/razorpay] could not release event reservation:",
          (delErr as Error)?.message ?? delErr
        )
      );
    return NextResponse.json(
      { ok: false, error: "Processing failed" },
      { status: 500 }
    );
  }
}
