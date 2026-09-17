// FRPB — checkout auto-start client (USD card rail).
//
// Reached after authentication. Mounts once, asks the server to create the
// gateway session, then redirects to the provider-hosted checkout.
//
// FAILURE HANDLING: a failure here is never a dead end.
//   • A timeout is reported as a timeout, not a generic error.
//   • An unconfigured card rail or an unreachable backend offers the
//     self-hosted UPI option, which needs no third-party service at all.
//   • The user can always retry without re-picking their plan.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, ArrowLeft, RefreshCw, Smartphone } from "lucide-react";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { clearPendingPlan } from "@/lib/checkout/pending-plan";
import { formatDualInr, getDualPlan } from "@/config/plans";

interface CheckoutClientProps {
  planSlug: PlanSlug;
  /** Currency the customer chose on the pricing page (defaults to USD). */
  currency?: "USD" | "INR";
}

/** Client-side ceiling so a hung request cannot spin forever. */
const REQUEST_TIMEOUT_MS = 20_000;

type Failure =
  | { kind: "auth"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "unknown"; message: string };

export default function CheckoutClient({ planSlug, currency = "USD" }: CheckoutClientProps) {
  const runOnce = useRef(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);

  /** Classify a failure so the UI can offer the right recovery action. */
  function classify(status: number | null, message?: string): Failure {
    const text = message ?? "";
    if (status === 401 || /sign in/i.test(text)) {
      return { kind: "auth", message: text || "Please sign in again to continue." };
    }
    if (status === 0) {
      return {
        kind: "timeout",
        message:
          "The payment service took too long to respond. Check your connection and try again.",
      };
    }
    if (status === 502 || /not configured/i.test(text)) {
      return {
        kind: "unavailable",
        message: text || "Card payment is not available right now.",
      };
    }
    return {
      kind: "unknown",
      message: text || "Checkout could not be started. Please try again.",
    };
  }

  useEffect(() => {
    if (runOnce.current && attempt === 0) return;
    runOnce.current = true;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    (async () => {
      try {
        const res = await fetch("/api/v1/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planSlug, currency }),
          credentials: "include",
          signal: controller.signal,
        });

        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          checkoutUrl?: string;
          message?: string;
        };

        if (cancelled) return;

        if (data.success && data.checkoutUrl) {
          // The gateway session exists, so the purchase intent has served its
          // purpose. Cleared HERE (not at the auth step) so a failure above
          // leaves the intent intact and the user can retry without re-picking
          // their plan.
          clearPendingPlan();
          window.location.href = data.checkoutUrl;
          return;
        }

        setFailure(classify(res.status, data.message));
      } catch (err) {
        if (cancelled) return;
        const aborted = err instanceof Error && err.name === "AbortError";
        setFailure(classify(aborted ? 0 : null));
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [planSlug, currency, attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  const plan = PLANS.find((p) => p.slug === planSlug);
  const dual = getDualPlan(planSlug);
  // The self-hosted UPI rail needs no third-party gateway, so it is the
  // recommended fallback whenever the card rail cannot start.
  const upiHref = `/checkout/upi?plan=${planSlug}`;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          {failure ? "Card payment unavailable" : "Starting your checkout"}
        </h1>

        {failure ? (
          <>
            <p
              role="alert"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700"
            >
              {failure.message}
            </p>

            {/* Recovery actions — the UPI rail is always offered because it does
                not depend on any gateway or auth service. */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={upiHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110"
              >
                <Smartphone className="h-4 w-4" />
                Pay {dual ? formatDualInr(dual.inr) : ""} via UPI instead
              </Link>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-600"
              >
                <RefreshCw className="h-4 w-4" />
                Try card payment again
              </button>
              <Link
                href="/pricing"
                className="mt-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to pricing
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500">
              {plan ? (
                <>
                  Taking you to secure payment for the{" "}
                  <span className="font-semibold text-slate-700">{plan.name}</span> plan.
                </>
              ) : (
                "Taking you to secure payment."
              )}
            </p>
            {/* White-label method hint — the acquirer is never named. */}
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
              {currency === "INR"
                ? "UPI / NetBanking / Cards (INR/India)"
                : "Credit / Debit Card (USD/International)"}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
              Redirecting…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
