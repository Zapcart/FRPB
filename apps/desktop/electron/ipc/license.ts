// FRPB — IPC: license verification + secure local cache.
// The renderer submits a raw key; main resolves the hardware fingerprint,
// calls POST /api/v1/license/verify, and (on success) stores an encrypted
// license profile via safeStorage for a "last activated on" hint. The gate
// is ALWAYS server-side — the cache is never used to unlock the UI.

import { app, ipcMain, safeStorage } from "electron";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { VerifyResponse, VerifyStatus } from "@frpb/shared";
import { getHardwareId } from "../utils/hardwareId";
import { log } from "../utils/logger";

// Verification endpoint resolution. Priority:
//   1. FRPB_VERIFY_URL env override (explicit, works for dev + prod).
//   2. VITE_API_URL env override — the canonical name Vite injects into the
//      renderer, so a single .env var points both sides at the same origin.
//   3. VITE_API_BASE_URL — legacy alias kept for backward compatibility.
//   4. Unpackaged (dev) builds -> local Next.js API on :3000.
//   5. Packaged builds -> hosted FRPB API (https://frpb.in).
//
// In production builds with no VITE_API_URL defined this resolves to
// https://frpb.in/api/v1/license/verify.
const VERIFY_ENDPOINT = ((): string => {
  const override =
    process.env.FRPB_VERIFY_URL ??
    process.env.VITE_API_URL ??
    process.env.VITE_API_BASE_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  const base = override || (!app.isPackaged ? "http://localhost:3000" : "https://frpb.in");
  return `${base.replace(/\/+$/, "")}/api/v1/license/verify`;
})();
const CACHE_FILE = "license-metadata.enc";

/** Absolute path of the encrypted license-profile cache (for reset/diagnostics). */
export function licenseCachePath(): string {
  return path.join(app.getPath("userData"), CACHE_FILE);
}

/**
 * Delete the encrypted license-profile cache. Returns true when a file was
 * actually removed. Used by the dev/test reset flow (see ipc/reset.ts); safe to
 * call when no cache exists.
 */
export function clearCachedLicenseProfile(): boolean {
  const file = licenseCachePath();
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

export function registerLicenseHandlers(): void {
  ipcMain.handle("license:verify", async (_event, licenseKey: string) => {
    // Last-resort safety net. Everything below is individually guarded, but if
    // anything unexpected throws (including undici body-stream rejections that
    // can surface outside their own try/catch on a separate microtask), the IPC
    // caller must still receive a structured failure instead of an unhandled
    // rejection crashing the main process.
    try {
      const hardwareId = await getHardwareId();

      log.info(`license:verify request -> ${VERIFY_ENDPOINT}`);
      let response: Response;
      try {
        response = await fetch(VERIFY_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": `frpb-desktop/${app.getVersion()}`,
          },
          body: JSON.stringify({
            licenseKey,
            hardwareId,
            deviceName: os.hostname(),
            os: process.platform,
            appVersion: app.getVersion(),
          }),
          // Online-only: hard 10s timeout, no offline fallback.
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        // The web API is unreachable (e.g. apps/web not running in dev, or no
        // network in prod). Return a STRUCTURED failure instead of letting the
        // TypeError bubble across IPC into the renderer, and distinguish a
        // timeout from a refused connection so the message is actionable.
        const isTimeout =
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError");
        const code =
          (err as { cause?: { code?: string } })?.cause?.code ??
          (err as { code?: string })?.code;
        log.error(
          `license:verify network failure (${VERIFY_ENDPOINT}) ` +
            `[${isTimeout ? "TIMEOUT" : code ?? "FETCH_FAILED"}]:`,
          err
        );
        return {
          httpStatus: 0,
          success: false,
          status: "SERVER_ERROR" as const,
          message: isTimeout
            ? `The verification server at ${VERIFY_ENDPOINT} did not respond within 10 seconds. Check your connection and try again.`
            : code === "ECONNREFUSED"
              ? `No verification server is listening at ${VERIFY_ENDPOINT}. Start the local FRPB web server (dev) or check your connection.`
              : `Unable to reach the verification server at ${VERIFY_ENDPOINT}. Check your internet connection and try again.`,
        };
      }

      // Read the body as plain text FIRST. Calling response.json() delegates to
      // undici internals, and when the stream is aborted/reset mid-read its
      // internal JSON.parse rejection can escape this handler's try/catch on a
      // separate microtask. Reading text() + parsing manually keeps the parse in
      // our own synchronous context so every failure path is catchable here.
      let bodyText: string;
      try {
        bodyText = await response.text();
      } catch (err) {
        log.error(`license:verify body read failure (${response.status}):`, err);
        return {
          httpStatus: response.status,
          success: false,
          status: "SERVER_ERROR" as const,
          message:
            "The verification server closed the connection before sending a complete response. Please try again.",
        };
      }

      // The server responded but the body was not valid JSON (e.g. a proxy/HTML
      // error page) — surface a structured failure rather than throwing.
      let payload: {
        success: boolean;
        status?: VerifyStatus;
        license?: unknown;
        message?: string;
      };
      try {
        payload = JSON.parse(bodyText) as typeof payload;
      } catch (err) {
        // Include a body preview so a recurring mismatch is diagnosable from
        // the Electron logs alone (status + first bytes of what was received).
        log.error(
          `license:verify non-JSON response (${response.status}):`,
          err,
          `body preview: ${JSON.stringify(bodyText.slice(0, 300))}`
        );
        return {
          httpStatus: response.status,
          success: false,
          status: "SERVER_ERROR" as const,
          message: "The verification server returned an unexpected response. Please try again.",
        };
      }

      // Any non-2xx status (INVALID_KEY, RATE_LIMITED, etc.) is still forwarded
      // with its original status so the renderer can show the right message.
      if (!response.ok && !payload.success) {
        log.warn(
          `license:verify server error (${response.status}): ${payload.message ?? "no message"}`
        );
        return {
          httpStatus: response.status,
          success: false,
          status: (payload.status as VerifyStatus) ?? "SERVER_ERROR",
          message:
            payload.message ??
            "The verification server returned an error. Please try again in a moment.",
        };
      }

      // Encrypt license profile with the OS keychain before writing to disk.
      if (payload.success && payload.license && safeStorage.isEncryptionAvailable()) {
        try {
          const encrypted = safeStorage.encryptString(JSON.stringify(payload.license));
          fs.writeFileSync(path.join(app.getPath("userData"), CACHE_FILE), encrypted);
          log.info("license profile cached (encrypted)");
        } catch (err) {
          log.warn(`failed to cache license profile: ${err}`);
        }
      }

      return { httpStatus: response.status, ...payload };
    } catch (err) {
      log.error("license:verify unexpected failure:", err);
      return {
        httpStatus: 0,
        success: false,
        status: "SERVER_ERROR" as const,
        message: "Verification failed unexpectedly. Please try again in a moment.",
      };
    }
  });

  ipcMain.handle("license:getCachedProfile", () => {
    // Only used to render a "last activated on" hint; the gate is ALWAYS server-side.
    const file = path.join(app.getPath("userData"), CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    try {
      const buf = fs.readFileSync(file);
      return safeStorage.isEncryptionAvailable()
        ? JSON.parse(safeStorage.decryptString(buf))
        : null;
    } catch (err) {
      log.warn(`failed to read cached license profile: ${err}`);
      return null;
    }
  });
}
