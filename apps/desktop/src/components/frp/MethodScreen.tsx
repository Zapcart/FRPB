import { type Ref } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Cpu,
  KeyRound,
  Loader2,
  ScrollText,
  Smartphone,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { OperationKind, OperationResult } from "../../lib/ipc";
import type { ConnectionGuide, MethodId, MethodMeta } from "./shared";
import { seriesFooter } from "./shared";

interface MethodScreenProps {
  brand: string | null;
  methods: MethodMeta[];
  /** Locked-device connection guide (key-combo / dial-code) for brand + method. */
  guide: ConnectionGuide;
  selectedMethod: MethodId;
  onSelectMethod: (id: MethodId) => void;
  onBack: () => void;
  onStart: () => void;
  onFlashReset: () => void;
  canStart: boolean;
  busy: boolean;
  frpConsented: boolean;
  flashConsented: boolean;
  runningOp: OperationKind | null;
  opProgress: { stage: string; message: string; pct: number } | null;
  result: OperationResult | null;
  opLog: { time: string; message: string }[];
  logRef: Ref<HTMLDivElement>;
}

/**
 * Screen 3 — Method Selection.
 * "General Unlocking Method" is default; "MediaTek CPU" (NEW) is offered only
 * for brands mapped in BRAND_METHODS (Xiaomi/Redmi today — extensible).
 * The FRP bypass runs after consent; Flash Reset is also available here.
 */
export default function MethodScreen({
  brand,
  methods,
  guide,
  selectedMethod,
  onSelectMethod,
  onBack,
  onStart,
  onFlashReset,
  canStart,
  busy,
  frpConsented,
  flashConsented,
  runningOp,
  opProgress,
  result,
  opLog,
  logRef,
}: MethodScreenProps) {
  const showProgressArea = busy || opProgress || result || opLog.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="frpb-card p-6">
        <button
          onClick={onBack}
          disabled={busy}
          className="frpb-btn-ghost mb-4 px-3 py-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <h2 className="text-lg font-bold text-slate-900">Select Unlocking Method</h2>
        <p className="mt-1 text-sm text-slate-500">
          {brand ? `Device brand: ${brand}` : "Device brand: detected automatically"} — choose a
          method below. Not sure which chip? Select one. If it fails, try the other.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {methods.map((method) => {
            const active = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => method.available && onSelectMethod(method.id)}
                disabled={!method.available || busy}
                className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {method.badge === "new" && (
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    NEW
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-brand-500 bg-brand-500" : "border-slate-300"
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </span>
                  {method.id === "mediatek" ? (
                    <Cpu className="h-4 w-4 text-brand-500" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-brand-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-900">{method.label}</span>
                </div>
                <p className="mt-2 pl-6 text-xs text-slate-500">{method.desc}</p>
                {!method.available && (
                  <p className="mt-2 pl-6 text-[11px] font-medium text-slate-400">
                    Not available for this brand.
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Locked-device connection guide — brand/method driven, no USB debugging required */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white">
          <div className="flex flex-col gap-1.5 border-b border-brand-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                <Smartphone className="h-3.5 w-3.5 text-brand-600" />
              </span>
              Connect your phone — {guide.title}
            </h3>
            <span className="w-fit rounded-full bg-brand-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
              {guide.modeChip}
            </span>
          </div>
          <p className="px-4 pt-3 text-xs leading-relaxed text-slate-500">
            An FRP-locked phone cannot open Android Settings, so USB debugging is never required
            here. Follow these steps — the app waits live for the phone and reports each stage below.
          </p>
          <ol className="space-y-2.5 p-4 pt-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{step.title}</p>
                  {step.detail && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onStart}
          disabled={!canStart || busy}
          className="frpb-btn-primary mt-5 w-full py-3 text-sm font-bold"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            "Start"
          )}
        </button>

        <div className="mt-4 flex flex-col items-center gap-1 border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span className="font-medium text-slate-500">{seriesFooter(brand)}</span>
          <span>Complete bypass: use another account after bypass</span>
        </div>
      </div>

      {/* Flash Reset quick action */}
      <div className="frpb-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
            <KeyRound className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Flash Reset</h3>
            <p className="text-xs text-slate-500">
              Wipe user data and clear the lock screen via ADB recovery. Requires the legal
              disclaimer.
            </p>
          </div>
        </div>
        <button
          onClick={onFlashReset}
          disabled={!canStart || busy}
          className="frpb-btn-ghost shrink-0 px-3 py-1.5 text-xs"
        >
          {flashConsented ? "Run Flash Reset" : "Accept disclaimer to enable"}
        </button>
      </div>

      {/* Progress + log + result */}
      {showProgressArea && (
        <div className="frpb-card p-5">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Progress</h3>
          </div>

          {opProgress && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {opProgress.stage
                    ? opProgress.stage.charAt(0).toUpperCase() + opProgress.stage.slice(1)
                    : "Working…"}
                </span>
                <span className="font-mono text-slate-500">{opProgress.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-300"
                  style={{ width: `${opProgress.pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{opProgress.message}</p>
            </div>
          )}

          {result && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                result.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-medium">{result.success ? "Success" : "Failed"}</p>
                <p>{result.message}</p>
                {result.detail && <p className="mt-1 text-xs opacity-90">{result.detail}</p>}
              </div>
            </div>
          )}

          {opLog.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Operation log
              </p>
              <div
                ref={logRef}
                className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200"
              >
                {opLog.map((entry, i) => (
                  <p key={i}>
                    <span className="text-slate-500">[{entry.time}]</span> {entry.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
