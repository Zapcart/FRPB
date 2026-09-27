// FRPB — floating secondary-widgets host (client-only).
//
// The root layout is a Server Component, where `next/dynamic({ ssr: false })`
// is not permitted. This thin client wrapper exists solely to code-split the
// two non-critical, site-wide widgets — the "Follow Updates" community popover
// and the support assistant — OUT of the primary hydration bundle.
//
// Both are deferred with `ssr: false`, so they are fetched as separate client
// chunks AFTER the initial HTML/paint. They never compete for main-thread time
// during first interaction, which matters most on low-end mobile CPUs where a
// large synchronous hydration bundle delays the first tap response.

"use client";

import dynamic from "next/dynamic";

const SocialUpdatesWidget = dynamic(
  () => import("@/components/SocialUpdatesWidget"),
  { ssr: false }
);

const SupportWidget = dynamic(() => import("@/components/SupportWidget"), {
  ssr: false,
});

export default function FloatingWidgets() {
  return (
    <>
      <SocialUpdatesWidget />
      <SupportWidget />
    </>
  );
}
