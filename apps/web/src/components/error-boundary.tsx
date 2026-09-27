// FRPB — reusable React error boundary (blueprint fix 3).
// Wraps core page sections and interactive client components so a crash in one
// island (e.g. the pricing grid or the device showcase) degrades to a compact,
// friendly fallback instead of taking down the entire page. The default
// fallback reuses `classifyBoundaryError` so auth/DB/generic failures each get
// accurate copy, mirroring the route-level `error.tsx` boundaries.

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { classifyBoundaryError } from "@/lib/errors/classify";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable label used in logs and the fallback copy. */
  label?: string;
  /** Optional custom fallback; receives the caught error and a reset callback. */
  fallback?: (error: Error & { digest?: string }, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: (Error & { digest?: string }) | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(
    error: Error & { digest?: string }
  ): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const { label } = this.props;
    // Logged client-side only; never surfaced to the end user.
    console.error(
      `[frpb:web] Section boundary${label ? ` ("${label}")` : ""} caught an error:`,
      error,
      info.componentStack
    );
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label, fallback } = this.props;
    if (fallback) return fallback(error, this.reset);

    const kind = classifyBoundaryError(error);
    const message =
      kind === "db"
        ? "This section couldn't load its data. Your data is safe — please try again."
        : kind === "auth"
          ? "This section needs you to sign in again."
          : "This section hit an unexpected error. Please try again.";

    return (
      <div
        role="alert"
        className="mx-auto my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
        </div>
        <p className="text-sm font-semibold text-slate-900">
          {label ? `Couldn't load ${label}` : "Something went wrong here"}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 inline-flex min-h-[44px] touch-manipulation select-none items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-[0.98] active:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
}
