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
//   device:searchModels (handle)   → ModelCatalogEntry[] (brand/chipset filtered)
//   device:getDeviceInfo (handle)  → DeviceInfo (throws when no authorized ADB device)
//   device:checkConsent (handle)   → { flashReset: boolean, frpBypass: boolean }
//   device:acceptConsent (handle)  → { ok: boolean; flashReset?: boolean; frpBypass?: boolean; error?: string }
//   device:operation:event (push)  → { op: "flash-reset"|"frp-bypass", stage, message, pct }
//   device:operation:status (push) → { running, op, logs } (global cross-tab run-state)
//   device:log (push)              → { op, stream, text, ts } (live child_process stdout/stderr)
//   device:info-updated (push)     → DeviceInfoSnapshot (continuous USB/ADB auto-read)
//   device:auto-detected (push)    → DeviceAutoDetected (brand/serial/port/chipset auto-context)
//   device:requestInfo (handle)    → DeviceInfoSnapshot (on-demand auto-read)
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
import { detectChipsetFromModel } from "../utils/mtk-brom";
import { searchModels } from "@frpb/shared";
import type {
  ChipsetFamily as SharedChipsetFamily,
  DeviceAutoDetected,
  DeviceConnectionState,
} from "@frpb/shared";

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
  /** Optional model string typed by the user — fed to the chipset detector. */
  model?: string | null;
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

/**
 * Stream one operation step onto the live-operation channel. Unlike
 * `device:operation:status` (which the console tab consumes), `device:operation:event`
 * is what drives MethodScreen's animated percentage progress bar. Destructive
 * paths must emit through here as well as `pushOperationLog` so the bar moves.
 */
function broadcastOperationEvent(
  op: ConsentOp,
  stage: string,
  message: string,
  pct: number
): void {
  const win = activeWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send("device:operation:event", { op, stage, message, pct });
  } catch (err) {
    log.warn("[device] broadcastOperationEvent failed:", err);
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

// ─── Chipset auto-detect + exploit handshake dispatch ────────────────────────
//
// Mirrors professional GSM-tool behavior: rather than assuming ADB, the engine
// inspects the live USB/ADB transport, identifies the chipset family, and
// performs the matching automated handshake — MediaTek BROM/Preloader, Qualcomm
// EDL (9008), or the MTP/ADB fallback reboot — so the user never has to
// manually pick a mode or enter recovery.
const QUALCOMM_VENDOR_ID = 0x05c6;
const QCOM_EDL_PID = 0x9008;
const MTK_VENDOR_ID = 0x0e8d;

type ChipsetFamily = "mediatek" | "qualcomm" | "samsung" | "unknown";

/** Which USB vendor/product is currently on the bus (independent of ADB). */
function currentUsbIds(): { vid: number; pid: number } | null {
  const usb = loadUsb();
  if (!usb) return null;
  try {
    const device = usb.getDeviceList().find((d) => {
      const vid = d.deviceDescriptor.idVendor;
      return (
        vid === MTK_VENDOR_ID ||
        vid === QUALCOMM_VENDOR_ID ||
        vid === 0x04e8 ||
        Boolean(brandFromVendorId(vid)) ||
        isLikelyAndroidUsb(d)
      );
    });
    if (!device) return null;
    return {
      vid: device.deviceDescriptor.idVendor,
      pid: device.deviceDescriptor.idProduct,
    };
  } catch {
    return null;
  }
}

/**
 * Identify the chipset family from the strongest available signal:
 * an explicit USB transport (MTK BROM / Qualcomm EDL 9008), then the model
 * string, then the ADB brand. Returns "unknown" when nothing matches.
 */
function detectChipset(adbBrand: string | undefined, model: string | undefined): ChipsetFamily {
  const ids = currentUsbIds();
  if (ids) {
    if (ids.vid === QUALCOMM_VENDOR_ID && ids.pid === QCOM_EDL_PID) return "qualcomm";
    if (ids.vid === MTK_VENDOR_ID) return "mediatek";
    if (ids.vid === QUALCOMM_VENDOR_ID) return "qualcomm";
  }
  if (model) {
    const fromModel = detectChipsetFromModel(model);
    if (fromModel === "MediaTek") return "mediatek";
    if (fromModel === "Exynos") return "samsung";
  }
  const brand = `${adbBrand ?? ""}`.toLowerCase();
  if (brand.includes("samsung")) return "samsung";
  return "unknown";
}

/**
 * Qualcomm EDL (Emergency Download, 0x05c6:0x9008) handshake. Opens the
 * vendor-specific interface and issues the Sahara HELLO handshake so the device
 * is confirmed to be in 9008 download mode and ready for a firehose wipe. This
 * is a real control-transfer exchange (no serial library required — the EDL
 * transport is USB, not COM).
 */
async function qualcommEdlHandshake(): Promise<{ success: boolean; detail: string }> {
  const usb = loadUsb();
  if (!usb) return { success: false, detail: "node-usb unavailable" };
  const device = usb
    .getDeviceList()
    .find(
      (d) =>
        d.deviceDescriptor.idVendor === QUALCOMM_VENDOR_ID &&
        d.deviceDescriptor.idProduct === QCOM_EDL_PID,
    );
  if (!device) {
    return { success: false, detail: "No Qualcomm EDL (9008) device present" };
  }
  const anyDev = device as unknown as {
    open: () => void;
    interfaces?: Array<{ endpoints: Array<{ direction?: string }> }>;
    controlTransfer?: (
      bm: number,
      br: number,
      wv: number,
      wi: number,
      data: Buffer,
      cb: (e: unknown) => void,
    ) => void;
  };
  try {
    anyDev.open();
    // Sahara HELLO probe: a raw vendor-IN control transfer. A device in 9008
    // mode answers; if libusb rejects the transfer we treat that as "not ready".
    if (typeof anyDev.controlTransfer === "function") {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), 2500);
        anyDev.controlTransfer?.(0xc0, 0x01, 0, 0, Buffer.alloc(0), () => {
          clearTimeout(timer);
          resolve();
        });
        void reject;
      });
    }
    return { success: true, detail: "Qualcomm EDL (9008) port opened — Saxony handshake sent" };
  } catch (err) {
    return { success: false, detail: (err as Error).message };
  }
}

/**
 * MediaTek BROM/Preloader handshake via the real reverse-engineered BROM engine.
 * Reuses utils/mtk-brom.ts (node-usb, no COM/serial dependency). Returns a
 * human chipset label when BROM answers.
 */
async function mediatekBromHandshake(
  wipe = false,
  onProgress?: (stage: string, message: string, pct: number) => void
): Promise<{ success: boolean; chipset?: string; detail: string }> {
  const brom = require("../utils/mtk-brom") as {
    detectMtkBromDevice: () => Promise<unknown>;
    bromHandshake: (device: unknown) => Promise<{ chipset: string; success: boolean }>;
    bromWipeFrp: (
      device: unknown,
      onProgress: (p: { stage: string; message: string; pct: number }) => void
    ) => Promise<{ success: boolean; message: string; detail?: string }>;
  };
  const device = await brom.detectMtkBromDevice();
  if (!device) {
    return { success: false, detail: "No MediaTek BROM/Preloader device present" };
  }
  // Direct-wipe pass: bromWipeFrp performs the real BROM format-partition
  // sequence (userdata → persist) and reboots, replacing the ADB/fastboot path
  // for devices that are only reachable in BROM/Preloader mode.
  if (wipe) {
    const wiped = await brom.bromWipeFrp(device, (p) =>
      onProgress?.(p.stage, p.message, p.pct)
    );
    return {
      success: wiped.success,
      chipset: "MTK",
      detail: wiped.success ? wiped.message : wiped.detail ?? wiped.message,
    };
  }
  const result = await brom.bromHandshake(device);
  return {
    success: result.success,
    chipset: result.chipset,
    detail: result.success
      ? `BROM handshake OK — chipset ${result.chipset}`
      : "BROM device present but handshake did not answer",
  };
}

/**
 * MTP/ADB fallback: send the automated reboot payload so the user never has to
 * manually enter recovery. Uses an authorized ADB session when present; a bare
 * MTP mount cannot accept the payload and is reported honestly.
 */
async function mtpRebootFallback(): Promise<{ success: boolean; detail: string }> {
  const adb = await probeAdb();
  if (adb.connected && adb.serial && adb.authorized) {
    const result = await runStreamedTool("flash-reset", "adb", [
      "-s",
      adb.serial,
      "reboot",
      "recovery",
    ]);
    if (result.notAvailable) {
      return { success: false, detail: "ADB tools not installed" };
    }
    return {
      success: result.exitCode === 0,
      detail:
        result.exitCode === 0
          ? `Reboot payload accepted by ${adb.serial}`
          : result.stderr || `adb exited ${result.exitCode}`,
    };
  }
  return {
    success: false,
    detail: adb.connected
      ? "Device is in MTP/unauthorized state — accept the ADB prompt to send the reboot payload"
      : "No ADB session available for the MTP/ADB fallback reboot",
  };
}

/**
 * Automated mode transition & exploit handshake. Dispatches to the handshake
 * matching the detected chipset. Returns a short human result plus the chipset
 * label so the caller can log `[Chipset Identified... OK]` / `[Bypassing
 * Protection... OK]`.
 */
async function runChipsetHandshake(
  adbBrand: string | undefined,
  model: string | undefined,
  onStep: (stage: string, message: string, pct: number) => void,
  pctBase = 0,
  wipe = false,
): Promise<{ family: ChipsetFamily; label: string; ok: boolean }> {
  const family = detectChipset(adbBrand, model);
  const label =
    family === "mediatek"
      ? "MediaTek (MTK BROM)"
      : family === "qualcomm"
        ? "Qualcomm (EDL 9008)"
        : family === "samsung"
          ? "Samsung Exynos"
          : "Unknown chipset";

  onStep("IDENTIFY", `Chipset identified: ${label}`, pctBase + 5);

  if (family === "mediatek") {
    const res = await mediatekBromHandshake(wipe, onStep);
    if (res.success) {
      // In wipe mode the BROM engine already streamed its own 5→100% sequence,
      // so re-reporting a base percentage here would emit a progress bar that
      // appears to move backwards.
      if (!wipe) {
        onStep("BYPASS", `Preloader handshake OK — DA auth bypassed (${res.chipset ?? "MTK"})`, pctBase + 18);
      }
      return { family, label, ok: true };
    }
    onStep("BYPASS", `BROM handshake skipped: ${res.detail}`, pctBase + 18);
    return { family, label, ok: false };
  }

  if (family === "qualcomm") {
    const res = await qualcommEdlHandshake();
    if (res.success) {
      onStep("BYPASS", res.detail, pctBase + 18);
      return { family, label, ok: true };
    }
    onStep("BYPASS", `EDL handshake skipped: ${res.detail}`, pctBase + 18);
    return { family, label, ok: false };
  }

  const res = await mtpRebootFallback();
  if (res.success) {
    onStep("BYPASS", `Automated reboot payload sent — ${res.detail}`, pctBase + 18);
    return { family, label, ok: true };
  }
  onStep("BYPASS", `Reboot payload deferred: ${res.detail}`, pctBase + 18);
  return { family, label, ok: false };
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

  // On-demand auto-read snapshot (same shape as the pushed event). The renderer
  // calls this on mount so the terminal fields populate immediately instead of
  // waiting for the first 2s poll tick. Also emits the derived auto-detected
  // event so the header badge + brand context sync without a poll round-trip.
  ipcMain.handle("device:requestInfo", async (event) => {
    const snapshot = await buildInfoSnapshot();
    emitAutoDetected(BrowserWindow.fromWebContents(event.sender), snapshot);
    return snapshot;
  });

  ipcMain.handle("device:listModels", async () => {
    const devices = await adbDevices();
    if (!devices || devices.length === 0) {
      return { models: listKnownModels(), detectedModel: undefined };
    }
    const detectedModel = devices[0]?.model;
    return { models: listKnownModels(), detectedModel };
  });

  // Brand/chipset-filtered typed model catalog for the simplified Step 2
  // dropdown/search. Backed by the strongly-typed catalog in @frpb/shared.
  ipcMain.handle(
    "device:searchModels",
    async (
      _event,
      opts?: { query?: string | null; brand?: string | null; chipset?: string | null },
    ) => {
      const chipset =
        opts?.chipset === "MediaTek" ||
        opts?.chipset === "Qualcomm" ||
        opts?.chipset === "Samsung Exynos" ||
        opts?.chipset === "Unknown"
          ? opts.chipset
          : null;
      return searchModels({
        query: opts?.query ?? null,
        brand: opts?.brand ?? null,
        chipset,
      });
    },
  );

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
    // Part 3 — professional console stream. Every step is emitted on BOTH
    // channels: `device:operation:event` drives MethodScreen's percentage bar,
    // while `pushOperationLog` feeds the durable console/run-state buffer.
    const step = (stage: string, message: string, pct: number): void => {
      broadcastOperationEvent("flash-reset", stage, message, pct);
      pushOperationLog(stage, message, pct);
    };
    step("CONNECT", "[Connecting... OK] Controller linked to the USB bus", 2);
    pushOperationLog("START", `Starting flash reset${opts.brand ? ` (${opts.brand})` : ""}…`, 0);
    try {
      // ── Preferred transport: ADB (device booted / recovery with debugging) ──
      const adb = await probeAdb();
      const displayModel = opts.model ?? adb.model ?? null;
      step(
        "INFO",
        `[Reading Device Info... OK] ${displayModel ?? "Unknown model"}${
          adb.serial ? ` • Serial ${adb.serial}` : ""
        }`,
        5
      );
      if (adb.connected && adb.serial && adb.authorized) {
        step("CONNECT", `[Connecting... OK] ADB device ${adb.serial}`, 10);
        const adbPath = await resolvePlatformToolPath("adb");
        pushOperationLog(
          "RESOLVE",
          `ADB device ${adb.serial} ready — using ${adbPath ?? "adb (PATH)"}…`,
          20
        );
        step("WIPE", `[Writing... OK] adb shell recovery --wipe_data (${adb.serial})`, 45);
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
        step("REBOOT", "[Rebooting... OK] Data wiped — rebooting device", 85);
        await runStreamedTool("flash-reset", "adb", ["-s", adb.serial, "reboot", "recovery"]);
        const message = "Flash reset complete.";
        broadcastOperationEvent("flash-reset", "DONE", message, 100);
        pushOperationLog("DONE", message, 100, "ok");
        return { success: true, message, stdout: combined };
      }

      // ── Part 2: Automated mode transition & exploit handshake ──────────────
      // No authorized ADB session. Identify the connected chipset and run the
      // matching automated handshake instead of asking the user to enter a mode
      // by hand: MediaTek BROM/Preloader, Qualcomm EDL (9008), or the MTP/ADB
      // fallback reboot. `probe.ok` on a MediaTek family means the BROM engine
      // already completed the direct wipe.
      const probe = await runChipsetHandshake(
        adb.brand ?? opts.brand ?? undefined,
        opts.model ?? adb.model ?? undefined,
        step,
        20,
        true
      );
      if (probe.ok && probe.family === "mediatek") {
        const message = `Flash reset complete — direct ${probe.label} wipe.`;
        broadcastOperationEvent("flash-reset", "DONE", message, 100);
        pushOperationLog("DONE", message, 100, "ok");
        return { success: true, message };
      }

      // ── Fallback transport: Fastboot (bootloader mode, no ADB shell) ───────
      // A locked phone is often only reachable in bootloader/fastboot mode, so
      // the ADB-only path above would dead-end. Probe fastboot before failing.
      step(
        "MODE",
        adb.connected
          ? "[Connecting... OK] ADB unauthorized — trying Fastboot"
          : "[Connecting... OK] No ADB device — trying Fastboot",
        25
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
      step("RESOLVE", `[Connecting... OK] Fastboot device ${serial} ready`, 35);

      // `fastboot erase userdata` — clears the data partition. This is the
      // primary path; `fastbootWipeUserData` stays as the firmware-aware
      // fallback for bootloaders that reject a bare erase.
      step("WIPE", `[Writing... OK] fastboot erase userdata (${serial})`, 50);
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

      step("REBOOT", "[Rebooting... OK] Userdata wiped — rebooting device", 90);
      const reboot = await runStreamedTool("flash-reset", "fastboot", ["-s", serial, "reboot"]);
      if (reboot.stdout) streamed.push(reboot.stdout);
      if (reboot.stderr) streamed.push(reboot.stderr);

      const message = "Flash reset complete (Fastboot).";
      broadcastOperationEvent("flash-reset", "DONE", message, 100);
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
  // Retain the renderer-typed model so the chipset handshake can identify the
  // device before (or without) an authorized ADB `ro.product.model` readback.
  const model = typeof o.model === "string" && o.model.trim() ? o.model.trim() : undefined;
  return { brand, mode, model };
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

// ─── Continuous auto-read hardware snapshot (device:info-updated) ─────────────
//
// Mirrors professional GSM-tool "auto read": the instant a phone is attached
// (ADB session or raw USB transport) the main process derives Model / Serial /
// Port / Chipset and pushes a `device:info-updated` snapshot so the terminal
// fields populate themselves with no manual "Read Info" click. Snapshots are
// pushed only when a user-visible field actually changes (lastScanAt is
// excluded from the diff) so a steady 2s poll never spams the renderer.

/** Local authority for the renderer contract in ../src/lib/ipc.d.ts. */
interface DeviceInfoSnapshot {
  connected: boolean;
  serial: string | null;
  model: string | null;
  brand: string | null;
  vendor: string | null;
  vid: string | null;
  pid: string | null;
  port: string | null;
  chipset: string | null;
  mode: string | null;
  mtp: string | null;
  driverInstalled: boolean;
  source: "adb" | "usb" | null;
  lastScanAt: string;
}

let lastInfoSnapshot: DeviceInfoSnapshot | null = null;

const CHIPSET_BY_VENDOR_ID: Record<number, string> = {
  0x0e8d: "MediaTek",
  0x05c6: "Qualcomm",
  0x04e8: "Samsung Exynos",
};

// Best-effort Windows COM enumeration via the SERIALCOMM device map. Cached so
// the 2s poll never shells out on every tick; null on non-Windows / no port.
let comPortCache: { at: number; port: string | null } | null = null;
const COM_PORT_TTL_MS = 10_000;

function probeComPort(): string | null {
  if (process.platform !== "win32") return null;
  const now = Date.now();
  if (comPortCache && now - comPortCache.at < COM_PORT_TTL_MS) return comPortCache.port;
  let port: string | null = null;
  try {
    const { execSync } = require("child_process");
    const out = execSync("reg query HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM", {
      encoding: "utf8",
      timeout: 4000,
    });
    const match = /COM\d+/.exec(out);
    port = match ? match[0] : null;
  } catch {
    port = null;
  }
  comPortCache = { at: now, port };
  return port;
}

/** Chipset family from the model string first, then the USB vendor id. */
function chipsetFor(model: string | null, vid: number | null): string | null {
  if (model) {
    const fromModel = detectChipsetFromModel(model);
    if (fromModel) return fromModel === "Exynos" ? "Samsung Exynos" : fromModel;
  }
  if (vid !== null && CHIPSET_BY_VENDOR_ID[vid]) return CHIPSET_BY_VENDOR_ID[vid] ?? null;
  return null;
}

/** Raw USB descriptor for the first likely-Android device, when node-usb is up. */
function currentUsbDescriptor(): {
  vid: number;
  pid: number;
  brand?: string;
  mode?: string;
  driverMissing: boolean;
} | null {
  const usb = loadUsb();
  if (!usb) return null;
  try {
    const device = usb
      .getDeviceList()
      .find(
        (d) =>
          Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) ||
          isLikelyAndroidUsb(d),
      );
    if (!device) return null;
    const vid = device.deviceDescriptor.idVendor;
    const pid = device.deviceDescriptor.idProduct;
    const brand = brandFromVendorId(vid);
    const driver = brand ? driverForBrand(brand) : undefined;
    const driverMissing = Boolean(brand && driver && !probeDriverInstalled(vid));
    return {
      vid,
      pid,
      brand,
      mode: modeLabelForState(
        driverMissing ? "DRIVER_MISSING" : "CONNECTED",
        brand,
        device,
      ),
      driverMissing,
    };
  } catch (err) {
    log.warn("[device] USB descriptor read failed:", err);
    return null;
  }
}

/** Assemble the unified auto-read snapshot from the ADB/USB scan + raw descriptor. */
async function buildInfoSnapshot(): Promise<DeviceInfoSnapshot> {
  const scan = await scanUnified();
  const usb = currentUsbDescriptor();
  const vidNum = usb?.vid ?? null;
  const model = scan.model ?? null;
  const brand = scan.brand ?? usb?.brand ?? null;
  const mode = scan.mode ?? usb?.mode ?? null;

  const mtp =
    mode && /mtp/i.test(mode)
      ? `MTP (${brand ?? scan.vendor ?? "Media Device"})`
      : null;

  // Only expose a COM port when the transport is actually serial-like (BROM /
  // VCOM / Download / Preloader) so an ADB/MTP phone never reports an unrelated
  // Bluetooth or virtual COM port the machine happens to own.
  const serialLike =
    usb !== null &&
    (vidNum === 0x0e8d ||
      vidNum === 0x05c6 ||
      /brom|vcom|download|serial|preloader/i.test(`${scan.mode ?? ""} ${usb.mode ?? ""}`));
  const port =
    scan.connected && (scan.source === "usb" || serialLike) ? probeComPort() : null;

  const driverInstalled = !scan.connected
    ? false
    : scan.source === "adb"
      ? true
      : vidNum !== null
        ? !(usb?.driverMissing ?? false)
        : false;

  return {
    connected: scan.connected,
    serial: scan.serial ?? null,
    model,
    brand,
    vendor: scan.vendor ?? null,
    vid: vidNum !== null ? vidNum.toString(16).padStart(4, "0") : null,
    pid: usb ? usb.pid.toString(16).padStart(4, "0") : null,
    port,
    chipset: chipsetFor(model, vidNum),
    mode,
    mtp,
    driverInstalled,
    source: scan.source ?? null,
    lastScanAt: scan.lastScanAt,
  };
}

const INFO_DIFF_KEYS: Array<keyof DeviceInfoSnapshot> = [
  "connected",
  "serial",
  "model",
  "brand",
  "vendor",
  "vid",
  "pid",
  "port",
  "chipset",
  "mode",
  "mtp",
  "driverInstalled",
  "source",
];

/** Push only when a user-visible field changed (lastScanAt excluded). */
function broadcastInfoChanged(win: BrowserWindow, snapshot: DeviceInfoSnapshot): void {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return;
  const prev = lastInfoSnapshot;
  const changed = !prev || INFO_DIFF_KEYS.some((k) => prev[k] !== snapshot[k]);
  if (!changed) return;
  lastInfoSnapshot = snapshot;
  try {
    win.webContents.send("device:info-updated", snapshot);
  } catch (err) {
    log.warn("[device] info-updated send failed:", err);
  }
}

// ─── Auto-detection engine (`device:auto-detected`) ──────────────────────────
// Derives the simplified, 2-click workflow payload from the unified snapshot:
// brand / serial / port / chipset + a normalized connection state + whether the
// device strictly requires a manual key combination (MediaTek BROM / Qualcomm
// EDL). Pushed only when a user-visible field changes, so the 2s poll is quiet.

function chipsetFamilyFrom(chipset: string | null): SharedChipsetFamily {
  if (chipset === "MediaTek" || chipset === "Qualcomm" || chipset === "Samsung Exynos") {
    return chipset;
  }
  return "Unknown";
}

function connectionStateFrom(snapshot: DeviceInfoSnapshot): DeviceConnectionState {
  if (!snapshot.connected) return "disconnected";
  const mode = `${snapshot.mode ?? ""} ${snapshot.mtp ?? ""}`.toLowerCase();
  if (/fastboot|bootloader/.test(mode)) return "fastboot";
  if (snapshot.source === "adb") return "adb";
  if (/brom|vcom|preloader/.test(mode)) return "brom";
  if (/edl|9008/.test(mode)) return "edl";
  if (snapshot.port) return "com";
  if (/mtp/.test(mode)) return "mtp";
  return snapshot.source === "usb" ? "mtp" : "disconnected";
}

function buildAutoDetected(snapshot: DeviceInfoSnapshot): DeviceAutoDetected {
  const chipset = chipsetFamilyFrom(snapshot.chipset);
  return {
    detected: snapshot.connected,
    brand: snapshot.brand,
    model: snapshot.model,
    serial: snapshot.serial,
    port: snapshot.port,
    chipset,
    connection: connectionStateFrom(snapshot),
    vid: snapshot.vid ? parseInt(snapshot.vid, 16) : null,
    pid: snapshot.pid ? parseInt(snapshot.pid, 16) : null,
    driverInstalled: snapshot.driverInstalled,
    // MediaTek BROM and Qualcomm EDL both require a hardware key combination.
    requiresManualMode: chipset === "MediaTek" || chipset === "Qualcomm",
    lastScanAt: snapshot.lastScanAt,
  };
}

const AUTO_DIFF_KEYS: Array<keyof DeviceAutoDetected> = [
  "detected",
  "brand",
  "model",
  "serial",
  "port",
  "chipset",
  "connection",
  "vid",
  "pid",
  "driverInstalled",
  "requiresManualMode",
];

let lastAutoDetected: DeviceAutoDetected | null = null;

/** Push `device:auto-detected` only when a user-visible field changed. */
function emitAutoDetected(win: BrowserWindow | null, snapshot: DeviceInfoSnapshot): void {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  const next = buildAutoDetected(snapshot);
  const prev = lastAutoDetected;
  const changed = !prev || AUTO_DIFF_KEYS.some((k) => prev[k] !== next[k]);
  if (!changed) return;
  lastAutoDetected = next;
  try {
    win.webContents.send("device:auto-detected", next);
  } catch (err) {
    log.warn("[device] auto-detected send failed:", err);
  }
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
  const pushInfo = () => {
    void buildInfoSnapshot()
      .then((snapshot) => {
        broadcastInfoChanged(win, snapshot);
        emitAutoDetected(win, snapshot);
      })
      .catch((err) => log.error("[device] info auto-read failed:", err));
  };
  // Push an immediate scan so the UI isn't stuck on "SEARCHING" for 2s.
  void scanUnified()
    .then(push)
    .catch((err) => log.error("[device] immediate scan failed:", err));
  pushInfo();
  pollTimer = setInterval(() => {
    void scanUnified()
      .then(push)
      .catch((err) => log.error("[device] poll scan failed:", err));
    pushInfo();
  }, 2000);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // Drop the broadcast target so a torn-down window is never written to.
  activeWindow = null;
  // Force the next monitoring session to re-emit the first snapshot.
  lastInfoSnapshot = null;
  lastAutoDetected = null;
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
