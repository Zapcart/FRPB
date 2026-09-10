// FRPB — POST /api/v1/webhooks/stripe
// Receives Stripe webhook events. Verifies the signature with the raw body,
// then routes through the idempotent grant engine (§5.3).

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { processWebhook } from "@/lib/webhooks/processor";
import type { PlanSlug } from "@frpb/shared";
import { isPlanSlug } from "@frpb/shared";

// Skip signature verification when running without a secret (local/dev).
const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  // 1. Signature verification
  if (stripeSecret) {
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-06-20",
    });
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, stripeSecret);
    } catch (err) {
      return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
    }

    // 2. Handle relevant event types (ignore everything else)
    const handled = await handleEvent(event);
    return handled;
  }

  // Dev mode — no secret configured: parse JSON loosely for local testing.
  try {
    const event = JSON.parse(rawBody) as Stripe.Event;
    return await handleEvent(event);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<NextResponse> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email ?? session.metadata?.customerEmail;
      const planSlugRaw = session.metadata?.planSlug;
      if (!email || !planSlugRaw || !isPlanSlug(planSlugRaw)) {
        return NextResponse.json({ error: "Missing email/planSlug metadata" }, { status: 422 });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      const amountTotal = session.amount_total ?? 0;
      const currency = (session.currency ?? "usd").toUpperCase();

      const result = await processWebhook({
        provider: "STRIPE",
        eventId: event.id,
        eventType: event.type,
        payload: event,
        txnId: paymentIntentId ?? session.id,
        amountCents: amountTotal,
        currency,
        customerEmail: email,
        planSlug: planSlugRaw as PlanSlug,
      });

      if (result.outcome === "FAILED") {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
    }

    // payment_intent.succeeded is the source of truth for the license grant;
    // checkout.session.completed fires earlier but is less reliable.
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const metadata = pi.metadata;
      const planSlugRaw = metadata?.planSlug;
      if (!planSlugRaw || !isPlanSlug(planSlugRaw)) {
        return NextResponse.json({ error: "Missing planSlug metadata" }, { status: 422 });
      }
      const email = metadata?.customerEmail ?? pi.receipt_email;
      if (!email) {
        return NextResponse.json({ error: "Missing customer email" }, { status: 422 });
      }

      const result = await processWebhook({
        provider: "STRIPE",
        eventId: event.id,
        eventType: event.type,
        payload: event,
        txnId: pi.id,
        amountCents: pi.amount,
        currency: (pi.currency ?? "usd").toUpperCase(),
        customerEmail: email,
        planSlug: planSlugRaw as PlanSlug,
      });

      if (result.outcome === "FAILED") {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
    }

    default:
      // Acknowledge + ignore (charge.succeeded, invoice.*, etc.)
      return NextResponse.json({ received: true, ignored: event.type }, { status: 200 });
  }
}
