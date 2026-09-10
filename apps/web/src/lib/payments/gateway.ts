// FRPB — payment gateway interface.
// Both Stripe and Razorpay adapters implement this so checkout + webhooks
// stay provider-agnostic at the call site.

export type PaymentProviderName = "STRIPE" | "RAZORPAY";

export interface CreateCheckoutInput {
  planSlug: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerTxnId: string;
}

export interface PaymentGateway {
  readonly provider: PaymentProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
