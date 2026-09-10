// FRPB — POST /api/v1/webhooks/razorpay
// Receives Razorpay webhooks. Verifies the X-Razorpay-Signature (HMAC-SHA256
// over the raw body) then routes through the idempotent grant engine (§5.3).

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processWebhook } from "@/lib/webhooks/processor";
import { isPlanSlug, type PlanSlug } from "@frpb/shared";

interface RazorpayPaymentCaptured {
  entity: "event";
  account_id: string;
  event: string; // "payment.captured"
  contains: string[];
  payload: {
    payment: {
      entity: {
        id: string; // pay_...
        order_id: string;
        amount: number; // in paise
        currency: string;
        email?: string;
        notes?: Record<string, string>;
        status: string;
      };
    };
  };
}

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (webhookSecret) {
    if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let payload: RazorpayPaymentCaptured;
  try {
    payload = JSON.parse(rawBody) as RazorpayPaymentCaptured;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only the payment.captured event grants a license
  if (payload.event !== "payment.captured") {
    return NextResponse.json({ received: true, ignored: payload.event }, { status: 200 });
  }

  const payment = payload.payload?.payment?.entity;
  if (!payment) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 422 });
  }

  const notes = payment.notes ?? {};
  const planSlugRaw = notes["planSlug"] ?? "";
  const email = payment.email ?? notes["customerEmail"];

  if (!isPlanSlug(planSlugRaw) || !email) {
    return NextResponse.json(
      { error: "Missing planSlug note or customer email" },
      { status: 422 }
    );
  }

  const result = await processWebhook({
    provider: "RAZORPAY",
    eventId: payload.event === "payment.captured" ? `${payload.entity}_${payment.id}` : payload.entity,
    eventType: payload.event,
    payload,
    txnId: payment.id,
    amountCents: payment.amount,
    currency: payment.currency.toUpperCase(),
    customerEmail: email,
    planSlug: planSlugRaw as PlanSlug,
  });

  if (result.outcome === "FAILED") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
}
