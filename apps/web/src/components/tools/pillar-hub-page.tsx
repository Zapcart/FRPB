// FRPB — reusable pillar hub (Hub & Spoke) landing page (server component).
//
// Renders one commercial pillar hub from a typed `PillarHubContent`
// (`@/data/pillar-hubs`) plus an ordered list of link sections (the cluster's
// spokes). Every hub emits SoftwareApplication + FAQPage + HowTo +
// BreadcrumbList JSON-LD and a prominent "Proof of Ownership" trust notice
// (E-E-A-T). Server-only: no client JS, no state.

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Cpu,
  Download,
  FileDown,
  Info,
  KeyRound,
  LockOpen,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Usb,
  Zap,
  type LucideIcon,
} from "lucide-react";
import FaqSection from "@/components/faq-section";
import JsonLd from "@/components/seo/json-ld";
import TopicCluster from "@/components/seo/topic-cluster";
import {
  EXE_NAME,
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
import type { PillarHubContent } from "@/data/pillar-hubs";
import type { SeoLink } from "@/data/seo-clusters";

/** One linked cluster section (a set of spokes under the pillar). */
export interface PillarSection {
  id?: string;
  heading: string;
  intro?: string;
  links: readonly SeoLink[];
  columns?: 2 | 3;
  cta?: string;
}

const ICONS: Record<string, LucideIcon> = {
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Usb,
  LockOpen,
  Cpu,
  Zap,
  KeyRound,
  Download,
};

function resolveIcon(key: string | undefined): LucideIcon {
  return (key ? ICONS[key] : undefined) ?? Sparkles;
}

export default function PillarHubPage({
  content,
  sections,
}: {
  content: PillarHubContent;
  sections: readonly PillarSection[];
}) {
  const href = resolveInstallerUrl();
  const visibleSections = sections.filter((section) => section.links.length > 0);

  // Breadcrumb: Home → All Tools → this pillar hub.
  const breadcrumb = [
    { name: "Home", path: "/" },
    { name: "All Tools", path: "/tools" },
    { name: content.eyebrow, path: content.path },
  ];

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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:py-20">
        {/* ================= BREADCRUMB ================= */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-slate-700">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/tools" className="transition hover:text-slate-700">
                All Tools
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-600">{content.eyebrow}</li>
          </ol>
        </nav>

        {/* ================= HERO ================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-4 py-1.5 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" />
              {content.eyebrow}
            </div>

            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {content.headingLead}{" "}
              {content.headingHighlight ? (
                <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
                  {content.headingHighlight}
                </span>
              ) : null}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              {content.subheading}
            </p>

            <div className="mt-9 flex w-full max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={href}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent w-full px-8 py-4 text-base shadow-blue-glow sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download Software (v{RELEASE_VERSION})
              </a>
              <Link href="/pricing" className="btn-ghost w-full px-8 py-4 text-base sm:w-auto">
                View Pricing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {EXE_NAME} · Windows 10/11 · Included with an FRPB Active License — full module
              execution requires an active license key.
            </p>

            <a
              href={href}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 underline-offset-4 transition hover:underline"
            >
              Download the official installer ({EXE_NAME})
            </a>

            <div className="mt-5 flex w-full max-w-md items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-slate-500">{SMARTSCREEN_NOTICE}</p>
            </div>
          </div>
        </section>

        {/* ================= OWNERSHIP / E-E-A-T NOTICE ================= */}
        <section
          aria-label="Proof of ownership and authorization"
          className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <h2 className="text-sm font-bold text-ink">{content.notice.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{content.notice.body}</p>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section id="features" className="mt-14">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            What this hub covers
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            {content.description}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {content.features.map((feature) => {
              const Icon = resolveIcon(feature.icon);
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
            Step-by-step: {content.eyebrow}
          </h2>
          <ol className="mx-auto mt-8 max-w-3xl space-y-3">
            {content.steps.map((step, index) => (
              <li key={step.title} id={`step-${index + 1}`} className="card flex items-start gap-4 p-5">
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

        {/* ================= CLUSTER SECTIONS (spokes) ================= */}
        {visibleSections.map((section, index) => (
          <TopicCluster
            key={section.id ?? section.heading}
            id={section.id}
            heading={section.heading}
            intro={section.intro}
            links={section.links}
            columns={section.columns ?? 3}
            cta={section.cta ?? "Open guide"}
            ariaLabel={section.heading}
          />
        ))}

        {/* ================= TRUST / SECURITY STRIP ================= */}
        <section className="mt-14 flex flex-wrap items-center justify-center gap-2.5">
          <span className="badge">
            <BadgeCheck className="h-3.5 w-3.5 text-brand-500" />
            SHA-256 verified release
          </span>
          <span className="badge">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
            Clean release · no adware
          </span>
          <span className="badge">
            <RefreshCw className="h-3.5 w-3.5 text-brand-500" />
            Updated for 2026
          </span>
          <span className="badge">Windows 10 / 11 · x64</span>
        </section>
      </main>

      {/* ================= FAQ (visible) ================= */}
      <FaqSection
        items={content.faq}
        id="faq"
        heading={`${content.eyebrow} FAQ`}
        intro={`What owners and technicians ask before using ${content.eyebrow.toLowerCase()} on a device they own.`}
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
        id="ld-howto"
        data={howToSchema({
          name: content.title.replace(/\s*—.*$/, "").trim(),
          description: content.description,
          path: content.path,
          steps: content.steps.map((step) => `${step.title}: ${step.desc}`),
          estimatedTime: "PT10M",
          prerequisites: ["Windows 10/11 PC", "USB data cable"],
        })}
      />
      <JsonLd id="ld-breadcrumb" data={breadcrumbSchema(breadcrumb)} />
    </div>
  );
}
