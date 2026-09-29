// FRPB — Data Recovery engine.
// Recovers data from connected Android devices via ADB. Supports:
//   1. Pulling internal storage media (DCIM, Pictures, Videos, Audio)
//   2. Extracting Android SQLite databases (contacts, call logs, SMS)
//   3. Scanning for recoverable deleted files (stub — structured for real tool integration)
//
// This is a NON-DESTRUCTIVE operation — it reads data from the device and copies
// it to the local machine. No data is modified or deleted on the device.
//
// Requires an authorized ADB session (USB debugging enabled on the device).

import { log } from "./logger";
import path from "node:path";
import fs from "node:fs";

// ─── Stages emitted on the progress callback ─────────────────────────────────
export type DataRecoveryStage =
  | "CONNECT"
  | "SCAN_START"
  | "SCAN_PROGRESS"
  | "SCAN_COMPLETE"
  | "EXTRACT_START"
  | "EXTRACT_PROGRESS"
  | "EXTRACT_COMPLETE"
  | "FAILED";

export interface DataRecoveryProgress {
  stage: DataRecoveryStage;
  message: string;
  pct: number;
}

// ─── Options from renderer ───────────────────────────────────────────────────
export interface DataRecoveryOptions {
  brand?: string;
  model?: string;
  /** Specific paths to scan on the device. If omitted, scans common media locations. */
  paths?: string[];
}

export interface DataRecoveryItem {
  id: string;
  name: string;
  category: "photo" | "video" | "contact" | "call-log" | "sms" | "document" | "other";
  sourcePath: string;
  sizeBytes: number;
  recoverable: boolean;
  localPath?: string;
}

export interface DataRecoveryScanResult {
  success: boolean;
  items: DataRecoveryItem[];
  totalSizeBytes: number;
  message: string;
}

export interface DataRecoveryExtractResult {
  success: boolean;
  message: string;
  extractedCount: number;
  extractedBytes: number;
  details?: string;
}

// ─── Common Android directory paths to scan ───────────────────────────────────
const DEFAULT_SCAN_PATHS = [
  "/sdcard/DCIM/Camera",
  "/sdcard/DCIM",
  "/sdcard/Pictures",
  "/sdcard/Movies",
  "/sdcard/Videos",
  "/sdcard/Music",
  "/sdcard/Audio",
  "/sdcard/Download",
  "/sdcard/Documents",
];

// ─── File category detection ──────────────────────────────────────────────────
function categorizeFile(name: string, ext: string): DataRecoveryItem["category"] {
  const lower = ext.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif", "svg"].includes(lower))
    return "photo";
  if (["mp4", "mkv", "avi", "mov", "webm", "3gp", "wmv", "flv"].includes(lower))
    return "video";
  if (["mp3", "wav", "aac", "flac", "ogg", "m4a", "wma"].includes(lower))
    return "other"; // audio — we treat as "other" or could add "audio"
  if (["db", "sqlite", "sqlite3"].includes(lower)) return "other";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(lower))
    return "document";
  return "other";
}

function detectItemFromPath(devicePath: string, fileName: string): DataRecoveryItem {
  // Try to get file size via ADB
  let sizeBytes = 0;
  try {
    // Get the file size via a quick `adb shell ls -l` stat below.
    try {
      const { execSync } = require("child_process");
      const adbPath = require("./adb").resolvePlatformToolPath("adb");
      if (adbPath) {
        const output = execSync(`"${adbPath}" shell "ls -l '${devicePath}/${fileName}'" 2>/dev/null`, {
          encoding: "utf8",
          timeout: 10000,
        }).trim();
        const parts = output.split(/\s+/);
        if (parts.length >= 5) {
          sizeBytes = parseInt(parts[4], 10) || 0;
        }
      }
    } catch {
      // File size unavailable — proceed with 0
    }
  } catch {
    // Size unavailable
  }

  return {
    id: `${devicePath}/${fileName}`,
    name: fileName,
    category: categorizeFile(fileName, path.extname(fileName).slice(1)),
    sourcePath: `${devicePath}/${fileName}`,
    sizeBytes,
    recoverable: true, // All accessible files are "recoverable" by pulling
  };
}

// ─── Scan device for recoverable data ────────────────────────────────────────
export async function scanDataRecovery(
  options: DataRecoveryOptions,
  onProgress: (stage: DataRecoveryStage, message: string, pct: number) => void,
): Promise<DataRecoveryScanResult> {
  const scanPaths = options.paths?.length ? options.paths : DEFAULT_SCAN_PATHS;
  const items: DataRecoveryItem[] = [];
  let totalSizeBytes = 0;

  onProgress("CONNECT", "Connecting to device for data scan…", 2);

  // Verify ADB connection
  try {
    const { adbDevices } = require("./adb");
    const devices = await adbDevices();
    if (!devices?.length || devices[0].state !== "device") {
      onProgress("FAILED", "No authorized ADB device connected. Enable USB debugging on the device.", 0);
      return {
        success: false,
        items: [],
        totalSizeBytes: 0,
        message: "No authorized ADB device connected. Please enable USB debugging on the device and reconnect.",
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "ADB connection failed";
    onProgress("FAILED", `ADB connection failed: ${message}`, 0);
    return {
      success: false,
      items: [],
      totalSizeBytes: 0,
      message: `Could not connect to the device: ${message}`,
    };
  }

  onProgress("SCAN_START", `Scanning ${scanPaths.length} directories for recoverable data…`, 5);

  // Scan each path
  for (let i = 0; i < scanPaths.length; i++) {
    const devicePath = scanPaths[i] ?? "";
    onProgress("SCAN_PROGRESS", `Scanning: ${devicePath}`, 5 + Math.floor((i / scanPaths.length) * 60));

    try {
      const { execSync } = require("child_process");
      const { resolvePlatformToolPath } = require("./adb");
      const adbPath = await resolvePlatformToolPath("adb");

      if (!adbPath) {
        onProgress("SCAN_PROGRESS", `ADB not found — skipping ${devicePath}`, 5 + Math.floor((i / scanPaths.length) * 60));
        continue;
      }

      // List files in the directory
      const listOutput = execSync(
        `"${adbPath}" shell "ls -1 '${devicePath}' 2>/dev/null"`,
        { encoding: "utf8", timeout: 15000 },
      ).trim();

      if (!listOutput) continue;

      const files = listOutput.split("\n").filter((f: string) => f && !f.startsWith("total"));
      for (const fileName of files) {
        if (!fileName || fileName.startsWith(".") || fileName === "..") continue;
        try {
          const item = detectItemFromPath(devicePath, fileName);
          items.push(item);
          totalSizeBytes += item.sizeBytes;
        } catch {
          // Skip files we can't analyze
        }
      }
    } catch {
      // Directory not accessible — skip
      log.debug(`[datarecovery] Cannot scan ${devicePath}`);
    }
  }

  // Also scan for Android databases (contacts, call logs, SMS)
  // These require root or special permissions on most devices
  const dbPaths = [
    "/data/data/com.android.contacts/databases/contacts2.db",
    "/data/data/com.android.providers.telephony/databases/mmssms.db",
    "/data/data/com.android.providers.contacts/databases/contacts2.db",
  ];

  onProgress("SCAN_PROGRESS", "Checking for recoverable database files…", 75);

  for (const dbPath of dbPaths) {
    try {
      const { execSync } = require("child_process");
      const { resolvePlatformToolPath } = require("./adb");
      const adbPath = await resolvePlatformToolPath("adb");

      if (!adbPath) continue;

      // Check if file exists (requires root on non-rooted devices — will fail)
      execSync(`"${adbPath}" shell "ls '${dbPath}'" 2>/dev/null`, { encoding: "utf8", timeout: 5000 });
      // If we get here, the file exists and is accessible
      items.push({
        id: dbPath,
        name: path.basename(dbPath),
        category: dbPath.includes("sms") ? "sms" : dbPath.includes("call") ? "call-log" : "contact",
        sourcePath: dbPath,
        sizeBytes: 0,
        recoverable: true,
      });
    } catch {
      // Database not accessible (needs root) — skip
    }
  }

  onProgress("SCAN_COMPLETE", `Scan complete — found ${items.length} recoverable items (${formatBytes(totalSizeBytes)})`, 100);

  return {
    success: true,
    items,
    totalSizeBytes,
    message: `Found ${items.length} recoverable items (${formatBytes(totalSizeBytes)} total). Select items and choose an extraction destination.`,
  };
}

// ─── Extract selected items to local disk ─────────────────────────────────────
export async function extractDataRecovery(
  itemIds: string[],
  destPath: string,
  onProgress: (stage: DataRecoveryStage, message: string, pct: number) => void,
): Promise<DataRecoveryExtractResult> {
  if (!itemIds.length) {
    return {
      success: false,
      message: "No items selected for extraction.",
      extractedCount: 0,
      extractedBytes: 0,
    };
  }

  // Ensure destination directory exists
  try {
    fs.mkdirSync(destPath, { recursive: true });
  } catch {
    return {
      success: false,
      message: `Cannot create destination directory: ${destPath}`,
      extractedCount: 0,
      extractedBytes: 0,
    };
  }

  onProgress("EXTRACT_START", `Extracting ${itemIds.length} items to ${destPath}…`, 5);

  let extractedCount = 0;
  let extractedBytes = 0;
  const details: string[] = [];

  try {
    const { execSync } = require("child_process");
    const { resolvePlatformToolPath } = require("./adb");
    const adbPath = await resolvePlatformToolPath("adb");

    if (!adbPath) {
      return {
        success: false,
        message: "ADB tools not found. Install the Android platform tools.",
        extractedCount: 0,
        extractedBytes: 0,
      };
    }

    for (let i = 0; i < itemIds.length; i++) {
      const sourcePath = itemIds[i] ?? "";
      const fileName = path.basename(sourcePath);
      const localFile = path.join(destPath, fileName);

      // Handle duplicate names
      let targetPath = localFile;
      let counter = 1;
      while (fs.existsSync(targetPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        targetPath = path.join(destPath, `${base}_${counter}${ext}`);
        counter++;
      }

      onProgress("EXTRACT_PROGRESS", `Pulling: ${fileName} (${i + 1}/${itemIds.length})`, 5 + Math.floor(((i + 1) / itemIds.length) * 85));

      try {
        // Use adb pull
        execSync(`"${adbPath}" pull '${sourcePath}' '${targetPath}'`, {
          encoding: "utf8",
          timeout: 60000, // 60s per file max
        });

        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          extractedCount++;
          extractedBytes += stat.size;
          details.push(`✓ ${fileName} → ${targetPath} (${formatBytes(stat.size)})`);
        } else {
          details.push(`✗ ${fileName} — file not found after pull`);
        }
      } catch (pullErr) {
        const errMsg = pullErr instanceof Error ? pullErr.message : "pull failed";
        details.push(`✗ ${fileName} — ${errMsg}`);
        log.warn(`[datarecovery] Failed to pull ${sourcePath}: ${errMsg}`);
      }
    }

    onProgress("EXTRACT_COMPLETE", `Extraction complete — ${extractedCount} files, ${formatBytes(extractedBytes)}`, 100);

    return {
      success: extractedCount > 0,
      message: extractedCount > 0
        ? `Successfully extracted ${extractedCount} files (${formatBytes(extractedBytes)}) to ${destPath}.`
        : "No files were successfully extracted. Check that the device is connected and the selected paths are accessible.",
      extractedCount,
      extractedBytes,
      details: details.length > 0 ? details.join("\n") : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    onProgress("FAILED", `Extraction failed: ${message}`, 0);
    return {
      success: false,
      message: `Data extraction failed: ${message}`,
      extractedCount,
      extractedBytes,
      details: details.join("\n"),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ─── List recoverable items without scanning (stub for future use) ────────────
export async function listDataRecoveryItems(
  options: DataRecoveryOptions,
  onProgress: (stage: DataRecoveryStage, message: string, pct: number) => void,
): Promise<DataRecoveryScanResult> {
  return scanDataRecovery(options, onProgress);
}
