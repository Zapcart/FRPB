// FRPB — Razorpay Standard Web Checkout flow (browser).
//
// One call performs the whole purchase:
//   1. POST /api/v1/checkout/create-order  → server creates the Razorpay order
//      (amount is locked server-side to the sanctioned INR tier rate).
//   2. Open the Razorpay modal with the returned order id.
//   3. On handler success, POST /api/v1/checkout/verify-payment so the server
//      verifies the HMAC-SHA256 signature and grants the license.
//
// Nothing is granted client-side: the modal callback is only a transport for
// the three Razorpay fields, and the server is the sole authority on whether
// the payment was genuine.

import { getDualPlan } from "@/config/plans";
import {
  getRazorpayPublicKeyId,
  loadRazorpayCheckout,
  type RazorpayCheckoutSuccess,
} from "./client";

export interface StartCheckoutParams {
  /** Shared plan slug (MONTH_1 | LIFETIME). */
  planSlug: string;
  /** Buyer email — required by the create-order route to bind the license. */
  email?: string | null;
  /** Called when the customer closes the Razorpay modal without paying. */
  onDismiss?: () => void;
}

export type StartCheckoutResult =
  | { status: "paid"; licenseKey: string | null; licenseId: string | null }
  | { status: "dismissed" }
  | { status: "failed"; message: string };

const BRAND_COLOR = "#6366f1";

interface CreateOrderResponse {
  success?: boolean;
  order_id?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

interface VerifyPaymentResponse {
  success?: boolean;
  licenseId?: string;
  licenseKey?: string;
  error?: string;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

/** Create the Razorpay order server-side. Returns a failure result on error. */
async function createOrder(
  planSlug: string,
  email: string | null
): Promise<
  | { ok: true; orderId: string; amount: number; currency: string }
  | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch("/api/v1/checkout/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: planSlug,
        userEmail: email ?? undefined,
      }),
    });
  } catch (err) {
    console.error("[razorpay/checkout] create-order request failed:", err);
    return {
      ok: false,
      message: "Network error — could not reach the payment server. Please retry.",
    };
  }

  const data = (await response.json().catch(() => null)) as CreateOrderResponse | null;

  if (!response.ok || !data?.order_id) {
    console.error(
      "[razorpay/checkout] create-order rejected:",
      response.status,
      data?.error
    );
    return {
      ok: false,
      message: errorMessage(
        data,
        `Could not start checkout (HTTP ${response.status}). Please retry.`
      ),
    };
  }

  return {
    ok: true,
    orderId: data.order_id,
    amount: typeof data.amount === "number" ? data.amount : 0,
    currency: data.currency ?? "INR",
  };
}

/** Verify the captured payment server-side. Returns a failure result on error. */
async function verifyPayment(
  params: RazorpayCheckoutSuccess & { planId: string }
): Promise<
  | { ok: true; licenseKey: string | null; licenseId: string | null }
  | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch("/api/v1/checkout/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.error("[razorpay/checkout] verify-payment request failed:", err);
    return {
      ok: false,
      message:
        "Payment was captured but verification could not be completed. Please contact support with your payment id.",
    };
  }

  const data = (await response.json().catch(() => null)) as VerifyPaymentResponse | null;

  if (!response.ok || !data?.success) {
    console.error(
      "[razorpay/checkout] verify-payment rejected:",
      response.status,
      data?.error
    );
    return {
      ok: false,
      message: errorMessage(
        data,
        "Payment could not be verified. Please contact support with your payment id."
      ),
    };
  }

  return {
    ok: true,
    licenseKey: data.licenseKey ?? null,
    licenseId: data.licenseId ?? null,
  };
}

/**
 * Run the full Razorpay purchase flow. Always resolves — never throws — so the
 * caller can render the returned status directly.
 */
export async function startRazorpayCheckout(
  params: StartCheckoutParams
): Promise<StartCheckoutResult> {
  const plan = getDualPlan(params.planSlug);
  if (!plan) {
    return { status: "failed", message: `Unknown plan "${params.planSlug}".` };
  }

  const key = getRazorpayPublicKeyId();
  if (!key) {
    console.error("[razorpay/checkout] NEXT_PUBLIC_RAZORPAY_KEY_ID is not set.");
    return {
      status: "failed",
      message:
        "Payments are temporarily unavailable. Please contact support to complete your purchase.",
    };
  }

  const order = await createOrder(plan.slug, params.email ?? null);
  if (!order.ok) return { status: "failed", message: order.message };

  let RazorpayCtor;
  try {
    RazorpayCtor = await loadRazorpayCheckout();
  } catch (err) {
    console.error("[razorpay/checkout] checkout.js load failed:", err);
    return {
      status: "failed",
      message:
        (err as Error)?.message ??
        "Could not open the secure checkout. Please retry.",
    };
  }

  return new Promise<StartCheckoutResult>((resolve) => {
    let settled = false;
    const finish = (result: StartCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new RazorpayCtor({
      key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "FRPB",
      description: `${plan.name} — license`,
      prefill: params.email ? { email: params.email } : undefined,
      notes: { planSlug: plan.slug },
      theme: { color: BRAND_COLOR },
      handler: async (response) => {
        const verified = await verifyPayment({ ...response, planId: plan.slug });
        if (!verified.ok) {
          finish({ status: "failed", message: verified.message });
          return;
        }
        finish({
          status: "paid",
          licenseKey: verified.licenseKey,
          licenseId: verified.licenseId,
        });
      },
      modal: {
        escape: true,
        backdropclose: true,
        ondismiss: () => {
          params.onDismiss?.();
          finish({ status: "dismissed" });
        },
      },
    });

    instance.on("payment.failed", (payload) => {
      const description = payload?.error?.description;
      console.error("[razorpay/checkout] payment.failed:", payload?.error);
      finish({
        status: "failed",
        message:
          description && description.trim()
            ? `${description} No amount was charged.`
            : "Payment failed — no amount was charged. Please retry.",
      });
    });

    try {
      instance.open();
    } catch (err) {
      console.error("[razorpay/checkout] modal open failed:", err);
      finish({
        status: "failed",
        message: "Could not open the secure checkout. Please retry.",
      });
    }
  });
}
