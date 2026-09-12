// FRPB — Server-side data loader for the admin page.
// Keeps ADMIN_LICENSE_KEY server-side: this Server Component calls the shared
// Prisma query layer (lib/admin-analytics) directly with the private key, so
// the secret is never bundled into client JavaScript.

import { getAdminAnalytics } from "@/lib/admin-analytics";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";

export type { AdminAnalyticsResponse };

/**
 * Load the admin analytics payload for the initial server render.
 * Returns `null` (never throws) when the feature is unconfigured or the DB is
 * unreachable, so the page can still render a graceful empty/refresh state.
 */
export async function loadAdminAnalytics(): Promise<AdminAnalyticsResponse | null> {
  try {
    return await getAdminAnalytics();
  } catch (err) {
    console.error("[admin] failed to load analytics:", err);
    return null;
  }
}
