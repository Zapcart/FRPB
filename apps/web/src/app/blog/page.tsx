// FRPB — blog index (/blog).
// Server component: statically rendered, indexable, and emits a Blog JSON-LD
// graph so Google can associate every article with the FRPB brand.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Clock } from "lucide-react";
import JsonLd from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { blogListSchema, breadcrumbSchema } from "@/lib/schema";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata: Metadata = pageMetadata({
  title: "FRPB Blog — FRP Bypass & Android Recovery Guides",
  description:
    "In-depth FRP bypass guides, chipset explainers and step-by-step device recovery walkthroughs from the FRPB engineering team.",
  path: "/blog",
  keywords: [
    "frp bypass guide",
    "samsung frp tool",
    "xiaomi frp bypass",
    "flash reset app",
    "frp lock removal",
  ],
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
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
            FRP bypass & Android recovery guides
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-500">
            Practical, engineer-written walkthroughs for removing FRP locks, restoring firmware and
            recovering Android devices with the FRPB flash reset toolkit.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="card flex flex-col p-6">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(post.datePublished)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readingMinutes} min read
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold leading-snug text-slate-900">
                <Link href={`/blog/${post.slug}`} className="transition hover:text-brand-600">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">{post.excerpt}</p>
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

        <section className="card mt-14 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 p-10 text-center text-white">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ready to run your first bypass?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85">
            Download FRPB free from frpb.in and use the same one-click FRP bypass and flash reset
            workflow covered in every guide above.
          </p>
          <Link
            href="/downloads"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-700 shadow-xl shadow-brand-900/30 transition hover:bg-brand-50"
          >
            Download FRPB free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
