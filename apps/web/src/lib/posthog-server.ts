// FRPB — Server-side PostHog helper.
// Runs on the server only (API routes / Server Components). Never imported by
// a `"use client"` module, so the private POSTHOG_API_KEY stays server-side.
//
// Graceful degradation: when POSTHOG_API_KEY is not configured every helper
// call is a safe no-op, so analytics never breaks the request path.

import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Lazily construct the shared PostHog server client.
 * Returns `null` when POSTHOG_API_KEY is absent (analytics disabled).
 */
export function getPostHogClient(): PostHog | null {
  if (client) return client;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;

  const host = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

  client = new PostHog(apiKey, {
    host,
    // Batch lightly: serverless requests are short-lived, so flush quickly.
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/** Capture a server-side `$pageview` event. No-op when PostHog is disabled. */
export async function capturePageView(
  url: string,
  referrer?: string,
  distinctId?: string
): Promise<void> {
  const ph = getPostHogClient();
  if (!ph) return;

  const properties: Record<string, unknown> = { $current_url: url };
  if (referrer) properties.$referrer = referrer;

  try {
    await ph.capture({
      distinctId: distinctId ?? "anonymous",
      event: "$pageview",
      properties,
    });
  } catch (err) {
    console.warn("[posthog] pageview capture failed:", err);
  }
}

/** Capture a server-side purchase event. No-op when PostHog is disabled. */
export async function capturePurchase(
  distinctId: string,
  properties: Record<string, unknown>
): Promise<void> {
  const ph = getPostHogClient();
  if (!ph) return;

  try {
    await ph.capture({
      distinctId,
      event: "license_purchased",
      properties: {
        ...properties,
        $set: { plan: properties.planSlug, currency: properties.currency },
      },
    });
  } catch (err) {
    console.warn("[posthog] purchase capture failed:", err);
  }
}

/** Capture an arbitrary server-side event. No-op when PostHog is disabled. */
export async function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = getPostHogClient();
  if (!ph) return;

  try {
    await ph.capture({
      distinctId,
      event,
      properties: properties ?? {},
    });
  } catch (err) {
    console.warn(`[posthog] ${event} capture failed:`, err);
  }
}
