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

export default function FloatingWidgets() {
  return <SocialUpdatesWidget />;
}
