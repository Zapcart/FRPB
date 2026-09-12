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

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

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

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
      // Capture SPA navigations automatically (App Router has no page reloads).
      capture_pageview: true,
      capture_pageleave: true,
      // Only build person profiles for authenticated users — keeps anonymous
      // traffic cheap and avoids creating profiles for every visitor.
      person_profiles: "identified_only",
    });
    posthogReady = true;
  }, []);

  return <PostHogReactProvider client={posthog}>{children}</PostHogReactProvider>;
}
