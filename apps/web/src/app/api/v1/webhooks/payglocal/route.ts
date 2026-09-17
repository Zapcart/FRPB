// FRPB — POST /api/v1/webhooks/payglocal
// Receives PayGlocal (international / USD card) webhooks. Verifies the
// signature with PAYGLOCAL_MERCHANT_SECRET (HMAC-SHA256 over the raw body),
// then routes through the idempotent grant engine (§5.3). Only a successful
// payment grants a license.
//
// White-label note: this route is internal plumbing only. Nothing here is ever
// surfaced to the customer.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processWebhook } from "@/lib/webhooks/processor";
import {
  WebhookSecretConfigError,
  requireWebhookSecret,
} from "@/lib/payments/webhook-secrets";
import { isPlanSlug, type PlanSlug } from "@frpb/shared";

interface PayGlocalWebhook {
  /** PayGlocal uses several field spellings across API versions. */
  event?: string;
  eventType?: string;
  type?: string;
  data?: {
    order?: {
      orderId?: string;
      order_id?: string;
      merchantTxnId?: string;
      amount?: number | string;
      currency?: string;
      metadata?: Record<string, string> | null;
      tags?: Record<string, string> | null;
    };
    payment?: {
      paymentId?: string;
      payment_id?: string;
      paymentStatus?: string;
      payment_status?: string;
      amount?: number | string;
      currency?: string;
    };
    customerEmail?: string;
    customer_email?: string;
  };
  // Some API versions put the reference fields at the top level.
  merchantTxnId?: string;
  orderId?: string;
  order_id?: string;
  status?: string;
}

// Resolved per-request via requireWebhookSecret() so a production
// misconfiguration fails this route loudly instead of silently accepting
// unauthenticated payment events.

/** Timing-safe comparison of two signature strings. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * PayGlocal signs with HMAC-SHA256(secret, rawBody), hex by default and
 * base64 on some versions — accept either so a version bump cannot silently
 * break verification.
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const b64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(hex, signature) || safeEqual(b64, signature);
}

const SUCCESS_EVENTS = new Set([
  "PAYMENT_SUCCESS",
  "PAYMENT_SUCCESS_WEBHOOK",
  "ORDER_PAID",
  "payment.success",
]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-payglocal-signature") ??
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-signature");

  // The secret is MANDATORY in production — a missing one is a fatal config
  // error, never a reason to skip verification.
  let webhookSecret: string;
  try {
    webhookSecret = requireWebhookSecret("PAYGLOCAL");
  } catch (err) {
    if (err instanceof WebhookSecretConfigError) {
      console.error("[webhooks/payglocal] configuration error:", err.message);
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    throw err;
  }

  // Verification runs whenever a secret exists. In development without one, the
  // dev-only warning was already emitted by requireWebhookSecret().
  if (webhookSecret) {
    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature header" }, { status: 400 });
    }
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let payload: PayGlocalWebhook;
  try {
    payload = JSON.parse(rawBody) as PayGlocalWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = payload.eventType ?? payload.event ?? payload.type ?? "";
  const status = payload.data?.payment?.paymentStatus ?? payload.data?.payment?.payment_status ?? "";
  if (!SUCCESS_EVENTS.has(eventType) && status.toLowerCase() !== "success") {
    return NextResponse.json(
      { received: true, ignored: eventType || status || "unknown" },
      { status: 200 }
    );
  }

  const order = payload.data?.order;
  const payment = payload.data?.payment;
  // The provider txn id must match the PENDING Payment row created at checkout.
  const txnId =
    order?.orderId ??
    order?.order_id ??
    order?.merchantTxnId ??
    payload.merchantTxnId ??
    payload.orderId ??
    payload.order_id;
  if (!txnId || !payment) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 422 });
  }

  // Plan comes back through the metadata/tags we set at order creation.
  const planSlugRaw =
    order?.metadata?.["planSlug"] ?? order?.tags?.["planSlug"] ?? "";
  const email = payload.data?.customerEmail ?? payload.data?.customer_email;
  if (!isPlanSlug(planSlugRaw) || !email) {
    return NextResponse.json(
      { error: "Missing planSlug or customer email" },
      { status: 422 }
    );
  }

  // PayGlocal reports a MAJOR-unit decimal amount; convert to minor units.
  const rawAmount = payment.amount ?? order?.amount ?? 0;
  const major = typeof rawAmount === "string" ? Number.parseFloat(rawAmount) : rawAmount;
  const amountCents = Number.isFinite(major) ? Math.round(major * 100) : 0;
  const currency = (
    payment.currency ??
    order?.currency ??
    "USD"
  ).toUpperCase();

  const paymentId = payment.paymentId ?? payment.payment_id ?? txnId;

  const result = await processWebhook({
    provider: "PAYGLOCAL",
    eventId: `pg_${paymentId}`,
    eventType: eventType || "PAYMENT_SUCCESS",
    payload,
    txnId,
    amountCents,
    currency,
    customerEmail: email,
    planSlug: planSlugRaw as PlanSlug,
  });

  if (result.outcome === "FAILED") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
}
