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

import { searchModels as sharedSearchModels } from "@frpb/shared";
import type {
  AcceptConsentResult,
  ConsentState,
  DeviceAutoDetected,
  DeviceInfo,
  DeviceInfoSnapshot,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  FreeToolLogLine,
  FreeToolOperationEvent,
  FreeToolRunRequest,
  FreeToolRunResult,
  FrpbBridge,
  IcloudBypassOptions,
  IcloudBypassResult,
  IcloudStatus,
  SamsungAccountOptions,
  SamsungAccountResult,
  BootloopOptions,
  BootloopResult,
  FirmwarePackage,
  DataRecoveryOptions,
  DataRecoveryItem,
  DataRecoveryScanResult,
  DataRecoveryExtractResult,
  HardwareSnapshot,
  LicenseProfile,
  LicenseSession,
  LogEntry,
  ModelCatalogEntry,
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
  const deviceInfoListeners = new Set<(info: DeviceInfoSnapshot) => void>();
  const autoDetectedListeners = new Set<(info: DeviceAutoDetected) => void>();
  const hardwareListeners = new Set<(snapshot: HardwareSnapshot) => void>();
  const freeToolListeners = new Set<(event: FreeToolOperationEvent) => void>();
  // Mirrors the main-process `deviceLogSinkEnabled` flag driven by
  // `setLogSink`; raw chunks are only mirrored while a Console surface listens.
  let deviceLogSinkEnabled = true;
  let consent: ConsentState = {
    flashReset: false,
    frpBypass: false,
    unlockScreen: false,
    rebootMode: false,
    icloudBypass: false,
    samsungAccount: false,
    bootloopRecovery: false,
    dataRecovery: false,
  };

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
    recovery: "Samsung FRP Recovery Wizard",
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

  // Mock of the free-utilities run channel. Browser preview has no real device,
  // so this validates the request the same way electron/ipc/free-tools.ts does
  // (acknowledgement + lat/lng) and then streams a synthetic, honestly-labelled
  // result. It never fabricates a "connected" device, mirroring the rest of the
  // web bridge, but keeps the Free Utilities tab fully explorable.
  function emitFreeTool(event: FreeToolOperationEvent): void {
    freeToolListeners.forEach((cb) => cb(event));
  }

  async function simulateFreeTool(request: FreeToolRunRequest): Promise<FreeToolRunResult> {
    const tool = request.tool;
    const startedAt = Date.now();
    const logs: FreeToolLogLine[] = [];
    const push = (level: FreeToolLogLine["level"], message: string): void => {
      logs.push({ level, message, at: Date.now() - startedAt });
    };
    const broadcast = (
      phase: FreeToolRunResult["phase"],
      progress: number | null,
      message: string
    ): FreeToolRunResult => {
      const result: FreeToolRunResult = {
        tool,
        phase,
        progress,
        message,
        success: phase === "success",
        logs: [...logs],
      };
      emitFreeTool({ tool, result });
      return result;
    };

    if (tool === "data-eraser" && !request.acknowledged) {
      push("error", "The erase must be explicitly acknowledged.");
      return broadcast("error", null, "Confirmation required before erasing.");
    }
    if (
      tool === "virtual-location" &&
      (typeof request.latitude !== "number" ||
        typeof request.longitude !== "number" ||
        !Number.isFinite(request.latitude) ||
        !Number.isFinite(request.longitude))
    ) {
      push("error", "A valid latitude and longitude are required.");
      return broadcast("error", null, "Enter valid coordinates first.");
    }

    const stages: Array<[number, string]> = [
      [10, "Preparing tool…"],
      [35, "Connecting to device…"],
      [70, "Running operation…"],
    ];
    for (const [pct, message] of stages) {
      push("info", message);
      broadcast("running", pct, message);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    push("warn", "Web preview mode — no real device was touched.");
    push("success", "Simulation complete.");
    return broadcast(
      "success",
      100,
      "Simulated in web preview mode — connect the FRPB desktop app to run the real tool."
    );
  }

  // Browser-preview activation session. Persisted to localStorage (the browser
  // analogue of the Electron safeStorage cache) so a refresh keeps the user
  // logged in, mirroring the desktop "stay activated" behaviour.
  const WEB_SESSION_KEY = "frpb.license.session";

  function readWebSession(): LicenseSession | null {
    try {
      const raw = window.localStorage.getItem(WEB_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LicenseSession;
      return parsed?.profile ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeWebSession(profile: LicenseProfile): void {
    try {
      window.localStorage.setItem(
        WEB_SESSION_KEY,
        JSON.stringify({ profile, verifiedAt: new Date().toISOString(), active: true })
      );
    } catch {
      // Storage may be unavailable under strict privacy settings.
    }
  }

  // ─── Consent-gated feature mocks (iCloud / Samsung / Bootloop / Data recovery).
  // Browser preview has no real hardware, so each mock streams the SAME run-state
  // + operation-event shape as the real main-process handlers (see
  // electron/ipc/device.ts) — the progress bars and log panels stay fully
  // exercisable — while never claiming a real device was touched.

  async function simulateFeatureOp(
    op: OperationKind,
    steps: Array<[string, string, number]>,
    delayMs = 450
  ): Promise<void> {
    emitRunState({ running: true, op, logs: [] });
    try {
      for (const [stage, message, pct] of steps) {
        emitOperation({ op, stage, message, pct });
        emitDeviceLog(op, `${message}\n`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } finally {
      emitRunState({ running: false, op: null });
    }
  }

  async function simulateIcloudBypass(
    options?: IcloudBypassOptions
  ): Promise<IcloudBypassResult> {
    const target = options?.imei ? `IMEI ${options.imei}` : "the connected device";
    await simulateFeatureOp("icloud-bypass", [
      ["checking", "Checking device eligibility…", 10],
      ["detecting", `Reading iCloud lock status for ${target}…`, 35],
      ["requesting", "Requesting activation-lock removal…", 70],
      ["done", "iCloud activation lock removed.", 100],
    ]);
    return {
      success: true,
      message: "Simulated in web preview mode — no real device was touched.",
      requestId: `web-icloud-${Date.now()}`,
      detail: "Connect the FRPB desktop app to run the real iCloud bypass engine.",
    };
  }

  async function simulateSamsungAccount(
    options?: SamsungAccountOptions
  ): Promise<SamsungAccountResult> {
    const method = options?.method ?? "find-my-mobile";
    await simulateFeatureOp("samsung-account", [
      ["checking", `Preparing ${method} removal…`, 15],
      ["connecting", "Connecting to the Samsung account service…", 45],
      ["removing", "Removing the Samsung account lock…", 80],
      ["done", "Samsung account lock removed.", 100],
    ]);
    return {
      success: true,
      message: "Simulated in web preview mode — no real device was touched.",
      detail: "Connect the FRPB desktop app to run the real Samsung account bypass.",
      accountRemoved: true,
    };
  }

  async function simulateBootloopRecovery(
    options?: BootloopOptions
  ): Promise<BootloopResult> {
    const target = options?.model ?? options?.brand ?? "the connected device";
    await simulateFeatureOp("bootloop-recovery", [
      ["checking", `Verifying firmware for ${target}…`, 15],
      ["flashing", "Flashing stock firmware (no real write in preview)…", 60],
      ["rebooting", "Rebooting the device…", 90],
      ["done", "Bootloop recovery complete.", 100],
    ]);
    return {
      success: true,
      message: "Simulated in web preview mode — no firmware was flashed.",
      detail: "Connect the FRPB desktop app to run the real bootloop recovery.",
      rebooted: true,
    };
  }

  function firmwareCatalog(): FirmwarePackage[] {
    return [
      {
        id: "web-fw-1",
        brand: "Samsung",
        model: "Galaxy A54",
        chipset: "Samsung Exynos",
        androidVersion: "14",
        filename: "A546BXXU5CXE1.tar.md5",
        sizeBytes: 4_800_000_000,
      },
      {
        id: "web-fw-2",
        brand: "Xiaomi",
        model: "Redmi Note 12",
        chipset: "Qualcomm",
        androidVersion: "13",
        filename: "redmi_note_12_fastboot.zip",
        sizeBytes: 3_200_000_000,
      },
      {
        id: "web-fw-3",
        brand: "Google",
        model: "Pixel 7",
        chipset: "Unknown",
        androidVersion: "14",
        filename: "panther-factory-14.zip",
        sizeBytes: 2_900_000_000,
      },
    ];
  }

  async function simulateDataRecoveryScan(
    options?: DataRecoveryOptions
  ): Promise<DataRecoveryScanResult> {
    const scope = options?.paths?.length ? options.paths.join(", ") : "common media locations";
    await simulateFeatureOp("data-recovery-scan", [
      ["scanning", `Scanning ${scope}…`, 30],
      ["indexing", "Indexing photos, videos and messages…", 70],
      ["done", "Scan complete.", 100],
    ]);
    const items: DataRecoveryItem[] = [
      {
        id: "web-photo-1",
        name: "IMG_20240112_101533.jpg",
        category: "photo",
        sourcePath: "/sdcard/DCIM/Camera/IMG_20240112_101533.jpg",
        sizeBytes: 4_300_000,
        recoverable: true,
      },
      {
        id: "web-video-1",
        name: "VID_20240101_220014.mp4",
        category: "video",
        sourcePath: "/sdcard/DCIM/Camera/VID_20240101_220014.mp4",
        sizeBytes: 88_000_000,
        recoverable: true,
      },
      {
        id: "web-sms-1",
        name: "mmssms.db",
        category: "sms",
        sourcePath: "/data/data/com.android.providers.telephony/databases/mmssms.db",
        sizeBytes: 1_200_000,
        recoverable: false,
      },
    ];
    const totalSizeBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
    return {
      success: true,
      items,
      totalSizeBytes,
      message: `Found ${items.length} recoverable item(s) (web preview mode).`,
    };
  }

  async function simulateDataRecoveryExtract(
    itemIds: string[],
    destPath: string
  ): Promise<DataRecoveryExtractResult> {
    await simulateFeatureOp("data-recovery-extract", [
      ["extracting", `Extracting ${itemIds.length} item(s)…`, 50],
      ["done", "Extraction complete.", 100],
    ]);
    return {
      success: true,
      message: `Simulated extraction of ${itemIds.length} item(s) to ${destPath} (web preview mode).`,
      extractedCount: itemIds.length,
      extractedBytes: itemIds.length * 4_300_000,
      details: "Web preview mode — no files were written to disk.",
    };
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
          writeWebSession(profile);
          return {
            httpStatus: 200,
            success: true,
            status: "ACTIVE",
            license: profile,
            isMasterTest: true,
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
      getCachedProfile: async (): Promise<LicenseProfile | null> =>
        readWebSession()?.profile ?? null,
      getSession: async (): Promise<LicenseSession | null> => readWebSession(),
      clearSession: async (): Promise<{ ok: boolean; removed: boolean }> => {
        let removed = false;
        try {
          removed = window.localStorage.getItem(WEB_SESSION_KEY) !== null;
          window.localStorage.removeItem(WEB_SESSION_KEY);
        } catch {
          // Storage may be unavailable.
        }
        return { ok: true, removed };
      },
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
      /**
       * Mirrors electron/ipc/device.ts `device:acceptConsent` EXACTLY.
       *
       * The main process only accepts the consent-gated operations (see
       * CONSENT_OPS there) and rejects anything else with
       * `{ ok: false, error: "Unknown operation: X" }`. This mock previously
       * accepted ANY OperationKind — including "reboot-mode", which is
       * deliberately NOT consent-gated — so browser preview behaved more
       * permissively than the shipped app and could mask a real bug.
       */
      acceptConsent: async (
        operation: OperationKind
      ): Promise<AcceptConsentResult> => {
        if (
          operation !== "flash-reset" &&
          operation !== "frp-bypass" &&
          operation !== "unlock-screen" &&
          operation !== "icloud-bypass" &&
          operation !== "samsung-account" &&
          operation !== "bootloop-recovery" &&
          operation !== "data-recovery"
        ) {
          return { ok: false, error: `Unknown operation: ${String(operation)}` };
        }
        consent = {
          flashReset: consent.flashReset || operation === "flash-reset",
          frpBypass: consent.frpBypass || operation === "frp-bypass",
          unlockScreen: consent.unlockScreen || operation === "unlock-screen",
          rebootMode: consent.rebootMode,
          icloudBypass: consent.icloudBypass || operation === "icloud-bypass",
          samsungAccount: consent.samsungAccount || operation === "samsung-account",
          bootloopRecovery:
            consent.bootloopRecovery || operation === "bootloop-recovery",
          dataRecovery: consent.dataRecovery || operation === "data-recovery",
        };
        return {
          ok: true,
          flashReset: consent.flashReset,
          frpBypass: consent.frpBypass,
          unlockScreen: consent.unlockScreen,
          rebootMode: consent.rebootMode,
          icloudBypass: consent.icloudBypass,
          samsungAccount: consent.samsungAccount,
          bootloopRecovery: consent.bootloopRecovery,
          dataRecovery: consent.dataRecovery,
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
      // Browser preview has no real hardware. Report an honest disconnected
      // snapshot (never a phantom device) so the auto-read panel renders its
      // empty state instead of fabricated hardware values.
      onInfoUpdated: (cb: (info: DeviceInfoSnapshot) => void): (() => void) => {
        deviceInfoListeners.add(cb);
        return () => {
          deviceInfoListeners.delete(cb);
        };
      },
      requestInfo: async (): Promise<DeviceInfoSnapshot> => ({
        connected: false,
        serial: null,
        model: null,
        brand: null,
        vendor: null,
        vid: null,
        pid: null,
        port: null,
        chipset: null,
        mode: null,
        mtp: null,
        driverInstalled: false,
        source: null,
        lastScanAt: new Date().toISOString(),
        hardwareMode: "none",
        hardwareLabel: "No Device",
        deviceInstanceId: null,
        requiresKeyCombo: false,
        listening: false,
      }),
      // Browser preview has no USB/COM bus — report an honest empty snapshot so
      // the wizard renders its "Listening…" state and never fabricates a device.
      hardwareStatus: async (): Promise<HardwareSnapshot> => ({
        mode: "none",
        label: "No Device",
        connected: false,
        vid: null,
        pid: null,
        vidHex: null,
        pidHex: null,
        port: null,
        chipset: "Unknown",
        deviceInstanceId: null,
        deviceName: null,
        listenerActive: false,
        requiresKeyCombo: false,
        lowLevel: false,
        lastScanAt: new Date().toISOString(),
      }),
      rescan: async (): Promise<HardwareSnapshot> => ({
        mode: "none",
        label: "No Device",
        connected: false,
        vid: null,
        pid: null,
        vidHex: null,
        pidHex: null,
        port: null,
        chipset: "Unknown",
        deviceInstanceId: null,
        deviceName: null,
        listenerActive: false,
        requiresKeyCombo: false,
        lowLevel: false,
        lastScanAt: new Date().toISOString(),
      }),
      waitForHardware: async (): Promise<HardwareSnapshot | null> => {
        // No hardware in a browser: never resolve with a phantom device.
        await new Promise((resolve) => setTimeout(resolve, 600));
        return null;
      },
      onHardware: (cb: (snapshot: HardwareSnapshot) => void): (() => void) => {
        hardwareListeners.add(cb);
        return () => {
          hardwareListeners.delete(cb);
        };
      },
      // Browser preview has no hardware — subscribe but never fabricate a
      // device, mirroring the honest disconnected snapshot above.
      onAutoDetected: (cb: (info: DeviceAutoDetected) => void): (() => void) => {
        autoDetectedListeners.add(cb);
        return () => {
          autoDetectedListeners.delete(cb);
        };
      },
      searchModels: async (opts?: {
        query?: string | null;
        brand?: string | null;
        chipset?: string | null;
      }): Promise<ModelCatalogEntry[]> => {
        const chipset =
          opts?.chipset === "MediaTek" ||
          opts?.chipset === "Qualcomm" ||
          opts?.chipset === "Samsung Exynos" ||
          opts?.chipset === "Unknown"
            ? opts.chipset
            : null;
        return sharedSearchModels({
          query: opts?.query ?? null,
          brand: opts?.brand ?? null,
          chipset,
        });
      },
      // Browser preview has no hardware. Return a stable, obviously-synthetic
      // fingerprint (seeded by the optional device label so different labels
      // still differ) that can never collide with a real machine hash.
      getHardwareId: async (deviceLabel?: string): Promise<string> => {
        const seed = (deviceLabel ?? "web-preview").toLowerCase();
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) {
          hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
        }
        return `WEB-PREVIEW-HWID-${hash.toString(16).padStart(8, "0")}`;
      },
      // Consent-gated feature mocks. Present so the browser preview exposes the
      // same FrpbBridge surface as the packaged app (type parity) and the
      // iCloud / Samsung / Bootloop / Data-recovery panels stay interactive.
      icloudBypass: (options?: IcloudBypassOptions): Promise<IcloudBypassResult> =>
        simulateIcloudBypass(options),
      icloudStatus: async (): Promise<IcloudStatus> => ({
        requestId: "web-preview",
        status: "completed",
        message: "Web preview mode — iCloud status is simulated.",
        progress: 100,
      }),
      icloudDetect: async (): Promise<IcloudStatus | null> => null,
      samsungAccountBypass: (
        options?: SamsungAccountOptions
      ): Promise<SamsungAccountResult> => simulateSamsungAccount(options),
      bootloopRecovery: (options?: BootloopOptions): Promise<BootloopResult> =>
        simulateBootloopRecovery(options),
      listFirmwarePackages: async (): Promise<FirmwarePackage[]> => firmwareCatalog(),
      dataRecoveryScan: (
        options?: DataRecoveryOptions
      ): Promise<DataRecoveryScanResult> => simulateDataRecoveryScan(options),
      dataRecoveryExtract: (
        itemIds: string[],
        destPath: string
      ): Promise<DataRecoveryExtractResult> =>
        simulateDataRecoveryExtract(itemIds, destPath),
    },
    freeTools: {
      run: (request: FreeToolRunRequest): Promise<FreeToolRunResult> =>
        simulateFreeTool(request),
      onEvent: (cb: (event: FreeToolOperationEvent) => void): (() => void) => {
        freeToolListeners.add(cb);
        return () => {
          freeToolListeners.delete(cb);
        };
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
