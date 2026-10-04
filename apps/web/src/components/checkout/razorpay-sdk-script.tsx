// FRPB — scoped Razorpay Standard Checkout SDK preload.
//
// Mounted ONLY on the purchase surfaces (`/pricing`, `/checkout`) — never in the
// root layout. A site-wide preload made every marketing/guide page issue a
// third-party request to `checkout.razorpay.com` on idle; on slow/hostile
// networks that request could stall and, in the worst case, saturate the main
// thread and freeze unrelated clicks (report: "payment provider script network
// requests immediately upon page load" on guide pages).
//
// `lazyOnload` fetches only after the browser goes idle, so even on the purchase
// pages it stays off the critical click path. `loadRazorpayCheckout()` adopts
// this exact tag (matching id + src) instead of injecting a duplicate <script>,
// and still falls back to on-demand injection with a 5s deadline if the user
// clicks purchase before this preload finishes.

"use client";

import Script from "next/script";

export default function RazorpaySdkScript() {
  return (
    <Script
      src="https://checkout.razorpay.com/v1/checkout.js"
      strategy="lazyOnload"
      id="razorpay-checkout-sdk"
    />
  );
}
