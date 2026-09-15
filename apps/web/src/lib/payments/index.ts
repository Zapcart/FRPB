// FRPB — payment gateway factory (provider-agnostic checkout).
//
// WHITE-LABEL DUAL-RAIL ROUTING
// -----------------------------
// The customer never sees, and never chooses, a provider. Currency alone
// decides the rail:
//   INR (India)          → CASHFREE   (UPI / NetBanking / domestic cards)
//   USD (international)  → PAYGLOCAL  (credit + debit cards)
// Callers use `getGatewayForCurrency(currency)`; the provider name is an
// internal detail persisted on the Payment row for reconciliation only.

import type { PaymentGateway, PaymentProviderName } from "./gateway";
import { StripeGateway } from "./stripe";
import { RazorpayGateway } from "./razorpay";
import { CashfreeGateway } from "./cashfree";
import { PayGlocalGateway } from "./payglocal";

/**
 * Raised when a gateway cannot be constructed because the required
 * environment keys are missing. Lets callers distinguish a configuration
 * problem (502) from a transient provider/DB failure (500/503).
 */
export class PaymentConfigError extends Error {
  constructor(provider: PaymentProviderName) {
    super(
      `Payment gateway "${provider}" is missing required environment configuration.`
    );
    this.name = "PaymentConfigError";
  }
}

export function getPaymentGateway(provider: PaymentProviderName): PaymentGateway {
  switch (provider) {
    case "STRIPE": {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw new PaymentConfigError(provider);
      }
      return new StripeGateway(secretKey);
    }
    case "RAZORPAY": {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new PaymentConfigError(provider);
      }
      return new RazorpayGateway(keyId, keySecret);
    }
    case "CASHFREE": {
      const clientId = process.env.CASHFREE_CLIENT_ID;
      const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new PaymentConfigError(provider);
      }
      return new CashfreeGateway(clientId, clientSecret);
    }
    case "PAYGLOCAL": {
      const merchantId = process.env.PAYGLOCAL_MERCHANT_ID;
      const merchantKey = process.env.PAYGLOCAL_MERCHANT_KEY;
      if (!merchantId || !merchantKey) {
        throw new PaymentConfigError(provider);
      }
      return new PayGlocalGateway(
        merchantId,
        merchantKey,
        process.env.PAYGLOCAL_MERCHANT_SECRET
      );
    }
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

/**
 * The provider backing a currency — the single source of truth for the
 * dual-rail split. INR settles through Cashfree (India), USD through PayGlocal
 * (international cards).
 */
export function providerForCurrency(currency: "USD" | "INR"): PaymentProviderName {
  return currency === "INR" ? "CASHFREE" : "PAYGLOCAL";
}

/** Resolve the fully-constructed gateway for a currency. */
export function getGatewayForCurrency(currency: "USD" | "INR"): PaymentGateway {
  return getPaymentGateway(providerForCurrency(currency));
}
