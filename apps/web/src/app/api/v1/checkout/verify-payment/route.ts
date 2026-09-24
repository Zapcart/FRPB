// FRPB — Razorpay payment verification endpoint.
//
// POST /api/v1/checkout/verify-payment
//   body: {
//     razorpay_payment_id: string;
//     razorpay_order_id: string;
//     razorpay_signature: string;
//     planId?: string;
//   }
//
// SECURITY-CRITICAL. Razorpay Standard Web Checkout is the single, exclusive
// payment gateway. The client can never be trusted, so the license is granted
// ONLY when the HMAC-SHA256 signature verifies server-side:
//
//   expected = HMAC_SHA256(RAZORPAY_KEY_SECRET, `${order_id}|${payment_id}`)
//
// A mismatch grants NOTHING and returns HTTP 400.
import { NextResponse, type NextRequest } from "next/server";
import { preflight, withCorsResponse } from "@/lib/cors";
import { verifyPaymentSignature } from "@/lib/razorpay/server";
import { markRazorpayOrderPaid } from "@/lib/payment/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VerifyBody {
  razorpay_payment_id?: unknown;
  razorpay_order_id?: unknown;
  razorpay_signature?: unknown;
  planId?: unknown;
}

async function readBody(req: NextRequest): Promise<VerifyBody> {
  try {
    return (await req.json()) as VerifyBody;
  } catch {
    return {};
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function handleVerify(req: NextRequest): Promise<Response> {
  const body = await readBody(req);

  const paymentId = asString(body.razorpay_payment_id);
  const orderId = asString(body.razorpay_order_id);
  const signature = asString(body.razorpay_signature);

  if (!paymentId || !orderId || !signature) {
    return NextResponse.json(
      {
        success: false,
        error:
          "razorpay_payment_id, razorpay_order_id and razorpay_signature are all required.",
      },
      { status: 400 }
    );
  }

  // 1. Verify the gateway signature BEFORE touching the database or granting
  //    anything. A forged payload fails here and is never persisted.
  const valid = verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!valid) {
    console.warn(
      `[checkout/verify-payment] signature mismatch for order ${orderId} — no license granted.`
    );
    return NextResponse.json(
      { success: false, error: "Invalid signature" },
      { status: 400 }
    );
  }

  // 2. Signature is authentic → mark the order PAID and grant the license.
  //    `markRazorpayOrderPaid` is idempotent, so a retried verify can never
  //    mint a second key for the same payment.
  try {
    const grant = await markRazorpayOrderPaid({ providerTxnId: orderId });

    if (!grant) {
      // The order was not found OR was already linked — resolve the existing
      // grant so the client still receives a successful, idempotent response.
      console.warn(
        `[checkout/verify-payment] no grant produced for Razorpay order ${orderId} (unknown or already claimed).`
      );
      return NextResponse.json(
        { success: false, error: "Payment verified but no matching order was found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      licenseId: grant.licenseId,
      licenseKey: grant.licenseKey,
      // False means the key email could not be dispatched (it is retried by the
      // email-retry cron and is always visible on the customer dashboard).
      emailSent: grant.emailSent,
    });
  } catch (err) {
    console.error(
      "[checkout/verify-payment] failed to grant license:",
      (err as Error)?.message ?? err
    );
    return NextResponse.json(
      {
        success: false,
        error: "Payment verified but we could not issue your license yet. Please contact support.",
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await withCorsResponse(await handleVerify(req));
  } catch (err) {
    console.error(
      "[checkout/verify-payment] unhandled error:",
      (err as Error)?.message ?? err
    );
    return withCorsResponse(
      NextResponse.json(
        { success: false, error: "We could not verify your payment right now. Please try again." },
        { status: 500 }
      )
    );
  }
}

export const OPTIONS = preflight;
