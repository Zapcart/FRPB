// FRPB — pricing page
// Light-mode SaaS layout. Renders the three plans from @frpb/shared
// and starts Stripe/Razorpay checkout for authenticated users.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, CreditCard, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { createClient } from "@/lib/supabase/client";

type Provider = "STRIPE" | "RAZORPAY";

const PRICING_NOTES: Record<string, string> = {
  MONTH_1: "per month",
  YEAR_1: "per year",
  LIFETIME: "one-time",
};

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
  const [provider, setProvider] = useState<Provider>("STRIPE");
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(planSlug: PlanSlug) {
    setLoadingPlan(planSlug);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth?returnTo=/pricing`);
      setLoadingPlan(null);
      return;
    }

    const res = await fetch("/api/v1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug, provider }),
    });

    const data = (await res.json()) as { success?: boolean; checkoutUrl?: string; message?: string };

    if (data.success && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    setError(data.message ?? "Checkout failed. Please try again.");
    setLoadingPlan(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white shadow-lg shadow-brand-500/30">
              F
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Home
            </Link>
            <Link
              href="/auth"
              className="btn-accent px-4 py-2 text-sm"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Simple pricing
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            One license unlocks the full FRPB toolkit. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Provider toggle */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {(["STRIPE", "RAZORPAY"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                provider === p
                  ? "border-brand-200 bg-brand-50 text-brand-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {p === "STRIPE" ? (
                <CreditCard className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {p === "STRIPE" ? "Card (Stripe)" : "UPI / Cards (Razorpay)"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm font-medium text-rose-500">{error}</p>
        )}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const popular = plan.slug === "YEAR_1";
            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border bg-white p-8 transition duration-300 ${
                  popular
                    ? "border-brand-200 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/40"
                    : "border-slate-200 shadow-card hover:shadow-card-hover"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
                    MOST POPULAR
                  </span>
                )}
                <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black tracking-tight text-ink">
                    ${(plan.priceCents / 100).toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    {PRICING_NOTES[plan.slug]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {plan.deviceLimit} device{plan.deviceLimit === 1 ? "" : "s"} ·{" "}
                  {plan.durationDays ? `${plan.durationDays} days` : "Lifetime access"}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-slate-600">
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                          popular ? "bg-brand-500/10 text-brand-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePurchase(plan.slug)}
                  disabled={loadingPlan !== null}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition disabled:opacity-60 ${
                    popular
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600"
                  }`}
                >
                  {loadingPlan === plan.slug ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      {plan.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          FRPB is a device utility intended for authorized device owners only. You must have the
          right to access the device you recover. Use of FRPB to bypass security protections on
          devices you do not own may violate applicable laws.
        </p>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50/70 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} FRPB · support@frpb.in
      </footer>
    </div>
  );
}
