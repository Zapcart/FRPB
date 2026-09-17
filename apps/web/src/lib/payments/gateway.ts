// FRPB — payment gateway interface.
// The Cashfree and PayGlocal adapters implement this so checkout + webhooks
// stay provider-agnostic at the call site.
//
// Only two rails are supported:
//   CASHFREE  — INR / domestic India (UPI, NetBanking, domestic cards)
//   PAYGLOCAL — USD / international (credit + debit cards)
// Legacy Stripe and Razorpay adapters were removed; the PaymentProvider enum
// retains those values only so historical Payment rows still type-check.

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
  /**
   * Explicit MAJOR-unit amount to charge. When supplied this WINS over the
   * plan-derived price, letting a caller (e.g. the dual-currency PayGlocal init
   * route) charge the tier rate from config/plans.ts — $20 / $50 / $100 — rather
   * than the legacy shared `priceCents`.
   */
  amountMajor?: number;
  /** Our own order reference, so the provider txn maps back to a PaymentOrder. */
  orderRef?: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerTxnId: string;
}

export interface PaymentGateway {
  readonly provider: PaymentProviderName;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
