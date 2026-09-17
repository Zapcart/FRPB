// FRPB — auto-generated Table of Contents for blog articles.
//
// Renders the heading index produced by `tableOfContentsFor()` in lib/blog.ts,
// so the anchor ids here are guaranteed to match the `<h2 id>` elements the
// article body emits (both derive from the same `slugifyHeading` helper).
//
// Rendered as a server component: it is pure markup built from static data, so
// there is no reason to ship it to the client.

import { List } from "lucide-react";
import type { TocEntry } from "@/lib/blog";

interface ArticleTocProps {
  entries: TocEntry[];
  /** Total reading time in minutes, shown alongside the index. */
  readingMinutes: number;
}

export default function ArticleToc({ entries, readingMinutes }: ArticleTocProps) {
  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/60 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <List className="h-4 w-4" />
        In this guide
        <span className="ml-auto font-medium normal-case tracking-normal text-slate-400">
          {readingMinutes} min read
        </span>
      </div>
      <ol className="mt-3 space-y-1.5">
        {entries.map((entry, index) => (
          <li key={entry.id} className="flex gap-2 text-sm">
            <span className="font-mono text-xs text-slate-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${entry.id}`}
              className="text-slate-600 underline-offset-2 transition hover:text-brand-600 hover:underline"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
