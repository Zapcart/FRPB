// FRPB — payment gateway interface.
// Stripe, Razorpay and Cashfree adapters implement this so checkout + webhooks
// stay provider-agnostic at the call site.

export type PaymentProviderName = "STRIPE" | "RAZORPAY" | "CASHFREE";

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
