// FRPB — payment rail factory.
//
// DUAL-RAIL ROUTING
// -----------------
// Currency alone decides the rail; the customer never chooses a gateway:
//
//   INR (India)         → UPI        — SELF-HOSTED Direct UPI (zero-MDR).
//                                      Settles straight to the merchant VPA via
//                                      a QR / native intent link and grants the
//                                      licence on UTR verification. There is no
//                                      hosted gateway and no third-party key.
//   USD (international) → PAYGLOCAL  — credit + debit cards, hosted redirect.
//
// Cashfree was removed entirely (adapter, webhook route and env vars). The INR
// rail no longer has a gateway object at all, which is why
// `getGatewayForCurrency("INR")` throws a typed configuration error: callers
// must route INR through the Direct-UPI engine (api/v1/payment/*) instead.

import type { PaymentGateway, PaymentProviderName } from "./gateway";
import { PayGlocalGateway } from "./payglocal";

/**
 * Raised when a rail cannot be served by a hosted gateway — either the
 * required environment keys are missing, or the currency has no gateway at all
 * (INR → Direct UPI). Lets callers distinguish a configuration problem (502)
 * from a transient provider/DB failure (500/503).
 */
export class PaymentConfigError extends Error {
  constructor(provider: PaymentProviderName | string) {
    super(
      `Payment gateway "${provider}" is missing required environment configuration.`
    );
    this.name = "PaymentConfigError";
  }
}

/** Raised when a currency has no hosted gateway (INR is self-hosted UPI). */
export class NoGatewayForCurrencyError extends Error {
  constructor(readonly currency: "USD" | "INR") {
    super(
      `Currency "${currency}" is not served by a hosted gateway. ` +
        (currency === "INR"
          ? "INR settles through the self-hosted Direct UPI engine — use /api/v1/payment/create."
          : "No gateway is configured for this currency.")
    );
    this.name = "NoGatewayForCurrencyError";
  }
}

/** The only hosted gateway remaining. */
export function getPaymentGateway(provider: PaymentProviderName): PaymentGateway {
  switch (provider) {
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
 * The hosted provider backing a currency, or `null` when the currency is served
 * by the self-hosted Direct UPI engine.
 *
 * USD → PAYGLOCAL. INR → null (Direct UPI, no gateway).
 */
export function providerForCurrency(currency: "USD" | "INR"): PaymentProviderName | null {
  return currency === "INR" ? null : "PAYGLOCAL";
}

/**
 * Resolve the hosted gateway for a currency.
 *
 * @throws {NoGatewayForCurrencyError} for INR — the caller must use the
 *   self-hosted Direct UPI flow instead of a hosted redirect.
 * @throws {PaymentConfigError} when the USD gateway keys are absent.
 */
export function getGatewayForCurrency(currency: "USD" | "INR"): PaymentGateway {
  const provider = providerForCurrency(currency);
  if (!provider) throw new NoGatewayForCurrencyError(currency);
  return getPaymentGateway(provider);
}
