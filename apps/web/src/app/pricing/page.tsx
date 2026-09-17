// FRPB — pricing page
// Renders the three plans from @frpb/shared with a USD / INR currency switcher.
// Amounts come straight from the plan definition (priceCents / priceInr) so the
// displayed price always matches the amount the gateway actually charges —
// never a derived FX conversion. The selected currency is forwarded to
// /api/v1/checkout (Cashfree settles INR natively) and preserved across the
// auth hop via /checkout?currency=…
// Currency display only — no payment provider branding on the frontend.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Globe,
  Zap,
  Headphones,
  Lock,
  ChevronDown,
} from "lucide-react";
import {
  PLANS,
  formatMoney,
  priceFor,
  type Currency,
  type PlanSlug,
} from "@frpb/shared";
import { createClient } from "@/lib/supabase/client";
import JsonLd from "@/components/seo/json-ld";
import { faqPageSchema } from "@/lib/schema";
import { savePendingPlan } from "@/lib/checkout/pending-plan";
import {
  resolveDefaultCurrency,
  storeCurrency,
} from "@/lib/checkout/currency";
import {
  DUAL_PLANS,
  formatDualInr,
  formatDualUsd,
  getDualPlan,
} from "@/config/plans";
import PaymentMethodModal from "@/components/PaymentMethodModal";

/**
 * Trust / conversion badges rendered under the pricing grid. Addresses the four
 * hesitations that block a paid-utility purchase: activation speed, refund
 * risk, after-sales help and payment safety.
 */
const TRUST_BADGES = [
  {
    icon: Zap,
    title: "Instant License Activation Key",
    desc: "Your key is generated and emailed the moment payment clears — no waiting.",
  },
  {
    icon: ShieldCheck,
    title: "100% Risk-Free Money-Back Guarantee",
    desc: "If the tool does not resolve your device, request a full refund within 7 days.",
  },
  {
    icon: Headphones,
    title: "24/7 Priority Technician Support",
    desc: "Real technicians on standby for paid plans — not a chatbot.",
  },
  {
    icon: Lock,
    title: "Safe & Encrypted Checkout",
    desc: "PCI-DSS compliant processing with bank-grade 256-bit TLS encryption.",
  },
] as const;

/**
 * Buyer-hesitation FAQ. Rendered as an accordion AND mirrored into a `FAQPage`
 * JSON-LD block — Google requires the markup to match the visible content.
 */
const PRICING_FAQS = [
  {
    q: "Will it work without USB Debugging enabled?",
    a: "Yes. FRPB does not depend on ADB or USB debugging. It talks directly to the device's low-level hardware interfaces — MediaTek BROM/Preloader (VID 0E8D), Qualcomm EDL 9008, and Fastboot — so a locked phone that cannot reach Android Settings still works.",
  },
  {
    q: "How fast do I get my key?",
    a: "Instantly. Your license key is generated server-side and emailed within seconds of a successful payment, so you can activate the desktop app right away.",
  },
  {
    q: "Which Windows versions are supported?",
    a: "64-bit Windows 10 and Windows 11 are fully supported. Older 32-bit systems are not supported.",
  },
  {
    q: "Can I move my license to another PC?",
    a: "Yes. You can unbind a machine from your dashboard and activate the same license on a different computer, within your plan's device limit.",
  },
  {
    q: "What if the tool does not work on my device?",
    a: "You are covered by a 7-day money-back guarantee. If FRPB cannot resolve your device, contact support and we will refund the purchase in full.",
  },
  {
    q: "Can I pay in Indian Rupees?",
    a: "Yes. Switch the currency toggle to INR (₹) and you will be routed to our India payment rail supporting UPI, NetBanking and domestic cards. International buyers are charged in USD by card.",
  },
] as const;

// Billing interval suffix, keyed by plan slug + display currency.
// Lifetime plans render a one-time label only — never a recurring interval.
const BILLING_SUFFIX: Record<PlanSlug, Record<Currency, string>> = {
  MONTH_1: { USD: "/ month", INR: "/ महीना" },
  YEAR_1: { USD: "/ year", INR: "/ साल" },
  LIFETIME: { USD: "one-time", INR: "एक बार" },
};

/**
 * The pricing grid renders from DUAL_PLANS (the authoritative tier rates) rather
 * than the shared legacy PLANS, so the displayed price is always one of
 * ₹1,900/$20, ₹4,900/$50 or ₹9,999/$100 — matching exactly what the UPI and
 * PayGlocal rails charge.
 */
const PLAN_CARDS = DUAL_PLANS.map((plan) => ({
  plan,
  slug: plan.slug,
  name: plan.name,
  features: plan.features,
  deviceLimit: plan.deviceLimit,
  durationDays: plan.durationDays,
}));

// Currency detection + persistence now live in @/lib/checkout/currency, which
// layers PostHog geoip on top of the timezone/locale heuristic.

export default function PricingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("USD");
  // True when the initial currency came from region detection (not the user).
  const [autoDetected, setAutoDetected] = useState(false);
  // The plan whose payment-method modal is open (null = closed).
  const [modalPlan, setModalPlan] = useState<string | null>(null);
  // Signed-in buyer email, used to prefill the modal's email field.
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null);

  // Initialise the currency on mount: an explicit prior choice wins, else
  // geo/locale detection (India → INR, rest of world → USD). Runs once, so it
  // never fights an explicit user toggle afterwards.
  useEffect(() => {
    const { currency: initial, source } = resolveDefaultCurrency();
    setCurrency(initial);
    setAutoDetected(source !== "stored");
  }, []);

  function chooseCurrency(next: Currency) {
    setCurrency(next);
    setAutoDetected(false);
    storeCurrency(next);
  }

  // Accordion state — first question starts open so the section reads as
  // helpful content rather than a collapsed wall of headers.
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // FAQPage structured data, mirroring the visible accordion below.
  const faqLd = faqPageSchema(
    PRICING_FAQS.map((f) => ({ question: f.q, answer: f.a }))
  );

  /** The other currency's price, shown as a secondary "(~₹…)" hint. */
  function alternatePrice(planSlug: PlanSlug): string | null {
    const plan = getDualPlan(planSlug);
    if (!plan) return null;
    return currency === "USD" ? formatDualInr(plan.inr) : formatDualUsd(plan.usd);
  }

  /**
   * "Choose plan" / "Buy now" → open the payment-method modal. Both rails
   * (Direct UPI and PayGlocal card) can be started from there; the modal
   * collects an email when the visitor is not signed in.
   *
   * The signed-in email is resolved first so it can be prefilled, and the
   * purchase intent is persisted so a sign-in round trip can resume cleanly.
   */
  async function handlePurchase(planSlug: PlanSlug) {
    savePendingPlan(planSlug, currency);

    // Read (never mutate) the auth state to prefill the modal's email.
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user ?? null;
      }
      setBuyerEmail(user?.email ?? null);
    } catch {
      setBuyerEmail(null);
    }

    setModalPlan(planSlug);
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

        {/* Currency switcher — display + charge currency, no provider branding */}
        <div className="mt-6 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Show prices in:</span>
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              {(["USD", "INR"] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => chooseCurrency(cur)}
                  className={`px-4 py-1.5 text-sm font-semibold transition ${
                    currency === cur
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-pressed={currency === cur}
                >
                  {cur === "USD" ? "USD ($)" : "INR (₹)"}
                </button>
              ))}
            </div>
          </div>
          {autoDetected && (
            <span className="text-[11px] font-medium text-slate-400">
              Auto-detected your region — you can switch anytime.
            </span>
          )}
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLAN_CARDS.map((card) => {
            const popular = card.slug === "YEAR_1";
            const alt = alternatePrice(card.slug);
            return (
              <div
                key={card.slug}
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
                <h2 className="text-xl font-bold text-slate-900">{card.name}</h2>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black tracking-tight text-ink">
                    {currency === "USD"
                      ? formatDualUsd(card.plan.usd)
                      : formatDualInr(card.plan.inr)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    {BILLING_SUFFIX[card.slug][currency]}
                  </span>
                </div>
                {/* Dual-currency hint — the amount the other currency charges */}
                {alt && (
                  <p className="mt-1 text-xs font-medium text-slate-400">(~{alt})</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {card.deviceLimit} device{card.deviceLimit === 1 ? "" : "s"} ·{" "}
                  {card.durationDays ? `${card.durationDays} days` : "Lifetime access"}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {card.features.map((f) => (
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
                  type="button"
                  onClick={() => void handlePurchase(card.slug)}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${
                    popular
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600"
                  }`}
                >
                  {card.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment-method modal — dual currency (INR/UPI or USD/card) */}
        <PaymentMethodModal
          plan={getDualPlan(modalPlan ?? "")}
          email={buyerEmail}
          onClose={() => setModalPlan(null)}
        />

        {/* Trust badges — conversion triggers addressing buyer hesitations */}
        <section
          aria-label="Purchase guarantees"
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:shadow-card-hover"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <badge.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">{badge.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{badge.desc}</p>
            </div>
          ))}
        </section>

        {/* FAQ accordion — buyer-hesitation content, mirrored in FAQPage JSON-LD */}
        <section aria-label="Frequently asked questions" className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Everything buyers ask before purchasing FRPB.
          </p>
          <div className="mt-8 space-y-3">
            {PRICING_FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={faq.q}
                  className={`overflow-hidden rounded-2xl border bg-white transition ${
                    open ? "border-brand-200 shadow-card" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-900">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        open ? "rotate-180 text-brand-500" : ""
                      }`}
                    />
                  </button>
                  {open && (
                    <p className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          FRPB is a device utility intended for authorized device owners only. You must have the
          right to access the device you recover. Use of FRPB to bypass security protections on
          devices you do not own may violate applicable laws.
        </p>

        {/* FAQPage structured data — matches the visible accordion above. */}
        <JsonLd id="ld-pricing-faq" data={faqLd} />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50/70 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} FRPB · support@frpb.in
      </footer>
    </div>
  );
}
