import type { DeviceStatus } from "../../lib/ipc";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  MapPin,
  RefreshCw,
  Smartphone,
  Usb,
  Wifi,
  XCircle,
} from "lucide-react";

interface HomeScreenProps {
  status: DeviceStatus | null;
  lastRefreshAt: string | null;
  isConnected: boolean;
  needsAuth: boolean;
  deviceLabel: string;
  tab: "usb" | "wireless";
  onTabChange: (tab: "usb" | "wireless") => void;
  onRefresh: () => void;
  onOpenFrp: () => void;
  onComingSoon: (kind: "wireless" | "unlock" | "location") => void;
  busy: boolean;
}

/**
 * Screen 1 — USB Connection home.
 * Heading, connection graphic, status pill, and the three feature cards.
 * Only "Remove Google FRP Lock" is actionable (FRP wizard); Unlock Screen +
 * Location Change are "Coming Soon" placeholders for future engine ops.
 */
export default function HomeScreen({
  status,
  lastRefreshAt,
  isConnected,
  needsAuth,
  deviceLabel,
  tab,
  onTabChange,
  onRefresh,
  onOpenFrp,
  onComingSoon,
  busy,
}: HomeScreenProps) {
  return (
    <div className="frpb-card p-6">
      {/* Connection tabs */}
      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => onTabChange("usb")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            tab === "usb" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Usb className="h-4 w-4" />
          USB
        </button>
        <button
          onClick={() => onComingSoon("wireless")}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          <Wifi className="h-4 w-4" />
          Wireless
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Soon
          </span>
        </button>
      </div>

      {/* Heading + device graphic + status */}
      <div className="mt-6 flex flex-col items-center text-center">
        <h2 className="text-lg font-bold text-slate-900">
          Please connect your device via USB cable
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enable USB debugging in Developer Options, then plug in your device.
        </p>

        <div className="relative mt-8">
          {isConnected && (
            <span className="absolute inset-0 -m-3 animate-ping rounded-3xl bg-emerald-200/60" />
          )}
          <div
            className={`relative flex h-24 w-24 items-center justify-center rounded-3xl ${
              isConnected
                ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200"
                : "bg-gradient-to-br from-slate-300 to-slate-400"
            }`}
          >
            <Smartphone className={`h-11 w-11 ${isConnected ? "text-white" : "text-slate-100"}`} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {isConnected ? (
            status?.source === "adb" && status.authorized === false ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Not authorized
              </span>
            ) : status?.source === "adb" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Device Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                USB only — enable USB debugging
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600">
              <XCircle className="h-4 w-4" />
              Device connection failed
            </span>
          )}
          {status?.source && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {status.source}
            </span>
          )}
        </div>

        {isConnected && deviceLabel && (
          <p className="mt-2 text-sm font-medium text-slate-700">{deviceLabel}</p>
        )}

        {needsAuth && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Authorize on your phone — accept the ADB authorization prompt to continue.
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            {lastRefreshAt ? `Updated ${new Date(lastRefreshAt).toLocaleTimeString()}` : ""}
          </span>
          <button
            onClick={onRefresh}
            disabled={busy}
            className="frpb-btn-ghost px-3 py-1.5 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Remove Google FRP Lock — active */}
        <button
          onClick={onOpenFrp}
          disabled={busy}
          className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-brand-300 hover:shadow-md disabled:opacity-60"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md shadow-brand-200">
            <KeyRound className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">Remove Google FRP Lock</h3>
          <p className="mt-1 text-xs text-slate-500">
            Bypass Factory Reset Protection on your own device.
          </p>
          <span className="mt-3 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
            Start
          </span>
        </button>

        {/* Unlock Android Screen — coming soon */}
        <button
          onClick={() => onComingSoon("unlock")}
          className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">Unlock Android Screen</h3>
          <p className="mt-1 text-xs text-slate-500">
            Unlock forgotten PIN, pattern, or password.
          </p>
          <span className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
            Coming Soon
          </span>
        </button>

        {/* Location Change — coming soon */}
        <button
          onClick={() => onComingSoon("location")}
          className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-slate-300 hover:shadow-md"
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200">
            <MapPin className="h-7 w-7" />
            <span className="absolute -right-1.5 -top-1.5 rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
              New
            </span>
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">Location Change</h3>
          <p className="mt-1 text-xs text-slate-500">
            Change GPS location on supported devices.
          </p>
          <span className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
            Coming Soon
          </span>
        </button>
      </div>
    </div>
  );
}
