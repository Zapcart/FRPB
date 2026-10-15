// FRPB — Google tag (gtag.js) event helper.
//
// Centralises every `gtag('event', …)` call so components never touch
// `window.gtag` directly. Two reasons:
//
//   1. SSR safety — the App Router renders on the server, where `window` does
//      not exist. Every entry point here is guarded by `typeof window`, so an
//      import (or a render-time call) can never throw during `next build` or
//      in the server render pass.
//   2. Resilience — GA4/Ads are loaded with next/script `afterInteractive`, so
//      `window.gtag` legitimately does not exist yet on first paint, and may
//      never exist for ad-blocked visitors. Tracking is strictly best-effort:
//      a missing tag is a silent no-op, never a runtime error.
//
// IDs mirror the tags configured in app/layout.tsx:
//   AW-18512807320 → Google Ads conversion account
//   G-VDP6PZ7RPR   → GA4 property

/** Google Ads conversion account id (also configured in app/layout.tsx). */
export const GOOGLE_ADS_ID = "AW-18512807320";

/** GA4 property id (also configured in app/layout.tsx). */
export const GA4_ID = "G-VDP6PZ7RPR";

/** Storefront currency — every FRPB tier settles in USD. */
export const TRACKING_CURRENCY = "USD";

/** Scalar parameter values GA4 accepts in an event payload. */
type GtagValue = string | number | boolean;

/** Event parameters accepted by `gtag('event', …)`. */
export type GtagEventParams = Record<string, GtagValue | undefined>;

/** The shape of the global `gtag` function once the tag script has run. */
type GtagFn = (
  command: "event" | "config" | "set" | "js",
  ...args: unknown[]
) => void;

/**
 * Returns the live `gtag` function, or `null` when we are on the server or the
 * tag has not (yet) loaded. Callers must treat `null` as "drop the event".
 */
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { gtag?: unknown }).gtag;
  return typeof fn === "function" ? (fn as GtagFn) : null;
}

/**
 * Fire a GA4/Ads event. Silently no-ops on the server, before the tag loads, or
 * when the tag is blocked. Never throws — analytics must not break the UI.
 *
 * @param name   GA4 event name, e.g. `click_download`.
 * @param params Optional event parameters; `undefined` values are stripped so
 *               GA4 never receives explicit nulls.
 */
export function trackEvent(name: string, params?: GtagEventParams): void {
  const gtag = getGtag();
  if (!gtag) return;

  try {
    if (!params) {
      gtag("event", name);
      return;
    }

    const cleaned: Record<string, GtagValue> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) cleaned[key] = value;
    }

    gtag("event", name, cleaned);
  } catch (error) {
    // Best-effort: log for debugging, never surface to the visitor.
    console.error(`[analytics] gtag event "${name}" failed:`, error);
  }
}

/** Download-button click (Hero / Header / Downloads page). */
export function trackDownloadClick(params?: GtagEventParams): void {
  trackEvent("click_download", params);
}

/** Pricing view — fired when the pricing page or in-page pricing section paints. */
export function trackViewPricing(params?: GtagEventParams): void {
  trackEvent("view_pricing", params);
}

/** Checkout initiation — fired on the buy/purchase click. */
export function trackBeginCheckout(params?: GtagEventParams): void {
  trackEvent("begin_checkout", {
    value: 20,
    currency: TRACKING_CURRENCY,
    ...params,
  });
}

/** Payment success — fired from the gateway success callback. */
export function trackPurchase(params: GtagEventParams & { transaction_id: string }): void {
  trackEvent("purchase", {
    value: 20,
    currency: TRACKING_CURRENCY,
    ...params,
  });
}
