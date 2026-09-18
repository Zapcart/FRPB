// FRPB — Raw USB / COM hardware detection engine (main process).
//
// Replaces ADB-first readiness checks with a pure hardware poll using THREE
// independent native sources, so a locked handset is detected WITHOUT any ADB
// session or USB debugging:
//
//   1. node-usb            — raw VID/PID + interface classes (authoritative
//                            for BROM 0x0e8d and Qualcomm EDL 05c6:9008)
//   2. serialport          — real COM/tty enumeration (authoritative for the
//                            MediaTek Preloader / VCOM port, which node-usb
//                            cannot open because the driver is a modem-class
//                            serial port rather than a WinUSB endpoint)
//   3. Windows PnP         — Device Instance ID (`VID_xxxx&PID_xxxx`) + the
//                            friendly name that carries the "(COMx)" suffix
//
// Exports:
//   pollHardware()            → HardwareSnapshot   (cached, non-blocking probes)
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
    // Drop Bluetooth / virtual enumerator rows at the source. Their Device
    // Instance IDs (BTHENUM\…) and friendly names ("Standard Serial over
    // Bluetooth link (COM3)") must never take part in COM resolution — that is
    // exactly how a headset previously became the reported device.
    devices = parsePnpCsv(out).filter((d) => !isRejectedPnpRow(d));
  } catch (err) {
    log.warn(`[hw] PnP enumeration failed: ${(err as Error).message}`);
    devices = [];
  }
  pnpCache = { at: now, devices };
  return devices;
}

/**
 * True when a Windows PnP row is a Bluetooth / virtual-serial artifact.
 *
 * Matches the same reject tokens as `isVirtualOrBluetoothPort`, applied to the
 * Instance ID (`BTHENUM\…`, `ROOT\…`, `SWD\…`) and the friendly name — so a
 * Bluetooth hands-free row can never satisfy a later VID/PID lookup.
 */
function isRejectedPnpRow(row: PnpDevice): boolean {
  const hay = `${row.instanceId} ${row.friendlyName}`.toLowerCase();
  return (
    hay.includes("bthenum") ||
    hay.includes("btheun") ||
    /\bbth\b/.test(hay) ||
    hay.includes("bluetooth") ||
    hay.includes("com0com") ||
    hay.startsWith("root\\") ||
    hay.startsWith("swd\\") ||
    hay.includes("virtual serial") ||
    hay.includes("localmfg")
  );
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

// ─── serialport-backed COM enumeration ───────────────────────────────────────
//
// `SerialPort.list()` is async and touches the driver layer, so it is polled at
// most once per COM_TTL_MS and cached. The synchronous `pollHardware()` reads
// the cache, keeping the listen loop responsive.
interface SerialPortInfo {
  path?: string;
  manufacturer?: string;
  friendlyName?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
}

let serialPortCache: { at: number; ports: SerialPortInfo[] } | null = null;
const COM_TTL_MS = 2_000;
let serialPollInFlight = false;

function loadSerialPort(): { SerialPort: { list: () => Promise<SerialPortInfo[]> } } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("serialport");
  } catch (err) {
    log.warn(`[hw] serialport unavailable (${err}); COM enumeration falls back to PnP`);
    return null;
  }
}

/** Kick an async serialport enumeration (never throws, never re-entrant). */
function refreshSerialPorts(): void {
  if (serialPollInFlight) return;
  const now = Date.now();
  if (serialPortCache && now - serialPortCache.at < COM_TTL_MS) return;
  const sp = loadSerialPort();
  if (!sp) return;
  serialPollInFlight = true;
  sp.SerialPort.list()
    .then((ports) => {
      serialPortCache = { at: Date.now(), ports: Array.isArray(ports) ? ports : [] };
    })
    .catch((err) => {
      log.warn(`[hw] SerialPort.list failed: ${(err as Error).message}`);
    })
    .finally(() => {
      serialPollInFlight = false;
    });
}

/** Cached serialport enumeration (may be empty on the very first tick). */
function serialPorts(): SerialPortInfo[] {
  refreshSerialPorts();
  return serialPortCache?.ports ?? [];
}

/**
 * Force a FRESH `serialport.list()` and resolve once it completes.
 *
 * The normal poll path is cache-backed (COM_TTL_MS) so the 2s loop never shells
 * out per tick. A user-initiated "Rescan" must not be served from that cache —
 * if the phone was just plugged in, a stale list would report "no device" and
 * make the button look broken. This bypasses the TTL by clearing the stamp
 * first, then waits for the in-flight enumeration to land.
 */
export async function rescanSerialPorts(): Promise<void> {
  // Invalidate the cache so refreshSerialPorts() actually re-enumerates.
  if (serialPortCache) serialPortCache = { at: 0, ports: serialPortCache.ports };
  refreshSerialPorts();
  // Wait for the in-flight promise to settle (bounded, so a hung driver cannot
  // block the IPC handler forever).
  const deadline = Date.now() + 4_000;
  while (serialPollInFlight && Date.now() < deadline) {
    await sleep(60);
  }
}

/** True when a serial endpoint's metadata points at a MediaTek/Qualcomm port. */
function serialHint(port: SerialPortInfo): ChipsetFamily {
  const hay = `${port.manufacturer ?? ""} ${port.friendlyName ?? ""}`.toLowerCase();
  if (hay.includes("mediatek") || hay.includes("mtk") || hay.includes("preloader")) {
    return "MediaTek";
  }
  if (hay.includes("qualcomm") || hay.includes("hs-usb") || hay.includes("qcom")) {
    return "Qualcomm";
  }
  if (hay.includes("samsung")) return "Samsung Exynos";
  return "Unknown";
}

/**
 * USB vendor IDs that identify a real mobile device in a flashable mode.
 * A serial endpoint is ONLY trusted when its PnP chain carries one of these —
 * that is what separates a phone from a Bluetooth headset's virtual COM port.
 *
 *   0x0e8d MediaTek  0x05c6 Qualcomm  0x04e8 Samsung
 *   0x1782 UNISOC/Spreadtrum          0x18d1 Google (ADB/Fastboot reference)
 *
 * The wider OEM set below is included because the engine legitimately drives
 * those vendors into BROM / Fastboot / Download mode; every one of them is a
 * genuine handset vendor. A Bluetooth radio (e.g. CSR 0x0a12, Intel 0x8087) is
 * deliberately absent, so a headset can never satisfy this allow-list.
 */
const VALID_MOBILE_VIDS: ReadonlySet<number> = new Set([
  MTK_VID,
  QUALCOMM_VID,
  SAMSUNG_VID,
  0x1782, // UNISOC / Spreadtrum
  0x18d1, // Google ADB / Fastboot
  0x2717, // Xiaomi
  0x2e17, // Xiaomi (alt)
  0x22b8, // Motorola
  0x2a70, // OnePlus
  0x2e40, // OPPO / Realme
  0x2d95, // vivo
  0x12d1, // Huawei / Honor
]);

/**
 * USB product IDs that are known to belong to a mobile download / modem / ADB
 * transport. Paired with the vendor allow-list above this is the "matching
 * valid mobile VID *and* PID" requirement: a port must carry BOTH a mobile
 * vendor and a product id the vendor actually ships.
 *
 * The check is intentionally permissive when the PID is unknown or zero — many
 * serial drivers omit `productId` entirely, and MediaTek's BROM/Preloader PID
 * space is model-specific (0x0000-0x2FFF), so a VID backed by a MediaTek
 * vendor is accepted without a PID match.
 */
const VALID_MOBILE_PIDS: ReadonlySet<number> = new Set([
  // Qualcomm — EDL (9008/900E), and the modem/diag/CDC compositions.
  0x9008, 0x900e, 0x901d, 0x9039, 0x9048, 0x9056, 0x9070, 0x9091,
  // Samsung — Odin / Download mode + modem / CDC compositions.
  0x685d, 0x6860, 0x6855, 0x685b, 0x6863, 0x685c,
  // Google / AOSP — ADB, fastboot, and the reference fastboot PID.
  0x4ee0, 0x4ee2, 0x4ee7, 0xd00d,
  // UNISOC / Spreadtrum download transports.
  0x1782, 0x4d00,
]);

/** True when a USB vendor id belongs to a known flashable device vendor. */
function isValidMobileVid(vid: number | null | undefined): boolean {
  return typeof vid === "number" && VALID_MOBILE_VIDS.has(vid);
}

/**
 * True when `pid` is a plausible product id for the given mobile vendor.
 *
 * When the PID is unknown (null/0) the VID evidence stands on its own, so a
 * driver that hides `productId` cannot silently break detection. MediaTek is
 * accepted with any PID because its BROM/Preloader product ids are per-model.
 */
function isValidMobilePid(vid: number | null, pid: number | null): boolean {
  if (pid === null || pid === 0) return true;
  if (vid === MTK_VID) return true;
  return VALID_MOBILE_PIDS.has(pid);
}

/** Combined evidence: a mobile vendor AND a matching mobile product id. */
function isMobilePortEvidence(vid: number | null, pid: number | null): boolean {
  return isValidMobileVid(vid) && isValidMobilePid(vid, pid);
}

/**
 * Bluetooth / virtual serial endpoints that must NEVER be treated as a phone.
 *
 * `BTHENUM` is the Windows enumerator for Bluetooth serial profiles — it is the
 * exact reason a hands-free headset shows up as "COM3" and previously wedged the
 * wizard in "Listening…" forever. `com0com` and the `ROOT\`/`SWD\` enumerators
 * are software loopback ports with no hardware behind them at all.
 */
const VIRTUAL_PORT_PATTERNS: readonly RegExp[] = [
  /bthenum/i,
  /\bbth\b/i,
  /bluetooth/i,
  /com0com/i,
  /^root\\/i,
  /^swd\\/i,
  /virtual\s+serial/i,
  /standard\s+serial\s+over\s+bluetooth/i,
];

/**
 * Combined identifying metadata for a serial endpoint.
 *
 * Every field serialport exposes is folded into ONE lowercase haystack because
 * a Bluetooth device is not flagged in the same property across driver
 * versions — e.g. the reject token `BTH` can arrive in `pnpId` ("BTHENUM\\…"),
 * in `path` ("BTH001"), or in the friendly name ("Standard Serial over
 * Bluetooth link (COM3)"). Matching only `pnpId` is exactly how some headsets
 * slipped through and produced a phantom "Connected · COM".
 */
function combinedPortHay(port: SerialPortInfo): string {
  return [port.pnpId, port.path, port.friendlyName, port.manufacturer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * True when a serial endpoint is Bluetooth or a software/virtual port.
 *
 * Rejects any port whose `pnpId`, `path`, `friendlyName`, or `manufacturer`
 * carries `BTHENUM`, `BTH`, `Bluetooth`, or `com0com` (plus the other virtual
 * enumerators). Name, path, and manufacturer are tested as well as the PnP id
 * so a headset can never masquerade as a phone.
 */
function isVirtualOrBluetoothPort(port: SerialPortInfo): boolean {
  const hay = combinedPortHay(port);
  if (!hay) return true; // No identifying metadata at all → not trustworthy.
  if (VIRTUAL_PORT_PATTERNS.some((re) => re.test(hay))) return true;

  // A Bluetooth port's path can itself start with "BTH…" (BTHENUM exposes the
  // symbolic link that way on some stacks) — catch it on the raw path too.
  return /^bth/i.test((port.path ?? "").toLowerCase());
}

/**
 * VID parsed from a serialport entry, when the driver exposes it.
 * serialport reports these as hex strings without a 0x prefix.
 */
function vidFromSerialEntry(port: SerialPortInfo): number | null {
  const raw = port.vendorId;
  if (!raw) {
    // Some drivers expose only the PnP id ("USB\\VID_0E8D&PID_0003\\…"), so the
    // vendor is recovered from the Device Instance ID as a fallback.
    const m = /VID_([0-9A-F]{4})/i.exec(port.pnpId ?? "");
    return m?.[1] ? Number.parseInt(m[1], 16) : null;
  }
  const parsed = Number.parseInt(raw.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * PID parsed from a serialport entry (hex string) or, as a fallback, from the
 * `PID_xxxx` token inside the PnP Device Instance ID.
 */
function pidFromSerialEntry(port: SerialPortInfo): number | null {
  const raw = port.productId;
  if (raw) {
    const parsed = Number.parseInt(raw.replace(/^0x/i, ""), 16);
    if (Number.isFinite(parsed)) return parsed;
  }
  const m = /PID_([0-9A-F]{4})/i.exec(port.pnpId ?? "");
  return m?.[1] ? Number.parseInt(m[1], 16) : null;
}

/**
 * Mobile VID + PID recovered from a PnP Device Instance ID
 * ("USB\\VID_0E8D&PID_0003\\…"). Either value is null when the token is absent.
 */
function pnpRowIds(row: PnpDevice | null | undefined): {
  vid: number | null;
  pid: number | null;
} {
  if (!row) return { vid: null, pid: null };
  const v = /VID_([0-9A-F]{4})/i.exec(row.instanceId);
  const p = /PID_([0-9A-F]{4})/i.exec(row.instanceId);
  return {
    vid: v?.[1] ? Number.parseInt(v[1], 16) : null,
    pid: p?.[1] ? Number.parseInt(p[1], 16) : null,
  };
}

/**
 * Best COM port. Preference order:
 *   1. serialport entry whose metadata names a mobile SoC vendor (the true
 *      MediaTek Preloader / Qualcomm VCOM port)
 *   2. the VID/PID-matched PnP friendly name
 *   3. a serialport entry whose VID *and* PID match a real mobile device
 *   4. the Windows SERIALCOMM registry map, but ONLY when the matching PnP row
 *      resolves to a mobile VID/PID pair
 *
 * Every branch rejects Bluetooth and virtual ports. When nothing valid is
 * present the result is `{ port: null }` so callers report "no device" rather
 * than latching onto a headset.
 */
function readComPort(
  pnp: PnpDevice[],
  preferVid?: number | null,
  preferPid?: number | null
): { port: string | null; entry: SerialPortInfo | null } {
  // A generic COM3 must never be accepted: every candidate below must have
  // survived the Bluetooth/virtual filter AND carry mobile VID/PID evidence.
  const ports = serialPorts().filter((p) => !isVirtualOrBluetoothPort(p));

  // 1. Vendor-hinted serialport entry — the SoC vendor name in its metadata is
  //    itself proof of a real phone transport (MediaTek Preloader / QCOM VCOM).
  const hinted = ports.find((p) => serialHint(p) !== "Unknown");
  if (hinted?.path) return { port: hinted.path.toUpperCase(), entry: hinted };

  // 2. PnP row for the exact VID/PID (its friendly name carries "(COMx)").
  if (preferVid != null) {
    const row =
      (preferPid != null ? findPnpFor(preferVid, preferPid, pnp) : null) ??
      findPnpByVendorHint(preferVid, pnp);
    const m = row && /\((COM\d+)\)/i.exec(row.friendlyName);
    if (m?.[1]) return { port: m[1].toUpperCase(), entry: null };
  }

  // 3. A serialport entry backed by a matching mobile VID + PID.
  const withVid = ports.find((p) =>
    isMobilePortEvidence(vidFromSerialEntry(p), pidFromSerialEntry(p))
  );
  if (withVid?.path) return { port: withVid.path.toUpperCase(), entry: withVid };

  // 3b. PnP row whose Device Instance ID carries a matching mobile VID + PID.
  for (const d of pnp) {
    const { vid, pid } = pnpRowIds(d);
    if (!isMobilePortEvidence(vid, pid)) continue;
    const m = /\((COM\d+)\)/i.exec(d.friendlyName);
    if (m?.[1]) return { port: m[1].toUpperCase(), entry: null };
  }

  // 4. Windows SERIALCOMM registry map — accepted only if the COM port maps to
  //    a PnP row with matching mobile VID + PID (the registry alone cannot tell
  //    us the vendor, and blindly trusting it is how a Bluetooth port got in).
  if (process.platform !== "win32") return { port: null, entry: null };
  try {
    const out = execSync("reg query HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM", {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
    });
    const comMatch = /(COM\d+)/i.exec(out);
    const com = comMatch?.[1] ? comMatch[1].toUpperCase() : null;
    if (!com) return { port: null, entry: null };

    const row = pnp.find((d) => d.friendlyName.toUpperCase().includes(com));
    const { vid, pid } = pnpRowIds(row ?? null);
    if (!row || !isMobilePortEvidence(vid, pid)) return { port: null, entry: null };
    return { port: com, entry: null };
  } catch {
    return { port: null, entry: null };
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

/**
 * Default status shown while no mobile USB device is attached.
 *
 * Deliberately explicit and physical: a generic COM port (e.g. COM3) must NEVER
 * read as a connected phone. When nothing matches the mobile VID/PID allow-list
 * the whole app reports this single line instead of "Connected · COM".
 */
export const WAITING_FOR_USB_LABEL = "Waiting for USB Phone Connection...";

function emptySnapshot(): HardwareSnapshot {
  return {
    mode: "none",
    label: WAITING_FOR_USB_LABEL,
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
  // Eagerly kick the async serialport enumeration so the cache is warm for the
  // synchronous path below and for the vendor-hinted preloader branch.
  refreshSerialPorts();
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
        const com = readComPort(pnp, vid, pid);
        const rowPort =
          (pnpRow && /\((COM\d+)\)/i.exec(pnpRow.friendlyName)?.[1]?.toUpperCase()) ??
          com.port;
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

  // No node-usb match — fall back to the serial transport. This is the path
  // that catches the MediaTek Preloader / VCOM port, which enumerates as a
  // modem-class COM port that libusb cannot open. A vendor-hinted serialport
  // entry (MediaTek/Qualcomm in its metadata) is classified as BROM/preloader
  // rather than a generic serial port, so the wizard recognises it as a
  // low-level interface and auto-advances.
  if (!best) {
    const com = readComPort(pnp, null, null);
    // Defence in depth: `readComPort` already filters Bluetooth/virtual ports,
    // but re-check here so a future change to the port list can never silently
    // reintroduce a headset as a "connected device".
    const comIsVirtual = com.entry ? isVirtualOrBluetoothPort(com.entry) : false;
    if (com.port && !comIsVirtual) {
      // A serial endpoint may only be promoted to a LOW-LEVEL mode (preloader /
      // EDL) when its PnP chain / serialport metadata proves a mobile VID *and*
      // PID. Without that evidence it is reported as a bare "serial" endpoint,
      // which is deliberately NOT a wizard target — so the wizard keeps waiting
      // for a real phone instead of attaching to a generic COM3.
      const pnpRowForCom = pnp.find((d) =>
        d.friendlyName.toUpperCase().includes(com.port!)
      );
      const comIds = pnpRowIds(pnpRowForCom ?? null);
      const comVid = comIds.vid ?? vidFromSerialEntry(com.entry ?? {});
      const comPid = comIds.pid ?? pidFromSerialEntry(com.entry ?? {});
      const vendorProven = isMobilePortEvidence(comVid, comPid);

      const chipset =
        (com.entry ? serialHint(com.entry) : "Unknown") !== "Unknown"
          ? serialHint(com.entry!)
          : inferChipsetFromName(pnpRowForCom?.friendlyName ?? "");
      const isMtk = chipset === "MediaTek";
      const isQcom = chipset === "Qualcomm";
      // A vendor-hinted MediaTek/Qualcomm endpoint is genuine phone hardware even
      // when the driver hides VID/PID; a bare unrecognised port stays "serial".
      const hintedMobile =
        com.entry != null && serialHint(com.entry) !== "Unknown";
      const provenMobile = vendorProven || hintedMobile;
      const mode: HardwareMode =
        !provenMobile ? "serial" : isMtk ? "preloader" : isQcom ? "edl" : "serial";
      const pnpRow = pnp.find((d) => d.friendlyName.toUpperCase().includes(com.port!));
      best = {
        mode,
        label:
          mode === "serial"
            ? `${MODE_LABELS.serial} (${com.port})`
            : `${MODE_LABELS[mode]} (${com.port})`,
        connected: true,
        vid: comVid,
        pid: comPid,
        vidHex: comVid !== null ? hex4(comVid) : null,
        pidHex: comPid !== null ? hex4(comPid) : null,
        port: com.port,
        chipset,
        deviceInstanceId: pnpRow?.instanceId ?? null,
        deviceName:
          com.entry?.friendlyName ??
          pnpRow?.friendlyName ??
          com.entry?.manufacturer ??
          null,
        listenerActive,
        requiresKeyCombo: isMtk || isQcom,
        lowLevel: isLowLevel(mode),
        lastScanAt,
      };
    }
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
      // Deliberately explicit: a bare serial endpoint is NOT a flashable phone
      // (and never a Bluetooth port — those are filtered before we get here).
      // Saying so prevents the console from implying a device was found while
      // the wizard is still correctly waiting.
      lines.push(
        `[INFO] Serial device detected${portSuffix} — not a recognised phone interface, still waiting`
      );
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
