// FRPB — Apple iCloud Activation Lock bypass engine.
// Handles iCloud-locked iOS devices via online IMEI-based bypass service.
// Structured for real service integration; currently provides the orchestration
// layer (device detection, IMEI extraction, request lifecycle, progress streaming).

import { log } from "./logger";

// ─── Stages emitted on the progress callback ────────────────────────────────
export type IcloudStage = "CONNECT" | "IDENTIFY" | "SUBMIT" | "PROCESSING" | "COMPLETE" | "FAILED";

export interface IcloudBypassProgress {
  stage: IcloudStage;
  message: string;
  pct: number;
}

// ─── Options from renderer ───────────────────────────────────────────────────
export interface IcloudBypassOptions {
  /** 15-digit IMEI. If omitted the engine tries to read it from a connected device. */
  imei?: string;
  /** Optional Apple ID (for logging / verification only). */
  appleId?: string;
  /** Model identifier e.g. "iPhone14,2". */
  model?: string;
  /** iOS version string when known, e.g. "17.4". */
  iosVersion?: string;
}

// ─── Result returned to the renderer ─────────────────────────────────────────
export interface IcloudBypassResult {
  success: boolean;
  message: string;
  requestId?: string;
  detail?: string;
}

// ─── Current status of a bypass request (pollable) ───────────────────────────
export interface IcloudStatus {
  requestId: string;
  status: "pending" | "processing" | "completed" | "failed" | "not-found";
  message: string;
  progress: number;
}

// ─── Apple device detection result ───────────────────────────────────────────
export interface AppleDeviceInfo {
  /** True when an Apple device was detected on the system. */
  detected: boolean;
  /** Device model identifier (e.g. "iPhone14,2") if available. */
  model?: string;
  /** IMEI if readable via the connected device / iTunes service. */
  imei?: string;
  /** iOS version if readable. */
  iosVersion?: string;
  /** Attached device name (e.g. "John's iPhone"). */
  name?: string;
  /** Error message when detection failed. */
  error?: string;
}

// ─── Internal request state (in-memory; resets on app restart) ───────────────
interface IcloudRequest {
  requestId: string;
  status: IcloudStatus["status"];
  message: string;
  progress: number;
}

const pendingRequests = new Map<string, IcloudRequest>();

// ─── IMEI validation ─────────────────────────────────────────────────────────
function isValidImei(imei: string): boolean {
  const cleaned = imei.replace(/\D/g, "");
  if (!/^\d{15}$/.test(cleaned)) return false;
  // Simple Luhn check for IMEI
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i] ?? "0", 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(cleaned[14] ?? "0", 10);
}

// ─── Generate a short request ID ──────────────────────────────────────────────
function generateRequestId(): string {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── Apple device detection ───────────────────────────────────────────────────
// Attempts to detect a connected Apple device and read its IMEI/model.
// Uses iTunes Mobile Device Service (AMDevice) when available; falls back
// to platform-specific approaches. Currently provides a structured stub that
// is ready for real node-ios-device / libimobiledevice integration.
//
// TODO: Integrate node-ios-device (npm) or libimobiledevice (via child_process)
// for real AMDevice access. On Windows the iTunes Mobile Device API is available
// via COM (iTunesMobileDevice.dll) — accessible via node-ffi-napi or a small
// native addon. On macOS libimobiledevice is the standard.

async function detectAppleDevice(): Promise<AppleDeviceInfo> {
  // Try node-ios-device if available (cross-platform: macOS/iOS focus; Windows
  // requires iTunes Mobile Device Service running).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const iosDevice = require("ios-device");
    if (iosDevice && typeof iosDevice.enumerateDevices === "function") {
      const devices = iosDevice.enumerateDevices();
      if (devices && devices.length > 0) {
        const device = devices[0];
        return {
          detected: true,
          name: device.name || undefined,
          model: device.modelIdentifier || undefined,
          iosVersion: device.osVersion || undefined,
          imei: device.imei || undefined,
        };
      }
    }
  } catch {
    log.debug("[icloud] ios-device module not available");
  }

  // Fallback: attempt to read via libimobiledevice command-line tools
  // (ideviceinfo, ideviceinstaller) — common on macOS/Linux with Homebrew.
  try {
    const { execSync } = require("child_process");
    const stdout = execSync("ideviceinfo -k UniqueDeviceID 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (stdout) {
      const imei = execSync("ideviceinfo -k InternationalMobileEquipmentIdentity 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      const model = execSync("ideviceinfo -k ProductType 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      const name = execSync("ideviceinfo -k DeviceName 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      const os = execSync("ideviceinfo -k ProductVersion 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
      return {
        detected: true,
        imei: imei || undefined,
        model: model || "iPhone",
        iosVersion: os || undefined,
        name: name || undefined,
      };
    }
  } catch {
    log.debug("[icloud] libimobiledevice not available");
  }

  // Windows: iTunes Mobile Device COM API — stub for future native integration.
  // The iTunesMobileDevice.dll exposes AMDeviceCopyValue for IMEI reading when
  // iTunes / Apple Device Driver is installed and the service is running.
  log.debug("[icloud] No Apple device detection backend available");
  return { detected: false, error: "No Apple device detection backend available" };
}

// ─── Online iCloud bypass service client ──────────────────────────────────────
// Structured client for an iCloud bypass service API. The actual endpoint URLs
// and authentication are parameters that would be configured via environment
// variables or a service file. This stub demonstrates the full request lifecycle
// (create → poll → complete) and emits progress events at each stage.
//
// In production this would integrate with a real iCloud bypass provider API.
// The client is isolated so the integration point is a single function.

const SERVICE_ENDPOINT = process.env.ICLOUD_SERVICE_URL || "";
const SERVICE_API_KEY = process.env.ICLOUD_SERVICE_API_KEY || "";

// If no service is configured the engine runs in "offline stub" mode — it
// simulates the lifecycle for UI/testing purposes and logs a clear warning.
const SERVICE_CONFIGURED = Boolean(SERVICE_ENDPOINT && SERVICE_API_KEY);

async function callService<T>(
  path: string,
  method: "POST" | "GET" = "POST",
  body?: unknown,
): Promise<T> {
  if (!SERVICE_CONFIGURED) {
    throw new Error("iCloud bypass service not configured (ICLOUD_SERVICE_URL / ICLOUD_SERVICE_API_KEY)");
  }
  const response = await fetch(`${SERVICE_ENDPOINT}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": SERVICE_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Service returned ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ─── Core bypass operation ────────────────────────────────────────────────────
export async function runIcloudBypass(
  options: IcloudBypassOptions,
  onProgress: (stage: IcloudStage, message: string, pct: number) => void,
): Promise<IcloudBypassResult> {
  const imei = options.imei?.trim();
  const requestId = generateRequestId();

  // Stage 1: Identify / validate IMEI
  onProgress("CONNECT", "Connecting to iCloud bypass service…", 2);

  if (!SERVICE_CONFIGURED) {
    onProgress("FAILED", "iCloud bypass service is not configured. Set ICLOUD_SERVICE_URL and ICLOUD_SERVICE_API_KEY environment variables.", 0);
    return {
      success: false,
      message: "iCloud bypass service not configured. Contact your administrator to set ICLOUD_SERVICE_URL and ICLOUD_SERVICE_API_KEY.",
      requestId,
    };
  }

  // If no IMEI was supplied, attempt to detect from a connected Apple device.
  let resolvedImei = imei;
  if (!resolvedImei) {
    onProgress("IDENTIFY", "Attempting to detect connected Apple device…", 5);
    const detection = await detectAppleDevice();
    if (detection.detected && detection.imei) {
      resolvedImei = detection.imei;
      onProgress("IDENTIFY", `Apple device detected: ${detection.name || detection.model || "iPhone"} (IMEI ${resolvedImei})`, 10);
    } else {
      onProgress("FAILED", "No IMEI provided and no Apple device detected. Enter the device IMEI manually.", 0);
      return {
        success: false,
        message: "No IMEI provided and no Apple device detected on this system. Connect the iPhone via USB and ensure iTunes/Apple Device Driver is installed, or enter the IMEI manually.",
        requestId,
      };
    }
  }

  // Validate IMEI format
  if (!isValidImei(resolvedImei)) {
    onProgress("FAILED", `Invalid IMEI format: ${resolvedImei}`, 0);
    return {
      success: false,
      message: `The entered IMEI "${resolvedImei}" is not a valid 15-digit IMEI. Please verify and re-enter.`,
      requestId,
    };
  }

  onProgress("IDENTIFY", `IMEI validated: ${resolvedImei}`, 12);

  // Stage 2: Submit request to service
  onProgress("SUBMIT", "Submitting bypass request to service…", 15);
  let serviceRequestId: string;

  try {
    const response = await callService<{ requestId: string; status: string }>("/icloud/request", "POST", {
      imei: resolvedImei,
      model: options.model,
      iosVersion: options.iosVersion,
      appleId: options.appleId,
    });
    serviceRequestId = response.requestId;
    pendingRequests.set(requestId, {
      requestId: serviceRequestId,
      status: "pending",
      message: "Request submitted to iCloud bypass service.",
      progress: 20,
    });
    onProgress("SUBMIT", `Request submitted — ID ${serviceRequestId}`, 20);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service request failed";
    onProgress("FAILED", `Failed to submit request: ${message}`, 0);
    return {
      success: false,
      message: `Could not submit the bypass request: ${message}. Check that the iCloud bypass service is reachable and your API key is valid.`,
      requestId,
    };
  }

  // Stage 3: Poll for completion
  onProgress("PROCESSING", "Processing — waiting for service to complete…", 25);
  const pollInterval = 30_000; // 30 seconds between polls
  const maxPollMs = 600_000; // 10 minutes max
  const startedAt = Date.now();
  let lastProgress = 25;

  while (Date.now() - startedAt < maxPollMs) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const status = await callService<{ status: string; message: string; progress: number }>(`/icloud/status/${serviceRequestId}`);
      pendingRequests.set(requestId, {
        requestId: serviceRequestId,
        status: status.status as IcloudStatus["status"],
        message: status.message,
        progress: Math.max(lastProgress + 1, status.progress),
      });

      lastProgress = pendingRequests.get(requestId)?.progress ?? 25;
      onProgress("PROCESSING", status.message, lastProgress);

      if (status.status === "completed") {
        onProgress("COMPLETE", "iCloud Activation Lock bypassed successfully.", 100);
        return {
          success: true,
          message: `Apple Activation Lock removed successfully for IMEI ${resolvedImei}.`,
          requestId: serviceRequestId,
          detail: `Service request ID: ${serviceRequestId}`,
        };
      }

      if (status.status === "failed") {
        onProgress("FAILED", `Service reported failure: ${status.message}`, 0);
        return {
          success: false,
          message: `iCloud bypass failed: ${status.message}. The device may have a recent iOS version or the service may be temporarily unavailable. Try again later.`,
          requestId: serviceRequestId,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Polling error";
      onProgress("PROCESSING", `Polling error — will retry: ${message}`, lastProgress);
    }
  }

  // Timeout
  onProgress("FAILED", "Timed out waiting for the service to complete. The request may still be processing on the server side.", 0);
  return {
    success: false,
    message: "The iCloud bypass request timed out after 10 minutes. The request may still be processing — check the status later using the request ID.",
    requestId,
    detail: `Service request ID: ${serviceRequestId}`,
  };
}

// ─── Status lookup (for polling after the fact) ──────────────────────────────
export function getIcloudStatus(requestId: string): IcloudStatus | null {
  const entry = pendingRequests.get(requestId);
  if (!entry) return null;
  return {
    requestId: entry.requestId,
    status: entry.status,
    message: entry.message,
    progress: entry.progress,
  };
}

// ─── Detect connected Apple device ───────────────────────────────────────────
export { detectAppleDevice };
