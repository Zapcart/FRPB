// FRPB — client-side providers (PostHog product analytics).
//
// This module is imported by the Server Component `RootLayout`, so it must never
// touch `window` or open a network connection during SSR / static generation.
// Initialisation therefore happens in `useEffect` (browser only, after hydrate),
// guarded by an explicit `typeof window !== "undefined"` check.
//
// The module-level `posthogReady` flag lets other client modules (e.g. the auth
// form) know whether it is safe to call `posthog.capture` — avoiding the
// "initialize PostHog before calling capture" warning when no key is configured
// (local builds, preview deploys).

"use client";

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

// First-party ingestion path. Requests are proxied to PostHog's US API by the
// `rewrites()` block in `next.config.mjs`, so telemetry never leaves our domain
// and survives ad-blockers that block `*.posthog.com` outright.
const POSTHOG_PROXY_PATH = "/ingest";
// PostHog's own UI (toolbars, "open in PostHog" links) MUST hit the real host —
// it is a user-facing navigation, not an ingested request, so it is *not* proxied.
const POSTHOG_UI_HOST = "https://us.posthog.com";

// True once `posthog.init` has run in the browser (and a key was available).
let posthogReady = false;

/** Whether PostHog has been initialised on the client. Safe to call anywhere. */
export function isPostHogEnabled(): boolean {
  return posthogReady;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Client-side only: skip on the server and don't double-initialise
    // (React 18 StrictMode intentionally runs effects twice in dev).
    if (typeof window === "undefined" || posthogReady) return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    // PERF (mobile): do NOT initialise PostHog during the hydration task. On a
    // low-end phone PostHog's init (network + session state + feature-flag
    // fetch) competes directly with first paint and first touch, which is what
    // made buttons feel frozen for several seconds. Defer init to the first
    // idle window after paint, with a `setTimeout` safety net for Safari (no
    // `requestIdleCallback`). Analytics still captures from the first user
    // interaction onward; we simply stop it from blocking the main thread boom.
    const init = () => {
      if (posthogReady) return;

      // Prefer the first-party proxy unconditionally. A legacy/stale
      // `NEXT_PUBLIC_POSTHOG_HOST` pointing straight at `*.posthog.com` (as
      // shipped in earlier .env files) must NOT be allowed to defeat the
      // reverse proxy, so the env override is only honoured when it is itself
      // a same-origin path.
      const configuredHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
      const apiHost = configuredHost?.startsWith("/")
        ? configuredHost
        : POSTHOG_PROXY_PATH;

      posthog.init(key, {
        // Route event capture through the same-origin `/ingest` reverse proxy.
        api_host: apiHost,
        // Required when `api_host` is a proxy: tells the toolbar / deep links
        // where the real PostHog app lives so they don't resolve to our
        // `/ingest` route.
        ui_host: POSTHOG_UI_HOST,
        // Capture SPA navigations automatically (App Router has no reloads).
        capture_pageview: true,
        capture_pageleave: true,
        // Only build person profiles for authenticated users — keeps anonymous
        // traffic cheap and avoids creating profiles for every visitor.
        person_profiles: "identified_only",
        // PERF (mobile): session replay is DISABLED. Replay is the single most
        // expensive PostHog feature on the client (DOM mutation observers +
        // periodic snapshots) and was a leading cause of the main-thread jank
        // reported on mobile. Standard event capture is retained.
        disable_session_recording: true,
        // Skip autocapture of every click/input — it attaches global listeners
        // and serialises DOM nodes on each event. Explicit `trackX()` calls and
        // pageviews still flow, which is all the funnel needs.
        autocapture: false,
      });
      posthogReady = true;
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(init, { timeout: 3500 });
    } else {
      window.setTimeout(init, 2000);
    }
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
