// FRPB — /checkout route error boundary.
//
// A client-side exception anywhere in the checkout island previously bubbled to
// the framework's generic "Application error: a client-side exception has
// occurred" screen. This boundary keeps the visitor on a branded, recoverable
// surface and offers a one-tap retry (reset) plus a safe return to pricing.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Client-side only; never surfaced verbatim to the visitor.
    console.error("[checkout] client-side exception:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">
          We couldn't open checkout
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Something went wrong loading the secure checkout. No payment was taken
          — please try again or head back to pricing.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="btn-accent inline-flex min-h-[44px] touch-manipulation select-none items-center justify-center gap-2 px-5 py-2.5 text-sm active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
