// FRPB — POST /api/v1/checkout
// Cashfree-hosted checkout for the selected plan. Creates a Cashfree order
// server-side, records a PENDING Payment row, and returns the hosted payment URL
// so the customer can complete payment. Webhooks grant the license
// idempotently (see api/v1/webhooks/cashfree + lib/webhooks/processor).
//
// Error stratification:
//   - DB unreachable  → 503 (payment system temporarily unavailable)
//   - gateway config  → 502 (checkout not configured)
//   - gateway error   → 502 (checkout temporarily unavailable)
//   - anything else   → 500 (generic last resort)

import { NextRequest, NextResponse } from "next/server";
import { CheckoutRequestSchema } from "@frpb/shared";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getGatewayForCurrency, providerForCurrency, PaymentConfigError } from "@/lib/payments";
import { getPlanDefinition } from "@/lib/license/constants";
import { upsertPrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { CheckoutResponse } from "@frpb/shared";

// Session + gateway work — never statically prerender this route.
export const dynamic = "force-dynamic";

// CORS preflight for cross-origin callers.
export const OPTIONS = preflight;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in";

const DB_UNAVAILABLE_MESSAGE =
  "We're having trouble reaching our payment system right now. Please try again in a moment.";

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleCheckout(req));
}

async function handleCheckout(req: NextRequest) {
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
  //    surfaces as a 503 instead of a generic 500. Uses the CANONICAL identity
  //    (normalized email + supabaseId) so checkout and the webhook can never
  //    create two rows for one Supabase account.
  let userRecord;
  try {
    userRecord = await upsertPrismaUser(prisma, {
      id: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error("[checkout] DB unreachable while upserting user:", err);
    return NextResponse.json<CheckoutResponse>(
      { success: false, message: DB_UNAVAILABLE_MESSAGE },
      { status: 503 }
    );
  }

  // 4. White-label dual-rail routing — the currency silently selects the
  //    acquirer: INR → Cashfree (UPI/NetBanking/domestic cards), USD →
  //    PayGlocal (international cards). The customer never sees a provider
  //    name. A missing config for the selected rail surfaces as 502.
  const provider = providerForCurrency(currency);
  let checkoutResult;
  try {
    const gateway = getGatewayForCurrency(currency);
    checkoutResult = await gateway.createCheckout({
      planSlug,
      customerEmail: userRecord.email,
      successUrl,
      cancelUrl,
      currency,
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
        // Persist the ACTUAL rail that handled this order (CASHFREE or
        // PAYGLOCAL) for reconciliation, refunds and reporting.
        provider,
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
