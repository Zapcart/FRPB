import { useCallback, useEffect, useState } from "react";
import type { DeviceStatus } from "../lib/ipc";

/**
 * Single global device-state hook. Mounted once in MainDashboard and shared by
 * the Device Monitor and FRP Tools screens, so every surface renders from the
 * exact same `DeviceStatus` object:
 * - subscribes to push events on "device:status-changed" (2s main-process poll)
 * - starts the polling loop on mount and tears it down on unmount
 * - performs an immediate scan so the UI is populated instantly
 * - `refresh()` re-runs the unified ADB+USB scan on demand (manual Refresh)
 */
export function useDevice() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);

  useEffect(() => {
    let disposed = false;
    const off = window.frpb.device.onStatus((next) => {
      if (!disposed) setStatus(next);
    });

    window.frpb.device
      .startPolling()
      .catch(() => {});
    window.frpb.device
      .status()
      .then((next) => {
        if (!disposed) setStatus(next);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      off();
      window.frpb.device.stopPolling().catch(() => {});
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await window.frpb.device.getStatus();
      setStatus(next);
    } catch {
      // Keep the last known status; a failed manual refresh must not clear it.
    }
  }, []);

  return { status, refresh };
}
