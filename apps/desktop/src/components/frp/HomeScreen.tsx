import type { DeviceStatus, RebootMode } from "../../lib/ipc";
import {
  type LucideIcon,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  Power,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Terminal,
  Usb,
  Wifi,
  XCircle,
  Zap,
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
  onUnlockScreen: () => void;
  onComingSoon: (kind: "wireless" | "location") => void;
  /** One-click reboot into a target boot mode (no data wipe). */
  onRebootMode: (mode: RebootMode) => void;
  /** The mode currently being requested — drives the per-button spinner. */
  rebootingMode: RebootMode | null;
  busy: boolean;
}

/**
 * Quick Boot Switcher targets. Each maps to an `adb reboot <mode>` handled in the
 * main process (`device:rebootMode`) with live progress streamed to the console.
 */
const REBOOT_ACTIONS: Array<{ mode: RebootMode; label: string; hint: string; icon: LucideIcon }> = [
  { mode: "bootloader", label: "Reboot Fastboot", hint: "adb reboot bootloader", icon: Terminal },
  { mode: "recovery", label: "Reboot Recovery", hint: "adb reboot recovery", icon: RotateCcw },
  { mode: "edl", label: "Reboot EDL", hint: "adb reboot edl", icon: Zap },
  { mode: "system", label: "Reboot System", hint: "adb reboot", icon: Power },
];

/**
 * Screen 1 — USB Connection home.
 * Heading, connection graphic, status pill, and the three feature cards.
 * "Remove Google FRP Lock" (FRP wizard) and "Unlock Android Screen" (ADB
 * lock-screen removal) are both actionable; only Location Change remains a
 * "Coming Soon" placeholder for a future engine op.
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
  onUnlockScreen,
  onComingSoon,
  onRebootMode,
  rebootingMode,
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

        {/* Unlock Android Screen — ADB se screen lock remove karein */}
        <button
          onClick={onUnlockScreen}
          disabled={busy}
          className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-emerald-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">Unlock Android Screen</h3>
          <p className="mt-1 text-xs text-slate-500">
            Unlock forgotten PIN, pattern, or password. ADB required.
          </p>
          <span className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            Run
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

      {/* Quick Boot Switcher — one-click reboot into a target mode (no wipe) */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Quick Boot Switcher</h3>
          </div>
          {!isConnected && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              No device
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Reboot your device into a target boot mode without wiping data. Requires an authorized ADB
          connection.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REBOOT_ACTIONS.map(({ mode, label, hint, icon: Icon }) => {
            const spinning = rebootingMode === mode;
            const disabled = !isConnected || busy;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onRebootMode(mode)}
                disabled={disabled}
                title={!isConnected ? "Connect a device to enable" : hint}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center transition hover:border-brand-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  {spinning ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="text-xs font-semibold text-slate-800">{label}</span>
                <span className="font-mono text-[10px] text-slate-400">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
