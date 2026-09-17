// FRPB — IPC: license verification + secure local session cache.
//
// The renderer submits a raw key; main resolves the hardware fingerprint, calls
// POST /api/v1/license/verify, and on success persists an ENCRYPTED license
// session (the profile plus a `verifiedAt` stamp) via safeStorage. That session
// is what keeps the user logged in across launches without re-verifying every
// time — the server round-trip is still authoritative whenever the user
// explicitly activates, and the exact master test key is honoured offline too.
//
// Raw transport details (endpoint URLs, ECONNREFUSED, stack traces) are NEVER
// forwarded to the renderer: every user-facing message is sanitised here so the
// UI can never leak technical API paths such as the verify endpoint.

import { app, ipcMain, safeStorage } from "electron";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { LicenseProfile, VerifyResponse, VerifyStatus } from "@frpb/shared";
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

// ─── Master test key (offline-capable) ───────────────────────────────────────
/**
 * The one master test key accepted in EVERY environment, INCLUDING production —
 * both here (main process) and on the web API (`isMasterTestKey` in
 * apps/web/src/lib/license/test-key.ts). Keeping the string in sync guarantees
 * `FRPB-TEST-1234-5678` activates the packaged desktop build even when the
 * verification server is unreachable.
 */
const MASTER_TEST_KEY = "FRPB-TEST-1234-5678";

/** Trim / upper-case / strip whitespace from a submitted key. */
function normalizeLicenseKey(key: string): string {
  return `${key ?? ""}`.trim().toUpperCase().replace(/\s+/g, "");
}

/** True when the submitted key is the exact master test key. */
export function isMasterTestKey(key: string): boolean {
  const normalized = normalizeLicenseKey(key);
  return normalized.length > 0 && normalized === MASTER_TEST_KEY;
}

/** Synthetic LIFETIME profile minted for the master test key (no DB row). */
function masterTestLicenseProfile(key: string): LicenseProfile {
  return {
    key,
    plan: "LIFETIME",
    planName: "Lifetime Plan",
    expiresAt: null,
    deviceLimit: 5,
    devicesUsed: 1,
    activatedAt: new Date().toISOString(),
  };
}

// ─── Message sanitisation (never leak API paths / transport internals) ───────
const URL_PATTERN = /https?:\/\/[^\s)"']+/gi;
/** Friendly, user-facing copy shown when the verify server is unreachable. */
const OFFLINE_MESSAGE =
  "Offline Mode: Please check your internet connection to verify your license key.";

/**
 * Strip URLs and collapse whitespace so an error banner can never display a raw
 * technical API path (e.g. the /api/v1/license/verify endpoint). Falls back to
 * `fallback` when nothing usable is left.
 */
function sanitizeVerifyMessage(message: string | undefined | null, fallback: string): string {
  if (!message) return fallback;
  const cleaned = message
    .replace(URL_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
  return cleaned.length >= 8 ? cleaned : fallback;
}

// ─── Encrypted license session (local persistence) ───────────────────────────
interface CachedLicenseSession {
  /** The verified license profile. */
  profile: LicenseProfile;
  /** ISO timestamp of the last successful verification. */
  verifiedAt: string;
  /** Where the session came from ("online" | "master-test" | legacy). */
  source: string;
}

/** Record a successful activation as an encrypted on-disk session. */
function writeLicenseSession(profile: LicenseProfile, source: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    log.warn("license session not cached: OS keychain encryption unavailable");
    return;
  }
  try {
    const session: CachedLicenseSession = {
      profile,
      verifiedAt: new Date().toISOString(),
      source,
    };
    fs.writeFileSync(
      path.join(app.getPath("userData"), CACHE_FILE),
      safeStorage.encryptString(JSON.stringify(session)),
    );
    log.info(`license session cached (encrypted, source=${source})`);
  } catch (err) {
    log.warn(`failed to cache license session: ${err}`);
  }
}

/** True when a decoded value looks like a license profile (legacy or current). */
function isLicenseProfile(value: unknown): value is LicenseProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { key?: unknown }).key === "string" &&
    typeof (value as { plan?: unknown }).plan === "string"
  );
}

/**
 * Read the persisted activation session. Handles both the current envelope
 * (`{ profile, verifiedAt, source }`) and the legacy shape where the file held a
 * bare license profile, so an upgrade never logs an existing user out.
 */
export function readLicenseSession(): { profile: LicenseProfile; verifiedAt: string } | null {
  const file = licenseCachePath();
  if (!fs.existsSync(file)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(file))) as unknown;
    if (isLicenseProfile(parsed)) {
      // Legacy bare-profile file — treat it as verified at read time.
      return { profile: parsed, verifiedAt: new Date().toISOString() };
    }
    const session = parsed as Partial<CachedLicenseSession>;
    if (isLicenseProfile(session.profile)) {
      return { profile: session.profile, verifiedAt: session.verifiedAt ?? new Date().toISOString() };
    }
    return null;
  } catch (err) {
    log.warn(`failed to read cached license session: ${err}`);
    return null;
  }
}

export function registerLicenseHandlers(): void {
  ipcMain.handle("license:verify", async (_event, licenseKey: string) => {
    // Last-resort safety net. Everything below is individually guarded, but if
    // anything unexpected throws (including undici body-stream rejections that
    // can surface outside their own try/catch on a separate microtask), the IPC
    // caller must still receive a structured failure instead of an unhandled
    // rejection crashing the main process.
    try {
      const normalizedKey = normalizeLicenseKey(licenseKey);

      // Offline-capable master key: accepted in EVERY environment (including
      // production) WITHOUT a server round-trip, so a packaged build can always
      // be activated for support/testing even with no internet connection.
      if (isMasterTestKey(normalizedKey)) {
        const profile = masterTestLicenseProfile(normalizedKey);
        writeLicenseSession(profile, "master-test");
        log.info("license:verify short-circuited by master test key");
        return {
          httpStatus: 200,
          success: true,
          status: "ACTIVE" as const,
          license: profile,
          isMasterTest: true,
          message: "License activated (master test key)",
        };
      }

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
        // `isTimeout` / `code` are logged above for diagnostics but NEVER
        // surfaced: the renderer only ever sees the friendly offline copy, so a
        // raw API path can never appear in the activation banner.
        return {
          httpStatus: 0,
          success: false,
          status: "SERVER_ERROR" as const,
          message: OFFLINE_MESSAGE,
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
          message: sanitizeVerifyMessage(
            "The verification server closed the connection before sending a complete response. Please try again.",
            OFFLINE_MESSAGE
          ),
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
          message: sanitizeVerifyMessage(
            payload.message,
            "The verification server returned an error. Please try again in a moment."
          ),
        };
      }

      // Persist the verified activation as an ENCRYPTED local session so the
      // user stays logged in on subsequent launches without re-verifying.
      if (
        payload.success &&
        payload.license &&
        isLicenseProfile(payload.license)
      ) {
        writeLicenseSession(payload.license, "online");
      }

      return {
        httpStatus: response.status,
        ...payload,
        // Final guard: whatever the server said, the renderer never receives a
        // raw URL in its message field.
        message: payload.message
          ? sanitizeVerifyMessage(payload.message, "License verified.")
          : payload.message,
      };
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
    // Returns the persisted profile for the "use previous key" hint. Handles the
    // legacy bare-profile file as well as the current session envelope.
    return readLicenseSession()?.profile ?? null;
  });

  // Persisted activation session. The renderer calls this on launch so an
  // already-activated install skips the activation screen entirely (the
  // encrypted session survives restarts, keeping the user logged in).
  ipcMain.handle("license:getSession", () => {
    const session = readLicenseSession();
    if (!session) return null;
    return {
      profile: session.profile,
      verifiedAt: session.verifiedAt,
      active: true,
    };
  });

  // Explicit sign-out: drop the persisted session so the next launch returns to
  // the activation screen. Mirrors the dev reset but scoped to the license file.
  ipcMain.handle("license:clearSession", () => {
    const removed = clearCachedLicenseProfile();
    log.info(`license:clearSession -> removed=${removed}`);
    return { ok: true, removed };
  });
}
