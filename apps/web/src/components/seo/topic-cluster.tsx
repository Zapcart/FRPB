// FRPB — reusable topic-cluster / internal-link widget (server component).
//
// Renders a grid of `SeoLink`s using EXACT-MATCH anchor text (SEO Hack 4/5/12)
// so every internal link carries a keyword-relevant signal. Pure presentational
// server component — no client JS, so it can be dropped into any landing page,
// hub or spoke without adding to the client bundle.

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { SeoLink } from "@/data/seo-clusters";

export interface TopicClusterProps {
  /** Section heading, e.g. "Related Samsung FRP bypass guides". */
  heading: string;
  /** Optional supporting copy rendered under the heading. */
  intro?: string;
  /** Internal links to render (exact-match anchor + descriptive blurb). */
  links: readonly SeoLink[];
  /** Accessible name for the wrapping <section>. Defaults to `heading`. */
  ariaLabel?: string;
  /** Optional element id for in-page deep links. */
  id?: string;
  /** Maximum grid columns at the largest breakpoint (default 2). */
  columns?: 2 | 3;
  /** Per-card call-to-action label. */
  cta?: string;
}

/**
 * TopicCluster — accessible, exact-match internal-link grid.
 *
 * Renders nothing when there are no links, so calling pages can pass a
 * possibly-empty selector without guarding themselves.
 */
export default function TopicCluster({
  heading,
  intro,
  links,
  ariaLabel,
  id,
  columns = 2,
  cta = "Open guide",
}: TopicClusterProps) {
  if (links.length === 0) {
    return null;
  }

  const gridClass =
    columns === 3
      ? "mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      : "mt-8 grid gap-4 sm:grid-cols-2";

  return (
    <section id={id} aria-label={ariaLabel ?? heading} className="mt-14">
      <h2 className="text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {heading}
      </h2>
      {intro ? (
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">{intro}</p>
      ) : null}
      <div className={gridClass}>
        {links.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className="glass-surface group flex flex-col p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/80 hover:shadow-glass-light-hover"
          >
            <h3 className="text-sm font-bold text-ink">{link.anchor}</h3>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-500">{link.blurb}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600">
              {cta}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
