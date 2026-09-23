// FRPB — checkout panel (Razorpay Standard Web Checkout).
//
// The single purchase surface for every tier. The displayed amount comes from
// `@/config/plans` (the authoritative tier table) and the *charged* amount is
// re-derived server-side by /api/v1/checkout/create-order, so the two can never
// diverge on the client.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import type { PlanSlug } from "@frpb/shared";
import { formatDualInr, formatDualUsd, getDualPlan } from "@/config/plans";
import { startRazorpayCheckout } from "@/lib/razorpay/checkout-flow";

interface CheckoutPanelProps {
  planSlug: PlanSlug;
  currency: "USD" | "INR";
  /** Signed-in buyer email (optional — Razorpay collects it when absent). */
  email?: string | null;
}

export default function CheckoutPanel({
  planSlug,
  currency,
  email = null,
}: CheckoutPanelProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const plan = getDualPlan(planSlug);

  if (!plan) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <h1 className="text-lg font-bold text-slate-900">Plan unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          We could not find the plan you selected.
        </p>
        <Link href="/pricing" className="btn-accent mt-6 inline-block px-5 py-2.5 text-sm">
          Back to pricing
        </Link>
      </div>
    );
  }

  const displayPrice =
    currency === "INR" ? formatDualInr(plan.inr) : formatDualUsd(plan.usd);

  async function handlePay() {
    setError(null);
    setNotice(null);
    setProcessing(true);

    const result = await startRazorpayCheckout({
      planSlug: plan!.slug,
      currency,
      email,
      onDismiss: () => setNotice("Checkout closed — no payment was taken."),
    });

    if (result.status === "paid") {
      setNotice("Payment successful — your license key is on the way.");
      router.push("/dashboard");
      return;
    }

    setProcessing(false);

    if (result.status === "failed") {
      setError(result.message);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
        <Lock className="h-3.5 w-3.5" />
        Secure checkout
      </span>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
        {plan.name}
      </h1>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-black tracking-tight text-ink">
          {displayPrice}
        </span>
        <span className="text-sm font-medium text-slate-400">
          {plan.durationDays ? `${plan.durationDays} days` : "one-time"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Charges settle in {currency} ({displayPrice}).
      </p>

      <ul className="mt-6 space-y-3 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-slate-600">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/10 text-brand-600">
              <Check className="h-3 w-3" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {notice && !error && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          {notice}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={processing}
        className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>Pay {displayPrice}</>
        )}
      </button>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        PCI-DSS compliant · 256-bit TLS encrypted
      </p>

      <Link
        href="/pricing"
        className="mt-4 block text-center text-xs font-medium text-slate-400 transition hover:text-slate-600"
      >
        Back to pricing
      </Link>
    </div>
  );
}
