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
//   device:status-changed (push)   → DeviceStatus
//   device:getStatus (handle)      → DeviceStatus (same unified scan)
//   device:startPolling / stopPolling (handle)
//   device:listModels (handle)     → { models: string[], detectedModel?: string }
//   device:checkConsent (handle)   → { flashReset: boolean, frpBypass: boolean }
//   device:acceptConsent (handle)  → { ok: boolean; flashReset?: boolean; frpBypass?: boolean; error?: string }
//   device:operation:event (push)  → { op: "flash-reset"|"frp-bypass", stage, message, pct }
//   device:flashReset (handle)     → { success, message, detail? }
//   device:frpBypass (handle)      → { success, message, detail? }

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import { brandFromVendorId, listKnownModels } from "../utils/android-models";
import {
  adbDevices,
  adbGetProp,
  adbReboot,
  adbWipeData,
  isPlatformToolsBundled,
  probeAdb,
  sleep,
} from "../utils/adb";

// ─── USB vendor allow-list (recovery-relevant vendors only) ─────────────────
const WATCHED_VENDORS: Record<number, string> = {
  0x04e8: "Samsung",
  0x18d1: "Google",
  0x2a70: "OnePlus",
  0x0e8d: "MediaTek",
  0x05c6: "Qualcomm",
  0x05ac: "Apple",
};

const OFFICIAL_DRIVER_URLS: Record<string, string> = {
  Samsung: "https://developer.samsung.com/android-usb-driver",
  Google: "https://developer.android.com/studio/run/win-usb",
  OnePlus: "https://www.oneplus.com/support/software/driver",
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

/** Per-invocation engine guidance passed through the preload bridge. */
interface OperationOptions {
  brand?: string | null;
  mode?: OperationMode;
}

/** Human label + the transport(s) that count as "phone is ready" for a mode. */
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
const CONSENT_OPS = ["flash-reset", "frp-bypass"] as const;
type ConsentOp = (typeof CONSENT_OPS)[number];
const consentGrantedFor = new Set<ConsentOp>();

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
  ipcMain.handle("device:status", () => scanUnified());

  ipcMain.handle("device:getStatus", () => scanUnified());

  ipcMain.handle("device:startPolling", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) startPolling(win);
    return undefined;
  });

  ipcMain.handle("device:stopPolling", () => {
    stopPolling();
    return undefined;
  });

  ipcMain.handle("device:listModels", async () => {
    const detected = await scanAndroidDevices();
    return { models: listKnownModels(), detectedModel: detected.model };
  });

  ipcMain.handle("device:checkConsent", () => ({
    flashReset: consentGrantedFor.has("flash-reset"),
    frpBypass: consentGrantedFor.has("frp-bypass"),
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
    };
  });

  // Second arg (options) is forwarded from the method screen (brand + mode).
  // Accepted as unknown; normalized inside the runners (never trusted).
  ipcMain.handle("device:flashReset", (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return runFlashReset(win, sanitizeOperationOptions(options));
  });

  ipcMain.handle("device:frpBypass", (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return runFrpBypass(win, sanitizeOperationOptions(options));
  });
}

/** Coerce an untrusted renderer payload into a safe OperationOptions. */
function sanitizeOperationOptions(raw: unknown): OperationOptions {
  const o = (raw ?? {}) as Partial<OperationOptions>;
  const brand = typeof o.brand === "string" ? o.brand : undefined;
  const mode = o.mode === "test-mode" || o.mode === "brom" || o.mode === "fastboot-recovery" ? o.mode : undefined;
  return { brand, mode };
}

// ─── USB polling (pre-existing behavior, preserved) ──────────────────────────

function startPolling(win: BrowserWindow): void {
  stopPolling();
  const push = (status: { state: string; lastScanAt: string }) => {
    // Skip if the window is gone; a poll tick must never throw.
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      return;
    }
    try {
      win.webContents.send("device:status-changed", status);
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

  const vid = device.deviceDescriptor.idVendor;
  const vendor = WATCHED_VENDORS[vid] ?? "Unknown";
  const mode = classifyMode(device);
  const deviceName = readProductName(device, vendor);
  const brand = brandFromVendorId(vid) ?? vendor;
  const serial = `USB:${vid.toString(16).padStart(4, "0")}`;

  // Driver health: on Windows check the device's driver provider via pnputil.
  const driverMissing = await detectMissingDriver(vid, device.deviceDescriptor.idProduct);

  if (driverMissing) {
    return {
      connected: true,
      state: "DRIVER_MISSING",
      deviceName,
      mode,
      vendor,
      driver: { oem: vendor, officialUrl: OFFICIAL_DRIVER_URLS[vendor] ?? "" },
      brand,
      serial,
      source: "usb",
      lastScanAt,
    };
  }

  return {
    connected: true,
    state: "CONNECTED",
    deviceName,
    mode,
    vendor,
    brand,
    serial,
    source: "usb",
    lastScanAt,
  };
}

// Heuristic mode detection: 0xFF/vendor-specific class => recovery modes
// (Fastboot/EDL/Download), 0x02 => MTP/Storage, otherwise ADB.
function classifyMode(device: UsbDeviceLike): string {
  const classes = (device.interfaces ?? []).map((i) => i.descriptor.bInterfaceClass);
  if (classes.includes(0xff)) return "Fastboot/Download Mode";
  if (classes.includes(0x02)) return "MTP";
  return "ADB";
}

function readProductName(device: UsbDeviceLike, vendor: string): string {
  // We can't synchronously read string descriptors without opening the device;
  // node-usb's getStringDescriptor requires an open handle + async. Keep this
  // cheap and non-blocking: use a friendly generic label. (Opening the device
  // can steal it from the OS driver stack, which we must never do.)
  return `${vendor} Device`;
}

// ─── Windows driver probe (pnputil /enum-devices) ───────────────────────────

async function detectMissingDriver(vid: number, pid: number): Promise<boolean> {
  if (process.platform !== "win32") return false;

  const cacheKey = `${vid.toString(16)}:${pid.toString(16)}`;
  const cached = driverProbeCache.get(cacheKey);
  if (cached !== undefined && Date.now() < DRIVER_PROBE_TTL_MS) {
    return cached;
  }

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync(
      "pnputil",
      ["/enum-devices", "/class", "USB"],
      { timeout: 4000, windowsHide: true }
    );

    const instancePattern = new RegExp(
      `USB\\\\VID_${vid.toString(16).toUpperCase().padStart(4, "0")}&PID_${pid
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}`,
      "i"
    );
    const hasInstance = instancePattern.test(stdout);
    const hasProblem28 = /Problem\s*:\s*28/i.test(stdout);

    const missing = hasInstance && hasProblem28;
    driverProbeCache.set(cacheKey, missing);
    log.debug(`driver probe ${cacheKey} → ${missing ? "MISSING" : "OK"}`);
    return missing;
  } catch {
    // pnputil missing or no perms — assume OK rather than alarm the user.
    return false;
  }
}

// ─── ADB / USB detection engine (fresh, on-demand) ───────────────────────────

export type DeviceScanState =
  | "NORMAL"
  | "RECOVERY"
  | "SEARCHING"
  | "NOT_CONNECTED";

export interface AndroidScanResult {
  connected: boolean;
  brand?: string;
  model?: string;
  serial?: string;
  state: DeviceScanState;
  lastScanAt: string;
  /** true when ADB reports the device as connected but waiting for authorization. */
  authorized?: boolean;
  /** "adb" | "usb" — how the device was detected. */
  source?: "adb" | "usb";
}

/**
 * Compute connection status fresh on demand. Primary path: the bundled ADB
 * binary (`adb devices -l`). If ADB is missing entirely, falls back to the
 * node-usb enumeration mapping Android vendor IDs to brands, treating any
 * result as "connected (USB)" with state SEARCHING. Brand detection is
 * universal — unrecognized VIDs still report "Android device".
 */
export async function scanAndroidDevices(): Promise<AndroidScanResult> {
  const notConnected: AndroidScanResult = {
    connected: false,
    state: "NOT_CONNECTED",
    lastScanAt: new Date().toISOString(),
  };

  const adbOk = await probeAdb();
  if (adbOk) {
    // Prefer an authorized, operation-ready device. `unauthorized` lines are a
    // physically present phone waiting for the ADB authorization prompt — they
    // surface as connected:true with authorized:false so the UI can guide the
    // user instead of falling into a misleading "USB only" state. getprop calls
    // are only safe on an authorized device, so they are skipped pre-auth.
    const devices = await adbDevices();
    const authorized = devices?.find((d) => d.state === "device");
    const unauthorized = devices?.find((d) => d.state === "unauthorized");

    if (authorized) {
      const [brand, manufacturer, model] = await Promise.all([
        adbGetProp(authorized.serial, "ro.product.brand"),
        adbGetProp(authorized.serial, "ro.product.manufacturer"),
        adbGetProp(authorized.serial, "ro.product.model"),
      ]);
      const resolvedBrand = brand ?? manufacturer ?? authorized.brand;

      return {
        connected: true,
        brand: resolvedBrand,
        model: model ?? authorized.model,
        serial: authorized.serial,
        state: "NORMAL",
        authorized: true,
        source: "adb",
        lastScanAt: new Date().toISOString(),
      };
    }

    if (unauthorized) {
      log.warn(
        `[device] scanAndroidDevices: device ${unauthorized.serial} present but not authorized — surfacing authorize prompt`
      );
      return {
        connected: true,
        serial: unauthorized.serial,
        state: "SEARCHING",
        authorized: false,
        source: "adb",
        lastScanAt: new Date().toISOString(),
      };
    }

    // ADB is healthy but reports no usable device — not connected.
    return notConnected;
  }

  // ADB binary missing — fall back to USB enumeration.
  log.warn("[device] scanAndroidDevices: ADB probe returned false — falling back to USB enumeration");
  const usb = loadUsb();
  if (!usb) {
    log.warn("[device] scanAndroidDevices: node-usb unavailable — returning NOT_CONNECTED");
    return notConnected;
  }
  logUsbInventory(usb, "scanAndroidDevices/usb-fallback");

  const device = usb
    .getDeviceList()
    .find((d) => Boolean(brandFromVendorId(d.deviceDescriptor.idVendor)) || isLikelyAndroidUsb(d));
  if (!device) return notConnected;

  const vid = device.deviceDescriptor.idVendor;
  const brand = brandFromVendorId(vid) ?? "Android device";
  const mode = classifyMode(device);
  return {
    connected: true,
    brand,
    serial: `USB:${vid.toString(16).padStart(4, "0")}`,
    state: mode === "Fastboot/Download Mode" ? "RECOVERY" : "SEARCHING",
    source: "usb",
    lastScanAt: new Date().toISOString(),
  };
}

/** A 0xFF vendor-specific interface (ADB/fastboot/recovery transport) qualifies. */
function isLikelyAndroidUsb(device: UsbDeviceLike): boolean {
  return (device.interfaces ?? []).some((i) => i.descriptor.bInterfaceClass === 0xff);
}

// ─── Unified status (single source of truth for every screen) ────────────────

export interface UnifiedDeviceStatus {
  connected: boolean;
  state: DeviceScanState | "CONNECTED" | "DRIVER_MISSING";
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
}

/**
 * Single source of truth for the renderer device status. ADB-first: an
 * authorized ADB device (the strongest, operation-ready signal) wins. When ADB
 * reports nothing — tools missing, no device, or an unauthorized/offline phone
 * — fall back to the USB enumeration so any physically-present device still
 * reads as connected. `device:status`, `device:getStatus`, and the poller all
 * emit this shape, so Device Monitor, HomeScreen, and FRP Tools always agree.
 */
export async function scanUnified(): Promise<UnifiedDeviceStatus> {
  const adb = await scanAndroidDevices();
  if (adb.connected && adb.source === "adb") {
    const merged: UnifiedDeviceStatus = {
      connected: true,
      state: "CONNECTED",
      deviceName: adb.brand ?? adb.model ?? "Android device",
      mode: "ADB",
      vendor: adb.brand,
      brand: adb.brand,
      model: adb.model,
      serial: adb.serial,
      authorized: adb.authorized,
      source: "adb",
      lastScanAt: adb.lastScanAt,
    };
    log.debug(`[device] scanUnified → ADB-connected: ${adb.serial} (${adb.brand ?? "?"})`);
    return merged;
  }
  log.debug(
    `[device] scanUnified → ADB silent (adb.connected=${adb.connected}, adb.authorized=${adb.authorized ?? "n/a"}); using USB fallback`
  );
  // ADB silent/absent → USB fallback (keeps driver-missing detection intact).
  return scan();
}

// ─── Operation progress events ───────────────────────────────────────────────

function emitOperationEvent(
  win: BrowserWindow | null,
  op: "flash-reset" | "frp-bypass",
  stage: string,
  message: string,
  pct: number
): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("device:operation:event", { op, stage, message, pct });
}

// ─── Shared operation plumbing ───────────────────────────────────────────────

interface OpResult {
  success: boolean;
  message: string;
  detail?: string;
}

// ─── Locked-device transport waiters ─────────────────────────────────────────
//
// FRP-locked phones cannot reach Android Settings, so USB debugging is never a
// prerequisite: the engine watches for the physical transport the method screen
// guided the user into (MTP/Test Mode, MediaTek BROM/VCOM, Fastboot/Recovery)
// and streams live guidance while it waits. The actual data wipe still rides on
// an ADB session — Samsung Test Mode and stock Recovery expose adbd as soon as
// they connect — so "ready" means "ADB session up", with the transport watch as
// the graceful fallback that keeps the user oriented and never hard-blocks on
// "USB debugging disabled".

const OPERATION_TRANSPORT_WAIT_MS = 90_000; // generous: the user may power-cycle the phone
const OPERATION_WAIT_TICK_MS = 2_000;
const OPERATION_WAIT_HINT_EVERY_MS = 8_000;

/** True when a USB device matching the mode's transport is physically present. */
async function usbTransportPresent(mode: OperationMode): Promise<boolean> {
  const usb = loadUsb();
  if (!usb) return false;
  try {
    return usb.getDeviceList().some((d) => MODE_PROFILES[mode].classMatch(d));
  } catch (err) {
    log.warn(`[device] usbTransportPresent(${mode}) failed: ${err}`);
    return false;
  }
}

/**
 * Wait (with live progress events) until the phone is usable for the selected
 * mode — an authorized ADB session is the only way the secure wipe runs. While
 * waiting, watch for the mode's USB transport so the log can tell the user
 * "Test Mode detected — waiting for ADB…" instead of a bare "no device".
 */
async function waitForOperationTransport(
  op: ConsentOp,
  win: BrowserWindow | null,
  mode: OperationMode,
  stageLabel: string
): Promise<{ ok: false; result: OpResult } | { ok: true; scan: AndroidScanResult }> {
  const profile = MODE_PROFILES[mode];
  const startedAt = Date.now();
  let transportSeen = false;
  let adbUnauthorizedSeen = false;
  let lastHintAt = 0;

  while (Date.now() - startedAt < OPERATION_TRANSPORT_WAIT_MS) {
    const scan = await scanAndroidDevices();
    if (scan.connected && scan.source === "adb" && scan.authorized !== false) {
      log.info(`[device] waitForOperationTransport(${mode}): ADB session ready (${scan.serial})`);
      return { ok: true, scan };
    }
    if (scan.source === "adb" && scan.authorized === false) {
      adbUnauthorizedSeen = true;
    }

    // MediaTek BROM/VCOM is a low-level flashing transport: it can never serve
    // the ADB wipe FRPB performs. Confirm presence honestly, then stop waiting
    // with clear guidance instead of pretending a wipe is possible.
    if (mode === "brom" && (await usbTransportPresent("brom"))) {
      log.warn("[device] waitForOperationTransport(brom): BROM/VCOM detected — ADB wipe not possible on this transport");
      emitOperationEvent(
        win,
        op,
        "failed",
        "MediaTek BROM detected — this transport cannot run the ADB data wipe.",
        20
      );
      return {
        ok: false,
        result: {
          success: false,
          message: "Detected MediaTek BROM/Preloader (VCOM), which cannot serve the ADB data wipe.",
          detail:
            "BROM/Preloader is a low-level flashing transport with no ADB session. Power off the phone, release the volume buttons, and boot it normally (or into Fastboot/Recovery), then retry. FRPB performs the legitimate ADB-based data wipe only.",
        },
      };
    }

    if (!transportSeen && (await usbTransportPresent(mode))) {
      transportSeen = true;
      log.info(`[device] waitForOperationTransport(${mode}): ${profile.label} transport detected`);
    }
    // If the USB transport itself has disappeared (vs. recovery/ADB-side
    // state change), that is a real disconnect. Keep waiting otherwise — a
    // non-standard ADB state on a still-present bus is not a disconnect.
    if (!scan.connected && !(await usbTransportPresent(mode))) {
      emitOperationEvent(
        win,
        op,
        "disconnected",
        `Device disconnected — ${profile.label} is no longer on the bus. Reconnect the phone in ${profile.label} mode and retry.`,
        8
      );
      return {
        ok: false,
        result: {
          success: false,
          message: `Device disconnected during ${stageLabel}. Reconnect the phone in ${profile.label} mode and try again.`,
          detail: `The phone (${profile.label}) was detected but disconnected. Reconnect in ${profile.label} mode, keep the USB cable connected, and retry.`,
        },
      };
    }

    const now = Date.now();
    if (now - lastHintAt >= OPERATION_WAIT_HINT_EVERY_MS) {
      const elapsedSec = Math.round((now - startedAt) / 1000);
      const pct = Math.min(5 + Math.round((elapsedSec / (OPERATION_TRANSPORT_WAIT_MS / 1000)) * 20), 25);
      const message = transportSeen
        ? adbUnauthorizedSeen
          ? `${profile.label} detected. Tap “Allow” on the phone's USB debugging prompt for ${stageLabel} when it appears.`
          : `${profile.label} detected — waiting for the ADB session to come up (Test Mode / Recovery auto-enables it)…`
        : adbUnauthorizedSeen
          ? "USB debugging is active — unlock the phone and tap “Allow” on the authorization prompt."
          : profile.waitHint;
      emitOperationEvent(win, op, "waiting", message, pct);
      lastHintAt = now;
    }

    await sleep(OPERATION_WAIT_TICK_MS);
  }

  // Timed out without an ADB session. Distinguish "never saw the transport"
  // from "saw it but ADB never came up", and surface missing ADB tools so the
  // diagnostic stays honest even though we never hard-blocked on debugging.
  const adbNow = await probeAdb();
  const toolsDetail = adbNow
    ? ""
    : isPlatformToolsBundled()
      ? "ADB is bundled but failed its health probe (check antivirus/firewall). "
      : "Platform-tools (adb) could not be started — the data wipe needs it even in Test Mode/Recovery. ";
  const detail = transportSeen
    ? `${profile.label} was detected on the USB bus, but no ADB session appeared within ${Math.round(OPERATION_TRANSPORT_WAIT_MS / 1000)}s. ${toolsDetail}Unplug and re-enter ${profile.label}, keep the cable connected, and retry.`
    : `${toolsDetail}${profile.waitHint} Keep the phone connected and retry.`;
  emitOperationEvent(win, op, "failed", `Phone did not become ready in ${profile.label}.`, 25);
  return {
    ok: false,
    result: {
      success: false,
      message: `Phone did not become ready in ${profile.label}.`,
      detail,
    },
  };
}

/**
 * Pre-flight shared by flash-reset and frp-bypass: consent re-check, fresh
 * connection re-check, and mode-aware transport readiness. Returns a
 * discriminated result: `{ ok: false, result }` short-circuits the caller.
 *
 * Locked-device modes never demand USB debugging: when no authorized ADB
 * session exists, the engine watches for the mode's physical USB transport
 * (MTP/Test Mode, MediaTek BROM/VCOM, Fastboot/Recovery) and streams live
 * guidance until the phone is usable.
 */
async function verifyOperationReady(
  op: ConsentOp,
  win: BrowserWindow | null,
  stageLabel: string,
  options: OperationOptions = {}
): Promise<{ ok: false; result: OpResult } | { ok: true; scan: AndroidScanResult }> {
  if (!consentGrantedFor.has(op)) {
    return { ok: false, result: { success: false, message: "Legal disclaimer must be accepted first." } };
  }

  const mode = options.mode ?? "fastboot-recovery";
  emitOperationEvent(win, op, "checking", "Checking device…", 5);

  // Fast path: a fully authorized ADB session is ready to operate immediately.
  const scan = await scanAndroidDevices();
  log.info(
    `[device] verifyOperationReady(${op}, mode=${mode}): connected=${scan.connected} source=${scan.source ?? "none"} authorized=${scan.authorized ?? "n/a"} serial=${scan.serial ?? "n/a"}`
  );
  if (scan.connected && scan.source === "adb" && scan.authorized !== false) {
    return { ok: true, scan };
  }

  // No authorized ADB session — fall back to the locked-device transport watch.
  emitOperationEvent(win, op, "waiting", MODE_PROFILES[mode].waitHint, 10);
  return waitForOperationTransport(op, win, mode, stageLabel);
}

// ─── Flash Reset (full factory reset via USB, where the device permits) ─────

async function runFlashReset(
  win: BrowserWindow | null,
  options: OperationOptions = {}
): Promise<OpResult> {
  const mode = options.mode ?? "fastboot-recovery";
  const profile = MODE_PROFILES[mode];
  const ready = await verifyOperationReady("flash-reset", win, "flash reset", options);
  if (!ready.ok) return ready.result;
  const serial = ready.scan.serial!;

  emitOperationEvent(
    win,
    "flash-reset",
    "starting",
    `${profile.label} ready — starting flash reset…`,
    15
  );

  // Stage 2 — reboot to recovery.
  emitOperationEvent(win, "flash-reset", "rebooting", "Rebooting to recovery (adb reboot recovery)…", 25);
  const rebootResult = await adbReboot(serial, "recovery");
  if (!rebootResult) {
    emitOperationEvent(win, "flash-reset", "failed", "ADB tools not installed.", 25);
    return { success: false, message: "ADB tools not installed", detail: "Could not launch adb." };
  }
  if (rebootResult.exitCode !== 0) {
    const detail = rebootResult.lastErrorLine ?? "adb reboot recovery failed";
    emitOperationEvent(win, "flash-reset", "failed", detail, 25);
    return { success: false, message: `Could not reboot to recovery: ${detail}` };
  }

  // Wait for the device to drop off the bus, then re-appear in recovery.
  emitOperationEvent(win, "flash-reset", "waiting", "Waiting for device in recovery…", 45);
  await sleep(12_000);

  // Stage 3 — wipe user data via the ADB-supported recovery path.
  emitOperationEvent(
    win,
    "flash-reset",
    "wiping",
    "Wiping user data (recovery --wipe_data / adb shell wipe)…",
    70
  );
  const wipe = await adbWipeData(serial);
  if (!wipe.ok) {
    const detail = wipe.detail ?? "recovery rejected the wipe command";
    emitOperationEvent(win, "flash-reset", "failed", detail, 70);
    return {
      success: false,
      message: "Device did not allow a data wipe. The wipe command was rejected by the device.",
      detail,
    };
  }

  // Stage 4 — reboot back to the system.
  emitOperationEvent(win, "flash-reset", "rebooting", "Rebooting…", 95);
  await adbReboot(serial);

  log.info(`[device] flash-reset completed on ${serial}`);
  emitOperationEvent(win, "flash-reset", "done", "Factory reset complete.", 100);
  return {
    success: true,
    message: "Factory reset completed successfully.",
    detail: `User data was wiped via ${wipe.detail ?? "adb"} and the device is rebooting.`,
  };
}

// ─── FRP flow (legitimate recovery guidance + secure wipe) ──────────────────

async function runFrpBypass(
  win: BrowserWindow | null,
  options: OperationOptions = {}
): Promise<OpResult> {
  const mode = options.mode ?? "fastboot-recovery";
  const profile = MODE_PROFILES[mode];
  const ready = await verifyOperationReady("frp-bypass", win, "FRP recovery", options);
  if (!ready.ok) return ready.result;
  const serial = ready.scan.serial!;

  emitOperationEvent(
    win,
    "frp-bypass",
    "starting",
    `${profile.label} ready — starting FRP secure wipe…`,
    15
  );

  // Wipe user data through the same safe ADB path as flash reset.
  emitOperationEvent(
    win,
    "frp-bypass",
    "wiping",
    "Wiping user data (recovery --wipe_data / adb shell wipe)…",
    30
  );
  const wipe = await adbWipeData(serial);
  if (!wipe.ok) {
    const detail = wipe.detail ?? "recovery rejected the wipe command";
    emitOperationEvent(win, "frp-bypass", "failed", detail, 30);
    return {
      success: false,
      message: "Device did not allow a data wipe. FRP protection remains active on this device.",
      detail,
    };
  }

  emitOperationEvent(win, "frp-bypass", "rebooting", "Rebooting…", 75);
  await adbReboot(serial);

  // Structured, non-HTML, plain-text recovery guidance (informational only).
  emitOperationEvent(
    win,
    "frp-bypass",
    "account-recovery",
    [
      "Account recovery guidance (legitimate path only):",
      "1. On the Google sign-in screen, sign in with the Google account that was last synced on this device.",
      "2. If the password is unknown, the account owner must reset it at https://accounts.google.com using the recovery email/phone on file.",
      "3. After signing in, the device completes normal setup. FRP (Factory Reset Protection) remains enforced by Google.",
      "FRPB does not and cannot disable FRP security.",
    ].join("\n"),
    90
  );

  log.info(`[device] frp-bypass wipe completed on ${serial}; FRP protection remains active`);
  emitOperationEvent(win, "frp-bypass", "done", "Data wipe complete.", 100);
  return {
    success: true,
    message:
      "User data was wiped. FRP protection remains active on this device — sign in with the original Google account or use Google's account recovery at accounts.google.com.",
    detail: `Data wiped via ${wipe.detail ?? "adb"}. FRPB does not defeat FRP security; the guidance shown is the legitimate account-recovery path.`,
  };
}
