// FRPB — checkout panel (Razorpay Standard Web Checkout).
//
// The single purchase surface for every tier. Every plan is priced and charged
// in USD, so the displayed amount comes from `@/config/plans` (the authoritative
// tier table) and the *charged* amount is re-derived server-side by
// /api/v1/checkout/create-order, so the two can never diverge on the client.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import type { PlanSlug } from "@frpb/shared";
import { formatDualUsd, getDualPlan } from "@/config/plans";
import { startRazorpayCheckout } from "@/lib/razorpay/checkout-flow";
import CountdownTimer from "@/components/promo/CountdownTimer";
import { usePromoState } from "@/components/promo/usePromoState";
import { promoMonthlyDaysFor } from "@/config/promo";

interface CheckoutPanelProps {
  planSlug: PlanSlug;
  /** Signed-in buyer email (optional — Razorpay collects it when absent). */
  email?: string | null;
  /** Referral code from a share link (`?ref=`) — applied server-side. */
  referralCode?: string | null;
}

export default function CheckoutPanel({
  planSlug,
  email = null,
  referralCode = null,
}: CheckoutPanelProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Promo status drives the MONTH_1 term copy + urgency note below. Seeded
  // statically for SSR/first paint, refined on the client after mount.
  const promo = usePromoState();

  const plan = getDualPlan(planSlug);

  if (!plan) {
    return (
      <div className="glass-panel-strong w-full max-w-md rounded-2xl p-8 text-center">
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

  const displayPrice = formatDualUsd(plan.usd);

  // The $20 tier's term is promo-sensitive (6 months during the offer, else 4).
  // Lifetime never shows a term. Resolved from the same boolean as the banner so
  // the checkout page, pricing grid and server-side grant always agree.
  const isMonthly = plan.slug === "MONTH_1";
  const durationLabel = isMonthly
    ? `${promoMonthlyDaysFor(promo.active)} days`
    : plan.durationDays
      ? `${plan.durationDays} days`
      : "one-time";

  async function handlePay() {
    setError(null);
    setNotice(null);
    setProcessing(true);

    // startRazorpayCheckout() is contractually non-throwing, but guard the call
    // so an unexpected error can never leave the button stuck on its spinner or
    // throw into the React tree; the finally block always restores the UI.
    try {
      const result = await startRazorpayCheckout({
        planSlug: plan!.slug,
        email,
        referralCode,
        onDismiss: () => setNotice("Checkout closed — no payment was taken."),
      });

      if (result.status === "paid") {
        setNotice("Payment successful — your license key is on the way.");
        // Hand back to the dashboard with the success flag so the confirmation
        // banner renders and the freshly-granted key is shown immediately.
        router.push("/dashboard?status=success");
        // The dashboard is a client component whose data load runs on mount; a
        // soft nav to the same route can be cached, so refresh to guarantee the
        // new license is fetched rather than a stale empty list.
        router.refresh();
        return;
      }

      if (result.status === "failed") {
        setError(result.message);
      }
    } catch (error) {
      console.error("[checkout] payment failed unexpectedly:", error);
      setError(
        "We couldn't start checkout. Please try again in a moment."
      );
    } finally {
      // Always release the button, including on the paid path before navigating.
      setProcessing(false);
    }
  }

  return (
    <div className="glass-panel-strong w-full max-w-md rounded-2xl p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-edge/70 bg-glass-soft px-3 py-1 text-xs font-medium text-brand-700 shadow-glass-light backdrop-blur">
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
          {durationLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Charges settle in USD ({displayPrice}).
      </p>

      {/* Launch-offer urgency — MONTH_1 only, and only while the window is live. */}
      {isMonthly && promo.mounted && promo.active && (
        <div className="mt-4 rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-accent-500/10 to-transparent p-3">
          <p className="text-xs font-semibold text-brand-700">
            Launch offer — get 6 months for the 4-month price
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span>Offer ends in</span>
            <CountdownTimer endsAt={promo.endsAt} variant="inline" label="Launch offer ends in" />
          </div>
        </div>
      )}

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
          className="mt-6 rounded-xl border border-glass-edge bg-glass-soft px-4 py-3 text-sm text-slate-600 backdrop-blur"
        >
          {notice}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={processing}
        aria-busy={processing}
        className="btn-accent mt-6 inline-flex min-h-[48px] w-full touch-manipulation select-none items-center justify-center gap-2 px-6 py-3 text-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Secure Gateway…
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
