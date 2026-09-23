// FRPB — pricing page
// Renders the two plans from DUAL_PLANS in a single native currency: USD.
// Amounts come straight from the plan definition so the displayed price always
// matches the amount Razorpay actually charges — never a derived FX conversion.
// Razorpay Standard Web Checkout is the single, exclusive payment gateway and
// every tier settles in USD ($20 / month, $150 one-time). Checkout is gated
// behind authentication: guests are redirected to sign-up and the pending-plan
// intent resumes the purchase for the selected plan automatically.

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Headphones,
  Lock,
  ChevronDown,
} from "lucide-react";
import { type PlanSlug } from "@frpb/shared";
import { createClient } from "@/lib/supabase/client";
import JsonLd from "@/components/seo/json-ld";
import { faqPageSchema, productSchema, breadcrumbSchema } from "@/lib/schema";
import { savePendingPlan } from "@/lib/checkout/pending-plan";
import {
  LEGAL_DISCLAIMER,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";
import { DUAL_PLANS, formatDualUsd } from "@/config/plans";
import { startRazorpayCheckout } from "@/lib/razorpay/checkout-flow";

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
    q: "Which currency will I be charged in?",
    a: "All prices are charged in US Dollars (USD). International cards are accepted, and your bank converts the amount to your local currency at checkout.",
  },
] as const;

// Billing interval suffix, keyed by plan slug. All tiers are priced and charged
// in USD; a lifetime plan renders a one-time label, never a recurring interval.
const BILLING_SUFFIX: Record<PlanSlug, string> = {
  MONTH_1: "/ month",
  LIFETIME: "one-time",
};

/**
 * The pricing grid renders from DUAL_PLANS (the authoritative tier rates) rather
 * than the shared legacy PLANS, so the displayed price is always exactly $20 or
 * $150 — matching the USD amount Razorpay charges at checkout.
 */
const PLAN_CARDS = DUAL_PLANS.map((plan) => ({
  plan,
  slug: plan.slug,
  name: plan.name,
  features: plan.features,
  deviceLimit: plan.deviceLimit,
  durationDays: plan.durationDays,
}));

export default function PricingPage() {
  const router = useRouter();
  // Plan currently being paid for (null = idle) — drives the button spinner.
  const [processingPlan, setProcessingPlan] = useState<PlanSlug | null>(null);
  // Inline feedback for the Razorpay flow (replaces the old method modal).
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  // Accordion state — first question starts open so the section reads as
  // helpful content rather than a collapsed wall of headers.
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // FAQPage structured data, mirroring the visible accordion below.
  const faqLd = faqPageSchema(
    PRICING_FAQS.map((f) => ({ question: f.q, answer: f.a }))
  );

  /**
   * "Choose plan" / "Get lifetime access" → start the purchase funnel.
   *
   * Payments are USD-only and gated behind authentication: an unauthenticated
   * visitor is sent to the sign-up form with the selected plan attached, and the
   * pending-plan helper resumes checkout automatically once they are signed in.
   * Authenticated buyers go straight to the Razorpay Standard Web Checkout
   * modal, where the order is created server-side (amount locked to the USD tier
   * rate) and the captured signature is verified before any license is granted.
   */
  async function handlePurchase(planSlug: PlanSlug) {
    if (processingPlan) return;
    setCheckoutError(null);
    setCheckoutNotice(null);
    setProcessingPlan(planSlug);

    // Persist the USD purchase intent so the auth round trip and the checkout
    // page resume with the exact plan the visitor selected.
    savePendingPlan(planSlug, "USD");

    // Read (never mutate) the auth state to prefill the payer email.
    let email: string | null = null;
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data.user ?? null;
      }
      email = user?.email ?? null;
    } catch {
      email = null;
    }

    // Guests must authenticate before paying — never open the gateway without an
    // account. Redirect to the sign-up form; AuthView reads the pending plan and
    // resumes checkout for this exact plan once signup/sign-in succeeds.
    if (!email) {
      setProcessingPlan(null);
      const params = new URLSearchParams({
        mode: "signup",
        plan: planSlug,
        returnTo: "/checkout",
      });
      router.push(`/auth?${params.toString()}`);
      return;
    }

    const result = await startRazorpayCheckout({
      planSlug,
      email,
      onDismiss: () =>
        setCheckoutNotice("Checkout closed — no payment was taken."),
    });

    if (result.status === "paid") {
      setCheckoutNotice(
        "Payment successful — taking you to your dashboard…"
      );
      router.push("/dashboard");
      return;
    }

    setProcessingPlan(null);

    if (result.status === "failed") {
      setCheckoutError(result.message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* next/image with explicit intrinsic dimensions — fixes the CLS
                caused by the previous unsized raw <img> in the sticky header. */}
            <Image
              src="/logo.png"
              alt="FRPB logo"
              width={64}
              height={64}
              priority
              className="h-8 w-8 shrink-0 rounded-xl object-cover"
            />
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-lg px-4 text-sm font-medium text-slate-600 transition active:text-brand-600 hover:text-slate-900"
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

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 grid-cols-1 md:grid-cols-2">
          {PLAN_CARDS.map((card) => {
            const popular = card.slug === "LIFETIME";
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
                    {formatDualUsd(card.plan.usd)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    {BILLING_SUFFIX[card.slug]}
                  </span>
                </div>
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
                  disabled={processingPlan !== null}
                  aria-busy={processingPlan === card.slug}
                  className={`mt-8 inline-flex min-h-[48px] w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
                    popular
                      ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600"
                  }`}
                >
                  {processingPlan === card.slug ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening secure checkout…
                    </>
                  ) : (
                    <>
                      {card.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Razorpay checkout feedback — inline, replaces the old method modal */}
        {(checkoutError || checkoutNotice) && (
          <div
            role={checkoutError ? "alert" : "status"}
            className={`mx-auto mt-8 max-w-xl rounded-xl border px-4 py-3 text-sm ${
              checkoutError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {checkoutError ?? checkoutNotice}
          </div>
        )}

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
                    className="flex min-h-[44px] w-full touch-manipulation select-none items-center justify-between gap-4 px-5 py-4 text-left transition active:bg-slate-50"
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
        {/* Product + Offer graph — one Offer per plan, emitted in USD only to
            match the single currency the storefront charges, so the price range
            is rich-result eligible. */}
        <JsonLd id="ld-pricing-product" data={productSchema()} />
        {/* BreadcrumbList — mirrors the visible Home → Pricing trail. */}
        <JsonLd
          id="ld-pricing-breadcrumb"
          data={breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ])}
        />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50/70 px-6 py-8 text-center text-sm text-slate-500">
        {/* DPDP / legal disclaimer — site-wide small print. */}
        <p className="mx-auto max-w-4xl text-xs leading-relaxed text-slate-400">
          {LEGAL_DISCLAIMER}
        </p>
        <p className="mt-4 text-xs text-slate-500">
          © {new Date().getFullYear()} FRPB ·{" "}
          <a
            href={mailtoHref(SUPPORT_EMAIL)}
            className="transition hover:text-slate-900"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          ·{" "}
          <a
            href={mailtoHref(LEGAL_EMAIL)}
            className="transition hover:text-slate-900"
          >
            {LEGAL_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  );
}
