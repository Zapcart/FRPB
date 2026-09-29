// FRPB — IPC handlers for Bootloop/Brick Recovery.
// Consent-gated, follows the EXACT same patterns as device.ts.

import { ipcMain, BrowserWindow } from "electron";
import { log } from "../utils/logger";
import {
  runBootloopRecovery,
  listFirmwarePackages,
  checkFirmwarePackage,
  selectFirmwarePackage,
  type BootloopOptions,
  type BootloopResult,
  type FirmwarePackage,
} from "../utils/bootloop-engine";
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

export function registerBootloopHandlers(): void {
  ipcMain.handle("device:bootloopRecovery", async (event, options: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) activeWindow = win;

    const opts = (options ?? {}) as Partial<BootloopOptions>;
    const sanitized: BootloopOptions = {
      chipset: typeof opts.chipset === "string" ? opts.chipset.trim() : undefined,
      brand: typeof opts.brand === "string" ? opts.brand.trim() : undefined,
      model: typeof opts.model === "string" ? opts.model.trim() : undefined,
      firmwarePath: typeof opts.firmwarePath === "string" ? opts.firmwarePath.trim() : undefined,
      androidVersion: typeof opts.androidVersion === "number" ? opts.androidVersion : undefined,
    };

    // Consent gate — firmware flash is destructive
    if (!isConsentGranted("bootloop-recovery")) {
      return {
        success: false,
        message: "Legal disclaimer must be accepted first.",
      };
    }

    beginOperation("bootloop-recovery");
    pushOperationLog("START", "Starting bootloop/brick recovery…", 0);

    try {
      const result = await runBootloopRecovery(sanitized, (stage, message, pct) => {
        if (activeWindow && !activeWindow.isDestroyed() && !activeWindow.webContents.isDestroyed()) {
          activeWindow.webContents.send("device:operation:event", {
            op: "bootloop-recovery",
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
        rebooted: result.rebooted,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bootloop recovery failed";
      pushOperationLog("ERROR", msg, null, "error");
      log.error("[bootloop] unhandled error:", err);
      return { success: false, message: msg };
    } finally {
      endOperation();
    }
  });

  // ─── Handler: device:listFirmwarePackages ──────────────────────────────────
  ipcMain.handle("device:listFirmwarePackages", async () => {
    return listFirmwarePackages();
  });

  // ─── Handler: device:checkFirmware ──────────────────────────────────────────
  ipcMain.handle("device:checkFirmware", async (_event, packageId: string, options: unknown) => {
    const opts = (options ?? {}) as Partial<BootloopOptions>;
    const packages = listFirmwarePackages();
    const pkg = packages.find((p) => p.id === packageId || p.filename === packageId);
    if (!pkg) {
      return { compatible: false, reason: `Firmware package not found: ${packageId}` };
    }
    return checkFirmwarePackage(pkg, opts.brand, opts.model, opts.chipset);
  });

}
