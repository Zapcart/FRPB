// FRPB — dual-device showcase (iOS + Android) feature banner.
//
// Client component: hosts an interactive iOS/Android segment toggle that swaps
// the visible device frame and platform feature chips. Mirrors the
// high-converting Dr.Fone showcase layout — a rounded segment switcher above a
// sleek card that presents the active platform's frame alongside a centered
// feature highlight with the primary unlock CTA.
//
// Responsive contract:
//   • Mobile (< 768px): only the frame for `activeTab` is shown, keeping the
//     viewport compact and clean.
//   • Desktop (>= 768px): iOS frame | centered feature card | Android frame,
//     side-by-side exactly like Dr.Fone's desktop layout.

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  AtSign,
  KeyRound,
  LayoutGrid,
  Lock,
  ScanFace,
  ShieldAlert,
  Smile,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import SmoothScrollLink from "./smooth-scroll-link";

type PlatformTab = "ios" | "android";

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

const PILLS_BY_TAB: Record<PlatformTab, readonly ShowcasePill[]> = {
  ios: IOS_PILLS,
  android: ANDROID_PILLS,
};

export interface DeviceShowcaseProps {
  /**
   * Resolved installer URL (from config/download.ts). Used by the secondary
   * "Get License Now" CTA so the showcase matches the hero's download target.
   */
  downloadUrl: string;
}

/**
 * A single device render inside a fixed-ratio phone-shaped frame.
 *
 * Both platforms share the exact same container size and `aspect-[9/19]`
 * ratio, so the two mockups read as perfectly balanced columns on desktop and
 * as a compact, evenly-sized single frame on mobile.
 */
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
  priority?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col items-center">
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2rem] border border-gray-100 bg-gradient-to-b from-slate-100 to-white shadow-xl md:aspect-[9/19] dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        {/* `text-transparent` keeps a broken-alt render invisible so the
            gradient frame degrades gracefully if an asset is ever missing. */}
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 60vw, 220px"
          className="object-contain p-2 text-transparent"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      </div>
      <span
        className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${badgeClassName}`}
      >
        {label}
      </span>
    </div>
  );
}

export default function DeviceShowcase({ downloadUrl }: DeviceShowcaseProps) {
  const [activeTab, setActiveTab] = useState<PlatformTab>("ios");
  const activePills = PILLS_BY_TAB[activeTab];

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
            <span className="text-gradient-brand">
              All Solutions in One Toolkit.
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-500 sm:text-lg">
            Manage your phone, bypass FRP, unlock locks, and recover your device.
          </p>
        </div>

        {/* Showcase card — sleek, dark-mode compatible container. */}
        <div className="mx-auto mt-12 max-w-5xl rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
          {/* Segment toggle: [ iOS ] [ Android ] */}
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Choose device platform"
              className="inline-flex rounded-full border border-gray-100 bg-gray-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "ios"}
                aria-pressed={activeTab === "ios"}
                onClick={() => setActiveTab("ios")}
                className={`cursor-pointer touch-manipulation rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === "ios"
                    ? "bg-[#0066FF] text-white shadow"
                    : "text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                iOS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "android"}
                aria-pressed={activeTab === "android"}
                onClick={() => setActiveTab("android")}
                className={`cursor-pointer touch-manipulation rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === "android"
                    ? "bg-[#0066FF] text-white shadow"
                    : "text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                Android
              </button>
            </div>
          </div>

          {/* Active-platform feature chips */}
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {activePills.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          {/* Frame grid. Mobile: only the active frame + feature. Desktop:
              iOS | feature | Android side-by-side. */}
          <div className="mt-10 grid grid-cols-1 items-center gap-8 px-4 md:grid-cols-[1fr_auto_1fr] md:px-0">
            {/* iOS frame — flex-centred on mobile, hidden unless active. */}
            <div
              className={`${
                activeTab === "ios" ? "flex" : "hidden"
              } order-1 w-full justify-center md:order-none md:col-start-1 md:row-start-1 md:flex`}
            >
              <DeviceRender
                src="/iospic.png"
                alt="iPhone running the FRPB iOS screen and Apple ID unlock flow"
                label="iOS"
                badgeClassName="bg-slate-900 text-white"
                priority
              />
            </div>

            {/* Centered feature highlight */}
            <div className="order-2 flex flex-col items-center text-center md:order-none md:col-start-2 md:row-start-1">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-400/30" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#00A3FF] text-white shadow-glow transition-transform duration-300 hover:scale-105">
                  <KeyRound className="h-8 w-8 motion-safe:animate-pulse" />
                </div>
              </div>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                Screen & FRP Unlock
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                Remove all types of lock screens and Google FRP bypass instantly
                across multiple devices.
              </p>

              {/* Primary CTAs */}
              <div className="mt-6 flex w-full flex-col items-center justify-center gap-2.5 sm:flex-row">
                <SmoothScrollLink
                  targetId="pricing"
                  ariaLabel="Unlock your phone now — see pricing"
                  className="btn-accent btn-shine w-full justify-center sm:w-auto"
                >
                  Unlock Your Phone Now
                  <ArrowRight className="h-4 w-4" />
                </SmoothScrollLink>
                <a
                  href={downloadUrl}
                  className="btn-ghost w-full justify-center sm:w-auto"
                >
                  Get License Now
                </a>
              </div>
            </div>

            {/* Android frame — hidden on mobile unless active. */}
            <div
              className={`${
                activeTab === "android" ? "flex" : "hidden"
              } order-1 w-full justify-center md:order-none md:col-start-3 md:row-start-1 md:flex`}
            >
              <DeviceRender
                src="/androidpic.png"
                alt="Android phone running the FRPB Google FRP and pattern unlock flow"
                label="Android"
                badgeClassName="bg-emerald-500 text-white"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
