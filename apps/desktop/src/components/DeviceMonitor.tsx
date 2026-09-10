import type { DeviceStatus } from "../lib/ipc";
import {
  Smartphone,
  Search,
  AlertTriangle,
  Download,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface DeviceMonitorProps {
  /** Shared device status from useDevice() — same object FRP Tools renders. */
  status: DeviceStatus | null;
}

/**
 * Live device panel. Renders the shared device status pushed by the unified
 * main-process poller (2s interval). States: SEARCHING (no device), CONNECTED
 * (ADB or USB detected, driver ok), DRIVER_MISSING (USB present, driver absent).
 */
export default function DeviceMonitor({ status }: DeviceMonitorProps) {

  if (!status) {
    return (
      <div className="frpb-card flex items-center gap-3 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        <p className="text-sm text-slate-500">Scanning USB ports…</p>
      </div>
    );
  }

  return (
    <div className="frpb-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Device Monitor</h2>
        </div>
        <span className="text-xs text-slate-400">
          Last scan {new Date(status.lastScanAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="p-5">
        {status.state === "SEARCHING" && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Search className="h-6 w-6 animate-pulse text-brand-500" />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Looking for a connected device…
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Connect a supported Android or iOS device via USB with debugging enabled.
            </p>
          </div>
        )}

        {status.state === "CONNECTED" && (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <Smartphone className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {status.deviceName ?? "Device connected"}
                </p>
                {status.source === "adb" && status.authorized === false ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Not authorized
                  </span>
                ) : status.source === "adb" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    USB only
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {status.vendor ?? "Device"}
                {status.mode ? ` · ${status.mode}` : ""}
                {status.driver ? ` · Driver: ${status.driver.oem}` : ""}
              </p>
              {status.source === "adb" && status.authorized === false ? (
                <p className="mt-1.5 text-xs text-amber-700">
                  Detected via ADB but not authorized. Accept the authorization prompt on
                  your phone to run operations.
                </p>
              ) : status.source !== "adb" ? (
                <p className="mt-1.5 text-xs text-amber-700">
                  Detected over USB. Enable USB debugging and authorize this computer to
                  run operations.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {status.state === "DRIVER_MISSING" && (
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {status.deviceName ?? "Device detected"}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Driver missing
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {status.vendor ?? "Device"}
                {status.mode ? ` · ${status.mode}` : ""} — the official USB driver is not
                installed.
              </p>
              {status.driver?.officialUrl && (
                <button
                  onClick={() =>
                    window.frpb.links.openExternal(status.driver!.officialUrl).catch(() => {})
                  }
                  className="frpb-btn-primary mt-3"
                >
                  <Download className="h-4 w-4" />
                  Get official {status.driver.oem} driver
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
