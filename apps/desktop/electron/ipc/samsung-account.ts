// FRPB — IPC handlers for Samsung Account (Knox / Find My Mobile) lock bypass.
// Consent-gated, follows the EXACT same patterns as device.ts.

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import {
  runSamsungAccountBypass,
  type SamsungAccountOptions,
  type SamsungAccountResult,
} from "../utils/samsung-account";
import { isConsentGranted, type ConsentOp } from "../utils/consent-state";

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

export function registerSamsungAccountHandlers(): void {
  ipcMain.handle("device:samsungAccountBypass", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;

    const opts = (options ?? {}) as Partial<SamsungAccountOptions>;

    // Build minimal required options
    const sanitized: SamsungAccountOptions = {
      brand: opts.brand === "Samsung" ? "Samsung" : "Samsung", // Always Samsung for this handler
      model: typeof opts.model === "string" ? opts.model.trim() : undefined,
      method: opts.method === "find-my-mobile" || opts.method === "oem-service" || opts.method === "adb"
        ? opts.method
        : undefined, // Will default in engine
      androidVersion: typeof opts.androidVersion === "number" ? opts.androidVersion : undefined,
    };

    // Consent gate
    if (!isConsentGranted("samsung-account")) {
      return {
        success: false,
        message: "Legal disclaimer must be accepted first.",
      };
    }

    beginOperation("samsung-account");
    pushOperationLog("START", "Starting Samsung Account lock bypass…", 0);

    try {
      const result = await runSamsungAccountBypass(sanitized, (stage, message, pct) => {
        if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
          activeWindow.webContents.send("device:operation:event", {
            op: "samsung-account",
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
        detail: result.detail,
        accountRemoved: result.accountRemoved,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Samsung account bypass failed";
      pushOperationLog("ERROR", msg, null, "error");
      log.error("[samsung-account] unhandled error:", err);
      return { success: false, message: msg };
    } finally {
      endOperation();
    }
  });

}
