// FRPB — Cashfree payment gateway adapter.
// Cashfree is a redirect flow: we create an order server-side, then send the
// customer to Cashfree's hosted payment page keyed by `payment_session_id`.
// The PAYMENT_SUCCESS_WEBHOOK event grants the license (see lib/webhooks).

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
} from "./gateway";
import { getPlanDefinition } from "@/lib/license/constants";

interface CashfreeOrderResponse {
  cf_order_id?: string | number;
  order_id?: string;
  payment_session_id?: string;
  order_status?: string;
}

/**
 * Cashfree API host. Defaults to production; set CASHFREE_API_BASE to
 * `https://sandbox.cashfree.com/pg` for sandbox/testing.
 */
function apiBase(): string {
  return (
    process.env.CASHFREE_API_BASE ?? "https://api.cashfree.com/pg"
  ).replace(/\/+$/, "");
}

export class CashfreeGateway implements PaymentGateway {
  readonly provider = "CASHFREE" as const;

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = getPlanDefinition(input.planSlug as never);

    // Cashfree requires us to supply order_id; it is unique and doubles as the
    // Payment.providerTxnId that the webhook later reconciles.
    const orderId = `frpb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const apiVersion = process.env.CASHFREE_API_VERSION ?? "2023-08-01";

    // Carry the plan through to the webhook via order_tags (Cashfree echoes
    // them back on the order object).
    const returnUrl = `${input.successUrl}${
      input.successUrl.includes("?") ? "&" : "?"
    }order_id={order_id}`;

    const res = await fetch(`${apiBase()}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": this.clientId,
        "x-client-secret": this.clientSecret,
        "x-api-version": apiVersion,
      },
      body: JSON.stringify({
        order_id: orderId,
        // Cashfree expects the amount in the currency's minor unit (paise/cents).
        order_amount: plan.priceCents,
        order_currency: plan.currency,
        customer_details: {
          customer_id: orderId,
          customer_email: input.customerEmail,
        },
        order_meta: {
          return_url: returnUrl,
          ...(process.env.CASHFREE_NOTIFY_URL
            ? { notify_url: process.env.CASHFREE_NOTIFY_URL }
            : {}),
        },
        order_tags: { planSlug: input.planSlug },
        order_note: `FRPB ${plan.name}`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Cashfree order creation failed: ${res.status}`);
    }

    const order = (await res.json()) as CashfreeOrderResponse;
    if (!order.payment_session_id) {
      throw new Error("Cashfree order creation returned no payment_session_id");
    }

    // Hosted checkout page — no client SDK required.
    return {
      checkoutUrl: `https://payments.cashfree.com/forms/${order.payment_session_id}`,
      providerTxnId: order.order_id ?? orderId,
    };
  }
}
