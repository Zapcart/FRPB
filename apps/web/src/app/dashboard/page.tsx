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

/**
 * Hard ceiling on the initial license fetch. Past this the request aborts and
 * the screen silently resolves to the empty state, so a cold database start or
 * a stalled connection pool can never leave the dashboard hanging on a spinner.
 */
const LIST_TIMEOUT_MS = 3000;

export default function DashboardPage() {
  const router = useRouter();
  // Set by a successful payment return. Both spellings are honoured because the
  // unified callback redirects with `?status=success` while the legacy gateway
  // return used `?success=true`.
  // Read from window.location in an effect rather than useSearchParams() so the
  // route does not require a Suspense boundary (which would otherwise force this
  // page's client subtree out of the static pass).
  const [checkoutSucceeded, setCheckoutSucceeded] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true" || params.get("status") === "success") {
        setCheckoutSucceeded(true);
      }
    } catch {
      // No location available (SSR pass) — banner simply stays hidden.
    }
  }, []);
  const [licenses, setLicenses] = useState<LicenseWithDevices[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbinding, setUnbinding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Fallback key recovery: the list route returns only a MASKED key, so a
  // customer whose delivery email never arrived reveals the full key here.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    // Hard ceiling on the list fetch. A cold start or a stalled connection pool
    // must never leave the dashboard spinning — after this the fetch aborts and
    // we resolve silently to an empty list.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), LIST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/v1/license/list", {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });

      // The ONLY failure that changes behaviour: a genuinely missing session.
      // Navigate client-side — we never clear the token and never hard-reload.
      if (res.status === 401) {
        router.replace("/auth?returnTo=/dashboard");
        return;
      }

      if (!res.ok) {
        // Any other status (500/502/503/…) resolves to the normal empty state.
        // No error card, no toast, no "Try again" — by design.
        setLicenses([]);
        return;
      }

      const data = (await res.json()) as ApiEnvelope<{ licenses: LicenseWithDevices[] }>;
      const list = data.success && data.data?.licenses ? data.data.licenses : [];
      const withDevices = await Promise.all(
        list.map(async (lic) => ({ ...lic, devices: await loadDevices(lic.id) }))
      );
      setLicenses(withDevices);
    } catch {
      // Abort/timeout, network failure, or malformed JSON — resolve to an empty
      // list. The empty state is the single failure UI for this screen.
      setLicenses([]);
    } finally {
      window.clearTimeout(timeout);
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

  /**
   * Reveal the full license key for a license the caller owns. This is the
   * customer-facing fallback when the delivery email failed or was lost — the
   * dashboard list only exposes a masked key for safety.
   */
  async function handleReveal(licenseId: string) {
    if (revealing) return;
    // Already revealed in this session → collapse it.
    if (revealed[licenseId]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[licenseId];
        return next;
      });
      return;
    }
    setRevealing(licenseId);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/v1/license/reveal?licenseId=${encodeURIComponent(licenseId)}`,
        { cache: "no-store", credentials: "include" }
      );
      const data = (await res.json()) as {
        success?: boolean;
        data?: { key?: string };
        message?: string;
      };
      if (res.ok && data.success && data.data?.key) {
        setRevealed((prev) => ({ ...prev, [licenseId]: data.data!.key! }));
      } else {
        setMessage(data.message ?? "Could not reveal the key. Please try again.");
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setRevealing(null);
    }
  }

  async function handleCopy(licenseId: string, key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(licenseId);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setMessage("Copy failed — select the key and copy it manually.");
    }
  }

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
    return <LicensesSkeleton />;
  }

  // Single failure UI for this screen: an empty list — whether the user truly
  // has no licenses, or the backend was unreachable. There is deliberately no
  // error card, toast or retry button here.
  if (!licenses.length) {
    return (
      <EmptyState
        icon={<KeyRound className="h-8 w-8 text-brand-500" />}
        title="No active licenses yet"
        body="Purchase a plan to unlock full device recovery features."
        cta={{ href: "/pricing", label: "Choose Plan" }}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Post-payment confirmation. The webhook has already granted the license
          and fired the delivery email, so this is purely reassurance + a cue to
          look at the card below. */}
      {checkoutSucceeded && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Payment successful 🎉</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Your license is active and has been emailed to you. It is listed below along with
              your download link.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
        </div>
      )}

      <h2 className="text-lg font-bold tracking-tight text-slate-900">
        Your Active Licenses
      </h2>

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
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-lg font-bold tracking-wide text-slate-900">
                  {revealed[lic.id] ?? lic.key}
                </h2>
                {revealed[lic.id] ? (
                  <button
                    type="button"
                    onClick={() => void handleCopy(lic.id, revealed[lic.id]!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {copied === lic.id ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-3.5 w-3.5" /> Copy key
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleReveal(lic.id)}
                    disabled={revealing === lic.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50"
                  >
                    {revealing === lic.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    Reveal key
                  </button>
                )}
              </div>
              {revealed[lic.id] && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Keep this key private — anyone with it can activate your license.
                </p>
              )}
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

/**
 * Subtle loading skeleton for the initial license fetch. Replaced by either the
 * license cards or the empty state — never by an error view.
 */
function LicensesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your licenses">
      <div className="h-6 w-52 animate-pulse rounded-lg bg-slate-200" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-full max-w-md animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-6 h-16 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
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
  /** Either a link target (href) or an in-place action (onClick). */
  cta: { href?: string; onClick?: () => void; label: string };
}) {
  const ctaClass = "btn-accent mt-6 px-6 py-2.5 text-sm font-bold text-white";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
      {icon}
      <h2 className="mt-4 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">{body}</p>
      {cta.onClick ? (
        <button type="button" onClick={cta.onClick} className={ctaClass}>
          {cta.label}
        </button>
      ) : (
        <Link href={cta.href ?? "/"} className={ctaClass}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
