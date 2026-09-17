// FRPB — POST /api/v1/payment/create
//
// Creates a DIRECT UPI payment order (self-hosted, zero-MDR) and returns the
// standard NPCI UPI URI + native intent URLs for the checkout page to render.
//
// Security:
//   - The amount is ALWAYS resolved from UPI_PLANS server-side. Any `amount`
//     present in the client payload is ignored entirely — a tampered body can
//     never under-pay.
//   - The order is persisted as PENDING with a hard 10-minute expiry.
//   - The customer email comes from the authenticated session when available,
//     otherwise from the (validated) request body.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { createClient } from "@/lib/supabase/server";
import { upsertPrismaUser } from "@/lib/auth/user-identity";
import {
  UPI_PLANS,
  UPI_MERCHANT_NAME,
  UPI_MERCHANT_VPA,
  generateUpiIntentUrls,
  generateUpiUri,
  getUpiPlan,
} from "@/lib/upi";
import {
  expireStaleOrders,
  generateOrderId,
  orderExpiry,
  planNameFor,
} from "@/lib/payment/orders";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const CreateSchema = z.object({
  planId: z.string().min(1).max(32),
  userEmail: z.string().email().max(160).optional(),
});

export async function POST(req: NextRequest) {
  return withCorsResponse(await handleCreate(req));
}

async function handleCreate(req: NextRequest) {
  // 1. Validate the request body. `amount` is deliberately NOT part of the
  //    schema — accepting it at all would invite a tampered payload.
  let parsed: z.infer<typeof CreateSchema>;
  try {
    parsed = CreateSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Invalid request", detail: (err as Error).message },
      { status: 400 }
    );
  }

  // 2. STRICT AMOUNT LOCK — resolve the plan (and therefore the price) from the
  //    backend table. An unknown planId is simply rejected.
  const plan = getUpiPlan(parsed.planId);
  if (!plan) {
    return NextResponse.json(
      {
        success: false,
        message: `Unknown plan. Valid plans: ${UPI_PLANS.map((p) => p.planId).join(", ")}`,
      },
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
    // Anonymous purchase is allowed; the license is bound by email at grant.
  }

  if (!email) {
    return NextResponse.json(
      { success: false, message: "An email address is required to receive your license." },
      { status: 400 }
    );
  }

  // 4. Housekeeping — retire stale PENDING orders so the table self-heals.
  void expireStaleOrders();

  // 5. Persist the order as PENDING with a 10-minute expiry.
  const orderId = generateOrderId();
  const expiresAt = orderExpiry();

  let order;
  try {
    order = await prisma.paymentOrder.create({
      data: {
        orderId,
        userId,
        email,
        planId: plan.planSlug,
        // Persisted from the SERVER-resolved plan, never from the client.
        amount: plan.amount,
        status: "PENDING",
        expiresAt,
      },
    });
  } catch (err) {
    console.error("[payment/create] DB error:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't create your order right now. Please retry." },
      { status: 503 }
    );
  }

  // 6. Build the UPI URI + native intent URLs.
  const upiUri = generateUpiUri({
    orderId: order.orderId,
    planId: plan.planId,
    amount: plan.amount,
  });

  return NextResponse.json(
    {
      success: true,
      order: {
        orderId: order.orderId,
        planId: plan.planId,
        planSlug: plan.planSlug,
        planName: planNameFor(plan.planSlug),
        amount: plan.amount,
        currency: "INR",
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        expiresAt: order.expiresAt.toISOString(),
        /** Seconds until expiry — drives the checkout countdown. */
        expiresInSeconds: Math.max(
          0,
          Math.floor((order.expiresAt.getTime() - Date.now()) / 1000)
        ),
      },
      merchant: { vpa: UPI_MERCHANT_VPA, name: UPI_MERCHANT_NAME },
      upiUri,
      intentUrls: generateUpiIntentUrls(upiUri),
    },
    { status: 201 }
  );
}
