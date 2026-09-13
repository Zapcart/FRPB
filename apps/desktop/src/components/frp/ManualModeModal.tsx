import { AlertTriangle, ArrowRight, X } from "lucide-react";
import type { ManualModeGuide } from "@frpb/shared";

interface ManualModeModalProps {
  guide: ManualModeGuide;
  /** Fired once the user confirms the key combination has been performed. */
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * Manual-mode fallback popup (Part 3).
 *
 * Shown only when the selected model strictly requires a hardware key
 * combination (MediaTek / Qualcomm) before the automated payload can run. The
 * exact button combination + numbered steps come from the strongly-typed shared
 * `ManualModeGuide`, so the instructions can never drift from the engine.
 */
export default function ManualModeModal({
  guide,
  onContinue,
  onCancel,
}: ManualModeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-amber-50 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">Manual mode required</h3>
            <p className="text-xs text-slate-500">
              {guide.brand} · {guide.model} · {guide.chipset}
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

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Button combination
            </div>
            <div className="mt-0.5 text-sm font-bold text-slate-900">{guide.keyCombo}</div>
          </div>

          <ol className="mt-4 space-y-2.5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700">{step}</span>
              </li>
            ))}
          </ol>

          {guide.note && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {guide.note}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onCancel} className="frpb-btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            I've done this — continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
