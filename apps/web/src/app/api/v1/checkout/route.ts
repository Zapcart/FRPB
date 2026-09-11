// FRPB — POST /api/v1/checkout
// Creates a Stripe Checkout Session or Razorpay Order for the selected plan.
// Logs a PENDING Payment row so webhooks can upsert idempotently.
//
// Error stratification (blueprint fix 6):
//   - DB unreachable  → 503 (payment system temporarily unavailable)
//   - gateway config  → 502 (checkout not configured)
//   - provider error  → 502 (checkout temporarily unavailable)
//   - anything else   → 500 (generic last resort)

import { NextRequest, NextResponse } from "next/server";
import { CheckoutRequestSchema } from "@frpb/shared";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway, PaymentConfigError } from "@/lib/payments";
import { getPlanDefinition } from "@/lib/license/constants";
import type { CheckoutResponse } from "@frpb/shared";

// Session + gateway work — never statically prerender this route.
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in";

const DB_UNAVAILABLE_MESSAGE =
  "We're having trouble reaching our payment system right now. Please try again in a moment.";

export async function POST(req: NextRequest) {
  // 1. Auth — checkout requires a signed-in user (license is bound to the account).
  //    getUser() validates the JWT against Supabase on every request, so a
  //    stale/expired cookie can never slip through as a valid session.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: "Please sign in to purchase" },
      { status: 401 }
    );
  }

  // 2. Validate body
  let parsed;
  try {
    parsed = CheckoutRequestSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!parsed.success) {
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { planSlug, currency } = parsed.data;
  const plan = getPlanDefinition(planSlug);
  const successUrl = parsed.data.successUrl ?? `${APP_URL}/dashboard?checkout=success`;
  const cancelUrl = parsed.data.cancelUrl ?? `${APP_URL}/pricing?checkout=cancelled`;

  // 3. Upsert User (payments FK to User.id) — isolated so a DB outage
  //    surfaces as a 503 instead of a generic 500.
  let userRecord;
  try {
    userRecord = await prisma.user.upsert({
      where: { email: user.email },
      update: { supabaseId: user.id },
      create: { email: user.email, supabaseId: user.id },
    });
  } catch (err) {
    console.error("[checkout] DB unreachable while upserting user:", err);
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }

  // 4. Create the gateway session/order — Cashfree is the default gateway.
  //    If Cashfree is not configured, surface as 502.
  let checkoutResult;
  try {
    const gateway = getPaymentGateway("CASHFREE");
    checkoutResult = await gateway.createCheckout({
      planSlug,
      customerEmail: userRecord.email,
      successUrl,
      cancelUrl,
    });
  } catch (err) {
    console.error("[checkout] payment gateway failed:", err);
    const isConfigError = err instanceof PaymentConfigError;
    return NextResponse.json<CheckoutResponse>(
      {
        success: false,
        message: isConfigError
          ? "Checkout is not configured yet. Please try again later."
          : "Checkout is temporarily unavailable. Please try again shortly.",
      },
      { status: 502 }
    );
  }

  // 5. Record PENDING payment for idempotent webhook reconciliation
  try {
    await prisma.payment.create({
      data: {
        userId: userRecord.id,
        provider: "CASHFREE",
        providerTxnId: checkoutResult.providerTxnId,
        amountCents: currency === "INR" ? plan.priceInr : plan.priceCents,
        currency: currency,
        status: "PENDING",
        planSlug,
      },
    });
  } catch (err) {
    console.error("[checkout] DB unreachable while recording payment:", err);
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }

  return NextResponse.json<CheckoutResponse>(
    { success: true, checkoutUrl: checkoutResult.checkoutUrl },
    { status: 200 }
  );
}
