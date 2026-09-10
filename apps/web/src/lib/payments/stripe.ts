// FRPB — Stripe payment gateway adapter.

import Stripe from "stripe";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
} from "./gateway";
import { getPlanDefinition } from "@/lib/license/constants";

export class StripeGateway implements PaymentGateway {
  readonly provider = "STRIPE" as const;

  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = getPlanDefinition(input.planSlug as never);

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail,
      line_items: [
        {
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: { name: plan.name },
            unit_amount: plan.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        planSlug: input.planSlug,
        customerEmail: input.customerEmail,
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });

    return {
      checkoutUrl: session.url ?? "",
      providerTxnId: session.id,
    };
  }
}
