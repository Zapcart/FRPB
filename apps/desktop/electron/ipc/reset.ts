// FRPB — IPC: developer / test reset utilities.
//
// Removes every client-side trace of a previous activation so the full
// activation flow can be exercised repeatedly without manually deleting the
// Electron AppData folder:
//   - the encrypted license-profile cache (license-metadata.enc),
//   - renderer web storage (localStorage / sessionStorage / IndexedDB),
//   - cookies + service workers,
//   - Chromium's HTTP / shader / code caches.
//
// Safety: the activation gate is ALWAYS server-side (see ipc/license.ts), so
// clearing local state can only force a re-verification — it can never unlock
// or persist access. The handler is registered in every build (so the dev menu
// and the in-app reset control both work), but the automatic on-startup reset
// and the application menu entry are gated to unpackaged development builds.

import { app, ipcMain, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { clearCachedLicenseProfile, licenseCachePath } from "./license";
import { log } from "../utils/logger";

export interface ResetResult {
  ok: boolean;
  /** Human-readable list of the stores that were actually cleared. */
  cleared: string[];
  /** Absolute path of the license cache file (for display/diagnostics). */
  cachePath: string;
  error?: string;
}

/**
 * Clear renderer-side web storage + Chromium caches through the session API.
 * This is the supported, lock-safe path (it works even while the window holds
 * the underlying LevelDB files open).
 */
async function clearRendererStorage(): Promise<string[]> {
  const cleared: string[] = [];
  const ses = session.defaultSession;

  try {
    await ses.clearStorageData({
      storages: [
        "localstorage",
        "indexdb",
        "websql",
        "serviceworkers",
        "cachestorage",
        "cookies",
        "shadercache",
        "filesystem",
      ],
    });
    cleared.push("renderer web storage (localStorage / sessionStorage / IndexedDB)");
  } catch (err) {
    log.warn(`reset: clearStorageData failed: ${err}`);
  }

  try {
    await ses.clearCache();
    cleared.push("HTTP cache");
  } catch (err) {
    log.warn(`reset: clearCache failed: ${err}`);
  }

  return cleared;
}

/**
 * Delete the on-disk appData artifacts. The session API above already empties
 * the data, but removing the directories as well guarantees a clean slate when
 * the reset runs before any window exists (e.g. the on-startup dev reset).
 * Failures are non-fatal: Chromium may hold a lock on Windows, in which case
 * the in-memory clear already covered it.
 */
function clearAppDataArtifacts(): { cleared: string[]; error?: string } {
  const cleared: string[] = [];

  try {
    if (clearCachedLicenseProfile()) {
      cleared.push("encrypted license profile (license-metadata.enc)");
    }
  } catch (err) {
    return { cleared, error: `license cache: ${String(err)}` };
  }

  // Chromium stores its renderer profile in these userData subfolders.
  for (const dir of [
    "Local Storage",
    "Session Storage",
    "IndexedDB",
    "Cache",
    "Code Cache",
    "Service Worker",
  ]) {
    const target = path.join(app.getPath("userData"), dir);
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
        cleared.push(`${dir}/`);
      }
    } catch (err) {
      log.warn(`reset: could not remove ${dir}/ (locked?): ${err}`);
    }
  }

  return { cleared };
}

/** Clear all persisted activation state. Never throws — returns a result. */
export async function performReset(): Promise<ResetResult> {
  const cachePath = licenseCachePath();
  try {
    const cleared = [...(await clearRendererStorage())];
    const { cleared: fileCleared, error } = clearAppDataArtifacts();
    cleared.push(...fileCleared);

    log.info(`reset complete; cleared: ${cleared.length ? cleared.join(", ") : "(nothing)"}`);
    return { ok: true, cleared, cachePath, error };
  } catch (err) {
    log.error(`reset failed: ${err}`);
    return { ok: false, cleared: [], cachePath, error: String(err) };
  }
}

export function registerResetHandlers(): void {
  // Clears storage + cache and reports what was removed. The renderer then
  // drops its in-memory profile, returning to the activation view; the next
  // verify() is always a fresh server round-trip.
  ipcMain.handle("app:reset", () => performReset());

  // Diagnostics: where the activation state lives on this machine.
  ipcMain.handle("app:cacheInfo", () => ({ cachePath: licenseCachePath() }));
}
