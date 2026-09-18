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

import { Prisma } from "@prisma/client";
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
    // No orders have been submitted for admin review in the empty/fallback
    // payload; the pending-UPI panel simply does not render.
    pendingUpiOrders: [],
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

/**
 * Machine-readable cause of a degraded render. Chosen so the UI can say
 * something actionable ("Schema out of date") instead of a blanket
 * "Database connecting…" that is indistinguishable from a network blip.
 */
export type AdminDegradedReason =
  | "unconfigured"
  | "unreachable"
  | "auth"
  | "schema-drift"
  | "pool-timeout"
  | "unknown";

/** Result of a load attempt: data is ALWAYS present, plus a health flag. */
export interface AdminAnalyticsLoad {
  /** Always a valid payload — never null, so the page can always render. */
  data: AdminAnalyticsResponse;
  /** `true` when the DB could not be reached and `data` is the zero fallback. */
  degraded: boolean;
  /** Present only while `degraded` — why the fallback was rendered. */
  reason?: AdminDegradedReason;
  /** Prisma error code (e.g. "P1001") or a synthetic tag, for logs. */
  code?: string;
}

// ── Prisma error-code classification ────────────────────────────────────────
// Grouped by what the OPERATOR must do about it, because these previously all
// collapsed into one opaque "Database connecting…" state:
//   • unreachable    → wait / check network, Supabase status, pooler URL
//   • auth           → rotate/fix credentials
//   • schema-drift   → run `prisma migrate deploy` (table/column missing)
//   • pool-timeout   → raise connection_limit / reduce concurrency
const UNREACHABLE_CODES: ReadonlySet<string> = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1003", // Database does not exist
  "P1008", // Operations timed out
  "P1010", // User was denied access
  "P1017", // Server has closed the connection
]);

const AUTH_CODES: ReadonlySet<string> = new Set([
  "P1000", // Authentication failed
]);

const SCHEMA_CODES: ReadonlySet<string> = new Set([
  "P2021", // Table does not exist in the current database
  "P2022", // Column does not exist in the current database
]);

const POOL_CODES: ReadonlySet<string> = new Set([
  "P2024", // Timed out fetching a new connection from the pool
  "P2034", // Transaction failed due to a write conflict / deadlock
]);

/** Structured classification of a thrown DB error. */
interface ClassifiedDbError {
  reason: AdminDegradedReason;
  code: string;
  message: string;
}

/**
 * Map any thrown value to a `{reason, code, message}` triple.
 *
 * Never throws: the intent is purely diagnostic, so an unrecognised error still
 * produces a usable code ("ERR_UNKNOWN") rather than masking the original
 * failure with a secondary exception.
 */
function classifyDbError(err: unknown): ClassifiedDbError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { code } = err;
    const reason: AdminDegradedReason = AUTH_CODES.has(code)
      ? "auth"
      : UNREACHABLE_CODES.has(code)
        ? "unreachable"
        : SCHEMA_CODES.has(code)
          ? "schema-drift"
          : POOL_CODES.has(code)
            ? "pool-timeout"
            : "unknown";
    return { reason, code, message: err.message };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    // Raised when the client cannot even initialise (bad/missing URL, DNS,
    // TLS). `errorCode` is populated for the common P1xxx cases.
    return {
      reason: "unreachable",
      code: err.errorCode ?? "INIT",
      message: err.message,
    };
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return { reason: "unknown", code: "RUST_PANIC", message: err.message };
  }

  const message = err instanceof Error ? err.message : String(err);
  if (/timed?\s*out|timeout/i.test(message)) {
    return { reason: "pool-timeout", code: "TIMEOUT", message };
  }
  return { reason: "unknown", code: "ERR_UNKNOWN", message };
}

/** Human-readable label for a class of failure (used in the log line). */
const REASON_LABEL: Record<AdminDegradedReason, string> = {
  unconfigured: "not configured",
  unreachable: "connection error",
  auth: "authentication error",
  "schema-drift": "schema drift",
  "pool-timeout": "pool/timeout",
  unknown: "unknown error",
};

/**
 * Load the admin analytics payload for the initial server render.
 *
 * Wraps the ENTIRE aggregation in a try/catch. On any failure (connection
 * refused, pool exhaustion, statement timeout, missing DATABASE_URL) it logs a
 * SINGLE structured warning — `[admin] DB connection error [<code>]: <message>`
 * — and returns {@link emptyAdminAnalytics} with `degraded: true`. It never
 * rethrows, so `/admin` can not be taken down by a database outage.
 *
 * The classification matters: a `P2021` (missing table) means the schema is
 * behind and the fix is `prisma migrate deploy`, whereas `P1001` means the
 * pooler is unreachable. Previously both rendered as an identical
 * "Database connecting…" notice with no trace of which one was firing.
 */
export async function loadAdminAnalytics(): Promise<AdminAnalyticsLoad> {
  try {
    // `getAdminAnalytics()` returns null when the feature is unconfigured;
    // that is a CONFIGURATION fault, distinct from a connectivity fault, so it
    // is reported as its own reason rather than masquerading as a DB outage.
    const data = await getAdminAnalytics();
    if (!data) {
      console.warn(
        "[admin] DB connection error [UNCONFIGURED]: admin analytics is not configured — check ADMIN_LICENSE_KEY and DATABASE_URL."
      );
      return {
        data: emptyAdminAnalytics(),
        degraded: true,
        reason: "unconfigured",
        code: "UNCONFIGURED",
      };
    }
    return { data, degraded: false };
  } catch (err) {
    // Structured, single-line log: Prisma already emits the full invocation
    // separately, so a stack here would only flood serverless logs. The code
    // is the actionable part — it maps 1:1 to a remediation.
    const { reason, code, message } = classifyDbError(err);
    console.warn(
      `[admin] DB connection error [${code}] (${REASON_LABEL[reason]}): ${message}`
    );
    return {
      data: emptyAdminAnalytics(),
      degraded: true,
      reason,
      code,
    };
  }
}
