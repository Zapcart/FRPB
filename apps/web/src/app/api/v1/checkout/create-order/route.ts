// FRPB — Razorpay order creation endpoint.
//
// POST /api/v1/checkout/create-order
//   body: { planId: string; amount?: number; currency?: string; userEmail?: string }
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway.
// The storefront charges in USD only, so the currency is hardcoded here — never
// taken from the client payload.
// Flow:
//   1. Resolve the DUAL_PLAN from `planId` and LOCK the amount server-side to
//      the USD tier rate in cents ($20 → 2000, $150 → 15000).
//   2. Create a Razorpay order via the Orders API in USD.
//   3. Persist a PENDING PaymentOrder carrying the Razorpay order id.
//   4. Return { order_id, amount, currency } for the browser checkout modal.

import { NextResponse, type NextRequest } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import {
  getDualPlan,
  getDualPlanByOrderId,
  razorpayAmount,
  type DualCurrency,
  type DualPlan,
} from "@/config/plans";
import { getRazorpayClient, RazorpayConfigError } from "@/lib/razorpay/server";
import { createRazorpayOrder, expireStaleOrders } from "@/lib/payment/orders";
import { getOptionalUser } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/user-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Razorpay requires the smallest chargeable amount of 100 cents ($1 in USD). */
const MIN_AMOUNT_UNITS = 100;

const DB_UNAVAILABLE_MESSAGE =
  "We could not start your checkout because our database is temporarily unavailable. Please try again in a moment.";

const UNHANDLED_MESSAGE =
  "We could not start your checkout right now. Please try again in a moment.";

interface CreateOrderBody {
  planId?: unknown;
  amount?: unknown;
  currency?: unknown;
  userEmail?: unknown;
}

/** Resolve a submitted plan id (either a shared slug or an order plan id). */
function resolvePlan(planId: string): DualPlan | null {
  return getDualPlan(planId) ?? getDualPlanByOrderId(planId);
}

function prismaHint(code: string | undefined): string | null {
  switch (code) {
    case "P1000":
    case "P1001":
    case "P1002":
    case "P1003":
    case "P1017":
      return "The application could not reach the database.";
    case "P2021":
    case "P2022":
      return "The database schema is out of date.";
    default:
      return null;
  }
}

async function readBody(req: NextRequest): Promise<CreateOrderBody> {
  try {
    return (await req.json()) as CreateOrderBody;
  } catch {
    return {};
  }
}

async function handleCreateOrder(req: NextRequest): Promise<Response> {
  const body = await readBody(req);

  const rawPlanId = typeof body.planId === "string" ? body.planId.trim() : "";
  if (!rawPlanId) {
    return NextResponse.json(
      { success: false, error: "A planId is required." },
      { status: 400 }
    );
  }

  const plan = resolvePlan(rawPlanId);
  if (!plan) {
    return NextResponse.json(
      { success: false, error: `Unknown plan: ${rawPlanId}` },
      { status: 400 }
    );
  }

  // CURRENCY — the storefront charges in USD only. Hardcoded server-side rather
  // than trusted from the client payload.
  const currency: DualCurrency = "USD";

  // AMOUNT LOCK — always charge the server-resolved tier rate in USD cents
  // ($20 → 2000, $150 → 15000), never a client-supplied value.
  const amountSubUnits = razorpayAmount(plan, currency);
  if (amountSubUnits < MIN_AMOUNT_UNITS) {
    return NextResponse.json(
      { success: false, error: "The chargeable amount is below the gateway minimum." },
      { status: 400 }
    );
  }

  // Resolve the customer email — explicit body value first, then the Supabase
  // session. Checkout is gated behind authentication upstream, so a signed-in
  // buyer always carries an email here and the license can be issued + emailed.
  let email = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  if (!email) {
    try {
      const user = await getOptionalUser();
      email = user?.email?.trim() ?? "";
    } catch (err) {
      console.warn(
        "[checkout/create-order] session lookup failed:",
        (err as Error)?.message ?? err
      );
    }
  }
  email = normalizeEmail(email);

  // Razorpay orders create call.
  let razorpayOrderId: string;
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountSubUnits,
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: { planSlug: plan.slug },
    });
    razorpayOrderId = order.id;
  } catch (err) {
    if (err instanceof RazorpayConfigError) {
      console.error("[checkout/create-order] missing Razorpay configuration:", err.message);
      return NextResponse.json(
        { success: false, error: "Checkout is not configured yet. Please try again later." },
        { status: 503 }
      );
    }
    console.error(
      "[checkout/create-order] Razorpay Orders API failed:",
      (err as Error)?.message ?? err
    );
    return NextResponse.json(
      { success: false, error: "The payment gateway could not create an order." },
      { status: 502 }
    );
  }

  // Persist the PENDING order against the internal order id.
  try {
    await expireStaleOrders();
    await createRazorpayOrder({
      planSlug: plan.slug,
      email,
      providerTxnId: razorpayOrderId,
      currency,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    console.error(
      "[checkout/create-order] failed to persist pending order:",
      code ?? "",
      (err as Error)?.message ?? err
    );
    return NextResponse.json(
      {
        success: false,
        code: "DB_UNAVAILABLE",
        error: prismaHint(code) ?? DB_UNAVAILABLE_MESSAGE,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    order_id: razorpayOrderId,
    amount: amountSubUnits,
    currency,
    planId: plan.slug,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await withCorsResponse(await handleCreateOrder(req));
  } catch (err) {
    console.error(
      "[checkout/create-order] unhandled error:",
      (err as Error)?.message ?? err
    );
    return withCorsResponse(
      NextResponse.json(
        { success: false, error: UNHANDLED_MESSAGE },
        { status: 500 }
      )
    );
  }
}

export const OPTIONS = preflight;
