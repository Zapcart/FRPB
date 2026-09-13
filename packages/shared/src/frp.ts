// FRPB — FRP bypass shared types + brand/method mapping.
// Models the FRP unlock workflow used by the desktop wizard and the online
// unlock service. Mirrors the "Screen Unlock (Android)" product surface of
// commercial FRP bypass platforms — brand-aware method selection, guided
// step-by-step flow, and online (IMEI-based) unlock path.

export const FRP_BRANDS: readonly string[] = [
  "Samsung",
  "Xiaomi",
  "Redmi",
  "OPPO",
  "realme",
  "vivo",
  "motorola",
  "Lenovo",
  "ZTE",
  "Huawei",
  "OnePlus",
  "Honor",
  "TCL",
  "TECNO",
  "Infinix",
  "itel",
  "SONY",
  "Google",
  "POCO",
  "Nokia",
  "HTC",
  "LG",
];

/** FRP unlock methods offered per brand. Real platforms tune which methods are
 *  available per chipset/brand — this mirrors that design without exposing
 *  proprietary implementation internals. */
export type FrpMethodId =
  | "setup-wizard"   // Android setup wizard-based flow (guide the user through setup screen)
  | "download-mode"  // Device in Download/Bootloader mode — guided flash/patch workflow
  | "edl-mode"       // Qualcomm EDL mode (Snapdragon) — hardware-assisted unlock path
  | "mtk-brom"       // MediaTek BROM/Download mode — firmware patch path
  | "oem-service";   // OEM-specific service procedure (e.g. Samsung Odin-based flow)

export interface FrpMethodMeta {
  id: FrpMethodId;
  label: string;
  desc: string;
  /** Whether this method is offered for the given brand (feature-flag style). */
  available: boolean;
  /** One-line instruction shown to the user before the operation starts. */
  instruction: string;
  /** Android version range this method targets (display only). */
  targetAndroid?: string;
}

/** Per-brand method availability — extensible. Real platforms maintain a large
 *  matrix mapping chipset/brand -> supported methods. */
export const FRP_METHOD_MAP: Record<string, Pick<FrpMethodMeta, "id" | "available">[]> = {
  Samsung: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "edl-mode", available: true }, // Snapdragon Samsung devices
  ],
  Xiaomi: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  Redmi: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  OPPO: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  realme: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  vivo: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  motorola: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "edl-mode", available: true },
  ],
  Lenovo: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  ZTE: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  Huawei: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  OnePlus: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "edl-mode", available: true },
  ],
  Honor: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  TCL: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  TECNO: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  Infinix: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  itel: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  SONY: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  Google: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "edl-mode", available: true },
  ],
  POCO: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
    { id: "mtk-brom", available: true },
  ],
  Nokia: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  HTC: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
  LG: [
    { id: "setup-wizard", available: true },
    { id: "download-mode", available: true },
  ],
};

/** Full method metadata for UI display. */
const METHODS: Record<FrpMethodId, Omit<FrpMethodMeta, "available">> = {
  "setup-wizard": {
    id: "setup-wizard",
    label: "Setup Wizard Method",
    desc: "Guided unlock through the Android setup screen. Works on many Android versions without special cables.",
    instruction: "Follow the on-screen steps after your phone enters setup mode. The tool will guide you.",
    targetAndroid: "Android 8 – Android 16",
  },
  "download-mode": {
    id: "download-mode",
    label: "Download Mode",
    desc: "Use the device Download/Bootloader mode to apply a guided unlock procedure.",
    instruction: "Power off the phone, then enter Download mode using the button combination. The tool will detect the connection.",
    targetAndroid: "Android 6 – Android 16",
  },
  "edl-mode": {
    id: "edl-mode",
    label: "EDL Mode (Snapdragon)",
    desc: "Qualcomm Emergency Download Mode — used for Snapdragon Samsung/Motorola/OnePlus devices.",
    instruction: "Enter EDL mode on your Snapdragon device. An EDL cable may be required for some models.",
    targetAndroid: "Android 10 – Android 16 (Snapdragon)",
  },
  "mtk-brom": {
    id: "mtk-brom",
    label: "MediaTek BROM Mode",
    desc: "MediaTek Download/BROM mode for Xiaomi/Redmi/vivo/realme/TECNO/Infinix/itel devices.",
    instruction: "Enter MediaTek Download mode. The tool will communicate with the device in BROM mode.",
    targetAndroid: "Android 6 – Android 16 (MediaTek)",
  },
  "oem-service": {
    id: "oem-service",
    label: "OEM Service Method",
    desc: "Manufacturer-specific service procedure for supported devices.",
    instruction: "Follow the brand-specific service instructions shown on screen.",
    targetAndroid: "Model-specific",
  },
};

export function frpMethodsForBrand(brand: string | null): FrpMethodMeta[] {
  const entries = brand ? FRP_METHOD_MAP[brand] : undefined;
  if (!entries) {
    // Unknown brand — offer general methods only
    return Object.values(METHODS).map((m) => ({ ...m, available: true }));
  }
  return entries.map((entry) => {
    const meta = METHODS[entry.id];
    return {
      ...meta,
      available: entry.available && Boolean(meta),
      instruction: meta?.instruction ?? "",
      targetAndroid: meta?.targetAndroid,
    };
  }).filter(Boolean) as FrpMethodMeta[];
}

/** Operation result returned by the FRP bypass engine. */
export interface FrpBypassResult {
  success: boolean;
  message: string;
  detail?: string;
  /** If successful, additional info about the bypass. */
  bypassedAccount?: "google" | "mi" | "hikey" | "others";
  /** Steps completed (for audit / display). */
  steps?: string[];
}

/** Request sent by the desktop app to start an FRP bypass operation. */
export interface FrpBypassRequest {
  brand: string;
  model: string;
  androidVersion?: string;
  method: FrpMethodId;
  deviceSerial?: string; // ADB serial if available
  imei?: string;         // for online unlock path
}

/** Status of an ongoing FRP bypass operation. */
export type FrpBypassStatus =
  | "idle"
  | "preparing"
  | "waiting-device"
  | "detecting"
  | "running"
  | "completed"
  | "failed";

export interface FrpBypassState {
  status: FrpBypassStatus;
  currentStep: string;
  progress: number; // 0-100
  message: string;
  result?: FrpBypassResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detection engine (shared contract for `device:auto-detected`)
// ─────────────────────────────────────────────────────────────────────────────

/** Connection transport the device was discovered through. */
export type DeviceConnectionState =
  | "disconnected"
  | "adb"
  | "fastboot"
  | "mtp"
  | "brom"
  | "edl"
  | "com";

/** Chipset family buckets — drive which model/exploit profile is applicable. */
export type ChipsetFamily =
  | "MediaTek"
  | "Qualcomm"
  | "Samsung Exynos"
  | "Unknown";

/** The only two user-facing operations in the simplified 2-click workflow. */
export type PrimaryAction = "flash-reset" | "frp-bypass";

/** Payload pushed on the `device:auto-detected` channel whenever the background
 *  USB/ADB poller observes a device plug in or change state. Drives the header
 *  status badge and automatically sets the brand context in the renderer. */
export interface DeviceAutoDetected {
  /** True when a usable Android device is currently attached. */
  detected: boolean;
  brand: string | null;
  model: string | null;
  serial: string | null;
  /** COM / tty port label when a serial interface is present. */
  port: string | null;
  chipset: ChipsetFamily;
  connection: DeviceConnectionState;
  vid: number | null;
  pid: number | null;
  driverInstalled: boolean;
  /** True when this model strictly needs a hardware key combination first. */
  requiresManualMode: boolean;
  lastScanAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Searchable model catalog (brand + chipset aware)
// ─────────────────────────────────────────────────────────────────────────────

/** A single searchable model entry enriched with brand + chipset metadata. */
export interface ModelCatalogEntry {
  model: string;
  brand: string;
  chipset: ChipsetFamily;
  /** True when the device must first be put into a special mode via key combo. */
  manualMode: boolean;
  /** Human-readable key combination for the manual-mode popup. */
  keyCombo?: string;
}

/** Filter a model catalog by detected brand and/or chipset family. */
export function filterModelCatalog(
  catalog: readonly ModelCatalogEntry[],
  opts: { brand?: string | null; chipset?: ChipsetFamily | null; query?: string | null } = {},
): ModelCatalogEntry[] {
  const brand = opts.brand?.trim().toLowerCase();
  const query = opts.query?.trim().toLowerCase();
  return catalog.filter((entry) => {
    if (
      brand &&
      !entry.brand.toLowerCase().includes(brand) &&
      !entry.model.toLowerCase().includes(brand)
    ) {
      return false;
    }
    if (opts.chipset && opts.chipset !== "Unknown" && entry.chipset !== opts.chipset) {
      return false;
    }
    if (query && !entry.model.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual progress (Overall + Current Task) + streamed stages
// ─────────────────────────────────────────────────────────────────────────────

/** Dual-progress model: an overall bar (whole operation) and a current-task bar
 *  (the active step). Both are 0-100 and reach 100 when the operation completes. */
export interface DualProgress {
  overall: number;
  current: number;
}

/** A bracketed stage streamed to the progress console while an operation runs,
 *  e.g. [Device Connected] -> [Chipset Matched] -> [Exploit Sent] -> [100% DONE]. */
export interface OperationStage {
  /** Stable machine key, e.g. "CONNECT" | "CHIPSET" | "EXPLOIT" | "DONE". */
  id: string;
  /** Bracketed display label, e.g. "[Device Connected]". */
  label: string;
  detail: string;
  /** Progress contribution for this stage (0-100). */
  progress: number;
  done: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual key-combination fallback guidance
// ─────────────────────────────────────────────────────────────────────────────

/** Step-by-step manual-mode guidance shown in the popup before a reset that
 *  strictly requires a hardware key combination (e.g. BROM / EDL entry). */
export interface ManualModeGuide {
  brand: string;
  model: string;
  chipset: ChipsetFamily;
  /** Exact button combination, e.g. "Volume Down + Power". */
  keyCombo: string;
  steps: string[];
  note?: string;
}

/** Key-combination table used by the manual-mode fallback popup. */
const MANUAL_KEY_COMBOS: Record<ChipsetFamily, { keyCombo: string; steps: string[]; note?: string }> = {
  MediaTek: {
    keyCombo: "Volume Down + Power (or Volume Up + Power)",
    steps: [
      "Power the device completely off.",
      "Hold Volume Down + Power together for ~10 seconds.",
      "If that fails, hold Volume Up + Power instead.",
      "Connect the USB cable while holding the buttons.",
      "Release the buttons once the tool reports [Chipset Matched].",
    ],
    note: "Some MediaTek models require the battery/back cover to be disconnected first.",
  },
  Qualcomm: {
    keyCombo: "Volume Up + Volume Down + Power",
    steps: [
      "Power the device completely off.",
      "Press and hold Volume Up + Volume Down + Power together.",
      "Connect the USB cable while holding the buttons.",
      "Hold until the screen stays black (EDL mode) — do not release early.",
      "Wait for the tool to report [Device Connected] in EDL mode.",
    ],
    note: "An EDL cable or deep-flash adapter may be required for some Snapdragon models.",
  },
  "Samsung Exynos": {
    keyCombo: "Volume Down + Power",
    steps: [
      "Power the device completely off.",
      "Hold Volume Down + Power to enter Download mode.",
      "Press Volume Up to confirm when the warning screen appears.",
      "Connect the USB cable once Download mode is shown.",
    ],
  },
  Unknown: {
    keyCombo: "Volume Down + Power",
    steps: [
      "Power the device completely off.",
      "Hold Volume Down + Power for ~10 seconds.",
      "Connect the USB cable while holding the buttons.",
    ],
  },
};

/** Build the manual key-combination guide for a detected device. */
export function manualModeGuideFor(
  brand: string | null,
  model: string | null,
  chipset: ChipsetFamily,
): ManualModeGuide {
  const combo = MANUAL_KEY_COMBOS[chipset] ?? MANUAL_KEY_COMBOS.Unknown;
  return {
    brand: brand ?? "Unknown",
    model: model ?? "Unknown model",
    chipset,
    keyCombo: combo.keyCombo,
    steps: combo.steps,
    note: combo.note,
  };
}
