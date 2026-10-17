// FRPB — pricing page (Server Component).
// Renders the two plans from DUAL_PLANS in a single native currency: USD.
// Amounts come straight from the plan definition so the displayed price always
// matches the amount Razorpay actually charges — never a derived FX conversion.
// Razorpay Standard Web Checkout is the single, exclusive payment gateway and
// every tier settles in USD ($20 / 6 months, $200 one-time). Checkout is gated
// behind authentication: guests are redirected to sign-up and the pending-plan
// intent resumes the purchase for the selected plan automatically.
//
// This route ships as a Server Component: the hero, value callout, trust badges,
// FAQ (native <details>, zero JS) and all three JSON-LD blocks render server-side
// so the full marketing content is in the initial HTML. The only client island is
// <PricingPlanGrid>, which owns the purchase buttons, promo-aware copy and the
// Razorpay feedback. <RazorpaySdkScript> idle-preloads checkout.js on this page
// only, and <PricingViewTracker> fires the GA4 view event.

import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  Zap,
  Headphones,
  Lock,
  ChevronDown,
} from "lucide-react";
import JsonLd from "@/components/seo/json-ld";
import { faqPageSchema, productSchema, breadcrumbSchema } from "@/lib/schema";
import {
  LEGAL_DISCLAIMER,
  LEGAL_EMAIL,
  SUPPORT_EMAIL,
  mailtoHref,
} from "@/config/legal";
import ErrorBoundary from "@/components/error-boundary";
import RazorpaySdkScript from "@/components/checkout/razorpay-sdk-script";
import PricingPlanGrid from "@/components/checkout/pricing-plan-grid";
import PricingViewTracker from "@/components/analytics/pricing-view-tracker";

/**
 * Trust / conversion badges rendered under the pricing grid. Addresses the four
 * hesitations that block a paid-utility purchase: activation speed, refund
 * risk, after-sales help and payment safety.
 */
const TRUST_BADGES = [
  {
    icon: Zap,
    title: "Instant License Key Delivery",
    desc: "Your key is generated and emailed right after payment clears — no waiting.",
  },
  {
    icon: ShieldCheck,
    title: "Clean & Tested Windows Utility",
    desc: "Built and tested for 64-bit Windows 10 & 11 — a verified clean build with no bundled adware.",
  },
  {
    icon: Headphones,
    title: "Official Telegram & Email Support",
    desc: "Technical help through our official Telegram channel or support@frpb.in — from real technicians, not a bot.",
  },
  {
    icon: Lock,
    title: "Secure Online Payment",
    desc: "PCI-DSS compliant processing via Razorpay with bank-grade 256-bit TLS encryption.",
  },
] as const;

/**
 * Buyer-hesitation FAQ. Rendered as a native <details> accordion AND mirrored
 * into a `FAQPage` JSON-LD block — Google requires the markup to match the
 * visible content. Native <details> keeps the FAQ fully functional with zero
 * JavaScript.
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
    q: "What does the $20 / 6-month plan include?",
    a: "The $20 plan grants full Professional access for 6 months on 1 device/PC, including all utility updates plus the FRP bypass and diagnostics tools for the full duration. If you need to cover more machines, the Lifetime plan supports up to 5 devices.",
  },
  {
    q: "How do I get technical support?",
    a: "Support is handled through our official Telegram channel and by email at support@frpb.in. Join the Telegram channel for setup guidance, key-combo help and direct technical assistance from our team.",
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

export default function PricingPage() {
  // FAQPage structured data, mirroring the visible accordion below.
  const faqLd = faqPageSchema(
    PRICING_FAQS.map((f) => ({ question: f.q, answer: f.a }))
  );

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-900">
      {/* GA4 `view_pricing` — the page IS the pricing view, so it fires once on
          mount (StrictMode double-invocation is guarded inside the tracker). */}
      <PricingViewTracker source="page" />
      {/* Preload checkout.js on this purchase surface only (idle-time). Never in
          the root layout — third-party payment JS must not load on guide or
          marketing routes. loadRazorpayCheckout() adopts this tag if present. */}
      <RazorpaySdkScript />
      {/* Soft aurora canvas so the frosted pricing panels read as glass. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-canvas-mesh"
      />
      <header className="glass-nav sticky top-0 z-50">
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

        {/* Value callout — a factual offer statement, no fake urgency. */}
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-accent-50 px-6 py-6 text-center shadow-glass-light sm:px-10">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl" />
            <div className="relative">
              <p className="inline-flex flex-wrap items-center justify-center gap-2 text-sm font-extrabold text-ink sm:text-base">
                <Sparkles className="h-4 w-4 text-brand-500" />
                Special Offer: Full Professional Access for 6 Months at just $20
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Get 6 months of continuous utility updates for the price competitors charge
                monthly.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive island: plan cards + purchase buttons + Razorpay feedback. */}
        <ErrorBoundary label="pricing plans">
          <PricingPlanGrid />
        </ErrorBoundary>

        {/* Trust badges — conversion triggers addressing buyer hesitations */}
        <section
          aria-label="Purchase guarantees"
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.title}
              className="glass-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/80 hover:shadow-glass-light-hover"
            >
              <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <badge.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">{badge.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{badge.desc}</p>
            </div>
          ))}
        </section>

        {/* FAQ accordion — native <details>, so it works with zero JavaScript.
            Mirrored in FAQPage JSON-LD below. */}
        <section aria-label="Frequently asked questions" className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Everything buyers ask before purchasing FRPB.
          </p>
          <div className="mt-8 space-y-3">
            {PRICING_FAQS.map((faq, i) => (
              <details
                key={faq.q}
                open={i === 0}
                className="group glass-surface overflow-hidden transition open:border-brand-300 open:ring-1 open:ring-brand-500/20"
              >
                <summary className="flex min-h-[44px] w-full cursor-pointer touch-manipulation select-none list-none items-center justify-between gap-4 px-5 py-4 text-left transition active:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-semibold text-slate-900">{faq.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-brand-500" />
                </summary>
                <p className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          FRPB is a device utility intended for authorized device owners only. You must have the
          right to access the device you recover. Use of FRPB to bypass security protections on
          devices you do not own may violate applicable laws.
        </p>

        {/* FAQPage structured data — matches the visible accordion above. */}
        <JsonLd id="ld-pricing-faq" data={faqLd} />
        {/* Product + Offer graph — a concrete USD Offer (price, validity,
            availability) plus aggregateRating, so Google's Product-snippet
            requirement is satisfied. */}
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

      <footer className="border-t border-glass-edge bg-glass-soft px-6 py-8 text-center text-sm text-slate-500 backdrop-blur">
        {/* Legal disclaimer — site-wide small print. */}
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
