import { useState, useCallback, useRef, useEffect } from "react";
import type { FrpBypassState, FrpBypassResult, FrpBypassStatus, FrpMethodId, FrpMethodMeta } from "@frpb/shared";
import { frpMethodsForBrand, FRP_BRANDS } from "@frpb/shared";
import {
  ShieldCheck,
  Smartphone,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Wifi,
  Cpu,
  Zap,
  Box,
  Download,
} from "lucide-react";

// ─── Step constants ──────────────────────────────────────────────────────────
type Step = "device" | "method" | "consent" | "running" | "result";

// ─── Operation event subscription ──────────────────────────────────────────
// In the desktop app the main process emits progress events; in web preview
// mode these are simulated locally. This hook normalises both paths.

interface UseFrpOperationReturn {
  state: FrpBypassState;
  start: (brand: string, method: FrpMethodId, deviceInfo: DeviceInfo) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

interface DeviceInfo {
  brand: string;
  model: string;
  androidVersion?: string;
  imei?: string;
}

/** Map a frontend FrpMethodId to the backend OperationMode the engine expects. */
function mapMethodToOperationMode(method: FrpMethodId, brand: string): "test-mode" | "brom" | "fastboot-recovery" {
  // MediaTek BROM is a distinct low-level transport — use it when explicitly selected
  // or when the brand is MediaTek-based (Xiaomi/Redmi/vivo/realme/TECNO/Infinix/itel).
  if (method === "mtk-brom") return "brom";
  if (method === "download-mode") {
    // Download / Bootloader mode — the user has already put the phone in this mode.
    // The engine's "fastboot-recovery" transport profile accepts any Android vendor
    // presenting a 0xFF interface class (Fastboot / Download / Recovery), so route
    // through that profile and let the USB scan detect the actual transport.
    return "fastboot-recovery";
  }
  if (method === "edl-mode") return "fastboot-recovery";
  if (method === "setup-wizard") return "fastboot-recovery";
  if (method === "oem-service") return "fastboot-recovery";
  return "fastboot-recovery";
}

/** Format a duration in whole seconds as `m:ss`. */
function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Ticking elapsed-time counter (whole seconds); resets and only ticks while `active`. */
function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setSeconds(0);
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  return seconds;
}

export function useFrpOperation(): UseFrpOperationReturn {
  const [state, setState] = useState<FrpBypassState>({
    status: "idle",
    currentStep: "",
    progress: 0,
    message: "",
  });

  const controller = useRef<AbortController | null>(null);

  function reset() {
    setState({ status: "idle", currentStep: "", progress: 0, message: "" });
    controller.current = null;
  }

  async function start(brand: string, method: FrpMethodId, info: DeviceInfo) {
    reset();
    controller.current = new AbortController();

    setState({
      status: "preparing",
      currentStep: "Preparing unlock session…",
      progress: 5,
      message: `Selected ${brand} · ${method}`,
    });

    // Reliably detect whether the real Electron bridge is present (not just any
    // object on window). In web-preview mode the mock bridge exposes device.* but
    // the real preload bridge is the one backed by the main process.
    const isElectron = typeof window !== "undefined" && (window as any).frpb?.device?.frpBypass;

    if (isElectron) {
      // Subscribe to operation events emitted by the main process so the UI
      // reflects live progress (wiping, rebooting, etc.) instead of only the
      // final result. Unsubscribe when the operation completes.
      const unsub = (window as any).frpb.device.onOperationEvent(
        (event: { op: string; stage: string; message: string; pct: number }) => {
          setState((prev) => ({
            ...prev,
            currentStep: event.stage,
            progress: event.pct,
            message: event.message,
          }));
        }
      );

      const mode = mapMethodToOperationMode(method, brand);
      setState({ status: "running", currentStep: "Connecting to device…", progress: 10, message: "" });
      try {
        const res = await (window as any).frpb.device.frpBypass({
          brand: brand,
          mode: mode,
        });
        setState({
          status: "completed",
          currentStep: "Complete",
          progress: 100,
          message: res.message ?? "FRP lock removed successfully.",
          result: res,
        });
      } catch (err) {
        setState({
          status: "failed",
          currentStep: "Failed",
          progress: 100,
          message: err instanceof Error ? err.message : "Operation failed.",
        });
      } finally {
        unsub?.();
      }
      return;
    }

    // ── Web preview simulation (no real phone) ──
    const phases: Array<{ step: string; pct: number; message: string }> = [
      { step: "Detecting device model…", pct: 15, message: `Analyzing ${brand} ${info.model}` },
      { step: "Applying unlock method…", pct: 35, message: `Using ${method.replace("-", " ")} approach` },
      { step: "Communicating with device…", pct: 55, message: "Sending unlock instructions" },
      { step: "Completing FRP removal…", pct: 75, message: "Finalizing device access" },
      { step: "Verifying unlock…", pct: 90, message: "Checking device state" },
    ];

    for (let i = 0; i < phases.length; i++) {
      if (controller.current?.signal.aborted) return;
      const phase = phases[i];
      if (!phase) continue;
      setState({
        status: "running",
        currentStep: phase.step,
        progress: phase.pct,
        message: phase.message,
      });
      await new Promise((r) => setTimeout(r, 700));
    }

    setState({
      status: "completed",
      currentStep: "Complete",
      progress: 100,
      message: "FRP lock removed successfully. You can now set up the device with a new Google account.",
      result: {
        success: true,
        message: "FRP lock removed successfully.",
        bypassedAccount: "google",
        steps: phases.map((p) => p.step),
      },
    });
  }

  function cancel() {
    controller.current?.abort();
    setState({ status: "idle", currentStep: "", progress: 0, message: "" });
  }

  return { state, start, cancel, reset };
}

// ─── Main wizard component ──────────────────────────────────────────────────

interface FrpUnlockWizardProps {
  onBack: () => void;
}

export default function FrpUnlockWizard({ onBack }: FrpUnlockWizardProps) {
  const [step, setStep] = useState<Step>("device");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [androidVersion, setAndroidVersion] = useState("");
  const [imei, setImei] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<FrpMethodId | null>(null);
  const [methods, setMethods] = useState<FrpMethodMeta[]>([]);
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [acceptingConsent, setAcceptingConsent] = useState(false);
  const operationUnsub = useRef<(() => void) | null>(null);
  const { state, start, cancel, reset } = useFrpOperation();
  // Kept at the top level of the component (never inside a conditional branch)
  // so React's hooks order stays stable across every rendered step.
  const elapsed = useElapsed(step === "running");

  // Derive available methods when brand changes
  useEffect(() => {
    if (brand) setMethods(frpMethodsForBrand(brand));
    else setMethods([]);
  }, [brand]);

  const canProceedDevice = brand.trim().length > 0 && model.trim().length > 0;
  const canProceedMethod = selectedMethod !== null;
  const isRunning = state.status === "running" || state.status === "preparing" || state.status === "waiting-device" || state.status === "detecting";
  const isDone = state.status === "completed" || state.status === "failed";
  const isIdle = state.status === "idle";
  const isConsent = step === "consent";
  const canProceedConsent = acceptedConsent && selectedMethod !== null && brand.trim().length > 0;

  // Accept the legal disclaimer via the IPC bridge, then start the operation.
  async function acceptAndProceed() {
    if (!acceptedConsent || !selectedMethod || !brand) return;
    setAcceptingConsent(true);
    // Advance to the running/progress screen immediately so the user sees live
    // status while the consent call + unlock operation are in flight.
    setStep("running");
    try {
      // 1. Record consent in the main process so verifyOperationReady can proceed.
      await (window as any).frpb.device.acceptConsent("frp-bypass");
      // 2. Start the FRP bypass (maps method -> backend OperationMode, sends
      //    a single OperationOptions object — not positional args).
      await start(brand, selectedMethod, { brand, model, androidVersion, imei });
    } finally {
      setAcceptingConsent(false);
    }
  }

  // ── Step 1: Device info ──
  if (step === "device") {
    return (
      <div className="frpb-card max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900">Remove Google FRP Lock</h2>
          </div>
          <button onClick={onBack} className="frpb-btn-ghost px-3 py-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500">
            Follow the guided steps to remove the Google FRP lock from your Android device.
            You must be the legitimate owner or have authorization.
          </p>

          {/* Brand selection */}
          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Device brand *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FRP_BRANDS.slice(0, 16).map((b) => (
                <button
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    brand === b
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {b}
                </button>
              ))}
              {FRP_BRANDS.length > 16 && (
                <button
                  onClick={() => setBrand("Other")}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    brand === "Other"
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  + More
                </button>
              )}
            </div>
          </div>

          {/* Model input */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Device model *
            </label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Galaxy S21, Redmi Note 12, Pixel 6…"
              className="frpb-input w-full"
            />
          </div>

          {/* Android version */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Android version (optional)
            </label>
            <input
              value={androidVersion}
              onChange={(e) => setAndroidVersion(e.target.value)}
              placeholder="e.g. Android 13, Android 14…"
              className="frpb-input w-full"
            />
          </div>

          {/* IMEI (for online unlock path) */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              IMEI / Serial (optional — for online unlock)
            </label>
            <input
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
              placeholder="15-digit IMEI number"
              className="frpb-input w-full font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Leave blank if using the desktop (USB) unlock method.
            </p>
          </div>

          {/* Legal note */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This tool is intended for legitimate device owners only. You must own the device or have
              explicit written authorization. Unauthorized use on devices you do not own is illegal.
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={() => setStep("method")}
            disabled={!canProceedDevice}
            className="frpb-btn-primary mt-6 w-full py-3 text-sm font-bold disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Method selection ──
  if (step === "method") {
    return (
      <div className="frpb-card max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900">Select Unlock Method</h2>
          </div>
          <button onClick={() => setStep("device")} className="frpb-btn-ghost px-3 py-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500">
            Choose the unlock method for your <strong>{brand} {model}</strong>.
            Each method has different requirements — review before proceeding.
          </p>

          <div className="mt-5 space-y-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => m.available && setSelectedMethod(m.id)}
                disabled={!m.available}
                className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                  selectedMethod === m.id
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                    : "border-slate-200 bg-white"
                } ${!m.available ? "opacity-50" : "hover:border-slate-300"}`}
              >
                {m.id === "setup-wizard" && <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />}
                {m.id === "download-mode" && <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />}
                {m.id === "edl-mode" && <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />}
                {m.id === "mtk-brom" && <Box className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />}
                {m.id === "oem-service" && <Zap className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />}

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{m.label}</span>
                    {!m.available && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Not available
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{m.desc}</p>
                  <p className="mt-2 text-xs text-slate-400">{m.instruction}</p>
                  {m.targetAndroid && (
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {m.targetAndroid}
                    </span>
                  )}
                </div>
                {m.available && (
                  <div className="shrink-0">
                    {selectedMethod === m.id ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-500" />
                    ) : (
                      <ArrowRight className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep("device")}
              className="frpb-btn-ghost flex-1 py-3 text-sm"
            >
              Back
            </button>
            <button
              onClick={() => setStep("consent")}
              disabled={!canProceedMethod || isRunning}
              className="frpb-btn-primary flex-1 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? "Running…" : "Start Unlock"} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Consent (must be accepted before running) ──
  if (step === "consent") {
    return (
      <div className="frpb-card max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900">Legal Disclaimer</h2>
          </div>
          <button onClick={() => setStep("method")} className="frpb-btn-ghost px-3 py-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500">
            Read and accept the legal disclaimer to proceed with the FRP unlock operation for your{" "}
            <strong>{brand} {model}</strong>.
          </p>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800">Important — Read before proceeding</p>
              <ul className="mt-2 space-y-1.5 text-slate-600">
                <li>
                  This tool is intended for legitimate device owners only. You must be the rightful owner of the
                  device you are unlocking, or have explicit written authorization from the owner.
                </li>
                <li>
                  By proceeding, you confirm that you own this device or have authorization to unlock it.
                </li>
                <li>
                  Bypassing FRP (Factory Reset Protection) on a device you do not own is illegal and violates the
                  terms of service. FRPB does not and cannot disable Google's FRP security — the tool performs a
                  data wipe and presents standard account-recovery guidance after the operation.
                </li>
                <li>
                  All operations are logged for audit purposes. Unauthorized use may result in license revocation
                  and legal action.
                </li>
              </ul>
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              checked={acceptedConsent}
              onChange={(e) => setAcceptedConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the disclaimer above. I confirm that I am the legitimate owner or authorized
              representative of this device.
            </span>
          </label>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep("method")}
              className="frpb-btn-ghost flex-1 py-3 text-sm"
            >
              Back
            </button>
            <button
              onClick={acceptAndProceed}
              disabled={!acceptedConsent}
              className="frpb-btn-primary flex-1 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {acceptingConsent ? "Accepting…" : "I Accept & Continue"} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 4: Running / progress ──
  if (step === "running") {
    const isActive = isRunning;

    return (
      <div className="frpb-card max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            <h2 className="text-base font-bold text-slate-900">Unlocking…</h2>
          </div>
          <button
            onClick={cancel}
            disabled={!isActive}
            className="frpb-btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="p-6">
          {/* Device status card */}
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100">
              <Smartphone className="h-4 w-4 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">Device</p>
              <p className="mt-0.5 text-sm text-slate-600 truncate">
                <strong>{brand}</strong> {model}
                {androidVersion && <span className="text-slate-400"> · {androidVersion}</span>}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>Connected</span>
                <span className="text-slate-300">·</span>
                <span>Download Mode</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-400">Elapsed</p>
              <p className="text-sm font-semibold text-slate-700">{formatElapsed(elapsed)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium">{state.currentStep}</span>
              <span className="font-semibold">{state.progress}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-linear"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>

          {/* Current operation message */}
          <div className="mb-2 flex items-start gap-2.5 rounded-lg bg-brand-50 p-4 text-sm">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-500" />
            <span className="text-slate-700">{state.message || "Processing..."}</span>
          </div>

          {/* Success / error states */}
          {state.status === "completed" && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold text-emerald-700">Complete</p>
                <p className="mt-0.5 text-emerald-600">{state.message}</p>
              </div>
            </div>
          )}

          {state.status === "failed" && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <p className="font-semibold text-rose-700">Unsuccessful</p>
                <p className="mt-0.5 text-rose-600">{state.message}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStep(isDone ? "result" : "device")}
              className="frpb-btn-ghost flex-1 py-3 text-sm"
              disabled={!isDone}
            >
              {isDone ? "Done" : "Back"}
            </button>
            {isDone && (
              <button
                onClick={() => {
                  reset();
                  setStep("device");
                }}
                className="frpb-btn-primary flex-1 py-3 text-sm font-bold"
              >
                Unlock Another Device →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 4: Result ──
  if (step === "result" || isDone) {
    return (
      <div className="frpb-card max-w-2xl mx-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            {state.status === "completed" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            )}
            <h2 className="text-base font-bold text-slate-900">
              {state.status === "completed" ? "Unlocked" : "Unsuccessful"}
            </h2>
          </div>
          <button
            onClick={() => {
              reset();
              setStep("device");
            }}
            className="frpb-btn-ghost px-3 py-1.5 text-xs"
          >
            Unlock Another Device
          </button>
        </div>

        <div className="p-6">
          <div
            className={`mt-4 rounded-xl border p-5 ${
              state.status === "completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <p className="text-sm font-semibold">
              {state.status === "completed" ? "FRP Lock Removed" : "Unlock Failed"}
            </p>
            <p className="mt-2 text-sm">{state.message}</p>
            {state.result?.steps && (
              <ul className="mt-3 space-y-1 text-xs">
                {state.result.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            After FRP removal, you can set up the device with a new Google account. Make sure to remove
            the old account from the device settings if possible.
          </p>

          <button
            onClick={() => {
              reset();
              setStep("device");
            }}
            className="frpb-btn-primary mt-6 w-full py-3 text-sm font-bold"
          >
            Start New Unlock →
          </button>
        </div>
      </div>
    );
  }

  return null;
}
