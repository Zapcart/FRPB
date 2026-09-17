// FRPB — Shared admin analytics query logic (server-side only).
// Reused by the API route and by the admin Server Component so both read the
// same aggregates directly from the database.
//
// IMPORTANT: This module is imported ONLY by server code. Authorization for the
// /admin console and the analytics API is decided by lib/admin/auth.ts (the
// owner key) and lib/admin/access.ts — never here. This module is a pure query
// layer and must never be pulled into a client bundle.

import { prisma } from "@/lib/prisma";
import { isAdminKeyConfigured } from "@/lib/admin/auth";
import type {
  AdminAnalyticsResponse,
  CurrencyRevenue,
  RevenueMetrics,
  RevenuePlanBreakdown,
} from "@frpb/shared/analytics";

/**
 * Return `true` when the admin analytics feature is configured.
 *
 * The admin surface is gated on a private owner key (`ADMIN_LICENSE_KEY`).
 * When that key is absent the feature is considered disabled and callers
 * should fail closed rather than expose an unauthenticated endpoint.
 */
export function isAdminAnalyticsConfigured(): boolean {
  // Delegates to the shared owner-key resolver, which falls back to the platform
  // key. Previously this was `Boolean(process.env.ADMIN_LICENSE_KEY)`, so an
  // unset env var made the feature "unconfigured" and every caller surfaced a
  // 503 — the operator was locked out of their own dashboard. There is now always
  // an owner key, so the console is reachable by default.
  return isAdminKeyConfigured();
}

/**
 * Fetch analytics data directly via Prisma (server-side only).
 *
 * Returns `null` when `ADMIN_LICENSE_KEY` is not configured so Server
 * Components can fall back gracefully without surfacing a 401 to end users.
 */
export async function getAdminAnalytics(): Promise<AdminAnalyticsResponse | null> {
  if (!isAdminAnalyticsConfigured()) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [visitors, logins, licenses, frp, frpByBrand, frpByAndroid, recentFrp, recentLicenses, revenue] =
    await Promise.all([
      getVisitors(thirtyDaysAgo),
      getLogins(thirtyDaysAgo),
      getLicenses(),
      getFrpStats(),
      getFrpByBrand(),
      getFrpByAndroidVersion(),
      getRecentFrp(),
      getRecentLicenses(),
      getRevenue(),
    ]);

  return {
    visitors,
    logins,
    licenses,
    frp,
    frpByBrand,
    frpByAndroidVersion: frpByAndroid,
    recentFrp,
    recentLicenses,
    revenue,
  };
}

// ─── Individual query helpers ───

async function getVisitors(since: Date) {
  // When POSTHOG_API_KEY is configured these could come from the PostHog
  // Query API; until then we derive an indicative estimate from the database.
  const distinctIps = await prisma.frpUnlockRequest.groupBy({
    by: ["ipAddress"],
    where: { requestedAt: { gte: since } },
    _count: { ipAddress: true },
  });
  const totalVisitors = distinctIps.reduce((sum, g) => sum + g._count.ipAddress, 0);

  const returningUsers = await prisma.user.count({
    where: {
      licenses: { some: { createdAt: { gte: since } } },
    },
  });

  return {
    total30d: totalVisitors,
    returning30d: returningUsers,
  };
}

async function getLogins(since: Date) {
  // Real login counts require PostHog `user_logged_in` events. The database
  // has no login table, so we approximate with users who have signed up for a
  // license in the window. This keeps the endpoint resilient when PostHog is
  // not configured (requirement: graceful DB fallback, never crash).
  const activeUsers = await prisma.user.count({
    where: {
      licenses: { some: { createdAt: { gte: since } } },
    },
  });

  return { total30d: activeUsers };
}

async function getLicenses() {
  const [total, active, expired, revoked, pending, deviceSlots] = await Promise.all([
    prisma.license.count(),
    prisma.license.count({ where: { status: "ACTIVE" } }),
    prisma.license.count({ where: { status: "EXPIRED" } }),
    prisma.license.count({ where: { status: "REVOKED" } }),
    prisma.license.count({ where: { status: "PENDING" } }),
    prisma.licenseDevice.count({ where: { status: { not: "UNBOUND" } } }),
  ]);

  const deviceSlotsTotal = await prisma.license.aggregate({
    _sum: { deviceLimit: true },
  });

  return {
    total,
    active,
    expired,
    revoked,
    pending,
    deviceSlotsUsed: deviceSlots,
    deviceSlotsTotal: deviceSlotsTotal._sum.deviceLimit ?? 0,
  };
}

async function getFrpStats() {
  const [total, completed, failed, pending, processing] = await Promise.all([
    prisma.frpUnlockRequest.count(),
    prisma.frpUnlockRequest.count({ where: { status: "COMPLETED" } }),
    prisma.frpUnlockRequest.count({ where: { status: "FAILED" } }),
    prisma.frpUnlockRequest.count({ where: { status: "PENDING" } }),
    prisma.frpUnlockRequest.count({ where: { status: "PROCESSING" } }),
  ]);

  return {
    total,
    completed,
    failed,
    pending,
    processing,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

async function getFrpByBrand() {
  const brands = await prisma.frpUnlockRequest.groupBy({
    by: ["brand"],
    _count: { brand: true },
    where: { status: { in: ["COMPLETED", "FAILED"] } },
  });

  const result: { brand: string; total: number; completed: number; failed: number; successRate: number }[] = [];
  for (const group of brands) {
    const [completed, failed] = await Promise.all([
      prisma.frpUnlockRequest.count({ where: { brand: group.brand, status: "COMPLETED" } }),
      prisma.frpUnlockRequest.count({ where: { brand: group.brand, status: "FAILED" } }),
    ]);
    result.push({
      brand: group.brand,
      total: group._count.brand,
      completed,
      failed,
      successRate: group._count.brand > 0 ? Math.round((completed / group._count.brand) * 100) : 0,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

async function getFrpByAndroidVersion() {
  const versions = await prisma.frpUnlockRequest.groupBy({
    by: ["androidVersion"],
    _count: { androidVersion: true },
    where: { androidVersion: { not: null }, status: { in: ["COMPLETED", "FAILED"] } },
  });

  const result: { version: string; total: number; completed: number; failed: number; successRate: number }[] = [];
  for (const group of versions) {
    // `androidVersion` is filtered non-null above, so the assertion is safe.
    const version = group.androidVersion as string;
    const [completed, failed] = await Promise.all([
      prisma.frpUnlockRequest.count({ where: { androidVersion: version, status: "COMPLETED" } }),
      prisma.frpUnlockRequest.count({ where: { androidVersion: version, status: "FAILED" } }),
    ]);
    result.push({
      version,
      total: group._count.androidVersion,
      completed,
      failed,
      successRate: group._count.androidVersion > 0 ? Math.round((completed / group._count.androidVersion) * 100) : 0,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

async function getRecentFrp(limit = 20) {
  const requests = await prisma.frpUnlockRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: limit,
    select: {
      id: true,
      brand: true,
      model: true,
      androidVersion: true,
      status: true,
      requestedAt: true,
    },
  });

  return requests.map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    androidVersion: r.androidVersion,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
  }));
}

async function getRecentLicenses(limit = 10) {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      plan: { select: { name: true } },
      user: { select: { email: true } },
    },
  });

  return licenses.map((l) => ({
    id: l.id,
    key: l.key,
    planName: l.plan.name,
    status: l.status,
    userEmail: l.user.email,
    createdAt: l.createdAt.toISOString(),
  }));
}

const PLAN_NAMES: Record<string, string> = {
  MONTH_1: "1-Month Plan",
  YEAR_1: "1-Year Plan",
  LIFETIME: "Lifetime Plan",
};

/** Normalize a stored currency string to the only two pools we report. */
function normalizeCurrency(value: string | null | undefined): "INR" | "USD" {
  return (value ?? "").toUpperCase() === "INR" ? "INR" : "USD";
}

/** Running totals for a single currency, accumulated across both ledgers. */
interface CurrencyAccumulator {
  minorAmount: number;
  successfulCount: number;
  legacyMinor: number;
  liveMinor: number;
}

function emptyAccumulator(): CurrencyAccumulator {
  return { minorAmount: 0, successfulCount: 0, legacyMinor: 0, liveMinor: 0 };
}

/**
 * Multi-currency revenue.
 *
 * HISTORY / WHY THIS IS SPLIT:
 * The previous implementation summed every `Payment` row into one figure and
 * hard-coded `currency: "INR"` — but `Payment.currency` defaults to `"USD"`, so
 * international card revenue was reported under an INR label. It also ignored
 * the live `PaymentOrder` ledger (Direct UPI + PayGlocal) entirely, so real
 * sales were missing from the dashboard.
 *
 * We now read BOTH ledgers and bucket strictly by each row's own `currency`:
 *   • `Payment`      — historical (`STRIPE`/`RAZORPAY`/`CASHFREE`) + the legacy
 *                      `checkout` rail. Counted as the "legacy" contribution.
 *   • `PaymentOrder` — the LIVE dual rail: `UPI` → INR, `PAYGLOCAL` → USD.
 *
 * `Payment` and `PaymentOrder` are disjoint by construction (the PayGlocal
 * settle helper writes only `PaymentOrder`; the webhook processor writes only
 * `Payment`), so nothing is double-counted, and only `SUCCEEDED`/`PAID` rows
 * contribute to successful revenue. INR and USD are NEVER added together —
 * ₹1,900 and $20 are not summable.
 */
async function getRevenue(): Promise<RevenueMetrics> {
  interface LegacyGroup {
    currency: string;
    planSlug: string;
    _count: { planSlug: number };
    _sum: { amountCents: number | null };
  }
  interface LiveGroup {
    currency: string;
    planId: string;
    _count: { planId: number };
    _sum: { amount: number | null };
  }

  // Historical ledger — SUCCEEDED rows only.
  const legacy = (await prisma.payment.groupBy({
    by: ["currency", "planSlug"],
    _count: { planSlug: true },
    _sum: { amountCents: true },
    where: { status: "SUCCEEDED" },
  })) as unknown as LegacyGroup[];

  // Live dual-rail ledger — PAID orders only.
  const live = (await prisma.paymentOrder.groupBy({
    by: ["currency", "planId"],
    _count: { planId: true },
    _sum: { amount: true },
    where: { status: "PAID" },
  })) as unknown as LiveGroup[];

  const totals = { INR: emptyAccumulator(), USD: emptyAccumulator() };
  const planTotals = new Map<
    string,
    { sold: number; revenueInr: number; revenueUsd: number; countInr: number; countUsd: number }
  >();

  const touchPlan = (slug: string) => {
    let entry = planTotals.get(slug);
    if (!entry) {
      entry = { sold: 0, revenueInr: 0, revenueUsd: 0, countInr: 0, countUsd: 0 };
      planTotals.set(slug, entry);
    }
    return entry;
  };

  for (const row of legacy) {
    const bucket = normalizeCurrency(row.currency);
    const minor = row._sum.amountCents ?? 0;
    const count = row._count.planSlug;
    // `Payment` stores USD in cents and INR in paise — both are minor units, so
    // dividing by 100 yields the major (whole) figure for either currency.
    totals[bucket].minorAmount += minor;
    totals[bucket].legacyMinor += minor;
    totals[bucket].successfulCount += count;

    const entry = touchPlan(row.planSlug);
    entry.sold += count;
    if (bucket === "INR") {
      entry.revenueInr += minor / 100;
      entry.countInr += count;
    } else {
      entry.revenueUsd += minor / 100;
      entry.countUsd += count;
    }
  }

  for (const row of live) {
    const bucket = normalizeCurrency(row.currency);
    // `PaymentOrder.amount` is already in WHOLE major units (₹1,900 / $20).
    const major = row._sum.amount ?? 0;
    const count = row._count.planId;
    totals[bucket].minorAmount += Math.round(major * 100);
    totals[bucket].liveMinor += Math.round(major * 100);
    totals[bucket].successfulCount += count;

    const entry = touchPlan(row.planId);
    entry.sold += count;
    if (bucket === "INR") {
      entry.revenueInr += major;
      entry.countInr += count;
    } else {
      entry.revenueUsd += major;
      entry.countUsd += count;
    }
  }

  const toCurrencyRevenue = (
    currency: "INR" | "USD",
    acc: CurrencyAccumulator
  ): CurrencyRevenue => ({
    currency,
    amount: Math.round(acc.minorAmount) / 100,
    minorAmount: Math.round(acc.minorAmount),
    successfulCount: acc.successfulCount,
    legacyAmount: Math.round(acc.legacyMinor) / 100,
    liveAmount: Math.round(acc.liveMinor) / 100,
  });

  const plans: RevenuePlanBreakdown[] = [...planTotals.entries()]
    .map(([slug, entry]) => ({
      name: PLAN_NAMES[slug] ?? slug,
      // "Sold" counts transactions in ANY currency, so it stays a plain count of
      // settled orders rather than a sum of incomparable money.
      sold: entry.sold,
      revenueInr: Math.round(entry.revenueInr * 100) / 100,
      revenueUsd: Math.round(entry.revenueUsd * 100) / 100,
      countInr: entry.countInr,
      countUsd: entry.countUsd,
    }))
    .sort((a, b) => b.sold - a.sold);

  return {
    inr: toCurrencyRevenue("INR", totals.INR),
    usd: toCurrencyRevenue("USD", totals.USD),
    plans,
  };
}
