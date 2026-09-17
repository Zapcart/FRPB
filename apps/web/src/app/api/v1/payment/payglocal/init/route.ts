// FRPB — POST /api/v1/payment/payglocal/init
//
// Initialises the PayGlocal (international USD card) rail for the selected plan
// and returns the provider-hosted checkout URL to redirect to.
//
// Flow:
//   1. Resolve the plan's USD tier rate from config/plans.ts ($20 / $50 / $100).
//      The client NEVER supplies an amount — the strict amount lock is enforced
//      here and again inside the adapter.
//   2. Create a PENDING PaymentOrder (provider=PAYGLOCAL, currency=USD) so the
//      unified callback can reconcile the provider reference back to an order.
//   3. Ask PayGlocal for a hosted session, stamping our order reference as the
//      merchant txn id so the webhook/callback can find the same row.
//   4. Return the checkout URL for the browser to navigate to.
//
// Environment (either naming scheme works — see lib/payments/payglocal-env.ts):
//   PAYGLOCAL_MERCHANT_ID
//   PAYGLOCAL_API_KEY  (or PAYGLOCAL_MERCHANT_KEY)
//   PAYGLOCAL_BASE_URL (or PAYGLOCAL_API_BASE)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { createClient } from "@/lib/supabase/server";
import { upsertPrismaUser } from "@/lib/auth/user-identity";
import { getDualPlan } from "@/config/plans";
import {
  attachPayGlocalTxn,
  createPayGlocalOrder,
  expireStaleOrders,
} from "@/lib/payment/orders";
import { PayGlocalGateway } from "@/lib/payments/payglocal";
import {
  PayGlocalConfigError,
  resolvePayGlocalConfig,
  type PayGlocalConfig,
} from "@/lib/payments/payglocal-env";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in";

const InitSchema = z.object({
  planSlug: z.string().min(1).max(32),
  userEmail: z.string().email().max(160).optional(),
});

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleInit(req));
}

async function handleInit(req: NextRequest) {
  // 1. Validate the payload — note there is deliberately no `amount` field.
  let parsed: z.infer<typeof InitSchema>;
  try {
    parsed = InitSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Invalid request", detail: (err as Error).message },
      { status: 400 }
    );
  }

  // 2. STRICT AMOUNT LOCK — resolve the plan (and therefore the USD price) from
  //    the backend configuration. An unknown slug is rejected outright.
  const plan = getDualPlan(parsed.planSlug);
  if (!plan) {
    return NextResponse.json(
      { success: false, message: `Unknown plan: ${parsed.planSlug}` },
      { status: 400 }
    );
  }

  // 3. Resolve the buyer email — prefer the authenticated Supabase session.
  let email = parsed.userEmail ?? null;
  let userId: string | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      email = user.email;
      const record = await upsertPrismaUser(prisma, { id: user.id, email: user.email });
      userId = record.id;
    }
  } catch {
    // Anonymous purchase allowed; the license is bound by email at grant.
  }
  if (!email) {
    return NextResponse.json(
      { success: false, message: "An email address is required to receive your license." },
      { status: 400 }
    );
  }

  // 4. FAIL FAST on configuration — resolve the credentials BEFORE touching the
  //    database so an unconfigured rail never creates an orphan PENDING order
  //    (and reports 502 config rather than a misleading 503 DB error).
  let config: PayGlocalConfig;
  try {
    config = resolvePayGlocalConfig();
  } catch (err) {
    console.error("[payment/payglocal/init] config error:", (err as Error).message);
    return NextResponse.json(
      { success: false, message: "Card payment is not configured yet. Please use UPI." },
      { status: 502 }
    );
  }

  // 5. Housekeeping — retire stale PENDING orders.
  void expireStaleOrders();

  // 6. Persist a PENDING USD order so the callback can reconcile the payment.
  let orderId: string;
  try {
    const created = await createPayGlocalOrder({
      planSlug: plan.slug,
      email,
      userId,
    });
    orderId = created.orderId;
  } catch (err) {
    console.error("[payment/payglocal/init] DB error:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't create your order right now. Please retry." },
      { status: 503 }
    );
  }

  // 7. Build the gateway + hosted session. Our order id is the merchant txn id.
  try {
    const gateway = new PayGlocalGateway(config.merchantId, config.apiKey, config.secret);

    const result = await gateway.createCheckout({
      planSlug: plan.slug,
      customerEmail: email,
      // The unified callback renders the success page; the hosted page returns
      // here on completion.
      successUrl: `${APP_URL}/api/v1/payment/callback?provider=payglocal&orderId=${orderId}`,
      cancelUrl: `${APP_URL}/pricing?checkout=cancelled`,
      currency: "USD",
      // Explicit tier rate from config/plans.ts ($20 / $50 / $100).
      amountMajor: plan.usd,
      orderRef: orderId,
    });

    // Bind the provider reference so the webhook can find this order.
    try {
      await attachPayGlocalTxn(orderId, result.providerTxnId);
    } catch {
      // A collision means the txn already belongs to another order — fail closed
      // rather than handing the customer a checkout we cannot reconcile.
      return NextResponse.json(
        { success: false, message: "This payment session is already in use. Please retry." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        orderId,
        planSlug: plan.slug,
        amount: plan.usd,
        currency: "USD",
        checkoutUrl: result.checkoutUrl,
        providerTxnId: result.providerTxnId,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof PayGlocalConfigError) {
      console.error("[payment/payglocal/init] config error:", err.message);
      return NextResponse.json(
        { success: false, message: "Card payment is not configured yet. Please use UPI." },
        { status: 502 }
      );
    }
    console.error("[payment/payglocal/init] gateway error:", err);
    return NextResponse.json(
      { success: false, message: "Card payment is temporarily unavailable. Please try UPI." },
      { status: 502 }
    );
  }
}
