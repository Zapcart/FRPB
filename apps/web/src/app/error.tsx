// FRPB — root error boundary.
// Catches unhandled errors in the app root segment (including the dashboard
// layout's DB work). Renders a friendly, dark-mode-first fallback instead of a
// raw stack trace or Prisma internals. Database connectivity errors (e.g.
// Prisma P1001) get a purpose-built message; auth errors (blueprint fix 9) get a
// "please sign in" action; everything else gets a generic retry page.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Database,
  Home,
  KeyRound,
  RefreshCw,
  RotateCw,
} from "lucide-react";
import { classifyBoundaryError } from "@/lib/errors/classify";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged server-side; never rendered to the user.
    console.error("[frpb:web] Unhandled error:", error);
  }, [error]);

  const kind = classifyBoundaryError(error);

  const title =
    kind === "db"
      ? "We can't reach our servers right now"
      : kind === "auth"
        ? "Your session needs attention"
        : "Something went wrong";

  const message =
    kind === "db"
      ? "Our database is temporarily unreachable. Your data is safe — please try again in a moment."
      : kind === "auth"
        ? "Your session has expired or is no longer valid. Please sign in again to continue."
        : "Something went wrong. Please refresh the page.";

  const Icon =
    kind === "db" ? Database : kind === "auth" ? KeyRound : AlertTriangle;

  const primaryButtonClass =
    "inline-flex min-h-[48px] touch-manipulation select-none items-center justify-center gap-2 rounded-lg bg-[#0066FF] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0066FF]/20 transition hover:bg-[#0052cc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] active:scale-[0.98] active:bg-[#0047b3]";

  const secondaryButtonClass =
    "inline-flex min-h-[48px] touch-manipulation select-none items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A3FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] active:scale-[0.98] active:bg-white/15";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-6 py-16 text-slate-300 antialiased">
      <div
        role="alert"
        aria-live="assertive"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0e] p-8 text-center shadow-2xl ring-1 ring-white/5"
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20">
          <Icon className="h-6 w-6 text-rose-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>

        <div className="mt-6 flex flex-col gap-2.5">
          {kind === "auth" ? (
            <Link href="/login" className={primaryButtonClass}>
              <KeyRound className="h-4 w-4" aria-hidden="true" /> Sign in
            </Link>
          ) : (
            <>
              <button type="button" onClick={reset} className={primaryButtonClass}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={secondaryButtonClass}
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" /> Reload Page
              </button>
            </>
          )}
          <Link href="/" className={secondaryButtonClass}>
            <Home className="h-4 w-4" aria-hidden="true" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
