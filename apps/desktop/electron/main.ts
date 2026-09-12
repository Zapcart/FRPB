// FRPB — Electron main process entry.
// Registers all IPC handlers, creates the BrowserWindow, and enforces
// a locked-down renderer (contextIsolation + no nodeIntegration + sandbox).

import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { registerLicenseHandlers } from "./ipc/license";
import { registerDeviceHandlers } from "./ipc/device";
import { registerLinkHandlers } from "./ipc/links";
import { registerUpdaterHandlers, checkForUpdatesOnLaunch } from "./ipc/updater";
import { performReset, registerResetHandlers } from "./ipc/reset";
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

/**
 * Development-only application menu exposing a "Reset activation data" action.
 * Wipes the encrypted license cache + renderer storage and reloads back to the
 * activation screen, so the full first-run flow can be re-tested without
 * touching the AppData folder by hand. Never attached to packaged builds.
 */
function installDevMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "FRPB Dev",
        submenu: [
          {
            label: "Reset activation data (license + storage)",
            accelerator: "CmdOrCtrl+Shift+R",
            click: async () => {
              const result = await performReset();
              log.info(`dev menu reset -> ${JSON.stringify(result)}`);
              mainWindow?.webContents.reloadIgnoringCache();
            },
          },
          {
            label: "Open DevTools",
            accelerator: "CmdOrCtrl+Shift+I",
            click: () => mainWindow?.webContents.openDevTools({ mode: "detach" }),
          },
          { type: "separator" },
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
    ])
  );
}

/**
 * Opt-in clean-slate reset for development builds. Set FRPB_RESET_ON_START=1
 * (e.g. `set FRPB_RESET_ON_START=1 && npm run dev`) to guarantee the app boots
 * on the activation screen with no cached key. Never runs in packaged builds
 * and always disabled by default so a normal dev session stays fast.
 */
async function resetOnStartIfRequested(): Promise<void> {
  if (app.isPackaged || process.env.FRPB_RESET_ON_START !== "1") return;
  const result = await performReset();
  log.info(`FRPB_RESET_ON_START reset -> ${JSON.stringify(result)}`);
}

app.whenReady().then(async () => {
  // Warm the hardware fingerprint early so first verify is fast and stable.
  getHardwareId().catch((err) => log.warn(`hardwareId init failed: ${err}`));

  // Register all IPC handlers before window creation
  registerLicenseHandlers();
  registerDeviceHandlers();
  registerLinkHandlers();
  registerUpdaterHandlers();
  registerResetHandlers();

  // Dev-only clean-slate boot (opt-in via FRPB_RESET_ON_START=1).
  await resetOnStartIfRequested();

  createWindow();

  // Dev-only menu with the manual "reset activation data" action.
  if (!app.isPackaged) installDevMenu();

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
