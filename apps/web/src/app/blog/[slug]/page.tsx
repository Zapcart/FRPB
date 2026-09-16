// FRPB — blog article (/blog/[slug]).
// Statically generated per post (generateStaticParams) with BlogPosting +
// BreadcrumbList structured data and a download CTA back to frpb.in.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Download } from "lucide-react";
import JsonLd from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo";
import { blogPostingSchema, breadcrumbSchema, howToSchema } from "@/lib/schema";
import { BLOG_POSTS, getPost } from "@/lib/blog";

interface BlogPostPageProps {
  params: { slug: string };
}

export function generateStaticParams(): { slug: string }[] {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getPost(params.slug);
  if (!post) {
    return pageMetadata({
      title: "Article not found",
      description: "The requested FRPB recovery guide could not be found.",
      path: `/blog/${params.slug}`,
    });
  }
  // Model-specific guides get the brand + Android version folded into the
  // DESCRIPTION (not the title) so the SERP snippet answers the exact long-tail
  // query — "Samsung Galaxy S24 Ultra Android 14/15" — without keyword-stuffing
  // the headline. The title already contains the primary query.
  const versionSuffix =
    post.androidVersions?.length ? ` Covers Android ${post.androidVersions.join(" and ")}.` : "";
  const description =
    post.brand && post.model ? `${post.description}${versionSuffix}` : post.description;

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

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL || "/downloads";

  // The canonical ordered procedure for the HowTo schema: the first section that
  // actually renders a numbered list. Using the same array for both the markup
  // and the schema is what keeps them from drifting apart.
  const howToSteps = post.sections.find((s) => s.steps?.length)?.steps ?? [];

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
        })}
      />
      <JsonLd
        id="ld-post-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
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
            deviceName: post.brand && post.model ? `${post.brand} ${post.model}` : undefined,
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

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-500">{post.description}</p>

        <article className="mt-10 space-y-10">
          {post.sections.map((section, index) => (
            <section key={section.heading ?? index} className="space-y-4">
              {section.heading ? (
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
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
          ))}
        </article>

        <p className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
          FRPB is intended strictly for authorised device owners and repair professionals. Only use
          an FRP bypass tool on hardware you own or have explicit permission to service.
        </p>

        <section className="card mt-12 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 p-9 text-center text-white">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Download the FRPB FRP bypass tool
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/85">
            One free download from frpb.in unlocks one-click FRP bypass, flash reset and high-speed
            USB auto-detection for Samsung, Xiaomi, Vivo, Oppo and MediaTek/Qualcomm devices.
          </p>
          <Link
            href={downloadUrl}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-brand-700 shadow-xl shadow-brand-900/30 transition hover:bg-brand-50"
          >
            <Download className="h-5 w-5" />
            Download FRPB free
          </Link>
        </section>

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
