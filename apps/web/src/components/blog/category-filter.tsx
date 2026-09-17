// FRPB — /blog category filter tabs.
//
// A client component so the tab switch is instant and does not require a full
// navigation. The posts themselves are rendered by the server page and passed
// down as a pre-resolved record, so the taxonomy lives in ONE place
// (lib/blog.ts) and this component only decides what to show.
//
// The selected tab is mirrored into the URL (`?category=…`) with replaceState,
// which keeps the filter shareable and back-button friendly without triggering
// a server round-trip.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Smartphone } from "lucide-react";
import type { BlogPost, TabId } from "@/lib/blog";

export type FilterTabId = TabId;

export interface FilterTab {
  id: FilterTabId;
  label: string;
  /** Categories this tab includes (empty for "all"). */
  categories?: readonly string[];
}

interface CategoryFilterProps {
  tabs: readonly FilterTab[];
  counts: Record<FilterTabId, number>;
  /** Every post, keyed by its resolved category ("all" is derived here). */
  postsByCategory: Record<FilterTabId, readonly BlogPost[]>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CategoryFilter({
  tabs,
  counts,
  postsByCategory,
}: CategoryFilterProps) {
  const [active, setActive] = useState<FilterTabId>("all");

  // Initialise from ?category=… so a shared/deep link opens the right tab, and
  // keep the URL in sync as the user switches (replaceState — no navigation).
  useEffect(() => {
    try {
      const initial = new URLSearchParams(window.location.search).get("category");
      if (initial && tabs.some((t) => t.id === initial)) {
        setActive(initial as FilterTabId);
      }
    } catch {
      // No location (SSR pass) — default tab stands.
    }
  }, [tabs]);

  const select = useCallback(
    (id: FilterTabId) => {
      setActive(id);
      try {
        const url = new URL(window.location.href);
        if (id === "all") url.searchParams.delete("category");
        else url.searchParams.set("category", id);
        window.history.replaceState(null, "", url.toString());
      } catch {
        // History API unavailable — the tab still switches in-memory.
      }
    },
    []
  );

  const posts = useMemo(
    () => postsByCategory[active] ?? postsByCategory.all ?? [],
    [postsByCategory, active]
  );

  return (
    <>
      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Filter guides by category"
        className="mt-10 flex flex-wrap gap-2"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const count = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                isActive
                  ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 text-[11px] font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filtered post grid ──────────────────────────────────────────── */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {posts.map((post) => (
          <article key={post.slug} className="card flex flex-col p-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(post.datePublished)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {post.readingMinutes} min read
              </span>
              {post.platform && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    post.platform === "iOS"
                      ? "bg-slate-900 text-white"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <Smartphone className="h-3 w-3" />
                  {post.platform}
                </span>
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold leading-snug text-slate-900">
              <Link href={`/blog/${post.slug}`} className="transition hover:text-brand-600">
                {post.title}
              </Link>
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
              {post.excerpt}
            </p>
            <Link
              href={`/blog/${post.slug}`}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
            >
              Read guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="mt-10 text-center text-sm text-slate-500">
          No guides in this category yet — check back soon.
        </p>
      )}
    </>
  );
}
