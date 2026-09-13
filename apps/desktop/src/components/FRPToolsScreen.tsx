import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type {
  ConsentState,
  DeviceLogPayload,
  DeviceModelsResult,
  DeviceStatus,
  OperationEvent,
  OperationKind,
  OperationResult,
  RebootMode,
} from "../lib/ipc";
import HomeScreen from "./frp/HomeScreen";
import BrandScreen from "./frp/BrandScreen";
import MethodScreen from "./frp/MethodScreen";
import DisclaimerModal from "./frp/DisclaimerModal";
import ComingSoonModal from "./frp/ComingSoonModal";
import { connectionGuideFor, methodsForBrand } from "./frp/shared";

type Screen = "home" | "brand" | "method";
type ComingSoonKind = "wireless" | "location" | null;

interface LogEntry {
  time: string;
  message: string;
}

const MAX_LOG_ENTRIES = 200;

/**
 * FRP Tools — 3-screen wizard:
 *   1. USB Connection home (connect + pick a feature)
 *   2. Brand selection (radio grid, 19 brands)
 *   3. Method selection → legal disclaimer modal → FRP bypass
 *
 * All operations are ADB-driven from the main process via `window.frpb.device`.
 * Detection is brand-agnostic; brand selection only tunes which methods are
 * offered. Unlock Android Screen runs the ADB lock-screen removal flow;
 * Location Change is the remaining UI "Coming Soon" card.
 */
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
  // Screen navigation
  const [screen, setScreen] = useState<Screen>("home");
  const [tab, setTab] = useState<"usb" | "wireless">("usb");

  // B. Model (auto-detected + manual entry)
  const [detectedModel, setDetectedModel] = useState<string | undefined>(undefined);
  const [modelInput, setModelInput] = useState("");

  // C. Brand + method selection
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"general" | "mediatek">("general");

  // D. Legal disclaimer consent (modal, op-aware)
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [disclaimerOp, setDisclaimerOp] = useState<OperationKind | null>(null);
  const [checked, setChecked] = useState(false);
  const [agreeing, setAgreeing] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // E. Operation progress + log
  const [runningOp, setRunningOp] = useState<OperationKind | null>(null);
  const [opProgress, setOpProgress] = useState<{
    stage: string;
    message: string;
    pct: number;
  } | null>(null);
  const [opLog, setOpLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<OperationResult | null>(null);
  // Which Quick Boot Switcher target is currently being requested (spinner).
  const [rebootingMode, setRebootingMode] = useState<RebootMode | null>(null);
  // Explicit error toast (non-zero exit code / unauthorized ADB / spawn failure).
  const [toast, setToast] = useState<{ message: string; tone: "error" | "info" } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);

  // F. "Coming soon" modal
  const [comingSoon, setComingSoon] = useState<ComingSoonKind>(null);

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

  // Device status is managed by the shared useDevice() hook lifted to
  // MainDashboard — Device Monitor and FRP Tools render the exact same state.
  // Manual refresh flows through the onRefresh prop from useDevice().refresh().

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

  // E. Operation events → progress + log. Events for the wrong op (or stale
  // events while idle) are ignored. Unsubscribed on unmount.
  useEffect(() => {
    const unsubscribe = window.frpb.device.onOperationEvent((event: OperationEvent) => {
      if (!runningOpRef.current || event.op !== runningOpRef.current) return;
      setOpProgress({
        stage: event.stage,
        message: event.message,
        pct: Math.max(0, Math.min(100, event.pct)),
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
    setOpProgress(null);
    setOpLog([]);
    const guide = connectionGuideFor(selectedBrand, selectedMethod);
    const options = { brand: selectedBrand, mode: guide.key, model: modelInput.trim() || undefined };
    try {
      const res: OperationResult =
        op === "flash-reset"
          ? await window.frpb.device.flashReset(options)
          : op === "unlock-screen"
            ? await window.frpb.device.unlockScreen(options)
            : await window.frpb.device.frpBypass(options);
      setResult(res);
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

  // Wizard navigation handlers
  function handleOpenFrp() {
    if (busy) return;
    setScreen("brand");
  }

  function handleBrandStart() {
    if (!selectedBrand || busy) return;
    if (!modelInput.trim()) setModelInput(selectedBrand);
    setSelectedMethod("general");
    setScreen("method");
  }

  function handleStart() {
    if (!selectedBrand || busy) return;
    if (!frpConsented) {
      openDisclaimer("frp-bypass");
    } else {
      void runOperation("frp-bypass");
    }
  }

  function handleFlashReset() {
    if (busy) return;
    if (needsAuth) {
      showToast("Device is not authorized — accept the USB debugging prompt on the phone.");
      return;
    }
    if (!flashConsented) {
      openDisclaimer("flash-reset");
    } else {
      void runOperation("flash-reset");
    }
  }

  function handleUnlockScreen() {
    if (busy) return;
    // Unlock screen requires ADB authorization — show consent modal for legal disclaimer
    if (needsAuth) {
      showToast("Device is not authorized — accept the USB debugging prompt on the phone.");
      return;
    }
    if (!consent?.unlockScreen) {
      openDisclaimer("unlock-screen");
    } else {
      void runOperation("unlock-screen");
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
  const isConnected = Boolean(status?.connected) || status?.state === "CONNECTED";
  const needsAuth = isConnected && status?.authorized === false;
  const deviceLabel = [status?.brand, status?.model, status?.serial]
    .filter(Boolean)
    .join(" · ");
  const lastRefreshAt = status?.lastScanAt ?? null;
  const flashConsented = Boolean(consent?.flashReset);
  const frpConsented = Boolean(consent?.frpBypass);
  const busy = runningOp !== null || operationRunning;
  const modelReady = modelInput.trim().length > 0;
  const canStart = isConnected && modelReady && selectedBrand !== null;
  const methods = methodsForBrand(selectedBrand);
  const guide = connectionGuideFor(selectedBrand, selectedMethod);

  return (
    <div className="flex flex-col gap-5">
      {screen === "home" && (
        <HomeScreen
          status={status}
          lastRefreshAt={lastRefreshAt}
          isConnected={isConnected}
          needsAuth={needsAuth}
          deviceLabel={deviceLabel}
          tab={tab}
          onTabChange={setTab}
          onRefresh={handleManualRefresh}
          onOpenFrp={handleOpenFrp}
          onUnlockScreen={handleUnlockScreen}
          onComingSoon={(kind) => setComingSoon(kind)}
          onRebootMode={handleRebootMode}
          rebootingMode={rebootingMode}
          busy={busy}
        />
      )}

      {screen === "brand" && (
        <BrandScreen
          selectedBrand={selectedBrand}
          onSelectBrand={setSelectedBrand}
          onBack={() => setScreen("home")}
          onStart={handleBrandStart}
          canStart={canStart}
          busy={busy}
          detectedBrand={status?.brand}
          detectedModel={detectedModel}
          modelInput={modelInput}
          onModelChange={setModelInput}
          isConnected={isConnected}
        />
      )}

      {screen === "method" && (
        <MethodScreen
          brand={selectedBrand}
          methods={methods}
          guide={guide}
          selectedMethod={selectedMethod}
          onSelectMethod={setSelectedMethod}
          onBack={() => setScreen("brand")}
          onStart={handleStart}
          onFlashReset={handleFlashReset}
          canStart={canStart}
          busy={busy}
          frpConsented={frpConsented}
          flashConsented={flashConsented}
          runningOp={runningOp}
          opProgress={opProgress}
          result={result}
          opLog={opLog}
          logRef={logRef}
        />
      )}

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

      {/* Coming soon modal */}
      {comingSoon && (
        <ComingSoonModal kind={comingSoon} onClose={() => setComingSoon(null)} />
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
