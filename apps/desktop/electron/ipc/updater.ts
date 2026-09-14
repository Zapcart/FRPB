// FRPB — IPC: in-app auto-update via electron-updater.
// Checks on launch (silent), downloads delta updates in the background, and
// forwards state events to the renderer which shows the 1-click UpdateModal.
//
// IMPORTANT — ASAR / packaging safety:
// `electron-updater` and its transitive runtime deps (notably `lazy-val`) are
// shipped unpacked from the asar (see `build.asarUnpack` in package.json).
// This module therefore loads the package *lazily and defensively* via a
// guarded require: a missing/unresolvable module degrades to "updates
// unavailable" instead of throwing an uncaught exception while the main
// process is still evaluating modules — which would prevent the app from ever
// booting (no window, no recovery).

import { app, ipcMain, BrowserWindow } from "electron";
import type { UpdateInfo } from "electron-updater";
import type { UpdaterStatus } from "../../src/lib/ipc";

type ElectronUpdaterModule = typeof import("electron-updater");
type AutoUpdater = ElectronUpdaterModule["autoUpdater"];

let autoUpdater: AutoUpdater | null = null;
let updaterLoadError: string | null = null;
let updateAvailable: UpdateInfo | null = null;

// Resolve electron-updater exactly once, swallowing any resolution failure.
// The failed reason is retained so the renderer can surface a useful message.
function loadAutoUpdater(): AutoUpdater | null {
  if (autoUpdater) return autoUpdater;
  if (updaterLoadError) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("electron-updater") as ElectronUpdaterModule;
    const instance = mod.autoUpdater;
    if (!instance) {
      throw new Error("electron-updater did not export autoUpdater");
    }
    // Update policy: DISCOVER automatically, DOWNLOAD on explicit consent.
    // Requirement: "autoUpdater.autoDownload = true (or controlled via user
    // trigger)". We deliberately choose the user-trigger variant: a silent
    // launch check surfaces AVAILABLE (version + release notes) to the renderer,
    // and the header badge / modal expose a "Download now" action that calls
    // `downloadUpdate()`. This avoids pulling tens of MB on metered connections
    // before the user has seen what the update contains. Once downloaded,
    // `autoInstallOnAppQuit` applies the staged update on next quit even if the
    // user dismisses the "Restart & install" prompt.
    instance.autoDownload = false; // download triggered by user via modal/badge
    instance.autoInstallOnAppQuit = true;
    autoUpdater = instance;
    updaterLoadError = null;
    return instance;
  } catch (err) {
    updaterLoadError = (err as Error)?.message ?? String(err);
    autoUpdater = null;
    return null;
  }
}

export function registerUpdaterHandlers(): void {
  const updater = loadAutoUpdater();

  if (updater) {
    updater.on("checking-for-update", () => {
      broadcast({ state: "CHECKING" });
    });

    updater.on("update-available", (info: UpdateInfo) => {
      updateAvailable = info;
      broadcast({
        state: "AVAILABLE",
        version: info.version,
        releaseNotes:
          typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
      });
    });

    updater.on("update-not-available", () => {
      broadcast({ state: "UP_TO_DATE" });
    });

    updater.on("download-progress", (p) => {
      broadcast({
        state: "DOWNLOADING",
        percent: p.percent,
        transferred: p.transferred,
        total: p.total,
      });
    });

    updater.on("update-downloaded", (info: UpdateInfo) => {
      broadcast({ state: "READY", version: info.version });
    });

    updater.on("error", (err: Error) => {
      broadcast({ state: "ERROR", message: err.message });
    });
  }

  // Always register the IPC handlers — even when the updater is unavailable —
  // so the renderer never hits "No handler registered" and gets a clear,
  // non-fatal status instead.
  function unavailable(): { started: boolean; error: string } {
    const error = updaterLoadError
      ? `Auto-update is unavailable: ${updaterLoadError}`
      : "Auto-update is unavailable in this build.";
    broadcast({ state: "ERROR", message: error });
    return { started: false, error };
  }

  ipcMain.handle("check-for-updates", async () => {
    // Never check from a dev session: electron-updater needs a packaged
    // build (app-update.yml) and would otherwise throw on a missing file.
    if (!app.isPackaged) {
      broadcast({ state: "UP_TO_DATE" });
      return { started: false, error: "Updates are disabled in development mode." };
    }
    const up = loadAutoUpdater();
    if (!up) return unavailable();
    try {
      await up.checkForUpdates(); // silent background check
      return { started: true };
    } catch (err) {
      return { started: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("download-update", async () => {
    const up = loadAutoUpdater();
    if (!up || !updateAvailable) return { started: false };
    up.downloadUpdate(); // non-blocking; progress streamed above
    return { started: true };
  });

  ipcMain.handle("quit-and-install", async () => {
    const up = loadAutoUpdater();
    if (!up) return { started: false };
    // Staged install: quit app, run NSIS/DMG installer, relaunch.
    up.quitAndInstall(false, true);
    return { started: true };
  });
}

// Boot-time background check. Fully guarded so a packaging/resolution failure
// can never throw during main-process evaluation — it simply skips the check.
export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged) return;
  const up = loadAutoUpdater();
  if (!up) return;
  up.checkForUpdates().catch(() => {
    /* non-fatal: no network or no update channel configured */
  });
}

function broadcast(status: UpdaterStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("updater:status", status);
  }
}
