// FRPB — IPC: device detection + ADB/USB operations.
//
// One unified status scan (ADB-first, USB fallback with driver health) feeds
// `device:status`, `device:getStatus`, and the 2s `device:status-changed`
// push, so Device Monitor and FRP Tools always render identical state. The
// ADB/USB operation engine runs brand-agnostic real ADB operations (flash
// reset + FRP secure wipe) behind a main-process-enforced consent gate;
// operation readiness is computed fresh on demand (never a stale cache).
//
// IPC surface emitted by this module:
//   device:status                  → DeviceStatus (unified ADB+USB scan)
//   device:status-changed (push)   → DeviceStatus (+ running/logs run-state)
//   device:getStatus (handle)      → DeviceStatus (same unified scan)
//   device:startPolling / stopPolling (handle)
//   device:listModels (handle)     → { models: string[], detectedModel?: string }
//   device:getDeviceInfo (handle)  → DeviceInfo (throws when no authorized ADB device)
//   device:checkConsent (handle)   → { flashReset: boolean, frpBypass: boolean }
//   device:acceptConsent (handle)  → { ok: boolean; flashReset?: boolean; frpBypass?: boolean; error?: string }
//   device:operation:event (push)  → { op: "flash-reset"|"frp-bypass", stage, message, pct }
//   device:operation:status (push) → { running, op, logs } (global cross-tab run-state)
//   device:log (push)              → { op, stream, text, ts } (live child_process stdout/stderr)
//   device:flashReset (handle)     → { success, message, stdout?, detail? }
//   device:frpBypass (handle)      → { success, message, detail? }
//   device:unlockScreen (handle)   → { success, message, stdout? }
//   device:rebootMode (handle)     → { success, message, stdout? }  (bootloader|recovery|edl|system)

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import { brandFromVendorId, listKnownModels } from "../utils/android-models";
import {
  adbDevices,
  adbGetProp,
  adbReboot,
  adbWipeData,
  adbShell,
  execTool,
  fastbootDevices,
  fastbootErasePartition,
  fastbootReboot,
  fastbootWipeUserData,
  isPlatformToolsBundled,
  resolvePlatformToolPath,
  runPlatformTool,
  sleep,
  type StreamPhase,
} from "../utils/adb";
import { runFrpBypass } from "../utils/frp-engine";

// Hard ceiling for a streamed reboot/wipe/erase command. `adb reboot` returns
// almost instantly; the longer bound only covers a stalled USB transport.
const ADB_REBOOT_TIMEOUT_MS = 60_000;

// ─── USB vendor allow-list (recovery-relevant vendors only) ─────────────────
const WATCHED_VENDORS: Record<number, string> = {
  0x04e8: "Samsung",
  0x18d1: "Google",
  0x22d9: "OnePlus",
  0x2a70: "Realme",
  0x2e40: "OPPO",
  0x0e8d: "MediaTek",
  0x05c6: "Qualcomm",
  0x05ac: "Apple",
};

const OFFICIAL_DRIVER_URLS: Record<string, string> = {
  Samsung: "https://developer.samsung.com/android-usb-driver",
  Google: "https://developer.android.com/studio/run/win-usb",
  OnePlus: "https://www.oneplus.com/support/software/driver",
  OPPO: "https://www.oppo.com/us/support/",
  MediaTek: "https://support.mediatek.com/s/drivers",
  Qualcomm: "https://www.qualcomm.com/developer/software/qualcomm-usb-driver",
  Apple: "https://support.apple.com/en-us/HT204360",
};

// ─── Driver probe cache (avoid re-running pnputil every tick) ────────────────
const driverProbeCache = new Map<string, boolean>();
const DRIVER_PROBE_TTL_MS = 30_000;

interface UsbDeviceLike {
  deviceDescriptor: { idVendor: number; idProduct: number; iProduct: number };
  // node-usb only populates `interfaces` for the active configuration — some
  // peripherals (or mid-enumeration devices) expose none, so treat as optional.
  interfaces?: Array<{ descriptor: { bInterfaceClass: number } }>;
}

/**
 * Transport mode the phone was guided into on the method screen. FRP-locked
 * devices cannot open Android Settings, so USB debugging/ADB is never a
 * prerequisite here — the engine waits for the physical transport instead.
 * Mirrors `OperationMode` in ../src/lib/ipc.d.ts (main is the authority).
 */
type OperationMode = "test-mode" | "brom" | "fastboot-recovery";

/**
 * Per-invocation engine guidance passed through the preload bridge.
 */
interface OperationOptions {
  brand?: string | null;
  mode?: OperationMode;
}

/**
 * Human label + the transport(s) that count as "phone is ready" for a mode.
 */
interface ModeProfile {
  label: string;
  waitHint: string;
  /** Primary vendor the transport enumerates as (0x0e8d MediaTek for BROM). */
  vendorId: number | null;
  /** True when a USB device's VID / interface classes match this mode's transport. */
  classMatch: (device: UsbDeviceLike) => boolean;
  /** Human names for the accepted USB transports (status / failure text). */
  modesLabel: string;
}

/**
 * Locked-device transport profiles. FRP-locked phones cannot open Android
 * Settings, so the engine never demands USB debugging to *start*: it watches
 * for the physical transport the method screen guided the user into — Samsung
 * Test Mode (MTP), MediaTek BROM/Preloader (VCOM), or Fastboot/Recovery — and
 * streams live progress while it waits. Samsung Test Mode and Mi Testing expose
 * an ADB session as soon as the MTP mount comes up, which is what the secure
 * wipe rides on; a bare BROM/VCOM endpoint cannot serve an ADB wipe and is
 * reported honestly instead of pretending otherwise.
 */
const MODE_PROFILES: Record<OperationMode, ModeProfile> = {
  "test-mode": {
    label: "Samsung Test Mode (MTP)",
    waitHint:
      "Waiting for phone in Samsung Test Mode — on the FRP screen tap “Emergency Call”, dial *#0*# (or *#888# / *#808#), and connect the USB cable.",
    vendorId: 0x04e8,
    classMatch: (d) =>
      Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) &&
      (d.interfaces ?? []).some((i) => i.descriptor.bInterfaceClass === 0x02),
    modesLabel: "MTP / Test Mode",
  },
  brom: {
    label: "MediaTek BROM / Preloader (VCOM)",
    waitHint:
      "Waiting for phone in MediaTek BROM — power it off, then hold Volume Up + Down and plug in the USB cable (BROM / Preloader mode).",
    vendorId: 0x0e8d,
    classMatch: (d) => d.deviceDescriptor.idVendor === 0x0e8d,
    modesLabel: "MediaTek Download / VCOM / Preloader",
  },
  "fastboot-recovery": {
    label: "Fastboot / Recovery",
    waitHint:
      "Waiting for phone in Fastboot / Recovery — power it off, then hold Volume Down + Power to boot into Fastboot or Recovery and connect the USB cable.",
    vendorId: null,
    classMatch: (d) =>
      Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) &&
      (d.interfaces ?? []).some((i) => i.descriptor.bInterfaceClass === 0xff),
    modesLabel: "Fastboot / Download Mode / MTP",
  },
};

let pollTimer: NodeJS.Timeout | null = null;

// ─── Consent gate (in-memory; resets on app restart by design) ───────────────
const CONSENT_OPS = ["flash-reset", "frp-bypass", "unlock-screen", "reboot-mode"] as const;
type ConsentOp = (typeof CONSENT_OPS)[number];
const consentGrantedFor = new Set<ConsentOp>();

// ─── One-click boot-mode switcher ────────────────────────────────────────────
// Supported reboot targets surfaced by the Home screen "Quick Boot Switcher"
// panel. Mirrors the `RebootMode` union in ../src/lib/ipc.d.ts (the main process
// is the authority on what the engine accepts).
type RebootMode = "bootloader" | "recovery" | "edl" | "system";

/** `adb reboot` argument per target (`system` omits it → plain `adb reboot`). */
const REBOOT_ADB_MODE: Record<RebootMode, string | undefined> = {
  bootloader: "bootloader",
  recovery: "recovery",
  edl: "edl",
  system: undefined,
};

/** Human label streamed to the operation console. */
const REBOOT_LABELS: Record<RebootMode, string> = {
  bootloader: "Fastboot / Bootloader",
  recovery: "Recovery",
  edl: "EDL (Emergency Download)",
  system: "System (normal boot)",
};

// ─── Global operation run-state (cross-tab console + control locking) ────────
// A single authoritative source for "is an operation running" plus a rolling
// log buffer. The Console Log tab and every operation surface subscribe to
// "device:operation:status" so an operation started in one tab is visible — and
// blocks conflicting controls — in all the others. The buffer is capped to
// bound renderer memory during chatty, high-frequency operations.
const MAX_OPERATION_LOGS = 500;

interface OperationLogEntry {
  stage: string;
  message: string;
  pct: number | null;
  kind: "info" | "warn" | "error" | "ok";
  ts: string;
  /** Monotonic identity — stable across the capped rolling buffer. */
  seq: number;
}

let operationRunning = false;
let operationKind: ConsentOp | null = null;
let operationLogs: OperationLogEntry[] = [];
// Monotonic counter backing `OperationLogEntry.seq`. Never reused, never
// reset by `beginOperation` — so a `clearLogs(upTo)` tombstone stays valid
// even when a new operation has already started.
let logSeq = 0;
// The most recently seen renderer window; used to broadcast run-state even
// outside a poll tick or a specific handle invocation.
let activeWindow: BrowserWindow | null = null;

function clockNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function liveRunState(): {
  running: boolean;
  op: ConsentOp | null;
  logs: OperationLogEntry[];
} {
  return { running: operationRunning, op: operationKind, logs: operationLogs };
}

function broadcastRunState(): void {
  const win = activeWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send("device:operation:status", liveRunState());
  } catch (err) {
    log.warn("[device] broadcastRunState failed:", err);
  }
}

function pushOperationLog(
  stage: string,
  message: string,
  pct: number | null,
  kind: OperationLogEntry["kind"] = "info"
): void {
  const next = [...operationLogs, { stage, message, pct, kind, ts: clockNow(), seq: ++logSeq }];
  operationLogs = next.length > MAX_OPERATION_LOGS ? next.slice(-MAX_OPERATION_LOGS) : next;
  broadcastRunState();
}

// ─── Live child_process log streaming (device:log) ───────────────────────────
// The real adb/fastboot spawners forward every stdout/stderr chunk the moment
// it arrives. Those chunks are (a) coalesced by line into the shared operation
// console so the Console Log tab mirrors a terminal, and (b) pushed raw over a
// dedicated `device:log` channel for a renderer that wants the un-buffered
// stream. Nothing here is mock data — it is the actual tool output.
interface DeviceLogPayload {
  op: ConsentOp | null;
  stream: StreamPhase;
  text: string;
  ts: string;
}

let deviceLogBuffer = "";
// Raw chunks are always pushed over `device:log`; mirroring them into the
// shared rolling console is opt-in so only a Console tab that subscribes
// pays the line-coalescing cost. Toggled by the renderer via
// `device:setLogSink`.
let deviceLogSinkEnabled = true;
// Chunk coalescing window: flushes ~120×/s at most, so a chatty `adb shell`
// never floods the renderer with one IPC message per byte.
const DEVICE_LOG_FLUSH_MS = 8;

function createDeviceLogSink(op: ConsentOp): (chunk: string, stream: StreamPhase) => void {
  return (chunk: string, stream: StreamPhase): void => {
    if (!chunk) return;
    const win = activeWindow;
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      try {
        const payload: DeviceLogPayload = { op, stream, text: chunk, ts: clockNow() };
        win.webContents.send("device:log", payload);
      } catch (err) {
        log.warn("[device] device:log send failed:", err);
      }
    }
    // Coalesce the raw stream and surface it as line-grained console entries,
    // but only while a Console surface has the sink enabled.
    if (!deviceLogSinkEnabled) return;
    deviceLogBuffer += chunk;
    const lines = deviceLogBuffer.split(/\r?\n/);
    deviceLogBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      pushOperationLog(stream === "err" ? "STDERR" : "STDOUT", trimmed, null, stream === "err" ? "warn" : "info");
    }
  };
}

/** Flush a trailing partial line that had no terminating newline. */
function flushDeviceLogBuffer(): void {
  const rest = deviceLogBuffer.trim();
  deviceLogBuffer = "";
  if (rest) pushOperationLog("STDOUT", rest, null, "info");
}

/**
 * Run a real platform-tool command, streaming every chunk to the operation
 * console + the `device:log` channel. Prefers a direct `spawn`; falls back to
 * the promisified `exec` shell path when a spawn throws (e.g. a wrapper script
 * that only works through the shell).
 */
async function runStreamedTool(
  op: ConsentOp,
  base: "adb" | "fastboot",
  args: string[]
): Promise<{ exitCode: number | null; stdout: string; stderr: string; notAvailable: boolean }> {
  const sink = createDeviceLogSink(op);
  try {
    const result = await runPlatformTool(base, args, ADB_REBOOT_TIMEOUT_MS, sink);
    flushDeviceLogBuffer();
    if (!result) return { exitCode: null, stdout: "", stderr: "", notAvailable: true };
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      notAvailable: false,
    };
  } catch (err) {
    log.warn(`[device] spawn ${base} failed, falling back to exec:`, err);
    try {
      const res = await execTool(base, args, sink);
      flushDeviceLogBuffer();
      return { exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr, notAvailable: false };
    } catch (err2) {
      flushDeviceLogBuffer();
      const msg = err2 instanceof Error ? err2.message : String(err2);
      log.error(`[device] exec ${base} failed:`, err2);
      return { exitCode: 1, stdout: "", stderr: msg, notAvailable: false };
    }
  }
}

function beginOperation(op: ConsentOp): void {
  operationRunning = true;
  operationKind = op;
  operationLogs = [];
  broadcastRunState();
}

function endOperation(): void {
  operationRunning = false;
  operationKind = null;
  broadcastRunState();
}

/**
 * True while a device operation is in flight. Exported so other IPC modules
 * (e.g. future flash/erase handlers) can reject a conflicting request before
 * it reaches the device, enforcing cross-tab control locking in the main
 * process as well as in the renderer.
 */
export function isOperationRunning(): boolean {
  return operationRunning;
}

// ─── Lazy-loaded node-usb ────────────────────────────────────────────────────
function loadUsb(): {
  getDeviceList: () => UsbDeviceLike[];
  findByIds: (vendorId: number, productId: number) => UsbDeviceLike | undefined;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const usb = require("usb");
    return usb;
  } catch (err) {
    log.warn(`node-usb unavailable (${err}); USB polling disabled`);
    return null;
  }
}

// ─── Handler registration ────────────────────────────────────────────────────

export function registerDeviceHandlers(): void {
  ipcMain.handle("device:status", async () => ({
    ...(await scanUnified()),
    running: operationRunning,
    logs: operationLogs,
  }));

  ipcMain.handle("device:getStatus", async () => ({
    ...(await scanUnified()),
    running: operationRunning,
    logs: operationLogs,
  }));

  // Authoritative run-state snapshot. The renderer calls this on mount so a
  // Console Log tab opened mid-operation shows the full rolling buffer, and
  // after a renderer crash/restart the UI can re-seed from the main process
  // (which keeps running independently of the renderer).
  ipcMain.handle("device:getRunState", () => liveRunState());

  // Explicit alias for the crash-recovery path: returns the same snapshot but
  // exists as a named, self-documenting contract for "adopt main-process state".
  ipcMain.handle("device:seedLogs", () => liveRunState());

  // Clear the global rolling log buffer. Keeps the `seq` counter advancing so
  // the renderer tombstone (`seq <= upTo`) remains meaningful, then broadcasts
  // the empty state to every subscribed Console surface.
  ipcMain.handle("device:clearLogs", (_event, upTo?: number) => {
    const tombstone = typeof upTo === "number" && upTo > 0 ? upTo : logSeq;
    operationLogs = operationLogs.filter((e) => e.seq > tombstone);
    broadcastRunState();
    return undefined;
  });

  ipcMain.handle("device:startPolling", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) startPolling(win);
    return undefined;
  });

  ipcMain.handle("device:stopPolling", () => {
    stopPolling();
    return undefined;
  });

  // Renderer → main toggle: when a Console Log surface mounts it enables the
  // sink so live adb/fastboot output is mirrored into the rolling console; when
  // it unmounts it disables the sink so headless operations stay quiet.
  ipcMain.on("device:setLogSink", (_event, enabled: unknown) => {
    deviceLogSinkEnabled = Boolean(enabled);
  });

  ipcMain.handle("device:listModels", async () => {
    const devices = await adbDevices();
    if (!devices || devices.length === 0) {
      return { models: listKnownModels(), detectedModel: undefined };
    }
    const detectedModel = devices[0]?.model;
    return { models: listKnownModels(), detectedModel };
  });

  ipcMain.handle("device:getDeviceInfo", async () => {
    const adb = await probeAdb();
    if (!adb.connected) {
      throw new Error("No ADB device connected");
    }
    if (!adb.authorized) {
      throw new Error("Device not authorized — enable USB debugging");
    }
    // Read full property set in parallel for speed.
    const [
      brand,
      model,
      device,
      name,
      product,
      hardware,
      fingerprint,
      board,
      cpuAbi,
      cpuAbi2,
      versionRelease,
      sdk,
      securityPatch,
      incremental,
      previewSdk,
      bootimageFingerprint,
      boardPlatform,
      serial,
      secureboot,
      hardwareType,
      wifiHostname,
      buildDate,
      buildDateUtc,
      versionIncremental,
      versionSdk,
      versionReleaseMeta,
      versionSecurityPatch,
      versionPreviewSdk,
      bootimageBuildFingerprint,
      manufacturer,
      manufacturer2,
    ] = await Promise.all([
      adbGetProp("ro.product.brand", adb.serial!),
      adbGetProp("ro.product.model", adb.serial!),
      adbGetProp("ro.product.device", adb.serial!),
      adbGetProp("ro.product.name", adb.serial!),
      adbGetProp("ro.product.name", adb.serial!),
      adbGetProp("ro.product.hardware", adb.serial!),
      adbGetProp("ro.build.fingerprint", adb.serial!),
      adbGetProp("ro.build.board", adb.serial!),
      adbGetProp("ro.product.cpu.abi", adb.serial!),
      adbGetProp("ro.product.cpu.abi2", adb.serial!),
      adbGetProp("ro.build.version.release", adb.serial!),
      adbGetProp("ro.build.version.sdk", adb.serial!),
      adbGetProp("ro.build.version.security_patch", adb.serial!),
      adbGetProp("ro.build.version.incremental", adb.serial!),
      adbGetProp("ro.build.version.preview_sdk", adb.serial!),
      adbGetProp("ro.bootimage.build.fingerprint", adb.serial!),
      adbGetProp("ro.board.platform", adb.serial!),
      adbGetProp("ro.serialno", adb.serial!),
      adbGetProp("ro.secureboot", adb.serial!),
      adbGetProp("ro.hardware", adb.serial!),
      adbGetProp("ro.wifi.hostname", adb.serial!),
      adbGetProp("ro.build.date", adb.serial!),
      adbGetProp("ro.build.date.utc", adb.serial!),
      adbGetProp("ro.build.version.incremental", adb.serial!),
      adbGetProp("ro.build.version.sdk", adb.serial!),
      adbGetProp("ro.build.version.release", adb.serial!),
      adbGetProp("ro.build.version.security_patch", adb.serial!),
      adbGetProp("ro.build.version.preview_sdk", adb.serial!),
      adbGetProp("ro.bootimage.build.fingerprint", adb.serial!),
      adbGetProp("ro.product.manufacturer", adb.serial!),
      adbGetProp("ro.product.manufacturer", adb.serial!),
    ]);

    return {
      build: {
        brand: brand ?? "",
        manufacturer: manufacturer ?? "",
        manufacturer2: manufacturer2 ?? "",
        model: model ?? "",
        device: device ?? "",
        name: name ?? "",
        product: product ?? "",
        hardware: hardware ?? "",
        fingerprint: fingerprint ?? "",
        board: board ?? "",
        cpu_abi: cpuAbi ?? "",
        cpu_abi2: cpuAbi2 ?? "",
      },
      os: {
        version_release: versionRelease ?? "",
        sdk: sdk ?? "",
        security_patch: securityPatch ?? "",
        incremental: incremental ?? "",
        preview_sdk: previewSdk ?? "",
        bootimage_fingerprint: bootimageFingerprint ?? undefined,
      },
      hardware: {
        chipset: boardPlatform ?? "",
        platform: boardPlatform ?? "",
        cpu_abi: cpuAbi ?? "",
        board_platform: boardPlatform ?? "",
        serial: serial ?? "",
        secureboot: secureboot ?? undefined,
        hardware_type: hardwareType ?? undefined,
      },
      identity: {
        serialno: serial ?? "",
        wifi_hostname: wifiHostname ?? "",
        product_name: name ?? "",
        product_device: device ?? "",
        product_board: board ?? "",
        product_manufacturer: manufacturer ?? "",
        product_brand: brand ?? "",
        build_product: product ?? "",
      },
      buildMeta: {
        date: buildDate ?? "",
        dateUtc: buildDateUtc ?? "",
        versionIncremental: versionIncremental ?? "",
        versionSdk: versionSdk ?? "",
        versionRelease: versionReleaseMeta ?? "",
        versionSecurityPatch: versionSecurityPatch ?? "",
        versionPreviewSdk: versionPreviewSdk ?? "",
        bootimageBuildFingerprint: bootimageBuildFingerprint ?? undefined,
      },
      extra: {
        cpuAbi: cpuAbi ?? "",
        hardware: hardware ?? "",
        manufacturer: manufacturer ?? "",
        model: model ?? "",
        device: device ?? "",
        brand: brand ?? "",
        name: name ?? "",
        product: product ?? "",
        board: board ?? "",
        fingerprint: fingerprint ?? "",
        platform: boardPlatform ?? "",
        chipset: boardPlatform ?? "",
        serial: serial ?? "",
        securityPatch: securityPatch ?? "",
        androidVersion: versionRelease ?? "",
        sdkVersion: sdk ?? "",
      },
    };
  });

  ipcMain.handle("device:checkConsent", () => ({
    flashReset: consentGrantedFor.has("flash-reset"),
    frpBypass: consentGrantedFor.has("frp-bypass"),
    unlockScreen: consentGrantedFor.has("unlock-screen"),
  }));

  ipcMain.handle("device:acceptConsent", (_event, operation: unknown) => {
    const op = String(operation);
    if (!CONSENT_OPS.includes(op as ConsentOp)) {
      return { ok: false, error: `Unknown operation: ${op}` };
    }
    consentGrantedFor.add(op as ConsentOp);
    log.info(`[device] consent granted for ${op}`);
    return {
      ok: true,
      flashReset: consentGrantedFor.has("flash-reset"),
      frpBypass: consentGrantedFor.has("frp-bypass"),
      unlockScreen: consentGrantedFor.has("unlock-screen"),
    };
  });

  // Single handler for device:frpBypass — sanitizes + delegates to runFrpBypass.
  ipcMain.handle("device:frpBypass", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;
    const opts = sanitizeFrpOptions(options);
    const transportMap: Record<string, "usb" | "download" | "edl" | "brom" | "adb"> = {
      "setup-wizard": "usb",
      "download-mode": "download",
      "edl-mode": "edl",
      "mtk-brom": "brom",
      "oem-service": "usb",
    };
    // sanitizeFrpOptions maps the renderer's locked-device `mode` (test-mode /
    // brom / fastboot-recovery) onto a concrete engine `method`, so the map
    // below always yields the correct transport for the selected guide.
    const transport = transportMap[opts.method] ?? "usb";
    beginOperation("frp-bypass");
    pushOperationLog("START", `Starting FRP bypass (${opts.method})…`, 0);
    try {
      const result = await runFrpBypass(
        {
          ...opts,
          transport,
          androidVersion: opts.androidVersion ? parseInt(opts.androidVersion, 10) : undefined,
        },
        (stage, pct, message) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send("device:operation:event", {
              op: "frp-bypass",
              stage,
              message,
              pct,
            });
          }
          pushOperationLog(stage.toUpperCase(), message, pct);
        }
      );
      // Map BypassResult → OperationResult so the renderer always gets a typed
      // { success, message, detail? } shape. Never leak BypassResult internals.
      if (result.status === "success") {
        const message = result.detail || "FRP lock removed successfully.";
        pushOperationLog("DONE", message, 100, "ok");
        return { success: true, message, detail: result.detail };
      }
      // Narrow the union: only the "failed" variant carries `error`; the
      // pending/running variants carry a `message`.
      const message =
        result.status === "failed"
          ? result.error || "Operation failed."
          : result.message || "Operation failed.";
      pushOperationLog("ERROR", message, null, "error");
      return { success: false, message };
    } finally {
      // Always clear the global running flag, even if the engine throws, so
      // other tabs are never permanently locked out.
      endOperation();
    }
  });

  // device:flashReset — wipe the userdata partition on the connected phone.
  // Consent-gated exactly like device:frpBypass so the renderer cannot trigger
  // a destructive wipe without the legal modal. Runs real adb/fastboot processes
  // and streams every stdout/stderr chunk to the UI via `device:log`.
  ipcMain.handle("device:flashReset", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;
    const opts = sanitizeOperationOptions(options);
    beginOperation("flash-reset");
    pushOperationLog("START", `Starting flash reset${opts.brand ? ` (${opts.brand})` : ""}…`, 0);
    try {
      // ── Preferred transport: ADB (device booted / recovery with debugging) ──
      const adb = await probeAdb();
      if (adb.connected && adb.serial && adb.authorized) {
        const adbPath = await resolvePlatformToolPath("adb");
        pushOperationLog(
          "RESOLVE",
          `ADB device ${adb.serial} ready — using ${adbPath ?? "adb (PATH)"}…`,
          20
        );
        pushOperationLog("WIPE", `adb shell recovery --wipe_data (${adb.serial})…`, 45);
        const wipe = await runStreamedTool("flash-reset", "adb", [
          "-s",
          adb.serial,
          "shell",
          "recovery",
          "--wipe_data",
        ]);
        const combined = `${wipe.stdout} ${wipe.stderr}`.trim();
        if (wipe.notAvailable) {
          const message = "ADB tools not installed — cannot wipe user data.";
          pushOperationLog("ERROR", message, null, "error");
          return { success: false, message };
        }
        if (wipe.exitCode !== 0) {
          const detail = wipe.stderr || wipe.stdout || `adb exited ${wipe.exitCode}`;
          const message = `Flash reset failed: ${detail}`;
          pushOperationLog("ERROR", message, null, "error");
          return { success: false, message, stdout: combined };
        }
        // Wipe accepted — reboot the device so it comes back clean.
        pushOperationLog("REBOOT", "Data wiped — rebooting device…", 85);
        await runStreamedTool("flash-reset", "adb", ["-s", adb.serial, "reboot", "recovery"]);
        const message = "Flash reset complete.";
        pushOperationLog("DONE", message, 100, "ok");
        return { success: true, message, stdout: combined };
      }

      // ── Fallback transport: Fastboot (bootloader mode, no ADB shell) ───────
      // A locked phone is often only reachable in bootloader/fastboot mode, so
      // the ADB-only path above would dead-end. Probe fastboot before failing.
      pushOperationLog(
        "MODE",
        adb.connected
          ? "ADB device unauthorized — trying Fastboot…"
          : "No ADB device — trying Fastboot…",
        20
      );
      const devices = await fastbootDevices();
      if (devices === null) {
        const message = adb.connected
          ? "Device not authorized — enable USB debugging or use a supported recovery mode."
          : "No ADB or Fastboot device connected. Boot the phone into Fastboot/Recovery and retry.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      const serial = devices[0];
      if (!serial) {
        const message =
          "No Fastboot device detected. Boot the phone into Fastboot mode (Vol Down + Power) and retry.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }

      const fastbootPath = await resolvePlatformToolPath("fastboot");
      pushOperationLog(
        "RESOLVE",
        `Fastboot device ${serial} — using ${fastbootPath ?? "fastboot (PATH)"}…`,
        35
      );

      // `fastboot erase userdata` — clears the data partition. This is the
      // primary path; `fastbootWipeUserData` stays as the firmware-aware
      // fallback for bootloaders that reject a bare erase.
      pushOperationLog("WIPE", `fastboot erase userdata (${serial})…`, 50);
      const userdata = await runStreamedTool("flash-reset", "fastboot", [
        "-s",
        serial,
        "erase",
        "userdata",
      ]);
      if (userdata.notAvailable) {
        const message = "Fastboot tools not installed — cannot erase userdata.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      const streamed: string[] = [];
      if (userdata.stdout) streamed.push(userdata.stdout);
      if (userdata.stderr) streamed.push(userdata.stderr);

      if (userdata.exitCode !== 0) {
        pushOperationLog(
          "WARN",
          "fastboot erase userdata rejected — retrying with the firmware-aware wipe…",
          null,
          "warn"
        );
        const wipe = await fastbootWipeUserData(serial);
        if (!wipe.ok) {
          const message = wipe.detail
            ? `Fastboot reset failed: ${wipe.detail}`
            : "Fastboot reset failed.";
          pushOperationLog("ERROR", message, null, "error");
          return { success: false, message, stdout: streamed.join("\n") };
        }
        pushOperationLog("WIPE", `Fallback wipe accepted (${wipe.detail ?? "fastboot -w"})…`, 70);
      }

      // `fastboot erase cache` — best-effort; a missing/absent cache partition
      // must not abort an otherwise successful userdata wipe.
      pushOperationLog("WIPE", `fastboot erase cache (${serial})…`, 75);
      const cache = await runStreamedTool("flash-reset", "fastboot", [
        "-s",
        serial,
        "erase",
        "cache",
      ]);
      if (cache.stdout) streamed.push(cache.stdout);
      if (cache.stderr) streamed.push(cache.stderr);
      if (cache.exitCode !== 0) {
        pushOperationLog(
          "WARN",
          `fastboot erase cache skipped (exit ${cache.exitCode}) — non-fatal.`,
          null,
          "warn"
        );
      }

      pushOperationLog("REBOOT", "Userdata wiped — rebooting device…", 90);
      const reboot = await runStreamedTool("flash-reset", "fastboot", ["-s", serial, "reboot"]);
      if (reboot.stdout) streamed.push(reboot.stdout);
      if (reboot.stderr) streamed.push(reboot.stderr);

      const message = "Flash reset complete (Fastboot).";
      pushOperationLog("DONE", message, 100, "ok");
      return { success: true, message, stdout: streamed.join("\n") };
    } finally {
      endOperation();
    }
  });

  // device:unlockScreen — remove lock screen via ADB settings, no data wipe.
  ipcMain.handle("device:unlockScreen", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;
    const opts = sanitizeOperationOptions(options);
    beginOperation("unlock-screen");
    pushOperationLog("START", `Starting screen unlock${opts.brand ? ` (${opts.brand})` : ""}…`, 0);
    try {
      const adb = await probeAdb();
      if (!adb.connected || !adb.serial) {
        const message = "No ADB device connected — enable USB debugging and reconnect.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      if (!adb.authorized) {
        const message = "Device not authorized — accept the ADB prompt on your phone.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      pushOperationLog("DISABLE", "Disabling lock screen settings…", 30);
      const cmds = [
        "settings put secure lock_screen_disabled 1",
        "settings put global device_provisioned 1",
        "settings delete secure lock_pattern_and_password",
        "settings delete secure gatekeeper.password",
        "settings delete secure gatekeeper.pattern",
        "pm clear com.android.phone",
      ];
      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        if (!cmd) continue;
        try {
          await adbShell(adb.serial, cmd);
          pushOperationLog("STEP", `Disabled: ${cmd} (${i + 1}/${cmds.length})`, Math.round((i + 1) * 100 / cmds.length));
        } catch (err) {
          pushOperationLog("WARN", `Skipped: ${cmd} — ${(err as Error).message}`, Math.round((i + 1) * 100 / cmds.length));
        }
      }
      pushOperationLog("REBOOT", "Rebooting device to apply unlock…", 90);
      await adbReboot(adb.serial);
      const message = "Screen unlock complete — device should reboot unlocked.";
      pushOperationLog("DONE", message, 100, "ok");
      return { success: true, message };
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Screen unlock failed.";
      pushOperationLog("ERROR", msg, null, "error");
      return { success: false, message: msg };
    } finally {
      endOperation();
    }
  });

  // device:rebootMode — one-click boot-mode switcher. Reboots an authorized ADB
  // device straight into Fastboot (bootloader) / Recovery / EDL / System with NO
  // data wipe. Every adb stage is streamed to the shared operation console so the
  // Quick Boot Switcher buttons show live progress. Failures are reported as a
  // typed { success: false } result (never thrown), so the app cannot crash on a
  // disconnected / unauthorized device.
  ipcMain.handle("device:rebootMode", async (event, mode: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;
    const target = sanitizeRebootMode(mode);
    if (!target) {
      return { success: false, message: `Unsupported reboot mode: ${String(mode)}` };
    }
    const label = REBOOT_LABELS[target];
    beginOperation("reboot-mode");
    pushOperationLog("START", `Rebooting into ${label}…`, 0);
    try {
      const adb = await probeAdb();
      if (!adb.connected || !adb.serial) {
        const message = "No ADB device connected — enable USB debugging and reconnect.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      if (!adb.authorized) {
        const message = "Device not authorized — accept the ADB prompt on your phone.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      const adbMode = REBOOT_ADB_MODE[target];
      const cmdLabel = `adb reboot${adbMode ? ` ${adbMode}` : ""}`;
      pushOperationLog("SEND", `${cmdLabel} → ${label}`, 50);
      const args = adbMode ? ["-s", adb.serial, "reboot", adbMode] : ["-s", adb.serial, "reboot"];
      const result = await runStreamedTool("reboot-mode", "adb", args);
      if (result.notAvailable) {
        const message = "ADB tools not installed — cannot send reboot command.";
        pushOperationLog("ERROR", message, null, "error");
        return { success: false, message };
      }
      const stdout = result.stdout;
      // The adb transport routinely drops as the device leaves Android for
      // bootloader/edl/recovery, so a non-zero exit is expected — surface the
      // raw stderr but treat the reboot as successfully *requested*.
      if (result.exitCode !== 0 && result.exitCode !== null) {
        const detail = result.stderr || result.stdout || `adb exited ${result.exitCode}`;
        const message = `Reboot to ${label} requested. ${detail}`;
        pushOperationLog("WARN", message, 100, "warn");
        return { success: true, message, stdout };
      }
      const message = `Reboot to ${label} requested.`;
      pushOperationLog("DONE", message, 100, "ok");
      return { success: true, message, stdout };
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Reboot failed.";
      pushOperationLog("ERROR", msg, null, "error");
      return { success: false, message: msg };
    } finally {
      // Always release the global run-state lock, even on an unexpected throw.
      endOperation();
    }
  });
}

/** Coerce an untrusted renderer payload into a safe OperationOptions. */
function sanitizeOperationOptions(raw: unknown): OperationOptions {
  const o = (raw ?? {}) as Partial<OperationOptions>;
  const brand = typeof o.brand === "string" ? o.brand : undefined;
  const mode = o.mode === "test-mode" || o.mode === "brom" || o.mode === "fastboot-recovery" ? o.mode : undefined;
  return { brand, mode };
}

/** Coerce an untrusted renderer payload into a supported RebootMode (or null). */
function sanitizeRebootMode(raw: unknown): RebootMode | null {
  return raw === "bootloader" || raw === "recovery" || raw === "edl" || raw === "system"
    ? raw
    : null;
}

/** Coerce an untrusted renderer payload into a safe FRP bypass options.
 *  The renderer sends { brand, mode } where `mode` is the locked-device
 *  connection-guide key ("test-mode" | "brom" | "fastboot-recovery"). We map
 *  that onto a concrete engine `method` and inject model/chipset fallbacks so
 *  the engine's Step-1 device-info validation never rejects a real device.
 */
function sanitizeFrpOptions(raw: unknown): {
  brand: string;
  model: string;
  androidVersion?: string;
  method: "setup-wizard" | "download-mode" | "edl-mode" | "mtk-brom" | "oem-service";
  mode?: "test-mode" | "brom" | "fastboot-recovery";
  chipset?: string;
  frpResetFile?: string;
} {
  const o = (raw ?? {}) as Record<string, unknown>;
  const methodRaw = o.method;
  const modeRaw = o.mode;
  let method: "setup-wizard" | "download-mode" | "edl-mode" | "mtk-brom" | "oem-service" = "download-mode";
  if (
    methodRaw === "setup-wizard" || methodRaw === "download-mode" || methodRaw === "edl-mode" ||
    methodRaw === "mtk-brom" || methodRaw === "oem-service"
  ) {
    method = methodRaw;
  } else if (modeRaw === "test-mode") {
    method = "setup-wizard"; // Samsung test mode — setup-wizard / OEM dial codes
  } else if (modeRaw === "brom") {
    method = "mtk-brom";
  } else if (modeRaw === "fastboot-recovery") {
    method = "download-mode"; // recovery ADB / download-mode wipe
  }
  return {
    brand: typeof o.brand === "string" ? o.brand : "",
    model: typeof o.model === "string" && o.model.trim() ? o.model.trim() : "Generic",
    androidVersion: typeof o.androidVersion === "string" ? o.androidVersion : undefined,
    method,
    mode:
      modeRaw === "test-mode" || modeRaw === "brom" || modeRaw === "fastboot-recovery"
        ? modeRaw
        : undefined,
    chipset: typeof o.chipset === "string" && o.chipset.trim() ? o.chipset.trim() : "Auto-Detect",
    frpResetFile: typeof o.frpResetFile === "string" ? o.frpResetFile : undefined,
  };
}

// ─── USB polling (pre-existing behavior, preserved) ──────────────────────────

function startPolling(win: BrowserWindow): void {
  stopPolling();
  activeWindow = win;
  const push = (status: { state: string; lastScanAt: string }) => {
    // Skip if the window is gone; a poll tick must never throw.
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      return;
    }
    try {
      // Carry the global run-state on every tick so a freshly-mounted Console
      // Log tab populates immediately (running flag + rolling log buffer)
      // without a separate round-trip.
      win.webContents.send("device:status-changed", {
        ...status,
        running: operationRunning,
        logs: operationLogs,
      });
    } catch (err) {
      // Defensive: the window can be torn down between the guard and send().
      log.warn("[device] startPolling: send failed:", err);
    }
  };
  // Push an immediate scan so the UI isn't stuck on "SEARCHING" for 2s.
  void scanUnified()
    .then(push)
    .catch((err) => log.error("[device] immediate scan failed:", err));
  pollTimer = setInterval(() => {
    void scanUnified()
      .then(push)
      .catch((err) => log.error("[device] poll scan failed:", err));
  }, 2000);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // Drop the broadcast target so a torn-down window is never written to.
  activeWindow = null;
}

// Diagnostic: enumerate every USB device (VID:PID + interface classes) so
// locked-device transports — MTP/Test Mode, Fastboot, MediaTek BROM/VCOM,
// Serial — are visible in logs even when ADB is unavailable. Fires only under
// FRPB_DEBUG=1 via log.debug, so it never changes runtime behavior.
function logUsbInventory(usb: { getDeviceList: () => UsbDeviceLike[] }, label: string): void {
  try {
    const list = usb.getDeviceList();
    const lines = list.map((d) => {
      const classes =
        (d.interfaces ?? [])
          .map((i) => i.descriptor.bInterfaceClass.toString(16).padStart(2, "0"))
          .join(",") || "none";
      return `  VID:${d.deviceDescriptor.idVendor.toString(16).padStart(4, "0")} PID:${d.deviceDescriptor.idProduct
        .toString(16)
        .padStart(4, "0")} class:[${classes}]`;
    });
    log.debug(`[device] ${label}: ${lines.length} USB device(s) present\n${lines.join("\n") || "  (none)"}`);
  } catch (err) {
    log.warn(`[device] ${label}: USB inventory failed: ${err}`);
  }
}

export interface UsbScanResult {
  connected: boolean;
  state: "SEARCHING" | "CONNECTED" | "DRIVER_MISSING";
  deviceName?: string;
  mode?: string;
  vendor?: string;
  driver?: { oem: string; officialUrl: string };
  brand?: string;
  serial?: string;
  source?: "usb";
  lastScanAt: string;
}

async function scan(): Promise<UsbScanResult> {
  const lastScanAt = new Date().toISOString();
  const usb = loadUsb();
  if (!usb) {
    return { connected: false, state: "SEARCHING", lastScanAt };
  }
  logUsbInventory(usb, "scan()");

  // Broad Android detection (matches the ADB engine's USB fallback): any VID
  // with a known brand or a 0xFF vendor-specific transport qualifies.
  const device = usb
    .getDeviceList()
    .find(
      (d) =>
        Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) ||
        isLikelyAndroidUsb(d)
    );

  if (!device) {
    return { connected: false, state: "SEARCHING", lastScanAt };
  }

  const brand = brandFromVendorId(device.deviceDescriptor.idVendor);
  const driver = brand ? driverForBrand(brand) : undefined;

  // When no driver is installed, Windows still enumerates the device but the
  // user-space node-usb path cannot talk to it — report DRIVER_MISSING so the
  // Driver Center can offer the official download instead of a phantom "no
  // device" state.
  const driverMissing =
    brand &&
    driver &&
    !driverProbeCache.has(brand) &&
    !probeDriverInstalled(device.deviceDescriptor.idVendor);

  const state: "SEARCHING" | "CONNECTED" | "DRIVER_MISSING" = driverMissing
    ? "DRIVER_MISSING"
    : "CONNECTED";

  return {
    connected: true,
    state,
    deviceName: device.deviceDescriptor.iProduct
      ? `USB Device ${device.deviceDescriptor.iProduct}`
      : undefined,
    mode: modeLabelForState(state, brand, device),
    vendor: brand ? brand.toLowerCase() : undefined,
    driver: driverMissing ? driver : undefined,
    brand: brand,
    serial: undefined,
    source: "usb",
    lastScanAt,
  };
}

function isLikelyAndroidUsb(d: UsbDeviceLike): boolean {
  // Any known Android brand or a 0xFF vendor-specific interface (Fastboot /
  // Download / BROM / Preloader) counts as a likely Android device for the
  // broad USB scan used by Device Monitor's "Bluetooth/USB" line.
  return Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) ||
    (d.interfaces ?? []).some((i) => i.descriptor.bInterfaceClass === 0xff);
}

function modeLabelForState(
  state: "SEARCHING" | "CONNECTED" | "DRIVER_MISSING",
  brand: string | undefined,
  device: UsbDeviceLike,
): string | undefined {
  if (state !== "CONNECTED") return undefined;
  // Determine which transport mode the device currently presents.
  const ifaces = device.interfaces ?? [];
  if (ifaces.some((i) => i.descriptor.bInterfaceClass === 0xff)) {
    return "Fastboot / Download / BROM";
  }
  if (brand === "Samsung" && ifaces.some((i) => i.descriptor.bInterfaceClass === 0x02)) {
    return "Samsung Test Mode (MTP)";
  }
  return "MTP";
}

function driverForBrand(brand: string): { oem: string; officialUrl: string } | undefined {
  const key = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
  const oem = OFFICIAL_DRIVER_URLS[key];
  if (!oem) return undefined;
  return { oem: brand, officialUrl: oem };
}

function probeDriverInstalled(vendorId: number): boolean {
  const key = vendorId.toString(16);
  const cached = driverProbeCache.get(key);
  if (cached !== undefined) return cached;
  const installed = probeDriver(vendorId);
  driverProbeCache.set(key, installed);
  return installed;
}

// Read the OEM driver state from the system — best-effort, non-fatal.
function probeDriver(vendorId: number): boolean {
  try {
    const { execSync } = require("child_process");
    // pnputil enum + grep for the vendor's known OEM INF name.
    const list = execSync("pnputil /enum-drivers", { encoding: "utf8", timeout: 8000 });
    return vendorInfomycin(list, vendorId);
  } catch {
    return false;
  }
}

function vendorInfomycin(list: string, vendorId: number): boolean {
  const hex = vendorId.toString(16).padStart(4, "0").toUpperCase();
  // Common OEM INF naming patterns include the VID in hex.
  return list.includes(`${hex}`) || list.includes(`VID_${hex}`);
}

// ─── Unified status (ADB-first, USB fallback) ────────────────────────────────

async function scanUnified(): Promise<{
  connected: boolean;
  state: string;
  deviceName?: string;
  mode?: string;
  vendor?: string;
  driver?: { oem: string; officialUrl: string };
  brand?: string;
  model?: string;
  serial?: string;
  authorized?: boolean;
  source?: "adb" | "usb";
  lastScanAt: string;
}> {
  const lastScanAt = new Date().toISOString();

  // 1. ADB scan (fast, authoritative when available)
  const adb = await probeAdb();
  if (adb.connected) {
    return {
      connected: true,
      state: "CONNECTED",
      deviceName: adb.deviceName,
      mode: adb.mode,
      vendor: adb.vendor,
      brand: adb.brand,
      model: adb.model,
      serial: adb.serial,
      authorized: adb.authorized,
      source: "adb",
      lastScanAt,
    };
  }

  // 2. USB fallback (broad Android detection)
  const usb = await scan();
  return {
    connected: usb.connected,
    state: usb.state,
    deviceName: usb.deviceName,
    mode: usb.mode,
    vendor: usb.vendor,
    driver: usb.driver,
    brand: usb.brand,
    serial: usb.serial,
    source: "usb",
    lastScanAt,
  };
}

// ─── ADB helpers ──────────────────────────────────────────────────────────────

interface AdbDeviceInfo {
  connected: boolean;
  deviceName?: string;
  mode?: string;
  vendor?: string;
  brand?: string;
  model?: string;
  serial?: string;
  authorized?: boolean;
}

async function probeAdb(): Promise<AdbDeviceInfo> {
  if (!isPlatformToolsBundled()) {
    return { connected: false };
  }

  try {
    const devices = await adbDevices();
    if (!devices || devices.length === 0) {
      return { connected: false };
    }

    const device = devices[0];
    if (!device) {
      return { connected: false };
    }
    const serial = device.serial;
    const state = device.state;
    const authorized = state === "device";

    // Pull extended props from the first connected device.
    let brand: string | undefined;
    let model: string | undefined;
    let deviceName: string | undefined;
    let mode: string | undefined;

    if (authorized) {
      try {
        brand = await adbGetProp("ro.product.brand", serial);
        model = await adbGetProp("ro.product.model", serial);
        const manufacturer = await adbGetProp("ro.product.manufacturer", serial);
        deviceName = model || manufacturer || serial;
        mode = "ADB";
      } catch {
        deviceName = serial;
      }
    } else {
      deviceName = serial;
      // state can be "device" | "offline" | "unauthorized" from ADB — recovery/bootloader
      // only appear when the device is in those physical modes, so handle them as
      // string-overlap-safe comparisons.
      const stateStr = String(state);
      mode = stateStr === "recovery"
        ? "Recovery"
        : stateStr === "bootloader"
          ? "Fastboot"
          : "Unauthorized";
    }

    return {
      connected: true,
      deviceName,
      mode,
      vendor: manufacturerToVendor(brand),
      brand,
      model,
      serial,
      authorized,
    };
  } catch (err) {
    log.warn("[device] ADB probe failed:", err);
    return { connected: false };
  }
}

function manufacturerToVendor(brand: string | undefined): string | undefined {
  if (!brand) return undefined;
  const lower = brand.toLowerCase();
  if (lower.includes("samsung")) return "Samsung";
  if (lower.includes("xiaomi") || lower.includes("redmi") || lower.includes("poco")) return "Xiaomi";
  if (lower.includes("oppo")) return "OPPO";
  if (lower.includes("realme")) return "Realme";
  if (lower.includes("vivo")) return "Vivo";
  if (lower.includes("motorola")) return "Motorola";
  if (lower.includes("oneplus")) return "OnePlus";
  if (lower.includes("huawei") || lower.includes("honor")) return "Huawei";
  if (lower.includes("google") || lower.includes("pixel")) return "Google";
  if (lower.includes("lenovo")) return "Lenovo";
  if (lower.includes("nokia")) return "Nokia";
  if (lower.includes("htc")) return "HTC";
  if (lower.includes("lg")) return "LG";
  if (lower.includes("sony")) return "Sony";
  return brand;
}
