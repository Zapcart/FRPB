// FRPB — programmatic model × intent landing page (server component).
//
// Renders one device-model spoke, e.g. `/tools/samsung/galaxy-a12-frp-bypass`.
// It mirrors <BrandLandingPage> markup exactly (so the visual language and CTA
// behaviour stay identical) but adds:
//   1. A device spec strip (chipset / entry mode) for on-page uniqueness.
//   2. Topic-cluster internal links (sibling models, other brands, utilities).
//   3. A 4th JSON-LD block (`HowTo`) so the numbered procedure is eligible for
//      the HowTo rich result/carousel.
//
// Server component only — no client JS, so it stays out of the shared bundle.

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
import TopicCluster from "@/components/seo/topic-cluster";
import {
  EXE_NAME,
  GITHUB_RELEASES_TAG,
  RELEASE_VERSION,
  SMARTSCREEN_NOTICE,
  resolveInstallerUrl,
} from "@/config/download";
import { LEGAL_DISCLAIMER, SUPPORT_EMAIL, mailtoHref } from "@/config/legal";
import {
  breadcrumbSchema,
  faqPageSchema,
  howToSchema,
  softwareApplicationSchema,
} from "@/lib/schema";
import type { BrandIconKey, BrandPageContent } from "@/config/brand-pages";
import { INTENT_LABELS, type SeoIntent, type SeoModelRecord } from "@/data/seo-matrix";
import { relatedBrands, relatedModels, utilityLinks } from "@/data/seo-clusters";
import { modelBreadcrumbs, modelJsonLdContext } from "@/lib/seo-matrix";

/** Map a data-only icon key to its lucide component (JSX stays out of config). */
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

export interface ModelLandingPageProps {
  /** View model assembled by `buildModelContent()` (same shape as a brand page). */
  content: BrandPageContent;
  /** Underlying matrix record — powers the spec strip + internal-link selectors. */
  record: SeoModelRecord;
  /** The intent the current route targets (`frp-bypass` | `lock-removal`). */
  intent: SeoIntent;
}

export default function ModelLandingPage({ content, record, intent }: ModelLandingPageProps) {
  const href = resolveInstallerUrl();
  const breadcrumb = modelBreadcrumbs(record, intent);

  // Exact-match internal-link clusters (Hack 4/5/12).
  const siblingLinks = relatedModels(record, 6);
  const brandLinks = relatedBrands(record.brandSlug, 6);
  const utilityLinkSet = utilityLinks();

  const entryMode = record.manualMode
    ? `Manual — hold ${record.keyCombo ?? "the hardware combo"} to enter BROM/EDL`
    : "Automatic — Download / Recovery / Fastboot auto-detect";

  const specs: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Chipset", value: record.chipset, icon: Cpu },
    { label: "Entry mode", value: entryMode, icon: Terminal },
    {
      label: "Supported workflow",
      value: record.intents.map((i) => INTENT_LABELS[i]).join(" · "),
      icon: LockOpen,
    },
  ];

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
            <Link href="/tools" className="btn-ghost px-4 py-2 text-xs sm:text-sm">
              All Tools
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
        {/* Breadcrumb trail (Home › Tools › Brand › this model). */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumb.map((crumb, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-2">
                  {isLast ? (
                    <span className="font-medium text-slate-600">{crumb.name}</span>
                  ) : (
                    <Link href={crumb.path} className="transition hover:text-slate-700">
                      {crumb.name}
                    </Link>
                  )}
                  {!isLast ? <span aria-hidden="true">/</span> : null}
                </li>
              );
            })}
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

        {/* ================= DEVICE SPEC STRIP ================= */}
        <section
          aria-label={`${record.fullModelLabel} specifications`}
          className="mt-10 grid gap-3 sm:grid-cols-3"
        >
          {specs.map((spec) => {
            const Icon = spec.icon;
            return (
              <div key={spec.label} className="glass-surface flex items-start gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {spec.label}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink">{spec.value}</p>
                </div>
              </div>
            );
          })}
        </section>

        {/* ================= FEATURES ================= */}
        <section id="features" className="mt-12">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Why technicians choose FRPB for the {record.modelLabel}
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
            How to {intent === "frp-bypass" ? "bypass FRP" : "remove the lock"} on the{" "}
            {record.modelLabel}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            For authorised device owners and repair professionals only.
          </p>
          <ol className="mx-auto mt-8 max-w-3xl space-y-3">
            {content.steps.map((step, index) => (
              <li key={step.title} id={`step-${index + 1}`} className="glass-surface flex items-start gap-4 p-5">
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

        {/* ================= TOPIC CLUSTERS (internal linking) ================= */}
        <TopicCluster
          heading={`More ${record.brandLabel} FRP bypass guides`}
          intro={`Other ${record.brandLabel} models we cover with the same one-click ${record.chipset} workflow.`}
          links={siblingLinks}
          ariaLabel={`Related ${record.brandLabel} models`}
          columns={2}
          cta="Open guide"
        />
        <TopicCluster
          heading={`${record.brandLabel} FRP tool and other brands`}
          intro="Jump to the device family you need — every hub lists its full model matrix."
          links={brandLinks}
          ariaLabel="FRP tools for other brands"
          columns={2}
          cta="View brand hub"
        />
        <TopicCluster
          heading="More FRPB desktop utilities"
          intro="Round out a repair workflow with data erasing, phone transfer and location tools."
          links={utilityLinkSet}
          ariaLabel="Related FRPB utilities"
          columns={3}
          cta="Explore tool"
        />
      </main>

      {/* ================= FAQ (visible) ================= */}
      <FaqSection
        items={content.faq}
        id="faq"
        heading={`${record.modelLabel} FRP bypass — FAQ`}
        intro={`Everything technicians ask before running an FRP bypass on the ${record.fullModelLabel} with FRPB.`}
      />

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-glass-edge bg-glass-soft backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Legal disclaimer — small print, kept visually subtle. */}
          <p className="text-xs leading-relaxed text-slate-400">{LEGAL_DISCLAIMER}</p>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} FRPB. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <Link href="/" className="transition hover:text-slate-900">
                Home
              </Link>
              <Link href="/tools" className="transition hover:text-slate-900">
                All Tools
              </Link>
              <Link href="/downloads" className="transition hover:text-slate-900">
                Downloads
              </Link>
              <a href={mailtoHref(SUPPORT_EMAIL)} className="transition hover:text-slate-900">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ================= JSON-LD ================= */}
      <JsonLd id="ld-software-application" data={softwareApplicationSchema(modelJsonLdContext(record, intent))} />
      <JsonLd id="ld-faq" data={faqPageSchema(content.faq)} />
      <JsonLd id="ld-breadcrumb" data={breadcrumbSchema(breadcrumb)} />
      <JsonLd
        id="ld-howto"
        data={howToSchema({
          name: content.title,
          description: content.description,
          path: content.path,
          steps: content.steps.map((step) => `${step.title} — ${step.desc}`),
          estimatedTime: "PT6M",
          prerequisites: ["Windows 10/11 PC", "USB data cable", "FRPB Active License"],
        })}
      />
    </div>
  );
}
