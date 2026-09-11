// FRPB — POST /api/v1/webhooks/cashfree
// Receives Cashfree webhooks. Verifies the x-webhook-signature (HMAC-SHA256,
// base64, over `timestamp + rawBody`) then routes through the idempotent grant
// engine (§5.3). Only PAYMENT_SUCCESS_WEBHOOK grants a license.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processWebhook } from "@/lib/webhooks/processor";
import { isPlanSlug, type PlanSlug } from "@frpb/shared";

interface CashfreeWebhook {
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
      order_tags?: Record<string, string> | null;
    };
    payment?: {
      cf_payment_id?: number | string;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
    };
    customer_details?: {
      customer_email?: string;
    };
  };
  event_time?: string;
  type?: string; // e.g. "PAYMENT_SUCCESS_WEBHOOK"
}

const webhookSecret = process.env.CASHFREE_CLIENT_SECRET;

/**
 * Cashfree signs webhooks as HMAC-SHA256(clientSecret, `${timestamp}${rawBody}`),
 * base64-encoded, delivered in `x-webhook-signature` + `x-webhook-timestamp`.
 */
function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  // Verification is enforced whenever the secret is configured.
  if (webhookSecret) {
    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing webhook signature headers" },
        { status: 400 }
      );
    }
    if (!verifySignature(rawBody, timestamp, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let payload: CashfreeWebhook;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only a successful payment grants a license.
  if (payload.type !== "PAYMENT_SUCCESS_WEBHOOK") {
    return NextResponse.json(
      { received: true, ignored: payload.type ?? "unknown" },
      { status: 200 }
    );
  }

  const order = payload.data?.order;
  const payment = payload.data?.payment;
  if (!order?.order_id || !payment) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 422 });
  }

  const planSlugRaw = order.order_tags?.["planSlug"] ?? "";
  const email = payload.data?.customer_details?.customer_email;

  if (!isPlanSlug(planSlugRaw) || !email) {
    return NextResponse.json(
      { error: "Missing planSlug tag or customer email" },
      { status: 422 }
    );
  }

  const amount = payment.payment_amount ?? order.order_amount ?? 0;
  const currency = (payment.payment_currency ?? order.order_currency ?? "INR").toUpperCase();

  const result = await processWebhook({
    provider: "CASHFREE",
    eventId: `cf_${payment.cf_payment_id ?? order.order_id}`,
    eventType: payload.type,
    payload,
    txnId: order.order_id,
    amountCents: amount,
    currency,
    customerEmail: email,
    planSlug: planSlugRaw as PlanSlug,
  });

  if (result.outcome === "FAILED") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
}
