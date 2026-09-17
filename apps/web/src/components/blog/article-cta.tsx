// FRPB — high-converting CTA for blog articles.
//
// `variant="hero"` is the prominent banner placed directly under the standfirst
// so the conversion action ("Download FRPB Recovery Tool" / "Unlock Now") is
// visible before the reader has to scroll. `variant="footer"` is the calmer
// closing card.
//
// Both variants link to /downloads and /pricing, so the two primary conversion
// routes are always one click away from any guide.

import Link from "next/link";
import { Download, Zap } from "lucide-react";

interface ArticleCtaProps {
  variant?: "hero" | "footer";
  /** Overrides the headline when a guide wants more specific copy. */
  headline?: string;
  /** Overrides the supporting sentence. */
  body?: string;
}

const HERO_DEFAULTS = {
  headline: "Unlock it in one click with FRPB Recovery Tool",
  body: "Download FRPB and let high-speed USB auto-detection handle the chipset, the driver and the exact method — no ADB, no Odin, no guesswork.",
};

const FOOTER_DEFAULTS = {
  headline: "Download the FRPB Recovery Tool",
  body: "One free download from frpb.in unlocks one-click FRP bypass, flash reset and high-speed USB auto-detection across Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola and MediaTek/Qualcomm devices.",
};

export default function ArticleCta({ variant = "hero", headline, body }: ArticleCtaProps) {
  const defaults = variant === "hero" ? HERO_DEFAULTS : FOOTER_DEFAULTS;
  const title = headline ?? defaults.headline;
  const copy = body ?? defaults.body;

  if (variant === "footer") {
    return (
      <section className="card mt-12 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 p-9 text-center text-white">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/85">{copy}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/downloads"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-brand-700 shadow-xl shadow-brand-900/30 transition hover:bg-brand-50"
          >
            <Download className="h-5 w-5" />
            Download FRPB free
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10"
          >
            See plans
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Download FRPB Recovery Tool"
      className="mt-10 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-accent-50 p-6 sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            {title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{copy}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/downloads"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            Download FRPB
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Zap className="h-4 w-4" />
            Unlock Now
          </Link>
        </div>
      </div>
    </section>
  );
}
