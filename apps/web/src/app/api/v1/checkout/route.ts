// FRPB — POST /api/v1/checkout
// Hosted checkout hand-off for the USD (international card) rail.
//
// RAIL ROUTING:
//   • INR → NOT served here. INR settles through the SELF-HOSTED Direct UPI
//     engine (api/v1/payment/create + /checkout/upi). A request for INR is
//     answered with an explicit `checkoutUrl` pointing at that flow rather than
//     an error, so a stale client cannot dead-end.
//   • USD → PayGlocal hosted order; a PENDING Payment row is recorded and the
//     hosted URL is returned. Webhooks grant the licence idempotently (see
//     api/v1/webhooks/payglocal + lib/webhooks/processor).
//
// Cashfree has been removed entirely; it is no longer a valid rail.
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
  // 1. Validate body
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

  // 2. ── INR → the self-hosted Direct UPI rail ─────────────────────────────
  // INR has no hosted gateway any more, and it is NOT gated behind sign-in here:
  // the Direct-UPI flow (api/v1/payment/create + /checkout/upi) establishes the
  // buyer identity itself. Hand back the Direct-UPI checkout URL so a client
  // that still calls this endpoint for INR is routed to the working flow rather
  // than dead-ending on a 401.
  if (currency === "INR") {
    return NextResponse.json<CheckoutResponse>(
      {
        success: true,
        checkoutUrl: `${APP_URL}/checkout/upi?plan=${encodeURIComponent(planSlug)}`,
        message: "INR settles through the self-hosted Direct UPI engine.",
      },
      { status: 200 }
    );
  }

  // 3. Auth — the USD card rail requires a signed-in user (the license is bound
  //    to the account). getUser() validates the JWT against Supabase on every
  //    request, so a stale/expired cookie can never slip through as a valid
  //    session.
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

  const plan = getPlanDefinition(planSlug);
  // Gateway success return → the dashboard, which renders the post-payment
  // confirmation and the "Your Active Licenses" card (the webhook has already
  // granted the license and triggered the delivery email by this point).
  const successUrl = parsed.data.successUrl ?? `${APP_URL}/dashboard?success=true`;
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

  // 4. White-label routing — this endpoint now serves ONLY the USD card rail.
  //    INR was handled above (returned before reaching here). `provider` is
  //    therefore always PAYGLOCAL; it is kept typed as nullable so the compiler
  //    forces the check below. A missing config surfaces as 502.
  const provider = providerForCurrency(currency);
  if (!provider) {
    return NextResponse.json<CheckoutResponse>(
      {
        success: false,
        message: "This currency is not available on the card rail. Please use UPI.",
      },
      { status: 400 }
    );
  }
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
        // Persist the ACTUAL rail that handled this order (PAYGLOCAL) for
        // reconciliation, refunds and reporting.
        provider,
        providerTxnId: checkoutResult.providerTxnId,
        // This rail is USD-only; the amount is the plan's USD minor units.
        amountCents: plan.priceCents,
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
