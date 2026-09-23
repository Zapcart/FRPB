// FRPB — client-side page-view beacon.
//
// Mounted once in the root layout. Fires a single first-party request to
// /api/v1/analytics/pageview on mount and on every App Router navigation, which
// is what actually populates the admin "VISITORS (30D)" metric.
//
// This is deliberately independent of PostHog: it writes to our own database via
// a same-origin endpoint, so the metric keeps working when PostHog is
// unconfigured or blocked by an ad-blocker.

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Same-origin endpoint — see app/api/v1/analytics/pageview/route.ts. */
const PAGEVIEW_ENDPOINT = "/api/v1/analytics/pageview";

export default function PageViewTracker() {
  const pathname = usePathname();
  // Guards against React 18 StrictMode's double-invoked effects in development
  // double-counting a single navigation.
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;
    if (lastSentRef.current === pathname) return;
    lastSentRef.current = pathname;

    // sendBeacon survives page unloads and never blocks navigation; fall back to
    // fetch (keepalive) where the Beacon API is unavailable.
    const payload = JSON.stringify({ path: pathname });

    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(PAGEVIEW_ENDPOINT, blob);
        return;
      }
      void fetch(PAGEVIEW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Telemetry is best-effort; never surface an error to the visitor.
      });
    } catch {
      // Ignore — tracking must never break rendering.
    }
  }, [pathname]);

  return null;
}
