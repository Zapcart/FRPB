// FRPB — Web-preview fallback bridge.
//
// In the packaged desktop app the preload script exposes the real `window.frpb`
// bridge backed by Electron IPC. In a plain browser (Vite dev at :5173) there is
// no preload, so `window.frpb` is `undefined` and every IPC call throws —
// unmounting the React tree and producing a blank white screen.
//
// This module installs a graceful mock *before* React renders so the UI is fully
// interactive in browser preview mode:
//   - the master test key activates a synthetic LIFETIME profile (mirrors the
//     web API's shortcut) so the whole dashboard can be explored,
//   - device polling resolves to a NOT_CONNECTED state (never a phantom
//     "connected: true" device — there is no real phone in a browser),
//   - external links open in a new tab,
//   - the updater reports a clear "desktop only" message.

import type {
  AcceptConsentResult,
  ConsentState,
  DeviceInfo,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  FrpbBridge,
  LicenseProfile,
  LogEntry,
  OperationEvent,
  OperationKind,
  OperationOptions,
  OperationResult,
  OperationRunState,
  RebootMode,
  ResetResult,
  VerifyResponse,
} from "./ipc";

export const MASTER_TEST_KEY = "FRPB-TEST-1234-5678";

// Marker the renderer checks to detect web-preview (mock) mode at runtime.
export const WEB_PREVIEW_MARKER = "__FRPB_WEB_PREVIEW__";

function noopUnsubscribe(): () => void {
  return () => {};
}

function createWebBridge(): FrpbBridge {
  // Local state shared by the operation mocks.
  const operationListeners = new Set<(event: OperationEvent) => void>();
  const runStateListeners = new Set<(state: OperationRunState) => void>();
  const deviceLogListeners = new Set<(payload: DeviceLogPayload) => void>();
  // Mirrors the main-process `deviceLogSinkEnabled` flag driven by
  // `setLogSink`; raw chunks are only mirrored while a Console surface listens.
  let deviceLogSinkEnabled = true;
  let consent: ConsentState = { flashReset: false, frpBypass: false, unlockScreen: false };

  // Emits a synthetic raw chunk on the `device:log` channel + mirrors it into the
  // rolling console, exactly like createDeviceLogSink() in electron/ipc/device.ts.
  function emitDeviceLog(
    op: OperationKind,
    text: string,
    stream: "out" | "err" = "out"
  ): void {
    const payload: DeviceLogPayload = {
      op,
      stream,
      text,
      ts: new Date().toTimeString().slice(0, 8),
    };
    deviceLogListeners.forEach((cb) => cb(payload));
    if (!deviceLogSinkEnabled) return;
    const trimmed = text.replace(/\r?\n$/, "").trim();
    if (trimmed) pushSimLog(stream === "err" ? "STDERR" : "STDOUT", trimmed, null);
  }

  function emitOperation(event: OperationEvent): void {
    operationListeners.forEach((cb) => cb(event));
  }

  // Keeps the mock operation stream + console tab consistent with the real
  // main-process behaviour (running flag + rolling log buffer).
  let runState: OperationRunState = { running: false, op: null, logs: [] };
  // Monotonic identity mirroring the main process `logSeq` (see device.ts).
  let simSeq = 0;
  function emitRunState(next: Partial<OperationRunState>): void {
    runState = { ...runState, ...next };
    runStateListeners.forEach((cb) => cb(runState));
  }

  const SIM_MODE_LABEL: Record<NonNullable<OperationOptions["mode"]>, string> = {
    "test-mode": "Samsung Test Mode (MTP)",
    brom: "MediaTek BROM / Preloader (VCOM)",
    "fastboot-recovery": "Fastboot / Recovery",
  };

  // Mirrors REBOOT_LABELS in electron/ipc/device.ts for the Quick Boot Switcher.
  const REBOOT_SIM_LABEL: Record<RebootMode, string> = {
    bootloader: "Fastboot / Bootloader",
    recovery: "Recovery",
    edl: "EDL (Emergency Download)",
    system: "System (normal boot)",
  };

  const MAX_SIM_LOGS = 500;
  function pushSimLog(stage: string, message: string, pct: number | null): void {
    const entry: LogEntry = {
      stage,
      message,
      pct,
      kind: "info",
      ts: new Date().toTimeString().slice(0, 8),
      seq: ++simSeq,
    };
    const logs = [...runState.logs, entry];
    emitRunState({ logs: logs.length > MAX_SIM_LOGS ? logs.slice(-MAX_SIM_LOGS) : logs });
  }

  async function simulateOperation(
    op: OperationKind,
    options?: OperationOptions
  ): Promise<OperationResult> {
    const mode = options?.mode ?? "fastboot-recovery";
    const label = SIM_MODE_LABEL[mode];
    const stages: Array<[string, string, number]> = [
      ["checking", `Checking device… (${label})`, 5],
      ["waiting", `Waiting for phone in ${label}…`, 15],
      ["starting", `${label} detected — starting secure wipe…`, 30],
      ["wiping", "Wiping user data (recovery --wipe_data / adb shell wipe)…", 55],
      ["rebooting", "Rebooting device…", 90],
      ["done", "Operation complete.", 100],
    ];
    // Mirror the main process: mark running + stream logs for the Console tab.
    emitRunState({ running: true, op, logs: [] });
    try {
      for (const [stage, message, pct] of stages) {
        emitOperation({ op, stage, message, pct });
        emitDeviceLog(op, `$ adb shell recovery --wipe_data\n`);
        emitDeviceLog(op, `${message}\n`);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      return {
        success: true,
        message: `Simulated in web preview mode (${label}).`,
        detail:
          "Web preview mode — no real device was touched. Connect the FRPB desktop app to run the actual operation.",
      };
    } finally {
      emitRunState({ running: false, op: null });
    }
  }

  // Mock of the one-click boot-mode switcher. Streams the same shape of run-state
  // + operation events as the real handler so the Quick Boot Switcher buttons
  // exercise their disabled / spinner / console paths in browser preview mode.
  async function simulateReboot(mode: RebootMode): Promise<OperationResult> {
    const label = REBOOT_SIM_LABEL[mode];
    const stages: Array<[string, string, number]> = [
      ["checking", "Checking device…", 10],
      ["sending", `Sending: adb reboot${mode === "system" ? "" : ` ${mode}`}`, 55],
      ["requested", `Reboot to ${label} requested.`, 100],
    ];
    emitRunState({ running: true, op: "reboot-mode", logs: [] });
    try {
      for (const [stage, message, pct] of stages) {
        emitOperation({ op: "reboot-mode", stage, message, pct });
        emitDeviceLog(
          "reboot-mode",
          `$ adb reboot${mode === "system" ? "" : ` ${mode}`}\n`
        );
        emitDeviceLog("reboot-mode", `${message}\n`);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return {
        success: true,
        message: `Reboot to ${label} requested (web preview mode).`,
        detail: "Web preview mode — no real device was rebooted.",
      };
    } finally {
      emitRunState({ running: false, op: null });
    }
  }

  return {
    license: {
      verify: async (key: string): Promise<VerifyResponse> => {
        const normalized = key.trim().toUpperCase().replace(/\s+/g, "");
        if (normalized === MASTER_TEST_KEY) {
          const profile: LicenseProfile = {
            key: normalized,
            plan: "LIFETIME",
            planName: "Lifetime License",
            expiresAt: null,
            // Must mirror shared PLANS: LIFETIME grants 5 device activations.
            deviceLimit: 5,
            devicesUsed: 1,
            activatedAt: new Date().toISOString(),
          };
          return {
            httpStatus: 200,
            success: true,
            status: "ACTIVE",
            license: profile,
            message: "Activated (web preview mode)",
          };
        }
        return {
          httpStatus: 200,
          success: false,
          status: "INVALID_KEY",
          message: `Web preview mode: use the master test key ${MASTER_TEST_KEY} to explore the dashboard.`,
        };
      },
      getCachedProfile: async (): Promise<LicenseProfile | null> => null,
    },
    device: {
      status: async (): Promise<DeviceStatus> => ({
        state: "SEARCHING",
        lastScanAt: new Date().toISOString(),
      }),
      getRunState: async (): Promise<OperationRunState> => runState,
      seedLogs: async (): Promise<OperationRunState> => runState,
      clearLogs: async (upTo?: number): Promise<void> => {
        const tombstone = typeof upTo === "number" && upTo > 0 ? upTo : simSeq;
        emitRunState({ logs: runState.logs.filter((e) => (e.seq ?? 0) > tombstone) });
      },
      startPolling: async (): Promise<void> => {},
      stopPolling: async (): Promise<void> => {},
      onStatus: noopUnsubscribe,
      getStatus: async (): Promise<DeviceStatus> => ({
        connected: false,
        state: "NOT_CONNECTED",
        lastScanAt: new Date().toISOString(),
      }),
      listModels: async (): Promise<DeviceModelsResult> => ({
        models: ["Galaxy A54", "Redmi Note 12", "Pixel 7", "Moto G84"],
      }),
      getDeviceInfo: async (): Promise<DeviceInfo> => {
        throw new Error("No ADB device connected");
      },
      onOperationStatus: (cb: (state: OperationRunState) => void): (() => void) => {
        runStateListeners.add(cb);
        // Deliver the current snapshot immediately so a tab mounted mid-operation
        // (or after one finished) is consistent without waiting for the next tick.
        cb(runState);
        return () => {
          runStateListeners.delete(cb);
        };
      },
      checkConsent: async (): Promise<ConsentState> => consent,
      acceptConsent: async (
        operation: OperationKind
      ): Promise<AcceptConsentResult> => {
        consent = {
          flashReset: consent.flashReset || operation === "flash-reset",
          frpBypass: consent.frpBypass || operation === "frp-bypass",
          unlockScreen: consent.unlockScreen || operation === "unlock-screen",
        };
        return {
          ok: true,
          flashReset: consent.flashReset,
          frpBypass: consent.frpBypass,
          unlockScreen: consent.unlockScreen,
        };
      },
      flashReset: (options?: OperationOptions): Promise<OperationResult> =>
        simulateOperation("flash-reset", options),
      frpBypass: (options?: OperationOptions): Promise<OperationResult> =>
        simulateOperation("frp-bypass", options),
      unlockScreen: (options?: OperationOptions): Promise<OperationResult> =>
        simulateOperation("unlock-screen", options),
      rebootMode: (mode: RebootMode): Promise<OperationResult> => simulateReboot(mode),
      onOperationEvent: (cb: (event: OperationEvent) => void): (() => void) => {
        operationListeners.add(cb);
        // Synthetic "simulated" event so the UI can be explored on subscribe.
        cb({
          op: "flash-reset",
          stage: "simulated",
          message: "Web preview mode — operation events are simulated.",
          pct: 0,
        });
        return () => {
          operationListeners.delete(cb);
        };
      },
      onLog: (cb: (payload: DeviceLogPayload) => void): (() => void) => {
        deviceLogListeners.add(cb);
        return () => {
          deviceLogListeners.delete(cb);
        };
      },
      setLogSink: (enabled: boolean): void => {
        deviceLogSinkEnabled = Boolean(enabled);
      },
    },
    links: {
      openExternal: async (url: string): Promise<void> => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    updater: {
      check: async (): Promise<{ started: boolean; error?: string }> => ({
        started: false,
        error: "Updates are handled by the FRPB desktop app.",
      }),
      download: async (): Promise<{ started: boolean }> => ({ started: false }),
      install: async (): Promise<{ started: boolean }> => ({ started: false }),
      onStatus: noopUnsubscribe,
    },
    system: {
      // Browser preview has no Electron userData; clear the web equivalents so
      // the in-app reset control behaves consistently in both environments.
      reset: async (): Promise<ResetResult> => {
        const cleared: string[] = [];
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
          cleared.push("browser localStorage + sessionStorage");
        } catch {
          // Storage can be unavailable under strict privacy settings.
        }
        return { ok: true, cleared, cachePath: "(browser preview — no Electron userData)" };
      },
      cacheInfo: async (): Promise<{ cachePath: string }> => ({
        cachePath: "(browser preview — no Electron userData)",
      }),
    },
  };
}

/**
 * True when the web-preview mock is active (plain browser against the Vite dev
 * server). Never true in the packaged app, where the real preload bridge runs.
 */
export function isWebPreviewMode(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>)[WEB_PREVIEW_MARKER] === true
  );
}

/**
 * Ensures `window.frpb` always exists before React mounts. If the real
 * Electron bridge is missing (plain browser), installs the web-preview mock.
 * Safe to call multiple times.
 *
 * Dev-only by design: `import.meta.env.DEV` is statically replaced by Vite, so
 * production bundles tree-shake this function — and the master test key the
 * mock embeds — out of the shipped artifact. End users can never see or use it.
 */
export function installFrpbFallback(): void {
  if (!import.meta.env.DEV) return;
  if (!window.frpb) {
    (window as unknown as { frpb: FrpbBridge }).frpb = createWebBridge();
    (window as unknown as Record<string, unknown>)[WEB_PREVIEW_MARKER] = true;
    console.info(
      "[frpb:web] Browser preview mode — window.frpb mock installed."
    );
  }
}
