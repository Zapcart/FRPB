// FRPB — utils/adb.ts
// Thin, brand-agnostic wrapper around the official Android platform-tools ADB
// binary. Every command is spawned with an explicit args array (never shell
// string concatenation — user input is never interpolated into a command line),
// captured with a hard timeout, and reported back as a structured result so
// callers can react to success / failure / timeout / missing binary.
//
// Binary resolution (first match wins):
//   packaged → <resourcesPath>/platform-tools/<adb|fastboot>[.exe]   (extraResources)
//              <resourcesPath>/bin/platform-tools/<...>              (legacy layout)
//              <resourcesPath>/app.asar.unpacked/bin/platform-tools/<...>
//   dev      → apps/desktop/bin/platform-tools/<...>                 (`setup:platform-tools`)
//              apps/desktop/resources/platform-tools/<...>
//              <repo>/bin/platform-tools/<...>
//   all      → <userData>/platform-tools/<...>                       (auto-fetched copy)
//   otherwise→ absolute path resolved from $PATH (never a bare-name spawn)
//
// If every tier is empty, `ensurePlatformTools()` downloads Google's official
// platform-tools archive into <userData>/platform-tools and re-resolves — the
// "ADB tools not installed" failure only surfaces after a genuine network
// failure, never because the binary is simply missing from disk.

import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { app, net } from "electron";
import { log } from "./logger";

// `exec` runs a fixed, developer-controlled command string only — device
// serials/models are passed as discrete argv tokens via the spawn path, never
// interpolated into this shell string, so there is no command-injection
// surface. `exec` is used as the fallback transport (and for shell operators
// like `recovery --wipe_data`) when a direct spawn is unavailable.
const execAsync = promisify(exec) as unknown as (
  command: string,
  options: { timeout?: number; windowsHide?: boolean; maxBuffer?: number }
) => Promise<{ stdout: string; stderr: string }>;

const ADB_TIMEOUT_MS = 60_000;

// Official Google repository. Windows ships a rolling "latest" archive; the
// mac/linux builds are versioned and change frequently, so the automatic
// bootstrap targets Windows (adb.exe) and mac/linux fall back to PATH.
const PLATFORM_TOOLS_ARCHIVE: Partial<Record<NodeJS.Platform, string>> = {
  win32: "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
};

// ─── Binary resolution ───────────────────────────────────────────────────────

function platformToolName(base: "adb" | "fastboot"): string {
  return process.platform === "win32" ? `${base}.exe` : base;
}

/**
 * Candidate platform-tools roots, most specific first. `__dirname` resolves to
 * <repo>/apps/desktop/dist-electron/utils in dev and to the unpacked asar dir
 * when packaged. Every root is re-scanned on each resolution, so a tool
 * dropped into any of these folders (e.g. by `setup:platform-tools`) is picked
 * up without restarting the app.
 */
function platformToolsRoots(): string[] {
  const dirs: string[] = [];
  if (app.isPackaged) {
    dirs.push(path.join(process.resourcesPath, "platform-tools")); // extraResources
    dirs.push(path.join(process.resourcesPath, "bin", "platform-tools")); // legacy layout
    dirs.push(path.join(process.resourcesPath, "app.asar.unpacked", "bin", "platform-tools"));
  } else {
    const appDir = path.join(__dirname, "..", ".."); // dist-electron → apps/desktop
    dirs.push(path.join(appDir, "bin", "platform-tools")); // `setup:platform-tools` output
    dirs.push(path.join(appDir, "resources", "platform-tools"));
    dirs.push(path.join(__dirname, "..", "..", "..", "..", "bin", "platform-tools")); // repo/bin
  }
  // Auto-fetch target: a writable per-user location in BOTH modes.
  try {
    dirs.push(path.join(app.getPath("userData"), "platform-tools"));
  } catch {
    /* app not ready — userData unavailable; retried on the next resolution */
  }
  return dirs;
}

/** Absolute path to a tool already on disk, or null. */
function findToolOnDisk(base: "adb" | "fastboot"): string | null {
  const name = platformToolName(base);
  for (const root of platformToolsRoots()) {
    const candidate = path.join(root, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep probing */
    }
  }
  return null;
}

/** Absolute path to a tool resolvable from $PATH, or null. */
function findToolOnPath(base: "adb" | "fastboot"): string | null {
  const name = platformToolName(base);
  const pathEnv = process.env.PATH ?? "";
  for (const entry of pathEnv.split(path.delimiter)) {
    if (!entry) continue;
    const candidate = path.join(entry, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep probing */
    }
  }
  return null;
}

/** Resolve a tool synchronously (disk, then $PATH). Never downloads. */
function resolveToolPath(base: "adb" | "fastboot"): string | null {
  try {
    return findToolOnDisk(base) ?? findToolOnPath(base);
  } catch (err) {
    log.warn(`[adb] tool resolution failed: ${err}`);
    return null;
  }
}

// ─── Auto-install (download + extract fallback) ──────────────────────────────

const DOWNLOAD_TIMEOUT_MS = 180_000;
const DOWNLOAD_RETRY_MS = 30_000;

/** Download `url` into `destFile` with Electron's net stack (main process). */
async function downloadFile(url: string, destFile: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await net.fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const body = response.body;
    if (!body) throw new Error("empty response body");
    const reader = body.getReader();
    const chunks: Buffer[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    await fs.promises.mkdir(path.dirname(destFile), { recursive: true });
    await fs.promises.writeFile(destFile, Buffer.concat(chunks));
  } finally {
    clearTimeout(timer);
  }
}

/** Windows-only: expand a .zip with the built-in PowerShell cmdlet. */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const escaped = (p: string) => p.replace(/'/g, "''");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Expand-Archive -LiteralPath '${escaped(zipPath)}' -DestinationPath '${escaped(destDir)}' -Force`,
  ].join("; ");
  const result = await runTool(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    DOWNLOAD_TIMEOUT_MS
  );
  if (result.exitCode !== 0) {
    throw new Error(`unzip failed (exit ${result.exitCode}): ${result.lastErrorLine}`);
  }
}

/**
 * Download + extract Google's official platform-tools so a real adb exists on
 * first launch without any manual step. The zip's archive root folder is named
 * `platform-tools`, so expanding into <userData> yields the expected layout
 * <userData>/platform-tools/adb.exe. Only Windows ships a rolling "latest" URL;
 * mac/linux builds are versioned, so those platforms rely on $PATH instead.
 */
async function downloadPlatformTools(): Promise<void> {
  const archiveUrl = PLATFORM_TOOLS_ARCHIVE[process.platform];
  if (!archiveUrl) return; // $PATH-only platform — nothing to download
  const userData = app.getPath("userData");
  const zipPath = path.join(userData, ".platform-tools.zip");
  try {
    await downloadFile(archiveUrl, zipPath);
    // Replace any stale/partial previous extraction atomically-ish.
    await fs.promises.rm(path.join(userData, "platform-tools"), {
      recursive: true,
      force: true,
    });
    await extractZip(zipPath, userData);
  } finally {
    await fs.promises.rm(zipPath, { force: true }).catch(() => undefined);
  }
  if (!findToolOnDisk("adb")) {
    throw new Error("platform-tools archive did not contain adb");
  }
}

let ensurePromise: Promise<boolean> | null = null;
let lastDownloadAttemptMs = 0;

/**
 * Guarantee a usable adb before any command runs:
 *   1. disk (bundled / checked-in / previously auto-fetched)
 *   2. $PATH
 *   3. auto-download into <userData>/platform-tools (Windows)
 * Failed downloads are NOT cached — a later probe retries — but a 30s cooldown
 * prevents retry storms while offline. The "ADB tools not installed" error only
 * surfaces when every tier fails AND the download itself could not complete.
 */
function ensurePlatformTools(): Promise<boolean> {
  if (ensurePromise) return ensurePromise;
  const onDisk = findToolOnDisk("adb");
  const onPath = findToolOnPath("adb");
  if (onDisk || onPath) {
    log.info(
      `[adb] ensure: resolved via ${onDisk ? "disk" : "PATH"} → ${onDisk ?? onPath}`
    );
    return Promise.resolve(true);
  }
  if (Date.now() - lastDownloadAttemptMs < DOWNLOAD_RETRY_MS) {
    log.warn(
      `[adb] ensure: download cooldown active (${DOWNLOAD_RETRY_MS}ms since last attempt) — returning unavailable`
    );
    return Promise.resolve(false);
  }
  lastDownloadAttemptMs = Date.now();
  ensurePromise = (async (): Promise<boolean> => {
    try {
      await downloadPlatformTools();
      return Boolean(findToolOnDisk("adb"));
    } catch (err) {
      log.error(`[adb] platform-tools auto-install failed:`, err);
      return false;
    }
  })();
  ensurePromise.then(() => {
    ensurePromise = null; // re-evaluate the cheap disk/$PATH tiers on next call
  });
  return ensurePromise;
}

/**
 * Short positive cache for the probe result. `true` is sticky (a working binary
 * keeps working); `false` is NOT cached — a single transient failure (daemon
 * startup, AV interference, brief busy state) must not disable ADB for the rest
 * of the session. Every scan re-runs the probe when the last result was false.
 */
let adbOk: boolean | null = null;

async function probeAdb(): Promise<boolean> {
  if (adbOk === true) return true;
  const ensured = await ensurePlatformTools();
  if (!ensured) {
    log.warn(
      `[adb] platform-tools unavailable after auto-install attempt; ADB detection disabled`
    );
    return false;
  }
  const adbPath = findToolOnDisk("adb") ?? findToolOnPath("adb");
  if (!adbPath) {
    log.warn("[adb] probe: no adb binary on disk or PATH after ensure");
    adbOk = false;
    return false;
  }
  try {
    const result = await runTool(adbPath, ["--version"], 10_000);
    adbOk = result.exitCode === 0;
    log.info(
      `[adb] probe ${adbPath} → ${adbOk ? "OK" : "FAIL"} (exit ${result.exitCode}${result.timedOut ? ", timed out" : ""})`
    );
    // Auto-recovery: on a transient failure, clear the cache so the next scan
    // probes again instead of treating ADB as permanently dead.
    if (!adbOk) {
      log.warn(`[adb] probe transient failure for ${adbPath} — will re-probe on next scan`);
      adbOk = null;
    }
  } catch (err) {
    adbOk = null; // transient throw (spawn error, etc.) — allow re-probe
    log.warn(`[adb] probe ${adbPath} threw: ${err} — will re-probe on next scan`);
  }
  return adbOk === true;
}

/** Checked-in or bundled platform-tools present on disk (no download needed). */
export function isPlatformToolsBundled(): boolean {
  return Boolean(findToolOnDisk("adb")) || Boolean(findToolOnPath("adb"));
}

// ─── Spawn helper ────────────────────────────────────────────────────────────

export interface ToolResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  lastErrorLine: string | null;
}

/** Which pipe a streamed chunk came from. */
export type StreamPhase = "out" | "err";

/** Live-chunk sink handed to `runTool` / `runPlatformTool`. */
export type StreamCallback = (chunk: string, phase: StreamPhase) => void;

/**
 * Spawn a tool with an explicit args array (never a shell string), capture
 * stdout/stderr, and hard-timeout after `timeoutMs`. Returns a structured
 * result; throws only when the binary cannot be spawned at all (ENOENT etc.).
 *
 * When `onData` is supplied every stdout/stderr chunk is forwarded to it the
 * moment it arrives (true live streaming, not an end-of-run flush) so callers
 * can push a `device:log` payload to the renderer while the child is still
 * running.
 */
export function runTool(
  toolPath: string,
  args: string[],
  timeoutMs: number = ADB_TIMEOUT_MS,
  stdinData?: Buffer | string,
  onData?: StreamCallback
): Promise<ToolResult> {
  return new Promise<ToolResult>((resolve, reject) => {
    const child = spawn(toolPath, args, {
      windowsHide: true,
      stdio: stdinData !== undefined ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (onData && text) onData(text, "out");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      if (onData && text) onData(text, "err");
    });

    if (stdinData !== undefined && child.stdin) {
      // EPIPE is expected when the child exits before draining stdin; without
      // this listener the 'error' event would crash the main process.
      child.stdin.on("error", (err) => {
        log.warn(`[adb] stdin stream error: ${err.message}`);
      });
      child.stdin.write(stdinData, (err) => {
        if (err) log.warn(`[adb] stdin write failed: ${err.message}`);
      });
      child.stdin.end();
    }

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const trimmedStderr = stderr.trim();
      const trimmedStdout = stdout.trim();
      const lastErrorLine =
        trimmedStderr.split(/\r?\n/).filter(Boolean).pop() ??
        trimmedStdout.split(/\r?\n/).filter(Boolean).pop() ??
        null;
      resolve({
        exitCode,
        timedOut,
        stdout: trimmedStdout,
        stderr: trimmedStderr,
        lastErrorLine,
      });
    };

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => finish(code));
    child.on("exit", (code) => finish(code));
  });
}

/** Resolve + run a platform-tools binary. Returns null result when missing. */
export async function runPlatformTool(
  base: "adb" | "fastboot",
  args: string[],
  timeoutMs?: number,
  onData?: StreamCallback
): Promise<ToolResult | null> {
  // Auto-install (download) when no binary exists anywhere — a device check
  // must never fail because the binary is merely absent from disk.
  const ready = await ensurePlatformTools();
  const toolPath = resolveToolPath(base);
  if (!ready || !toolPath) {
    log.warn(
      `[adb] ${base} unavailable after auto-install attempt (ready=${ready}, toolPath=${toolPath ?? "null"}) — refusing to run`
    );
    return null;
  }
  try {
    return await runTool(toolPath, args, timeoutMs, undefined, onData);
  } catch (err) {
    log.error(`[adb] failed to spawn ${base} at ${toolPath}:`, err);
    return null;
  }
}

/** Human-friendly path used in logs / errors. */
export function toolDisplayName(base: "adb" | "fastboot"): string {
  return platformToolName(base);
}

/**
 * Resolve a tool to an absolute path with auto-install enabled (returns null
 * only after a genuine download/resolution failure). Exposed so handlers can
 * report the real binary path in the UI operation log.
 */
export async function resolvePlatformToolPath(base: "adb" | "fastboot"): Promise<string | null> {
  await ensurePlatformTools();
  return resolveToolPath(base);
}

/** Quote a single argv token for a shell command line (never user device input). */
function quoteArg(arg: string): string {
  if (arg === "") return '""';
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export interface ExecToolResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a tool through the promisified `child_process.exec` shell path.
 * Used as the fallback transport when a direct `spawn` is unavailable, and for
 * commands that rely on shell tokenisation (e.g. `recovery --wipe_data`).
 * Resolves with the real exit code for non-zero exits (never rejects on a
 * failing command); rejects only when the binary cannot be launched at all.
 */
export async function execTool(
  base: "adb" | "fastboot",
  args: string[],
  onData?: StreamCallback,
  timeoutMs: number = ADB_TIMEOUT_MS
): Promise<ExecToolResult> {
  const ready = await ensurePlatformTools();
  const toolPath = resolveToolPath(base);
  if (!ready || !toolPath) {
    throw new Error(`${platformToolName(base)} not available — install Android platform-tools and retry.`);
  }
  const command = [toolPath, ...args].map(quoteArg).join(" ");
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    const out = String(stdout ?? "");
    const err = String(stderr ?? "");
    if (onData && out) onData(out, "out");
    if (onData && err) onData(err, "err");
    return { exitCode: 0, stdout: out.trim(), stderr: err.trim() };
  } catch (raw) {
    const e = raw as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    const out = e.stdout ? String(e.stdout) : "";
    const err = e.stderr ? String(e.stderr) : e.message ?? "command failed";
    if (onData && out) onData(out, "out");
    if (onData && err) onData(err, "err");
    return {
      exitCode: typeof e.code === "number" ? e.code : 1,
      stdout: out.trim(),
      stderr: err.trim(),
    };
  }
}

// ─── ADB command helpers ─────────────────────────────────────────────────────

export interface AdbDeviceLine {
  serial: string;
  state: "device" | "unauthorized" | "offline" | "unknown";
  brand?: string;
  model?: string;
}

/** ADB encodes spaces in model tokens as underscores (e.g. SM_G991B). */
function decodeModelToken(token: string): string {
  return token.replace(/_/g, " ").trim();
}

/** Parse `adb devices -l` output into structured device lines. */
export function parseAdbDevicesOutput(output: string): AdbDeviceLine[] {
  const lines = output.split(/\r?\n/);
  const devices: AdbDeviceLine[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("List of devices")) continue;
    if (line.startsWith("*")) continue; // daemon startup banner lines
    const [serial, state, ...rest] = line.split(/\s+/);
    if (!serial || !state) continue;
    // Connection gate: `device` lines are fully usable (online AND
    // authorized). `unauthorized` lines are a physically present phone that is
    // waiting for the ADB authorization prompt — they must be surfaced so the
    // UI can ask the user to authorize instead of showing a misleading
    // "USB only — enable USB debugging" state. Everything else (`offline`,
    // `no permissions`, daemon noise) is not usable or actionable and is
    // dropped so it can never produce a ghost "Device Connected" state.
    if (state !== "device" && state !== "unauthorized") continue;
    const props = rest.join(" ");
    const modelMatch = props.match(/model:([^\s]+)/);
    const deviceMatch = props.match(/device:([^\s]+)/);
    const model = modelMatch?.[1] ? decodeModelToken(modelMatch[1]) : undefined;
    const fallbackModel = deviceMatch?.[1] ? decodeModelToken(deviceMatch[1]) : undefined;
    devices.push({
      serial,
      state,
      model: model ?? fallbackModel,
    });
  }
  return devices;
}

/** `adb devices -l` with an explicit serial — returns lines or null when unavailable. */
export async function adbDevices(serial?: string): Promise<AdbDeviceLine[] | null> {
  const args = ["devices", "-l"];
  if (serial) args.push(serial);
  const result = await runPlatformTool("adb", args, 15_000);
  if (!result) return null;
  if (result.exitCode !== 0) {
    log.warn(`[adb] devices exited ${result.exitCode}: ${result.lastErrorLine}`);
    return null;
  }
  return parseAdbDevicesOutput(result.stdout);
}

/** Best-effort `adb shell getprop <key>` for a single serial. */
export async function adbGetProp(serial: string, key: string): Promise<string | undefined> {
  const result = await runPlatformTool("adb", ["-s", serial, "shell", "getprop", key], 20_000);
  if (!result || result.exitCode !== 0) return undefined;
  const value = result.stdout.trim();
  return value || undefined;
}

/** Reboot a device into a given mode via adb (e.g. `reboot recovery`). */
export async function adbReboot(serial: string, mode?: string): Promise<ToolResult | null> {
  const args = mode ? ["-s", serial, "reboot", mode] : ["-s", serial, "reboot"];
  return runPlatformTool("adb", args, 30_000);
}

/**
 * Attempt a user-data wipe on a device in recovery. Tries, in order:
 *   1. `adb shell wipe data`            (modern recovery shell tool)
 *   2. `adb shell recovery --wipe_data` (older stock recovery)
 * Returns the result of the first command that actually exits 0, or the last
 * failure. Callers must NOT treat a non-zero exit as success.
 */
export async function adbWipeData(serial: string): Promise<{ ok: boolean; detail?: string }> {
  const attempts: Array<{ label: string; args: string[] }> = [
    { label: "adb shell wipe data", args: ["-s", serial, "shell", "wipe", "data"] },
    {
      label: "adb shell recovery --wipe_data",
      args: ["-s", serial, "shell", "recovery", "--wipe_data"],
    },
  ];

  let lastDetail: string | undefined;
  for (const attempt of attempts) {
    const result = await runPlatformTool("adb", attempt.args, ADB_TIMEOUT_MS);
    if (!result) {
      return { ok: false, detail: "ADB tools not installed" };
    }
    if (result.exitCode === 0) {
      return { ok: true, detail: attempt.label };
    }
    // "no such tool"/"not found"/"unknown command" means try the next variant.
    const errText = `${result.stdout} ${result.stderr}`.toLowerCase();
    const toolMissing =
      /no such (tool|file|entry)|not found|unknown command|isn't a (valid|recognized)|execvp/i.test(
        errText
      );
    lastDetail = `${attempt.label} failed (exit ${result.exitCode})${result.lastErrorLine ? `: ${result.lastErrorLine}` : ""}`;
    log.warn(`[adb] wipe attempt ${attempt.label} → exit ${result.exitCode}: ${result.lastErrorLine}`);
    if (!toolMissing) {
      // The tool exists but rejected the operation — the device did not allow
      // the wipe, so stop trying variants and report honestly.
      return { ok: false, detail: lastDetail };
    }
  }

  return { ok: false, detail: lastDetail };
}

/**
 * Run an arbitrary `adb shell <command>` on a specific device, returning stdout.
 * Throws on timeout / missing binary; returns stdout trimmed.
 */
export async function adbShell(serial: string, command: string): Promise<string> {
  const result = await runPlatformTool(
    "adb",
    ["-s", serial, "shell", command],
    ADB_TIMEOUT_MS
  );
  if (!result) throw new Error("ADB tools not installed");
  if (result.exitCode !== 0) {
    const stderr = result.stderr.trim();
    throw new Error(stderr || `adb shell exit ${result.exitCode}`);
  }
  return result.stdout.trim();
}

// ─── Fastboot command helpers ────────────────────────────────────────────────

/**
 * List devices currently sitting in fastboot/bootloader mode. `fastboot devices`
 * prints "<serial>\tfastboot" per line. Returns null when the fastboot binary is
 * unavailable (caller must distinguish "no fastboot" from "no device").
 */
export async function fastbootDevices(): Promise<string[] | null> {
  const result = await runPlatformTool("fastboot", ["devices"], 15_000);
  if (!result) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter((serial): serial is string => Boolean(serial));
}

/**
 * Wipe the userdata partition on a fastboot device. Fastboot is the fallback
 * transport when the phone is in bootloader mode and exposes no ADB shell:
 *   1. `fastboot -w`                 (erase userdata + metadata + reformat)
 *   2. `fastboot erase userdata`     (explicit erase on stricter bootloaders)
 *   3. `fastboot erase metadata`     (best-effort metadata cleanup)
 * Returns the first command that exits 0; a non-zero exit that is NOT an
 * "unsupported command" error is treated as a hard failure (the bootloader
 * exists but refused the wipe) so we never report a false success.
 */
export async function fastbootWipeUserData(
  serial: string
): Promise<{ ok: boolean; detail?: string }> {
  const attempts: Array<{ label: string; args: string[] }> = [
    { label: "fastboot -w", args: ["-s", serial, "-w"] },
    { label: "fastboot erase userdata", args: ["-s", serial, "erase", "userdata"] },
    { label: "fastboot erase metadata", args: ["-s", serial, "erase", "metadata"] },
  ];

  let lastDetail: string | undefined;
  for (const attempt of attempts) {
    const result = await runPlatformTool("fastboot", attempt.args, ADB_TIMEOUT_MS);
    if (!result) {
      return { ok: false, detail: "Fastboot tools not installed" };
    }
    if (result.exitCode === 0) {
      return { ok: true, detail: attempt.label };
    }
    lastDetail = `${attempt.label} failed (exit ${result.exitCode})${result.lastErrorLine ? `: ${result.lastErrorLine}` : ""}`;
    log.warn(
      `[fastboot] wipe attempt ${attempt.label} → exit ${result.exitCode}: ${result.lastErrorLine}`
    );
    const errText = `${result.stdout} ${result.stderr}`.toLowerCase();
    const unsupported =
      /unknown|not (supported|found)|no such|invalid|command not|isn't a/i.test(errText);
    if (!unsupported) {
      // The bootloader understood the command but rejected it — stop retrying.
      return { ok: false, detail: lastDetail };
    }
  }

  return { ok: false, detail: lastDetail };
}

/** Erase a single fastboot partition (`fastboot erase <partition>`). */
export async function fastbootErasePartition(
  serial: string,
  partition: string,
  onData?: StreamCallback
): Promise<ToolResult | null> {
  return runPlatformTool("fastboot", ["-s", serial, "erase", partition], ADB_TIMEOUT_MS, onData);
}

/** Reboot a fastboot device back into Android (or an explicit target). */
export async function fastbootReboot(
  serial: string,
  target?: string,
  onData?: StreamCallback
): Promise<ToolResult | null> {
  const args = target ? ["-s", serial, "reboot", target] : ["-s", serial, "reboot"];
  return runPlatformTool("fastboot", args, 30_000, onData);
}

/** Simple blocking wait (promise) without event-loop starvation. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { ADB_TIMEOUT_MS, probeAdb };
