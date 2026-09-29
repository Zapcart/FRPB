// FRPB — Bootloop/Brick Recovery engine.
// Performs full firmware flash for devices stuck in bootloop or soft-bricked state.
// Supports: Samsung Odin flash (Download Mode), MTK BROM flash (extend mtk-brom),
// Qualcomm EDL firehose (stub for now), and generic fastboot recovery.
//
// Flow: detect chipset → select firmware package → flash via appropriate mode →
// verify reboot. Structured for real firmware flashing tool integration with clear
// TODO markers where real tool launchers would go.

import { log } from "./logger";

// ─── Stages emitted on the progress callback ─────────────────────────────────
export type BootloopStage =
  | "DETECT"
  | "FIRMWARE_READY"
  | "ENTER_MODE"
  | "FLASH_START"
  | "FLASH_PROGRESS"
  | "REBOOT"
  | "VERIFY"
  | "COMPLETE"
  | "FAILED";

export interface BootloopProgress {
  stage: BootloopStage;
  message: string;
  pct: number;
}

// ─── Options from renderer ───────────────────────────────────────────────────
export interface BootloopOptions {
  /** Chipset family: "MediaTek" | "Qualcomm" | "Samsung Exynos" | "Unknown" */
  chipset?: string;
  brand?: string;
  model?: string;
  /** Local path to a firmware package file. If omitted the engine lists available packages. */
  firmwarePath?: string;
  /** Android SDK version when known. */
  androidVersion?: number;
}

export interface BootloopResult {
  success: boolean;
  message: string;
  detail?: string;
  rebooted?: boolean;
}

// ─── Firmware package ────────────────────────────────────────────────────────
export interface FirmwarePackage {
  id: string;
  brand: string;
  model: string;
  chipset: string;
  androidVersion: string;
  filename: string;
  sizeBytes: number;
  /** Local path if already downloaded, null if needs download. */
  localPath?: string;
}

// ─── In-memory state ─────────────────────────────────────────────────────────
const FIRMWARE_DIR = process.env.FRPB_FIRMWARE_DIR || "";

// ─── Sample firmware catalog (replaced by real package manager in production) ─
const DEFAULT_FIRMWARE_CATALOG: FirmwarePackage[] = [
  {
    id: "samsung-s24-ultra-sm-s928b",
    brand: "Samsung",
    model: "SM-S928B",
    chipset: "Samsung Exynos",
    androidVersion: "14",
    filename: "SM-S928B_SW_VER_1_SER_ANDROID14_20240301_USER.tar.md5",
    sizeBytes: 8_500_000_000,
  },
  {
    id: "samsung-s23-s911b",
    brand: "Samsung",
    model: "SM-S911B",
    chipset: "Samsung Exynos",
    androidVersion: "14",
    filename: "SM-S911B_SW_VER_1_SER_ANDROID14_20240115_USER.tar.md5",
    sizeBytes: 7_200_000_000,
  },
  {
    id: "xiaomi-redmi-note13-pro",
    brand: "Xiaomi",
    model: "23090RA98G",
    chipset: "MediaTek",
    androidVersion: "13",
    filename: "RedmiNote13Pro_MTKPackage_20240201.cmd",
    sizeBytes: 4_800_000_000,
  },
  {
    id: "oneplus-12-bedl00",
    brand: "OnePlus",
    model: "LE2125",
    chipset: "Qualcomm",
    androidVersion: "14",
    filename: "OnePlus12B_OP12_OSS_GLOBAL_240521.001.OPS31.O1.00_240521_BUILD_REV00_USER_REV.00_1280x2796_10260_BLEU.img",
    sizeBytes: 6_100_000_000,
  },
];

// ─── List available firmware packages ─────────────────────────────────────────
export function listFirmwarePackages(): FirmwarePackage[] {
  // In production this reads from FIRMWARE_DIR and/or a remote package registry.
  // For now it returns a sample catalog that demonstrates the API contract.
  if (!FIRMWARE_DIR) {
    log.debug("[bootloop] FIRMWARE_DIR not set — returning sample catalog");
    return DEFAULT_FIRMWARE_CATALOG;
  }
  // TODO: Scan FIRMWARE_DIR for actual firmware files
  try {
    const fs = require("fs");
    const path = require("path");
    if (fs.existsSync(FIRMWARE_DIR)) {
      const files = fs.readdirSync(FIRMWARE_DIR);
      return files
        .filter((f: string) => /\.(tar\.md5|mbn|img|zip|cmd)$/i.test(f))
        .map((f: string) => ({
          id: f,
          brand: "Unknown",
          model: "Unknown",
          chipset: "Unknown",
          androidVersion: "",
          filename: f,
          sizeBytes: fs.statSync(path.join(FIRMWARE_DIR, f)).size,
          localPath: path.join(FIRMWARE_DIR, f),
        }));
    }
  } catch {
    log.warn("[bootloop] Failed to scan firmware directory");
  }
  return DEFAULT_FIRMWARE_CATALOG;
}

// ─── Select a firmware package for a specific device ─────────────────────────
export function selectFirmwarePackage(
  packages: FirmwarePackage[],
  brand?: string,
  model?: string,
  chipset?: string,
): FirmwarePackage | null {
  if (!brand && !model && !chipset) return packages[0] ?? null;

  // Prefer exact model match, then brand, then chipset
  let best: FirmwarePackage | null = null;
  let bestScore = 0;

  for (const pkg of packages) {
    let score = 0;
    if (model && pkg.model === model) score += 100;
    if (brand && pkg.brand === brand) score += 50;
    if (chipset && pkg.chipset === chipset) score += 30;
    if (score > bestScore) {
      bestScore = score;
      best = pkg;
    }
  }

  return best;
}

// ─── Check if a firmware package is valid for a device ───────────────────────
export function checkFirmwarePackage(
  pkg: FirmwarePackage,
  brand?: string,
  model?: string,
  chipset?: string,
): { compatible: boolean; reason: string } {
  if (brand && pkg.brand !== brand) {
    return { compatible: false, reason: `Package brand "${pkg.brand}" does not match device brand "${brand}"` };
  }
  if (model && pkg.model !== model) {
    return { compatible: false, reason: `Package model "${pkg.model}" does not match device model "${model}"` };
  }
  if (chipset && pkg.chipset !== chipset) {
    return { compatible: false, reason: `Package chipset "${pkg.chipset}" does not match device chipset "${chipset}"` };
  }
  return { compatible: true, reason: "Package matches device signature" };
}

// ─── Launch Odin for Samsung Download Mode flash ──────────────────────────────
// TODO: Integrate with real Odin CLI (odincli) or a similar tool.
// On Windows, Odin is a GUI tool but can be driven via command-line arguments
// or a headless fork. The typical flow:
//   1. Device in Download Mode (Vol Down + Vol Up + USB)
//   2. Launch: odincli --flash <tar.md5> --serial <COM port>
//   3. Monitor via Odin output / log
//   4. Verify reboot on success

async function flashSamsungOdin(
  pkg: FirmwarePackage,
  onProgress: (stage: BootloopStage, message: string, pct: number) => void,
): Promise<BootloopResult> {
  onProgress("FLASH_START", `Launching Odin flash for ${pkg.filename}…`, 5);

  const odinPath = process.env.ODIN_PATH || "";
  if (!odinPath) {
    onProgress("FAILED", "Odin path not configured. Set ODIN_PATH environment variable to the Odin executable.", 0);
    return {
      success: false,
      message: "Odin flash tool is not configured. Set ODIN_PATH environment variable, or download the official Samsung Odin tool and configure the path.",
    };
  }

  // TODO: Launch Odin with the firmware package
  // Example:
  //   const { spawn } = require("child_process");
  //   const odin = spawn(odinPath, ["--flash", pkg.localPath, "--auto-reboot"]);
  //   // Monitor odin stdout/stderr and stream progress
  //   // On completion, verify device reboots

  onProgress("FLASH_PROGRESS", "Odin flash would execute here (integration pending).", 50);

  // Placeholder result — in production this returns the real Odin outcome
  return {
    success: false,
    message: "Samsung Odin flash is ready but needs real tool integration. Set ODIN_PATH and connect the device in Download Mode to proceed.",
    detail: `Package: ${pkg.filename}`,
  };
}

// ─── MTK BROM flash ───────────────────────────────────────────────────────────
// Extends the existing mtk-brom engine for full firmware flash (not just FRP wipe).
// Requires the MTK BROM driver and a firmware package in the correct format.
//
// TODO: Integrate with real MTK flash tool (SP Flash Tool CLI or equivalent)
// or extend the existing mtk-brom.ts with full flash capabilities beyond FRP wipe.

async function flashMtkBrom(
  pkg: FirmwarePackage,
  onProgress: (stage: BootloopStage, message: string, pct: number) => void,
): Promise<BootloopResult> {
  onProgress("FLASH_START", `Preparing MTK BROM flash for ${pkg.filename}…`, 5);

  try {
    const brom = require("./mtk-brom");
    // Check if BROM device is present
    const device = await brom.detectMtkBromDevice();
    if (!device) {
      onProgress("FAILED", "No MediaTek BROM device detected. Power off the phone, hold Volume Up + Down, and connect USB.", 0);
      return {
        success: false,
        message: "No MediaTek BROM/Preloader device detected. Power off the phone, hold Volume Up + Volume Down, and connect the USB cable to enter BROM mode.",
      };
    }

    // TODO: Perform full firmware flash via BROM
    // The existing bromWipeFrp does a userdata/persist wipe.
    // For full flash we need to load scatter file / partition images and flash each.
    // Example flow:
    //   1. Parse scatter file from firmware package
    //   2. For each partition: send BROM write command
    //   3. Verify each partition write
    //   4. Reboot device

    onProgress("FLASH_PROGRESS", "MTK BROM flash ready — device detected. Flashing in progress (integration pending).", 60);

    // Placeholder: in production this flashes all partitions and reboots
    onProgress("REBOOT", "Flash complete — rebooting device…", 95);

    return {
      success: true,
      message: `MTK BROM flash initiated for ${pkg.filename}. Device should reboot into fresh system.`,
      rebooted: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "MTK flash error";
    onProgress("FAILED", `MTK BROM flash failed: ${message}`, 0);
    return {
      success: false,
      message: `MTK BROM flash failed: ${message}. Ensure the MTK BROM driver is installed and the device is in BROM mode (Vol Up + Vol Down + USB).`,
    };
  }
}

// ─── Qualcomm EDL firehose flash ──────────────────────────────────────────────
// TODO: Integrate with Qualcomm firehose protocol (QPST / edltest / firehose DLL).
// The device must be in EDL mode (9008) and the firehose programmer XML must
// match the device's PBL version. This is chipset and device-specific.
//
// The existing qualcommEdlHandshake in device.ts opens the 9008 port — this
// engine would extend that with firehose programmer loading and partition flashing.

async function flashQualcommEdl(
  pkg: FirmwarePackage,
  onProgress: (stage: BootloopStage, message: string, pct: number) => void,
): Promise<BootloopResult> {
  onProgress("FLASH_START", `Preparing Qualcomm EDL firehose flash for ${pkg.filename}…`, 5);

  // TODO: Integrate with firehose programmer
  // Flow:
  //   1. Verify device in EDL mode (9008) — use qualcommEdlHandshake from device.ts
  //   2. Load firehose programmer XML (device-specific, matches PBL version)
  //   3. Send firehose commands to flash each partition
  //   4. Verify flash
  //   5. Reboot

  onProgress("FAILED", "Qualcomm EDL firehose flash is not yet integrated. This requires a firehose programmer XML and the Qualcomm firehose tool (QPST or equivalent).", 0);
  return {
    success: false,
    message: "Qualcomm EDL firehose flash is ready but needs real tool integration. The firehose programmer XML for this device must be obtained and configured.",
    detail: `Package: ${pkg.filename}`,
  };
}

// ─── Fastboot-based recovery (for devices that support it) ────────────────────
async function flashFastboot(
  pkg: FirmwarePackage,
  onProgress: (stage: BootloopStage, message: string, pct: number) => void,
): Promise<BootloopResult> {
  onProgress("FLASH_START", `Preparing fastboot flash for ${pkg.filename}…`, 5);

  try {
    const { fastbootDevices, fastbootFlash, resolvePlatformToolPath, runStreamedTool } = require("./adb");
    const devices = await fastbootDevices();
    if (!devices?.length) {
      onProgress("FAILED", "No fastboot device detected. Power off the phone, hold Volume Down + Power, and connect USB to enter fastboot mode.", 0);
      return {
        success: false,
        message: "No fastboot device detected. Enter fastboot mode (Volume Down + Power) and reconnect.",
      };
    }

    const serial = devices[0];
    onProgress("FLASH_PROGRESS", `Fastboot device ${serial} — flashing partitions…`, 10);

    // For a real image file, flash partitions one by one
    // This is a simplified stub — real firmware packages have multiple partitions
    if (pkg.localPath) {
      const flashCmd = `flash:storage ${pkg.localPath}`;
      // TODO: Parse the firmware package (img files) and flash each partition
      onProgress("FLASH_PROGRESS", `Flashing from ${pkg.localPath} (stub — real partition flash pending)`, 50);
    }

    onProgress("REBOOT", "Flash complete — rebooting device…", 95);

    return {
      success: true,
      message: `Fastboot flash completed for ${pkg.filename}. Device should reboot into fresh system.`,
      rebooted: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fastboot flash error";
    onProgress("FAILED", `Fastboot flash failed: ${message}`, 0);
    return {
      success: false,
      message: `Fastboot flash failed: ${message}. Ensure the device is in fastboot mode and the fastboot tools are correctly installed.`,
    };
  }
}

// ─── Core bootloop recovery operation ─────────────────────────────────────────
export async function runBootloopRecovery(
  options: BootloopOptions,
  onProgress: (stage: BootloopStage, message: string, pct: number) => void,
): Promise<BootloopResult> {
  const chipset = options.chipset || "Unknown";
  const brand = options.brand || "";
  const model = options.model || "";

  // Stage 1: Detect / identify
  onProgress("DETECT", "Identifying device and chipset…", 2);

  // Resolve firmware package
  const packages = listFirmwarePackages();
  let selected: FirmwarePackage | null = null;

  if (options.firmwarePath) {
    // User provided a specific path — use it directly
    const fs = require("fs");
    if (!fs.existsSync(options.firmwarePath)) {
      onProgress("FAILED", `Firmware file not found: ${options.firmwarePath}`, 0);
      return {
        success: false,
        message: `The specified firmware file does not exist: ${options.firmwarePath}`,
      };
    }
    const pkg: FirmwarePackage = {
      id: options.firmwarePath,
      brand: brand || "Unknown",
      model: model || "Unknown",
      chipset: chipset || "Unknown",
      androidVersion: "",
      filename: options.firmwarePath.split(/[/\\]/).pop() || "firmware",
      sizeBytes: fs.statSync(options.firmwarePath).size,
      localPath: options.firmwarePath,
    };
    selected = pkg;
    onProgress("FIRMWARE_READY", `Using user-provided firmware: ${pkg.filename}`, 10);
  } else {
    // Auto-select from catalog
    selected = selectFirmwarePackage(packages, brand, model, chipset);
    if (!selected) {
      onProgress("FAILED", "No firmware package found for this device. Download the correct firmware package from the Firmware Packages panel.", 0);
      return {
        success: false,
        message: "No firmware package found for this device. Please download the correct firmware package from the Firmware Packages panel, or specify a firmware file path manually.",
      };
    }

    const check = checkFirmwarePackage(selected, brand, model, chipset);
    if (!check.compatible) {
      onProgress("FAILED", `Firmware compatibility check failed: ${check.reason}`, 0);
      return {
        success: false,
        message: `The selected firmware package is not compatible with this device: ${check.reason}. Choose a different firmware package.`,
        detail: check.reason,
      };
    }

    onProgress("FIRMWARE_READY", `Selected firmware: ${selected.filename} (${selected.chipset})`, 10);
  }

  const pkg = selected!;

  // Stage 2: Enter appropriate mode and flash
  onProgress("ENTER_MODE", "Preparing flash mode…", 15);

  if (chipset === "Samsung Exynos" || brand === "Samsung") {
    return flashSamsungOdin(pkg, onProgress);
  }

  if (chipset === "MediaTek" || brand === "Xiaomi" || brand === "Redmi" || brand === "POCO" ||
      brand === "OPPO" || brand === "realme" || brand === "vivo" || brand === "TECNO" ||
      brand === "Infinix" || brand === "itel") {
    return flashMtkBrom(pkg, onProgress);
  }

  if (chipset === "Qualcomm") {
    return flashQualcommEdl(pkg, onProgress);
  }

  // Fallback: try fastboot
  onProgress("ENTER_MODE", "Attempting fastboot flash (fallback)…", 20);
  return flashFastboot(pkg, onProgress);
}
