// FRPB — checkout auto-start client.
// Reached after authentication (post-login hop to /checkout). Mounts once,
// then hands the selected plan to the payment gateway and redirects to the
// provider-hosted checkout. The user is already authenticated, so no session
// state is touched here — we only read the plan.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { PLANS, type PlanSlug } from "@frpb/shared";

interface CheckoutClientProps {
  planSlug: PlanSlug;
  /** Currency the customer chose on the pricing page (defaults to USD). */
  currency?: "USD" | "INR";
}

export default function CheckoutClient({ planSlug, currency = "USD" }: CheckoutClientProps) {
  const runOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;

    (async () => {
      try {
        const res = await fetch("/api/v1/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planSlug, currency }),
          credentials: "include",
        });

        const data = (await res.json()) as {
          success?: boolean;
          checkoutUrl?: string;
          message?: string;
        };

        if (data.success && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        setError(data.message ?? "Checkout failed. Please try again.");
      } catch {
        setError("Checkout failed. Please try again.");
      }
    })();
  }, [planSlug, currency]);

  const plan = PLANS.find((p) => p.slug === planSlug);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          {error ? "Checkout unavailable" : "Starting your checkout"}
        </h1>

        {error ? (
          <>
            <p
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600"
            >
              {error}
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to pricing
            </Link>
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
