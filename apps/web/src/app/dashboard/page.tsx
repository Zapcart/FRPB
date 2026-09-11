// FRPB — dashboard home
// Client component: loads the signed-in user's licenses + bound devices and
// lets them unbind machines (self-service HWID reset, enhancement §3).

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Smartphone,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
  Monitor,
  CheckCircle2,
} from "lucide-react";
import type {
  ListLicensesItem,
  DashboardDeviceItem,
  ApiEnvelope,
} from "@frpb/shared";

interface LicenseWithDevices extends ListLicensesItem {
  devices: DashboardDeviceItem[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<LicenseWithDevices[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbinding, setUnbinding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/license/list", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        // The session is genuinely invalid. Navigate client-side to sign-in —
        // we never clear the session token here and never trigger a full page
        // reload (which would drop client auth state mid-transition).
        router.replace("/auth?returnTo=/dashboard");
        return;
      }
      if (!res.ok) {
        // Backend/DB failures (e.g. 503) must NOT touch the auth session.
        // Surface a non-destructive message and keep the user signed in.
        setMessage(
          res.status === 503
            ? "We couldn't load your licenses right now. Please try again in a moment."
            : "Failed to load licenses."
        );
        return;
      }
      const data = (await res.json()) as ApiEnvelope<{ licenses: LicenseWithDevices[] }>;
      if (data.success && data.data) {
        const withDevices = await Promise.all(
          data.data.licenses.map(async (lic) => ({
            ...lic,
            devices: await loadDevices(lic.id),
          }))
        );
        setLicenses(withDevices);
      }
    } catch {
      // Network hiccups also must not log the user out.
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadDevices = async (licenseId: string): Promise<DashboardDeviceItem[]> => {
    try {
      const res = await fetch(`/api/v1/license/devices?licenseId=${licenseId}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as ApiEnvelope<{ devices: DashboardDeviceItem[] }>;
      return data.success && data.data ? data.data.devices : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnbind(deviceId: string) {
    setUnbinding(deviceId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/license/unbind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = (await res.json()) as ApiEnvelope;
      if (data.success) {
        setMessage("Device unbound. You can now activate on another machine.");
        await load();
      } else {
        setMessage(data.message ?? "Unbind failed.");
      }
    } catch {
      setMessage("Unbind failed. Please try again.");
    } finally {
      setUnbinding(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" /> Loading your licenses…
      </div>
    );
  }

  if (!licenses.length) {
    return (
      <EmptyState
        icon={<KeyRound className="h-8 w-8 text-brand-500" />}
        title="No active licenses yet"
        body="Buy a plan to receive your license key instantly and unlock the FRPB desktop app."
        cta={{ href: "/#pricing", label: "Choose a plan" }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
        </div>
      )}

      {licenses.map((lic) => (
        <section
          key={lic.id}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          {/* License header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                {lic.planName}
              </p>
              <h2 className="mt-1 font-mono text-lg font-bold tracking-wide text-slate-900">
                {lic.key}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <StatusPill status={lic.status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-500">
                  Expires: {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : "Never"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-500">
                  {lic.devicesUsed}/{lic.deviceLimit} devices in use
                </span>
              </div>
            </div>
            <Link
              href="/#pricing"
              className="btn-ghost rounded-lg px-4 py-2 text-sm font-medium"
            >
              Upgrade plan
            </Link>
          </div>

          {/* Download CTA */}
          {lic.status === "ACTIVE" && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50 to-accent-50 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
                  <Download className="h-4 w-4 text-white" />
                </span>
                <p className="text-sm text-slate-700">
                  Download the FRPB desktop app for Windows or macOS
                </p>
              </div>
              <a
                href={process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? "/#downloads"}
                className="btn-accent rounded-lg px-5 py-2 text-sm font-bold text-white"
              >
                Download
              </a>
            </div>
          )}

          {/* Bound devices */}
          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Smartphone className="h-4 w-4 text-slate-400" /> Bound devices
            </h3>
            {lic.devices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No devices bound yet. Launch FRPB and activate your license to bind this machine.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {lic.devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50">
                        <Monitor className="h-4 w-4 text-slate-500" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {d.deviceName || "Unknown device"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last seen: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                    {d.status !== "UNBOUND" ? (
                      <button
                        onClick={() => handleUnbind(d.id)}
                        disabled={unbinding === d.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {unbinding === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Unbind
                      </button>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Unbound
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        Need another activation? Unbind a device above to free a slot — the same machine can
        re-activate anytime.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "EXPIRED"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`rounded-full border px-3 py-1 font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      {icon}
      <h2 className="mt-4 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">{body}</p>
      <Link href={cta.href} className="btn-accent mt-6 px-6 py-2.5 text-sm font-bold text-white">
        {cta.label}
      </Link>
    </div>
  );
}
