import { useCallback, useState, useEffect } from "react";
import type {
  LicenseProfile,
  DeviceStatus,
  DeviceInfo,
  LogEntry,
  OperationRunState,
} from "../lib/ipc";
import { useUpdater } from "../hooks/useUpdater";
import { useDevice } from "../hooks/useDevice";
import DeviceMonitor from "./DeviceMonitor";
import DriverCenter from "./DriverCenter";
import FRPToolsScreen from "./FRPToolsScreen";
import DeviceInfoScreen from "./DeviceInfoScreen";
import ConsoleLog from "./ConsoleLog";
import UpdateModal from "./UpdateModal";
import logoUrl from "../assets/logo.png";
import {
  Smartphone,
  Wrench,
  LogOut,
  CalendarDays,
  Infinity as InfinityIcon,
  Cpu,
  MonitorSmartphone,
  RefreshCw,
  KeyRound,
  Info,
  Terminal,
  AlertTriangle,
} from "lucide-react";

type Tab = "monitor" | "drivers" | "frp" | "device-info" | "console";

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
 * Device Info tab. The shared 2s poll payload only carries brand/model/serial,
 * never the full property set (see `scanUnified()` in device.ts), so this tab
 * fetches the complete `DeviceInfo` via the `device:getDeviceInfo` handle and
 * owns it in local state. It re-fetches whenever the connected serial changes
 * (device swap) and exposes a manual Refresh. `locked` disables the controls
 * while another operation is running.
 */
function DeviceInfoTabContent({
  deviceStatus,
  refresh,
  locked,
}: {
  deviceStatus: DeviceStatus | null;
  refresh: () => void;
  locked: boolean;
}) {
  const [info, setInfo] = useState<DeviceInfo | null>(
    deviceStatus?.deviceInfo ?? null
  );
  // Start in the loading state: `loadInfo()` runs on mount, so this reflects the
  // in-flight read instead of briefly flashing "No device connected" before the
  // first result (or error) arrives.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await window.frpb.device.getDeviceInfo();
      setInfo(next);
    } catch (err) {
      // getDeviceInfo throws when no ADB device is connected/authorized.
      // Keep the UI informative rather than blank.
      setInfo(null);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not read device properties."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and re-fetch whenever the connected device changes.
  useEffect(() => {
    void loadInfo();
  }, [loadInfo, deviceStatus?.serial]);

  if (error && !info) {
    return (
      <div className="frpb-card p-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-slate-800">Device info unavailable</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button
            type="button"
            onClick={() => {
              void loadInfo();
              refresh();
            }}
            disabled={locked || loading}
            className="frpb-btn-ghost px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Reading…" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {deviceStatus?.serial ? (
            <>
              Serial: <span className="font-mono">{deviceStatus.serial}</span>
            </>
          ) : (
            "No device connected"
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            void loadInfo();
            refresh();
          }}
          disabled={locked || loading}
          className="frpb-btn-ghost px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Reading…" : "Refresh"}
        </button>
      </div>
      <DeviceInfoScreen info={info} loading={loading} />
    </div>
  );
}

/** Simple console log panel that shows operation logs pushed by the engine.
 *  Prefers the authoritative cross-tab run-state (getRunState /
 *  onOperationStatus) and falls back to the shared device poll payload.
 */
function ConsoleLogTabContent({
  deviceStatus,
  operationRunning,
  operationLogs,
}: {
  deviceStatus: DeviceStatus | null;
  operationRunning: boolean;
  operationLogs: LogEntry[] | null;
}) {
  return (
    <ConsoleLog
      running={operationRunning}
      entries={operationLogs ?? deviceStatus?.logs ?? []}
    />
  );
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

  // Authoritative cross-tab run-state. Subscribing here (rather than only via
  // the 2s poll payload) means a tab switch is instant: the Console Log fills
  // immediately and every conflicting control locks the moment an operation
  // starts, in any tab. Seeded once so a tab opened mid-run shows history.
  const [runState, setRunState] = useState<OperationRunState | null>(null);
  useEffect(() => {
    let disposed = false;
    window.frpb.device
      .getRunState()
      .then((state) => {
        if (!disposed) setRunState(state);
      })
      .catch(() => {});
    const off = window.frpb.device.onOperationStatus((state) => {
      if (!disposed) setRunState(state);
    });
    return () => {
      disposed = true;
      off();
    };
  }, []);

  const operationRunning =
    runState?.running ?? deviceStatus?.running ?? false;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="FRPB"
              className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-slate-900/5"
            />
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-ink">FRPB Recovery</h1>
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

      {/* Cross-tab operation lock banner: visible from every tab while an op
          runs, so the user always knows the engine is busy even after
          switching away from the tab that started it. */}
      {operationRunning && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-2 text-xs text-amber-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            Operation in progress — conflicting controls are locked in all tabs.
          </div>
        </div>
      )}

      {/* Tab bar — pill-style navigation sized to match the web dashboard chrome. */}
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap gap-1 border-b border-slate-200 px-6 pt-5">
        <button
          onClick={() => setTab("monitor")}
          className={`-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
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
          className={`-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
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
          className={`-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "frp"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          FRP Unlock
        </button>
        <button
          onClick={() => setTab("device-info")}
          className={`-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "device-info"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Info className="h-4 w-4" />
          Device Info
        </button>
        <button
          onClick={() => setTab("console")}
          className={`-mb-px inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "console"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Terminal className="h-4 w-4" />
          Console Log
        </button>
      </nav>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {tab === "monitor" && <DeviceMonitor status={deviceStatus} />}
        {tab === "drivers" && <DriverCenter />}
        {tab === "frp" && (
          <FRPToolsScreen
            status={deviceStatus}
            onRefresh={refreshDevice}
            operationRunning={operationRunning}
          />
        )}
        {tab === "device-info" && (
          <DeviceInfoTabContent
            deviceStatus={deviceStatus}
            refresh={refreshDevice}
            locked={operationRunning}
          />
        )}
        {tab === "console" && (
          <ConsoleLogTabContent
            deviceStatus={deviceStatus}
            operationRunning={operationRunning}
            operationLogs={runState?.logs ?? null}
          />
        )}
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
