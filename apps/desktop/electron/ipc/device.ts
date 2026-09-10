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
  sleep,
} from "../utils/adb";
import { runFrpBypass } from "../utils/frp-engine";

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
    const devices = await adbDevices();
    if (!devices || devices.length === 0) {
      return { models: listKnownModels(), detectedModel: undefined };
    }
    const detectedModel = devices[0]?.model;
    return { models: listKnownModels(), detectedModel };
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

  // Single handler for device:frpBypass — sanitizes + delegates to runFrpBypass.
  ipcMain.handle("device:frpBypass", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
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
      }
    );
    // Map BypassResult → OperationResult so the renderer always gets a typed
    // { success, message, detail? } shape. Never leak BypassResult internals.
    if (result.status === "success") {
      return { success: true, message: result.detail || "FRP lock removed successfully.", detail: result.detail };
    }
    if (result.status === "failed") {
      return { success: false, message: result.error || "Operation failed." };
    }
    // pending/running should never be the settled state of a handle.
    return { success: false, message: "Operation failed." };
  });

}

/** Coerce an untrusted renderer payload into a safe OperationOptions. */
function sanitizeOperationOptions(raw: unknown): OperationOptions {
  const o = (raw ?? {}) as Partial<OperationOptions>;
  const brand = typeof o.brand === "string" ? o.brand : undefined;
  const mode = o.mode === "test-mode" || o.mode === "brom" || o.mode === "fastboot-recovery" ? o.mode : undefined;
  return { brand, mode };
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
