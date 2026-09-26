import { useEffect, useState, useCallback, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Mouse,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { OperationResult } from "../../lib/ipc";

const SAMSUNG_SIDE_SYNC_URL =
  "https://www.samsung.com/africa_en/support/side-sync/";

interface SamsungFrpWizardProps {
  open: boolean;
  onClose: () => void;
  brand: string;
  model: string | null;
  androidVersion: number | null;
  onStartEngine: () => Promise<OperationResult>;
}

type WizardStep =
  | "recovery"
  | "version"
  | "restart"
  | "emergency"
  | "driver-intro"
  | "driver-install"
  | "executing"
  | "success"
  | "failed";

function stepLabel(step: WizardStep): string {
  switch (step) {
    case "recovery":
      return "Recovery Mode";
    case "version":
      return "Android Version";
    case "restart":
      return "Restart";
    case "emergency":
      return "Emergency Dialer";
    case "driver-intro":
      return "Samsung Driver";
    case "driver-install":
      return "Driver Install";
    case "executing":
      return "Running…";
    case "success":
      return "Done";
    case "failed":
      return "Failed";
  }
}

function isBackAllowed(step: WizardStep): boolean {
  return ["recovery", "version", "restart", "emergency"].includes(step);
}

export default function SamsungFrpWizard({
  open,
  onClose,
  brand,
  model,
  androidVersion,
  onStartEngine,
}: SamsungFrpWizardProps) {
  const [step, setStep] = useState<WizardStep>("recovery");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  // Reset state whenever wizard opens
  useEffect(() => {
    if (!open) {
      setStep("recovery");
      setExecuting(false);
      setResult(null);
      setInstallOpen(false);
      return;
    }
    setStep("recovery");
    setExecuting(false);
    setResult(null);
    setInstallOpen(false);
  }, [open]);

  const close = useCallback(() => {
    if (executing) return; // block close during execution
    onClose();
  }, [executing, onClose]);

  const advance = useCallback(
    (next: WizardStep) => {
      setStep(next);
    },
    [],
  );

  const goBack = useCallback(() => {
    const order: WizardStep[] = [
      "recovery",
      "version",
      "restart",
      "emergency",
      "driver-intro",
      "driver-install",
    ];
    const idx = order.indexOf(step);
    if (idx > 0) {
      const prev = order[idx - 1];
      if (prev) setStep(prev);
    }
  }, [step]);

  const runEngine = useCallback(async () => {
    setExecuting(true);
    setResult(null);
    try {
      const res = await onStartEngine();
      setResult(res);
      setStep(res.success ? "success" : "failed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Engine call failed unexpectedly.";
      setResult({ success: false, message });
      setStep("failed");
    } finally {
      setExecuting(false);
    }
  }, [onStartEngine]);

  const handleInstallNow = useCallback(() => {
    setInstallOpen(true);
    setStep("driver-install");
  }, []);

  const handleInstallOk = useCallback(() => {
    setInstallOpen(false);
    setStep("executing");
    runEngine();
  }, [runEngine]);

  const handleAlreadyInstalled = useCallback(() => {
    setStep("executing");
    runEngine();
  }, [runEngine]);

  const handleCloseInstall = useCallback(() => {
    setInstallOpen(false);
    setStep("driver-intro");
  }, []);

  const handleRetry = useCallback(() => {
    setStep("recovery");
    setResult(null);
  }, []);

  const handleSuccessDone = useCallback(() => {
    onClose();
  }, [onClose]);

  // Abortable execution subscription cleanup
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current();
    };
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Samsung FRP Recovery Wizard"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100">
              {step === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : step === "failed" ? (
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              ) : (
                <Smartphone className="h-5 w-5 text-brand-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">
                Samsung FRP Recovery Wizard
              </h3>
              <p className="text-xs text-slate-500">
                {brand}
                {model ? ` · ${model}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={executing && step !== "success" && step !== "failed"}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-40"
              aria-label="Close"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>

          {/* Step progress pills */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 overflow-x-auto">
            {[
              "recovery",
              "version",
              "restart",
              "emergency",
              "driver-intro",
              "driver-install",
              "executing",
            ].map((s) => (
              <span
                key={s}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  step === s
                    ? "bg-brand-100 text-brand-700"
                    : step === "success" || step === "failed"
                    ? "bg-slate-100 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {stepLabel(s as WizardStep)}
              </span>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {step === "recovery" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Phone ko Recovery Mode me lana
                </p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-xs text-amber-800 leading-relaxed">
                      FRP-locked Samsung phone ke liye pehla step:
                      phone ko recovery mode me lana hai.
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 1 — 3 Buttons Press
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        1
                      </span>
                      <span className="text-sm text-slate-700">
                        Phone ko power off karein (bharosemand tareeke se band
                        karein).
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        2
                      </span>
                      <span className="text-sm text-slate-700">
                        3 buttons ko ek sath dabaye rakhein:
                        <strong className="block mt-0.5 text-slate-900">
                          Volume Up + Volume Down + Power Button
                        </strong>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        3
                      </span>
                      <span className="text-sm text-slate-700">
                        Jab phone screen on ho jaye, to sirf{" "}
                        <strong className="text-slate-900">
                          Volume Plus (+ va) aur Power button
                        </strong>{" "}
                        dabaye rakhein.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        4
                      </span>
                      <span className="text-sm text-slate-700">
                        Recovery mode open hoga. Waha aapko{" "}
                        <strong className="text-slate-900">
                          Android version
                        </strong>{" "}
                        ke baare me pata chalega.
                      </span>
                    </li>
                  </ol>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">
                    Note
                  </p>
                  <p className="text-xs text-brand-800">
                    Agar recovery mode nahi open ho raha, to phone ko dubara
                    power on karke try karein. Kuch Samsung models me Bixby/
                    Home button bhi shamil hota hai.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => advance("version")}
                  className="frpb-btn-primary inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-medium"
                >
                  <ChevronRight className="h-4 w-4" />
                  Main Recovery Mode me hoon
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === "version" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Android Version Check
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 2 — Android Version
                  </p>
                  <p className="text-sm text-slate-700 mb-3">
                    Recovery mode screen par aapko phone ka{" "}
                    <strong className="text-slate-900">Android version</strong>{" "}
                    dikhai dega.
                  </p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-700">
                        Detected Android Version:
                      </span>
                      <span className="ml-auto rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-900 border">
                        {androidVersion !== null
                          ? `Android ${androidVersion}`
                          : "— Not auto-detected —"}
                      </span>
                    </div>
                    {androidVersion === null && (
                      <p className="mt-2 text-xs text-slate-500">
                        Agar version dikh raha hai to note kar lein, yaad rakhne
                        ke liye.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="frpb-btn-ghost px-4 py-2 text-sm"
                  >
                    <ArrowBackIcon />
                    Pichhe
                  </button>
                  <button
                    type="button"
                    onClick={() => advance("restart")}
                    className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    Version check kar liya
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "restart" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Phone ko Restart Karna
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 3 — Restart
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        1
                      </span>
                      <span className="text-sm text-slate-700">
                        Recovery mode se phone ko{" "}
                        <strong className="text-slate-900">restart</strong>{" "}
                        karein.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        2
                      </span>
                      <span className="text-sm text-slate-700">
                        Phone reboot hoga aur FRP removal ke liye{" "}
                        <strong className="text-slate-900">option aayega</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">
                    Note
                  </p>
                  <p className="text-xs text-brand-800">
                    Phone restart ke baad FRP screen par aapko option milenge.
                    Jab phone boot ho jaye, agle step par jayein.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="frpb-btn-ghost px-4 py-2 text-sm"
                  >
                    <ArrowBackIcon />
                    Pichhe
                  </button>
                  <button
                    type="button"
                    onClick={() => advance("emergency")}
                    className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    Phone restart ho gaya
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "emergency" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Emergency Mode / Engineering Mode
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 4 — Emergency Dialer
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        1
                      </span>
                      <span className="text-sm text-slate-700">
                        Phone ke{" "}
                        <strong className="text-slate-900">Emergency mode</strong>{" "}
                        me jayein.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        2
                      </span>
                      <span className="text-sm text-slate-700">
                        Dial karte hai:{" "}
                        <strong className="text-slate-900">
                          *#0*
                          {"#"}
                        </strong>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        3
                      </span>
                      <span className="text-sm text-slate-700">
                        Aap{" "}
                        <strong className="text-slate-900">
                          Engineering Mode
                        </strong>{" "}
                        me jayenge.
                      </span>
                    </li>
                  </ol>
                </div>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">
                    Tip
                  </p>
                  <p className="text-xs text-brand-800">
                    *#0*# dial karne ke baad aapko testing menu milenge jahan
                    se aap sensor, display, aur doosre checks kar sakte hain.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="frpb-btn-ghost px-4 py-2 text-sm"
                  >
                    <ArrowBackIcon />
                    Pichhe
                  </button>
                  <button
                    type="button"
                    onClick={() => advance("driver-intro")}
                    className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    Emergency mode open hai
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "driver-intro" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Option 2 — Samsung USB Driver Install
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 5 — Driver
                  </p>
                  <p className="text-sm text-slate-700 mb-3">
                    Samsung phone ke liye USB driver install karna zaroori hai
                    taaki tool phone ko properly identify kar sake.
                  </p>
                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleAlreadyInstalled}
                      className="frpb-btn-secondary inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Already Installed
                    </button>
                    <button
                      type="button"
                      onClick={handleInstallNow}
                      className="frpb-btn-primary inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-medium"
                    >
                      <Download className="h-4 w-4" />
                      Install Now
                      <ExternalLink className="h-3.5 w-3.5 text-brand-400" />
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="text-xs text-amber-800 leading-relaxed">
                      <strong className="font-semibold">Install Now</strong>{" "}
                      dabane par browser me Samsung SideSync page khulegi.
                      Waha se driver download aur install karein.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={goBack}
                  className="frpb-btn-ghost px-4 py-2 text-sm"
                >
                  <ArrowBackIcon />
                  Pichhe
                </button>
              </div>
            )}

            {step === "driver-install" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  Samsung USB Driver Install Karna
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                    Step 5 (continued) — Driver Install
                  </p>
                  {installOpen ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <div className="text-xs text-emerald-800">
                            <strong>Browser open ho gaya hai.</strong> Samsung
                            SideSync page se driver download aur install
                            karein.
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Driver install hone ke baad niche diye gaye "OK" button
                        ko dabayein.
                      </p>
                      <a
                        href={SAMSUNG_SIDE_SYNC_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Samsung SideSync Page kholo
                        <Wifi className="h-3.5 w-3.5" />
                      </a>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCloseInstall}
                          className="frpb-btn-ghost px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleInstallOk}
                          className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          OK — Driver Install Ho Gaya
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div className="text-xs text-amber-800">
                            <strong>Install Now</strong> dabane par browser me{" "}
                            Samsung SideSync page khulegi. Waha se driver
                            download aur install karein.
                          </div>
                        </div>
                      </div>
                      <a
                        href={SAMSUNG_SIDE_SYNC_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Samsung SideSync Page kholo
                        <Wifi className="h-3.5 w-3.5" />
                      </a>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCloseInstall}
                          className="frpb-btn-ghost px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleInstallNow}
                          className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                        >
                          <Download className="h-4 w-4" />
                          Install Now
                          <ExternalLink className="h-3.5 w-3.5 text-brand-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={goBack}
                  className="frpb-btn-ghost px-4 py-2 text-sm"
                >
                  <ArrowBackIcon />
                  Pichhe
                </button>
              </div>
            )}

            {step === "executing" && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-800">
                  FRP Removal Attempt
                </p>
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    {executing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                        <span className="font-medium text-brand-800">
                          Background me FRP remove karne ki koshish…
                        </span>
                      </>
                    ) : result?.success ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="font-medium text-emerald-800">
                          FRP successfully removed
                        </span>
                      </>
                    ) : result ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                        <span className="font-medium text-rose-700">
                          FRP removal failed
                        </span>
                      </>
                    ) : null}
                  </div>
                  {result?.message && (
                    <p className="mt-2 text-xs text-slate-600">
                      {result.message}
                    </p>
                  )}
                </div>
                {executing && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Status
                    </p>
                    <p className="text-sm text-slate-700">
                      Tool background me FRP remove karne ki koshish kar raha
                      hai.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Agar success ho jaye to ye screen green ho jayegi. Agar
                      fail ho jaye to aapko reason dikhai dega.
                    </p>
                  </div>
                )}
                {!executing && result && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Engine Result
                    </p>
                    <p className="text-sm text-slate-700">
                      {result.success
                        ? "FRP lock successfully removed."
                        : result.message}
                    </p>
                    {result.detail && (
                      <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2 whitespace-pre-wrap">
                        {result.detail}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === "success" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </span>
                  <p className="text-base font-bold text-slate-900">
                    FRP Successfully Removed
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Samsung phone ka FRP lock remove ho gaya hai. Phone ko ab
                    normal use kar sakte hain.
                  </p>
                </div>
                {result?.detail && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Details
                    </p>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                      {result.detail}
                    </pre>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSuccessDone}
                  className="frpb-btn-primary inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-medium"
                >
                  Done
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === "failed" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
                    <AlertTriangle className="h-8 w-8 text-rose-600" />
                  </span>
                  <p className="text-base font-bold text-slate-900">
                    FRP Removal Failed
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Samsung phone ka FRP lock remove nahi ho sakaa. Kripya
                    doosri method try karein ya support se sampark karein.
                  </p>
                </div>
                {result && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Error
                    </p>
                    <p className="text-sm text-slate-700">{result.message}</p>
                    {result.detail && (
                      <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2 whitespace-pre-wrap">
                        {result.detail}
                      </pre>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    <Mouse className="h-4 w-4" />
                    Doosri baar try karein
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="frpb-btn-ghost px-4 py-2 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Simple left-arrow icon (replaces lucide ArrowLeft import for consistency). */
function ArrowBackIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={19} y1={12} x2={5} y2={12} />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
