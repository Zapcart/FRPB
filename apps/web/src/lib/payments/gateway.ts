// FRPB — payment gateway interface.
// The PayGlocal adapter implements this so checkout + webhooks stay
// provider-agnostic at the call site.
//
// Only ONE hosted-gateway rail remains:
//   PAYGLOCAL — USD / international (credit + debit cards)
//
// The INR rail is NOT a gateway: it is the self-hosted Direct UPI engine
// (`UPI`), which settles straight to the merchant VPA and is driven by
// lib/upi.ts plus the payment routes. Cashfree was removed entirely — the
// adapter, the webhook route and its env vars are gone.
//
// Legacy Stripe / Razorpay / Cashfree values survive ONLY on the Prisma
// PaymentProvider enum so historical Payment rows still validate; they are not
// constructible from code.

export type PaymentProviderName = "PAYGLOCAL";

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
