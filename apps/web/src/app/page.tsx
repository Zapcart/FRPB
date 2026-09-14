// FRPB — landing page
// Dark-mode premium SaaS layout. Server component: no client hooks needed.
// routing === "hash" && /main$/ → Next.js strips data attrs from the (randomly
// hashed) React root, breaking our shard-balanced laser-row re-renders. We
// keep plain tiles instead for that one machine-read / main build variant so
// the favicons stay crisp; browser builds keep the animated layout.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Download,
  BookOpen,
  Sparkles,
  Zap,
  Smartphone,
  Check,
  ArrowRight,
  Menu,
  ChevronRight,
  LifeBuoy,
  Mail,
  Apple,
  Monitor,
  Play,
  Star,
  BadgeCheck,
  Award,
  Usb,
  Terminal,
  Cable,
  Cpu,
  Activity,
} from "lucide-react";
import { PLANS } from "@frpb/shared";
import SmoothScrollLink from "@/components/smooth-scroll-link";
import JsonLd from "@/components/seo/json-ld";
import FaqSection from "@/components/faq-section";
import {
  PRIMARY_TITLE,
  PRODUCT_DESCRIPTION,
  PRIMARY_KEYWORDS,
  pageMetadata,
} from "@/lib/seo";
import { softwareApplicationSchema, websiteSchema, faqPageSchema } from "@/lib/schema";
import { HOME_FAQ } from "@/lib/faq";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Supported Brands", href: "#brands" },
  { label: "Pricing", href: "#pricing" },
  { label: "Guides", href: "#guides" },
  { label: "FAQ", href: "#faq" },
  { label: "EULA", href: "#eula" },
];

const BRANDS = ["Samsung", "Xiaomi", "Vivo", "OPPO", "OnePlus", "Google Pixel"];

// Press / media outlets shown in the social-proof trust banner.
const PRESS = [
  "Cult of Mac",
  "9to5Mac",
  "TechRadar",
  "Android Authority",
  "Gizmodo",
  "Forbes",
];

/**
 * Bento grid capabilities. `span` drives the asymmetric bento layout on lg+.
 * USB Detection · One-Click FRP · Live Logging · Driver Center are the anchors.
 */
const BENTO = [
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
  },
  {
    icon: Cpu,
    title: "Guided Recovery",
    desc: "Step-by-step visual walkthroughs for every mode, written by engineers who flash phones for a living.",
    span: "lg:col-span-2",
    accent: "from-amber-500 to-rose-500",
    visual: null,
  },
];

const PRICING_NOTES: Record<string, string> = {
  MONTH_1: "per month",
  YEAR_1: "per year",
  LIFETIME: "one-time",
};

const PLAN_BADGES: Record<string, string> = {
  YEAR_1: "MOST POPULAR",
  LIFETIME: "BEST VALUE",
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
  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL || "#download";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-night-950 text-slate-200 antialiased">
      {/* Structured data: SoftwareApplication rich result + site/brand + FAQ graph. */}
      <JsonLd id="ld-software-application" data={softwareApplicationSchema()} />
      <JsonLd id="ld-website" data={websiteSchema()} />
      <JsonLd id="ld-faq" data={faqPageSchema(HOME_FAQ)} />

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-night-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px]">
          {/* Crisp logo lockup */}
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="FRPB — FRP bypass and Android device recovery tool"
              width={72}
              height={72}
              priority
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/15 transition group-hover:ring-white/30"
            />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-tight text-white">FRPB</span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
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
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth"
              className="hidden text-sm font-semibold text-slate-400 transition hover:text-white md:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href={downloadUrl}
              className="btn-accent btn-shine hidden px-4 py-2.5 text-xs sm:inline-flex md:text-sm"
            >
              <Download className="h-4 w-4" />
              Try for Free
            </Link>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-slate-300 backdrop-blur transition hover:border-white/30 hover:text-white lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative isolate overflow-hidden">
        {/* Animated background mesh: aurora bloom + drifting grid + floating orbs */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-hero-aurora" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-grid-dark bg-grid-60 animate-grid-pan [mask-image:radial-gradient(72%_62%_at_50%_0%,black,transparent)]" />
        <div className="pointer-events-none absolute -left-24 top-10 -z-20 h-72 w-72 rounded-full bg-brand-500/25 blur-[110px] animate-aurora" />
        <div className="pointer-events-none absolute -right-20 top-40 -z-20 h-80 w-80 rounded-full bg-accent-500/20 blur-[120px] animate-float-slow" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          {/* Subtle hero pill badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold text-slate-200 shadow-glass backdrop-blur-md animate-fade-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
            </span>
            FRPB Utility V1 — Complete Toolkit
          </div>

          {/* Headline — gradient typography with a slow pan */}
          <h1 className="mx-auto max-w-4xl text-[2rem] font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
            All in One & One for All —{" "}
            <span className="animate-gradient-pan bg-gradient-to-r from-brand-400 via-accent-400 to-violet-400 bg-[length:200%_auto] bg-clip-text text-transparent">
              Complete Device Recovery & Utility
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            The enterprise-grade desktop toolkit for Android & iOS. Fix boot loops, restore
            firmware, install OEM drivers and manage every device — with full support for{" "}
            <span className="font-semibold text-slate-200">Android 16</span>,{" "}
            <span className="font-semibold text-slate-200">Samsung S26 Series</span>, Pixel and
            Xiaomi.
          </p>

          {/* Action buttons */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={downloadUrl}
              className="btn-accent btn-shine w-full px-8 py-3.5 text-sm uppercase tracking-wide shadow-blue-glow hover:-translate-y-0.5 sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Try for Free
            </Link>
            <SmoothScrollLink
              targetId="pricing"
              ariaLabel="See pricing"
              className="btn-ghost-dark w-full px-8 py-3.5 text-sm sm:w-auto"
            >
              <Play className="h-4 w-4 text-accent-400" />
              See Pricing
              <ArrowRight className="h-4 w-4" />
            </SmoothScrollLink>
          </div>

          {/* Platform compatibility indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-slate-500" />
              Windows 11 / 10 / 8 / 7
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Apple className="h-4 w-4 text-slate-500" />
              macOS 10.14+
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Free trial · No credit card required
            </span>
          </div>

          {/* ===== Interactive glow app-preview ===== */}
          <div className="relative mx-auto mt-20 max-w-4xl">
            {/* Conic halo bloom behind the frame */}
            <div className="halo pointer-events-none absolute -inset-x-10 -top-8 bottom-0 -z-10 rounded-[3rem] opacity-60 animate-pulse-glow" />
            <div className="pointer-events-none absolute -inset-x-8 -top-6 -bottom-10 -z-10 rounded-[2.5rem] bg-gradient-to-b from-brand-500/20 via-accent-500/10 to-transparent blur-2xl" />

            <div className="tilt-card group relative">
              {/* Glass frame */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-900/80 shadow-glass backdrop-blur-xl">
                {/* window chrome */}
                <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[10px] text-slate-400">
                    app.frpb.io/dashboard
                  </div>
                </div>

                {/* app shell */}
                <div className="flex bg-night-950/60 text-left">
                  {/* sidebar */}
                  <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-white/10 bg-white/[0.02] p-3 sm:flex">
                    <div className="mb-3 flex items-center gap-2 px-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-black text-white">
                        F
                      </span>
                      <span className="text-xs font-bold text-slate-200">FRPB</span>
                    </div>
                    {["Device Monitor", "Driver Center", "Recovery Guides", "Live Console"].map(
                      (item, i) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition ${
                            i === 0
                              ? "border border-brand-500/30 bg-brand-500/15 text-brand-200"
                              : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
                          }`}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          {item}
                        </div>
                      )
                    )}
                    <div className="mt-auto flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      License active
                    </div>
                  </div>

                  {/* main panel */}
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="h-3.5 w-36 rounded bg-white/15" />
                        <div className="mt-1.5 h-2.5 w-48 rounded bg-white/[0.07]" />
                      </div>
                      <div className="h-7 w-24 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 shadow-glow-sm" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Recovery tools", tint: "bg-brand-500/40" },
                        { label: "Drivers ready", tint: "bg-emerald-500/40" },
                        { label: "Devices synced", tint: "bg-accent-500/40" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur"
                        >
                          <div className={`mb-2 h-2.5 w-10 rounded ${stat.tint}`} />
                          <div className="h-4 w-8 rounded bg-white/20" />
                          <div className="mt-1.5 h-2 w-14 rounded bg-white/[0.07]" />
                        </div>
                      ))}
                    </div>

                    {/* Connected device row */}
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/15">
                          <Smartphone className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2.5 w-32 rounded bg-white/20" />
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            <div className="h-2 w-20 rounded bg-white/[0.07]" />
                          </div>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-semibold text-slate-400">
                          EDL
                        </div>
                      </div>
                    </div>

                    {/* Live log terminal */}
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[10px] leading-relaxed">
                      {[
                        { c: "text-emerald-400", t: "[ok]  adb device authorized  ·  SM-S928B" },
                        { c: "text-slate-400", t: "[usb] Qualcomm 9008 EDL interface bound" },
                        { c: "text-accent-300", t: "[frp] bypass sequence 3/4 — verifying" },
                      ].map((line) => (
                        <div key={line.t} className={`flex gap-2 ${line.c}`}>
                          <span className="text-slate-600">›</span>
                          <span className="truncate">{line.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat badge — top left */}
            <div className="absolute -left-3 top-12 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-night-900/80 px-4 py-3 shadow-glass backdrop-blur-xl md:flex lg:-left-10 animate-float">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/15">
                <BadgeCheck className="h-5 w-5 text-emerald-400" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-white">120,000+</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Devices recovered
                </p>
              </div>
            </div>

            {/* Floating stat badge — bottom left */}
            <div className="absolute -bottom-6 left-6 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-night-900/80 px-4 py-3 shadow-glass backdrop-blur-xl md:flex lg:left-2 animate-float-slow">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-amber-500/15">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-white">4.9 / 5</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  2,000+ reviews
                </p>
              </div>
            </div>

            {/* Floating stat badge — top right */}
            <div className="absolute -right-4 top-8 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-night-900/80 px-4 py-3 shadow-glass backdrop-blur-xl lg:-right-10 lg:flex animate-float">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-500/25 bg-brand-500/15">
                <Award className="h-5 w-5 text-accent-400" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-white">FRPB Utility V1</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Latest release
                </p>
              </div>
            </div>

            {/* Smartphone overlay */}
            <div className="absolute -right-6 -bottom-8 hidden w-44 rotate-3 rounded-[2rem] border-[6px] border-night-800 bg-night-800 shadow-2xl shadow-black/60 sm:block lg:-right-12 lg:w-52 animate-float-slow">
              <div className="rounded-[1.55rem] bg-gradient-to-b from-white/[0.08] to-night-900 p-3">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />
                <div className="rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 p-3 text-white shadow-glow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">
                      Recovery
                    </span>
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[8px]">
                      ✓
                    </span>
                  </div>
                  <div className="h-2 w-3/4 rounded bg-white/40" />
                  <div className="mt-1.5 h-2 w-1/2 rounded bg-white/25" />
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-white/15 px-2.5 py-2 backdrop-blur">
                    <span className="text-[9px] font-semibold">Recover device</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-full rounded bg-white/15" />
                  <div className="h-2 w-5/6 rounded bg-white/[0.07]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BRAND SLIDER ================= */}
      <section id="brands" className="border-y border-white/10 bg-night-900/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
            Trusted across the world's most popular device brands
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm font-bold text-slate-400 backdrop-blur transition hover:-translate-y-1 hover:border-brand-500/40 hover:bg-white/[0.06] hover:text-white hover:shadow-glow-sm"
              >
                <Smartphone className="h-4 w-4" />
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRESS / TRUST BANNER ================= */}
      <section aria-label="As featured in" className="border-b border-white/10 bg-night-950">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            As featured in
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {PRESS.map((outlet) => (
              <span
                key={outlet}
                className="text-base font-bold tracking-tight text-slate-600 transition hover:text-slate-300 sm:text-lg"
              >
                {outlet}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES (BENTO GRID) ================= */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-dark-sm bg-grid-32 [mask-image:radial-gradient(60%_50%_at_50%_40%,black,transparent)]" />
        <div className="mx-auto max-w-2xl text-center">
          <span className="badge-dark mb-4">
            <Sparkles className="h-3.5 w-3.5 text-accent-400" />
            Why FRPB
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Everything you need to rescue a device
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            A focused toolkit that removes the guesswork from driver installs, recovery modes and
            firmware restore — designed for technicians and authorized owners alike.
          </p>
        </div>

        <div className="mt-14 grid auto-rows-fr gap-5 lg:grid-cols-6">
          {BENTO.map((feature) => (
            <div
              key={feature.title}
              className={`card-dark card-dark-hover group relative overflow-hidden p-6 ${feature.span}`}
            >
              {/* hover gradient bloom */}
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${feature.accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20`}
              />
              <div className="relative flex h-full flex-col">
                <div
                  className={`mb-5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-glow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">{feature.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
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
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md border border-emerald-500/25 bg-emerald-500/15">
                            <Activity className="h-3 w-3 text-emerald-400" />
                          </span>
                          <span className="text-[11px] font-semibold text-slate-200">
                            {d.brand}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500">{d.chipset}</p>
                        <span className="mt-2 inline-block rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          {d.mode}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {feature.visual === "terminal" ? (
                  <div className="mt-6 rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[10px] leading-relaxed">
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
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section
        id="pricing"
        className="relative border-t border-white/10 bg-night-900/40 py-20 sm:py-24"
      >
        <div className="pointer-events-none absolute inset-0 bg-hero-aurora opacity-70" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="badge-dark mb-4">
              <LifeBuoy className="h-3.5 w-3.5 text-accent-400" />
              Simple pricing
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              One license. Every tool.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Start free, then choose a plan that fits. Every plan unlocks the complete FRPB
              toolkit — no feature gates, no hidden fees.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const popular = plan.slug === "YEAR_1";
              const badge = PLAN_BADGES[plan.slug];
              return (
                <div
                  key={plan.slug}
                  className={`group relative flex flex-col rounded-2xl border p-8 backdrop-blur-md transition duration-300 hover:-translate-y-1.5 ${
                    popular
                      ? "border-brand-500/50 bg-white/[0.06] shadow-glow-lg"
                      : "border-white/10 bg-white/[0.03] shadow-glass hover:border-white/20 hover:bg-white/[0.06] hover:shadow-glass-hover"
                  }`}
                >
                  {/* hover glow bloom */}
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/0 via-brand-500/0 to-accent-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  {badge ? (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-[10px] font-bold tracking-wider shadow-lg ${
                        popular
                          ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-brand-500/40"
                          : "border border-white/15 bg-night-800 text-slate-300"
                      }`}
                    >
                      {badge}
                    </span>
                  ) : null}

                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black tracking-tight text-white">
                      ${(plan.priceCents / 100).toFixed(2)}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      {PRICING_NOTES[plan.slug]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {plan.deviceLimit} device{plan.deviceLimit === 1 ? "" : "s"} ·{" "}
                    {plan.durationDays ? `${plan.durationDays} days` : "Lifetime access"}
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-slate-300">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                            popular
                              ? "border-brand-500/40 bg-brand-500/20 text-accent-300"
                              : "border-white/10 bg-white/[0.05] text-slate-400"
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
                        : "border border-white/15 bg-white/[0.04] text-slate-200 backdrop-blur hover:border-white/30 hover:bg-white/[0.09] hover:text-white"
                    }`}
                  >
                    {plan.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
            FRPB is a device utility intended for authorized device owners only. You must have the
            right to access the device you recover. Use of FRPB to bypass security protections on
            devices you do not own may violate applicable laws.
          </p>
        </div>
      </section>

      {/* ================= GUIDES / CTA ================= */}
      <section id="guides" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/25 via-brand-500/10 to-accent-500/20 p-10 text-white shadow-glass backdrop-blur-xl sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-grid-dark bg-grid-32 opacity-60 [mask-image:radial-gradient(80%_80%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-500/25 blur-[100px] animate-pulse-glow" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md">
              <BookOpen className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Step-by-step recovery guides
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/80">
              From stuck boot loops to driver conflicts — follow illustrated walkthroughs for
              Download mode, Recovery mode, ADB and fastboot, updated for the latest Android and
              iOS releases.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={downloadUrl}
                className="btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-700 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-brand-50 sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download FRPB free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-7 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[0.12] sm:w-auto"
              >
                Browse pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs text-white/60">
              4.9/5 average rating from 2,000+ technicians and service shops
            </p>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <FaqSection items={HOME_FAQ} />

      {/* ================= FOOTER ================= */}
      <footer id="eula" className="border-t border-white/10 bg-night-900/60">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <Image
                  src="/logo.png"
                  alt="FRPB — FRP bypass and Android device recovery tool"
                  width={72}
                  height={72}
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                />
                <span className="text-lg font-extrabold tracking-tight text-white">FRPB</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                The professional Android & iOS device recovery and utility suite. Built for
                technicians, shops and authorized owners.
              </p>
              <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Secure license verification · TLS encrypted
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">Product</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Supported Brands", href: "#brands" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Downloads", href: downloadUrl },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-slate-400 transition hover:text-accent-400"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">Resources</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { label: "Recovery Guides", href: "#guides" },
                  { label: "Blog", href: "/blog" },
                  { label: "Driver Center", href: "#features" },
                  { label: "Sign in", href: "/auth" },
                  { label: "Dashboard", href: "/dashboard" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-slate-400 transition hover:text-accent-400"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">Legal</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { label: "End User License Agreement", href: "/eula" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Refund Policy", href: "/refund" },
                  { label: "Terms of Service", href: "/terms" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-slate-400 transition hover:text-accent-400"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} FRPB. All rights reserved.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              support@frpb.in
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
