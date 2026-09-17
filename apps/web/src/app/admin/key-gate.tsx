// FRPB — Admin key entry form.
//
// Rendered in place of the dashboard when neither an owner key nor a Supabase
// session is present. This replaces the old behaviour of hard-redirecting to
// /auth (and, before that, crashing with a 503 "Admin analytics is not
// configured") — unauthorized visitors now get a usable form instead of a dead
// end.
//
// The key is verified SERVER-SIDE by the `authorizeAdminKey` action; it is never
// compared in the browser, so the owner key is not shipped in the JS bundle.

"use client";

import { useState } from "react";
import { ShieldCheck, KeyRound, Loader2, AlertTriangle } from "lucide-react";
import { authorizeAdminKey } from "./actions";

export default function AdminKeyGate() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authorizeAdminKey(key);
      if (!result.ok) {
        setError(result.error ?? "Invalid admin key.");
        setLoading(false);
        return;
      }
      // Full reload so the Server Component re-resolves access with the cookie
      // that the action just set. The form intentionally does not optimistically
      // render the dashboard: access is decided on the server, not here.
      window.location.reload();
    } catch {
      setError("Could not verify the key. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="rounded-lg bg-brand-50 p-2.5">
            <ShieldCheck className="h-6 w-6 text-brand-600" />
          </span>
          <h1 className="mt-3 text-lg font-bold text-slate-900">Admin Access</h1>
          <p className="mt-1 text-xs text-slate-500">
            Enter the owner key to open the FRPB admin console.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="admin-key" className="block text-xs font-medium text-slate-600">
            Owner key
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              autoFocus
              placeholder="FRPB-••••-••••-••••"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || key.trim().length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Unlock Console"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Tip: you can also open{" "}
          <span className="font-mono">{"/admin?key=<owner key>"}</span> once — the key is
          stored in an HttpOnly cookie and removed from the URL.
        </p>
      </div>
    </div>
  );
}
