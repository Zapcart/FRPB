// FRPB — IPC handlers for Data Recovery.
// Non-destructive: scans and extracts data via ADB. Does NOT require consent gate
// (no data is modified/deleted on the device), but requires an authorized ADB session.
//
// Follows similar patterns as device.ts for operation tracking, but uses a simpler
// flow since there is no destructive operation consent.

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import {
  scanDataRecovery,
  extractDataRecovery,
  type DataRecoveryOptions,
  type DataRecoveryScanResult,
  type DataRecoveryExtractResult,
} from "../utils/data-recovery";

let operationRunning = false;
let operationKind: string | null = null;
let operationLogs: Array<{
  stage: string;
  message: string;
  pct: number | null;
  kind: "info" | "warn" | "error" | "ok";
  ts: string;
  seq: number;
}> = [];
let logSeq = 0;
let activeWindow: BrowserWindow | null = null;

const MAX_OPERATION_LOGS = 500;

function clockNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function broadcastRunState(): void {
  const win = activeWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send("device:operation:status", {
      running: operationRunning,
      op: operationKind as "data-recovery-scan" | "data-recovery-extract" | null,
      logs: operationLogs,
    });
  } catch {
    /* window gone */
  }
}

function pushOperationLog(
  stage: string,
  message: string,
  pct: number | null,
  kind: "info" | "warn" | "error" | "ok" = "info",
): void {
  const next = [
    ...operationLogs,
    { stage, message, pct, kind, ts: clockNow(), seq: ++logSeq },
  ];
  operationLogs = next.length > MAX_OPERATION_LOGS ? next.slice(-MAX_OPERATION_LOGS) : next;
  broadcastRunState();
}

function beginOperation(kind: "data-recovery-scan" | "data-recovery-extract"): void {
  operationRunning = true;
  operationKind = kind;
  operationLogs = [];
  broadcastRunState();
}

function endOperation(): void {
  operationRunning = false;
  operationKind = null;
  broadcastRunState();
}

export function registerDataRecoveryHandlers(): void {
  // ─── Handler: device:dataRecoveryScan ──────────────────────────────────────
  ipcMain.handle("device:dataRecoveryScan", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;

    const opts = (options ?? {}) as Partial<DataRecoveryOptions>;
    const sanitized: DataRecoveryOptions = {
      brand: typeof opts.brand === "string" ? opts.brand.trim() : undefined,
      model: typeof opts.model === "string" ? opts.model.trim() : undefined,
      paths: Array.isArray(opts.paths)
        ? opts.paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
        : undefined,
    };

    beginOperation("data-recovery-scan");
    pushOperationLog("START", "Starting data recovery scan…", 0);

    try {
      const result = await scanDataRecovery(sanitized, (stage, message, pct) => {
        if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
          activeWindow.webContents.send("device:operation:event", {
            op: "data-recovery-scan",
            stage,
            message,
            pct,
          });
        }
        pushOperationLog(stage.toUpperCase(), message, pct, stage === "FAILED" ? "error" : stage === "SCAN_COMPLETE" ? "ok" : "info");
      });

      return {
        success: result.success,
        items: result.items,
        totalSizeBytes: result.totalSizeBytes,
        message: result.message,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Data recovery scan failed";
      pushOperationLog("ERROR", msg, null, "error");
      log.error("[datarecovery] unhandled error:", err);
      return {
        success: false,
        items: [],
        totalSizeBytes: 0,
        message: msg,
      };
    } finally {
      endOperation();
    }
  });

  // ─── Handler: device:dataRecoveryExtract ───────────────────────────────────
  ipcMain.handle(
    "device:dataRecoveryExtract",
    async (event, itemIds: unknown, destPath: string) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) activeWindow = win;

      // Validate itemIds is a string array
      const ids = Array.isArray(itemIds) && itemIds.every((id): id is string => typeof id === "string")
        ? itemIds
        : [];

      if (!ids.length) {
        return {
          success: false,
          message: "No items selected for extraction.",
          extractedCount: 0,
          extractedBytes: 0,
        };
      }

      // Validate destination path
      const cleanDest = typeof destPath === "string" ? destPath.trim() : "";
      if (!cleanDest) {
        return {
          success: false,
          message: "No destination path specified.",
          extractedCount: 0,
          extractedBytes: 0,
        };
      }

      beginOperation("data-recovery-extract");
      pushOperationLog("START", "Starting data extraction…", 0);

      try {
        const result = await extractDataRecovery(ids, cleanDest, (stage, message, pct) => {
          if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
            activeWindow.webContents.send("device:operation:event", {
              op: "data-recovery-extract",
              stage,
              message,
              pct,
            });
          }
          pushOperationLog(stage.toUpperCase(), message, pct, stage === "FAILED" ? "error" : stage === "EXTRACT_COMPLETE" ? "ok" : "info");
        });

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Data extraction failed";
        pushOperationLog("ERROR", msg, null, "error");
        log.error("[datarecovery] unhandled error:", err);
        return {
          success: false,
          message: msg,
          extractedCount: 0,
          extractedBytes: 0,
        };
      } finally {
        endOperation();
      }
    },
  );

  // ─── Handler: device:dataRecoveryList (alias for scan) ────────────────────
  ipcMain.handle("device:dataRecoveryList", async (event, options: unknown) => {
    // Delegates to the same engine call as device:dataRecoveryScan (same shape).
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;

    const opts = (options ?? {}) as Partial<DataRecoveryOptions>;
    const sanitized: DataRecoveryOptions = {
      brand: typeof opts.brand === "string" ? opts.brand.trim() : undefined,
      model: typeof opts.model === "string" ? opts.model.trim() : undefined,
      paths: Array.isArray(opts.paths)
        ? opts.paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
        : undefined,
    };

    beginOperation("data-recovery-scan");
    pushOperationLog("START", "Listing recoverable data…", 0);

    try {
      const result = await scanDataRecovery(sanitized, (stage, message, pct) => {
        if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
          activeWindow.webContents.send("device:operation:event", {
            op: "data-recovery-scan",
            stage,
            message,
            pct,
          });
        }
        pushOperationLog(stage.toUpperCase(), message, pct, stage === "FAILED" ? "error" : stage === "SCAN_COMPLETE" ? "ok" : "info");
      });

      return {
        success: result.success,
        items: result.items,
        totalSizeBytes: result.totalSizeBytes,
        message: result.message,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Data recovery list failed";
      pushOperationLog("ERROR", msg, null, "error");
      log.error("[datarecovery] unhandled error:", err);
      return {
        success: false,
        items: [],
        totalSizeBytes: 0,
        message: msg,
      };
    } finally {
      endOperation();
    }
  });
}
