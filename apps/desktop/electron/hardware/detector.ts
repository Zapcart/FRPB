// FRPB — Raw USB / COM hardware detection engine (main process).
//
// Replaces ADB-first readiness checks with a pure hardware poll: it enumerates
// raw node-usb devices (VID/PID + interface classes) and parses the Windows
// Device Instance IDs / COM ports via the PnP device tree, so a locked handset
// in MediaTek BROM, Qualcomm EDL (9008), Fastboot, or a bare serial (COMx)
// endpoint is detected and classified WITHOUT any ADB session or USB debugging.
//
// Exports:
//   pollHardware()            → HardwareSnapshot   (synchronous, cached probes)
//   waitForHardware()         → Promise<HardwareSnapshot | null>  (live listen)
//   describeHardware()        → string[]  (console log lines)
//   isTargetMode()            → boolean

import { execSync } from "node:child_process";
import { log } from "../utils/logger";
import type { ChipsetFamily } from "@frpb/shared";
import {
  MTK_VID,
  QUALCOMM_VID,
  SAMSUNG_VID,
  MODE_LABELS,
  chipsetForVendor,
  isLowLevel,
  matchUsbTransport,
  targetModesFor,
  type HardwareMode,
  type OperationMode,
} from "./modes";

/** A raw snapshot of the physical hardware transport currently attached. */
export interface HardwareSnapshot {
  /** Classified low-level transport (or "none"). */
  mode: HardwareMode;
  /** Human label, e.g. "MediaTek BROM Mode (0x0003)". */
  label: string;
  connected: boolean;
  vid: number | null;
  pid: number | null;
  vidHex: string | null;
  pidHex: string | null;
  /** Windows COM port exposed by the device (e.g. "COM3"), null when none. */
  port: string | null;
  chipset: ChipsetFamily;
  /** Windows Device Instance ID, e.g. "USB\\VID_0E8D&PID_0003\\6&1F2A...". */
  deviceInstanceId: string | null;
  /** Friendly PnP name, e.g. "MediaTek USB Port (COM3)". */
  deviceName: string | null;
  /** True when the engine is actively waiting for a transport. */
  listenerActive: boolean;
  /** True when this transport requires a hardware key combination. */
  requiresKeyCombo: boolean;
  /** True for BROM / Preloader / EDL / Fastboot / Download (OS-independent). */
  lowLevel: boolean;
  lastScanAt: string;
}

interface UsbDeviceLike {
  deviceDescriptor: { idVendor: number; idProduct: number; iProduct: number };
  interfaces?: Array<{ descriptor: { bInterfaceClass: number } }>;
}

interface PnpDevice {
  instanceId: string;
  friendlyName: string;
  className: string;
}

/** Lowercase-hex 4-digit formatter used to build "VID_xxxx&PID_xxxx" matchers. */
function hex4(n: number): string {
  return `0x${n.toString(16).padStart(4, "0")}`;
}

// ─── Lazy node-usb ───────────────────────────────────────────────────────────
function loadUsb(): { getDeviceList: () => UsbDeviceLike[] } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("usb");
  } catch (err) {
    log.warn(`[hw] node-usb unavailable (${err}); raw USB polling disabled`);
    return null;
  }
}

// ─── Windows PnP enumeration (Device Instance IDs + friendly names) ──────────
//
// `Get-PnpDevice -PresentOnly` is the cheapest reliable way to obtain both the
// Device Instance ID (which carries VID_xxxx&PID_xxxx) and the friendly name
// (which carries the "(COMx)" suffix). Cached briefly so the ~1s listen loop
// never shells out on every tick.
let pnpCache: { at: number; devices: PnpDevice[] } | null = null;
const PNP_TTL_MS = 1_500;

function readPnpDevices(): PnpDevice[] {
  if (process.platform !== "win32") return [];
  const now = Date.now();
  if (pnpCache && now - pnpCache.at < PNP_TTL_MS) return pnpCache.devices;

  let devices: PnpDevice[] = [];
  try {
    const out = execSync(
      'powershell -NoProfile -NonInteractive -Command "Get-PnpDevice -PresentOnly | Select-Object InstanceId,FriendlyName,Class | ConvertTo-Csv -NoTypeInformation"',
      { encoding: "utf8", timeout: 6000, windowsHide: true },
    );
    devices = parsePnpCsv(out);
  } catch (err) {
    log.warn(`[hw] PnP enumeration failed: ${(err as Error).message}`);
    devices = [];
  }
  pnpCache = { at: now, devices };
  return devices;
}

/** Parse the `ConvertTo-Csv` output into typed rows (QUOTED CSV, 3 columns). */
function parsePnpCsv(csv: string): PnpDevice[] {
  const rows: PnpDevice[] = [];
  const lines = csv.split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^"?InstanceId"/i.test(line)) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 3) continue;
    const [instanceId, friendlyName, className] = cols;
    if (!instanceId) continue;
    rows.push({
      instanceId: instanceId.trim(),
      friendlyName: (friendlyName ?? "").trim(),
      className: (className ?? "").trim(),
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Best COM port from the PnP tree or the SERIALCOMM device map. */
function readComPort(pnp: PnpDevice[]): string | null {
  for (const d of pnp) {
    const m = /\((COM\d+)\)/i.exec(d.friendlyName) ?? /\b(COM\d+)\b/i.exec(d.friendlyName);
    if (m && m[1]) return m[1].toUpperCase();
  }
  if (process.platform !== "win32") return null;
  try {
    const out = execSync("reg query HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM", {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
    });
    const m = /(COM\d+)/i.exec(out);
    return m && m[1] ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Locate the PnP row matching a USB VID/PID (its Device Instance ID). */
function findPnpFor(vid: number, pid: number, pnp: PnpDevice[]): PnpDevice | null {
  const needle = `VID_${hex4(vid)}&PID_${hex4(pid)}`.toUpperCase();
  for (const d of pnp) {
    if (d.instanceId.toUpperCase().includes(needle)) return d;
  }
  return null;
}

/** Fallback: first PnP row that looks like a MediaTek / Qualcomm / Samsung port. */
function findPnpByVendorHint(vid: number, pnp: PnpDevice[]): PnpDevice | null {
  const hints =
    vid === MTK_VID
      ? ["mediatek", "preloader", "mtk usb"]
      : vid === QUALCOMM_VID
        ? ["qualcomm", "hs-usb", "qcom", "9008", "edl"]
        : vid === SAMSUNG_VID
          ? ["samsung", "odin", "gadget serial"]
          : [];
  if (hints.length === 0) return null;
  for (const d of pnp) {
    const hay = `${d.friendlyName} ${d.instanceId}`.toLowerCase();
    if (hints.some((h) => hay.includes(h))) return d;
  }
  return null;
}

// ─── Snapshot assembly ───────────────────────────────────────────────────────

let listenerActive = false;

/** Mark whether a hardware listen loop is currently running (drives the UI). */
export function setListenerActive(active: boolean): void {
  listenerActive = active;
}

function emptySnapshot(): HardwareSnapshot {
  return {
    mode: "none",
    label: MODE_LABELS.none,
    connected: false,
    vid: null,
    pid: null,
    vidHex: null,
    pidHex: null,
    port: null,
    chipset: "Unknown",
    deviceInstanceId: null,
    deviceName: null,
    listenerActive,
    requiresKeyCombo: false,
    lowLevel: false,
    lastScanAt: new Date().toISOString(),
  };
}

/**
 * Synchronous hardware poll. Enumerates raw USB first (authoritative VID/PID +
 * interface classes), then enriches with the Windows PnP Device Instance ID and
 * COM port. Never throws — always returns a snapshot.
 */
export function pollHardware(): HardwareSnapshot {
  const lastScanAt = new Date().toISOString();
  const pnp = readPnpDevices();
  const port = readComPort(pnp);
  const usb = loadUsb();

  let best: HardwareSnapshot | null = null;
  if (usb) {
    try {
      const devices = usb.getDeviceList();
      for (const d of devices) {
        const vid = d.deviceDescriptor.idVendor;
        const pid = d.deviceDescriptor.idProduct;
        const classes = (d.interfaces ?? []).map((i) => i.descriptor.bInterfaceClass);
        const transport = matchUsbTransport(vid, pid, classes);
        if (!transport) continue;
        // Prefer a low-level transport over a plain MTP mount when several
        // devices share the bus (e.g. a hub plus the phone).
        if (best && isLowLevel(best.mode) && !isLowLevel(transport.mode)) continue;
        const pnpRow = findPnpFor(vid, pid, pnp) ?? findPnpByVendorHint(vid, pnp);
        const rowPort =
          (pnpRow && /\((COM\d+)\)/i.exec(pnpRow.friendlyName)?.[1]?.toUpperCase()) || port;
        best = {
          mode: transport.mode,
          label: transport.label,
          connected: true,
          vid,
          pid,
          vidHex: hex4(vid),
          pidHex: hex4(pid),
          port: isLowLevel(transport.mode) || transport.mode === "serial" ? rowPort : null,
          chipset: transport.chipset,
          deviceInstanceId: pnpRow?.instanceId ?? null,
          deviceName: pnpRow?.friendlyName ?? null,
          listenerActive,
          requiresKeyCombo:
            transport.mode === "brom" ||
            transport.mode === "preloader" ||
            transport.mode === "edl",
          lowLevel: isLowLevel(transport.mode),
          lastScanAt,
        };
        if (isLowLevel(transport.mode)) break;
      }
    } catch (err) {
      log.warn(`[hw] USB enumeration failed: ${(err as Error).message}`);
    }
  }

  // No USB match, but a bare serial endpoint is present (e.g. a VCOM port that
  // node-usb cannot open because the driver is a modem-class port).
  if (!best && port) {
    const pnpRow = pnp.find((d) => d.friendlyName.toUpperCase().includes(port));
    const chipset = inferChipsetFromName(pnpRow?.friendlyName ?? "");
    best = {
      mode: "serial",
      label: `${MODE_LABELS.serial} (${port})`,
      connected: true,
      vid: null,
      pid: null,
      vidHex: null,
      pidHex: null,
      port,
      chipset,
      deviceInstanceId: pnpRow?.instanceId ?? null,
      deviceName: pnpRow?.friendlyName ?? null,
      listenerActive,
      requiresKeyCombo: false,
      lowLevel: false,
      lastScanAt,
    };
  }

  return best ?? emptySnapshot();
}

function inferChipsetFromName(name: string): ChipsetFamily {
  const n = name.toLowerCase();
  if (n.includes("mediatek") || n.includes("mtk") || n.includes("preloader")) return "MediaTek";
  if (n.includes("qualcomm") || n.includes("qcom") || n.includes("hs-usb")) return "Qualcomm";
  if (n.includes("samsung")) return "Samsung Exynos";
  return "Unknown";
}

/**
 * Live listen: poll until the attached hardware matches one of `targets`
 * (or `timeoutMs` elapses). `onTick` fires on every *change* so the UI can
 * stream "[INFO] … USB Port Found (COM3)" lines without spamming.
 */
export async function waitForHardware(
  targets: HardwareMode[],
  timeoutMs: number,
  onTick?: (snapshot: HardwareSnapshot) => void,
  pollMs = 900,
): Promise<HardwareSnapshot | null> {
  setListenerActive(true);
  const deadline = Date.now() + timeoutMs;
  let lastKey = "";
  try {
    // Immediate first probe so an already-connected device resolves instantly.
    for (;;) {
      const snap = pollHardware();
      const key = `${snap.mode}|${snap.vidHex}|${snap.pidHex}|${snap.port}`;
      if (key !== lastKey) {
        lastKey = key;
        onTick?.(snap);
      }
      if (snap.connected && targets.includes(snap.mode)) return snap;
      if (Date.now() >= deadline) return null;
      await sleep(pollMs);
    }
  } finally {
    setListenerActive(false);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Console log lines describing a snapshot transition (INFO granularity). */
export function describeHardware(snap: HardwareSnapshot): string[] {
  const lines: string[] = [];
  if (!snap.connected) {
    lines.push("[INFO] No hardware interface detected — keep the buttons held and the cable connected.");
    return lines;
  }
  const portSuffix = snap.port ? ` (${snap.port})` : "";
  switch (snap.mode) {
    case "brom":
      lines.push(`[INFO] MediaTek BROM Port Found${portSuffix}`);
      lines.push(`[INFO] Device Instance ID: ${snap.deviceInstanceId ?? "n/a"}`);
      lines.push("[INFO] Injecting DA Payload…");
      break;
    case "preloader":
      lines.push(`[INFO] MediaTek Preloader Detected${portSuffix}`);
      lines.push("[INFO] Injecting DA Payload…");
      break;
    case "edl":
      lines.push(`[INFO] Qualcomm EDL 9008 Port Found${portSuffix}`);
      lines.push(`[INFO] Device Instance ID: ${snap.deviceInstanceId ?? "n/a"}`);
      lines.push("[INFO] Sending Sahara/Firehose handshake…");
      break;
    case "fastboot":
      lines.push(`[INFO] Fastboot Interface Found${portSuffix}`);
      lines.push("[INFO] Preparing partition commands…");
      break;
    case "download":
      lines.push(`[INFO] Odin Download Mode Found${portSuffix}`);
      lines.push("[INFO] Preparing download payload…");
      break;
    case "mtp":
      lines.push(`[INFO] MTP Device Found${portSuffix}`);
      break;
    case "serial":
      lines.push(`[INFO] Serial Port Found${portSuffix}`);
      break;
    case "adb":
      lines.push("[INFO] ADB session present (not required)");
      break;
    default:
      lines.push("[INFO] Unknown hardware interface.");
  }
  return lines;
}

/** True when the snapshot's mode is one the operation is waiting for. */
export function isTargetMode(
  snap: HardwareSnapshot,
  mode: OperationMode | undefined,
  brand?: string | null,
): boolean {
  return snap.connected && targetModesFor(mode, brand).includes(snap.mode);
}

export { targetModesFor };
export type { HardwareMode, OperationMode };
