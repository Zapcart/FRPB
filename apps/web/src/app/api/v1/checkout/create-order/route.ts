// FRPB — Razorpay order creation endpoint.
//
// POST /api/v1/checkout/create-order
//   body: { planId: string; amount?: number; currency?: string; userEmail?: string }
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway.
// Flow:
//   1. Resolve the DUAL_PLAN from `planId` and LOCK the amount server-side.
//   2. Create a Razorpay order (amount in paise) via the Orders API.
//   3. Persist a PENDING PaymentOrder carrying the Razorpay order id.
//   4. Return { order_id, amount, currency } for the browser checkout modal.

import { NextResponse, type NextRequest } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import { getDualPlan, getDualPlanByOrderId, type DualPlan } from "@/config/plans";
import { getRazorpayClient, RazorpayConfigError } from "@/lib/razorpay/server";
import { createRazorpayOrder, expireStaleOrders } from "@/lib/payment/orders";
import { getOptionalUser } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/user-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Razorpay requires the smallest chargeable amount of 100 paise (₹1). */
const MIN_AMOUNT_PAISE = 100;

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

  // AMOUNT LOCK — always charge the server-resolved INR tier rate, never the
  // client-supplied value. `amount` is accepted only for a mismatch check.
  const amountInPaise = Math.round(plan.inr * 100);
  if (amountInPaise < MIN_AMOUNT_PAISE) {
    return NextResponse.json(
      { success: false, error: "The chargeable amount must be at least 100 paise." },
      { status: 400 }
    );
  }

  // Resolve the customer email — explicit body value first, then the Supabase
  // session. Required so the license can be issued and emailed on success.
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
  if (!email) {
    return NextResponse.json(
      { success: false, error: "An email address is required to issue your license." },
      { status: 400 }
    );
  }
  email = normalizeEmail(email);

  // Razorpay orders create call.
  let razorpayOrderId: string;
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
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
    amount: amountInPaise,
    currency: "INR",
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
