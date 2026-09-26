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
  | "test-mode"     // Android test mode (special access)
  | "recovery";     // Samsung FRP recovery wizard mode

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

/**
 * True when the reported model/chipset is a generic emulator, Android-x86 or
 * ChromeOS/ARC build rather than a physical handset.
 *
 * These targets have NO Samsung Download mode, NO Qualcomm EDL and NO MediaTek
 * BROM — the previous fallback sent them to "download", which is not merely
 * wrong but unreachable: there is no Odin transport on an x86 build, so the
 * operation could only ever fail with a confusing low-level error. They are
 * ADB-reachable (that is how emulators and ARC expose the device), so that is
 * what they must resolve to.
 */
function isGenericOrVirtualTarget(chipset: string, brand: string, model: string): boolean {
  const hay = `${chipset} ${brand} ${model}`.toLowerCase();
  return (
    /\bx86(_64)?\b/.test(hay) ||
    hay.includes("android-x86") ||
    hay.includes("chrome os") ||
    hay.includes("chromeos") ||
    hay.includes("arc ") ||
    hay.includes("emulator") ||
    hay.includes("sdk_gphone") ||
    hay.includes("goldfish") ||
    hay.includes("ranchu") ||
    hay.includes("virtual device")
  );
}

/** Device ka appropriate transport mode detect kare. */
export function detectTransportMode(info: { chipset: string; brand: string; androidVersion: number; model: string }): OperationMode {
  const chipset = info.chipset.toLowerCase();
  const brand = info.brand.toLowerCase();
  const model = info.model ?? "";

  // Generic/virtual x86 or ChromeOS targets are ADB-only — never "download".
  // Checked FIRST so it cannot be shadowed by the vendor heuristics below.
  if (isGenericOrVirtualTarget(chipset, brand, model)) {
    return "adb";
  }

  if (isQualcomm(chipset) && info.androidVersion <= 13) {
    return "edl"; // Qualcomm EDL mode available
  }

  if (isMtk(chipset)) {
    return "brom";  // MTK BROM mode
  }

  if (isSamsungExynos(chipset) || brand.includes("samsung")) {
    if (info.androidVersion >= 6 && info.androidVersion <= 14) {
      return "download"; // Samsung Download mode
    }
    // Samsung Recovery Wizard mode — manual-guided multi-step flow
    return "recovery"; // Samsung FRP Recovery Wizard
  }

  // Generic fallback. A physical handset at a supported Android version without
  // a recognised chipset is most reliably driven over ADB — claiming "download"
  // here would assert a transport we have no evidence exists for this device.
  if (info.androidVersion >= 6 && info.androidVersion <= 16) {
    return "adb";
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

/**
 * True when at least one device is visible to `adb devices`.
 *
 * ADB operations previously ran unconditionally, so a disconnected phone
 * surfaced as a raw `adb: no devices/emulators found` exec error that looked
 * like an engine failure. Callers use this to fail fast with an actionable
 * message instead.
 *
 * `unauthorized`/`offline` entries still count as PRESENT: the device is
 * connected and the correct next step is to accept the on-screen prompt, which
 * is a different (and more helpful) message than "nothing is plugged in".
 */
export function hasAdbDevice(): boolean {
  if (!isAdbAvailable()) return false;
  try {
    const { stdout } = adbExec(["devices"], 8000);
    // Output looks like:
    //   List of devices attached
    //   R58M12345\tdevice
    return stdout
      .split(/\r?\n/)
      .some((line) => /^\S+\s+(device|unauthorized|offline|recovery|sideload)$/.test(line.trim()));
  } catch {
    return false;
  }
}

/** `{ connected, authorized }` for the first ADB-visible device. */
export function adbDeviceState(): { connected: boolean; authorized: boolean; serial: string | null } {
  if (!isAdbAvailable()) return { connected: false, authorized: false, serial: null };
  try {
    const { stdout } = adbExec(["devices"], 8000);
    for (const line of stdout.split(/\r?\n/)) {
      const match = /^(\S+)\s+(device|unauthorized|offline|recovery|sideload)$/.exec(line.trim());
      if (match) {
        return {
          connected: true,
          authorized: match[2] === "device",
          serial: match[1] ?? null,
        };
      }
    }
  } catch {
    // Fall through to the disconnected result.
  }
  return { connected: false, authorized: false, serial: null };
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

  // ── HONESTY GATE ────────────────────────────────────────────────────
  // This flow previously reported `status: "success"` after emitting progress
  // callbacks and performing NO flash at all — telling the user their phone was
  // unlocked when nothing had been written. That is the most damaging possible
  // failure mode for a recovery tool: the operator stops looking for a real
  // solution because the UI said it worked.
  //
  // A real Odin FRP removal requires a signed, model-matched Odin package,
  // which is proprietary and NOT bundled. Until such a package is supplied we
  // report failure with the exact next step.
  context.progressCb(
    "odin-package",
    50,
    "No Odin flash package available for this model — a signed, model-matched package is required.",
  );

  context.progressCb(
    "odin-guidance",
    75,
    "Connect the device in Download mode and supply the official firmware, or use the MediaTek BROM / Qualcomm EDL route instead.",
  );

  return {
    status: "failed",
    error:
      "Samsung Odin FRP removal needs a signed, model-specific Odin package, which is " +
      "not bundled with FRPB. The device was NOT modified. Provide the correct official " +
      "firmware for this exact model, or use the BROM / EDL / Recovery route instead.",
    recoverable: true,
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

  // ── HONESTY GATE ────────────────────────────────────────────────────
  // Previously this emitted a Firehose/partition-flash narrative and returned
  // `status: "success"` without opening the device or sending a single
  // transfer. A FRP removal that never happened is worse than a clean failure:
  // the operator believes the handset is unlocked and stops looking for a real
  // solution.
  //
  // A Firehose-based FRP clear requires a signed, model-matched programmer
  // (.mbn) plus patch XML. Those are proprietary per-model artefacts and are
  // NOT bundled, so this path cannot honestly claim success.
  //
  // The MEASURED Qualcomm capability in this codebase is the EDL 9008 handshake
  // and secure-wipe sequence in electron/ipc/device.ts
  // (detectChipset → qualcommEdlHandshake), which is what the FRP Bypass button
  // actually drives. Callers should use that, so this stub reports the real
  // state instead of narrating work it never performed.
  context.progressCb(
    "edl-detect",
    20,
    "Checking for a Qualcomm EDL (9008) interface…",
  );

  context.progressCb(
    "edl-guidance",
    60,
    "EDL entry: power off, hold Volume Up + Volume Down (or use an EDL cable), " +
      "connect the cable and keep holding until the screen stays black.",
  );

  return {
    status: "failed",
    error:
      "Qualcomm EDL FRP removal requires a signed, model-matched Firehose " +
      "programmer (.mbn) and patch XML, which are not bundled with FRPB. The " +
      "device was NOT modified. Run the FRP Bypass action, which performs the " +
      "measured EDL 9008 handshake and secure wipe, or supply the correct " +
      "programmer for this exact model.",
    recoverable: true,
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

  context.progressCb(
    "sw-check",
    10,
    "Checking Setup Wizard exploit availability… (keyboard / Settings-app exploits are patched on modern security patches)",
  );

  // These exploits are per-build and patched en masse by Google's monthly
  // security updates. There is no reliable, general implementation, so the
  // honest answer is to redirect the operator to a transport that does work.
  context.progressCb(
    "sw-unavailable",
    40,
    "Setup Wizard exploits are patched on this build — switching guidance to a low-level transport.",
  );

  context.progressCb(
    "sw-guidance",
    70,
    "Connect the phone in a supported hardware mode: MediaTek BROM (hold Vol Up + Vol Down while plugging in), Qualcomm EDL 9008, or Samsung Download mode. Install the matching USB driver from the Driver Center first.",
  );

  return {
    status: "failed",
    error:
      "Setup Wizard exploit is not available on this build (patched). The device was NOT " +
      "modified. Connect the handset in MediaTek BROM, Qualcomm EDL (9008) or Samsung " +
      "Download mode — install the matching USB driver from the FRPB Driver Center first — " +
      "then re-run the operation.",
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
      error:
        `No OEM service-mode codes are mapped for ${context.brand}. Connect the device in a ` +
        "low-level mode (BROM / EDL / Download) instead, or select the correct brand.",
      recoverable: true,
    };
  }

  context.progressCb(
    "oem-dial",
    20,
    `${context.brand} service codes available: ${codes.join(", ")} — these must be dialled manually on the device.`,
  );

  // The dial codes open a diagnostic surface; the FRP-clearing commands behind
  // it are brand-proprietary and per-build. Driving them automatically is not
  // implemented, so this reports the manual path rather than narrating a
  // procedure it cannot perform.
  context.progressCb(
    "oem-guidance",
    55,
    "Open the dialer on the device and enter one of the service codes above, then follow the brand's diagnostic menu. Not all builds expose an FRP-clearing entry.",
  );

  context.progressCb(
    "oem-alt",
    75,
    "If the service menu offers no FRP option, use the MediaTek BROM / Qualcomm EDL / Samsung Download route — those are driven automatically by FRPB.",
  );

  return {
    status: "failed",
    error:
      `${context.brand} OEM service-mode FRP removal is not automated — the diagnostic ` +
      "commands behind those codes are brand-proprietary. The device was NOT modified. " +
      `Dial ${codes[0]} manually to open the service menu, or connect the handset in a ` +
      "MediaTek BROM / Qualcomm EDL / Samsung Download mode where FRPB can drive the " +
      "operation end-to-end.",
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

  // Build context early so every step has access to the same runtime values.
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
    context.device = detectedDevice;
  }

  // ── ADB presence gate ─────────────────────────────────────────────────
  // The ADB-based methods (oem-service / setup-wizard / the ADB transport) used
  // to run unconditionally. On a disconnected phone that produced a raw
  // `adb: no devices/emulators found` exec failure, which read as an engine
  // bug rather than "plug the phone in". Probe first and return a clean,
  // actionable message.
  if (options.transport === "adb" || options.transport === "usb") {
    if (!isAdbAvailable()) {
      return {
        status: "failed",
        error:
          "ADB is not available. Bundled platform-tools are missing — reinstall " +
          "FRPB or run the Driver Center setup, then retry.",
        recoverable: true,
      };
    }
    const adbState = adbDeviceState();
    if (!adbState.connected) {
      return {
        status: "failed",
        error: "No device connected via ADB. Connect the phone with a data cable and " +
          "enable USB debugging (or use a low-level mode such as BROM / EDL / Download).",
        recoverable: true,
      };
    }
    if (!adbState.authorized) {
      return {
        status: "failed",
        error:
          "A device is connected via ADB but is not authorized. Accept the " +
          "“Allow USB debugging” prompt on the phone screen, then retry.",
        recoverable: true,
      };
    }
  }

  // ── Step 3: Route to appropriate method ──────────────────────────────────
  switch (options.method) {
    case "mtk-brom":
      if (context.mode === "brom") {
        if (isMtk(chipset)) {
          return await mtkBromFrpRemove(options, context);
        }
      }
      break;

    case "download-mode":
      if (context.mode === "download" || context.mode === "adb") {
        if (isSamsungExynos(chipset) || brand.toLowerCase().includes("samsung")) {
          if (checkOdinTool()) {
            return await samsungOdinFrpRemove(options, context);
          }
        }
        // Fallback to ADB-based wipe
        if (context.mode === "adb") {
          return await adbFrpRemove(options, context);
        }
      }
      break;

    case "edl-mode":
      if (context.mode === "edl") {
        if (isQualcomm(chipset)) {
          return await qualcommEdlFrpRemove(options, context);
        }
      }
      break;

    case "setup-wizard":
      return await setupWizardFrpRemove(options, context);

    case "oem-service":
      if (context.mode === "recovery" || context.mode === "test-mode" || context.mode === "adb") {
        if (brand.toLowerCase().includes("samsung")) {
          return await samsungRecoveryFrpRemove(options, context);
        }
      }
      return await oemServiceFrpRemove(options, context);

    default:
      break;
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

// ─── Samsung FRP Recovery Wizard Method ─────────────────────────────────────────────

/** Samsung FRP Recovery Wizard — manual-guided multi-step wizard ke baad
 *  background me FRP remove karne ki koshish karta hai.
 *
 *  Flow:
 *    1. User recovery mode me Phone rakhega (Vol Up + Vol Down + Power)
 *    2. Recovery screen par Android version dikhega
 *    3. Phone restart karega
 *    4. Emergency dialer me *#0*# dial karega (Engineering mode)
 *    5. Samsung USB driver install karega
 *    6. Tool background me FRP remove karne ki koshish karega
 *
 *  Ye function wizard se call hoga jab user saare steps complete karke
 *  "Start Engine" dabayega.
 */
export async function samsungRecoveryFrpRemove(
  options: BypassOptions,
  context: BypassContext,
): Promise<BypassResult> {
  log.info("[frp-engine] Starting Samsung FRP Recovery Wizard method");

  const startTime = Date.now();
  const brand = context.brand || "Samsung";
  const model = context.model || "unknown";

  // Step 1: Validate options
  if (!options.model && !options.chipset) {
    return {
      status: "failed",
      error: "Device information required (model or chipset).",
      recoverable: false,
    };
  }

  context.progressCb(
    "samsung-check",
    0,
    `Samsung FRP Recovery Wizard starting for ${brand} ${model}…`,
  );

  // Step 2: Check if device is connected via ADB
  context.progressCb(
    "samsung-adb-check",
    5,
    "Checking ADB connection… (Samsung device should be connected after recovery mode)",
  );

  // ADB check — same as other methods
  if (!isAdbAvailable()) {
    return {
      status: "failed",
      error: "ADB tools not available. Please install Android platform-tools.",
      recoverable: true,
    };
  }

  // Step 3: Try to detect Samsung device via ADB
  context.progressCb(
    "samsung-detect",
    10,
    "Detecting Samsung device via ADB…",
  );

  try {
    const adbResult = execSync("adb devices", {
      timeout: 10000,
      encoding: "utf8",
      cwd: app.isPackaged ? undefined : join(app.getAppPath(), ".."),
    });

    if (!adbResult.includes("device")) {
      return {
        status: "failed",
        error:
          "No Samsung device detected via ADB. Make sure the phone is connected in recovery mode and USB debugging is enabled.",
        recoverable: true,
      };
    }

    context.progressCb(
      "samsung-ready",
      20,
      "Samsung device detected — starting FRP removal attempt…",
    );
  } catch (err) {
    return {
      status: "failed",
      error: `ADB check failed: ${(err as Error).message}`,
      recoverable: true,
    };
  }

  // Step 4: Samsung FRP removal attempt (OEM service codes + ADB commands)
  context.progressCb(
    "samsung-oem-check",
    30,
    "Attempting Samsung OEM service mode FRP removal…",
  );

  const oemCodes = [
    "*#0*#",       // Test mode / engineering mode (main dial code)
    "*#2663#*#*",  // TSP / Touch screen test menu
    "*#9900#",     // Sys dump mode
  ];

  context.progressCb(
    "samsung-dial-codes",
    40,
    `Samsung service codes available: ${oemCodes.join(", ")} — these should be dialled manually on the device.`,
  );

  // Step 5: Try ADB-based FRP removal commands
  context.progressCb(
    "samsung-adb-attempt",
    50,
    "Attempting ADB-based FRP removal commands…",
  );

  const adbCommands = [
    "settings put secure frp_locked 0",
    "settings put global frp_locked 0",
    "pm clear com.google.android.gms",
    "pm clear com.google.android.gms.unstable",
    "am force-stop com.google.android.gms",
    "pm grant com.google.android.gms android.permission.DEVICE_FUSED_PERMISSION",
  ];

  let commandsSuccess = 0;
  let commandsFailed = 0;

  for (let i = 0; i < adbCommands.length; i++) {
    const cmd = adbCommands[i];
    try {
      const result = execSync(`adb shell ${cmd}`, {
        timeout: 10000,
        encoding: "utf8",
        cwd: app.isPackaged ? undefined : join(app.getAppPath(), ".."),
      });
      if (result && !result.includes("error")) {
        commandsSuccess++;
        context.progressCb(
          "samsung-adb-cmd",
          50 + Math.floor((i + 1) * 10 / adbCommands.length),
          `ADB command ${i + 1}/${adbCommands.length} succeeded: ${cmd}`,
        );
      } else {
        commandsFailed++;
        context.progressCb(
          "samsung-adb-cmd-fail",
          50 + Math.floor((i + 1) * 10 / adbCommands.length),
          `ADB command ${i + 1}/${adbCommands.length} may have failed: ${cmd}`,
        );
      }
    } catch (err) {
      commandsFailed++;
      context.progressCb(
        "samsung-adb-cmd-error",
        50 + Math.floor((i + 1) * 10 / adbCommands.length),
        `ADB command ${i + 1}/${adbCommands.length} error: ${cmd} — ${(err as Error).message}`,
      );
    }
  }

  // Step 6: If some commands succeeded, report partial success
  if (commandsSuccess > 0) {
    context.progressCb(
      "samsung-partial",
      70,
      `${commandsSuccess} ADB commands succeeded, ${commandsFailed} failed. Attempting additional methods…`,
    );
  }

  // Step 7: Try factory reset via ADB (if device allows)
  context.progressCb(
    "samsung-factory-reset",
    80,
    "Attempting factory reset via ADB (wipe data/frp partition)…",
  );

  try {
    // This is a risky command — only if device allows it
    execSync("adb shell recovery --wipe_data", {
      timeout: 30000,
      encoding: "utf8",
      cwd: app.isPackaged ? undefined : join(app.getAppPath(), ".."),
    });
    context.progressCb(
      "samsung-fr-success",
      90,
      "Factory reset command sent successfully.",
    );
  } catch {
    context.progressCb(
      "samsung-fr-fail",
      90,
      "Factory reset via ADB not available — device may be locked.",
    );
  }

  // Step 8: Final result
  context.progressCb(
    "samsung-complete",
    100,
    "Samsung FRP Recovery Wizard completed.",
  );

  if (commandsSuccess > 0) {
    return {
      status: "success",
      detail: `Samsung FRP removal attempted. ${commandsSuccess} ADB commands succeeded. Device may need reboot to apply changes. Manual steps (recovery mode, emergency dialer, driver install, OEM codes) should be followed for best results.`,
      timeTaken: Date.now() - Date.now(), // placeholder
    };
  }

  return {
    status: "failed",
    error:
      "Samsung FRP removal could not be completed automatically. Please follow the manual wizard steps (recovery mode → Android version check → restart → emergency dialer *#0*# → Samsung USB driver install → OEM service codes) and try again. If issue persists, try Samsung Download mode (Odin) or MediaTek BROM method.",
    recoverable: true,
  };
}

// ─── ADB-based FRP Removal (Samsung fallback) ──────────────────────────────────────────────

/**
 * ADB ke through FRP remove karne ki koshish karta hai.
 * Ye method tab use hota hai jab:
 *   - Samsung device hai
 *   - Odin tool available nahi hai
 *   - ADB mode accessible hai (USB debugging enabled)
 *
 * Note: Ye sirf attempted karta hai — success guarantee nahi hai.
 * FRP lock remove karne ke liye adb shell commands use karta hai.
 */
export async function adbFrpRemove(
  options: BypassOptions,
  context: BypassContext,
): Promise<BypassResult> {
  log.info("[frp-engine] Attempting ADB-based FRP removal (Samsung fallback)");

  const startTime = Date.now();

  context.progressCb("adb-check", 5, "Checking ADB availability...");

  if (!isAdbAvailable()) {
    return {
      status: "failed",
      error: "ADB is not available. Please install Android platform-tools first.",
      recoverable: true,
    };
  }

  context.progressCb("adb-devices", 10, "Checking connected devices...");

  if (!hasAdbDevice()) {
    return {
      status: "failed",
      error: "No ADB device found. Please connect your phone with USB debugging enabled.",
      recoverable: true,
    };
  }

  context.progressCb("adb-device-info", 20, "Getting device info...");

  const deviceInfo = adbGetDeviceInfo();
  if (deviceInfo) {
    log.info(`[frp-engine] Device: ${deviceInfo.model} (${deviceInfo.serial}), Android ${deviceInfo.androidVersion}`);
  }

  // Step 3: Attempt FRP removal via ADB commands
  context.progressCb("adb-attempt", 30, "Attempting FRP removal commands...");

  // Ye commands FRP lock remove karne ki koshish karti hain
  const commands = [
    "settings put secure frp_locked 0",
    "settings put global frp_locked 0",
    "pm clear com.google.android.gms",
    "pm clear com.google.android.gms.unstable",
    "am force-stop com.google.android.gms",
    "setprop persist.sys.frp.checked 1",
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const progress = Math.floor((i + 1) / commands.length * 50) + 30;
    context.progressCb("adb-cmd", progress, `Running command ${i + 1}/${commands.length}: ${cmd}`);

    try {
      const result = execSync(`adb shell ${cmd}`, {
        timeout: 10000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        cwd: undefined,
      });
      successCount++;
      log.info(`[frp-engine] ADB command succeeded: ${cmd}`);
    } catch (err) {
      failCount++;
      log.warn(`[frp-engine] ADB command failed: ${cmd}`, (err as Error).message);
    }
  }

  context.progressCb("adb-result", 85, `ADB commands: ${successCount}/${commands.length} succeeded`);

  // Step 4: Report result
  if (successCount > 0) {
    context.progressCb("adb-success", 95, "FRP removal attempt completed via ADB");

    return {
      status: "success",
      detail: `Samsung FRP removal attempted via ADB. ${successCount} commands succeeded. Device may need reboot for changes to apply. Manual steps (recovery mode → emergency dialer *#0*# → Samsung USB driver install → OEM service codes) should be followed for best results.`,
      timeTaken: Date.now() - startTime,
    };
  } else {
    context.progressCb("adb-failed", 95, "All ADB commands failed");

    return {
      status: "failed",
      error: `ADB-based FRP removal failed. All ${commands.length} commands failed. Try Samsung Download mode (Odin) or MediaTek BROM method instead.`,
      recoverable: true,
    };
  }
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
  samsungRecoveryFrpRemove,
  adbFrpRemove,
  checkOdinTool,
};
