// FRPB — Low-level hardware transport taxonomy (main process).
//
// Single source of truth for the raw USB VID/PID + interface-class → hardware
// mode mapping used by the hardware detector. Mirrors the renderer contract in
// ../../src/lib/ipc.d.ts (`HardwareMode`, `HardwareSnapshot`). No ADB is
// involved anywhere in this module: every classification below is derived from
// the physical USB / COM transport only, so an FRP-locked device that cannot
// enable USB debugging is still fully identifiable.

import type { ChipsetFamily } from "@frpb/shared";

/** Physical/interconnect state the target device currently presents. */
export type HardwareMode =
  | "brom" // MediaTek BROM (Boot ROM)
  | "preloader" // MediaTek Preloader / VCOM
  | "edl" // Qualcomm EDL (Emergency Download, 9008)
  | "fastboot" // Fastboot / Bootloader / Odin download
  | "download" // Samsung Odin Download mode
  | "mtp" // MTP / PTP media mount
  | "serial" // Bare USB-serial / COM endpoint (no USB match)
  | "adb" // ADB session present (bonus, never required)
  | "none"; // Nothing recognised on the bus

// ─── Well-known vendor / product ids ─────────────────────────────────────────
export const MTK_VID = 0x0e8d; // MediaTek
export const QUALCOMM_VID = 0x05c6; // Qualcomm
export const QUALCOMM_EDL_PID = 0x9008; // Qualcomm EDL (9008)
export const SAMSUNG_VID = 0x04e8; // Samsung
export const SAMSUNG_ODIN_PID = 0x685d; // Samsung Odin / Download mode
export const GOOGLE_VID = 0x18d1; // Google / Nexus / Pixel
export const GOOGLE_FASTBOOT_PID = 0x4ee0; // Google fastboot
export const FASTBOOT_GENERIC_PID = 0xd00d; // Fastboot (AOSP reference)
export const XIAOMI_VID = 0x2717; // Xiaomi / Redmi
export const XIAOMI_ALT_VID = 0x2e17; // Xiaomi (alt)
export const MOTOROLA_VID = 0x22b8; // Motorola
export const ONEPLUS_VID = 0x2a70; // OnePlus
export const OPPO_VID = 0x2e40; // OPPO / Realme
export const VIVO_VID = 0x2d95; // vivo
export const HUAWEI_VID = 0x12d1; // Huawei / Honor

/** USB interface class that signals a vendor-specific (download/BROM) transport. */
const IFACE_VENDOR_SPECIFIC = 0xff;
const IFACE_MTP_STILL_IMAGE = 0x06;
const IFACE_CDC_DATA = 0x0a;

export interface HardwareTransport {
  mode: HardwareMode;
  /** Human label surfaced by AUTO-READ HARDWARE. */
  label: string;
  chipset: ChipsetFamily;
}

/** Fallback labels for modes that have no single USB match. */
export const MODE_LABELS: Record<HardwareMode, string> = {
  brom: "MediaTek BROM Mode",
  preloader: "MediaTek Preloader (VCOM)",
  edl: "Qualcomm EDL 9008 Mode",
  fastboot: "Fastboot / Bootloader",
  download: "Odin Download Mode",
  mtp: "MTP / Media Device",
  serial: "Serial Port (COM)",
  adb: "ADB Session",
  none: "No Device",
};

/**
 * Classify a raw USB endpoint. Deliberately ordered most-specific → least:
 * Qualcomm EDL (9008) and MediaTek BROM (0x0e8d) are unambiguous, then Odin
 * download, then fastboot, then the generic media/serial fallbacks.
 */
export function matchUsbTransport(
  vid: number,
  pid: number,
  interfaceClasses: number[] = [],
): HardwareTransport | null {
  // Qualcomm Emergency Download — 05c6:9008 is the canonical EDL signature.
  if (vid === QUALCOMM_VID && pid === QUALCOMM_EDL_PID) {
    return { mode: "edl", label: MODE_LABELS.edl, chipset: "Qualcomm" };
  }
  // MediaTek Boot ROM / Preloader — the whole 0x0e8d vendor space is BROM-class.
  if (vid === MTK_VID) {
    const brom = pid === 0x0000 || pid === 0x0001 || pid === 0x0003 || pid === 0x2000;
    return brom
      ? { mode: "brom", label: `${MODE_LABELS.brom} (${hex4(pid)})`, chipset: "MediaTek" }
      : { mode: "preloader", label: `${MODE_LABELS.preloader} (${hex4(pid)})`, chipset: "MediaTek" };
  }
  // Samsung Odin / Download mode.
  if (vid === SAMSUNG_VID && pid === SAMSUNG_ODIN_PID) {
    return { mode: "download", label: MODE_LABELS.download, chipset: "Samsung Exynos" };
  }
  // Fastboot — Google's dedicated PID, the AOSP reference PID, or a device in
  // bootloader (vendor-specific interface) whose vendor is a known fastboot OEM.
  const fastbootVendor =
    vid === GOOGLE_VID ||
    vid === XIAOMI_VID ||
    vid === XIAOMI_ALT_VID ||
    vid === MOTOROLA_VID ||
    vid === ONEPLUS_VID ||
    vid === OPPO_VID ||
    vid === VIVO_VID ||
    vid === HUAWEI_VID;
  if (
    pid === FASTBOOT_GENERIC_PID ||
    (vid === GOOGLE_VID && pid === GOOGLE_FASTBOOT_PID) ||
    (fastbootVendor && interfaceClasses.includes(IFACE_VENDOR_SPECIFIC))
  ) {
    return { mode: "fastboot", label: MODE_LABELS.fastboot, chipset: chipsetForVendor(vid) };
  }
  // MTP / PTP media mount (any known Android vendor exposing the still-image class).
  if (interfaceClasses.includes(IFACE_MTP_STILL_IMAGE)) {
    return { mode: "mtp", label: MODE_LABELS.mtp, chipset: chipsetForVendor(vid) };
  }
  // Google's normal ADB/MTP composition, or any 0xFF transport from a known OEM.
  if (interfaceClasses.includes(IFACE_VENDOR_SPECIFIC)) {
    return { mode: "fastboot", label: MODE_LABELS.fastboot, chipset: chipsetForVendor(vid) };
  }
  if (interfaceClasses.includes(IFACE_CDC_DATA)) {
    return { mode: "serial", label: MODE_LABELS.serial, chipset: chipsetForVendor(vid) };
  }
  if (vid === SAMSUNG_VID || vid === GOOGLE_VID || fastbootVendor) {
    return { mode: "mtp", label: MODE_LABELS.mtp, chipset: chipsetForVendor(vid) };
  }
  return null;
}

/** Best-effort chipset family from a USB vendor id. */
export function chipsetForVendor(vid: number): ChipsetFamily {
  if (vid === MTK_VID) return "MediaTek";
  if (vid === QUALCOMM_VID) return "Qualcomm";
  if (vid === SAMSUNG_VID) return "Samsung Exynos";
  return "Unknown";
}

/** Modes that mean the phone is NOT in Android/OS — i.e. true low-level access. */
export const LOW_LEVEL_MODES: readonly HardwareMode[] = [
  "brom",
  "preloader",
  "edl",
  "fastboot",
  "download",
] as const;

export function isLowLevel(mode: HardwareMode): boolean {
  return LOW_LEVEL_MODES.includes(mode);
}

// ─── Guided connection wizard content ────────────────────────────────────────
//
// Per-mode key-combination walkthroughs used by the Connection Wizard modal and
// streamed into the operation console. Deliberately OS-agnostic: these put the
// handset into a transport the engine can drive WITHOUT any OS-level access.

export interface HardwareGuide {
  mode: HardwareMode;
  /** Panel title, e.g. "MediaTek BROM / Preloader". */
  title: string;
  /** Exact button combination, e.g. "Volume Up + Volume Down". */
  keyCombo: string;
  /** Live line shown while the engine waits for the transport. */
  listeningLabel: string;
  steps: string[];
  note?: string;
}

const BROM_GUIDE: HardwareGuide = {
  mode: "brom",
  title: "MediaTek BROM / Preloader",
  keyCombo: "Volume Up + Volume Down",
  listeningLabel: "Listening for BROM Hardware Interface…",
  steps: [
    "Power off the target device completely.",
    "Hold Volume Up + Volume Down buttons simultaneously.",
    "Connect the USB cable while still holding both buttons.",
    "Keep holding for 5–10 seconds until Windows detects the MediaTek USB Port.",
  ],
  note: "Use a data cable (not charge-only). If nothing appears, install the MediaTek VCOM driver from the Driver Center.",
};

const EDL_GUIDE: HardwareGuide = {
  mode: "edl",
  title: "Qualcomm EDL (Emergency Download)",
  keyCombo: "Volume Up + Volume Down (or EDL cable)",
  listeningLabel: "Listening for EDL 9008 Hardware Interface…",
  steps: [
    "Power off the target device completely.",
    "Hold Volume Up + Volume Down simultaneously.",
    "Connect the USB cable while holding the buttons.",
    "Keep holding until the screen stays black — the device is now in EDL (9008) mode.",
  ],
  note: "Some Snapdragon models need a deep-flash / EDL cable. Watch for the 05C6:9008 port.",
};

const FASTBOOT_GUIDE: HardwareGuide = {
  mode: "fastboot",
  title: "Fastboot / Bootloader",
  keyCombo: "Volume Down + Power",
  listeningLabel: "Listening for Fastboot Hardware Interface…",
  steps: [
    "Power off the target device completely.",
    "Hold Volume Down + Power together until the bootloader screen appears.",
    "Release the buttons when the Fastboot / bootloader menu is shown.",
    "Connect the USB cable and leave the phone on that screen.",
  ],
  note: "On some brands the combo is Volume Up + Power — try it if Volume Down does nothing.",
};

const DOWNLOAD_GUIDE: HardwareGuide = {
  mode: "download",
  title: "Samsung Download (Odin) Mode",
  keyCombo: "Volume Down + Power (then Volume Up)",
  listeningLabel: "Listening for Download Mode Hardware Interface…",
  steps: [
    "Power off the target device completely.",
    "Hold Volume Down + Power until the warning screen appears.",
    "Press Volume Up to confirm and enter Download mode.",
    "Connect the USB cable and leave the phone on the Download screen.",
  ],
  note: "Newer Samsung models use Volume Down + Bixby/Home + Power instead of Volume Down + Power.",
};

const MTP_GUIDE: HardwareGuide = {
  mode: "mtp",
  title: "MTP / Test Mode",
  keyCombo: "None — plug in while the screen is awake",
  listeningLabel: "Listening for MTP Hardware Interface…",
  steps: [
    "Keep the phone powered on and the screen awake.",
    "On the FRP / setup screen tap “Emergency call”.",
    "Dial *#0*# (or *#888# / *#808#) to open Test Mode.",
    "Connect the USB cable and leave the phone on that screen.",
  ],
  note: "Used on Samsung builds where Test Mode is reachable from the lock-screen dialer.",
};

export const HARDWARE_GUIDES: Record<HardwareMode, HardwareGuide> = {
  brom: BROM_GUIDE,
  preloader: { ...BROM_GUIDE, mode: "preloader" },
  edl: EDL_GUIDE,
  fastboot: FASTBOOT_GUIDE,
  download: DOWNLOAD_GUIDE,
  mtp: MTP_GUIDE,
  serial: MTP_GUIDE,
  adb: MTP_GUIDE,
  none: MTP_GUIDE,
};

/** Transport-mode keys the renderer sends (mirrors `OperationMode`). */
export type OperationMode = "test-mode" | "brom" | "fastboot-recovery";

/** Which hardware mode an operation should wait for, given the user's selection. */
export function targetModesFor(mode: OperationMode | undefined, brand?: string | null): HardwareMode[] {
  const b = `${brand ?? ""}`.toLowerCase();
  if (mode === "brom") return ["brom", "preloader"];
  if (mode === "fastboot-recovery") return ["fastboot", "download"];
  // test-mode (Samsung) — accept the Samsung-specific transports first.
  if (b.includes("samsung")) return ["download", "mtp", "fastboot"];
  return ["mtp", "download", "fastboot"];
}

/** Guide backing an operation trigger, used to render the wizard before start. */
export function guideForOperation(
  mode: OperationMode | undefined,
  brand?: string | null,
): HardwareGuide {
  const b = `${brand ?? ""}`.toLowerCase();
  if (mode === "brom") return BROM_GUIDE;
  if (mode === "fastboot-recovery") return FASTBOOT_GUIDE;
  if (b.includes("samsung")) return DOWNLOAD_GUIDE;
  return DOWNLOAD_GUIDE;
}

function hex4(n: number): string {
  return `0x${n.toString(16).padStart(4, "0")}`;
}
