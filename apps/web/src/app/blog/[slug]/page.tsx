// FRPB — blog article (/blog/[slug]).
// Statically generated per post (generateStaticParams) with BlogPosting +
// HowTo + BreadcrumbList structured data, an auto-generated table of contents,
// a hero conversion CTA and a closing download CTA.
//
// Rich results: the BlogPosting carries articleSection/wordCount and the HowTo
// mirrors the visible numbered procedure, which is what earns the step-by-step
// badge in Google Search.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Smartphone } from "lucide-react";
import JsonLd from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { blogPostingSchema, breadcrumbSchema, howToSchema } from "@/lib/schema";
import { BLOG_POSTS, getPost, categoryOf, platformOf } from "@/lib/blog";
import {
  computeReadingMinutes,
  howToStepsFor,
  slugifyHeading,
  tableOfContentsFor,
} from "@/lib/blog";
import ArticleToc from "@/components/blog/article-toc";
import ArticleCta from "@/components/blog/article-cta";

interface BlogPostPageProps {
  params: { slug: string };
}

export function generateStaticParams(): { slug: string }[] {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

/** Human label for a category, used in the article section metadata. */
const CATEGORY_LABEL: Record<string, string> = {
  iphone: "iPhone & iOS",
  samsung: "Samsung Galaxy",
  xiaomi: "Xiaomi & HyperOS",
  android: "Android FRP",
  qualcomm: "Qualcomm & MediaTek",
};

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getPost(params.slug);
  if (!post) {
    return pageMetadata({
      title: "Article not found",
      description: "The requested FRPB recovery guide could not be found.",
      path: `/blog/${params.slug}`,
    });
  }
  // Model-specific guides get the brand + OS version folded into the
  // DESCRIPTION (not the title) so the SERP snippet answers the exact long-tail
  // query without keyword-stuffing the headline.
  const versions = post.osVersions?.length
    ? post.osVersions
    : post.androidVersions ?? [];
  const versionSuffix = versions.length
    ? ` Verified for ${versions.length > 2 ? `${versions[0]}–${versions[versions.length - 1]}` : versions.join(" and ")}.`
    : "";
  const description =
    (post.brand && post.model) || post.platform
      ? `${post.description}${versionSuffix}`
      : post.description;

  return pageMetadata({
    title: post.title,
    description,
    path: `/blog/${post.slug}`,
    keywords: post.keywords,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Rough word count of the rendered prose, for the BlogPosting wordCount. */
function wordCountOf(post: ReturnType<typeof getPost>): number {
  if (!post) return 0;
  return post.sections.reduce((total, section) => {
    const text = [
      section.heading ?? "",
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
    ].join(" ");
    return total + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const category = categoryOf(post);
  const platform = platformOf(post);
  // Reading time is recomputed from the actual prose so a guide edited with new
  // sections never keeps a stale authored number.
  const readingMinutes = Math.max(post.readingMinutes, computeReadingMinutes(post));

  // The canonical ordered procedure for the HowTo schema: the first section that
  // actually renders a numbered list. Using the same array for both the markup
  // and the schema is what keeps them from drifting apart.
  const howToSteps = howToStepsFor(post);

  // Auto-generated heading index. Anchors are derived from the SAME slugify
  // helper used for the <h2 id> below, so every link resolves.
  const toc = tableOfContentsFor(post);
  // Map each section heading to its TOC anchor (handles duplicate headings).
  const headingAnchor = new Map<string, string>();
  post.sections.forEach((section) => {
    if (!section.heading) return;
    const entry = toc.find(
      (t) => t.label === section.heading && !headingAnchor.has(t.label)
    );
    if (entry) headingAnchor.set(section.heading, entry.id);
  });

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <JsonLd
        id="ld-post-schema"
        data={blogPostingSchema({
          title: post.title,
          description: post.description,
          path: `/blog/${post.slug}`,
          datePublished: post.datePublished,
          dateModified: post.dateModified,
          keywords: post.keywords,
          abstract: post.excerpt,
          articleSection: CATEGORY_LABEL[category] ?? "Recovery Guides",
          wordCount: wordCountOf(post),
        })}
      />
      <JsonLd
        id="ld-post-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          {
            name: CATEGORY_LABEL[category] ?? "Guides",
            path: `/blog?category=${category}`,
          },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      {/*
        HowTo is emitted ONLY for guides that declare an ordered procedure.
        Google requires the markup to mirror visible on-page steps — the first
        section that renders a numbered list is that procedure.
      */}
      {howToSteps.length > 0 && (
        <JsonLd
          id="ld-post-howto"
          data={howToSchema({
            name: post.title,
            description: post.description,
            path: `/blog/${post.slug}`,
            steps: howToSteps,
            estimatedTime: post.estimatedTime,
            prerequisites: post.prerequisites,
            deviceName:
              post.brand && post.model ? `${post.brand} ${post.model}` : undefined,
          })}
        />
      )}

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-ink">
            FRPB
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" />
            All guides
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          {/* Category badge links back into the filtered blog index. */}
          <Link
            href={`/blog?category=${category}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50/70 px-2.5 py-1 font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            {CATEGORY_LABEL[category] ?? "Guides"}
          </Link>
          {post.platform && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold uppercase tracking-wide ${
                platform === "iOS"
                  ? "bg-slate-900 text-white"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <Smartphone className="h-3 w-3" />
              {platform}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(post.datePublished)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {readingMinutes} min read
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-500">{post.description}</p>

        {/* Hero conversion CTA — visible before any scrolling. */}
        <ArticleCta variant="hero" />

        {/* Auto-generated heading index (links to the <h2 id> anchors below). */}
        <ArticleToc entries={toc} readingMinutes={readingMinutes} />

        <article className="mt-10 space-y-10">
          {post.sections.map((section, index) => {
            const anchor = section.heading
              ? headingAnchor.get(section.heading) ?? slugifyHeading(section.heading)
              : `section-${index + 1}`;
            return (
              <section key={section.heading ?? index} className="space-y-4">
                {section.heading ? (
                  <h2
                    id={anchor}
                    className="scroll-mt-24 text-2xl font-bold tracking-tight text-slate-900"
                  >
                    {section.heading}
                  </h2>
                ) : null}
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed text-slate-600">
                    {paragraph}
                  </p>
                ))}
                {section.steps?.length ? (
                  <ol className="space-y-3">
                    {section.steps.map((step, stepIndex) => (
                      <li
                        // Anchor target for the HowTo step URLs — the JSON-LD
                        // deep-links to #step-N, so the element must exist.
                        id={`step-${stepIndex + 1}`}
                        key={step}
                        className="flex scroll-mt-24 gap-3 text-base leading-relaxed text-slate-600"
                      >
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                          {stepIndex + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            );
          })}
        </article>

        <p className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          FRPB is intended strictly for authorised device owners and repair professionals. Only use
          an FRP bypass tool on hardware you own or have explicit permission to service.
        </p>

        {/* Closing conversion CTA. */}
        <ArticleCta variant="footer" />

        <div className="mt-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all recovery guides
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
