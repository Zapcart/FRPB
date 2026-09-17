import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  PlugZap,
  RotateCcw,
  X,
} from "lucide-react";
import type { HardwareSnapshot, OperationKind } from "../../lib/ipc";
import { opLabel, type ConnectionGuide } from "./shared";

/** Wizard lifecycle phase. */
export type WizardPhase =
  | "instructions" // step-by-step key combination shown, waiting for the user
  | "listening" // engine is polling USB/COM for the target interface
  | "executing" // interface detected — handshake / payload running
  | "success" // device reset acknowledged, rebooting
  | "error"; // operation failed

interface ConnectionWizardModalProps {
  op: OperationKind;
  guide: ConnectionGuide;
  brand: string | null;
  model: string | null;
  /** Live console lines streamed by the hardware listen loop. */
  lines: string[];
  /** Latest hardware snapshot (null until the interface is detected). */
  hardware: HardwareSnapshot | null;
  phase: WizardPhase;
  /** Failure text when `phase === "error"`. */
  errorMessage?: string | null;
  /** Begin listening — the user has performed the key combination. */
  onStart: () => void;
  onCancel: () => void;
}

const MODE_TONE: Record<string, string> = {
  brom: "bg-amber-50 text-amber-700 border-amber-200",
  preloader: "bg-amber-50 text-amber-700 border-amber-200",
  edl: "bg-violet-50 text-violet-700 border-violet-200",
  fastboot: "bg-emerald-50 text-emerald-700 border-emerald-200",
  download: "bg-emerald-50 text-emerald-700 border-emerald-200",
  mtp: "bg-brand-50 text-brand-700 border-brand-200",
  serial: "bg-slate-50 text-slate-600 border-slate-200",
  adb: "bg-slate-50 text-slate-600 border-slate-200",
  none: "bg-slate-50 text-slate-500 border-slate-200",
};

/**
 * Guided hardware Connection Wizard (ADB-free).
 *
 * Shown the instant the user triggers Flash Reset / FRP Bypass: it presents the
 * exact key combination and numbered steps, then — once the user confirms — runs
 * a live hardware listen loop that auto-advances to "Executing…" the moment the
 * BROM / EDL / Fastboot interface is detected on the USB bus, streaming console
 * lines the whole way, and finishes on a "Device Successfully Reset / Rebooting"
 * success state. Nothing here requires an ADB session or USB debugging.
 */
export default function ConnectionWizardModal({
  op,
  guide,
  brand,
  model,
  lines,
  hardware,
  phase,
  errorMessage,
  onStart,
  onCancel,
}: ConnectionWizardModalProps) {
  const listening = phase === "listening";
  const detected = hardware?.connected ?? false;
  const tone = MODE_TONE[hardware?.mode ?? "none"] ?? MODE_TONE.none;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100">
            {phase === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : phase === "error" ? (
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            ) : (
              <PlugZap className="h-5 w-5 text-brand-600" />
            )}
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">
              {phase === "success"
                ? "Device Successfully Reset"
                : phase === "error"
                  ? `${opLabel(op)} failed`
                  : `${opLabel(op)} — Connection Wizard`}
            </h3>
            <p className="text-xs text-slate-500">
              {[brand, model].filter(Boolean).join(" ") || guide.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Success state */}
          {phase === "success" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </span>
              <p className="text-base font-bold text-slate-900">
                Device Successfully Reset / Rebooting
              </p>
              <p className="max-w-sm text-xs text-slate-500">
                The userdata & FRP partitions were cleared. The phone will reboot on its own —
                do not disconnect until it restarts.
              </p>
            </div>
          ) : (
            <>
              {/* Detection status card */}
              <div className={`rounded-xl border px-4 py-3 ${detected ? tone : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    {listening && !detected ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5" />
                    )}
                    {detected ? "Hardware Interface Detected" : "Hardware Interface"}
                  </span>
                  <span className="text-[11px] font-medium opacity-80">
                    {detected ? hardware?.label : guide.modeChip}
                  </span>
                </div>
                {detected ? (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
                    <Detail label="VID:PID" value={`${hardware?.vidHex ?? "—"}:${hardware?.pidHex ?? "—"}`} />
                    <Detail label="COM Port" value={hardware?.port ?? "—"} />
                    <Detail label="Chipset" value={hardware?.chipset ?? "—"} />
                    <Detail
                      label="Instance ID"
                      value={hardware?.deviceInstanceId ?? "—"}
                      wide
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {listening
                      ? guide.listeningLabel
                      : "Follow the steps below, then start the hardware listen."}
                  </p>
                )}
              </div>

              {/* Key combination */}
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                  Button combination
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-900">{guide.keyCombo}</div>
              </div>

              {/* Step-by-step instructions */}
              <ol className="mt-4 space-y-2.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700">
                      {step.title}
                      {step.detail && (
                        <span className="mt-0.5 block text-xs text-slate-400">{step.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              {/* Live console */}
              {lines.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Hardware Console
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                    {lines.map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.includes("[SUCCESS]")
                            ? "text-emerald-300"
                            : line.includes("[ERROR]") || line.startsWith("!")
                              ? "text-rose-300"
                              : line.includes("[INFO]")
                                ? "text-sky-300"
                                : ""
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase === "error" && errorMessage && (
                <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {phase === "success" ? (
            <button
              type="button"
              onClick={onCancel}
              className="frpb-btn-primary px-4 py-2 text-sm"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="frpb-btn-ghost px-4 py-2 text-sm"
                disabled={phase === "executing"}
              >
                Cancel
              </button>
              {phase === "instructions" || phase === "error" ? (
                <button
                  type="button"
                  onClick={onStart}
                  className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <PlugZap className="h-4 w-4" />
                  I've connected the device — start
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm opacity-80"
                >
                  {phase === "listening" ? (
                    <>
                      <RotateCcw className="h-4 w-4 animate-spin" />
                      Listening for hardware…
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Flashing in Progress...
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small label/value pair used by the detection status grid. */
function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-60">{label}</div>
      <div className="truncate font-mono">{value}</div>
    </div>
  );
}
