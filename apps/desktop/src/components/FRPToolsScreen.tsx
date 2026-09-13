import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Power, RotateCcw, Terminal, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ChipsetFamily,
  DeviceAutoDetected,
  ManualModeGuide,
  PrimaryAction,
} from "@frpb/shared";
import { manualModeGuideFor } from "@frpb/shared";
import type {
  ConsentState,
  DeviceInfoSnapshot,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  OperationEvent,
  OperationKind,
  OperationResult,
  RebootMode,
} from "../lib/ipc";
import ActionScreen, { type ActionProgress } from "./frp/ActionScreen";
import DisclaimerModal from "./frp/DisclaimerModal";
import ManualModeModal from "./frp/ManualModeModal";
import type { ConnectionGuideKey } from "./frp/shared";

interface LogEntry {
  time: string;
  message: string;
}

const MAX_LOG_ENTRIES = 200;

/** Brand → locked-device transport mode used by the engine handshake. */
const MODE_BY_BRAND: Record<string, ConnectionGuideKey> = {
  Samsung: "test-mode",
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
function AutoReadPanel({ info }: { info: DeviceInfoSnapshot | null }) {
  const connected = Boolean(info?.connected);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
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
        <span className="text-[11px] text-slate-400">
          {info
            ? `${info.mode ?? (connected ? "Connected" : "Disconnected")} · ${new Date(
                info.lastScanAt
              ).toLocaleTimeString()}`
            : "scanning…"}
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
  // Which Quick Boot Switcher target is currently being requested (spinner).
  const [rebootingMode, setRebootingMode] = useState<RebootMode | null>(null);
  // Explicit error toast (non-zero exit code / unauthorized ADB / spawn failure).
  const [toast, setToast] = useState<{ message: string; tone: "error" | "info" } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);

  // G. Auto-detection engine ("device:auto-detected") — drives the header badge
  // and auto-sets the brand context the instant a phone is plugged in.
  const [autoDetected, setAutoDetected] = useState<DeviceAutoDetected | null>(null);

  // H. Manual key-combination fallback popup.
  const [manualGuide, setManualGuide] = useState<ManualModeGuide | null>(null);
  const manualContinueRef = useRef<(() => void) | null>(null);

  // Continuous auto-read hardware snapshot (`device:info-updated`).
  const [hwInfo, setHwInfo] = useState<DeviceInfoSnapshot | null>(null);

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
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Operation failed to start.";
      setResult({ success: false, message });
      appendLog(message);
      showToast(message);
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
        }));
        setDisclaimerOp(null);
        setChecked(false);
        void runOperation(op);
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

  // Part 3 — manual-mode fallback. When the selected model strictly requires a
  // hardware key combination, present the step-by-step popup first; the actual
  // operation only starts once the user confirms.
  function beginManualMode(action: PrimaryAction) {
    const guide = manualModeGuideFor(
      selectedBrand,
      (selectedModel || modelInput).trim() || null,
      chipset
    );
    manualContinueRef.current = () => {
      setManualGuide(null);
      manualContinueRef.current = null;
      if (action === "flash-reset") {
        handleFlashReset(true);
      } else {
        handleFrpBypass(true);
      }
    };
    setManualGuide(guide);
  }

  function handleManualContinue() {
    const fn = manualContinueRef.current;
    if (fn) fn();
  }

  function handleManualCancel() {
    manualContinueRef.current = null;
    setManualGuide(null);
  }

  // Step 3 — the two primary actions, with manual-mode fallback + consent gating.
  function handleFlashReset(skipManual = false) {
    if (busy) return;
    if (needsAuth) {
      showToast("Device is not authorized — accept the USB debugging prompt on the phone.");
      return;
    }
    if (!skipManual && requiresManualMode) {
      beginManualMode("flash-reset");
      return;
    }
    if (!flashConsented) {
      openDisclaimer("flash-reset");
    } else {
      void runOperation("flash-reset");
    }
  }

  function handleFrpBypass(skipManual = false) {
    if (busy) return;
    if (needsAuth) {
      showToast("Device is not authorized — accept the USB debugging prompt on the phone.");
      return;
    }
    if (!skipManual && requiresManualMode) {
      beginManualMode("frp-bypass");
      return;
    }
    if (!frpConsented) {
      openDisclaimer("frp-bypass");
    } else {
      void runOperation("frp-bypass");
    }
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

  // Derived state
  const isConnected =
    Boolean(status?.connected) || status?.state === "CONNECTED" || Boolean(autoDetected?.detected);
  const needsAuth = Boolean(status?.connected) && status?.authorized === false;
  const flashConsented = Boolean(consent?.flashReset);
  const frpConsented = Boolean(consent?.frpBypass);
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

      {/* Part 3 — manual key-combination fallback popup */}
      {manualGuide && (
        <ManualModeModal
          guide={manualGuide}
          onContinue={handleManualContinue}
          onCancel={handleManualCancel}
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
