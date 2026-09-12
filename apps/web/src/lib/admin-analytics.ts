// FRPB — Shared admin analytics query logic (server-side only).
// Reused by the API route and by the admin Server Component so both read the
// same aggregates directly from the database.
//
// IMPORTANT: This module is imported ONLY by server code. It reads
// `process.env.ADMIN_LICENSE_KEY` (a private secret) and must never be pulled
// into a client bundle.

import { prisma } from "@/lib/prisma";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";

/**
 * Return `true` when the admin analytics feature is configured.
 *
 * The admin surface is gated on a private owner key (`ADMIN_LICENSE_KEY`).
 * When that key is absent the feature is considered disabled and callers
 * should fail closed rather than expose an unauthenticated endpoint.
 */
export function isAdminAnalyticsConfigured(): boolean {
  return Boolean(process.env.ADMIN_LICENSE_KEY);
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

async function getRevenue() {
  const [total, successful, failed, plans] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { status: "FAILED" }, _sum: { amountCents: true } }),
    prisma.payment.groupBy({
      by: ["planSlug"],
      _count: { planSlug: true },
      _sum: { amountCents: true },
      where: { status: "SUCCEEDED" },
    }),
  ]);

  const planNames: Record<string, string> = {
    MONTH_1: "1-Month Plan",
    YEAR_1: "1-Year Plan",
    LIFETIME: "Lifetime Plan",
  };

  return {
    totalRevenue: total._sum.amountCents ?? 0,
    successfulRevenue: successful._sum.amountCents ?? 0,
    failedRevenue: failed._sum.amountCents ?? 0,
    currency: "INR",
    plans: (plans ?? []).map((p) => ({
      name: planNames[p.planSlug] ?? p.planSlug,
      sold: p._count.planSlug,
      revenue: p._sum.amountCents ?? 0,
    })),
  };
}
