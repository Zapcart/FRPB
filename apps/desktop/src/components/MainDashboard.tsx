import { useState } from "react";
import type { LicenseProfile } from "../lib/ipc";
import { useUpdater } from "../hooks/useUpdater";
import { useDevice } from "../hooks/useDevice";
import DeviceMonitor from "./DeviceMonitor";
import DriverCenter from "./DriverCenter";
import FRPUnlockWizard from "./FrpUnlockWizard";
import UpdateModal from "./UpdateModal";
import {
  ShieldCheck,
  Smartphone,
  Wrench,
  LogOut,
  CalendarDays,
  Infinity as InfinityIcon,
  Cpu,
  MonitorSmartphone,
  RefreshCw,
  KeyRound,
} from "lucide-react";

type Tab = "monitor" | "drivers" | "frp";

interface MainDashboardProps {
  profile: LicenseProfile;
  onSignOut: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never (lifetime)";
  return formatDate(expiresAt);
}

/**
 * Post-activation shell: top bar with license status + update button, then a
 * three-tab workspace (Device Monitor / Driver Center / FRP Tools). The
 * UpdateModal overlays whenever the auto-updater reports an available update.
 */
export default function MainDashboard({ profile, onSignOut }: MainDashboardProps) {
  const [tab, setTab] = useState<Tab>("frp");
  const [updaterOpen, setUpdaterOpen] = useState(false);
  const { status: updaterStatus, check, download, install } = useUpdater();
  // Single global device state — shared by Device Monitor + FRP Tools so both
  // screens always render from the identical status object.
  const { status: deviceStatus, refresh: refreshDevice } = useDevice();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">FRPB Recovery</h1>
              <p className="text-[11px] text-slate-500">{profile.planName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 sm:flex">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-mono">{profile.key}</span>
            </div>
            <button
              onClick={() => {
                setUpdaterOpen(true);
                check();
              }}
              className="frpb-btn-ghost px-3 py-1.5 text-xs"
              title="Check for updates"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Updates
            </button>
            <button
              onClick={onSignOut}
              className="frpb-btn-ghost px-3 py-1.5 text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50"
              title="Deactivate on this device"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* License summary strip */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 px-6 py-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span>
              Expires:{" "}
              <span className="font-medium text-slate-800">{formatExpiry(profile.expiresAt)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MonitorSmartphone className="h-4 w-4 text-slate-400" />
            <span>
              Devices:{" "}
              <span className="font-medium text-slate-800">
                {profile.devicesUsed}/{profile.deviceLimit} used
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {profile.plan === "LIFETIME" ? (
              <InfinityIcon className="h-4 w-4 text-slate-400" />
            ) : (
              <Cpu className="h-4 w-4 text-slate-400" />
            )}
            <span>
              Activated:{" "}
              <span className="font-medium text-slate-800">
                {formatDate(profile.activatedAt)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <nav className="mx-auto flex w-full max-w-5xl gap-1 px-6 pt-5">
        <button
          onClick={() => setTab("monitor")}
          className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "monitor"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Device Monitor
        </button>
        <button
          onClick={() => setTab("drivers")}
          className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "drivers"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wrench className="h-4 w-4" />
          Driver Center
        </button>
        <button
          onClick={() => setTab("frp")}
          className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "frp"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          FRP Unlock
        </button>
      </nav>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {tab === "monitor" && <DeviceMonitor status={deviceStatus} />}
        {tab === "drivers" && <DriverCenter />}
        {tab === "frp" && <FRPUnlockWizard onBack={() => setTab("monitor")} />}
      </main>

      {/* Overlays */}
      {updaterOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setUpdaterOpen(false)}
          />
          <UpdateModal
            open
            status={updaterStatus}
            onClose={() => setUpdaterOpen(false)}
            onDownload={download}
            onInstall={install}
          />
        </div>
      )}
    </div>
  );
}
