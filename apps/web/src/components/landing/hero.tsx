// FRPB — landing hero section (modular).
//
// Premium animated hero: gradient glow + radial ripple background, gradient
// headline with staggered fade/scale entrances, floating capability tags and a
// trust marquee.
//
// Rendered as a SERVER component (no client hooks, zero JS shipped). All motion
// is authored with Tailwind CSS keyframes (see tailwind.config.ts) plus the
// `.btn-neon` / `.btn-glass` / `.hero-tag` / `.marquee-mask` /
// `.text-gradient-brand` component classes in globals.css — no Framer Motion
// dependency required. Every animation is transform/opacity only, so there is
// zero layout shift, and the global `prefers-reduced-motion` override in
// globals.css neutralises the motion for users who opt out.

import Link from "next/link";
import {
  Activity,
  Apple,
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  Cpu,
  Download,
  Monitor,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Usb,
  Zap,
  type LucideIcon,
} from "lucide-react";
import SmoothScrollLink from "@/components/smooth-scroll-link";
import type { HomeMetrics } from "@/lib/home-metrics";

interface HeroProps {
  /** Resolved desktop-installer download URL (from config/download.ts). */
  downloadUrl: string;
  /** Verifiable metrics sourced from lib/home-metrics.ts (not invented). */
  metrics: HomeMetrics;
}

/** Live telemetry chips shown at the top of the glass workspace card. */
const MODE_CHIPS: readonly { icon: LucideIcon; label: string; value: string; tint: string }[] = [
  { icon: Usb, label: "USB", value: "Linked", tint: "text-brand-600" },
  { icon: Activity, label: "ADB", value: "Online", tint: "text-emerald-600" },
  { icon: Cpu, label: "BROM", value: "Ready", tint: "text-accent-600" },
];

/** Streamed console lines rendered in the device workspace card. */
const CONSOLE_LINES: readonly { c: string; t: string }[] = [
  { c: "text-emerald-400", t: "[ok]  adb device authorized  ·  SM-S928B" },
  { c: "text-slate-400", t: "[usb] Qualcomm 9008 EDL interface bound" },
  { c: "text-accent-300", t: "[frp] bypass sequence 3/4 — verifying" },
];

/** Scrolling trust-badge marquee tokens shown below the hero content. */
const MARQUEE_BADGES: readonly string[] = [
  "Windows 11 / 10 / 8 / 7",
  "macOS 10.14+",
  "Samsung",
  "Xiaomi",
  "Vivo",
  "OPPO",
  "OnePlus",
  "Google Pixel",
  "MediaTek BROM",
  "Qualcomm EDL 9008",
  "Fastboot",
  "ADB",
  "Recovery Mode",
  "Driver Auto-Install",
];

/** Static capability chips below the subtitle — capability, not claims. */
const HERO_CHIPS: readonly string[] = ["Fastboot", "BROM", "EDL 9008", "One-Click Bypass"];

export default function Hero({ downloadUrl, metrics }: HeroProps) {
  const stats = [
    {
      icon: BadgeCheck,
      value: metrics.supportedModels,
      label: "Models supported",
      tint: "border-emerald-200 bg-emerald-50 text-emerald-600",
    },
    {
      icon: Award,
      value: metrics.supportedModes,
      label: "Boot modes supported",
      tint: "border-brand-200 bg-brand-50 text-brand-600",
    },
    {
      icon: Star,
      value: metrics.chipsetFamilies,
      label: "Chipset families",
      tint: "border-amber-200 bg-amber-50 text-amber-600",
    },
  ] as const;

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50/60 via-white to-white">
      {/* ---- Animated background: soft mesh + drifting grid + aurora bloom ---- */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-hero-glow" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-grid-slate bg-grid-60 animate-grid-pan [mask-image:radial-gradient(72%_62%_at_50%_0%,black,transparent)]" />
      <div className="pointer-events-none absolute -left-24 top-10 -z-20 h-72 w-72 rounded-full bg-brand-500/10 blur-[110px] animate-aurora" />
      <div className="pointer-events-none absolute -right-20 top-40 -z-20 h-80 w-80 rounded-full bg-accent-500/10 blur-[120px] animate-float-slow" />

      {/* ---- Radial ripple: static soft core + expanding rings (lightweight,
             pure CSS — no canvas/WebGL overhead). ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] -z-10 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-hero-ripple opacity-80"
      />
      {[0, 1.4, 2.8].map((delay) => (
        <div
          key={delay}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[28%] -z-10 -translate-x-1/2 -translate-y-1/2"
        >
          <div
            className="h-[30rem] w-[30rem] rounded-full border border-brand-400/25 animate-ripple"
            style={{ animationDelay: `${delay}s` }}
          />
        </div>
      ))}

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* ---- Left column: copy + CTAs + trust (7/12) ---- */}
          <div className="lg:col-span-7 lg:pr-6">
            {/* Hero pill badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm animate-fade-up">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
              </span>
              FRPB Utility V1 — Android FRP Toolkit
            </div>

            {/* Headline — sharp typography, gradient fill on the highlight. */}
            <h1 className="max-w-2xl text-[2rem] font-black leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem] animate-fade-scale">
              All-in-One FRPB Bypass & Recovery Tool —{" "}
              <span className="text-gradient-brand animate-gradient-pan">
                Automated Android FRP Unlock
              </span>
            </h1>

            <p
              className="mt-6 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg animate-fade-scale"
              style={{ animationDelay: "120ms" }}
            >
              The professional{" "}
              <span className="font-semibold text-ink">
                Android FRP unlock and device utility
              </span>{" "}
              toolkit. Clear Factory Reset Protection, flash reset a handset and install the right
              OEM drivers — driving MediaTek BROM, Qualcomm EDL (9008), Samsung Download, Fastboot
              and ADB, with support for Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola and Pixel.
            </p>

            {/* Capability chips (Fastboot / BROM / One-Click Bypass) */}
            <div
              className="mt-6 flex flex-wrap gap-2 animate-fade-scale"
              style={{ animationDelay: "220ms" }}
            >
              {HERO_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur"
                >
                  <Check className="h-3 w-3 text-brand-500" />
                  {chip}
                </span>
              ))}
            </div>

            {/* Primary CTAs — solid-neon + glassmorphic */}
            <div
              className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center animate-fade-scale"
              style={{ animationDelay: "320ms" }}
            >
              <Link href={downloadUrl} className="btn-neon btn-shine w-full sm:w-auto">
                <Download className="h-5 w-5" />
                Try FRPB Free
              </Link>
              <SmoothScrollLink
                targetId="pricing"
                ariaLabel="See pricing"
                className="btn-glass w-full sm:w-auto"
              >
                See Pricing
                <ArrowRight className="h-4 w-4" />
              </SmoothScrollLink>
            </div>

            {/* Platform compatibility / trust line */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
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
          </div>

          {/* ---- Right column: glass product showcase (5/12) ---- */}
          <div
            className="relative lg:col-span-5 animate-fade-scale-slow"
            style={{ animationDelay: "200ms" }}
          >
            {/* Gradient arched frame + bloom behind the glass card */}
            <div className="pointer-events-none absolute -inset-6 -z-10">
              <div className="h-full w-full rounded-[2.75rem] bg-gradient-to-br from-brand-500/15 via-accent-500/10 to-transparent blur-2xl" />
            </div>

            <div className="glass-hero relative">
              <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 shadow-card backdrop-blur-xl">
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/60 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-blue-glow">
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold leading-none text-ink">FRPB Engine</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Device workspace
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                {/* Live telemetry chips */}
                <div className="grid grid-cols-3 gap-2.5 px-5 pt-5">
                  {MODE_CHIPS.map((chip) => (
                    <div
                      key={chip.label}
                      className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-center shadow-sm"
                    >
                      <chip.icon className={`mx-auto h-4 w-4 ${chip.tint}`} />
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {chip.label}
                      </p>
                      <p className="text-xs font-bold text-ink">{chip.value}</p>
                    </div>
                  ))}
                </div>

                {/* Stylized device preview */}
                <div className="p-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                        <Smartphone className="h-5 w-5 text-emerald-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">Galaxy S24 · SM-S928B</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                          Qualcomm 9008 EDL detected
                        </p>
                      </div>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        EDL
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                        <span>FRP bypass sequence</span>
                        <span className="text-brand-600">75%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
                      </div>
                    </div>
                  </div>

                  {/* Live log terminal */}
                  <div className="mt-3 rounded-2xl border border-slate-800/90 bg-slate-900 p-3 font-mono text-[10px] leading-relaxed shadow-sm">
                    {CONSOLE_LINES.map((line) => (
                      <div key={line.t} className={`flex gap-2 ${line.c}`}>
                        <span className="text-slate-600">›</span>
                        <span className="truncate">{line.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating glassmorphic capability tags */}
              <div className="hero-tag -left-4 -top-4 animate-float">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Zap className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold text-ink">Fastboot</span>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              </div>

              <div className="hero-tag -right-4 top-24 animate-float-slow">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-50 text-accent-600">
                  <Cpu className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold text-ink">BROM</span>
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              </div>

              <div className="hero-tag -bottom-4 left-8 animate-bounce-slow">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-bold text-ink">One-Click Bypass</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Trust metrics row — verifiable figures only. */}
        <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm transition-all hover:shadow-md"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${stat.tint}`}>
                <stat.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-extrabold leading-none text-ink">{stat.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust-badge marquee — seamless CSS loop, hidden duplicate for a11y. */}
        <div className="marquee-mask mt-12 overflow-hidden">
          <div className="flex w-max animate-marquee items-center gap-3">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 items-center gap-3"
              >
                {MARQUEE_BADGES.map((badge) => (
                  <span
                    key={`${copy}-${badge}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur"
                  >
                    <Check className="h-3.5 w-3.5 text-brand-500" />
                    {badge}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
