// FRPB — IPC: free utility tools (WhatsApp Transfer, Phone Transfer,
// Data Eraser, Virtual Location).
//
// Every operation is driven by the official Android platform-tools binaries
// through utils/adb.ts (never a hand-rolled command line, never user input
// interpolated into a shell string). The handler:
//   • validates the request up-front (acknowledgement, lat/lng, tool id),
//   • refuses to run without an authorised ADB device,
//   • streams live progress on `device:freeTool:event` (`FreeToolOperationEvent`),
//   • resolves with a serialisable `FreeToolRunResult` and NEVER throws — a
//     failure is reported through `{ success: false, error }` so the renderer
//     can surface it instead of crashing the main process.

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import {
  isFreeToolId,
  type FreeToolLogLine,
  type FreeToolOperationEvent,
  type FreeToolOperationKind,
  type FreeToolPhase,
  type FreeToolRunRequest,
  type FreeToolRunResult,
} from "@frpb/shared";
import {
  adbDevices,
  adbGetProp,
  adbShell,
  adbWipeData,
  fastbootDevices,
  fastbootWipeUserData,
  isPlatformToolsBundled,
  runPlatformTool,
} from "../utils/adb";
import { log } from "../utils/logger";

const FREE_TOOL_EVENT_CHANNEL = "device:freeTool:event";
const FREE_TOOL_RUN_CHANNEL = "device:freeTool:run";

/** Hard ceiling for a single transfer/erase push/pull leg. */
const TRANSFER_TIMEOUT_MS = 10 * 60_000;

/** Only one free-tool operation may run at a time (they all drive one device). */
let activeTool: FreeToolOperationKind | null = null;

/* -------------------------------------------------------------------------- */
/*  Reporting                                                                 */
/* -------------------------------------------------------------------------- */

interface Reporter {
  /** Append a log line without changing the reported phase. */
  log: (level: FreeToolLogLine["level"], message: string) => void;
  /** Advance the phase, record a log line, and push a live event. */
  stage: (
    phase: FreeToolPhase,
    message: string,
    progress: number | null,
    level?: FreeToolLogLine["level"]
  ) => void;
  /** Build the terminal result payload. */
  finish: (success: boolean, error?: string) => FreeToolRunResult;
}

function broadcast(event: FreeToolOperationEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(FREE_TOOL_EVENT_CHANNEL, event);
    }
  }
}

function createReporter(tool: FreeToolOperationKind): Reporter {
  const startedAt = Date.now();
  const logs: FreeToolLogLine[] = [];
  let phase: FreeToolPhase = "idle";
  let progress: number | null = 0;
  let message = "Preparing…";

  const snapshot = (): FreeToolRunResult => ({
    tool,
    phase,
    progress,
    message,
    success: phase === "success",
    logs: [...logs],
  });

  const log = (level: FreeToolLogLine["level"], text: string): void => {
    logs.push({ level, message: text, at: Date.now() - startedAt });
  };

  const stage = (
    nextPhase: FreeToolPhase,
    text: string,
    pct: number | null,
    level: FreeToolLogLine["level"] = "info"
  ): void => {
    phase = nextPhase;
    progress = pct;
    message = text;
    log(level, text);
    broadcast({ tool, result: snapshot() });
  };

  const finish = (success: boolean, error?: string): FreeToolRunResult => {
    phase = success ? "success" : "error";
    progress = success ? 100 : progress;
    if (!success && error) message = error;
    const result: FreeToolRunResult = {
      ...snapshot(),
      success,
      error: success ? undefined : error ?? message,
    };
    broadcast({ tool, result });
    return result;
  };

  return { log, stage, finish };
}

function failure(
  tool: FreeToolOperationKind,
  phase: FreeToolPhase,
  error: string
): FreeToolRunResult {
  const result: FreeToolRunResult = {
    tool,
    phase,
    progress: null,
    message: error,
    success: false,
    logs: [{ level: "error", message: error, at: 0 }],
    error,
  };
  broadcast({ tool, result });
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Device helpers                                                            */
/* -------------------------------------------------------------------------- */

interface ResolvedDevice {
  serial: string;
}

/** Resolve an authorised ADB serial, preferring an explicit request serial. */
async function resolveAuthorizedSerial(preferred?: string): Promise<ResolvedDevice | null> {
  const devices = await adbDevices();
  if (!devices) return null;
  const authorized = devices.filter((d) => d.state === "device");
  if (authorized.length === 0) return null;
  if (preferred) {
    const match = authorized.find((d) => d.serial === preferred);
    if (match) return { serial: match.serial };
  }
  const first = authorized[0];
  return first ? { serial: first.serial } : null;
}

/** Sanitise a serial for use as a local folder name (never a shell token). */
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "device";
}

function stagingRoot(serial: string): string {
  return path.join(app.getPath("downloads"), "FRPB-Backup", safeSegment(serial));
}

/** `adb pull <remote> <local>` — returns true only on exit 0. */
async function adbPull(serial: string, remote: string, local: string): Promise<boolean> {
  const result = await runPlatformTool(
    "adb",
    ["-s", serial, "pull", remote, local],
    TRANSFER_TIMEOUT_MS
  );
  return Boolean(result && result.exitCode === 0);
}

/** `adb push <local> <remote>` — returns true only on exit 0. */
async function adbPush(serial: string, local: string, remote: string): Promise<boolean> {
  const result = await runPlatformTool(
    "adb",
    ["-s", serial, "push", local, remote],
    TRANSFER_TIMEOUT_MS
  );
  return Boolean(result && result.exitCode === 0);
}

/* -------------------------------------------------------------------------- */
/*  Category catalogue (transfer wizards)                                     */
/* -------------------------------------------------------------------------- */

interface TransferCategory {
  id: string;
  label: string;
  /** Device directory pulled/pushed for this category. */
  remotePath: string;
}

const TRANSFER_CATEGORIES: TransferCategory[] = [
  { id: "photos", label: "Photos", remotePath: "/sdcard/DCIM" },
  { id: "videos", label: "Videos", remotePath: "/sdcard/Movies" },
  { id: "music", label: "Music", remotePath: "/sdcard/Music" },
  { id: "documents", label: "Documents", remotePath: "/sdcard/Documents" },
  { id: "downloads", label: "Downloads", remotePath: "/sdcard/Download" },
];

function selectedCategories(request: FreeToolRunRequest): TransferCategory[] {
  const requested = request.categories?.filter(Boolean) ?? [];
  if (requested.length === 0) return TRANSFER_CATEGORIES;
  return TRANSFER_CATEGORIES.filter((c) => requested.includes(c.id));
}

/* -------------------------------------------------------------------------- */
/*  Tool implementations                                                      */
/* -------------------------------------------------------------------------- */

/** Data Eraser — factory reset via ADB, falling back to fastboot. */
async function runDataEraser(
  request: FreeToolRunRequest,
  reporter: Reporter
): Promise<FreeToolRunResult> {
  if (request.acknowledged !== true) {
    reporter.stage("error", "Destructive action not acknowledged.", null, "error");
    return reporter.finish(false, "You must confirm that all data will be erased.");
  }

  reporter.stage("preparing", "Checking ADB connectivity…", 5);
  const device = await resolveAuthorizedSerial(request.sourceSerial);
  if (!device) {
    reporter.stage("waiting-device", "No authorised ADB device detected.", null, "warn");
    return reporter.finish(false, "Connect an ADB-authorised device and try again.");
  }

  reporter.stage("running", `Wiping user data on ${device.serial}…`, 40);
  const wipe = await adbWipeData(device.serial);
  if (wipe.ok) {
    reporter.stage("success", `Factory reset issued (${wipe.detail ?? "adb wipe"}).`, 100, "success");
    return reporter.finish(true);
  }
  reporter.log("warn", `ADB wipe failed: ${wipe.detail ?? "unknown error"}. Trying fastboot…`);

  // Fallback: device may be sitting in bootloader mode.
  reporter.stage("running", "Attempting fastboot userdata wipe…", 70);
  const fastboot = await fastbootDevices();
  const fastbootSerial = fastboot && fastboot.length > 0 ? fastboot[0] : undefined;
  if (!fastbootSerial) {
    reporter.stage("error", "Erase failed on both ADB and fastboot.", null, "error");
    return reporter.finish(false, wipe.detail ?? "User-data wipe was rejected by the device.");
  }

  const fbWipe = await fastbootWipeUserData(fastbootSerial);
  if (fbWipe.ok) {
    reporter.stage("success", `Erase complete via fastboot (${fbWipe.detail}).`, 100, "success");
    return reporter.finish(true);
  }
  reporter.stage("error", "Erase failed on both ADB and fastboot.", null, "error");
  return reporter.finish(false, fbWipe.detail ?? "Device refused the user-data wipe.");
}

/** Virtual Location — enable mock location and inject the coordinates. */
async function runVirtualLocation(
  request: FreeToolRunRequest,
  reporter: Reporter
): Promise<FreeToolRunResult> {
  const lat = request.latitude;
  const lng = request.longitude;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    reporter.stage("error", "Invalid coordinates supplied.", null, "error");
    return reporter.finish(false, "Latitude must be −90…90 and longitude −180…180.");
  }

  reporter.stage("preparing", "Checking ADB connectivity…", 5);
  const device = await resolveAuthorizedSerial(request.sourceSerial);
  if (!device) {
    reporter.stage("waiting-device", "No authorised ADB device detected.", null, "warn");
    return reporter.finish(false, "Connect an ADB-authorised device and try again.");
  }
  const serial = device.serial;

  // Best-effort chain: some OEM builds only support a subset of these commands,
  // so each step is attempted independently and reported honestly.
  const steps: Array<{ label: string; command: string }> = [
    { label: "Enable mock location", command: "settings put secure mock_location 1" },
    {
      label: "Enable GPS test provider",
      command: "cmd location providers set-test-provider-enabled gps true",
    },
    {
      label: "Inject coordinates into GPS provider",
      command: `cmd location providers set-test-provider-location gps --latitude ${lat} --longitude ${lng}`,
    },
    {
      label: "Add test provider",
      command: `cmd location add-test-provider gps ${lat} ${lng} 0`,
    },
  ];

  let applied = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step) continue;
    const pct = 20 + Math.round(((i + 1) / steps.length) * 70);
    reporter.stage("running", step.label, pct);
    try {
      await adbShell(serial, step.command);
      reporter.log("success", `✓ ${step.label}`);
      applied += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reporter.log("warn", `✗ ${step.label} — ${msg}`);
    }
  }

  if (applied === 0) {
    reporter.stage("error", "Virtual location could not be applied on this device.", null, "error");
    return reporter.finish(
      false,
      "This device rejected all mock-location commands (developer options / OEM restrictions)."
    );
  }

  reporter.stage(
    "success",
    `Virtual location set to ${lat.toFixed(5)}, ${lng.toFixed(5)}.`,
    100,
    "success"
  );
  return reporter.finish(true);
}

/** Shared skeleton for the two transfer wizards. */
async function runTransfer(
  tool: FreeToolOperationKind,
  request: FreeToolRunRequest,
  reporter: Reporter,
  opts: { checkWhatsApp: boolean }
): Promise<FreeToolRunResult> {
  reporter.stage("preparing", "Checking source device…", 5);
  const source = await resolveAuthorizedSerial(request.sourceSerial);
  if (!source) {
    reporter.stage("waiting-device", "No authorised source device detected.", null, "warn");
    return reporter.finish(false, "Connect an ADB-authorised source device and try again.");
  }
  const sourceSerial = source.serial;

  if (opts.checkWhatsApp) {
    reporter.stage("running", "Verifying WhatsApp installation…", 12);
    let installed = false;
    try {
      const packages = await adbShell(sourceSerial, "pm list packages com.whatsapp");
      installed = packages.toLowerCase().includes("com.whatsapp");
    } catch (err) {
      reporter.log("warn", `Package check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!installed) {
      reporter.stage("error", "WhatsApp is not installed on the source device.", null, "error");
      return reporter.finish(false, "Install WhatsApp on the source device before transferring.");
    }
    reporter.log("success", "✓ WhatsApp detected");
  }

  const categories: TransferCategory[] = opts.checkWhatsApp
    ? [
        { id: "chats", label: "WhatsApp media & databases", remotePath: "/sdcard/Android/media/com.whatsapp" },
      ]
    : selectedCategories(request);

  if (categories.length === 0) {
    reporter.stage("error", "No data categories selected.", null, "error");
    return reporter.finish(false, "Select at least one category to transfer.");
  }

  const root = stagingRoot(sourceSerial);
  let pulled = 0;
  for (let i = 0; i < categories.length; i += 1) {
    const category = categories[i];
    if (!category) continue;
    const pct = 20 + Math.round(((i + 1) / categories.length) * 40);
    reporter.stage("running", `Pulling ${category.label}…`, pct);
    const local = path.join(root, category.id);
    const ok = await adbPull(sourceSerial, category.remotePath, local);
    if (ok) {
      reporter.log("success", `✓ ${category.label} → ${local}`);
      pulled += 1;
    } else {
      reporter.log("warn", `✗ ${category.label} not found or unreadable`);
    }
  }

  if (pulled === 0) {
    reporter.stage("error", "No data could be read from the source device.", null, "error");
    return reporter.finish(false, "The selected categories were not found on the source device.");
  }

  // Optional restore leg: push the staged data onto a second device.
  const target = request.targetSerial
    ? await resolveAuthorizedSerial(request.targetSerial)
    : null;

  if (request.targetSerial && !target) {
    reporter.log("warn", "Target device not authorised — backup kept locally only.");
  } else if (target) {
    reporter.stage("running", `Restoring to ${target.serial}…`, 75);
    let pushed = 0;
    for (let i = 0; i < categories.length; i += 1) {
      const category = categories[i];
      if (!category) continue;
      const local = path.join(root, category.id);
      const ok = await adbPush(target.serial, local, category.remotePath);
      if (ok) {
        reporter.log("success", `✓ restored ${category.label}`);
        pushed += 1;
      } else {
        reporter.log("warn", `✗ restore failed for ${category.label}`);
      }
    }
    if (pushed === 0) {
      return reporter.finish(false, "Restore failed on the target device.");
    }
    reporter.stage("success", `Transfer complete — ${pulled} backed up, ${pushed} restored.`, 100, "success");
    return reporter.finish(true);
  }

  reporter.stage(
    "success",
    `Transfer complete — ${pulled} categor${pulled === 1 ? "y" : "ies"} backed up to ${root}.`,
    100,
    "success"
  );
  return reporter.finish(true);
}

/* -------------------------------------------------------------------------- */
/*  Handler registration                                                      */
/* -------------------------------------------------------------------------- */

async function handleFreeToolRun(
  request: FreeToolRunRequest
): Promise<FreeToolRunResult> {
  if (!request || !isFreeToolId(request.tool)) {
    return failure("phone-transfer", "error", "Unknown or missing free tool.");
  }
  const tool = request.tool;

  if (activeTool) {
    return failure(tool, "error", `Another free-tool operation (${activeTool}) is already running.`);
  }
  if (!isPlatformToolsBundled()) {
    return failure(tool, "error", "Android platform-tools are not available.");
  }

  activeTool = tool;
  const reporter = createReporter(tool);

  try {
    switch (tool) {
      case "data-eraser":
        return await runDataEraser(request, reporter);
      case "virtual-location":
        return await runVirtualLocation(request, reporter);
      case "whatsapp-transfer":
        return await runTransfer(tool, request, reporter, { checkWhatsApp: true });
      case "phone-transfer":
        return await runTransfer(tool, request, reporter, { checkWhatsApp: false });
      default:
        return failure(tool, "error", `Unsupported free tool: ${String(tool)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`[free-tools] ${tool} failed:`, err);
    return reporter.finish(false, message);
  } finally {
    activeTool = null;
  }
}

/**
 * Register the free-tool IPC surface. Idempotent-safe: called once from
 * main.ts before the window is created.
 */
export function registerFreeToolHandlers(): void {
  ipcMain.handle(FREE_TOOL_RUN_CHANNEL, async (_event, request: FreeToolRunRequest) => {
    try {
      return await handleFreeToolRun(request);
    } catch (err) {
      // Never let a handler rejection bubble into the main process.
      const message = err instanceof Error ? err.message : String(err);
      log.error("[free-tools] unhandled run failure:", err);
      return failure(
        request && isFreeToolId(request.tool) ? request.tool : "phone-transfer",
        "error",
        message
      );
    }
  });
}

// Re-exported for potential unit tests / internal reuse.
export { resolveAuthorizedSerial, safeSegment };
