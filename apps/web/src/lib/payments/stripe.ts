// FRPB — Stripe payment gateway adapter.

import Stripe from "stripe";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
} from "./gateway";
import { getPlanDefinition } from "@/lib/license/constants";
import { currencyFor, priceFor } from "@frpb/shared";

export class StripeGateway implements PaymentGateway {
  readonly provider = "STRIPE" as const;

  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = getPlanDefinition(input.planSlug as never);
    const currency = currencyFor(input.currency ?? "USD");
    const amount = priceFor(plan, input.currency ?? "USD");

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customerEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: plan.name },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        planSlug: input.planSlug,
        customerEmail: input.customerEmail,
        currency,
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
