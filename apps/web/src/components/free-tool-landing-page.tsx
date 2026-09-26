// FRPB — shared programmatic free-tool landing page (server component).
//
// Renders one free-utility landing page from a typed `FreeToolMeta` entry
// (defined once in @frpb/shared). Mirrors `brand-landing-page.tsx` so the four
// utility routes differ only by their data, keeping markup, JSON-LD wiring and
// CTA behaviour identical across every page.

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eraser,
  FileDown,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import FaqSection from "@/components/faq-section";
import JsonLd from "@/components/seo/json-ld";
import {
  EXE_NAME,
  RELEASE_VERSION,
  SMARTSCREEN_NOTICE,
  resolveInstallerUrl,
} from "@/config/download";
import { LEGAL_DISCLAIMER, SUPPORT_EMAIL, mailtoHref } from "@/config/legal";
import {
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
  howToSchema,
} from "@/lib/schema";
import {
  FREE_TOOLS,
  FREE_TOOL_IDS,
  type FreeToolIconKey,
  type FreeToolMeta,
} from "@frpb/shared";

/**
 * Resolve a data-only icon key to its lucide component. Keeps the shared
 * `free-tools.ts` config free of JSX so it can be imported by the sitemap.
 */
const ICONS: Record<FreeToolIconKey, LucideIcon> = {
  MessageCircle,
  Smartphone,
  Eraser,
  MapPin,
  ShieldCheck,
  Zap,
  Wifi,
  Lock,
  Download,
  CheckCircle2,
  Sparkles,
  RefreshCw,
};

/**
 * Split a "Lead — Highlight" title into its two display halves. Falls back to
 * the whole title as the lead when no separator is present.
 */
function splitHeading(title: string): { lead: string; highlight: string } {
  const separator = "—";
  const index = title.indexOf(separator);
  if (index === -1) return { lead: title, highlight: "" };
  return {
    lead: title.slice(0, index).trim(),
    highlight: title.slice(index + separator.length).trim(),
  };
}

export default function FreeToolLandingPage({ content }: { content: FreeToolMeta }) {
  const href = resolveInstallerUrl();
  const { lead, highlight } = splitHeading(content.title);

  // Other free utilities — internal links aid crawl depth and time-on-site.
  const relatedTools = FREE_TOOL_IDS.filter((id) => id !== content.id).map(
    (id) => FREE_TOOLS[id],
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
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

        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-4 py-1.5 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              Pro Utility · {content.eyebrow}
            </div>

            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {lead}{" "}
              {highlight ? (
                <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
                  {highlight}
                </span>
              ) : null}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              {content.tagline}
            </p>

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
              {EXE_NAME} · Windows 10/11 · Included with an FRPB Active License — full module
              execution requires an active license key.
            </p>

            <div className="mt-5 flex w-full max-w-md items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-slate-500">{SMARTSCREEN_NOTICE}</p>
            </div>
          </div>
        </div>

        {/* ================= FEATURES ================= */}
        <section id="features" className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Everything the {content.eyebrow} tool does
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            {content.description}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {content.features.map((feature) => {
              const Icon = ICONS[feature.icon];
              return (
                <div key={feature.title} className="card p-6">
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= STEP-BY-STEP ================= */}
        <section id="steps" className="mt-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            How to use the {content.eyebrow}
          </h2>
          <ol className="mx-auto mt-8 max-w-3xl space-y-3">
            {content.steps.map((step, index) => (
              <li
                key={step.title}
                id={`step-${index + 1}`}
                className="card flex items-start gap-4 p-5"
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
          <span className="badge">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" />
            License included
          </span>
          <span className="badge">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
            100% offline
          </span>
          <span className="badge">No root required</span>
          <span className="badge">Windows 10 / 11 · x64</span>
        </section>

        {/* ================= RELATED DESKTOP UTILITIES ================= */}
        <section className="mt-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            More FRPB desktop utilities
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {relatedTools.map((tool) => {
              const Icon = ICONS[tool.features[0]?.icon ?? "Sparkles"];
              return (
                <Link
                  key={tool.id}
                  href={tool.path}
                  className="card group flex flex-col p-6 transition hover:border-brand-200 hover:shadow-lg"
                >
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{tool.eyebrow}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">
                    {tool.tagline}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                    Explore Tool
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* ================= FAQ (visible) ================= */}
      <FaqSection
        items={content.faq}
        id="faq"
        heading="Frequently asked questions"
        intro={`Everything users ask before running the FRPB ${content.eyebrow} tool — an active FRPB license key is required to execute the module.`}
      />

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <p className="text-xs leading-relaxed text-slate-400">{LEGAL_DISCLAIMER}</p>
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
              <a href={mailtoHref(SUPPORT_EMAIL)} className="transition hover:text-slate-900">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ================= JSON-LD ================= */}
      <JsonLd id="ld-software-application" data={softwareApplicationSchema()} />
      <JsonLd id="ld-faq" data={faqPageSchema(content.faq)} />
      <JsonLd
        id="ld-howto"
        data={howToSchema({
          name: `How to use the ${content.eyebrow} (${content.target})`,
          description: content.tagline,
          path: content.path,
          steps: content.steps.map((step) => `${step.title}: ${step.desc}`),
        })}
      />
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
