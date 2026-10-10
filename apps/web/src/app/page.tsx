// FRPB — landing page
// Modern Light SaaS layout. Server component: no client hooks needed.
// Theme: pure-white → slate-50 canvas, deep navy (ink) typography, electric
// blue / cyan accents, hairline borders and soft elevation. All surfaces are
// built from the shared design tokens in globals.css + tailwind.config.ts.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Download,
  BookOpen,
  Sparkles,
  Zap,
  Smartphone,
  Check,
  ArrowRight,
  Menu,
  LifeBuoy,
  Usb,
  Terminal,
  Cable,
  Cpu,
  Activity,
  MessageCircle,
  Eraser,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { PLANS, FREE_TOOLS, FREE_TOOL_IDS, isPromoActive, type FreeToolId } from "@frpb/shared";
import { resolveInstallerUrl } from "@/config/download";
import PromoBanner from "@/components/promo/PromoBanner";
import { promoMonthlyMonthsFor } from "@/config/promo";
import Hero from "@/components/landing/hero";
import DeviceShowcase from "@/components/DeviceShowcase";
import ErrorBoundary from "@/components/error-boundary";
import JsonLd from "@/components/seo/json-ld";
import FaqSection from "@/components/faq-section";
// The home page owns the in-page `#eula` anchor target, so it renders its own
// footer instance (the site-wide <SiteFooter /> skips the `/` route).
import Footer from "@/components/Footer";
import {
  PRIMARY_TITLE,
  PRODUCT_DESCRIPTION,
  PRIMARY_KEYWORDS,
  pageMetadata,
} from "@/lib/seo";
import {
  softwareApplicationSchema,
  websiteSchema,
  faqPageSchema,
  // Standalone Organization node (brand knowledge panel + logo resolution).
  organizationPageSchema,
} from "@/lib/schema";
import { HOME_FAQ } from "@/lib/faq";
import { homeMetrics, SUPPORTED_CHIPSETS, SUPPORTED_MODES } from "@/lib/home-metrics";
import type { HomeMetrics } from "@/lib/home-metrics";

/**
 * Verifiable capability metrics derived from the shipped model catalog — see
 * lib/home-metrics.ts. Replaces the previously hardcoded "120,000+ devices
 * recovered" / "4.9/5 from 2,000+ reviews" social proof, which had no source.
 */
const HOME_METRICS: HomeMetrics = homeMetrics();

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pro Tools", href: "#free-tools" },
  { label: "Supported Brands", href: "#brands" },
  { label: "Pricing", href: "#pricing" },
  { label: "Guides", href: "#guides" },
  { label: "FAQ", href: "#faq" },
  { label: "EULA", href: "#eula" },
];

const BRANDS = ["Samsung", "Xiaomi", "Vivo", "OPPO", "OnePlus", "Google Pixel"];

/**
 * Capability strip replacing the previous "As featured in" press banner.
 *
 * The old banner listed media outlets (Cult of Mac, Forbes, …) as though they
 * had covered FRPB. We hold no such press coverage, so presenting those brands
 * as an endorsement was a credibility (and trademark) problem. These tiles
 * instead state capabilities we can demonstrate: the transports the engine
 * drives and the vendors it supports.
 */
const CAPABILITIES = [
  "MediaTek BROM",
  "Qualcomm EDL 9008",
  "Samsung Download Mode",
  "Fastboot & Recovery",
  "ADB Automation",
  "Driver Auto-Install",
];

/** Optional inline preview: `devices` renders brand tiles, `terminal` a console. */
type BentoVisual = "devices" | "terminal" | null;

interface BentoFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
  span: string;
  accent: string;
  visual: BentoVisual;
  /**
   * Lightweight capability chips shown when a card has no richer visual, so the
   * tile reads as complete instead of trailing off into empty space.
   */
  tags?: readonly string[];
}

/**
 * Bento grid capabilities. `span` drives the asymmetric bento layout on lg+.
 * USB Detection · One-Click FRP · Live Logging · Driver Center are the anchors.
 */
const BENTO: readonly BentoFeature[] = [
  {
    icon: Usb,
    title: "USB Device Detection",
    desc: "Real-time USB enumeration with chipset fingerprinting — Download, Recovery, EDL, BROM and fastboot modes recognised the instant you plug in.",
    span: "lg:col-span-4",
    accent: "from-brand-500 to-accent-500",
    visual: "devices" as const,
  },
  {
    icon: Zap,
    title: "One-Click FRP",
    desc: "Guided factory reset protection removal with verified, rollback-safe procedures for Samsung, Xiaomi, Vivo, OPPO and Pixel.",
    span: "lg:col-span-2",
    accent: "from-accent-500 to-brand-600",
    visual: null,
    tags: ["Samsung", "Xiaomi", "Vivo", "OPPO", "Pixel"],
  },
  {
    icon: Terminal,
    title: "Live Logging",
    desc: "Streamed ADB, fastboot and driver output in a built-in console with exportable session logs.",
    span: "lg:col-span-2",
    accent: "from-emerald-500 to-teal-500",
    visual: "terminal" as const,
  },
  {
    icon: Cable,
    title: "Driver Center",
    desc: "Detects missing OEM USB drivers and installs the correct package automatically — MediaTek, Qualcomm and vendor-specific.",
    span: "lg:col-span-2",
    accent: "from-violet-500 to-brand-500",
    visual: null,
    tags: ["MediaTek", "Qualcomm", "OEM USB", "Auto-Install"],
  },
  {
    icon: Cpu,
    title: "Guided Recovery",
    desc: "Step-by-step visual walkthroughs for every mode, written by engineers who flash phones for a living.",
    span: "lg:col-span-2",
    accent: "from-amber-500 to-rose-500",
    visual: null,
    tags: ["EDL", "Download", "Recovery", "Fastboot"],
  },
];

const PRICING_NOTES: Record<string, string> = {
  MONTH_1: "per 6 months (launch offer)",
  LIFETIME: "one-time",
};

const PLAN_BADGES: Record<string, string> = {
  LIFETIME: "MOST POPULAR",
};

/**
 * Icon per free utility, keyed by the stable FreeToolId so the mapping stays
 * exhaustive at compile time. The shared metadata is data-only (no JSX), so the
 * icon resolution lives here in the web layer.
 */
const FREE_TOOL_ICONS: Record<FreeToolId, LucideIcon> = {
  "whatsapp-transfer": MessageCircle,
  "phone-transfer": Smartphone,
  "data-eraser": Eraser,
  "virtual-location": MapPin,
};

export const metadata: Metadata = {
  ...pageMetadata({
    title: PRIMARY_TITLE,
    description: PRODUCT_DESCRIPTION,
    path: "/",
    keywords: PRIMARY_KEYWORDS,
  }),
  // Bypass the root template so the landing page keeps the exact brand title.
  title: { absolute: PRIMARY_TITLE },
};

export default function HomePage() {
  // Resolve the installer URL once per render (NEXT_PUBLIC_DOWNLOAD_URL →
  // DOWNLOAD_BASE_URL → GitHub Releases v2.0.0 default). See config/download.ts.
  const downloadUrl = resolveInstallerUrl();
  // Promo-aware $20 term: 6 months during the 30-day launch window, 2 months after.
  // Computed per render so the static HTML matches the live entitlement.
  const monthlyMonths = promoMonthlyMonthsFor(isPromoActive());

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-600 antialiased">
      {/* Soft aurora canvas — gives the frosted panels something to refract. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-canvas-mesh"
      />
      {/* Structured data: SoftwareApplication rich result + site/brand + FAQ graph. */}
      <JsonLd id="ld-software-application" data={softwareApplicationSchema()} />
      <JsonLd id="ld-website" data={websiteSchema()} />
      {/* Standalone Organization node so Google can resolve the brand + logo. */}
      <JsonLd id="ld-organization" data={organizationPageSchema()} />
      <JsonLd id="ld-faq" data={faqPageSchema(HOME_FAQ)} />

      {/* ================= NAVBAR ================= */}
      <header className="glass-nav sticky top-0 z-50">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px]">
          {/* Crisp logo lockup */}
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="FRPB — FRP bypass and Android device recovery tool"
              width={72}
              height={72}
              priority
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 transition group-hover:ring-slate-300"
            />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">
                Utility Suite
              </span>
            </span>
          </Link>

          {/* Primary navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Deep link to the money page from the header — descriptive anchor
                text so the crawl path and link equity reach /pricing. */}
            <Link
              href="/pricing"
              className="hidden text-sm font-semibold text-slate-500 transition hover:text-ink md:inline-flex"
            >
              Pricing Plans
            </Link>
            <Link
              href="/auth"
              className="hidden text-sm font-semibold text-slate-500 transition hover:text-ink md:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href={downloadUrl}
              className="btn-accent btn-shine hidden px-4 py-2.5 text-xs sm:inline-flex md:text-sm"
            >
              <Download className="h-4 w-4" />
              Download for Windows
            </Link>
            <button
              type="button"
              className="inline-flex h-11 w-11 touch-manipulation select-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition active:scale-95 active:bg-slate-100 hover:border-slate-300 hover:text-ink lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <Hero downloadUrl={downloadUrl} metrics={HOME_METRICS} />

      {/* ================= BRAND SLIDER ================= */}
      <section id="brands" className="border-y border-slate-200/80 bg-slate-50/60">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            Trusted across the world's most popular device brands
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-sm font-bold text-slate-500 shadow-sm transition-all hover:-translate-y-1 hover:border-brand-300 hover:text-ink hover:shadow-md"
              >
                <Smartphone className="h-4 w-4" />
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DUAL DEVICE SHOWCASE ================= */}
      <ErrorBoundary label="device showcase">
        <DeviceShowcase downloadUrl={downloadUrl} />
      </ErrorBoundary>

      {/* ================= CAPABILITY STRIP ================= */}
      <section aria-label="Supported recovery transports" className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Supported transports & tooling
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {CAPABILITIES.map((capability) => (
              <span
                key={capability}
                className="text-sm font-bold tracking-tight text-slate-400 transition hover:text-ink sm:text-base"
              >
                {capability}
              </span>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-slate-400">
            {SUPPORTED_MODES.length} boot modes · {SUPPORTED_CHIPSETS.length} chipset
            families · {HOME_METRICS.supportedModelCount}+ catalogued models
          </p>
        </div>
      </section>

      {/* ================= FEATURES (BENTO GRID) ================= */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate bg-grid-32 [mask-image:radial-gradient(60%_50%_at_50%_40%,black,transparent)]" />
        <div className="mx-auto max-w-2xl text-center">
          <span className="badge mb-4">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            Why FRPB
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Everything you need to rescue a device
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            A focused toolkit that removes the guesswork from driver installs, recovery modes and
            firmware restore — designed for technicians and authorized owners alike.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:auto-rows-fr lg:grid-cols-6">
          {BENTO.map((feature) => (
            <div
              key={feature.title}
              className={`glass-surface group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-white/80 hover:shadow-glass-light-hover sm:p-6 ${feature.span}`}
            >
              {/* hover gradient bloom */}
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${feature.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10`}
              />
              <div className="relative flex h-full flex-col">
                <div
                  className={`mb-5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-ink">{feature.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  {feature.desc}
                </p>

                {/* Inline bento visuals */}
                {feature.visual === "devices" ? (
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {[
                      { brand: "Samsung", chipset: "Exynos / SD", mode: "EDL" },
                      { brand: "Xiaomi", chipset: "Snapdragon", mode: "fastboot" },
                      { brand: "Google Pixel", chipset: "Tensor", mode: "Recovery" },
                    ].map((d) => (
                      <div
                        key={d.brand}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md border border-emerald-200 bg-emerald-50">
                            <Activity className="h-3 w-3 text-emerald-600" />
                          </span>
                          <span className="text-[11px] font-semibold text-ink">{d.brand}</span>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">{d.chipset}</p>
                        <span className="mt-2 inline-block rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          {d.mode}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {feature.visual === "terminal" ? (
                  <div className="mt-6 rounded-xl border border-slate-800/90 bg-slate-900 p-3 font-mono text-[10px] leading-relaxed">
                    {[
                      { c: "text-emerald-400", t: "[adb] shell getprop ro.product.model" },
                      { c: "text-slate-400", t: "[fastboot] devices → 1 target online" },
                      { c: "text-accent-300", t: "[log] streaming console output…" },
                    ].map((line) => (
                      <div key={line.t} className={`flex gap-2 ${line.c}`}>
                        <span className="text-slate-600">›</span>
                        <span className="truncate">{line.t}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/*
                 * Capability chips. `mt-auto` anchors them to the bottom so equal-
                 * height desktop rows read as intentional; on mobile the card is
                 * content-sized (grid rows are only equalised at sm+), so the chips
                 * simply sit under the copy with no blank gap beneath them.
                 */}
                {feature.tags ? (
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                    {feature.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= POWERFUL DESKTOP UTILITIES ================= */}
      <section
        id="free-tools"
        className="relative border-t border-slate-200/80 bg-gradient-to-b from-white to-slate-50 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="badge mb-4 border-brand-200 bg-brand-50 text-brand-700">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              Pro Utility · Included with License
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Powerful Desktop Utilities
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              Four standalone utilities that run entirely on your PC — transfer WhatsApp and
              phone data, wipe a device, or mock your location. Included with an FRPB Active
              License — download the desktop software to get started.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FREE_TOOL_IDS.map((id) => {
              const tool = FREE_TOOLS[id];
              const Icon = FREE_TOOL_ICONS[id];
              return (
                <Link
                  key={tool.id}
                  href={tool.path}
                  className="glass-surface group relative flex flex-col overflow-hidden p-6 transition duration-300 hover:-translate-y-1.5 hover:border-emerald-300/80 hover:shadow-glass-light-hover"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10" />
                  <div className="relative flex h-full flex-col">
                    <div className="mb-5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-ink">{tool.eyebrow}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{tool.tagline}</p>
                    <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {tool.target}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-emerald-600 transition group-hover:gap-2.5">
                      Explore Tool
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            Looking for FRP removal?{" "}
            <Link href="/pricing" className="font-bold text-brand-600 hover:text-brand-700">
              Compare the full toolkit →
            </Link>
          </p>
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section
        id="pricing"
        className="relative border-t border-slate-200/80 bg-gradient-to-b from-slate-50 to-white py-20 sm:py-24"
      >
        <div className="pointer-events-none absolute inset-0 bg-hero-glow opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="badge mb-4">
              <LifeBuoy className="h-3.5 w-3.5 text-brand-500" />
              Simple pricing
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              One license. Every tool.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              Choose a plan that fits. Every license unlocks the complete FRPB
              toolkit — no feature gates, no hidden fees.
            </p>
          </div>

          {/* Launch-offer banner — client component that self-hides once the
              countdown expires, so the static shell never shows stale urgency. */}
          <div className="mx-auto mt-10 max-w-4xl">
            <PromoBanner />
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 grid-cols-1 md:grid-cols-2">
            {PLANS.map((plan) => {
              const popular = plan.slug === "LIFETIME";
              const badge = PLAN_BADGES[plan.slug];
              return (
                <div
                  key={plan.slug}
                  className={`glass-panel-strong group relative flex flex-col p-8 transition duration-300 hover:-translate-y-1.5 ${
                    popular
                      ? "border-brand-300 ring-1 ring-brand-500/20 hover:shadow-glass-light-hover"
                      : "hover:border-white/80 hover:shadow-glass-light-hover"
                  }`}
                >
                  {/* hover glow bloom */}
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/0 via-brand-500/0 to-accent-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  {badge ? (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-[10px] font-bold tracking-wider shadow-lg ${
                        popular
                          ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-brand-500/40"
                          : "border border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}

                  <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black tracking-tight text-ink">
                      {/* `plan.usd` is the canonical whole-dollar display price
                          from @frpb/shared. The amount actually charged is
                          resolved server-side, never from this value. */}
                      ${plan.usd}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      {plan.slug === "MONTH_1"
                        ? `per ${monthlyMonths} months`
                        : PRICING_NOTES[plan.slug]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {plan.deviceLimit} device{plan.deviceLimit === 1 ? "" : "s"} ·{" "}
                    {plan.slug === "MONTH_1"
                      ? `${monthlyMonths * 30} days`
                      : "Lifetime access"}
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-slate-600">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                            popular
                              ? "border-brand-200 bg-brand-50 text-brand-600"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/pricing?plan=${plan.slug}`}
                    className={`btn-shine mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${
                      popular
                        ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                        : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
                    }`}
                  >
                    {plan.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
            FRPB is a device utility intended for authorized device owners only. You must have the
            right to access the device you recover. Use of FRPB to bypass security protections on
            devices you do not own may violate applicable laws.
          </p>
        </div>
      </section>

      {/* ================= GUIDES / CTA ================= */}
      <section id="guides" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="glass-panel glass-sheen relative overflow-hidden p-10 sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-grid-slate bg-grid-32 opacity-60 [mask-image:radial-gradient(80%_80%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-500/10 blur-[100px] animate-pulse-glow" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-brand-200 bg-white text-brand-600 shadow-sm">
              <BookOpen className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Step-by-step recovery guides
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">
              Follow illustrated, model-specific walkthroughs for Download mode, Recovery, ADB,
              Fastboot, Qualcomm EDL and MediaTek BROM — including honest guidance on the device
              locks that cannot be cleared in software.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={downloadUrl}
                className="btn-accent btn-shine inline-flex w-full items-center justify-center gap-2 px-7 py-3.5 text-base hover:-translate-y-0.5 sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download for Windows
              </Link>
              <Link
                href="/pricing"
                className="btn-ghost inline-flex w-full items-center justify-center gap-2 px-7 py-3.5 text-base hover:-translate-y-0.5 sm:w-auto"
              >
                Browse pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-400">
              {SUPPORTED_MODES.length} boot modes · {SUPPORTED_CHIPSETS.length} chipset
              families · download & activate with your license
            </p>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <FaqSection items={HOME_FAQ} />

      {/* ================= FOOTER ================= */}
      {/* The site-wide <SiteFooter /> (mounted in the root layout) renders the
          footer here too, but it skips the home route so the home page can own
          the in-page `#eula` anchor target. */}
      <Footer id="eula" />
    </div>
  );
}
