// FRPB — dual-device showcase (iOS + Android) feature banner.
// Pairs the /iospic.png and /androidpic.png device renders around a central
// glass card with quick platform toggles and the primary gradient CTA.
//
// Client component: the only interactivity is graceful image-load fallback
// (renders a stylised phone mockup if a render asset is missing), so it owns
// a tiny amount of local state and no async work.

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  AtSign,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LayoutGrid,
  Lock,
  ScanFace,
  ShieldAlert,
  Smile,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface ShowcasePill {
  label: string;
  icon: LucideIcon;
}

const IOS_PILLS: readonly ShowcasePill[] = [
  { label: "Face ID", icon: ScanFace },
  { label: "Apple ID", icon: AtSign },
  { label: "iCloud Lock", icon: Lock },
];

const ANDROID_PILLS: readonly ShowcasePill[] = [
  { label: "Google FRP Lock", icon: ShieldAlert },
  { label: "Pattern Unlock", icon: LayoutGrid },
  { label: "Face Unlock", icon: Smile },
];

export interface DeviceShowcaseProps {
  /**
   * Resolved installer URL (from config/download.ts). Used by the secondary
   * "Get License Now" CTA so the showcase matches the hero's download target.
   */
  downloadUrl: string;
}

/** A single device render inside a responsive phone-shaped container. */
function DeviceRender({
  src,
  alt,
  label,
  badgeClassName,
  priority = false,
}: {
  src: string;
  alt: string;
  label: string;
  badgeClassName: string;
  /**
   * Next.js `priority` — preloads the render (adds a <link rel="preload"> and
   * skips native lazy loading) so the hero device frame paints with the LCP
   * instead of being fetched late and blocking the main thread once it lands.
   */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex w-full max-w-[220px] flex-col items-center">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-b from-slate-100 to-white shadow-card-hover ring-1 ring-black/5">
        {!failed ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 40vw, 220px"
            className="object-contain p-2"
            priority={priority}
            loading={priority ? undefined : "lazy"}
            onError={() => setFailed(true)}
          />
        ) : (
          /* Fallback mockup — keeps the layout intact if the asset is absent. */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-brand-50 to-accent-50 p-4 text-center">
            <Smartphone className="h-10 w-10 text-brand-400" />
            <span className="text-xs font-semibold text-slate-500">{label}</span>
          </div>
        )}
      </div>
      <span
        className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${badgeClassName}`}
      >
        {label}
      </span>
    </div>
  );
}

/** Vertical pill list flanking the centre card. */
function PillColumn({
  pills,
  align,
}: {
  pills: readonly ShowcasePill[];
  align: "left" | "right";
}) {
  return (
    <ul
      className={`flex flex-wrap justify-center gap-2.5 lg:flex-col lg:justify-start ${
        align === "left" ? "lg:items-end" : "lg:items-start"
      }`}
    >
      {pills.map(({ label, icon: Icon }) => (
        <li
          key={label}
          className={`flex w-full max-w-[230px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-ink hover:shadow-md ${
            align === "left" ? "lg:flex-row-reverse lg:text-right" : ""
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function DeviceShowcase({ downloadUrl }: DeviceShowcaseProps) {
  return (
    <section
      id="device-showcase"
      className="relative isolate overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-white"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate bg-grid-32 [mask-image:radial-gradient(60%_50%_at_50%_35%,black,transparent)]" />

      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        {/* Section heading */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge mb-4">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            One Toolkit · Every Device
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            All in One.{" "}
            <span className="text-gradient-brand">All Solutions in One Toolkit.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
            Manage your phone, bypass FRP, unlock locks, and recover your device.
          </p>
        </div>

        {/* Showcase grid: pills → centre card → pills */}
        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)]">
          <PillColumn pills={IOS_PILLS} align="left" />

          {/* Centre card */}
          <div className="glass-hero relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-card-hover sm:p-8">
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
              <DeviceRender
                src="/iospic.png"
                alt="iPhone running the FRPB iOS screen and Apple ID unlock flow"
                label="iOS"
                badgeClassName="bg-slate-900 text-white"
                priority
              />

              {/* Middle content block */}
              <div className="order-last flex flex-col items-center text-center lg:order-none">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow">
                  <KeyRound className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                  Screen & FRP Unlock
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                  Bypass Google FRP, remove screen locks and restore access to iPhone
                  and Android devices — no data loss, no guesswork.
                </p>

                {/* Quick platform toggles */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href="#features"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-ink"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Unlock iOS
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-ink"
                  >
                    Unlock Android
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Primary CTAs */}
                <div className="mt-6 flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
                  <Link
                    href="/pricing"
                    className="btn-accent btn-shine w-full justify-center sm:w-auto"
                  >
                    Try For Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={downloadUrl}
                    className="btn-ghost w-full justify-center sm:w-auto"
                  >
                    Get License Now
                  </Link>
                </div>
              </div>

              <DeviceRender
                src="/androidpic.png"
                alt="Android phone running the FRPB Google FRP and pattern unlock flow"
                label="Android"
                badgeClassName="bg-emerald-500 text-white"
                priority
              />
            </div>
          </div>

          <PillColumn pills={ANDROID_PILLS} align="right" />
        </div>
      </div>
    </section>
  );
}
