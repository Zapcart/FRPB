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
import { getOptionalUser } from "@/lib/supabase/server";
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
  //
  //    EVERY step here is optional and individually guarded:
  //      • a missing Supabase env var makes createClient() throw synchronously,
  //      • a Supabase/DB outage makes the lookup reject,
  //      • the local user row may not exist for a first-time buyer.
  //    In all three cases the purchase simply continues as a guest — the
  //    license is bound by email at grant time. Guest checkout must never be a
  //    500.
  let email = parsed.userEmail ?? null;
  let userId: string | null = null;
  const user = await getOptionalUser();
  if (user) {
    email = user.email;
    try {
      const record = await upsertPrismaUser(prisma, { id: user.id, email: user.email });
      userId = record.id;
    } catch (err) {
      // Auth succeeded but the local user row could not be written. Continue as
      // a guest rather than failing the checkout.
      console.warn("[payment/create] user upsert failed; continuing as guest:", err);
    }
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

  // PERSIST, OR DEGRADE GRACEFULLY.
  //
  // A DB outage must NOT stop a customer from paying: the UPI rail needs no
  // third-party service, and the amount is locked from the backend plan table
  // regardless. When persistence fails we still return a fully usable order
  // (URI + intent links) marked `persisted: false`, and log loudly so the
  // missing reconciliation row is visible to operations.
  //
  // What is lost in that mode: the pending-order row used for expiry/status
  // polling. The UTR verify step recreates what it needs from the request, so
  // the payment can still be completed and the license granted.
  let order: {
    orderId: string;
    status: string;
    createdAt: Date;
    expiresAt: Date;
  } = { orderId, status: "PENDING", createdAt: new Date(), expiresAt };
  let persisted = false;

  try {
    const created = await prisma.paymentOrder.create({
      data: {
        orderId,
        userId,
        email,
        planId: plan.planSlug,
        // Persisted from the SERVER-resolved plan, never from the client.
        amount: plan.amount,
        currency: "INR",
        provider: "UPI",
        status: "PENDING",
        expiresAt,
      },
    });
    order = created;
    persisted = true;
  } catch (err) {
    console.error(
      "[payment/create] order persistence failed — issuing a non-persisted order so " +
        "the customer can still pay:",
      err
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
        provider: "UPI",
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
      /**
       * False when the order row could not be stored (DB outage). The payment is
       * still fully completable — the client shows a reassurance notice and the
       * verify step reconciles against the request payload.
       */
      persisted,
    },
    { status: 201 }
  );
}
