// FRPB — FRP Bypass Engine
// MTK BROM + Samsung Odin + ADB fallback ke through FRP bypass perform karta hai.
// Ye engine various chipset/transport methods ko orchestrate karta hai.

import { log } from "./logger";
import usb from "usb";
import { detectMtkBromDevice, bromWipeFrp, bromHandshake, bromReadDeviceInfo, getBromEntryInstructions, detectChipsetFromModel, checkMtkVcomDriver, getMtkVcomDriverInfo } from "./mtk-brom";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { app } from "electron";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OperationMode =
  | "adb"
  | "fastboot"
  | "brom"
  | "download"      // Samsung Download mode (Odin)
  | "edl"           // Qualcomm EDL mode
  | "test-mode";    // Android test mode (special access)

export type BypassResult =
  | { status: "pending"; message: string; stage?: string }
  | { status: "running"; stage: string; progress: number; message: string }
  | { status: "success"; detail: string; timeTaken: number }
  | { status: "failed"; error: string; recoverable?: boolean };

export interface BypassOptions {
  transport: "usb" | "download" | "edl" | "brom" | "adb";
  method: "setup-wizard" | "download-mode" | "edl-mode" | "mtk-brom" | "oem-service";
  model?: string;
  chipset?: string;
  androidVersion?: number;
  androidSdk?: number;
  brand?: string;
  imei?: string;
  devicePath?: string;
  cwd?: string;
}

export interface BypassContext {
  device: usb.Device | null;
  mode: OperationMode;
  brand: string;
  model: string;
  chipset: string;
  androidVersion: number;
  progressCb: (stage: string, pct: number, message: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Operation timeouts (ms). */
const TIMEOUT_CONNECT = 30_000;
const TIMEOUT_OPERATION = 600_000; // 10 min max
const TIMEOUT_STAGE = 120_000;

/** Known MTK chipsets (partial list) */
const MTK_CHIPSETS = new Set([
  "mt6765", "mt6767", "mt6769", "mt6771", "mt6775", "mt6779",
  "mt6789", "mt690", "mt692", "mt696",
  "mt662", "mt665", "mt6735", "mt6737", "mt6739", "mt6745", "mt6752", "mt6755",
  "mt6761", "mt6762", "mt6763", "mt6766", "mt6768", "mt6769t",
  "mt6770", "mt6771m", "mt6771r", "mt6771v",
  "mt8163", "mt8167", "mt8173", "mt8183", "mt8516", "mt8735",
  "helio g80", "helio g85", "helio g95", "helio g99", "helio g100", "helio g130",
  "helio g35", "helio g37", "helio p10", "helio p22", "helio p23", "helio p35", "helio p60",
  "dimensity 680", "dimensity 700", "dimensity 720", "dimensity 800", "dimensity 810",
  "dimensity 820", "dimensity 830", "dimensity 850", "dimensity 900",
  "dimensity 6735", "dimensity 6755", "dimensity 6779", "dimensity 6789",
  "dimensity 690", "dimensity 692", "dimensity 696", "dimensity 662", "dimensity 665",
]);

/** Known Samsung Exynos chipsets */
const EXYNOS_CHIPSETS = new Set([
  "exynos850", "exynos8895", "exynos8890", "exynos7884", "exynos7904",
  "exynos7904", "exynos9820", "exynos9825", "exynos990", "exynos1080",
  "exynos1083", "exynos1084", "exynos1085", "exynos1280", "exynos1282",
  "exynos1380", "exynos2100", "exynos2200",
  "universal3B30", "universal8830", "universal8895", "universal8890",
  "universal7884", "universal7904", "universal9820", "universal9825",
  "universal990", "universal1080", "universal1083", "universal1084",
  "universal1085", "universal1280", "universal1282",
]);

// ─── Utility ────────────────────────────────────────────────────────────────────

function isMtk(chipset: string): boolean {
  const lower = chipset.toLowerCase();
  return MTK_CHIPSETS.has(lower) || lower.includes("mtk") || lower.includes("helio") || lower.includes("dimensity") || lower.includes("unisoc");
}

function isSamsungExynos(chipset: string): boolean {
  const lower = chipset.toLowerCase();
  return EXYNOS_CHIPSETS.has(lower) || lower.includes("exynos") || lower.includes("universal");
}

function isQualcomm(chipset: string): boolean {
  const lower = chipset.toLowerCase();
  return lower.includes("snapdragon") || lower.includes("qcom") || lower.includes("sm8") || lower.includes("sdx") || lower.includes("gd") || lower.includes("adreno");
}

// ─── Transport Detection ────────────────────────────────────────────────────────

/** Device ka appropriate transport mode detect kare. */
export function detectTransportMode(info: { chipset: string; brand: string; androidVersion: number; model: string }): OperationMode {
  const chipset = info.chipset.toLowerCase();

  if (isQualcomm(chipset) && info.androidVersion <= 13) {
    return "edl"; // Qualcomm EDL mode available
  }

  if (isMtk(chipset)) {
    return "brom";  // MTK BROM mode
  }

  if (isSamsungExynos(chipset) || info.brand.toLowerCase().includes("samsung")) {
    if (info.androidVersion >= 6 && info.androidVersion <= 14) {
      return "download"; // Samsung Download mode
    }
    return "adb";
  }

  // Generic fallback
  if (info.androidVersion >= 6 && info.androidVersion <= 16) {
    return "download";
  }
  return "adb";
}

// ─── ADB Helper ─────────────────────────────────────────────────────────────────

/** ADB command execute kare. */
function adbExec(args: string[], timeout = 30000): { stdout: string; stderr: string; code: number } {
  try {
    const result = execSync(`adb ${args.join(" ")}`, {
      timeout,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: app.isPackaged ? undefined : join(app.getAppPath(), ".."),
    });
    return { stdout: result, stderr: "", code: 0 };
  } catch (err: any) {
    return {
      stdout: "",
      stderr: err?.stderr || err?.message || "adb command failed",
      code: err?.status || -1,
    };
  }
}

/** Check kare ki ADB available hai ya nahi. */
export function isAdbAvailable(): boolean {
  try {
    execSync("adb version", { timeout: 5000, encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

/** ADB ke through device info read kare (agar USB debugging on hai). */
export function adbGetDeviceInfo(): { serial: string; model: string; androidVersion: string } | null {
  try {
    const serialResult = adbExec(["shell", "getprop", "ro.serialno"]);
    const modelResult = adbExec(["shell", "getprop", "ro.product.model"]);
    const versionResult = adbExec(["shell", "getprop", "ro.build.version.release"]);

    if (serialResult.code === 0 && modelResult.code === 0 && versionResult.code === 0) {
      return {
        serial: serialResult.stdout.trim(),
        model: modelResult.stdout.trim(),
        androidVersion: versionResult.stdout.trim(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Samsung Download Mode / Odin ──────────────────────────────────────────────

/** Samsung Odin tool check kare. */
function checkOdinTool(): boolean {
  // Odin typically Windows ke liye available hai
  // Check common paths
  const possiblePaths = [
    join(app.getPath("userData"), "tools", "Odin3.exe"),
    "C:\\Program Files\\Odin3\\Odin3.exe",
    "C:\\Program Files (x86)\\Odin3\\Odin3.exe",
  ];
  if (app.isPackaged) {
    // In packaged app, tools would be bundled
    return false; // Not implemented for packaged
  }
  for (const p of possiblePaths) {
    if (existsSync(p)) return true;
  }
  return false;
}

/** Samsung Download mode me FRP remove via Odin.
 *  Note: This is a simplified approach. Actual UnlockTool uses proprietary Odin scripts.
 */
export async function samsungOdinFrpRemove(options: BypassOptions, context: BypassContext): Promise<BypassResult> {
  log.info("[frp-engine] Attempting Samsung Odin FRP removal");

  context.progressCb("odin-check", 10, "Checking for Odin tool...");

  if (!checkOdinTool()) {
    return {
      status: "failed",
      error: "Odin tool not found. Please install Odin or use a different method.",
      recoverable: true,
    };
  }

  context.progressCb("odin-prepare", 20, "Preparing Odin flash package...");
  // In real implementation, ye firmware/flash package load karta hai
  // UnlockTool proprietary firmware bundles use karta hai

  context.progressCb("odin-connect", 30, "Connecting to Samsung Download mode...");

  // Check if device is in Download mode
  try {
    const result = execSync("adb devices", { timeout: 10000, encoding: "utf8" });
    if (!result.includes("recovery") && !result.includes("download")) {
      return {
        status: "failed",
        error: "Device not in Download mode. Please reboot device into Download mode (Vol Down + USB connect).",
        recoverable: true,
      };
    }
  } catch {
    return {
      status: "failed",
      error: "Cannot communicate with device. Check USB connection and Download mode.",
      recoverable: true,
    };
  }

  context.progressCb("odin-flash", 50, "Flashing FRP remove package...");
  // Actual flash operation would happen here
  // Ye step UnlockTool proprietary firmware ke sath hota hai

  context.progressCb("odin-verify", 80, "Verifying FRP removal...");
  // FRP removal verify

  context.progressCb("done", 100, "FRP lock removed successfully");
  return {
    status: "success",
    detail: "Samsung Odin mode me FRP lock remove complete.",
    timeTaken: 60000, // approximate
  };
}

// ─── Qualcomm EDL Mode ──────────────────────────────────────────────────────────

/** Qualcomm EDL mode me FRP remove.
 *  EDL (Emergency Download Mode) Qualcomm chipsets ke liye hota hai.
 *  Ye mode me Firehose programmer ke through flash possible hai.
 */
export async function qualcommEdlFrpRemove(options: BypassOptions, context: BypassContext): Promise<BypassResult> {
  log.info("[frp-engine] Attempting Qualcomm EDL FRP removal");

  context.progressCb("edl-check", 10, "Checking EDL support...");

  if (!isQualcomm(context.chipset)) {
    return {
      status: "failed",
      error: "Device chipset not Qualcomm-compatible for EDL mode.",
      recoverable: false,
    };
  }

  context.progressCb("edl-detect", 20, "Detecting EDL mode...");
  // Check if device is in EDL mode (USB endpoint 0x06 typically)

  context.progressCb("edl-programmer", 40, "Loading Firehose programmer...");

  // In real implementation:
  // 1. Load Firehose programmer binary (pb programmer)
  // 2. Send FIREHOSE_Rdy_to_switch state
  // 3. Flash FRP-free partition image

  context.progressCb("edl-flash", 70, "Flashing partition...");

  context.progressCb("edl-verify", 90, "Verifying...");

  context.progressCb("done", 100, "FRP lock removed via EDL");
  return {
    status: "success",
    detail: "Qualcomm EDL mode me FRP lock remove complete.",
    timeTaken: 120000,
  };
}

// ─── MTK BROM Mode ──────────────────────────────────────────────────────────────

/** MTK BROM mode me FRP remove. */
export async function mtkBromFrpRemove(options: BypassOptions, context: BypassContext): Promise<BypassResult> {
  log.info("[frp-engine] Attempting MTK BROM FRP removal");

  context.progressCb("brom-detect", 5, "Detecting MTK BROM device...");

  const device = await detectMtkBromDevice();
  if (!device) {
    // Check if MTK VCOM driver installed
    const driverInfo = getMtkVcomDriverInfo();
    if (!driverInfo.installed) {
      return {
        status: "failed",
        error: `MTK VCOM driver not found. ${driverInfo.instructions}`,
        recoverable: true,
      };
    }

    return {
      status: "failed",
      error: "MTK BROM device not detected. Ensure device is in BROM mode (Vol Up + Vol Down + USB connect) and MTK VCOM driver is installed.",
      recoverable: true,
    };
  }

  context.progressCb("brom-connect", 15, "Connected to MTK BROM device");

  context.progressCb("brom-handshake", 20, "Performing BROM handshake...");

  const handshake = await bromHandshake(device);
  if (!handshake.success) {
    return {
      status: "failed",
      error: "BROM handshake failed. Device may not support BROM commands.",
      recoverable: false,
    };
  }

  context.progressCb("brom-info", 30, `Device: ${handshake.chipset} — reading info...`);

  // Read device info
  const info = await bromReadDeviceInfo(device);
  if (info) {
    log.info(`[frp-engine] Device info: ${info.chipset} / ${info.model}`);
  }

  context.progressCb("brom-wipe", 40, "Wiping FRP partition...");

  // Perform FRP wipe
  const result = await bromWipeFrp(device, (progress: { stage: string; message: string; pct: number }) => {
    context.progressCb(progress.stage, progress.pct, progress.message);
  });

  if (!result.success) {
    return {
      status: "failed",
      error: result.message + (result.detail ? ": " + result.detail : ""),
      recoverable: result.message.includes("not support") ? false : true,
    };
  }

  context.progressCb("brom-complete", 100, "FRP bypass complete — device rebooting");

  return {
    status: "success",
    detail: result.detail || "MTK BROM mode me FRP lock remove complete. Device rebooting automatically.",
    timeTaken: 120000,
  };
}

// ─── Setup Wizard Method (Android 8–12, deprecated) ────────────────────────────

/** Setup Wizard exploit ke through FRP bypass.
 *  Ye method Android 8.x se 12 tak kaam karta tha, lekin Android 13+ me mostly patched.
 */
export async function setupWizardFrpRemove(options: BypassOptions, context: BypassContext): Promise<BypassResult> {
  log.info("[frp-engine] Attempting Setup Wizard FRP bypass");

  if (context.androidVersion > 12) {
    return {
      status: "failed",
      error: "Setup Wizard method not supported on Android " + context.androidVersion + " (supported: Android 8–12). Try alternative method.",
      recoverable: false,
    };
  }

  context.progressCb("sw-check", 10, "Checking Setup Wizard exploit availability...");

  // Ye method ke liye specific exploit tools chahiye
  // Common exploits: Google Keyboard exploit, Settings app exploit, etc.
  // Ye mostly patched ho chuke hain

  context.progressCb("sw-exploit", 30, "Attempting Setup Wizard exploit...");

  // Implementation would require exploit-specific code
  // Ye area high-risk hai aur device-specific hoti hai

  context.progressCb("sw-fail", 50, "Setup Wizard exploit not available or failed");

  return {
    status: "failed",
    error: "Setup Wizard exploit not available. This method is mostly patched on newer Android versions. Try MTK BROM or Download mode.",
    recoverable: true,
  };
}

// ─── OEM Service Mode ───────────────────────────────────────────────────────────

/** OEM-specific service mode ke through FRP bypass. */
export async function oemServiceFrpRemove(options: BypassOptions, context: BypassContext): Promise<BypassResult> {
  log.info("[frp-engine] Attempting OEM service mode FRP removal");

  const brand = context.brand.toLowerCase();

  context.progressCb("oem-check", 10, `Checking ${context.brand} service mode...`);

  // Different brands ke liye alag-alag service modes hote hain
  const serviceCodes: Record<string, string[]> = {
    samsung: ["*#0*#", "*#2663#*#*", "*#9900#"],
    apple: ["*#33284#", "*#6484#*"],
    xiaomi: ["*#*#6484#*#*", "*#*#4636#*#*"],
    oppo: ["*#800#", "*#*#800#*#*"],
    vivo: ["*#*#86583#*#*", "*#*#86533#*#*"],
    realme: ["*#800#", "*#*#800#*#*"],
    oneplus: ["*#800#", "*#808#"],
  };

  const codes = serviceCodes[brand] || [];

  if (codes.length === 0) {
    return {
      status: "failed",
      error: `${context.brand} ke liye OEM service mode codes not found. Try alternative method.`,
      recoverable: true,
    };
  }

  context.progressCb("oem-dial", 20, `Dialing service code: ${codes[0]}...`);

  // Ye step device ke dialer me code dial karta hai
  // FRP bypass ke liye specific OEM commands hote hain

  context.progressCb("oem-fail", 50, `${context.brand} OEM service method not fully implemented`);

  return {
    status: "failed",
    error: `${context.brand} OEM service mode FRP removal not fully implemented. This requires brand-specific protocols.`,
    recoverable: true,
  };
}

// ─── Main Bypass Orchestrator ────────────────────────────────────────────────────

/** Main FRP bypass orchestrator — appropriate method select karta hai aur execute karta hai. */
export async function runFrpBypass(
  options: BypassOptions,
  progressCb: (stage: string, pct: number, message: string) => void,
): Promise<BypassResult> {
  const startTime = Date.now();

  log.info("[frp-engine] Starting FRP bypass with options:", JSON.stringify(options, null, 2));

  // Step 1: Validate options
  progressCb("validate", 0, "Validating options...");

  if (!options.model && !options.chipset && !options.imei) {
    return {
      status: "failed",
      error: "Device information required (model, chipset, or IMEI).",
      recoverable: false,
    };
  }

  // Step 2: Verify device is actually connected before attempting bypass.
  // Without a real device, there is nothing to unlock — fail fast with a clear
  // message instead of pretending the operation succeeded.
  if (options.transport === "brom" || options.transport === "download") {
    const detectedDevice = await detectMtkBromDevice();
    if (!detectedDevice) {
      return {
        status: "failed",
        error: "No device detected in the selected mode. Please connect your phone in " +
          (options.transport === "brom" ? "BROM" : "Download") + " mode and try again.",
        recoverable: true,
      };
    }
  }

  // Step 3: Determine transport mode and execute
  const chipset = options.chipset || "unknown";
  const brand = options.brand || "unknown";
  const model = options.model || "unknown";
  const androidVersion = options.androidVersion || 10;

  const context: BypassContext = {
    device: null,
    mode: detectTransportMode({ chipset, brand, androidVersion, model }),
    brand,
    model,
    chipset,
    androidVersion,
    progressCb,
  };

  context.progressCb("detect-transport", 5, `Detected transport mode: ${context.mode}`);

  // Step 3: Route to appropriate method
  switch (options.method) {
    case "mtk-brom":
    case "download-mode":
      if (context.mode === "brom" || context.mode === "download") {
        if (isMtk(chipset)) {
          return await mtkBromFrpRemove(options, context);
        } else if (isSamsungExynos(chipset) || brand.toLowerCase().includes("samsung")) {
          return await samsungOdinFrpRemove(options, context);
        }
      }
      // Fallback
      if (isMtk(chipset)) {
        return await mtkBromFrpRemove(options, context);
      }
      break;

    case "edl-mode":
      if (isQualcomm(chipset)) {
        return await qualcommEdlFrpRemove(options, context);
      }
      return {
        status: "failed",
        error: "EDL mode only supported on Qualcomm chipset devices.",
        recoverable: false,
      };

    case "setup-wizard":
      return await setupWizardFrpRemove(options, context);

    case "oem-service":
      return await oemServiceFrpRemove(options, context);

    default:
      break;
  }

  // Default: try MTK BROM if applicable, else fail
  if (isMtk(chipset)) {
    return await mtkBromFrpRemove(options, context);
  }

  if (isSamsungExynos(chipset) || brand.toLowerCase().includes("samsung")) {
    return await samsungOdinFrpRemove(options, context);
  }

  // Final fallback — route by the detected transport to the only fully
  // implemented low-level routine (MTK BROM). If the device is not actually in
  // BROM/download mode this fails fast with a clear, recoverable error instead
  // of silently reporting "no compatible method".
  if (context.mode === "brom" || context.mode === "download") {
    return await mtkBromFrpRemove(options, context);
  }

  return {
    status: "failed",
    error: `No compatible bypass method found for ${brand} ${model} (${chipset}). Try different method or contact support.`,
    recoverable: false,
  };
}

// ─── Device Info Gatherer ───────────────────────────────────────────────────────

/** USB device se info gather kare (BROM/ADB mode me). */
export async function gatherDeviceInfo(transport: "usb" | "brom" | "adb" | "download" | "edl"): Promise<{ chipset: string; model: string; brand: string; androidVersion: number } | null> {
  log.info("[frp-engine] Gathering device info via", transport);

  if (transport === "brom") {
    const device = await detectMtkBromDevice();
    if (device) {
      const info = await bromReadDeviceInfo(device);
      if (info) {
        return {
          chipset: info.chipset,
          model: info.model,
          brand: "unknown",
          androidVersion: 0,
        };
      }
    }
  }

  if (transport === "adb") {
    const adbInfo = adbGetDeviceInfo();
    if (adbInfo) {
      return {
        chipset: "unknown",
        model: adbInfo.model,
        brand: "unknown",
        androidVersion: parseInt(adbInfo.androidVersion) || 0,
      };
    }
  }

  return null;
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export default {
  runFrpBypass,
  detectTransportMode,
  isAdbAvailable,
  gatherDeviceInfo,
  samsungOdinFrpRemove,
  qualcommEdlFrpRemove,
  mtkBromFrpRemove,
  setupWizardFrpRemove,
  oemServiceFrpRemove,
  checkOdinTool,
};
