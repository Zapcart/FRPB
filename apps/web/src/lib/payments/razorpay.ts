// FRPB — Razorpay payment gateway adapter.
// Razorpay checkout happens client-side with key_id + key_secret used for
// order creation; the webhook (payment.captured) grants the license.

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
} from "./gateway";
import { getPlanDefinition } from "@/lib/license/constants";
import { currencyFor, priceFor } from "@frpb/shared";

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export class RazorpayGateway implements PaymentGateway {
  readonly provider = "RAZORPAY" as const;

  constructor(
    private keyId: string,
    private keySecret: string
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = getPlanDefinition(input.planSlug as never);
    // Razorpay is an India-first gateway: it settles in INR natively.
    const currency = currencyFor(input.currency ?? "INR");
    const amount = priceFor(plan, input.currency ?? "INR");

    // Create an order server-side (amount in paise for INR)
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64"),
      },
      body: JSON.stringify({
        amount, // minor units (paise for INR, cents for USD)
        currency,
        receipt: `frpb_${Date.now()}`,
        notes: {
          planSlug: input.planSlug,
          customerEmail: input.customerEmail,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Razorpay order creation failed: ${res.status}`);
    }

    const order = (await res.json()) as RazorpayOrderResponse;

    // Client renders the Razorpay checkout modal with this order id.
    return {
      checkoutUrl: `https://checkout.razorpay.com/v1/payment/${order.id}`,
      providerTxnId: order.id,
    };
  }
}
