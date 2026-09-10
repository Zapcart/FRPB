// FRPB — root error boundary.
// Catches unhandled errors in the app root segment (including the dashboard
// layout's DB work). Renders a friendly message instead of a raw stack trace
// or Prisma internals. Database connectivity errors (e.g. Prisma P1001) get a
// purpose-built message; auth errors (blueprint fix 9) get a "please sign in"
// action; everything else gets a generic retry page.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Database,
  Home,
  KeyRound,
  RefreshCw,
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
        : "An unexpected error occurred. Please try again.";

  const Icon = kind === "db" ? Database : kind === "auth" ? KeyRound : AlertTriangle;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
          <Icon className="h-6 w-6 text-rose-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          {kind === "auth" ? (
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <KeyRound className="h-4 w-4" /> Sign in
            </Link>
          ) : (
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          )}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Home className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
