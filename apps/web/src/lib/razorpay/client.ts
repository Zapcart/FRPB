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
// id used by the scoped `<RazorpaySdkScript>` preload mounted on the purchase
// surfaces (/pricing, /checkout) — never in the root layout. Tracked separately
// so the loader can ADOPT that tag instead of injecting a duplicate <script>
// when a purchase is clicked before the background preload has finished.
const PRELOAD_SCRIPT_ID = "razorpay-checkout-sdk";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Abort the checkout.js download after 5s so a stalled CDN never leaves the
// purchase button stuck in a spinner. The rejected message is surfaced verbatim
// by the checkout UI (see `startRazorpayCheckout`).
const RAZORPAY_LOAD_TIMEOUT_MS = 5_000;

/** User-facing copy shown when the payment SDK cannot be reached. */
export const RAZORPAY_NETWORK_ERROR_MESSAGE =
  "Network issue: Unable to connect to payment gateway. Please check your internet connection and try again.";

let loadPromise: Promise<RazorpayConstructor> | null = null;

/**
 * Locate an already-present checkout.js tag — injected by an earlier
 * `loadRazorpayCheckout()` call, the purchase-surface
 * `<Script id="razorpay-checkout-sdk">` preload, or any other embed. Matching by
 * `src` as a final fallback guarantees the SDK is never downloaded twice.
 */
function findExistingScript(): HTMLScriptElement | null {
  const byLoaderId = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (byLoaderId) return byLoaderId;
  const byPreloadId = document.getElementById(
    PRELOAD_SCRIPT_ID
  ) as HTMLScriptElement | null;
  if (byPreloadId) return byPreloadId;
  return document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC}"]`);
}

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

  // Fast path: the global `<Script>` preload (or a prior checkout) already
  // attached the SDK, so resolve synchronously with NO script tags and NO
  // network round trip — the purchase modal can open on the click's own task.
  const existingCtor = window.Razorpay;
  if (existingCtor) return Promise.resolve(existingCtor);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const existingScript = findExistingScript();
    const script = existingScript ?? document.createElement("script");

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Idempotent teardown: detach listeners and the timeout so a late `load`
    // (or the timer) can never resolve/reject twice or leak a pending timer.
    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };

    const onLoad = () => {
      const ctor = window.Razorpay;
      if (ctor) {
        settle(() => resolve(ctor));
        return;
      }
      loadPromise = null;
      settle(() =>
        reject(
          new Error(
            "Razorpay checkout.js loaded but window.Razorpay is unavailable."
          )
        )
      );
    };

    const onError = () => {
      loadPromise = null;
      settle(() => reject(new Error(RAZORPAY_NETWORK_ERROR_MESSAGE)));
    };

    // Hard 5s deadline: a hung/hijacked CDN request must not leave the purchase
    // button spinning indefinitely. Clearing `loadPromise` lets the next click
    // start a fresh attempt.
    timer = setTimeout(() => {
      loadPromise = null;
      settle(() => reject(new Error(RAZORPAY_NETWORK_ERROR_MESSAGE)));
    }, RAZORPAY_LOAD_TIMEOUT_MS);

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
