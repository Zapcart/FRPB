// FRPB — IPC: in-app auto-update via electron-updater.
// Checks on launch (silent), downloads delta updates in the background, and
// forwards state events to the renderer which shows the 1-click UpdateModal.

import { app, ipcMain, BrowserWindow } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";
import type { UpdaterStatus } from "../../src/lib/ipc";

let updateAvailable: UpdateInfo | null = null;

autoUpdater.autoDownload = false; // explicit user consent via modal
autoUpdater.autoInstallOnAppQuit = true;

export function registerUpdaterHandlers(): void {
  autoUpdater.on("checking-for-update", () => {
    broadcast({ state: "CHECKING" });
  });

  autoUpdater.on("update-available", (info) => {
    updateAvailable = info;
    broadcast({
      state: "AVAILABLE",
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on("update-not-available", () => {
    broadcast({ state: "UP_TO_DATE" });
  });

  autoUpdater.on("download-progress", (p) => {
    broadcast({
      state: "DOWNLOADING",
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    broadcast({ state: "READY", version: info.version });
  });

  autoUpdater.on("error", (err) => {
    broadcast({ state: "ERROR", message: err.message });
  });

  ipcMain.handle("check-for-updates", async () => {
    // Never check from a dev session: electron-updater needs a packaged
    // build (app-update.yml) and would otherwise throw on a missing file.
    if (!app.isPackaged) {
      broadcast({ state: "UP_TO_DATE" });
      return { started: false, error: "Updates are disabled in development mode." };
    }
    try {
      await autoUpdater.checkForUpdates(); // silent background check
      return { started: true };
    } catch (err) {
      return { started: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("download-update", async () => {
    if (!updateAvailable) return { started: false };
    autoUpdater.downloadUpdate(); // non-blocking; progress streamed above
    return { started: true };
  });

  ipcMain.handle("quit-and-install", async () => {
    // Staged install: quit app, run NSIS/DMG installer, relaunch.
    autoUpdater.quitAndInstall(false, true);
    return { started: true };
  });
}

function broadcast(status: UpdaterStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("updater:status", status);
  }
}

