// FRPB — shared programmatic brand landing page (server component).
//
// Renders one device/chipset-specific landing page from a typed
// `BrandPageContent` entry. Keeping the view here means the four brand routes
// differ only by their content config, so the markup, JSON-LD wiring and CTA
// behaviour stay identical (and maintainable) across every page.

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Download,
  FileDown,
  Info,
  KeyRound,
  LockOpen,
  MonitorDown,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Usb,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import FaqSection from "@/components/faq-section";
import JsonLd from "@/components/seo/json-ld";
import {
  EXE_NAME,
  GITHUB_RELEASES_TAG,
  RELEASE_VERSION,
  SMARTSCREEN_NOTICE,
  resolveInstallerUrl,
} from "@/config/download";
import { LEGAL_DISCLAIMER, SUPPORT_EMAIL, mailtoHref } from "@/config/legal";
import {
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from "@/lib/schema";
import {
  BRAND_MONEY_LINKS,
  type BrandIconKey,
  type BrandPageContent,
} from "@/config/brand-pages";

/**
 * Resolve a data-only icon key to its lucide component. Keeps
 * `brand-pages.ts` free of JSX so it can be imported by the sitemap (server,
 * no React) without pulling in the icon runtime.
 */
const ICONS: Record<BrandIconKey, LucideIcon> = {
  Smartphone,
  ShieldCheck,
  KeyRound,
  Zap,
  Cpu,
  Usb,
  Terminal,
  Wrench,
  MonitorDown,
  CheckCircle2,
  Sparkles,
  LockOpen,
};

export default function BrandLandingPage({ content }: { content: BrandPageContent }) {
  const href = resolveInstallerUrl();

  // Cross-link the other brand money-pages with keyword-rich anchors so crawl
  // equity and intent flow between the device-family guides.
  const relatedGuides = BRAND_MONEY_LINKS.filter((guide) => guide.path !== content.path);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-900">
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-canvas-mesh" />
      {/* ================= NAVBAR ================= */}
      <header className="glass-nav sticky top-0 z-50">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white shadow-lg shadow-brand-500/30">
              F
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="btn-ghost px-4 py-2 text-xs sm:text-sm">
              Pricing
            </Link>
            <Link href="/downloads" className="btn-accent hidden px-4 py-2 text-xs sm:inline-flex md:text-sm">
              <FileDown className="h-4 w-4" />
              Download
            </Link>
          </div>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:py-20">
        {/* Breadcrumb trail for the rich result (Home › this guide). */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-slate-700">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-600">{content.eyebrow}</li>
          </ol>
        </nav>

        <div className="glass-panel-strong relative overflow-hidden rounded-3xl">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-glass-edge/70 bg-glass-soft px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-glass-light backdrop-blur">
              <LockOpen className="h-3.5 w-3.5" />
              {content.eyebrow}
            </div>

            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {content.headingLead}{" "}
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
                {content.headingHighlight}
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              {content.subheading}
            </p>

            {/* Primary CTA — links straight to the .exe on GitHub Releases. */}
            <a
              href={href}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent mt-9 w-full max-w-md px-8 py-4 text-base shadow-blue-glow sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Download Software (v{RELEASE_VERSION})
            </a>

            <p className="mt-4 text-xs text-slate-400">
              {EXE_NAME} · Windows 10/11 · Included with an FRPB Active License
            </p>

            {/* Canonical "official release" link → GitHub Release page. */}
            <a
              href={GITHUB_RELEASES_TAG}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 underline-offset-4 transition hover:underline"
            >
              View the official release (v{RELEASE_VERSION}) on GitHub
            </a>

            {/* Browser / Windows SmartScreen first-launch guidance. */}
            <div className="mt-5 flex w-full max-w-md items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-slate-500">{SMARTSCREEN_NOTICE}</p>
            </div>
          </div>
        </div>

        {/* ================= FEATURES ================= */}
        <section id="features" className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Why technicians choose FRPB for this device
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {content.features.map((feature) => {
              const Icon = ICONS[feature.icon];
              return (
                <div
                  key={feature.title}
                  className="glass-surface p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/80 hover:shadow-glass-light-hover"
                >
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= STEP-BY-STEP PROCEDURE ================= */}
        <section id="steps" className="mt-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            How to run the bypass
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            For authorised device owners and repair professionals only.
          </p>
          <ol className="mx-auto mt-8 max-w-3xl space-y-3">
            {content.steps.map((step, index) => (
              <li
                key={step.title}
                id={`step-${index + 1}`}
                className="glass-surface flex items-start gap-4 p-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
          <span className="badge border-glass-edge/70 bg-glass-soft shadow-glass-light backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Version {RELEASE_VERSION}
          </span>
          <span className="badge border-glass-edge/70 bg-glass-soft shadow-glass-light backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
            Signed installer
          </span>
          <span className="badge border-glass-edge/70 bg-glass-soft shadow-glass-light backdrop-blur">
            Windows 10 / 11 · x64
          </span>
        </section>

        {/* ================= RELATED DEVICE GUIDES (internal linking) ================= */}
        <section className="mt-14" aria-label="Related device guides">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Related FRP bypass guides
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            Working with a different chipset? Jump straight to the device family you need.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedGuides.map((guide) => (
              <Link
                key={guide.path}
                href={guide.path}
                className="glass-surface group flex flex-col p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/80 hover:shadow-glass-light-hover"
              >
                <h3 className="text-sm font-bold text-ink">{guide.anchor}</h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">
                  {guide.blurb}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                  Open guide
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* ================= FAQ (visible) ================= */}
      <FaqSection
        items={content.faq}
        id="faq"
        heading="Frequently asked questions"
        intro={`Everything technicians ask before running an FRP bypass on this device family with FRPB.`}
      />

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-glass-edge bg-glass-soft backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Legal disclaimer — small print, kept visually subtle. */}
          <p className="text-xs leading-relaxed text-slate-400">
            {LEGAL_DISCLAIMER}
          </p>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} FRPB. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <Link href="/" className="transition hover:text-slate-900">
                Home
              </Link>
              <Link href="/downloads" className="transition hover:text-slate-900">
                Downloads
              </Link>
              <Link href="/pricing" className="transition hover:text-slate-900">
                Pricing
              </Link>
              <a
                href={mailtoHref(SUPPORT_EMAIL)}
                className="transition hover:text-slate-900"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ================= JSON-LD ================= */}
      <JsonLd
        id="ld-software-application"
        data={softwareApplicationSchema({
          path: content.path,
          name: `FRPB — ${content.eyebrow}`,
          description: content.description,
        })}
      />
      <JsonLd id="ld-faq" data={faqPageSchema(content.faq)} />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: content.eyebrow, path: content.path },
        ])}
      />
    </div>
  );
}
