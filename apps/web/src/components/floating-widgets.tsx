// FRPB — floating secondary-widgets host (client-only).
//
// The root layout is a Server Component, where `next/dynamic({ ssr: false })`
// is not permitted. This thin client wrapper exists solely to code-split the
// non-critical, site-wide "Follow Updates" community popover OUT of the primary
// hydration bundle.
//
// It is deferred with `ssr: false`, so it is fetched as a separate client chunk
// AFTER the initial HTML/paint. It never competes for main-thread time during
// first interaction, which matters most on low-end mobile CPUs where a large
// synchronous hydration bundle delays the first tap response.

"use client";

import dynamic from "next/dynamic";

const SocialUpdatesWidget = dynamic(
  () => import("@/components/SocialUpdatesWidget"),
  { ssr: false }
);

// Referral promo card + modal, code-split the same way. It self-gates on
// sessionStorage dismissal and resolves the buyer session server-side.
const FloatingPromoWidget = dynamic(
  () => import("@/components/referral/FloatingPromoWidget"),
  { ssr: false }
);

// Scroll-triggered signup nudge (10s dwell + 200px scroll). It self-gates to
// the landing route, skips authenticated visitors, and honours a persisted
// localStorage dismissal, so mounting it here is inert everywhere else.
const ScrollSignupModal = dynamic(
  () => import("@/components/ScrollSignupModal"),
  { ssr: false }
);

export default function FloatingWidgets() {
  return (
    <>
      <SocialUpdatesWidget />
      <FloatingPromoWidget />
      <ScrollSignupModal />
    </>
  );
}
