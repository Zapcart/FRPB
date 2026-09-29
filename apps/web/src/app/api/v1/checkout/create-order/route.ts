// FRPB — Razorpay order creation endpoint.
//
// POST /api/v1/checkout/create-order
//   body: { planId: string; amount?: number; currency?: string; userEmail?: string;
//           referralCode?: string }
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway.
// The storefront charges in USD only, so the currency is hardcoded here — never
// taken from the client payload.
// Flow:
//   1. Resolve the DUAL_PLAN from `planId` and LOCK the amount server-side to
//      the USD tier rate in cents ($20 → 2000, $150 → 15000). A referral code
//      sanctions 20% off Lifetime ($120) and a downsell intent sanctions the
//      50% partial-credit Lifetime price ($75) — both resolved server-side.
//   2. Create a Razorpay order via the Orders API in USD.
//   3. Persist a PENDING PaymentOrder carrying the Razorpay order id.
//   4. Return { order_id, amount, currency } for the browser checkout modal.

import { NextResponse, type NextRequest } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import {
  getDualPlan,
  getDualPlanByOrderId,
  isSanctionedUsdAmount,
  razorpayAmount,
  type DualCurrency,
  type DualPlan,
} from "@/config/plans";
import { getRazorpayClient, RazorpayConfigError } from "@/lib/razorpay/server";
import { createRazorpayOrder, expireStaleOrders } from "@/lib/payment/orders";
import { getOptionalUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, resolvePrismaUser } from "@/lib/auth/user-identity";
import {
  discountedPriceCents,
  downsellPriceCents,
  type ReferralPlanId,
} from "@/lib/referral/config";
import {
  isDownsellEligible,
  resolveActiveReferralCode,
  sanitizeReferralCodeInput,
} from "@/lib/referral/service";

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
  /** Redeemed referral code — grants the sanctioned 20% Lifetime discount. */
  referralCode?: unknown;
  /** Downsell intent — charge the sanctioned 50% partial-credit Lifetime price. */
  downsell?: unknown;
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

  // Resolve the Supabase session ONCE — reused for the customer email and the
  // internal Prisma user id (referral attribution + self-referral guard).
  let sessionUser: Awaited<ReturnType<typeof getOptionalUser>> = null;
  try {
    sessionUser = await getOptionalUser();
  } catch (err) {
    console.warn(
      "[checkout/create-order] session lookup failed:",
      (err as Error)?.message ?? err
    );
  }

  // Resolve the customer email — explicit body value first, then the session.
  // Checkout is gated behind authentication upstream, so a signed-in buyer
  // always carries an email here and the license can be issued + emailed.
  let email = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  if (!email) {
    email = sessionUser?.email?.trim() ?? "";
  }
  email = normalizeEmail(email);

  // Resolve the internal Prisma user id for referral attribution. Null when the
  // buyer has no Prisma row yet (first purchase) — the referral is still captured
  // by code and the self-referral guard runs again at settlement.
  let userId: string | null = null;
  if (sessionUser) {
    try {
      const prismaUser = await resolvePrismaUser(prisma, {
        id: sessionUser.id,
        email: sessionUser.email,
      });
      userId = prismaUser?.id ?? null;
    } catch (err) {
      console.warn(
        "[checkout/create-order] prisma user resolution failed:",
        (err as Error)?.message ?? err
      );
    }
  }

  // REFERRAL DISCOUNT — an invited friend gets 20% OFF the Lifetime plan
  // ($150 → $120). Monthly is intentionally 0% to protect MRR. The discounted
  // price is computed SERVER-SIDE and re-validated through the sanctioned-amount
  // lock; an unknown/inactive code silently falls back to the tier rate so a bad
  // code can never block (or under-charge) a legitimate purchase.
  const referralCode = sanitizeReferralCodeInput(body.referralCode);
  let chargeSubUnits = amountSubUnits;
  let appliedReferralCode: string | null = null;
  let downsellApplied = false;
  if (referralCode) {
    const resolved = await resolveActiveReferralCode(referralCode);
    if (resolved) {
      const referralPlanId: ReferralPlanId =
        plan.slug === "LIFETIME" ? "LIFETIME" : "MONTH_1";
      const discountedCents = discountedPriceCents(referralPlanId);
      // Both values are in gateway subunits (cents); the sanctioned lock is
      // expressed in whole USD, so convert before validating.
      if (
        discountedCents > 0 &&
        discountedCents < chargeSubUnits &&
        isSanctionedUsdAmount(Math.round(discountedCents / 100))
      ) {
        chargeSubUnits = discountedCents;
        appliedReferralCode = resolved.code;
      }
    }
  }

  // DOWNSELL — the sanctioned 50% partial-credit Lifetime price ($75), offered
  // ONLY to an eligible user (signed in, not yet unlocked, sitting at exactly
  // 1/2 Lifetime qualified referrals). The amount is resolved SERVER-SIDE and
  // re-checked against the sanctioned set, AND eligibility is re-proven from
  // the DB, so a client can never self-select the cheaper price. Applied last so
  // it wins over the referral discount (it is the cheapest sanctioned price),
  // matching the "partial credit" offer the UI presents.
  if (body.downsell === true && plan.slug === "LIFETIME" && userId) {
    const downsellCents = downsellPriceCents();
    if (
      downsellCents > 0 &&
      downsellCents < chargeSubUnits &&
      isSanctionedUsdAmount(Math.round(downsellCents / 100)) &&
      (await isDownsellEligible(userId))
    ) {
      chargeSubUnits = downsellCents;
      downsellApplied = true;
    }
  }

  // Razorpay orders create call.
  let razorpayOrderId: string;
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: chargeSubUnits,
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planSlug: plan.slug,
        ...(appliedReferralCode ? { referralCode: appliedReferralCode } : {}),
        ...(downsellApplied ? { downsell: "true" } : {}),
      },
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
      userId,
      providerTxnId: razorpayOrderId,
      currency,
      // Whole major units — re-validated against the sanctioned set inside the
      // helper, so a buggy caller can never persist an arbitrary charge amount.
      amount: Math.round(chargeSubUnits / 100),
      referralCode: appliedReferralCode,
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
    amount: chargeSubUnits,
    currency,
    planId: plan.slug,
    referralApplied: Boolean(appliedReferralCode),
    downsellApplied,
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
