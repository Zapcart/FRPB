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
