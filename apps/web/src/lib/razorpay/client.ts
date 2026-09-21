// FRPB — Razorpay Standard Web Checkout browser helper.
//
// Loads `https://checkout.razorpay.com/v1/checkout.js` exactly once per page and
// exposes the minimal, fully-typed surface the checkout UI needs.
//
// SECURITY: this module is browser-only and only ever reads
// `NEXT_PUBLIC_RAZORPAY_KEY_ID`. The key *secret* is never referenced here — it
// lives exclusively in `@/lib/razorpay/server` and never ships to the client.

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayCheckoutSuccess) => void | Promise<void>;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", callback: (payload: RazorpayFailure) => void) => void;
}

export type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_ID = "razorpay-checkout-js";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<RazorpayConstructor> | null = null;

/**
 * Resolve the public Razorpay key id, or `null` when the deployment has not
 * configured it. Callers surface a friendly "payments unavailable" message
 * rather than throwing into the React tree.
 */
export function getRazorpayPublicKeyId(): string | null {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  return keyId ? keyId : null;
}

/**
 * Inject `checkout.js` and resolve with `window.Razorpay`. Repeat calls reuse
 * the cached promise, so concurrent purchase clicks cannot append the script
 * twice. Failures clear the cache so a retry can re-attempt the download.
 */
export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Razorpay checkout can only be loaded in the browser.")
    );
  }

  const existingCtor = window.Razorpay;
  if (existingCtor) return Promise.resolve(existingCtor);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existingScript = document.getElementById(
      SCRIPT_ID
    ) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const onLoad = () => {
      const ctor = window.Razorpay;
      if (ctor) {
        resolve(ctor);
        return;
      }
      loadPromise = null;
      reject(
        new Error(
          "Razorpay checkout.js loaded but window.Razorpay is unavailable."
        )
      );
    };

    const onError = () => {
      loadPromise = null;
      reject(
        new Error(
          "Failed to load Razorpay checkout.js — check the network connection and retry."
        )
      );
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existingScript) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return loadPromise;
}
