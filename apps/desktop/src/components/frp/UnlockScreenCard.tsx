// FRPB — Unlock Android Screen feature card (replaces the Coming Soon stub).
// Now fully wired to the FRP Tools wizard: clicking opens the legal disclaimer
// modal first, then runs the unlock-screen operation through the main-process
// ADB handler (which requires an authorized USB-debugging device).
import { Lock, ShieldAlert } from "lucide-react";

interface UnlockScreenCardProps {
  busy: boolean;
  onRun: () => void;
}

export default function UnlockScreenCard({ busy, onRun }: UnlockScreenCardProps) {
  return (
    <button
      onClick={onRun}
      disabled={busy}
      className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:border-emerald-300 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200">
        <Lock className="h-7 w-7" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">Unlock Android Screen</h3>
      <p className="mt-1 text-xs text-slate-500">
        Remove forgotten PIN, pattern, or password without data loss. Requires USB debugging + ADB.
      </p>
      <div className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
        <ShieldAlert className="inline h-3 w-3 mr-1 -mt-0.5" />
        Run
      </div>
    </button>
  );
}
