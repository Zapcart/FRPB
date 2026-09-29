import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Power, RotateCcw, Terminal, Zap, Apple, Lock, Wifi, Cpu, HardDrive, Database, Download, Search, FolderOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChipsetFamily, DeviceAutoDetected } from "@frpb/shared";
import type {
  ConsentState,
  DeviceInfo,
  DeviceInfoSnapshot,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  HardwareSnapshot,
  IcloudBypassOptions,
  IcloudBypassResult,
  IcloudStatus,
  SamsungAccountOptions,
  SamsungAccountResult,
  BootloopOptions,
  BootloopResult,
  FirmwarePackage,
  DataRecoveryOptions,
  DataRecoveryScanResult,
  DataRecoveryExtractResult,
  DataRecoveryItem,
  OperationEvent,
  OperationKind,
  OperationResult,
  RebootMode,
} from "../lib/ipc";
import ActionScreen, { type ActionProgress } from "./frp/ActionScreen";
import DisclaimerModal from "./frp/DisclaimerModal";
import ConnectionWizardModal, { type WizardPhase } from "./frp/ConnectionWizardModal";
import SamsungFrpWizard from "./frp/SamsungFrpWizard";
import { wizardGuide, type ConnectionGuide, type ConnectionGuideKey } from "./frp/shared";

interface LogEntry {
  time: string;
  message: string;
}

const MAX_LOG_ENTRIES = 200;

/** Brand → locked-device transport mode used by the engine handshake. */
const MODE_BY_BRAND: Record<string, ConnectionGuideKey> = {
  Samsung: "recovery",
  Xiaomi: "brom",
  Redmi: "brom",
  POCO: "brom",
  Vivo: "brom",
  OPPO: "brom",
  Realme: "brom",
  OnePlus: "brom",
  TECNO: "brom",
  Infinix: "brom",
  itel: "brom",
};

/** Derive the engine transport mode for a brand (falls back to Fastboot). */
function engineModeFor(brand: string | null): ConnectionGuideKey {
  return (brand && MODE_BY_BRAND[brand]) || "fastboot-recovery";
}

/** Quick Boot Switcher targets → `adb reboot <mode>` (streamed to the log). */
const REBOOT_ACTIONS: Array<{ mode: RebootMode; label: string; icon: LucideIcon }> = [
  { mode: "bootloader", label: "Fastboot", icon: Terminal },
  { mode: "recovery", label: "Recovery", icon: RotateCcw },
  { mode: "edl", label: "EDL", icon: Zap },
  { mode: "system", label: "System", icon: Power },
];

// Fields surfaced by the continuous auto-read strip, in display order.
const HW_FIELDS: Array<{ key: keyof DeviceInfoSnapshot; label: string }> = [
  { key: "model", label: "Model" },
  { key: "serial", label: "Serial" },
  { key: "port", label: "Port" },
  { key: "chipset", label: "Chipset" },
];

/**
 * Overall-progress milestone table. The engine streams a stage key + a
 * per-stage percentage (`OperationEvent.pct` → the "Current Task" bar); the
 * overall bar advances on the stage *key* via this table so the whole pipeline
 * stays monotonic and reaches 100% on `DONE`.
 */
const STAGE_MILESTONES: Record<string, number> = {
  START: 5,
  CONNECT: 15,
  INFO: 20,
  CHIPSET: 30,
  MODE: 35,
  EXPLOIT: 55,
  WIPE: 65,
  RESOLVE: 75,
  WRITE: 85,
  REBOOT: 92,
  DONE: 100,
};

/** Overall completion for a stage + raw pct pair. */
function overallFor(stage: string | null, pct: number, done: boolean): number {
  if (done) return 100;
  const key = (stage ?? "").toUpperCase();
  const milestone = STAGE_MILESTONES[key] ?? 0;
  return Math.max(milestone, Math.min(99, pct));
}

/**
 * Live "Auto-Read Hardware" strip. Mirrors professional GSM-tool behavior: the
 * main process pushes a snapshot on `device:info-updated` the instant a phone is
 * attached (ADB session or raw USB transport), so Model / Serial / Port /
 * Chipset populate themselves with no manual "Read Info" click.
 */
/**
 * Format the console lines for a hardware snapshot transition. Mirrors
 * `describeHardware()` in electron/hardware/detector.ts so the wizard console and
 * the durable Console Log tab read identically ([INFO] MediaTek USB Port Found
 * (COM3), [INFO] Injecting DA Payload…, etc.).
 */
function describeHardwareLines(snap: HardwareSnapshot): string[] {
  if (!snap.connected) return [];
  const port = snap.port ? ` (${snap.port})` : "";
  switch (snap.mode) {
    case "brom":
      return [
        `[INFO] MediaTek BROM Port Found${port}`,
        `[INFO] Device Instance ID: ${snap.deviceInstanceId ?? "n/a"}`,
        "[INFO] Injecting DA Payload…",
      ];
    case "preloader":
      return [`[INFO] MediaTek Preloader Detected${port}`, "[INFO] Injecting DA Payload…"];
    case "edl":
      return [
        `[INFO] Qualcomm EDL 9008 Port Found${port}`,
        `[INFO] Device Instance ID: ${snap.deviceInstanceId ?? "n/a"}`,
        "[INFO] Sending Sahara/Firehose handshake…",
      ];
    case "fastboot":
      return [`[INFO] Fastboot Interface Found${port}`, "[INFO] Preparing partition commands…"];
    case "download":
      return [`[INFO] Odin Download Mode Found${port}`, "[INFO] Preparing download payload…"];
    case "mtp":
      return [`[INFO] MTP Device Found${port}`];
    case "serial":
      // A bare serial endpoint is NOT a phone — say so, so the console never
      // implies a device was found while the wizard is still correctly waiting.
      return [
        `[INFO] Serial device detected${port} — not a recognised phone interface, still waiting`,
      ];
    case "adb":
      return ["[INFO] ADB session present (not required)"];
    default:
      return [];
  }
}

/** Low-level transport → tone class for the detected-mode chip. */
const MODE_CHIP_TONE: Record<string, string> = {
  brom: "bg-amber-100 text-amber-800",
  preloader: "bg-amber-100 text-amber-800",
  edl: "bg-violet-100 text-violet-800",
  fastboot: "bg-emerald-100 text-emerald-800",
  download: "bg-emerald-100 text-emerald-800",
  mtp: "bg-brand-100 text-brand-700",
  serial: "bg-slate-100 text-slate-600",
  adb: "bg-slate-100 text-slate-600",
  none: "bg-slate-100 text-slate-500",
};

function AutoReadPanel({ info }: { info: DeviceInfoSnapshot | null }) {
  const connected = Boolean(info?.connected);
  const hwMode = info?.hardwareMode ?? "none";
  // Surface the classified low-level transport ("BROM Mode", "EDL 9008 Mode",
  // "Fastboot", "MTP") instead of a generic connected/disconnected warning.
  // With no mobile device attached the panel states the explicit USB wait —
  // never a bare "Connected" or a phantom COM port.
  const modeLabel = connected
    ? info?.hardwareLabel || info?.mode || "Connected"
    : "Waiting for USB Phone Connection...";
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span
            className={
              connected
                ? "h-2 w-2 rounded-full bg-emerald-500"
                : "h-2 w-2 rounded-full bg-slate-300"
            }
          />
          Auto-Read Hardware
        </span>
        <span className="flex items-center gap-2">
          {connected && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                MODE_CHIP_TONE[hwMode] ?? MODE_CHIP_TONE.none
              }`}
            >
              {modeLabel}
            </span>
          )}
          <span className="text-[11px] text-slate-400">
            {info
              ? `${new Date(info.lastScanAt).toLocaleTimeString()}`
              : "scanning…"}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        {HW_FIELDS.map(({ key, label }) => {
          const value = info ? (info[key] as string | null) : null;
          return (
            <div key={key} className="bg-white px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {label}
              </div>
              <div className="mt-0.5 truncate text-sm font-medium text-slate-800">
                {value ? value : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FRPToolsScreenProps {
  status: DeviceStatus | null;
  onRefresh: () => void | Promise<void>;
  /**
   * Authoritative cross-tab run-state (from MainDashboard/useDevice). When an
   * operation is running in ANY tab, this screen locks its conflicting
   * controls instead of relying solely on its own local `runningOp`.
   */
  operationRunning: boolean;
}

export default function FRPToolsScreen({
  status,
  onRefresh,
  operationRunning,
}: FRPToolsScreenProps) {
  // B. Model (auto-detected + manual entry)
  const [detectedModel, setDetectedModel] = useState<string | undefined>(undefined);
  const [modelInput, setModelInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  // C. Brand + method selection
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // D. Legal disclaimer consent (modal, op-aware)
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [disclaimerOp, setDisclaimerOp] = useState<OperationKind | null>(null);
  const [checked, setChecked] = useState(false);
  const [agreeing, setAgreeing] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // E. Operation progress + log
  const [runningOp, setRunningOp] = useState<OperationKind | null>(null);
  const [opStage, setOpStage] = useState<string | null>(null);
  const [opProgress, setOpProgress] = useState<ActionProgress | null>(null);
  const [opLog, setOpLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [rebootingMode, setRebootingMode] = useState<RebootMode | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "info" } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);

  // G. Auto-detection engine
  const [autoDetected, setAutoDetected] = useState<DeviceAutoDetected | null>(null);

  // H. Guided hardware Connection Wizard
  const [wizard, setWizard] = useState<{
    op: OperationKind;
    guide: ConnectionGuide;
    phase: WizardPhase;
    lines: string[];
    hardware: HardwareSnapshot | null;
    error: string | null;
  } | null>(null);
  const wizardRef = useRef<typeof wizard>(null);
  useEffect(() => {
    wizardRef.current = wizard;
  }, [wizard]);

  // Samsung FRP wizard
  const [samsungWizardOpen, setSamsungWizardOpen] = useState(false);

  // ─── NEW: iCloud Lock bypass UI state ──────────────────────────────────────
  const [icloudImei, setIcloudImei] = useState("");
  const [icloudModel, setIcloudModel] = useState("");
  const [icloudAppleId, setIcloudAppleId] = useState("");
  const [icloudRunning, setIcloudRunning] = useState(false);
  const [icloudProgress, setIcloudProgress] = useState<ActionProgress | null>(null);
  const [icloudResult, setIcloudResult] = useState<IcloudBypassResult | null>(null);
  const [icloudLog, setIcloudLog] = useState<LogEntry[]>([]);

  // ─── NEW: Samsung Account bypass UI state ──────────────────────────────────
  const [samsungMethod, setSamsungMethod] = useState<"find-my-mobile" | "oem-service" | "adb">("find-my-mobile");
  const [samsungRunning, setSamsungRunning] = useState(false);
  const [samsungProgress, setSamsungProgress] = useState<ActionProgress | null>(null);
  const [samsungResult, setSamsungResult] = useState<SamsungAccountResult | null>(null);
  const [samsungLog, setSamsungLog] = useState<LogEntry[]>([]);

  // ─── NEW: Bootloop Recovery UI state ────────────────────────────────────────
  const [bootloopChipset, setBootloopChipset] = useState("");
  const [bootloopFirmware, setBootloopFirmware] = useState<FirmwarePackage | null>(null);
  const [firmwareCatalog, setFirmwareCatalog] = useState<FirmwarePackage[]>([]);
  const [bootloopRunning, setBootloopRunning] = useState(false);
  const [bootloopProgress, setBootloopProgress] = useState<ActionProgress | null>(null);
  const [bootloopResult, setBootloopResult] = useState<BootloopResult | null>(null);
  const [bootloopLog, setBootloopLog] = useState<LogEntry[]>([]);
  const [bootloopLoadingCatalog, setBootloopLoadingCatalog] = useState(false);

  // ─── NEW: Data Recovery UI state ────────────────────────────────────────────
  const [dataRecoveryRunning, setDataRecoveryRunning] = useState(false);
  const [dataRecoveryProgress, setDataRecoveryProgress] = useState<ActionProgress | null>(null);
  const [dataRecoveryResult, setDataRecoveryResult] = useState<DataRecoveryScanResult | null>(null);
  const [dataRecoveryLog, setDataRecoveryLog] = useState<LogEntry[]>([]);
  const [dataRecoveryItems, setDataRecoveryItems] = useState<DataRecoveryItem[]>([]);
  const [dataRecoverySelected, setDataRecoverySelected] = useState<string[]>([]);
  const [dataRecoveryDestPath, setDataRecoveryDestPath] = useState("");
  const [dataRecoveryExtractResult, setDataRecoveryExtractResult] = useState<DataRecoveryExtractResult | null>(null);
  const [dataRecoveryScanning, setDataRecoveryScanning] = useState(false);

  // ─── NEW: Hardware wizard streaming (extended) ────────────────────────────
  useEffect(() => {
    if (!wizard) return;

    const appendUnique = (line: string) => {
      setWizard((prev) => {
        if (!prev) return prev;
        const last = prev.lines[prev.lines.length - 1];
        if (last === line) return prev;
        return { ...prev, lines: [...prev.lines, line] };
      });
    };

    const offEvent = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      const pct = typeof event.pct === "number" ? ` ${Math.round(event.pct)}%` : "";
      appendUnique(`[${event.stage.toUpperCase()}]${pct} ${event.message}`);
    });

    const offLog = window.frpb.device.onLog((payload: DeviceLogPayload) => {
      const text = payload.text.replace(/\r?\n$/, "").trim();
      if (!text) return;
      appendUnique(payload.stream === "err" ? `[ERROR] ${text}` : `[TOOL] ${text}`);
    });

    return () => {
      offEvent();
      offLog();
    };
  }, [wizard !== null]);

  // Continuous auto-read hardware snapshot (`device:info-updated`).
  const [hwInfo, setHwInfo] = useState<DeviceInfoSnapshot | null>(null);
  // Android API level for the Samsung FRP Recovery Wizard. It lives on the full
  // `DeviceInfo` snapshot (`extra.androidVersion`) rather than the lightweight
  // `DeviceInfoSnapshot`, so it is fetched on-demand and parsed to a number.
  const [androidVersion, setAndroidVersion] = useState<number | null>(null);

  // Refs avoid stale closures inside the long-lived operation-event subscription.
  const runningOpRef = useRef<OperationKind | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((message: string) => {
    setOpLog((prev) => {
      const entry: LogEntry = { time: new Date().toLocaleTimeString(), message };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const appendIcloudLog = useCallback((message: string) => {
    setIcloudLog((prev) => {
      const entry: LogEntry = { time: new Date().toLocaleTimeString(), message };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const appendSamsungLog = useCallback((message: string) => {
    setSamsungLog((prev) => {
      const entry: LogEntry = { time: new Date().toLocaleTimeString(), message };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const appendBootloopLog = useCallback((message: string) => {
    setBootloopLog((prev) => {
      const entry: LogEntry = { time: new Date().toLocaleTimeString(), message };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  const appendDataRecoveryLog = useCallback((message: string) => {
    setDataRecoveryLog((prev) => {
      const entry: LogEntry = { time: new Date().toLocaleTimeString(), message };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
    });
  }, []);

  // Explicit, auto-dismissing error banner. Used for real failures only —
  // non-zero tool exit codes, unauthorized ADB, or a spawn that never ran.
  const showToast = useCallback((message: string, tone: "error" | "info" = "error") => {
    setToast({ message, tone });
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 8000);
  }, []);

  // B + D. Load detected model and consent state on mount.
  useEffect(() => {
    let cancelled = false;

    window.frpb.device
      .listModels()
      .then((res: DeviceModelsResult) => {
        if (cancelled) return;
        setDetectedModel(res.detectedModel);
        if (res.detectedModel) {
          setModelInput((prev) => prev || res.detectedModel!);
        }
      })
      .catch(() => {});

    window.frpb.device
      .checkConsent()
      .then((c: ConsentState) => {
        if (cancelled) return;
        setConsent(c);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // G. Auto-detection engine. Seeds the brand context + badge immediately
  // (requestInfo() also emits `device:auto-detected` server-side) and updates on
  // every subsequent plug-in / transport change.
  useEffect(() => {
    const unsubscribe = window.frpb.device.onAutoDetected((info: DeviceAutoDetected) => {
      setAutoDetected(info);
      if (info.detected && info.brand) {
        setSelectedBrand((prev) => prev ?? info.brand);
        if (info.model) setModelInput((prev) => prev || info.model!);
      }
    });
    window.frpb.device.requestInfo().catch(() => {});
    return unsubscribe;
  }, []);

  // E. Operation events → progress + log. Events for the wrong op (or stale
  // events while idle) are ignored. Unsubscribed on unmount.
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (!runningOpRef.current || event.op !== runningOpRef.current) return;
      const pct = Math.max(0, Math.min(100, event.pct));
      const done = event.stage.toUpperCase() === "DONE" || pct >= 100;
      setOpStage(event.stage);
      setOpProgress({
        stage: event.stage,
        pct,
        overall: overallFor(event.stage, pct, done),
        current: pct,
      });
      appendLog(event.message);
    });
    return unsubscribe;
  }, [appendLog]);

  // ─── NEW: iCloud Lock operation events → progress + log
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (event.op !== "icloud-bypass") return;
      const pct = Math.max(0, Math.min(100, event.pct));
      const done = event.stage.toUpperCase() === "COMPLETE" || event.stage.toUpperCase() === "FAILED" || pct >= 100;
      setIcloudProgress({
        stage: event.stage,
        pct,
        overall: done ? 100 : pct,
        current: pct,
      });
      appendIcloudLog(event.message);
    });
    return unsubscribe;
  }, []);

  // ─── NEW: Samsung Account operation events → progress + log
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (event.op !== "samsung-account") return;
      const pct = Math.max(0, Math.min(100, event.pct));
      const done = event.stage.toUpperCase() === "COMPLETE" || event.stage.toUpperCase() === "FAILED" || pct >= 100;
      setSamsungProgress({
        stage: event.stage,
        pct,
        overall: done ? 100 : pct,
        current: pct,
      });
      appendSamsungLog(event.message);
    });
    return unsubscribe;
  }, []);

  // E4. Bootloop Recovery operation events → progress + log
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (event.op !== "bootloop-recovery") return;
      const pct = Math.max(0, Math.min(100, event.pct));
      const done = event.stage.toUpperCase() === "COMPLETE" || event.stage.toUpperCase() === "FAILED" || pct >= 100;
      setBootloopProgress({
        stage: event.stage,
        pct,
        overall: done ? 100 : pct,
        current: pct,
      });
      appendBootloopLog(event.message);
    });
    return unsubscribe;
  }, []);

  // E5. Data Recovery operation events → progress + log
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (event.op !== "data-recovery-scan" && event.op !== "data-recovery-extract") return;
      const pct = Math.max(0, Math.min(100, event.pct));
      const done = event.stage.toUpperCase() === "SCAN_COMPLETE" || event.stage.toUpperCase() === "EXTRACT_COMPLETE" || event.stage.toUpperCase() === "FAILED" || pct >= 100;
      setDataRecoveryProgress({
        stage: event.stage,
        pct,
        overall: done ? 100 : pct,
        current: pct,
      });
      appendDataRecoveryLog(event.message);
    });
    return unsubscribe;
  }, []);

  // E. Raw `device:log` stream from the real adb/fastboot child processes. Every
  // stdout/stderr chunk is appended to the operation log panel as it arrives, so
  // the on-screen terminal is the actual tool output rather than a mock. Fatal
  // stderr (unauthorized device, missing tool, non-zero exit) raises a toast.
  useEffect(() => {
    const unsubscribe = window.frpb.device.onLog((payload: DeviceLogPayload) => {
      const text = payload.text.replace(/\r?\n$/, "").trim();
      if (!text) return;
      appendLog(payload.stream === "err" ? `! ${text}` : text);
      if (
        payload.stream === "err" &&
        /unauthorized|not authorized|no devices|device offline|error:|cannot|failed/i.test(text)
      ) {
        showToast(text);
      }
    });
    // Ask the main process to mirror its raw stream into the rolling console
    // while this screen is mounted; stop when it unmounts.
    window.frpb.device.setLogSink(true);
    return () => {
      unsubscribe();
      window.frpb.device.setLogSink(false);
    };
  }, [appendLog, showToast]);

  // Auto-read hardware: subscribe to the main-process push, and seed the current
  // state immediately on mount via requestInfo() so the strip is populated
  // before the first 2s poll tick.
  useEffect(() => {
    const unsubscribe = window.frpb.device.onInfoUpdated((info: DeviceInfoSnapshot) => {
      setHwInfo(info);
    });
    window.frpb.device
      .requestInfo()
      .then((info: DeviceInfoSnapshot) => setHwInfo(info))
      .catch(() => {});
    return unsubscribe;
  }, []);

  // Full device info carries the real Android version string; refresh it whenever
  // a device becomes authorised/connected and on manual re-scan.
  useEffect(() => {
    if (hwInfo?.connected !== true) {
      setAndroidVersion(null);
      return;
    }
    let cancelled = false;
    window.frpb.device
      .getDeviceInfo()
      .then((info: DeviceInfo) => {
        if (cancelled) return;
        const parsed = Number.parseInt(info.extra?.androidVersion ?? "", 10);
        setAndroidVersion(Number.isFinite(parsed) ? parsed : null);
      })
      .catch(() => {
        if (!cancelled) setAndroidVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hwInfo?.connected, hwInfo?.serial]);

  // Release the toast timer on unmount so it never fires into a dead tree.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Auto-scroll the log area to the latest entry.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [opLog]);

  // A. Manual refresh re-scans via the shared useDevice() hook and re-fetches
  // the detected model.
  function handleManualRefresh() {
    void onRefresh();
    // Force a FRESH serialport enumeration in the main process (bypassing the
    // poll caches), then re-read the typed info snapshot so the hardware strip
    // reflects a phone plugged in moments ago instead of a cached port list.
    void window.frpb.device
      .rescan()
      .then(() => window.frpb.device.requestInfo())
      .then((info: DeviceInfoSnapshot) => setHwInfo(info))
      .catch(() => {});
    window.frpb.device
      .listModels()
      .then((res: DeviceModelsResult) => {
        setDetectedModel(res.detectedModel);
        if (res.detectedModel) {
          setModelInput((prev) => prev || res.detectedModel!);
        }
      })
      .catch(() => {});
  }

  // E. Run an operation. The main process rejects with
  // "Legal disclaimer must be accepted first." if consent is missing — that
  // message surfaces verbatim in the result banner.
  //
  // Options carry the selected brand + locked-device transport mode so the
  // engine never demands USB debugging: it waits for the physical transport
  // (Samsung Test Mode / MediaTek BROM / Fastboot-Recovery) instead.
  async function runOperation(op: OperationKind) {
      // Reject if this screen is already busy OR another tab holds the global
      // run-state lock (main process enforces the same invariant).
      if (runningOpRef.current || operationRunning) return;
      setRunningOp(op);
      runningOpRef.current = op;
      setResult(null);
      setOpStage(null);
      setOpProgress(null);
      setOpLog([]);
      const model = (selectedModel || modelInput).trim();
      // The wizard is the sole interactive surface; drive its phase from the run.
      setWizard((prev) => (prev ? { ...prev, phase: "executing" } : prev));
      const options = {
        brand: selectedBrand,
        mode: engineModeFor(selectedBrand),
        model: model || undefined,
      };
      try {
      const res: OperationResult =
        op === "flash-reset"
          ? await window.frpb.device.flashReset(options)
          : op === "unlock-screen"
            ? await window.frpb.device.unlockScreen(options)
            : await window.frpb.device.frpBypass(options);
      setResult(res);
      setOpProgress({
        stage: res.success ? "DONE" : opStage ?? "ERROR",
        pct: 100,
        overall: 100,
        current: 100,
      });
      appendLog(res.message);
      if (res.detail) appendLog(res.detail);
      if (!res.success) showToast(res.message);
      setWizard((prev) =>
        prev
          ? res.success
            ? { ...prev, phase: "success" }
            : { ...prev, phase: "error", error: res.message }
          : prev
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Operation failed to start.";
      setResult({ success: false, message });
      appendLog(message);
      showToast(message);
      setWizard((prev) => (prev ? { ...prev, phase: "error", error: message } : prev));
    } finally {
      runningOpRef.current = null;
      setRunningOp(null);
    }
  }

  // D. Open the legal disclaimer modal for a specific operation.
  function openDisclaimer(op: OperationKind) {
    setChecked(false);
    setConsentError(null);
    setDisclaimerOp(op);
  }

  // D. Record legal consent from the modal, then run the pending operation.
  async function handleAgree() {
    if (!checked || agreeing || !disclaimerOp) return;
    setAgreeing(true);
    setConsentError(null);
    const op = disclaimerOp;
    try {
      const res = await window.frpb.device.acceptConsent(op);
      if (res.ok) {
        setConsent((prev) => ({
          flashReset: op === "flash-reset" ? true : prev?.flashReset ?? false,
          frpBypass: op === "frp-bypass" ? true : prev?.frpBypass ?? false,
          unlockScreen: op === "unlock-screen" ? true : prev?.unlockScreen ?? false,
          rebootMode: prev?.rebootMode ?? false,
          icloudBypass: op === "icloud-bypass" ? true : prev?.icloudBypass ?? false,
          samsungAccount: op === "samsung-account" ? true : prev?.samsungAccount ?? false,
          bootloopRecovery: op === "bootloop-recovery" ? true : prev?.bootloopRecovery ?? false,
          dataRecovery:
            op === "data-recovery" || op === "data-recovery-scan" || op === "data-recovery-extract"
              ? true
              : prev?.dataRecovery ?? false,
        }));
        setDisclaimerOp(null);
        setChecked(false);
        // Consent recorded — open the Connection Wizard (no ADB prerequisite).
        beginWizard(op);
      } else {
        setConsentError(res.error ?? "Could not record your consent. Please try again.");
      }
    } catch (err) {
      setConsentError(
        err instanceof Error && err.message
          ? err.message
          : "Could not record your consent. Please try again."
      );
    } finally {
      setAgreeing(false);
    }
  }

  // Part 3 — guided hardware Connection Wizard. Opened the instant the user
  // triggers an action: it shows the key combination, then runs a live hardware
  // listen loop that auto-advances once the low-level interface appears. There is
  // NO ADB / USB-debugging prerequisite anywhere in this path.
  function beginWizard(op: OperationKind) {
    const mode = engineModeFor(selectedBrand);
    const guide = wizardGuide(selectedBrand, chipset, mode);
    setWizard({ op, guide, phase: "instructions", lines: [], hardware: null, error: null });
  }

  // The user confirmed the key combination — start actively listening for the
  // BROM / EDL / Fastboot interface, streaming console lines, then execute.
  async function handleWizardStart() {
    const current = wizardRef.current;
    if (!current) return;
    const { op } = current;
    setWizard((prev) => (prev ? { ...prev, phase: "listening", lines: [] } : prev));
    // Live snapshots pushed by the main-process listen loop.
    const off = window.frpb.device.onHardware((snap) => {
      const lines = describeHardwareLines(snap);
      setWizard((prev) => {
        if (!prev) return prev;
        const merged = lines.length ? [...prev.lines, ...lines] : prev.lines;
        return { ...prev, hardware: snap, lines: merged };
      });
    });
    try {
      const snap = await window.frpb.device.waitForHardware({
        mode: engineModeFor(selectedBrand),
        brand: selectedBrand,
        timeoutMs: 120_000,
      });
      off();
      if (!snap || !snap.connected) {
        setWizard((prev) =>
          prev
            ? {
                ...prev,
                phase: "error",
                error:
                  "No hardware interface detected. Keep the buttons held, reconnect the USB cable and try again.",
              }
            : prev
        );
        return;
      }
      // Interface found — auto-advance to execution and run the real engine.
      setWizard((prev) =>
        prev ? { ...prev, hardware: snap, phase: "executing" } : prev
      );
      await runOperation(op);
    } finally {
      off();
    }
  }

  function handleWizardCancel() {
    setWizard(null);
  }

  // ─── D-new. iCloud Lock handler ────────────────────────────────────────
  async function handleIcloudBypass() {
    if (busy) return;
    if (!icloudConsented) {
      openDisclaimer("icloud-bypass");
    } else {
      setRunningOp("icloud-bypass");
      setIcloudRunning(true);
      setIcloudResult(null);
      setIcloudProgress(null);
      setIcloudLog([]);
      try {
        const res = await window.frpb.device.icloudBypass({
          imei: icloudImei || undefined,
          appleId: icloudAppleId || undefined,
          model: icloudModel || undefined,
        });
        setIcloudResult(res);
        appendIcloudLog(res.message);
        if (!res.success) showToast(res.message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "iCloud bypass failed.";
        setIcloudResult({ success: false, message: msg } as IcloudBypassResult);
        appendIcloudLog(msg);
        showToast(msg);
      } finally {
        setIcloudRunning(false);
        setRunningOp(null);
      }
    }
  }

  // ─── D-new. Samsung Account handler ────────────────────────────────────
  async function handleSamsungAccountBypass() {
    if (busy) return;
    if (!samsungAccountConsented) {
      openDisclaimer("samsung-account");
    } else {
      setRunningOp("samsung-account");
      setSamsungRunning(true);
      setSamsungResult(null);
      setSamsungProgress(null);
      setSamsungLog([]);
      try {
        const res = await window.frpb.device.samsungAccountBypass({
          brand: "Samsung",
          model: (selectedModel || modelInput).trim() || undefined,
          method: samsungMethod,
          androidVersion: androidVersion ?? undefined,
        });
        setSamsungResult(res);
        appendSamsungLog(res.message);
        if (!res.success) showToast(res.message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Samsung account bypass failed.";
        setSamsungResult({ success: false, message: msg, accountRemoved: false } as SamsungAccountResult);
        appendSamsungLog(msg);
        showToast(msg);
      } finally {
        setSamsungRunning(false);
        setRunningOp(null);
      }
    }
  }

  // ─── D-new. Bootloop Recovery handler ──────────────────────────────────
  async function handleBootloopRecovery() {
    if (busy || !isConnected) return;
    if (!bootloopConsented) {
      openDisclaimer("bootloop-recovery");
    } else {
      setRunningOp("bootloop-recovery");
      setBootloopRunning(true);
      setBootloopResult(null);
      setBootloopProgress(null);
      setBootloopLog([]);
      try {
        const res = await window.frpb.device.bootloopRecovery({
          chipset: bootloopChipset || undefined,
          brand: selectedBrand || undefined,
          model: (selectedModel || modelInput).trim() || undefined,
          androidVersion: androidVersion ?? undefined,
        });
        setBootloopResult(res);
        appendBootloopLog(res.message);
        if (!res.success) showToast(res.message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bootloop recovery failed.";
        setBootloopResult({ success: false, message: msg, rebooted: false } as BootloopResult);
        appendBootloopLog(msg);
        showToast(msg);
      } finally {
        setBootloopRunning(false);
        setRunningOp(null);
      }
    }
  }

  // ─── D-new. Data Recovery handler ──────────────────────────────────────
  async function handleDataRecovery() {
    if (busy || !isConnected) return;
    setRunningOp("data-recovery-scan");
    setDataRecoveryScanning(true);
    setDataRecoveryResult(null);
    setDataRecoveryProgress(null);
    setDataRecoveryLog([]);
    setDataRecoveryItems([]);
    try {
      const res = await window.frpb.device.dataRecoveryScan({});
      setDataRecoveryResult(res);
      setDataRecoveryItems(res.items ?? []);
      appendDataRecoveryLog(res.message);
      if (!res.success) showToast(res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Data recovery scan failed.";
      setDataRecoveryResult({ success: false, items: [], totalSizeBytes: 0, message: msg } as DataRecoveryScanResult);
      appendDataRecoveryLog(msg);
      showToast(msg);
    } finally {
      setDataRecoveryScanning(false);
      setRunningOp(null);
    }
  }

  // ─── NEW: Load the firmware catalog for Bootloop Recovery ───────────────
  async function handleLoadFirmwareCatalog() {
    if (bootloopLoadingCatalog) return;
    setBootloopLoadingCatalog(true);
    try {
      const pkgs = await window.frpb.device.listFirmwarePackages();
      setFirmwareCatalog(pkgs);
      if (pkgs.length > 0 && !bootloopFirmware) setBootloopFirmware(pkgs[0] ?? null);
      appendBootloopLog(`Loaded ${pkgs.length} firmware package(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load firmware catalog.";
      appendBootloopLog(msg);
      showToast(msg);
    } finally {
      setBootloopLoadingCatalog(false);
    }
  }

  // ─── NEW: Extract the selected Data Recovery items to disk ──────────────
  async function handleDataRecoveryExtract() {
    if (busy || dataRecoverySelected.length === 0) return;
    const dest = dataRecoveryDestPath.trim();
    if (!dest) {
      showToast("Choose a destination folder for the recovered files.");
      return;
    }
    setRunningOp("data-recovery-extract");
    setDataRecoveryExtractResult(null);
    try {
      const res = await window.frpb.device.dataRecoveryExtract(dataRecoverySelected, dest);
      setDataRecoveryExtractResult(res);
      appendDataRecoveryLog(res.message);
      if (!res.success) showToast(res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Data extraction failed.";
      setDataRecoveryExtractResult({
        success: false,
        message: msg,
        extractedCount: 0,
        extractedBytes: 0,
      } as DataRecoveryExtractResult);
      appendDataRecoveryLog(msg);
      showToast(msg);
    } finally {
      setRunningOp(null);
    }
  }

  // ─── FRP / Flash Reset entry points used by ActionScreen ────────────────
  // Both are consent-gated: the disclaimer is shown first, then the guided
  // Connection Wizard drives the actual run. Neither requires ADB.
  function handleFlashReset() {
    if (busy) return;
    if (!flashConsented) {
      openDisclaimer("flash-reset");
      return;
    }
    beginWizard("flash-reset");
  }

  function handleFrpBypass() {
    if (busy) return;
    if (!frpConsented) {
      openDisclaimer("frp-bypass");
      return;
    }
    beginWizard("frp-bypass");
  }

  // One-click boot-mode switcher. Non-destructive (no wipe) so no legal disclaimer
  // is required — the main process still enforces ADB authorization. Progress is
  // streamed to the shared console; the per-button spinner is driven locally.
  async function handleRebootMode(mode: RebootMode) {
    if (busy || !isConnected) return;
    if (needsAuth) {
      showToast("Device is not authorized — accept the USB debugging prompt on the phone.");
      return;
    }
    setRebootingMode(mode);
    appendLog(`Requesting reboot → ${mode}…`);
    try {
      const res = await window.frpb.device.rebootMode(mode);
      appendLog(res.message);
      if (res.detail) appendLog(res.detail);
      if (!res.success) showToast(res.message);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Reboot request failed.";
      appendLog(message);
      showToast(message);
    } finally {
      setRebootingMode(null);
    }
  }

  // Derived state. The low-level hardware snapshot (raw USB/COM) is the primary
  // signal so a device that is NOT running ADB still counts as available.
  const isConnected =
    Boolean(status?.connected) ||
    status?.state === "CONNECTED" ||
    Boolean(autoDetected?.detected) ||
    Boolean(hwInfo?.connected);
  // ADB authorization only gates the ADB-only Quick Boot Switcher — the FRP /
  // Flash Reset path never requires it (see handleFlashReset/handleFrpBypass).
  const needsAuth = Boolean(status?.connected) && status?.authorized === false;
  const flashConsented = Boolean(consent?.flashReset);
  const frpConsented = Boolean(consent?.frpBypass);
  const icloudConsented = Boolean(consent?.icloudBypass);
  const samsungAccountConsented = Boolean(consent?.samsungAccount);
  const bootloopConsented = Boolean(consent?.bootloopRecovery);
  const busy = runningOp !== null || operationRunning;

  // Step 1/2 context: prefer the auto-detected telemetry, fall back to the
  // shared device status. `brand` drives the badge + model filtering.
  const brand = autoDetected?.brand ?? status?.brand ?? null;
  const model = autoDetected?.model ?? status?.model ?? null;
  const serial = autoDetected?.serial ?? status?.serial ?? null;
  const port = autoDetected?.port ?? null;
  const chipset: ChipsetFamily = autoDetected?.chipset ?? "Unknown";
  const connection = autoDetected?.connection ?? (isConnected ? "adb" : "disconnected");
  const driverInstalled = Boolean(autoDetected?.driverInstalled);
  const detected = Boolean(autoDetected?.detected) || isConnected;
  const requiresManualMode = chipset === "MediaTek" || chipset === "Qualcomm";

  return (
    <div className="flex flex-col gap-5">
      {/* Continuous auto-read hardware strip — populated by device:info-updated. */}
      <AutoReadPanel info={hwInfo} />

      {/* Steps 1-3 — the entire simplified 2-click workflow on a single screen. */}
      <ActionScreen
        detected={detected}
        brand={brand}
        model={model}
        serial={serial}
        port={port}
        chipset={chipset}
        connection={connection}
        driverInstalled={driverInstalled}
        selectedModel={(selectedModel || modelInput).trim()}
        onSelectModel={setSelectedModel}
        connected={isConnected && !needsAuth}
        busy={busy}
        runningOp={runningOp === "flash-reset" || runningOp === "frp-bypass" ? runningOp : null}
        progress={opProgress}
        result={result}
        opLog={opLog}
        logRef={logRef}
        onRefresh={handleManualRefresh}
        onFlashReset={handleFlashReset}
        onFrpBypass={handleFrpBypass}
      />

      {/* Quick Boot Switcher (non-destructive, ADB only). */}
      <section className="frpb-card p-5">
        <h2 className="text-sm font-bold text-slate-900">Quick Boot Switcher</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Reboot an authorized device into another mode — no data is touched.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REBOOT_ACTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => void handleRebootMode(mode)}
              disabled={busy || !isConnected || needsAuth}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rebootingMode === mode ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
        {!isConnected && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Connect a device to enable the quick boot switcher.
          </p>
        )}
      </section>

      {/* iCloud Lock bypass — Apple activation-lock recovery for owned devices. */}
      <section className="frpb-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Apple className="h-4 w-4 text-slate-700" />
              iCloud Lock Bypass
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Remove the activation lock on an Apple device you own. Legal consent is required.
            </p>
          </div>
          {icloudResult && (
            <span
              className={
                icloudResult.success
                  ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
              }
            >
              {icloudResult.success ? "Success" : "Failed"}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-700">
            IMEI / Serial
            <input
              value={icloudImei}
              onChange={(e) => setIcloudImei(e.target.value)}
              placeholder="352…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Apple ID (optional)
            <input
              value={icloudAppleId}
              onChange={(e) => setIcloudAppleId(e.target.value)}
              placeholder="user@icloud.com"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Model (optional)
            <input
              value={icloudModel}
              onChange={(e) => setIcloudModel(e.target.value)}
              placeholder="iPhone 12"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleIcloudBypass()}
            disabled={busy || icloudRunning}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {icloudRunning ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Apple className="h-4 w-4" />
            )}
            {icloudConsented ? "Start iCloud Bypass" : "Review & Consent"}
          </button>
          {icloudProgress && (
            <span className="text-xs font-medium text-slate-500">
              {icloudProgress.stage} · {icloudProgress.pct}%
            </span>
          )}
        </div>

        {icloudProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${icloudProgress.pct}%` }}
            />
          </div>
        )}

        {icloudLog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
            {icloudLog.map((entry, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{entry.time} </span>
                {entry.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Samsung Account bypass — account lock removal on owned Samsung devices. */}
      <section className="frpb-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="h-4 w-4 text-slate-700" />
              Samsung Account Bypass
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Remove the Samsung account lock from a device you own.
            </p>
          </div>
          {samsungResult && (
            <span
              className={
                samsungResult.success
                  ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
              }
            >
              {samsungResult.success ? "Success" : "Failed"}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            Removal method
            <select
              value={samsungMethod}
              onChange={(e) =>
                setSamsungMethod(e.target.value as "find-my-mobile" | "oem-service" | "adb")
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            >
              <option value="find-my-mobile">Find My Mobile</option>
              <option value="oem-service">OEM Service</option>
              <option value="adb">ADB</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Android version
            <input
              value={androidVersion ?? ""}
              readOnly
              placeholder="Auto-detected"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-500 outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSamsungAccountBypass()}
            disabled={busy || samsungRunning}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {samsungRunning ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {samsungAccountConsented ? "Start Account Bypass" : "Review & Consent"}
          </button>
          {samsungProgress && (
            <span className="text-xs font-medium text-slate-500">
              {samsungProgress.stage} · {samsungProgress.pct}%
            </span>
          )}
        </div>

        {samsungProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${samsungProgress.pct}%` }}
            />
          </div>
        )}

        {samsungLog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
            {samsungLog.map((entry, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{entry.time} </span>
                {entry.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bootloop Recovery — flash stock firmware to rescue a bootlooping device. */}
      <section className="frpb-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <HardDrive className="h-4 w-4 text-slate-700" />
              Bootloop Recovery
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Recover a device stuck in a bootloop by flashing known-good stock firmware.
            </p>
          </div>
          {bootloopResult && (
            <span
              className={
                bootloopResult.success
                  ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                  : "rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
              }
            >
              {bootloopResult.success ? "Recovered" : "Failed"}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            Chipset (optional)
            <input
              value={bootloopChipset}
              onChange={(e) => setBootloopChipset(e.target.value)}
              placeholder="e.g. Snapdragon 888"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Firmware package
            <select
              value={bootloopFirmware?.id ?? ""}
              onChange={(e) => {
                const picked = firmwareCatalog.find((pkg) => pkg.id === e.target.value) ?? null;
                setBootloopFirmware(picked);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
            >
              <option value="">Select firmware…</option>
              {firmwareCatalog.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.brand} {pkg.model} · Android {pkg.androidVersion}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleLoadFirmwareCatalog()}
            disabled={bootloopLoadingCatalog}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bootloopLoadingCatalog ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Load catalog
          </button>
          <button
            type="button"
            onClick={() => void handleBootloopRecovery()}
            disabled={busy || !isConnected || bootloopRunning}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bootloopRunning ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <HardDrive className="h-4 w-4" />
            )}
            {bootloopConsented ? "Start Recovery" : "Review & Consent"}
          </button>
          {bootloopProgress && (
            <span className="text-xs font-medium text-slate-500">
              {bootloopProgress.stage} · {bootloopProgress.pct}%
            </span>
          )}
        </div>

        {bootloopProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${bootloopProgress.pct}%` }}
            />
          </div>
        )}

        {bootloopLog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
            {bootloopLog.map((entry, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{entry.time} </span>
                {entry.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Recovery — scan for recoverable files and extract the selection. */}
      <section className="frpb-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Database className="h-4 w-4 text-slate-700" />
              Data Recovery
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Scan an owned device for recoverable files, then extract the selection to disk.
            </p>
          </div>
          {dataRecoveryResult && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {dataRecoveryItems.length} item(s)
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleDataRecovery()}
            disabled={busy || !isConnected || dataRecoveryScanning}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dataRecoveryScanning ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Scan for files
          </button>
          {dataRecoveryProgress && (
            <span className="text-xs font-medium text-slate-500">
              {dataRecoveryProgress.stage} · {dataRecoveryProgress.pct}%
            </span>
          )}
        </div>

        {dataRecoveryProgress && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${dataRecoveryProgress.pct}%` }}
            />
          </div>
        )}

        {dataRecoveryItems.length > 0 && (
          <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto">
            {dataRecoveryItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={dataRecoverySelected.includes(item.id)}
                  onChange={(e) =>
                    setDataRecoverySelected((prev) =>
                      e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                    )
                  }
                  className="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.category} · {(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <span
                  className={
                    item.recoverable
                      ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      : "shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                  }
                >
                  {item.recoverable ? "Recoverable" : "Locked"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {dataRecoveryItems.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-[14rem] flex-1 text-xs font-semibold text-slate-700">
              Destination folder
              <input
                value={dataRecoveryDestPath}
                onChange={(e) => setDataRecoveryDestPath(e.target.value)}
                placeholder="C:\\Recovered"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-brand-400"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleDataRecoveryExtract()}
              disabled={busy || dataRecoverySelected.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              Extract {dataRecoverySelected.length > 0 ? `(${dataRecoverySelected.length})` : ""}
            </button>
            {dataRecoveryExtractResult && (
              <span
                className={
                  dataRecoveryExtractResult.success
                    ? "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"
                    : "inline-flex items-center gap-1.5 text-xs font-medium text-rose-700"
                }
              >
                <Download className="h-3.5 w-3.5" />
                {dataRecoveryExtractResult.message}
              </span>
            )}
          </div>
        )}

        {dataRecoveryLog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">
            {dataRecoveryLog.map((entry, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <span className="text-slate-500">{entry.time} </span>
                {entry.message}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Legal disclaimer modal */}
      {disclaimerOp && (
        <DisclaimerModal
          op={disclaimerOp}
          checked={checked}
          onCheckedChange={setChecked}
          onAgree={handleAgree}
          onClose={() => setDisclaimerOp(null)}
          agreeing={agreeing}
          error={consentError}
        />
      )}

      {/* Guided hardware Connection Wizard (key combo → listen → execute → success) */}
      {wizard && (
      <ConnectionWizardModal
        op={wizard.op}
        guide={wizard.guide}
        brand={selectedBrand ?? brand}
        model={(selectedModel || modelInput).trim() || model}
        lines={wizard.lines}
        hardware={wizard.hardware}
        phase={wizard.phase}
        errorMessage={wizard.error}
        onStart={() => void handleWizardStart()}
        onCancel={handleWizardCancel}
      />
      )}

      {/* Samsung FRP Recovery Wizard (manual-guided multi-step path) */}
      {samsungWizardOpen && brand === "Samsung" && (
      <SamsungFrpWizard
        open={samsungWizardOpen}
        onClose={() => setSamsungWizardOpen(false)}
        brand="Samsung"
        model={(selectedModel || modelInput).trim() || model}
        androidVersion={androidVersion}
        onStartEngine={() => window.frpb.device.frpBypass({
          brand: "Samsung",
          mode: "recovery",
          model: (selectedModel || modelInput).trim() || undefined,
        })}
      />
      )}

      {/* Explicit error toast — real non-zero exit codes / unauthorized ADB. */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2"
        >
          <div
            className={
              toast.tone === "error"
                ? "flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-xl shadow-rose-100"
                : "flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            }
          >
            <AlertTriangle
              className={
                toast.tone === "error"
                  ? "mt-0.5 h-5 w-5 shrink-0 text-rose-500"
                  : "mt-0.5 h-5 w-5 shrink-0 text-slate-400"
              }
            />
            <p className="flex-1 whitespace-pre-wrap break-words text-sm text-slate-700">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
