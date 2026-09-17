// FRPB — PayGlocal payment gateway adapter.
// PayGlocal is the INTERNATIONAL (USD) acquirer: card payments from outside
// India. It is a hosted-redirect flow: we create an order
// server-side and hand the customer to PayGlocal's payment page, then the
// webhook grants the license (see api/v1/webhooks/payglocal).
//
// White-label note: the provider name NEVER reaches the UI. Customers only ever
// see "Credit / Debit Card (USD/International)".
//
// Environment:
//   PAYGLOCAL_MERCHANT_ID   — merchant identifier
//   PAYGLOCAL_MERCHANT_KEY  — API key (Basic auth user)
//   PAYGLOCAL_MERCHANT_SECRET — signing secret (also verifies webhooks)
//   PAYGLOCAL_API_BASE      — optional override (sandbox vs production)
//   PAYGLOCAL_API_VERSION   — optional header override

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentGateway,
} from "./gateway";
import { getPlanDefinition } from "@/lib/license/constants";
import { currencyFor, priceFor } from "@frpb/shared";

interface PayGlocalOrderResponse {
  orderId?: string;
  order_id?: string;
  merchantTxnId?: string;
  /** Provider-hosted payment page. Field name varies by API version. */
  paymentLink?: string;
  payment_link?: string;
  redirectUrl?: string;
  redirect_url?: string;
  checkoutUrl?: string;
  checkout_url?: string;
  status?: string;
}

/** PayGlocal API host. Overridable for sandbox testing. */
function apiBase(): string {
  return (process.env.PAYGLOCAL_API_BASE ?? "https://api.payglocal.in").replace(/\/+$/, "");
}

export class PayGlocalGateway implements PaymentGateway {
  readonly provider = "PAYGLOCAL" as const;

  constructor(
    private merchantId: string,
    private merchantKey: string,
    private merchantSecret?: string
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = getPlanDefinition(input.planSlug as never);
    // PayGlocal is the USD/international rail.
    const currency = currencyFor(input.currency ?? "USD");
    // An explicit major-unit amount (from config/plans.ts) takes precedence over
    // the legacy shared price, so the dual-currency tiers ($20/$50/$100) are what
    // actually gets charged.
    const amountMinor =
      input.amountMajor != null && Number.isFinite(input.amountMajor)
        ? Math.round(input.amountMajor * 100)
        : priceFor(plan, input.currency ?? "USD");

    // Reuse the caller's order reference when supplied so the provider txn maps
    // back onto our PaymentOrder row; otherwise mint a local one.
    const orderId =
      input.orderRef ?? `frpb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const apiVersion = process.env.PAYGLOCAL_API_VERSION ?? "v1";

    const returnUrl = `${input.successUrl}${
      input.successUrl.includes("?") ? "&" : "?"
    }order_id=${orderId}`;

    const res = await fetch(`${apiBase()}/pg/api/${apiVersion}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // PayGlocal uses HTTP Basic (merchant key) + an explicit merchant id.
        Authorization: `Basic ${Buffer.from(`${this.merchantId}:${this.merchantKey}`).toString(
          "base64"
        )}`,
        "x-merchant-id": this.merchantId,
        "x-api-version": apiVersion,
      },
      body: JSON.stringify({
        merchantTxnId: orderId,
        // PayGlocal expects a decimal MAJOR-unit amount (e.g. "49.99").
        amount: (amountMinor / 100).toFixed(2),
        currency,
        // Raw minor units + plan travel through to the webhook for an exact
        // reconciliation without re-deriving from the formatted string.
        amountInMinorUnits: amountMinor,
        merchantTxnNote: `FRPB ${plan.name}`,
        customerEmail: input.customerEmail,
        returnUrl,
        cancelUrl: input.cancelUrl,
        // Echoed back on the order object and on the webhook payload.
        metadata: { planSlug: input.planSlug, currency },
        tags: { planSlug: input.planSlug, currency },
      }),
    });

    if (!res.ok) {
      throw new Error(`PayGlocal order creation failed: ${res.status}`);
    }

    const order = (await res.json()) as PayGlocalOrderResponse;
    const checkoutUrl =
      order.paymentLink ??
      order.payment_link ??
      order.redirectUrl ??
      order.redirect_url ??
      order.checkoutUrl ??
      order.checkout_url;

    if (!checkoutUrl) {
      throw new Error("PayGlocal order creation returned no payment link");
    }

    return {
      checkoutUrl,
      providerTxnId: order.orderId ?? order.order_id ?? order.merchantTxnId ?? orderId,
    };
  }

  /** Exposed so the webhook can reuse the same signing secret source. */
  get signingSecret(): string | undefined {
    return this.merchantSecret;
  }
}
