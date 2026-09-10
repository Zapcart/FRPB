import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdaterStatus } from "../lib/ipc";

/**
 * Subscribes to updater events from the main process and exposes the current
 * status plus imperative actions (check / download / install).
 *
 * A silent check is triggered once when the hook mounts (guarded against
 * StrictMode double-invocation). The main process also checks on launch; this
 * covers the case where the renderer loads after that check already finished.
 */
export function useUpdater() {
  const [status, setStatus] = useState<UpdaterStatus>({ state: "IDLE" });
  const checkInitiated = useRef(false);

  useEffect(() => {
    const off = window.frpb.updater.onStatus(setStatus);
    if (!checkInitiated.current) {
      checkInitiated.current = true;
      window.frpb.updater.check().catch(() => {
        // Keep silent: the header "Check updates" button surfaces errors.
      });
    }
    return off;
  }, []);

  const check = useCallback(async () => {
    setStatus({ state: "CHECKING" });
    const res = await window.frpb.updater.check();
    if (!res.started) {
      setStatus({ state: "ERROR", message: res.error ?? "Update check failed." });
    }
  }, []);

  const download = useCallback(async () => {
    await window.frpb.updater.download();
  }, []);

  const install = useCallback(async () => {
    await window.frpb.updater.install();
  }, []);

  return { status, check, download, install };
}
