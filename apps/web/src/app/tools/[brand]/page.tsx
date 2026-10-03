// FRPB — /tools/[brand] brand hub (programmatic SEO).
//
// One statically-generated page per OEM brand, listing every device spoke in
// that brand cluster with EXACT-MATCH anchors for both intents (Hack 4/5/12) and
// cross-linking to sibling brand hubs + the utility cluster. Emits
// SoftwareApplication + FAQPage + BreadcrumbList JSON-LD (Hack 7/14).
//
// Server component only (no client JS). `dynamicParams = false` caps the URL
// space to the curated matrix so unknown brands 404 at the edge.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Cpu, FileDown, ShieldCheck, Smartphone, Wrench } from "lucide-react";

import FaqSection from "@/components/faq-section";
import JsonLd from "@/components/seo/json-ld";
import TopicCluster from "@/components/seo/topic-cluster";
import { LEGAL_DISCLAIMER, SUPPORT_EMAIL, mailtoHref } from "@/config/legal";
import { INTENT_LABELS, SEO_BRAND_PARAMS } from "@/data/seo-matrix";
import {
  clusterForBrand,
  relatedBrands,
  utilityLinks,
  type BrandCluster,
} from "@/data/seo-clusters";
import type { FaqItem } from "@/lib/faq";
import { breadcrumbSchema, faqPageSchema, softwareApplicationSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

interface BrandHubPageProps {
  params: { brand: string };
}

/** Disallow on-demand params — only curated brand hubs may render. */
export const dynamicParams = false;

/** Statically generate one hub per brand cluster. */
export function generateStaticParams(): { brand: string }[] {
  return SEO_BRAND_PARAMS.map((param) => ({ brand: param.brand }));
}

export function generateMetadata({ params }: BrandHubPageProps): Metadata {
  const cluster = clusterForBrand(params.brand);
  if (!cluster) {
    return pageMetadata({
      title: "Brand not found",
      description: "This FRPB device brand hub does not exist. Browse all supported Android brands instead.",
      path: `/tools/${params.brand}`,
    });
  }

  return pageMetadata({
    title: `${cluster.brandLabel} FRP Tool 2026 — Model-by-Model Bypass Guide`,
    description: `${cluster.brandLabel} FRP tool for every model: one-click FRP bypass and screen lock removal over USB with FRPB. Browse ${cluster.models.length} ${cluster.brandLabel} device guides.`,
    path: cluster.hubPath,
    keywords: cluster.keywords,
  });
}

/** Brand-specific FAQ — direct-answer first sentence (Hack 14). */
function brandFaq(cluster: BrandCluster): FaqItem[] {
  const label = cluster.brandLabel;
  const count = cluster.models.length;
  const hardwareModels = cluster.models.filter((model) => model.manualMode).length;

  return [
    {
      question: `What is the ${label} FRP tool?`,
      answer: `The ${label} FRP tool is FRPB's one-click utility that removes the Factory Reset Protection lock on ${label} devices over USB. It works on the ${count} curated ${label} models in this hub, with no account credentials required.`,
    },
    {
      question: `Does FRPB bypass FRP on all ${label} models?`,
      answer: `FRPB covers ${count} ${label} models across both intents — FRP bypass and screen lock removal. ${hardwareModels > 0 ? `${hardwareModels} of them need a hardware key combination first, which the tool detects automatically.` : "All of them run in standard ADB mode with one click."}`,
    },
    {
      question: `Is the ${label} bypass safe and legal?`,
      answer: `Yes — FRPB only unlocks devices you own or are authorised to service. It makes no network calls during the bypass and leaves your data and firmware intact.`,
    },
    {
      question: `Which ${label} models are supported?`,
      answer: `The list below shows every supported ${label} model with a dedicated FRP bypass and lock removal guide, so you can jump straight to your exact handset.`,
    },
  ];
}

export default function BrandHubPage({ params }: BrandHubPageProps) {
  const cluster = clusterForBrand(params.brand);
  if (!cluster) notFound();

  const modelCount = cluster.models.length;
  const utilities = utilityLinks();
  const faq = brandFaq(cluster);
  const siblingBrands = relatedBrands(cluster.brandSlug, 8);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-slate-900">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:py-20">
        {/* ================= BREADCRUMB ================= */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-brand-600">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/tools" className="transition hover:text-brand-600">
                All Tools
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-slate-500" aria-current="page">
              {cluster.brandLabel}
            </li>
          </ol>
        </nav>

        {/* ================= HERO ================= */}
        <section>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Smartphone className="h-3.5 w-3.5" />
            {cluster.brandLabel} device tools
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {cluster.brandLabel}{" "}
            <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
              FRP Tool
            </span>
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-500 sm:text-lg">
            One-click FRP bypass and screen lock removal for every supported{" "}
            {cluster.brandLabel} model — over USB with FRPB. Pick your exact handset
            below for a device-specific guide and key combination.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-3.5 py-1.5 text-xs font-semibold text-slate-600">
              <Cpu className="h-3.5 w-3.5 text-brand-500" />
              {modelCount} {modelCount === 1 ? "model" : "models"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-3.5 py-1.5 text-xs font-semibold text-slate-600">
              <Wrench className="h-3.5 w-3.5 text-brand-500" />
              FRP bypass + lock removal
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-3.5 py-1.5 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
              No credentials required
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/downloads" className="btn-neon btn-shine px-5 py-2.5 text-sm">
              <FileDown className="h-4 w-4" />
              Download FRPB
            </Link>
            <Link href="/tools" className="btn-ghost px-5 py-2.5 text-sm">
              Browse all brands
            </Link>
          </div>
        </section>

        {/* ================= MODEL SPOKES ================= */}
        <section id="models" className="mt-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            All {cluster.brandLabel} FRP bypass & lock removal guides
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            Every supported {cluster.brandLabel} handset, with exact-match guides for both
            unlocking intents.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cluster.models.map((model) => (
              <article key={model.paths["frp-bypass"]} className="glass-surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-ink">{model.fullModelLabel}</h3>
                  <span className="shrink-0 rounded-full border border-glass-edge bg-glass-soft px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                    {model.chipset}
                  </span>
                </div>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">
                  {model.manualMode
                    ? `Requires a hardware mode first${model.keyCombo ? ` (${model.keyCombo})` : ""} — FRPB detects it automatically.`
                    : `One-click FRP bypass and lock removal over USB with FRPB.`}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {model.intents.map((intent) => (
                    <Link
                      key={intent}
                      href={model.paths[intent]}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
                    >
                      {INTENT_LABELS[intent]}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ================= CROSS-LINKS ================= */}
        <TopicCluster
          heading={`Other Android brands FRPB supports`}
          intro="Working with a different OEM? Jump straight to the brand hub you need."
          links={siblingBrands}
          columns={3}
          cta="Open brand hub"
        />

        <TopicCluster
          heading="Free device utility tools"
          intro="Location spoofing, data erasing, phone transfer and WhatsApp transfer — all included."
          links={utilities}
          columns={2}
          cta="Open tool"
        />
      </main>

      {/* ================= FAQ ================= */}
      <FaqSection
        items={faq}
        id="faq"
        heading={`${cluster.brandLabel} FRP tool FAQ`}
        intro={`What technicians ask before running an FRP bypass on a ${cluster.brandLabel} device with FRPB.`}
      />

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-glass-edge bg-glass-soft backdrop-blur">
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
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ================= STRUCTURED DATA ================= */}
      <JsonLd
        id="ld-software-application"
        data={softwareApplicationSchema({
          path: cluster.hubPath,
          name: `${cluster.brandLabel} FRP Tool — FRPB Device Module`,
          description: `FRPB ${cluster.brandLabel} FRP tool: one-click FRP bypass and screen lock removal for ${modelCount} ${cluster.brandLabel} models over USB.`,
        })}
      />
      <JsonLd id="ld-faq" data={faqPageSchema(faq)} />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "All Tools", path: "/tools" },
          { name: cluster.brandLabel, path: cluster.hubPath },
        ])}
      />
    </div>
  );
}
