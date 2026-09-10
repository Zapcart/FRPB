import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import type { OperationKind } from "../../lib/ipc";
import { DISCLAIMER_TEXT, opLabel } from "./shared";

interface DisclaimerModalProps {
  op: OperationKind;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onAgree: () => void;
  onClose: () => void;
  agreeing: boolean;
  error: string | null;
}

/**
 * Legal disclaimer modal shown before FRP Bypass or Flash Reset.
 * Verbatim text + mandatory checkbox; consent is also enforced in the main
 * process (in-memory) so the UI can never bypass it.
 */
export default function DisclaimerModal({
  op,
  checked,
  onCheckedChange,
  onAgree,
  onClose,
  agreeing,
  error,
}: DisclaimerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={agreeing ? undefined : onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-amber-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Legal disclaimer required</h2>
            <p className="text-xs text-slate-500">
              Required before {opLabel(op)} can run
            </p>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-700">{DISCLAIMER_TEXT}</p>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              disabled={agreeing}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              I confirm I am the rightful owner of the connected device, or I have explicit
              written authorization from the owner to perform this operation.
            </span>
          </label>
        </div>

        {error && (
          <div className="mx-5 mb-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            disabled={agreeing}
            className="frpb-btn-ghost px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onAgree}
            disabled={!checked || agreeing}
            className="frpb-btn-primary px-5 py-2 text-sm"
          >
            {agreeing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              "I Agree"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
