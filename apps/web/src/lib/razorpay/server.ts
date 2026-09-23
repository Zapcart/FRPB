// FRPB — Razorpay server-side SDK wrapper.
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway.
// This module owns:
//   • SDK initialisation (server-only, uses the secret key)
//   • HMAC-SHA256 signature verification for the verify-payment callback
//
// SECURITY: `RAZORPAY_KEY_SECRET` is server-only and must NEVER be imported into
// a client component or embedded in the browser bundle. Only the public
// `NEXT_PUBLIC_RAZORPAY_KEY_ID` may be exposed to the client.

import crypto from "node:crypto";
import Razorpay from "razorpay";

export class RazorpayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayConfigError";
  }
}

/** Public key id — safe to hand to the browser checkout.js SDK. */
export function getRazorpayKeyId(): string {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (!keyId) {
    throw new RazorpayConfigError("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.");
  }
  return keyId;
}

/**
 * Server-side secret — used ONLY for the Orders API and HMAC signature
 * verification. Never expose this value to the client.
 */
export function getRazorpayKeySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    throw new RazorpayConfigError("RAZORPAY_KEY_SECRET is not configured.");
  }
  return secret;
}

/**
 * Webhook signing secret — configured in the Razorpay dashboard when the
 * webhook endpoint is registered. Kept separate from `RAZORPAY_KEY_SECRET`
 * because Razorpay signs webhook payloads with this dedicated secret, not the
 * key secret used for Standard Checkout callbacks.
 *
 * Optional: when unset, `verifyWebhookSignature` fails closed (returns false)
 * so an unconfigured deployment can never accept a forged webhook.
 */
export function getRazorpayWebhookSecret(): string | null {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

let client: Razorpay | null = null;

/**
 * Lazily construct the Razorpay SDK client. Cached per server instance so we do
 * not re-allocate on every request (serverless-safe: it holds no connections,
 * only the key pair).
 */
export function getRazorpayClient(): Razorpay {
  if (client) return client;

  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();

  client = new Razorpay({ key_id, key_secret });
  return client;
}

/**
 * Verify a Razorpay Standard Web Checkout payment signature.
 *
 * Razorpay signs `razorpay_order_id + "|" + razorpay_payment_id` with
 * HMAC-SHA256 using the key secret. A mismatch means the payload was forged or
 * tampered with, and the caller must grant NOTHING.
 *
 * Comparison is constant-time (`timingSafeEqual`) to avoid leaking the expected
 * digest through response-timing differences.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  try {
    const secret = getRazorpayKeySecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest("hex");

    const provided = params.signature.trim().toLowerCase();
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");

    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (err) {
    console.error(
      "[razorpay/server] signature verification failed to run:",
      (err as Error)?.message ?? err
    );
    return false;
  }
}

/**
 * Verify a Razorpay WEBHOOK signature.
 *
 * Unlike the checkout callback above (which signs
 * `order_id|payment_id`), Razorpay signs the **raw request body** with HMAC-SHA256
 * keyed by the webhook signing secret, and sends the hex digest in the
 * `X-Razorpay-Signature` header. Verification MUST run against the exact bytes
 * Razorpay sent — never a re-serialised JSON object — so callers pass the raw
 * body string.
 *
 * Fails closed: a missing `RAZORPAY_WEBHOOK_SECRET` or a malformed/forged
 * signature returns `false`, so no license can ever be granted from an
 * unverified webhook.
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string | null | undefined;
}): boolean {
  try {
    const secret = getRazorpayWebhookSecret();
    if (!secret) {
      console.error(
        "[razorpay/server] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook."
      );
      return false;
    }
    if (!params.signature) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(params.rawBody)
      .digest("hex");

    const provided = params.signature.trim().toLowerCase();
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");

    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (err) {
    console.error(
      "[razorpay/server] webhook signature verification failed to run:",
      (err as Error)?.message ?? err
    );
    return false;
  }
}
