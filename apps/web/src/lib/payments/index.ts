// FRPB — payment gateway factory (provider-agnostic checkout).

import type { PaymentGateway, PaymentProviderName } from "./gateway";
import { StripeGateway } from "./stripe";
import { RazorpayGateway } from "./razorpay";
import { CashfreeGateway } from "./cashfree";

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
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}
