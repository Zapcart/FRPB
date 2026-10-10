// FRPB — /tools programmatic SEO directory (server component).
//
// The entry point of the tools topic cluster: one indexable hub linking to
// every brand hub (`/tools/[brand]`) and every utility tool, using EXACT-MATCH
// anchors. Renders zero client JS and drives crawl depth down to a single hop
// for every spoke in the matrix.

import Link from "next/link";
import {
  Apple,
  ArrowRight,
  Cpu,
  FileDown,
  Grid3x3,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
} from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/schema";
import JsonLd from "@/components/seo/json-ld";
import {
  CLUSTER_MODEL_COUNT,
  iosLinks,
  utilityLinks,
} from "@/data/seo-clusters";
import { SEO_BRANDS, SEO_SPOKE_COUNT } from "@/data/seo-matrix";

export const metadata = pageMetadata({
  title: "All FRP Tools — Samsung, Xiaomi, Vivo & More | FRPB",
  description:
    "Browse every FRPB device tool: Samsung FRP tool, Xiaomi lock removal, Vivo, Oppo, Realme and more, plus Virtual Location, Data Eraser, Phone Transfer and WhatsApp Transfer.",
  path: "/tools",
  keywords: [
    "frp tool",
    "frp bypass tool",
    "samsung frp tool",
    "xiaomi unlock tool",
    "vivo frp bypass",
    "android lock removal tool",
  ],
});

/** Brand hub → internal link with an exact-match anchor. */
function brandAnchor(brandLabel: string): string {
  return `${brandLabel} FRP tool`;
}

export default function ToolsIndexPage() {
  const utilities = utilityLinks();
  const ios = iosLinks();

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
            <Link href="/downloads" className="btn-ghost px-4 py-2 text-xs sm:text-sm">
              Downloads
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
            <li className="font-semibold text-slate-500" aria-current="page">
              All Tools
            </li>
          </ol>
        </nav>

        {/* ================= HERO ================= */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-4 py-1.5 text-xs font-semibold text-brand-700">
          <Grid3x3 className="h-3.5 w-3.5" />
          {CLUSTER_MODEL_COUNT} models · {SEO_SPOKE_COUNT} device guides
        </div>

        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          All FRP & Device{" "}
          <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 bg-clip-text text-transparent">
            Unlock Tools
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
          FRPB bypasses FRP and removes screen locks on Samsung, Xiaomi, Vivo, Oppo,
          Realme, OnePlus and more. Pick your brand for a model-by-model FRP bypass
          guide, or jump straight to a utility tool.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/downloads" className="btn-accent px-6 py-3 text-sm">
            <FileDown className="h-4 w-4" />
            Download FRPB for Windows
          </Link>
          <Link href="/pricing" className="btn-ghost px-6 py-3 text-sm">
            View pricing
          </Link>
        </div>

        {/* ================= BRAND HUBS ================= */}
        <section id="brands" aria-label="FRP tools by brand" className="mt-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            FRP tools by brand
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Every supported manufacturer — open a brand hub for its full model list.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SEO_BRANDS.map((brand) => (
              <Link
                key={brand.brandSlug}
                href={brand.path}
                className="glass-surface group flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-blue-glow"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{brandAnchor(brand.brandLabel)}</h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  FRP bypass & lock removal for {brand.models.length}{" "}
                  {brand.models.length === 1 ? "model" : "models"}.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                  View brand hub
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ================= UTILITY TOOLS ================= */}
        <section id="utilities" aria-label="Utility tools" className="mt-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            Utility tools
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Transfer, back up, erase or spoof location — free to try, no device lock required.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {utilities.map((tool) => (
              <Link
                key={tool.path}
                href={tool.path}
                className="glass-surface group flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-blue-glow"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-50 text-accent-600">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{tool.anchor}</h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{tool.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                  Explore tool
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ================= IOS GUIDES (iPhone & iPad) ================= */}
        <section id="ios" aria-label="iPhone and iPad iOS unlock guides" className="mt-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            iPhone & iPad (iOS) guides
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            FRPB is an Android FRP toolkit — for Apple devices we publish honest,
            owner-focused guides to iCloud Activation Lock, passcode and Face ID
            removal through Apple's official channels.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ios.map((guide) => (
              <Link
                key={guide.path}
                href={guide.path}
                className="glass-surface group flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-blue-glow"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700">
                    <Apple className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{guide.anchor}</h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{guide.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                  Read iOS guide
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ================= TRUST STRIP ================= */}
        <section className="mt-16 flex flex-wrap items-center justify-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-4 py-2 text-xs font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            Licensed devices only
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-4 py-2 text-xs font-semibold text-slate-600">
            <Cpu className="h-3.5 w-3.5 text-brand-600" />
            MediaTek & Qualcomm engines
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-glass-edge bg-glass-soft px-4 py-2 text-xs font-semibold text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            One-click USB detection
          </span>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-glass-edge bg-glass-soft px-6 py-8 text-center text-sm text-slate-500 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-4">
          <Link href="/" className="transition hover:text-brand-600">
            Home
          </Link>
          <Link href="/downloads" className="transition hover:text-brand-600">
            Downloads
          </Link>
          <Link href="/pricing" className="transition hover:text-brand-600">
            Pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} FRPB. For lawful use on devices you own.
        </p>
      </footer>

      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "All Tools", path: "/tools" },
        ])}
      />
    </div>
  );
}
