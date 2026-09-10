import { Loader2, Download, RotateCcw, AlertTriangle, X, Sparkles } from "lucide-react";
import type { UpdaterStatus } from "../lib/ipc";

interface UpdateModalProps {
  open: boolean;
  status: UpdaterStatus;
  onClose: () => void;
  onDownload: () => void;
  onInstall: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Modal shown when the main process reports an update is available (AVAILABLE),
 * downloading (DOWNLOADING) or staged & ready (READY). Download requires
 * explicit user consent; install quits the app and relaunches the new version.
 */
export default function UpdateModal({ open, status, onClose, onDownload, onInstall }: UpdateModalProps) {
  if (!open || status.state === "IDLE" || status.state === "CHECKING") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6 backdrop-blur-sm">
      <div className="frpb-card w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {status.state === "READY"
                  ? "Update ready"
                  : status.state === "ERROR"
                    ? "Update failed"
                    : status.state === "UP_TO_DATE"
                      ? "You're up to date"
                      : "Update available"}
              </h2>
              {status.version && (
                <p className="text-xs text-slate-500">Version {status.version}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status.state === "AVAILABLE" && (
          <>
            {status.releaseNotes ? (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                {status.releaseNotes}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                A new version of FRPB Recovery is ready. You'll get the latest fixes and features.
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="frpb-btn-ghost flex-1">
                Not now
              </button>
              <button onClick={onDownload} className="frpb-btn-primary flex-1">
                <Download className="h-4 w-4" />
                Download now
              </button>
            </div>
          </>
        )}

        {status.state === "DOWNLOADING" && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" />
                Downloading…
              </span>
              <span>
                {typeof status.percent === "number" ? `${Math.round(status.percent)}%` : ""}
                {status.transferred != null && status.total
                  ? ` · ${formatBytes(status.transferred)} / ${formatBytes(status.total)}`
                  : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
                style={{ width: `${Math.min(status.percent ?? 0, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">
              You can keep using the app while this downloads.
            </p>
          </div>
        )}

        {status.state === "READY" && (
          <>
            <p className="mt-4 text-sm text-slate-500">
              The update has been downloaded. Restart FRPB Recovery to apply it.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={onClose} className="frpb-btn-ghost flex-1">
                Later
              </button>
              <button onClick={onInstall} className="frpb-btn-primary flex-1">
                <RotateCcw className="h-4 w-4" />
                Restart & install
              </button>
            </div>
          </>
        )}

        {status.state === "ERROR" && (
          <>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{status.message ?? "The update failed. Please try again later."}</span>
            </div>
            <button onClick={onClose} className="frpb-btn-ghost mt-5 w-full">
              Close
            </button>
          </>
        )}

        {status.state === "UP_TO_DATE" && (
          <>
            <p className="mt-4 text-sm text-slate-500">
              You're running the latest version of FRPB Recovery.
            </p>
            <button onClick={onClose} className="frpb-btn-primary mt-5 w-full">
              Great
            </button>
          </>
        )}
      </div>
    </div>
  );
}
