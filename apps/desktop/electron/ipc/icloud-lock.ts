// FRPB — IPC handlers for Apple iCloud Activation Lock bypass.
// Consent-gated, follows the EXACT same patterns as device.ts:
//   - beginOperation / endOperation
//   - broadcastOperationEvent / pushOperationLog
//   - activeWindow tracking
//   - typed { success, message } returns

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import {
  runIcloudBypass,
  detectAppleDevice,
  getIcloudStatus,
  type IcloudBypassOptions,
  type IcloudBypassResult,
  type IcloudStatus,
} from "../utils/icloud-engine";
import { isConsentGranted, type ConsentOp } from "../utils/consent-state";

// Reuse the global operation state from device.ts if available,
// otherwise maintain our own (to keep this module self-contained).
let operationRunning = false;
let operationKind: ConsentOp | null = null;
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
      op: operationKind,
      logs: operationLogs,
    });
  } catch {
    /* window gone */
  }
}

function broadcastOperationEvent(
  op: ConsentOp,
  stage: string,
  message: string,
  pct: number,
): void {
  const win = activeWindow;
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
  try {
    win.webContents.send("device:operation:event", { op, stage, message, pct });
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

function beginOperation(op: ConsentOp): void {
  operationRunning = true;
  operationKind = op;
  operationLogs = [];
  broadcastRunState();
}

function endOperation(): void {
  operationRunning = false;
  operationKind = null;
  broadcastRunState();
}

// ─── Handler: device:icloudBypass ────────────────────────────────────────────
export function registerIcloudLockHandlers(): void {
  ipcMain.handle("device:icloudBypass", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;

    const opts = (options ?? {}) as Partial<IcloudBypassOptions>;
    const sanitized: IcloudBypassOptions = {
      imei: typeof opts.imei === "string" ? opts.imei.trim() : undefined,
      appleId: typeof opts.appleId === "string" ? opts.appleId.trim() : undefined,
      model: typeof opts.model === "string" ? opts.model.trim() : undefined,
      iosVersion: typeof opts.iosVersion === "string" ? opts.iosVersion.trim() : undefined,
    };

    // Consent gate — iCloud bypass is a sensitive operation
    if (!isConsentGranted("icloud-bypass")) {
      return {
        success: false,
        message: "Legal disclaimer must be accepted first.",
      };
    }

    beginOperation("icloud-bypass");
    pushOperationLog("START", "Starting iCloud Activation Lock bypass…", 0);

    try {
      const result = await runIcloudBypass(sanitized, (stage, message, pct) => {
        if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
          activeWindow.webContents.send("device:operation:event", {
            op: "icloud-bypass",
            stage,
            message,
            pct,
          });
        }
        pushOperationLog(stage.toUpperCase(), message, pct, stage === "FAILED" ? "error" : stage === "COMPLETE" ? "ok" : "info");
      });

      return {
        success: result.success,
        message: result.message,
        requestId: result.requestId,
        detail: result.detail,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "iCloud bypass failed";
      pushOperationLog("ERROR", msg, null, "error");
      log.error("[icloud] unhandled error:", err);
      return {
        success: false,
        message: msg,
      };
    } finally {
      endOperation();
    }
  });

  // ─── Handler: device:icloudStatus ──────────────────────────────────────────
  ipcMain.handle("device:icloudStatus", async (_event, requestId: string) => {
    const status = getIcloudStatus(requestId);
    if (!status) {
      return {
        requestId,
        status: "not-found" as const,
        message: "Request ID not found or expired.",
        progress: 0,
      };
    }
    return status;
  });

  // ─── Handler: device:icloudDetect ──────────────────────────────────────────
  ipcMain.handle("device:icloudDetect", async () => {
    try {
      const info = await detectAppleDevice();
      return info;
    } catch (err) {
      log.warn("[icloud] Apple device detection failed:", err);
      return {
        detected: false,
        error: err instanceof Error ? err.message : "Detection failed",
      };
    }
  });

}
