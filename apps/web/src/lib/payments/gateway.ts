// FRPB — payment gateway interface.
// Stripe, Razorpay and Cashfree adapters implement this so checkout + webhooks
// stay provider-agnostic at the call site.

export type PaymentProviderName = "STRIPE" | "RAZORPAY" | "CASHFREE" | "PAYGLOCAL";

export interface CreateCheckoutInput {
  planSlug: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /**
   * Currency the customer chose on the pricing page. Each adapter charges in
   * this currency using the plan's matching minor-unit amount (USD cents or
   * INR paise). Defaults to USD when omitted.
   */
  currency?: "USD" | "INR";
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerTxnId: string;
}

export interface PaymentGateway {
  readonly provider: PaymentProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
