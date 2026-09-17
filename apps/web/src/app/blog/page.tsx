// FRPB — blog index (/blog).
// Server component: statically rendered, indexable, and emits a Blog JSON-LD
// graph so Google can associate every article with the FRPB brand.
//
// The category taxonomy lives in ONE place (lib/blog.ts). The server resolves
// every tab's post list here and hands it to the client filter, so switching
// tabs needs no server round-trip and the SSR HTML already contains all posts
// for crawlers.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import JsonLd from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { blogListSchema, breadcrumbSchema } from "@/lib/schema";
import {
  BLOG_CATEGORY_TABS,
  BLOG_POSTS,
  categoryCounts,
  postsByCategory,
  type TabId,
} from "@/lib/blog";
import CategoryFilter from "@/components/blog/category-filter";

export const metadata: Metadata = pageMetadata({
  title: "FRPB Blog — FRP Bypass, iCloud Lock & Android Recovery Guides",
  description:
    "In-depth FRP bypass guides, iPhone activation-lock explainers, chipset walkthroughs and step-by-step device recovery guides from the FRPB engineering team.",
  path: "/blog",
  keywords: [
    "frp bypass guide",
    "samsung frp tool",
    "xiaomi frp bypass",
    "iphone icloud lock",
    "flash reset app",
    "frp lock removal",
  ],
});

/**
 * Pre-resolve every tab's posts on the server.
 *
 * Doing this here (rather than in the client filter) means the SSR HTML already
 * contains every post in every tab, so crawlers see the full corpus even though
 * the tab switching itself is client-side.
 */
function buildPostsByCategory(): Record<string, readonly (typeof BLOG_POSTS)[number][]> {
  const map: Record<string, readonly (typeof BLOG_POSTS)[number][]> = {};
  for (const tab of BLOG_CATEGORY_TABS) {
    map[tab.id] = postsByCategory(tab.id);
  }
  return map;
}

export default function BlogIndexPage() {
  const counts = categoryCounts();
  const grouped = buildPostsByCategory();

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <JsonLd
        id="ld-blog-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <JsonLd
        id="ld-blog-list"
        data={blogListSchema(
          BLOG_POSTS.map((post) => ({
            title: post.title,
            description: post.description,
            path: `/blog/${post.slug}`,
          }))
        )}
      />

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
            <span className="text-sm font-medium text-slate-400">Blog</span>
          </Link>
          <Link
            href="/downloads"
            className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            Download free
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1 text-xs font-semibold text-brand-700">
            <BookOpen className="h-3.5 w-3.5" />
            Recovery Guides
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            FRP bypass & device recovery guides
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Practical, engineer-written walkthroughs for removing FRP locks, clearing iCloud
            Activation Lock the legitimate way, and recovering Android devices with the FRPB
            flash reset toolkit.
          </p>
        </div>

        {/* Dynamic category filtering — server-rendered lists, instant tab switch */}
        <CategoryFilter tabs={BLOG_CATEGORY_TABS} counts={counts} postsByCategory={grouped} />

        <section className="card mt-14 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 p-10 text-center text-white">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ready to run your first bypass?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85">
            Download FRPB free from frpb.in and use the same one-click FRP bypass and flash reset
            workflow covered in every guide above.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/downloads"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-700 shadow-xl shadow-brand-900/30 transition hover:bg-brand-50"
            >
              Download FRPB free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-7 py-3.5 text-base font-bold text-white transition hover:bg-white/10"
            >
              Unlock now
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
