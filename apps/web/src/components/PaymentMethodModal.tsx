// FRPB — Payment Method Selection Modal (dual currency).
//
// Opened when a customer clicks "Choose plan" / "Buy Now" on the pricing grid.
// It shows the selected plan with BOTH currencies and lets the customer pick
// the rail:
//
//   • Pay in INR (UPI / Direct)  → the self-hosted Direct-UPI engine
//                                  (/checkout/upi) settling to alixpay@axl
//   • Pay in USD (Card / Intl.)  → PayGlocal hosted checkout
//
// The customer never sees a provider name. Amounts are displayed from
// config/plans.ts and are re-resolved server-side on both rails.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeIndianRupee,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { formatDualInr, formatDualPrice, formatDualUsd, type DualPlan } from "@/config/plans";

interface PaymentMethodModalProps {
  plan: DualPlan | null;
  /** Buyer email (signed-in users) — required to create an order. */
  email?: string | null;
  onClose: () => void;
}

type Rail = "UPI" | "PAYGLOCAL";

export default function PaymentMethodModal({
  plan,
  email = null,
  onClose,
}: PaymentMethodModalProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<Rail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!plan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, busy, onClose]);

  if (!plan) return null;

  /**
   * Pay in INR → the self-hosted Direct-UPI engine.
   *
   * Navigation is IMMEDIATE and does not depend on any network call.
   *
   * Previously this POSTed to /api/v1/payment/create *before* navigating, and
   * rendered a blocking "Checkout unavailable" error whenever that request
   * failed (DB unreachable, session lookup error, cold start). That made the
   * zero-dependency UPI rail the most fragile path in the app.
   *
   * The UPI checkout page owns order creation: it renders the QR/intent UI with
   * its own loading state and reports failures inline with a retry, so the
   * customer always reaches the payment screen. The amount remains locked
   * server-side.
   */
  function payWithUpi() {
    if (!plan) return;
    setError(null);
    setBusy("UPI");
    // No await needed — the page creates the order and shows its own progress.
    router.push(`/checkout/upi?plan=${plan.slug}`);
  }

  /** Pay in USD → PayGlocal hosted card checkout. */
  async function payWithCard() {
    if (!plan) return;
    setError(null);
    setBusy("PAYGLOCAL");
    try {
      const res = await fetch("/api/v1/payment/payglocal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Again: no amount — the server uses the USD tier rate.
        body: JSON.stringify({ planSlug: plan.slug, userEmail: email ?? undefined }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        checkoutUrl?: string;
      };
      if (!res.ok || !data.success || !data.checkoutUrl) {
        setError(data.message ?? "Card checkout is unavailable. Please try UPI.");
        return;
      }
      // Redirect to the provider-hosted checkout.
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Could not reach the card payment service. Check your connection and retry.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a payment method"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Choose how to pay</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {plan.name} — {formatDualPrice(plan)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Plan summary with BOTH currencies visible */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-800">{plan.name}</span>
              <span className="text-sm font-bold text-slate-900">
                {formatDualPrice(plan)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {plan.deviceLimit} device{plan.deviceLimit === 1 ? "" : "s"} ·{" "}
              {plan.durationDays ? `${plan.durationDays} days` : "Lifetime access"}
            </p>
          </div>

          {/* Option 1 — INR / Direct UPI */}
          <button
            type="button"
            onClick={() => void payWithUpi()}
            disabled={Boolean(busy)}
            className="group mt-4 flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md shadow-brand-200">
              {busy === "UPI" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BadgeIndianRupee className="h-5 w-5" />
              )}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Pay in INR (UPI / Direct)
                </span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                  Zero fees
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Instant bank-to-bank UPI — scan a QR or pay from your UPI app.
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" /> GPay
                </span>
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" /> PhonePe
                </span>
                <span className="inline-flex items-center gap-1">
                  <QrCode className="h-3.5 w-3.5" /> QR Code
                </span>
                <span className="font-bold text-slate-900">{formatDualInr(plan.inr)}</span>
              </span>
            </span>
          </button>

          {/* Option 2 — USD / PayGlocal */}
          <button
            type="button"
            onClick={() => void payWithCard()}
            disabled={Boolean(busy)}
            className="group mt-3 flex w-full items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md">
              {busy === "PAYGLOCAL" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Pay in USD (International Credit/Debit Card)
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  Worldwide
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Secure hosted card checkout — Visa, Mastercard, Amex.
              </span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-bold text-slate-900">{formatDualUsd(plan.usd)}</span>
              </span>
            </span>
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600"
            >
              {error}
            </p>
          )}

          <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your license key is generated and emailed the moment payment clears. Both
            rails activate the same license.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small check bullet reused by the modal's plan summary. */
export function ModalFeature({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-xs text-slate-600">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
      {label}
    </li>
  );
}
