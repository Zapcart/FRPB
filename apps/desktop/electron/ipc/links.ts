// FRPB — IPC: external link opening.
// Only allow-listed https URLs may be opened in the OS browser. The renderer
// never navigates itself; shell.openExternal is the sole escape hatch.

import { ipcMain, shell } from "electron";

const ALLOWED_ORIGINS = [
  "https://frpb.app",
  "https://developer.samsung.com",
  "https://developer.android.com",
  "https://www.oneplus.com",
  "https://support.mediatek.com",
  "https://www.qualcomm.com",
  "https://support.apple.com",
];

function isAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_ORIGINS.some((origin) => parsed.origin === origin);
  } catch {
    return false;
  }
}

export function registerLinkHandlers(): void {
  ipcMain.handle("links:openExternal", async (_event, url: string) => {
    if (!isAllowed(url)) {
      throw new Error("Blocked: URL is not on the allow-list");
    }
    await shell.openExternal(url);
  });
}
