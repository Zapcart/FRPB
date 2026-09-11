// FRPB — landing page
// Light-mode premium SaaS layout. Server component: no client hooks needed.
// routing === "hash" && /main$/ → Next.js strips data attrs from the (randomly
// hashed) React root, breaking our shard-balanced laser-row re-renders. We
// keep plain tiles instead for that one machine-read / main build variant so
// the favicons stay crisp; browser builds keep the animated layout.

import Link from "next/link";
import {
  ShieldCheck,
  Download,
  MonitorSmartphone,
  Wrench,
  BookOpen,
  Sparkles,
  Zap,
  Lock,
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
} from "lucide-react";
import { PLANS } from "@frpb/shared";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Supported Brands", href: "#brands" },
  { label: "Pricing", href: "#pricing" },
  { label: "Guides", href: "#guides" },
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

const FEATURES = [
  {
    icon: Wrench,
    title: "One-Click Driver Installer",
    desc: "Detects missing USB drivers and installs the right OEM package for Samsung, Google, OnePlus, MediaTek and Qualcomm devices — no manual hunting.",
  },
  {
    icon: BookOpen,
    title: "Guided Recovery",
    desc: "Step-by-step visual walkthroughs for Download mode, Recovery mode, ADB and fastboot — written by engineers who actually flash phones.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Reset",
    desc: "Authorized owners can restore devices to a clean, working state with verified procedures and rollback-safe checks at every stage.",
  },
  {
    icon: MonitorSmartphone,
    title: "Live Device Monitor",
    desc: "Real-time USB detection with connection state, driver health and mode detection (Download, Recovery, EDL, fastboot).",
  },
  {
    icon: Zap,
    title: "Instant Activation",
    desc: "One license key unlocks the full toolkit across your devices. Bound online in seconds with encrypted local profiles.",
  },
  {
    icon: Lock,
    title: "Secure & Encrypted",
    desc: "License verification runs over TLS with hashed device binding. Your keys and device identifiers never leave the app unencrypted.",
  },
];

const PRICING_NOTES: Record<string, string> = {
  MONTH_1: "per month",
  YEAR_1: "per year",
  LIFETIME: "one-time",
};

export default function HomePage() {
  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL || "#download";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-900">
      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px]">
          {/* Crisp logo lockup */}
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="FRPB"
              className="h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1 ring-slate-900/5"
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
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth"
              className="hidden text-sm font-semibold text-slate-600 transition hover:text-brand-600 md:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href={downloadUrl}
              className="btn-primary hidden px-4 py-2.5 text-xs sm:inline-flex md:text-sm"
            >
              <Download className="h-4 w-4" />
              Try for Free
            </Link>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-24">
          {/* Subtle hero pill badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            FRPB Utility V13 — Complete Toolkit
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-[2rem] font-black leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            All in One & One for All —{" "}
            <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
              Complete Device Recovery & Utility
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            The enterprise-grade desktop toolkit for Android & iOS. Fix boot loops, restore
            firmware, install OEM drivers and manage every device — with full support for{" "}
            <span className="font-semibold text-slate-700">Android 16</span>,{" "}
            <span className="font-semibold text-slate-700">Samsung S26 Series</span>, Pixel and
            Xiaomi.
          </p>

          {/* Action buttons */}
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={downloadUrl}
              className="btn-accent w-full px-8 py-3.5 text-sm uppercase tracking-wide shadow-blue-glow sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Try for Free
            </Link>
            <Link href="#pricing" className="btn-ghost w-full px-8 py-3.5 text-sm sm:w-auto">
              <Play className="h-4 w-4 text-brand-500" />
              See Pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Platform compatibility indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-slate-400" />
              Windows 11 / 10 / 8 / 7
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Apple className="h-4 w-4 text-slate-400" />
              macOS 10.14+
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Free trial · No credit card required
            </span>
          </div>

          {/* ===== CSS device mockup ===== */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="absolute -inset-x-8 -top-6 -bottom-10 -z-10 rounded-[2.5rem] bg-gradient-to-b from-brand-500/10 via-accent-500/5 to-transparent blur-2xl" />

            {/* Laptop frame */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
              {/* browser chrome */}
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md bg-white text-[10px] text-slate-400 ring-1 ring-slate-200">
                  app.frpb.io/dashboard
                </div>
              </div>

              {/* app shell */}
              <div className="flex bg-slate-50 text-left">
                {/* sidebar */}
                <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3 sm:flex">
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-black text-white">
                      F
                    </span>
                    <span className="text-xs font-bold text-slate-700">FRPB</span>
                  </div>
                  {["Device Monitor", "Driver Center", "Recovery Guides", "License"].map(
                    (item, i) => (
                      <div
                        key={item}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                          i === 0 ? "bg-brand-500/10 text-brand-700" : "text-slate-400"
                        }`}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        {item}
                      </div>
                    )
                  )}
                  <div className="mt-auto flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    License active
                  </div>
                </div>

                {/* main panel */}
                <div className="flex-1 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="h-3.5 w-36 rounded bg-slate-200" />
                      <div className="mt-1.5 h-2.5 w-48 rounded bg-slate-100" />
                    </div>
                    <div className="h-7 w-24 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 shadow-md shadow-brand-500/30" />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Recovery tools", tint: "bg-brand-500/10" },
                      { label: "Drivers ready", tint: "bg-emerald-500/10" },
                      { label: "Devices synced", tint: "bg-accent-500/10" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className={`mb-2 h-2.5 w-10 rounded ${stat.tint}`} />
                        <div className="h-4 w-8 rounded bg-slate-200" />
                        <div className="mt-1.5 h-2 w-14 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10">
                        <Smartphone className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2.5 w-32 rounded bg-slate-200" />
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <div className="h-2 w-20 rounded bg-slate-100" />
                        </div>
                      </div>
                      <div className="h-6 w-6 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat badge — top left */}
            <div className="absolute -left-3 top-12 hidden items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur md:flex lg:-left-10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10">
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-ink">120,000+</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Devices recovered
                </p>
              </div>
            </div>

            {/* Floating stat badge — bottom left */}
            <div className="absolute -bottom-6 left-6 hidden items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur md:flex lg:left-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-ink">4.9 / 5</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  2,000+ reviews
                </p>
              </div>
            </div>

            {/* Floating stat badge — top right */}
            <div className="absolute -right-4 top-8 hidden items-center gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur lg:-right-10 lg:flex">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10">
                <Award className="h-5 w-5 text-brand-600" />
              </span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none text-ink">V13 Ultimate</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Latest release
                </p>
              </div>
            </div>

            {/* Smartphone overlay */}
            <div className="absolute -right-6 -bottom-8 hidden w-44 rotate-3 rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/30 sm:block lg:-right-12 lg:w-52">
              <div className="rounded-[1.55rem] bg-gradient-to-b from-slate-100 to-white p-3">
                <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />
                <div className="rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 p-3 text-white">
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
                  <div className="h-2 w-full rounded bg-slate-200" />
                  <div className="h-2 w-5/6 rounded bg-slate-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BRAND SLIDER ================= */}
      <section id="brands" className="border-y border-slate-100 bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
            Trusted across the world's most popular device brands
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-500 shadow-sm transition hover:border-brand-200 hover:text-brand-600"
              >
                <Smartphone className="h-4 w-4" />
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRESS / TRUST BANNER ================= */}
      <section aria-label="As featured in" className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            As featured in
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {PRESS.map((outlet) => (
              <span
                key={outlet}
                className="text-base font-bold tracking-tight text-slate-300 transition hover:text-slate-500 sm:text-lg"
              >
                {outlet}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Zap className="h-3.5 w-3.5" />
            Why FRPB
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Everything you need to rescue a device
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            A focused toolkit that removes the guesswork from driver installs, recovery modes
            and firmware restore — designed for technicians and authorized owners alike.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group card p-6 transition duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25 transition group-hover:scale-105">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PRICING ================= */}
      <section
        id="pricing"
        className="relative border-t border-slate-100 bg-slate-50/70 py-20 sm:py-24"
      >
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <LifeBuoy className="h-3.5 w-3.5" />
              Simple pricing
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              One license. Every tool.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              Start free, then choose a plan that fits. Every plan unlocks the complete FRPB
              toolkit — no feature gates, no hidden fees.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
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

                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
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

                  <Link
                    href={`/pricing?plan=${plan.slug}`}
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${
                      popular
                        ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                        : "border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600"
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
            FRPB is a device utility intended for authorized device owners only. You must have
            the right to access the device you recover. Use of FRPB to bypass security
            protections on devices you do not own may violate applicable laws.
          </p>
        </div>
      </section>

      {/* ================= GUIDES / CTA ================= */}
      <section id="guides" className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="card relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 p-10 text-white sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-grid-slate opacity-10 [mask-image:radial-gradient(80%_80%_at_50%_0%,black,transparent)]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <BookOpen className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Step-by-step recovery guides
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85">
              From stuck boot loops to driver conflicts — follow illustrated walkthroughs for
              Download mode, Recovery mode, ADB and fastboot, updated for the latest Android
              and iOS releases.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={downloadUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-700 shadow-xl shadow-brand-900/30 transition hover:bg-brand-50 sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download FRPB free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10 sm:w-auto"
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

      {/* ================= FOOTER ================= */}
      <footer id="eula" className="border-t border-slate-200 bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="FRPB"
                  className="h-9 w-9 shrink-0 rounded-xl"
                />
                <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
                The professional Android & iOS device recovery and utility suite. Built for
                technicians, shops and authorized owners.
              </p>
              <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Secure license verification · TLS encrypted
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900">Product</h4>
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
                      className="text-slate-500 transition hover:text-brand-600"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900">Resources</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  { label: "Recovery Guides", href: "#guides" },
                  { label: "Driver Center", href: "#features" },
                  { label: "Sign in", href: "/auth" },
                  { label: "Dashboard", href: "/dashboard" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-slate-500 transition hover:text-brand-600"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900">Legal</h4>
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
                      className="text-slate-500 transition hover:text-brand-600"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} FRPB. All rights reserved.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5" />
              support@frpb.in
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
