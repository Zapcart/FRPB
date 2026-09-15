import type { OperationKind } from "../../lib/ipc";

/**
 * Shared constants + helpers for the FRP Tools 3-screen wizard.
 * Detection is brand-agnostic — the brand grid only tunes which methods are
 * offered. Never restricts detection.
 */

/** Verbatim legal disclaimer — legally mandated, never reworded or softened.
 *  The main process also enforces consent server-side. */
export const DISCLAIMER_TEXT =
  "⚠️ IMPORTANT DISCLAIMER — This tool and its FRP Bypass / Flash Reset features are intended ONLY for legitimate owners of Android devices who have forgotten their Google Account (Gmail) password and are locked out of their own device due to Factory Reset Protection (FRP). This tool MUST NOT be used for: Stolen devices, Devices obtained through theft or robbery, Any device that does not belong to you. Unauthorized use of this tool on devices that are not your own is illegal. The developers and distributors of this software will cooperate fully with law enforcement and pursue legal action against anyone found to be using this tool for illegal purposes, including but not limited to handling stolen phones. By proceeding, you confirm that you are the rightful owner of the connected device, or you have explicit written authorization from the owner to perform this operation.";

/** All supported brands shown in the radio grid. */
export const BRANDS: string[] = [
  "Samsung",
  "Xiaomi",
  "Redmi",
  "OPPO",
  "realme",
  "vivo",
  "motorola",
  "Lenovo",
  "micromax",
  "ZTE",
  "HUAWEI",
  "ONEPLUS",
  "HONOR",
  "TCL",
  "TECNO",
  "Infinix",
  "itel",
  "SONY",
  "Google",
];

export type MethodId = "general" | "mediatek";

export interface MethodMeta {
  id: MethodId;
  label: string;
  desc: string;
  badge?: "new";
  available: boolean;
}

interface BrandMeta {
  mediatek?: boolean;
}

/** Extensible brand → method mapping. Every brand implicitly supports the
 *  General Unlocking Method; only brands listed here get the MediaTek method.
 *  Add a new entry to extend — detection is never affected. */
export const BRAND_METHODS: Record<string, BrandMeta> = {
  Xiaomi: { mediatek: true },
  Redmi: { mediatek: true },
};

const METHODS: Omit<MethodMeta, "available">[] = [
  {
    id: "general",
    label: "General Unlocking Method",
    desc: "Recommended — works on every supported device.",
  },
  {
    id: "mediatek",
    label: "MediaTek CPU",
    desc: "Optimized for devices powered by MediaTek chipsets.",
    badge: "new",
  },
];

export function methodsForBrand(brand: string | null): MethodMeta[] {
  const meta = brand ? BRAND_METHODS[brand] : undefined;
  return METHODS.map((m) =>
    m.id === "mediatek" && !meta?.mediatek
      ? { ...m, available: false }
      : { ...m, available: true }
  );
}

export function seriesFooter(brand: string | null): string {
  if (!brand) return "Supports Android 6 or later";
  const series = brand === "Redmi" ? "Redmi" : brand;
  return `Supports all ${series} series`;
}

export function opLabel(op: OperationKind): string {
  return op === "flash-reset" ? "Flash Reset" : "FRP Bypass";
}

// ─── Locked-device connection guides ──────────────────────────────────────────
//
// An FRP-locked phone cannot open Android Settings, so "enable USB debugging"
// is impossible and must never be a prerequisite. Each method instead gets a
// key-combo / dial-code guide that puts the phone into a transport the engine
// can detect (Test Mode MTP, MediaTek BROM/VCOM, or Fastboot/Recovery). The
// engine waits live for that transport and reports progress in the operation
// log while the user follows these steps.

export type ConnectionGuideKey = "test-mode" | "brom" | "fastboot-recovery";

export interface ConnectionStep {
  title: string;
  detail?: string;
}

export interface ConnectionGuide {
  key: ConnectionGuideKey;
  /** Panel title, e.g. "Samsung Test Mode (MTP)". */
  title: string;
  /** Short chip naming what the app is waiting to detect. */
  modeChip: string;
  /** First live-log line emitted while the engine waits for this transport. */
  waitHint: string;
  /** Exact button combination the user must hold, e.g. "Volume Up + Volume Down". */
  keyCombo: string;
  /** Live status line shown while listening, e.g. "Listening for BROM…". */
  listeningLabel: string;
  steps: ConnectionStep[];
}

const TEST_MODE_GUIDE: ConnectionGuide = {
  key: "test-mode",
  title: "Samsung Test Mode (MTP)",
  modeChip: "Samsung Test Mode · MTP",
  keyCombo: "None — plug in while Test Mode is open",
  listeningLabel: "Listening for MTP Hardware Interface…",
  waitHint:
    "Waiting for the phone in Samsung Test Mode (MTP)… tap Emergency call on the FRP screen and dial *#0*# (or *#888# / *#808#).",
  steps: [
    {
      title: "On the FRP / setup screen, tap “Emergency call”.",
      detail: "This opens the dialer from the lock screen — no unlock or account needed.",
    },
    {
      title: "Dial a Samsung test-mode code and press call.",
      detail: "Try *#0*# to open Test Mode on most Samsung builds. If nothing happens, try *#888# or *#808#.",
    },
    {
      title: "Leave Test Mode open — do not reboot.",
      detail: "Test Mode keeps the USB port active even with no USB debugging; the phone shows up as MTP / Samsung USB.",
    },
    {
      title: "Plug in the USB cable and keep the screen on.",
      detail: "If a USB debugging “Allow” prompt appears (debugging was enabled before the lock), tap Allow.",
    },
  ],
};

const BROM_GUIDE: ConnectionGuide = {
  key: "brom",
  title: "MediaTek BROM / Preloader",
  modeChip: "MediaTek BROM · VCOM",
  keyCombo: "Volume Up + Volume Down",
  listeningLabel: "Listening for BROM Hardware Interface…",
  waitHint:
    "Waiting for MediaTek BROM / Preloader (VCOM)… with the phone OFF, hold Volume Up + Volume Down together and plug in the USB cable.",
  steps: [
    {
      title: "Power the phone completely off.",
      detail: "Long-press Power → Power off. Locking the screen is not enough.",
    },
    {
      title: "Press and hold BOTH Volume Up and Volume Down.",
      detail: "Hold them together — neither button alone enters BROM mode.",
    },
    {
      title: "While holding both buttons, plug in the USB cable.",
      detail: "Keep holding for 5–10 seconds. Windows should detect a MediaTek USB Port (VCOM / Preloader).",
    },
    {
      title: "If nothing appears, check the cable and driver.",
      detail: "Use a data cable (not a charge-only one) and install the MediaTek VCOM driver from the Driver Center, then retry.",
    },
  ],
};

const FASTBOOT_RECOVERY_GUIDE: ConnectionGuide = {
  key: "fastboot-recovery",
  title: "Fastboot / Recovery",
  modeChip: "Fastboot / Recovery",
  keyCombo: "Volume Down + Power",
  listeningLabel: "Listening for Fastboot Hardware Interface…",
  waitHint:
    "Waiting for Fastboot / Recovery mode… power the phone off, then hold Volume Down + Power and connect the USB cable.",
  steps: [
    {
      title: "Power the phone completely off.",
      detail: "Long-press Power → Power off. Locking the screen is not enough.",
    },
    {
      title: "Boot into Recovery or Fastboot with the key combo.",
      detail:
        "Most brands: Volume Down + Power = Fastboot/Download, Volume Up + Power = Recovery. Select Recovery when both appear.",
    },
    {
      title: "Confirm with Power and leave the phone in that menu.",
      detail: "Keep the phone in the menu — do not start “Factory reset” from the menu yourself.",
    },
    {
      title: "Connect the USB cable.",
      detail: "If a USB debugging “Allow” prompt appears, tap Allow. The app wipes data through the recovery ADB session.",
    },
  ],
};

const EDL_GUIDE: ConnectionGuide = {
  key: "brom",
  title: "Qualcomm EDL (9008)",
  modeChip: "Qualcomm EDL · 9008",
  keyCombo: "Volume Up + Volume Down (or EDL cable)",
  listeningLabel: "Listening for EDL 9008 Hardware Interface…",
  waitHint:
    "Waiting for the Qualcomm EDL (9008) interface… power the phone off, hold Volume Up + Volume Down, then connect the USB cable and keep holding until the screen stays black.",
  steps: [
    {
      title: "Power the phone completely off.",
      detail: "Long-press Power → Power off. Locking the screen is not enough.",
    },
    {
      title: "Press and hold Volume Up + Volume Down together.",
      detail: "Hold both — neither alone enters EDL mode.",
    },
    {
      title: "Plug in the USB cable while holding both buttons.",
      detail: "Keep holding until the screen stays black — the phone is now in EDL (9008).",
    },
    {
      title: "Watch for the 05C6:9008 port in the console.",
      detail: "Some Snapdragon models need a deep-flash / EDL cable. The console confirms the interface.",
    },
  ],
};

/** Brand + method → the exact key-combo / dial-code guide shown on the method
 *  screen and streamed into the live operation log while the engine waits. */
export function connectionGuideFor(brand: string | null, method: MethodId): ConnectionGuide {
  if (method === "mediatek") return BROM_GUIDE;
  if (brand === "Samsung") return TEST_MODE_GUIDE;
  return FASTBOOT_RECOVERY_GUIDE;
}

/** Chipset/brand/mode → the wizard guide used before an operation starts.
 *  Qualcomm devices get the EDL walkthrough; MediaTek gets BROM. */
export function wizardGuide(
  brand: string | null,
  chipset: string | null,
  mode: ConnectionGuideKey,
): ConnectionGuide {
  if (mode === "brom") {
    return chipset === "Qualcomm" ? EDL_GUIDE : BROM_GUIDE;
  }
  if (mode === "test-mode") return TEST_MODE_GUIDE;
  return FASTBOOT_RECOVERY_GUIDE;
}
