import { useCallback, useEffect, useState } from "react";
import type { LicenseProfile, ResetResult } from "./lib/ipc";
import ActivationScreen from "./components/ActivationScreen";
import MainDashboard from "./components/MainDashboard";
import { RefreshCw, RotateCcw, Loader2 } from "lucide-react";

/**
 * Root component. Every launch starts at the ActivationScreen (online
 * verification is the source of truth — the encrypted cached profile only
 * pre-fills the key as a convenience hint and never grants access by itself).
 * A successful verify() elevates the user into MainDashboard for the rest of
 * the session.
 */
export default function App() {
  const [profile, setProfile] = useState<LicenseProfile | null>(null);
  const [cached, setCached] = useState<LicenseProfile | null>(null);
  const [cachePath, setCachePath] = useState<string>("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Re-read persisted activation state on demand. Called on mount and again
  // after a reset, so the view always reflects fresh API/disk state.
  const refreshCached = useCallback(async () => {
    try {
      setCached(await window.frpb.license.getCachedProfile());
    } catch {
      setCached(null);
    }
  }, []);

  useEffect(() => {
    void refreshCached();
    window.frpb.system
      .cacheInfo()
      .then((info) => setCachePath(info.cachePath))
      .catch(() => {});
  }, [refreshCached]);

  // Developer/test: wipe the encrypted license cache + renderer storage, then
  // drop the in-memory profile so the UI returns to the activation view. The
  // gate is server-side, so this only forces a fresh verification.
  async function handleReset() {
    if (resetBusy) return;
    setResetBusy(true);
    setResetNotice(null);
    try {
      const result: ResetResult = await window.frpb.system.reset();
      await refreshCached();
      setProfile(null);
      const summary = result.cleared.length
        ? `Cleared: ${result.cleared.join(", ")}`
        : "Nothing to clear — already in a fresh state.";
      setResetNotice(result.ok ? summary : `Reset failed: ${result.error ?? "unknown error"}`);
    } catch (err) {
      setResetNotice(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <>
      {profile ? (
        <MainDashboard profile={profile} onSignOut={() => setProfile(null)} />
      ) : (
        <ActivationScreen cached={cached} onActivated={setProfile} />
      )}

      {/* Dev-only reset strip. `import.meta.env.DEV` is statically replaced by
          Vite, so this block (and the IPC it wires) is stripped from production
          bundles. */}
      {import.meta.env.DEV ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-2 text-[11px] text-slate-500 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Dev
            </span>
            <button
              onClick={handleReset}
              disabled={resetBusy}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              title="Clear the cached license profile + renderer storage"
            >
              {resetBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Reset activation data
            </button>
            <button
              onClick={() => {
                setProfile(null);
                void refreshCached();
              }}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-700 transition hover:bg-slate-100"
              title="Return to the activation screen without clearing storage"
            >
              <RefreshCw className="h-3 w-3" />
              Back to activation
            </button>
            {cachePath ? (
              <span className="truncate">
                cache: <code className="font-mono">{cachePath}</code>
              </span>
            ) : null}
            {resetNotice ? <span className="text-slate-700">{resetNotice}</span> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
