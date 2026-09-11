// FRPB — pricing page
// Light-mode SaaS layout. Renders the three plans from @frpb/shared
// and starts checkout for authenticated users.
// Currency display only — no payment provider branding on the frontend.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, ArrowRight, ShieldCheck, Globe } from "lucide-react";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { createClient } from "@/lib/supabase/client";

type Currency = "USD" | "INR";

const CURRENCY_INFO: Record<
  Currency,
  { symbol: string; label: string; rate: number; locale: string }
> = {
  USD: { symbol: "$", label: "USD", rate: 1, locale: "en-US" },
  INR: { symbol: "₹", label: "INR", rate: 83.5, locale: "en-IN" },
};

// Billing interval suffix, keyed by plan slug + display currency.
// Lifetime plans render a one-time label only — never a recurring interval.
const BILLING_SUFFIX: Record<PlanSlug, Record<Currency, string>> = {
  MONTH_1: { USD: "/ month", INR: "prati mahine" },
  YEAR_1: { USD: "/ year", INR: "prati saal" },
  LIFETIME: { USD: "one-time", INR: "ek baar" },
};

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [error, setError] = useState<string | null>(null);

  function formatPrice(cents: number, cur: Currency): string {
    const info = CURRENCY_INFO[cur];
    const amount = (cents * info.rate) / 100; // cents/paise -> major units
    // USD keeps 2 decimals; INR is rounded to whole rupees.
    const fractionDigits = cur === "USD" ? 2 : 0;
    const formatted = new Intl.NumberFormat(info.locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
    return `${info.symbol}${formatted}`;
  }

  async function handlePurchase(planSlug: PlanSlug) {
    setLoadingPlan(planSlug);
    setError(null);

    const supabase = createClient();

    // Robust auth check: try getUser, and also check session directly
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
    }

    if (!user) {
      router.push(`/auth?returnTo=/pricing`);
      setLoadingPlan(null);
      return;
    }

    const res = await fetch("/api/v1/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug }),
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
    setLoadingPlan(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="FRPB"
              className="h-8 w-8 shrink-0 rounded-xl"
            />
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

        {/* Currency switcher — display only, no provider branding */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Globe className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Show prices in:</span>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(["USD", "INR"] as const).map((cur) => (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className={`px-4 py-1.5 text-sm font-semibold transition ${
                  currency === cur
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {CURRENCY_INFO[cur].label}
              </button>
            ))}
          </div>
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
                    {formatPrice(plan.priceCents, currency)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    {BILLING_SUFFIX[plan.slug][currency]}
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
