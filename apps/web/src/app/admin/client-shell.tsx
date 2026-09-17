// FRPB — Client-side admin shell (interactive UI over server-preloaded data).
// Pure UI: refresh button, loading/error states, tables, stat cards.
//
// SECURITY: this component never reads ADMIN_LICENSE_KEY (a private server
// secret) and never sends it from the browser. Initial data arrives as a prop
// from the Server Component (page.tsx); refreshes go through the
// `refreshAdminAnalytics` Server Action, which re-authenticates the Supabase
// session and runs the privileged query server-side.

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  KeyRound,
  ShieldAlert,
  TrendingUp,
  Activity,
  BarChart3,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";
import { refreshAdminAnalytics } from "./actions";

function StatCard({ title, value, subtitle, icon, color, bgColor }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; color: string; bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "success" | "danger" | "warning" | "neutral" }) {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${variants[variant]}`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
      return <Badge variant="success">{status}</Badge>;
    case "EXPIRED":
    case "FAILED":
    case "REVOKED":
      return <Badge variant="danger">{status}</Badge>;
    case "PENDING":
    case "PROCESSING":
      return <Badge variant="warning">{status}</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

function formatCurrency(rupees: number): string {
  if (rupees === 0) return "₹0";
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function formatUsd(dollars: number): string {
  if (dollars === 0) return "$0";
  return `$${dollars.toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ClientAdminShell({
  initialData,
  degraded: initialDegraded = false,
}: {
  // ALWAYS a complete payload: the server loader swaps in a zero-metrics
  // fallback when the database is unreachable, so this component never has to
  // render a hard error screen for a transient DB problem.
  initialData: AdminAnalyticsResponse;
  /** `true` when the server already knows the DB could not be reached. */
  degraded?: boolean;
}) {
  const [data, setData] = useState<AdminAnalyticsResponse>(initialData);
  const [degraded, setDegraded] = useState(initialDegraded);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Server Action: authenticates the session server-side and returns fresh
  // analytics. No secret ever leaves the server.
  const fetchAnalytics = useCallback(async () => {
    setError(null);
    try {
      const result = await refreshAdminAnalytics();
      if (result.data) {
        setData(result.data);
        setDegraded(false);
        return;
      }
      // No payload → the DB is still unreachable. Keep the existing figures
      // rather than blanking the console.
      setDegraded(true);
      setError(result.error ?? "Analytics temporarily unavailable");
    } catch (err) {
      setDegraded(true);
      setError((err as Error).message);
    }
  }, []);

  // NOTE: there is deliberately NO auto-refresh-on-mount. `initialData` is
  // always populated, and when the server reports `degraded` an automatic fetch
  // would immediately re-query a database we already know is failing — turning
  // one outage into a retry storm on every page load. Recovery is explicit via
  // the Refresh/Retry buttons.

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics().finally(() => setRefreshing(false));
  }, [fetchAnalytics]);

  // No blocking loading/error screens any more: `data` is always populated, so a
  // degraded database is reported as an inline notice instead of replacing the
  // entire console with an error state.
  const d = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of your FRPB application — licenses, FRP requests, revenue, and traffic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Degraded notice — the server loader substitutes a zero-metrics payload
          when the database is unreachable, so we say so plainly instead of
          presenting zeros as real numbers. */}
      {degraded && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Database connecting…</p>
              <p className="mt-0.5 text-xs text-amber-700">
                The analytics database is unreachable right now, so the figures below are
                placeholders. This page stays available and will show live data once the
                connection recovers.
                {error ? ` (${error})` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Visitors (30d)" value={d.visitors.total30d} subtitle="Unique IPs / visits" icon={<Users className="h-5 w-5" />} color="text-indigo-600" bgColor="bg-indigo-50" />
        <StatCard title="Logins (30d)" value={d.logins.total30d} subtitle="Authenticated sessions" icon={<Activity className="h-5 w-5" />} color="text-violet-600" bgColor="bg-violet-50" />
        <StatCard title="Licenses" value={d.licenses.total} subtitle={`${d.licenses.active} active · ${d.licenses.expired} expired`} icon={<KeyRound className="h-5 w-5" />} color="text-amber-600" bgColor="bg-amber-50" />
        <StatCard title="FRP Requests" value={d.frp.total} subtitle={`${d.frp.completed} done · ${d.frp.failed} failed`} icon={<ShieldAlert className="h-5 w-5" />} color="text-rose-600" bgColor="bg-rose-50" />
      </div>

      {/* License breakdown + FRP breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">License Breakdown</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">{d.licenses.total}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">Active</p>
              <p className="text-xl font-bold text-emerald-700">{d.licenses.active}</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
              <p className="text-xs font-medium text-rose-700">Expired</p>
              <p className="text-xl font-bold text-rose-700">{d.licenses.expired}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Revoked</p>
              <p className="text-xl font-bold text-amber-700">{d.licenses.revoked}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <div className="h-2 w-2 rounded-full bg-slate-300" />
            <span>Device slots: {d.licenses.deviceSlotsUsed} / {d.licenses.deviceSlotsTotal} used</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">FRP Success Rate</h2>
          </div>
          <div className="flex items-end gap-6">
            <div className="text-center">
              <p className="text-5xl font-extrabold text-emerald-600">{d.frp.successRate}%</p>
              <p className="text-xs text-slate-500">Success</p>
            </div>
            <div className="grid gap-3 text-sm">
              {[
                ["Completed", d.frp.completed, "text-emerald-600"],
                ["Failed", d.frp.failed, "text-rose-600"],
                ["Pending", d.frp.pending, "text-amber-600"],
                ["Processing", d.frp.processing, "text-violet-600"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-600">{label}</span>
                  <span className={`font-semibold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FRP by Brand + Android Version */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">FRP by Brand</h2>
          </div>
          {d.frpByBrand.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No FRP requests yet.</p>
          ) : (
            <div className="space-y-2">
              {d.frpByBrand.map((row) => (
                <div key={row.brand} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="font-medium text-slate-800">{row.brand}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{row.total} req</span>
                    <span className="text-xs text-emerald-600 font-semibold">{row.completed}✔</span>
                    <span className="text-xs text-rose-600 font-semibold">{row.failed}✗</span>
                    <span className="text-xs font-semibold text-slate-700">{row.successRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">FRP by Android Version</h2>
          </div>
          {d.frpByAndroidVersion.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No FRP requests yet.</p>
          ) : (
            <div className="space-y-2">
              {d.frpByAndroidVersion.map((row) => (
                <div key={row.version} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="font-medium text-slate-800">Android {row.version}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{row.total} req</span>
                    <span className="text-xs text-emerald-600 font-semibold">{row.completed}✔</span>
                    <span className="text-xs text-rose-600 font-semibold">{row.failed}✗</span>
                    <span className="text-xs font-semibold text-slate-700">{row.successRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Revenue Summary</h2>
        </div>
        {/* Currency pools are reported SEPARATELY — ₹ and $ are never summed. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">India (INR) &middot; Direct UPI</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(d.revenue.inr.amount)}</p>
            <p className="text-xs text-slate-500">
              {d.revenue.inr.successfulCount} settled
              {d.revenue.inr.legacyAmount > 0
                ? ` · ${formatCurrency(d.revenue.inr.legacyAmount)} legacy`
                : ""}
            </p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <p className="text-xs font-medium text-sky-700">International (USD) &middot; Cards</p>
            <p className="text-xl font-bold text-sky-700">{formatUsd(d.revenue.usd.amount)}</p>
            <p className="text-xs text-sky-700">
              {d.revenue.usd.successfulCount} settled
              {d.revenue.usd.legacyAmount > 0
                ? ` · ${formatUsd(d.revenue.usd.legacyAmount)} legacy`
                : ""}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-700">Settled Orders</p>
            <p className="text-xl font-bold text-emerald-700">
              {d.revenue.inr.successfulCount + d.revenue.usd.successfulCount}
            </p>
            <p className="text-xs text-emerald-700">
              {d.revenue.inr.successfulCount} INR · {d.revenue.usd.successfulCount} USD
            </p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-xs font-medium text-violet-700">Live Rail Share</p>
            <p className="text-xl font-bold text-violet-700">
              {formatCurrency(d.revenue.inr.liveAmount)}/{formatUsd(d.revenue.usd.liveAmount)}
            </p>
            <p className="text-xs text-violet-700">UPI / PayGlocal</p>
          </div>
        </div>
        {d.revenue.plans.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Plans Sold</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {d.revenue.plans.map((plan) => (
                <div key={plan.name} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-800">{plan.name}</p>
                  <p className="text-lg font-bold text-slate-900">{plan.sold} sold</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(plan.revenueInr)} &middot; {formatUsd(plan.revenueUsd)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {plan.countInr} INR · {plan.countUsd} USD
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent FRP Requests */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Recent FRP Requests</h2>
          </div>
          <span className="text-xs text-slate-400">{d.recentFrp.length} total</span>
        </div>
        {d.recentFrp.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No FRP requests yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Model</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Android</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {d.recentFrp.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{req.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2 text-sm text-slate-800">{req.brand}</td>
                    <td className="px-4 py-2 text-sm text-slate-800">{req.model}</td>
                    <td className="px-4 py-2 text-sm text-slate-800">{req.androidVersion ?? "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(req.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Licenses */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Recent Licenses</h2>
          </div>
          <span className="text-xs text-slate-400">{d.recentLicenses.length} total</span>
        </div>
        {d.recentLicenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No licenses yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">License Key</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {d.recentLicenses.map((lic) => (
                  <tr key={lic.id}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{lic.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-800">{lic.key}</td>
                    <td className="px-4 py-2 text-sm text-slate-800">{lic.planName}</td>
                    <td className="px-4 py-2"><StatusBadge status={lic.status} /></td>
                    <td className="px-4 py-2 text-sm text-slate-800">{lic.userEmail}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{formatDate(lic.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Traffic note */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Traffic Overview</h2>
        </div>
        <p className="text-xs text-slate-500">
          Visitor and login counts are approximations from the database. For real PostHog analytics,
          set <strong>POSTHOG_API_KEY</strong> in your environment and the admin panel will ingest pageview and event data.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <ExternalLink className="h-3 w-3" />
          <span>PostHog: {process.env.NEXT_PUBLIC_POSTHOG_HOST ? process.env.NEXT_PUBLIC_POSTHOG_HOST.replace("https://", "") : "not configured"}</span>
        </div>
      </div>
    </div>
  );
}
