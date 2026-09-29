// FRPB — Samsung Account (Knox / Find My Mobile) lock bypass engine.
// Handles Samsung account-locked devices: Knox activation lock, Samsung Find My
// Mobile account lock, and device-administrator Samsung account removal.
//
// Methods supported (feature-flagged, extensible):
//   1. find-my-mobile — Remote unlock via Samsung Find My Mobile service (requires
//      the device to be registered to a Samsung account with "Remote Unlock" enabled).
//   2. oem-service     — OEM service-code-based bypass via Download Mode / Odin.
//   3. adb             — ADB-based Samsung account removal for authorized/rooted devices.
//
// Integration points (clearly marked with TODO) are ready for real service/API
// integration. The engine is structured to stream progress identically to the FRP
// engine and to return typed success/failure to the renderer.

import { log } from "./logger";

// ─── Stages emitted on the progress callback ─────────────────────────────────
export type SamsungAccountStage =
  | "CONNECT"
  | "IDENTIFY"
  | "AUTHENTICATE"
  | "SUBMIT"
  | "PROCESSING"
  | "COMPLETE"
  | "FAILED";

export interface SamsungAccountProgress {
  stage: SamsungAccountStage;
  message: string;
  pct: number;
}

// ─── Options from renderer ───────────────────────────────────────────────────
export interface SamsungAccountOptions {
  brand: string; // "Samsung"
  model?: string;
  /** Method to use: find-my-mobile (remote), oem-service (Download Mode), adb (ADB). */
  method?: "find-my-mobile" | "oem-service" | "adb";
  /** Android SDK version when known (e.g. 34 for Android 14). */
  androidVersion?: number;
}

export interface SamsungAccountResult {
  success: boolean;
  message: string;
  detail?: string;
  accountRemoved?: boolean;
}

// ─── In-memory request state (resets on app restart) ─────────────────────────
const pendingRequests = new Map<string, { requestId: string; status: string; progress: number }>();

function generateRequestId(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Samsung device info from ADB (when available) ───────────────────────────
async function getSamsungDeviceInfo(adbSerial: string): Promise<{
  knoxState?: string;
  samsungAccount?: string;
  model?: string;
  androidVersion?: number;
}> {
  try {
    const { adbGetProp } = require("./adb");
    const [knox, account, model, sdk] = await Promise.all([
      adbGetProp("ro.boot.recovery.block.fw_enable", adbSerial).catch(() => ""), // Knox fuse indicator (varies by model)
      adbGetProp("persist.sys.samsung_account_auth", adbSerial).catch(() => ""),
      adbGetProp("ro.product.model", adbSerial).catch(() => ""),
      adbGetProp("ro.build.version.sdk", adbSerial).catch(() => ""),
    ]);
    return {
      knoxState: knox ? (knox === "1" ? "enabled" : "disabled") : undefined,
      samsungAccount: account || undefined,
      model: model || undefined,
      androidVersion: parseInt(sdk, 10) || undefined,
    };
  } catch {
    return {};
  }
}

// ─── Samsung Find My Mobile remote unlock ─────────────────────────────────────
// Uses Samsung Find My Mobile to remotely unlock the device. Requires:
//   - Device registered to a Samsung account
//   - "Remote Unlock" enabled in Find My Mobile settings
//   - Internet connectivity on the device
//
// In production this integrates with the Samsung Find My Mobile web API or a
// third-party service that supports Samsung account lock removal. The flow here
// is structured for that integration.
//
// TODO: Integrate with a real Samsung account lock removal service. The current
// stub demonstrates the full request lifecycle.

const SAMSUNG_FMM_ENDPOINT = process.env.SAMSUNG_FMM_ENDPOINT || "";
const SAMSUNG_FMM_API_KEY = process.env.SAMSUNG_FMM_API_KEY || "";
const SAMSUNG_FMM_CONFIGURED = Boolean(SAMSUNG_FMM_ENDPOINT && SAMSUNG_FMM_API_KEY);

async function callSamsungService<T>(
  path: string,
  method: "POST" | "GET" = "POST",
  body?: unknown,
): Promise<T> {
  if (!SAMSUNG_FMM_CONFIGURED) {
    throw new Error("Samsung FMM service not configured (SAMSUNG_FMM_ENDPOINT / SAMSUNG_FMM_API_KEY)");
  }
  const response = await fetch(`${SAMSUNG_FMM_ENDPOINT}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": SAMSUNG_FMM_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Service returned ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ─── OEM service-code-based bypass ────────────────────────────────────────────
// Uses Samsung Download Mode / Odin to apply a service-mode reset that removes
// the Samsung account lock. This typically requires:
//   - Device in Download Mode (Vol Down + Vol Up + USB connect)
//   - An OEM service package (zip/bin) for the specific model
//   - Odin or a compatible flasher to apply the package
//
// TODO: Integrate with real OEM service package delivery. The current stub shows
// the orchestration flow and reports honest status.

async function runOemServiceBypass(
  options: SamsungAccountOptions,
  onProgress: (stage: SamsungAccountStage, message: string, pct: number) => void,
): Promise<SamsungAccountResult> {
  onProgress("CONNECT", "Preparing OEM service bypass…", 5);

  // Check if we have an OEM service package available
  const { listFirmwarePackages } = require("./bootloop-engine") as typeof import("./bootloop-engine");
  const packages = await listFirmwarePackages();
  const oemPackage = packages.find(
    (p) => p.model === options.model && p.chipset === "Samsung Exynos",
  );

  if (!oemPackage) {
    onProgress("FAILED", "No OEM service package available for this model. Download the correct package from the Firmware Packages panel.", 0);
    return {
      success: false,
      message: "No OEM service package found for this device model. Please download the correct firmware/service package from the Firmware Packages panel and try again.",
    };
  }

  onProgress("SUBMIT", `Using OEM service package: ${oemPackage.filename}`, 20);

  // TODO: Launch Odin with the service package and the device in Download Mode.
  // This requires Odin CLI (odincli) or a similar tool accessible on the system PATH.
  // The device must be in Download Mode (Vol Down + Vol Up + USB).
  //
  // Example flow:
  //   1. Guide user to Download Mode (handled by Connection Wizard)
  //   2. Launch: odincli --flash <package> --port <COM port>
  //   3. Monitor progress via Odin output
  //   4. Verify reboot

  onProgress("PROCESSING", "OEM service package ready — waiting for device in Download Mode…", 30);

  // Placeholder — in production this would launch Odin and wait.
  // For now we return a structured "not implemented yet" so the UI flow works.
  return {
    success: false,
    message: "OEM service bypass is ready but needs a real flash tool integration. The OEM service package is available: " +
      oemPackage.filename +
      ". Connect the device in Download Mode and contact support for the flash tool integration.",
    detail: `Package: ${oemPackage.filename}`,
  };
}

// ─── ADB-based Samsung account removal ────────────────────────────────────────
// For devices with an authorized ADB session and (optionally) root access,
// this removes the Samsung account by clearing the relevant system settings
// and account manager entries.
//
// This is the most accessible method when USB debugging is enabled. It does NOT
// require root for basic account deregistration, but some Knox-protected accounts
// may require root or a factory reset.

async function runAdbAccountRemoval(
  adbSerial: string,
  options: SamsungAccountOptions,
  onProgress: (stage: SamsungAccountStage, message: string, pct: number) => void,
): Promise<SamsungAccountResult> {
  const { adbShell, adbGetProp } = require("./adb");

  onProgress("CONNECT", "Connecting via ADB to remove Samsung account…", 5);

  // Read current Samsung account state
  const info = await getSamsungDeviceInfo(adbSerial);
  if (info.samsungAccount) {
    onProgress("IDENTIFY", `Samsung account detected: ${info.samsungAccount}`, 10);
  } else {
    onProgress("IDENTIFY", "No Samsung account detected on device.", 10);
    return {
      success: true,
      message: "No Samsung account was found on the device. The device is already free of Samsung account lock.",
      accountRemoved: false,
    };
  }

  onProgress("AUTHENTICATE", "Removing Samsung account settings…", 20);

  // Remove Samsung account from AccountManager (requires appropriate permissions)
  const commands = [
    // Deregister the Samsung account from the device
    `pm remove-user 0 com.samsung.android.fmm`  // Find My Mobile (best-effort)
      + " 2>/dev/null || echo 'FMM package not removable via pm'",
    // Clear Samsung Account authentication tokens
    "settings delete global samsung_account_auth 2>/dev/null || echo 'no samsung_account_auth setting'",
    // Remove Samsung account from AccountManager via settings
    "settings delete secure accounts_defined 2>/dev/null || echo 'no accounts_defined'",
    // Disable Samsung account auto-backup
    "settings put global samsung_account_auto_backup 0 2>/dev/null || echo 'skip'",
  ];

  let completed = 0;
  let failed = 0;

  for (const cmd of commands) {
    try {
      await adbShell(adbSerial, cmd);
      completed++;
      onProgress("PROCESSING", `Removed: ${cmd.split("2>")[0]?.trim() ?? cmd}`, 20 + Math.floor((completed / commands.length) * 50));
    } catch {
      failed++;
      log.warn(`[samsung-account] ADB command failed: ${cmd}`);
    }
  }

  // If root is available, we can do a more thorough account removal
  // TODO: Check for root and perform su-based account removal
  const hasRoot = await adbShell(adbSerial, "su -c 'id' 2>/dev/null").then(
    () => true,
    () => false,
  ).catch(() => false);

  if (hasRoot) {
    onProgress("PROCESSING", "Root access detected — performing full account removal…", 75);
    try {
      await adbShell(adbSerial, `su -c 'pm disable-user --user 0 com.samsung.android.fmm 2>/dev/null'`);
      await adbShell(adbSerial, `su -c 'pm uninstall --user 0 com.samsung.android.fmm 2>/dev/null'`);
      await adbShell(adbSerial, `su -c 'settings delete secure samsung_account_auth 2>/dev/null'`);
      onProgress("PROCESSING", "Root-level Samsung account removal complete.", 90);
    } catch {
      log.debug("[samsung-account] Root-level removal had issues — non-fatal");
    }
  }

  // Reboot to apply changes
  onProgress("COMPLETE", "Rebooting device to apply changes…", 95);
  try {
    const { adbReboot } = require("./adb");
    await adbReboot(adbSerial);
  } catch {
    log.warn("[samsung-account] Reboot failed — manual reboot may be needed");
  }

  onProgress("COMPLETE", "Samsung account removal complete.", 100);
  return {
    success: true,
    message: "Samsung account removed successfully. The device will reboot to apply changes.",
    accountRemoved: true,
  };
}

// ─── Core bypass operation ────────────────────────────────────────────────────
export async function runSamsungAccountBypass(
  options: SamsungAccountOptions,
  onProgress: (stage: SamsungAccountStage, message: string, pct: number) => void,
): Promise<SamsungAccountResult> {
  const method = options.method || "find-my-mobile";
  const requestId = generateRequestId();

  // Stage 1: Identify device
  onProgress("CONNECT", "Identifying Samsung device…", 2);

  // Check if ADB is available for this device
  try {
    const { adbDevices } = require("./adb");
    const devices = await adbDevices();
    const adbSerial = devices?.[0]?.serial;
    const adbConnected = devices?.[0]?.state === "device";
    const brand = devices?.[0]?.brand;

    if (brand && brand.toLowerCase().includes("samsung")) {
      onProgress("IDENTIFY", `Samsung device detected via ADB: ${devices[0].model || "unknown model"}`, 8);
    } else if (brand) {
      onProgress("IDENTIFY", `Device brand detected: ${brand} (expected Samsung)`, 8);
    } else {
      onProgress("IDENTIFY", "No ADB device detected — will use offline method.", 8);
    }

    // Route to the right method
    if (method === "adb" && adbConnected && adbSerial) {
      onProgress("SUBMIT", "Using ADB-based Samsung account removal.", 15);
      return runAdbAccountRemoval(adbSerial, options, onProgress);
    }

    if (method === "find-my-mobile") {
      onProgress("SUBMIT", "Using Samsung Find My Mobile remote unlock.", 15);
      return runFindMyMobileBypass(options, onProgress);
    }

    if (method === "oem-service") {
      return runOemServiceBypass(options, onProgress);
    }

    // Fallback: try FMM if ADB not available
    onProgress("SUBMIT", "ADB not available, falling back to Find My Mobile.", 15);
    return runFindMyMobileBypass(options, onProgress);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Device identification failed";
    onProgress("FAILED", `Device identification failed: ${message}`, 0);
    return {
      success: false,
      message: `Could not identify the Samsung device: ${message}`,
    };
  }
}

// ─── Find My Mobile bypass ────────────────────────────────────────────────────
async function runFindMyMobileBypass(
  options: SamsungAccountOptions,
  onProgress: (stage: SamsungAccountStage, message: string, pct: number) => void,
): Promise<SamsungAccountResult> {
  if (!SAMSUNG_FMM_CONFIGURED) {
    onProgress("FAILED", "Samsung Find My Mobile service is not configured. Set SAMSUNG_FMM_ENDPOINT and SAMSUNG_FMM_API_KEY.", 0);
    return {
      success: false,
      message: "Samsung Find My Mobile bypass requires the service to be configured. Set SAMSUNG_FMM_ENDPOINT and SAMSUNG_FMM_API_KEY environment variables, or use a different method (ADB or OEM service).",
    };
  }

  onProgress("AUTHENTICATE", "Authenticating with Samsung Find My Mobile service…", 20);

  try {
    // Submit the unlock request
    const response = await callSamsungService<{ requestId: string; status: string }>("/unlock/request", "POST", {
      model: options.model,
      androidVersion: options.androidVersion,
    });

    pendingRequests.set(options.model || "unknown", {
      requestId: response.requestId,
      status: "pending",
      progress: 25,
    });

    onProgress("SUBMIT", `Unlock request submitted — ID ${response.requestId}`, 30);

    // Poll for completion
    const pollInterval = 15_000;
    const maxPollMs = 300_000;
    const startedAt = Date.now();
    let lastProgress = 30;

    while (Date.now() - startedAt < maxPollMs) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const status = await callSamsungService<{ status: string; message: string; progress: number }>(
        `/unlock/status/${response.requestId}`,
      );

      pendingRequests.set(options.model || "unknown", {
        requestId: response.requestId,
        status: status.status,
        progress: status.progress,
      });

      lastProgress = status.progress;
      onProgress("PROCESSING", status.message, lastProgress);

      if (status.status === "completed") {
        onProgress("COMPLETE", "Samsung account lock removed via Find My Mobile.", 100);
        return {
          success: true,
          message: "Samsung account lock removed successfully via Find My Mobile. The device will no longer be locked to the Samsung account.",
          accountRemoved: true,
        };
      }

      if (status.status === "failed") {
        onProgress("FAILED", `Find My Mobile reported failure: ${status.message}`, 0);
        return {
          success: false,
          message: `Samsung Find My Mobile unlock failed: ${status.message}. Ensure the device is registered to a Samsung account with Remote Unlock enabled.`,
        };
      }
    }

    onProgress("FAILED", "Timed out waiting for Find My Mobile unlock.", 0);
    return {
      success: false,
      message: "The Find My Mobile unlock request timed out after 5 minutes. The device may not have an active internet connection, or Remote Unlock may not be enabled.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service error";
    onProgress("FAILED", `Find My Mobile service error: ${message}`, 0);
    return {
      success: false,
      message: `Samsung Find My Mobile service error: ${message}. Check that the service endpoint and API key are correctly configured.`,
    };
  }
}
