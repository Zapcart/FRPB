// FRPB — shared iOS (iPhone & iPad) learn-hub landing page (server component).
//
// Renders the `/ios` hub and every `/ios/[topic]` spoke from a typed
// `IosPageContent` record. This is deliberately an HONEST owner-guide surface:
// FRPB is an Android FRP toolkit, so these pages never claim iOS bypass
// capability. They explain Apple's official removal paths and link to the
// authoritative FRPB blog guides for the full procedure.
//
// Keeping the view here means the hub and its spokes differ only by their
// content record, so the markup and JSON-LD wiring stay identical.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  FileDown,
  Info,
  KeyRound,
  Smartphone,
  Sparkles,
  Terminal,
  Usb,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import FaqSection from "@/components/faq-section";
import JsonLd from "@/components/seo/json-ld";
import TopicCluster from "@/components/seo/topic-cluster";
import { RELEASE_VERSION, resolveInstallerUrl } from "@/config/download";
import { LEGAL_DISCLAIMER, SUPPORT_EMAIL, mailtoHref } from "@/config/legal";
import type { BrandIconKey } from "@/config/brand-pages";
import type { SeoLink } from "@/data/seo-clusters";
import {
  IOS_ACCURACY_NOTICE,
  type IosPageContent,
} from "@/data/ios-content";
import { getPost } from "@/lib/blog";
import { faqPageSchema, breadcrumbSchema, howToSchema } from "@/lib/schema";

/** Resolve a data-only icon key to its lucide component. */
const ICONS: Record<BrandIconKey, LucideIcon> = {
  Smartphone,
  ShieldCheck: Sparkles,
  KeyRound,
  Zap: Sparkles,
  Cpu,
  Usb,
  Terminal,
  Wrench,
  MonitorDown: FileDown,
  CheckCircle2,
  Sparkles,
  LockOpen: KeyRound,
};

export interface IosLandingPageProps {
  content: IosPageContent;
  /** Internal links rendered in the exact-match topic cluster. */
  relatedLinks: readonly SeoLink[];
  /** Blog guide slugs (relative to `/blog/`) that support this page. */
  guideSlugs?: readonly string[];
}

export default function IosLandingPage({
  content,
  relatedLinks,
  guideSlugs = [],
}: IosLandingPageProps) {
  const downloadHref = resolveInstallerUrl();
  const guides = guideSlugs
    .map((slug) => getPost(slug))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));

  const stepTexts = content.steps.map((step) => `${step.title}: ${step.desc}`);

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
            <Link href="/ios" className="btn-ghost px-4 py-2 text-xs sm:text-sm">
              iOS guides
            </Link>
            <Link href="/blog?category=iphone" className="btn-accent hidden px-4 py-2 text-xs sm:inline-flex md:text-sm">
              <ArrowUpRight className="h-4 w-4" />
              Guides
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
              <Link href="/ios" className="transition hover:text-slate-700">
                iOS
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-600">{content.eyebrow}</li>
          </ol>
        </nav>

        {/* ================= HERO ================= */}
        <section className="glass-panel-strong relative overflow-hidden rounded-3xl">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-glow" />
          <div className="flex flex-col items-center px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-glass-edge/70 bg-glass-soft px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-glass-light backdrop-blur">
              <Smartphone className="h-3.5 w-3.5" />
              {content.eyebrow}
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-ink sm:text-5xl">
              {content.headingLead}{" "}
              <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">
                {content.headingHighlight}
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-500">
              {content.subheading}
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link href="/blog?category=iphone" className="btn-accent px-6 py-3 text-sm font-semibold">
                <ArrowUpRight className="h-4 w-4" />
                Read iPhone & iPad guides
              </Link>
              <Link href="/ios" className="btn-ghost px-6 py-3 text-sm font-semibold">
                All iOS topics
              </Link>
            </div>

            {/* Accuracy notice — the honest differentiator. */}
            <div className="mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">{IOS_ACCURACY_NOTICE}</p>
            </div>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section aria-label="What this guide covers" className="mt-14">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.features.map((feature) => {
              const Icon = ICONS[feature.icon] ?? Sparkles;
              return (
                <div key={feature.title} className="glass-surface flex flex-col p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 text-sm font-bold text-ink">{feature.title}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= STEPS ================= */}
        <section aria-label="Owner removal steps" className="mt-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            The legitimate owner path
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">
            Work through these steps in order. Stop at any point if the device is not yours.
          </p>
          <ol className="mt-8 space-y-4">
            {content.steps.map((step, index) => (
              <li
                key={step.title}
                id={`step-${index + 1}`}
                className="glass-surface flex items-start gap-4 p-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-black text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ================= GUIDES ================= */}
        {guides.length > 0 ? (
          <TopicCluster
            heading="Full iPhone & iPad removal guides"
            intro="Step-by-step walkthroughs on the FRPB blog, written for device owners."
            links={guides.map((post) => ({
              path: `/blog/${post.slug}`,
              anchor: post.title,
              blurb: post.excerpt,
            }))}
            ariaLabel="Related iOS blog guides"
            columns={2}
            cta="Read guide"
          />
        ) : null}

        {/* ================= RELATED iOS TOPICS ================= */}
        {relatedLinks.length > 0 ? (
          <TopicCluster
            heading="More iOS topics"
            intro="Other iPhone and iPad Activation Lock & iCloud removal guides."
            links={relatedLinks}
            ariaLabel="Related iOS topics"
            columns={3}
            cta="Open topic"
          />
        ) : null}
      </main>

      {/* ================= ANDROID CROSS-SELL ================= */}
      <section className="border-t border-slate-200/80 bg-slate-50/60">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-brand-200 bg-white text-brand-600 shadow-sm">
            <FileDown className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            Working on an Android device instead?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            FRPB is a Windows toolkit for Android Factory Reset Protection — Samsung, Xiaomi,
            Vivo, Oppo and more. It has no iOS capability, but it is the right tool for FRP locks.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={downloadHref} className="btn-accent px-6 py-3 text-sm font-semibold">
              <FileDown className="h-4 w-4" />
              Download FRPB (v{RELEASE_VERSION})
            </a>
            <Link href="/tools" className="btn-ghost px-6 py-3 text-sm font-semibold">
              Browse Android tools
            </Link>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-[11px] leading-relaxed text-slate-400">
            {LEGAL_DISCLAIMER} Questions?{" "}
            <a href={mailtoHref(SUPPORT_EMAIL)} className="font-semibold text-brand-600">
              Contact support
            </a>
            .
          </p>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <FaqSection
        items={content.faq}
        heading="iOS Activation Lock FAQ"
        intro="Straight answers about iCloud and Activation Lock removal on iPhone and iPad."
      />

      {/* ================= JSON-LD ================= */}
      <JsonLd
        id="ios-faq"
        data={faqPageSchema(content.faq.map((item) => ({ question: item.question, answer: item.answer })))}
      />
      <JsonLd
        id="ios-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "iOS Guides", path: "/ios" },
          { name: content.eyebrow, path: content.path },
        ])}
      />
      <JsonLd
        id="ios-howto"
        data={howToSchema({
          name: `${content.headingLead} ${content.headingHighlight}`.trim(),
          description: content.subheading,
          path: content.path,
          steps: stepTexts,
          prerequisites: ["The device you own", "The Apple ID on the device or proof of purchase"],
        })}
      />

      {/* Local icon usage keeps the import surface explicit. */}
      <span aria-hidden className="hidden">
        <CheckCircle2 className="h-0 w-0" />
        <Info className="h-0 w-0" />
        <Terminal className="h-0 w-0" />
        <Usb className="h-0 w-0" />
        <Wrench className="h-0 w-0" />
        <Cpu className="h-0 w-0" />
        <ArrowRight className="h-0 w-0" />
      </span>
    </div>
  );
}
