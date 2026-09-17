// FRPB — Server-side data loader for the admin page.
// Keeps ADMIN_LICENSE_KEY server-side: this Server Component calls the shared
// Prisma query layer (lib/admin-analytics) directly with the private key, so
// the secret is never bundled into client JavaScript.
//
// FAIL-SAFE BY DESIGN: on a serverless deploy (Vercel) the database may be
// unreachable, the connection pool may be exhausted, or a query may simply time
// out. A thrown Prisma error inside a Server Component surfaces as a full
// route-level "Server Component Error" screen — the whole console becomes
// unreachable because of a transient DB blip. This loader therefore NEVER
// throws and NEVER returns null: every failure is caught and converted into a
// complete, correctly-typed zero-metrics payload, and the `degraded` flag tells
// the UI to show a "Database connecting…" notice instead of fake zeros.

import { getAdminAnalytics } from "@/lib/admin-analytics";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";

export type { AdminAnalyticsResponse };

/**
 * A complete, zeroed analytics payload that satisfies
 * {@link AdminAnalyticsResponse} exactly.
 *
 * The key insight: this is returned on DB failure rather than `null`, so
 * `ClientAdminShell` receives well-formed data and renders its normal layout
 * (all zeros) instead of entering its auto-refresh error branch — which would
 * otherwise fire another failing query and leave the page in an error state.
 */
export function emptyAdminAnalytics(): AdminAnalyticsResponse {
  return {
    visitors: { total30d: 0, returning30d: 0 },
    logins: { total30d: 0 },
    licenses: {
      total: 0,
      active: 0,
      expired: 0,
      revoked: 0,
      pending: 0,
      deviceSlotsUsed: 0,
      deviceSlotsTotal: 0,
    },
    frp: {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      successRate: 0,
    },
    frpByBrand: [],
    frpByAndroidVersion: [],
    recentFrp: [],
    recentLicenses: [],
    revenue: {
      inr: {
        currency: "INR",
        amount: 0,
        minorAmount: 0,
        successfulCount: 0,
        legacyAmount: 0,
        liveAmount: 0,
      },
      usd: {
        currency: "USD",
        amount: 0,
        minorAmount: 0,
        successfulCount: 0,
        legacyAmount: 0,
        liveAmount: 0,
      },
      plans: [],
    },
  };
}

/** Result of a load attempt: data is ALWAYS present, plus a health flag. */
export interface AdminAnalyticsLoad {
  /** Always a valid payload — never null, so the page can always render. */
  data: AdminAnalyticsResponse;
  /** `true` when the DB could not be reached and `data` is the zero fallback. */
  degraded: boolean;
}

/**
 * Load the admin analytics payload for the initial server render.
 *
 * Wraps the ENTIRE aggregation in a try/catch. On any failure (connection
 * refused, pool exhaustion, statement timeout, missing DATABASE_URL) it logs a
 * single concise warning and returns {@link emptyAdminAnalytics} with
 * `degraded: true`. It never rethrows, so `/admin` can not be taken down by a
 * database outage.
 */
export async function loadAdminAnalytics(): Promise<AdminAnalyticsLoad> {
  try {
    // `getAdminAnalytics()` itself returns null when the feature is
    // unconfigured; normalise that to the same degraded fallback.
    const data = await getAdminAnalytics();
    if (!data) {
      return { data: emptyAdminAnalytics(), degraded: true };
    }
    return { data, degraded: false };
  } catch (err) {
    // Keep the log to one line: Prisma already logs the full invocation
    // separately, and a noisy stack here would flood serverless logs.
    console.warn(
      "[admin] analytics unavailable — rendering safe empty state:",
      (err as Error)?.message ?? err
    );
    return { data: emptyAdminAnalytics(), degraded: true };
  }
}
