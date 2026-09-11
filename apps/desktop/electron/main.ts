// FRPB — Electron main process entry.
// Registers all IPC handlers, creates the BrowserWindow, and enforces
// a locked-down renderer (contextIsolation + no nodeIntegration + sandbox).

import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { registerLicenseHandlers } from "./ipc/license";
import { registerDeviceHandlers } from "./ipc/device";
import { registerLinkHandlers } from "./ipc/links";
import { registerUpdaterHandlers, checkForUpdatesOnLaunch } from "./ipc/updater";
import { getHardwareId } from "./utils/hardwareId";
import { log } from "./utils/logger";

// Never let a stray promise rejection crash the main process. undici/fetch
// body-stream errors can reject on a separate microtask outside any caller
// try/catch; log them so they are traceable instead of terminating the app.
process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection in main process:", reason);
});

let mainWindow: BrowserWindow | null = null;

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: "FRPB — Device Recovery",
    autoHideMenuBar: true,
    backgroundColor: "#020617", // slate-950, matches renderer theme
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // required: renderer never touches Node
      nodeIntegration: false, // required: only IPC bridge exposed
      sandbox: true,
      webSecurity: true,
    },
  });

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open external links (OEM driver pages) in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Only allow HTTPS external URLs for driver/official pages.
function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

app.whenReady().then(async () => {
  // Warm the hardware fingerprint early so first verify is fast and stable.
  getHardwareId().catch((err) => log.warn(`hardwareId init failed: ${err}`));

  // Register all IPC handlers before window creation
  registerLicenseHandlers();
  registerDeviceHandlers();
  registerLinkHandlers();
  registerUpdaterHandlers();

  createWindow();

  // Background auto-update check on every launch (silent, non-blocking).
  // Fully guarded: electron-updater is required lazily inside the helper, so a
  // packaging/resolution failure degrades to "updates unavailable" rather than
  // throwing an uncaught exception during boot. Only runs for packaged builds
  // (dev has no app-update.yml and would otherwise throw every `pnpm dev:all`).
  checkForUpdatesOnLaunch();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Disallow navigation to remote content (desktop app must not become a browser)
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, url) => {
    const allowed =
      url.startsWith("file://") ||
      (DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : false);
    if (!allowed) event.preventDefault();
  });
});
