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

const DB_UNAVAILABLE_MESSAGE =
  "We're having trouble reaching our payment system right now. Please try again in a moment.";

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
  //    Fire-and-forget, but with an explicit catch: `expireStaleOrders` swallows
  //    internally today, and a bare `void` would silently become an unhandled
  //    rejection if that ever changed.
  void expireStaleOrders().catch((err) => {
    console.warn("[payment/create] stale-order housekeeping failed (non-fatal):", err);
  });

  // 5. Persist the order as PENDING with a 10-minute expiry.
  const orderId = generateOrderId();
  const expiresAt = orderExpiry();

  // PERSIST-OR-FAIL.
  //
  // The order row is the ONLY thing that makes a UPI payment verifiable: the
  // 12-digit UTR is reconciled against it by /payment/verify, and the live
  // status poller reads it every 3 seconds. Returning a QR with no persisted row
  // hands the customer a payment that can never be confirmed — money moves and
  // no license is ever issued.
  //
  // That failure mode is strictly worse than a retry, so a DB outage now fails
  // LOUDLY with a 503 instead of degrading. The amount is still resolved
  // server-side, so nothing about the price is ever client-controlled.
  let order: Awaited<ReturnType<typeof prisma.paymentOrder.create>>;
  try {
    order = await prisma.paymentOrder.create({
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
  } catch (err) {
    console.error(
      "[payment/create] order persistence failed — refusing to issue an " +
        "unverifiable UPI QR:",
      err
    );
    return NextResponse.json(
      { success: false, message: DB_UNAVAILABLE_MESSAGE, code: "DB_UNAVAILABLE" },
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
       * Wire-compatibility field. Order persistence is now mandatory — a DB
       * outage returns 503 above — so this is always true. Retained so older
       * clients that branch on it keep working.
       */
      persisted: true,
    },
    { status: 201 }
  );
}
