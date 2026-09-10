// FRPB — setup-platform-tools.js
//
// Dev bootstrap for the Android platform-tools (adb.exe). Runs as plain Node
// (no Electron) and populates apps/desktop/bin/platform-tools with Google's
// official Windows build, which is exactly where the main-process ADB wrapper
// looks first in dev (`utils/adb.ts` resolution tier 1) and where
// electron-builder picks it up from for packaging (`extraResources` +
// `files: bin/platform-tools/**`).
//
//   npm run setup:platform-tools          # download if missing (idempotent)
//   npm run setup:platform-tools --force  # re-download even if present
//
// Windows ships a rolling "latest" archive; mac/linux builds are versioned and
// change frequently, so those platforms skip the download and rely on an
// installed adb from $PATH (the runtime wrapper also auto-downloads into the
// per-user appData dir as a fallback).

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

const ARCHIVE_URL =
  "https://dl.google.com/android/repository/platform-tools-latest-windows.zip";

const TOOLS_DIR = path.resolve(__dirname, "..", "bin", "platform-tools");
const ADB_NAME = process.platform === "win32" ? "adb.exe" : "adb";
const TEMP_ZIP = path.join(os.tmpdir(), `frpb-platform-tools-${process.pid}.zip`);

function fail(message) {
  console.error(`[frpb:setup] ERROR: ${message}`);
  process.exit(1);
}

// Plain Node download with redirect following (dl.google.com 302s to a CDN).
function download(url, destFile, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) {
      reject(new Error("too many redirects"));
      return;
    }
    https
      .get(url, { headers: { "User-Agent": "FRPB-Desktop" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain
          download(new URL(res.headers.location, url).toString(), destFile, redirectsLeft - 1).then(
            resolve,
            reject
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        const out = fs.createWriteStream(destFile);
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve()));
        out.on("error", reject);
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function extractZip(zipPath, destDir) {
  // Windows has Expand-Archive built in; mac/linux fall through to PATH adb.
  if (process.platform === "win32") {
    const cmd = [
      "$ErrorActionPreference = 'Stop'",
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ].join("; ");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      throw new Error(`Expand-Archive exited ${result.status}`);
    }
    return;
  }
  // Non-Windows: the archive URL is Windows-only anyway; surface a clear error.
  throw new Error("zip extraction not implemented for this platform");
}

function isInstalled() {
  return fs.existsSync(path.join(TOOLS_DIR, ADB_NAME));
}

async function main() {
  const force = process.argv.includes("--force");

  if (process.platform !== "win32") {
    console.log(
      "[frpb:setup] platform-tools download is Windows-only; using adb from $PATH at runtime."
    );
    return;
  }

  if (!force && isInstalled()) {
    console.log(`[frpb:setup] platform-tools already present at ${TOOLS_DIR} (use --force to refresh)`);
    return;
  }

  console.log(`[frpb:setup] downloading ${ARCHIVE_URL}`);
  try {
    await download(ARCHIVE_URL, TEMP_ZIP);
    console.log(`[frpb:setup] downloaded ${TEMP_ZIP}`);
    fs.mkdirSync(path.dirname(TOOLS_DIR), { recursive: true });
    await extractZip(TEMP_ZIP, path.dirname(TOOLS_DIR));
    if (!isInstalled()) {
      fail(`archive extracted but ${ADB_NAME} missing at ${TOOLS_DIR}`);
    }
    console.log(`[frpb:setup] platform-tools ready at ${TOOLS_DIR}`);
  } catch (err) {
    fail(`${err.message}`);
  } finally {
    fs.rmSync(TEMP_ZIP, { force: true });
  }
}

main().catch((err) => {
  fail(`${err.message}`);
});
