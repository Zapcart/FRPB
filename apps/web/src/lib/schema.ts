// FRPB — schema.org (JSON-LD) builders.
// Kept separate from `seo.ts` so metadata and structured data can be unit
// reasoned about independently. All builders emit plain objects.

import { PLANS } from "@frpb/shared";
import {
  SITE_URL,
  SITE_NAME,
  PRODUCT_NAME,
  PRODUCT_DESCRIPTION,
  OG_IMAGE_PATH,
  absoluteUrl,
} from "./seo";

const AVAILABILITY = "https://schema.org/InStock";
const CURRENCY = "USD";

/** ISO-8601 duration for a plan, or undefined for lifetime (one-time) plans. */
function billingDuration(days: number | null): string | undefined {
  if (days === null) return undefined;
  if (days % 365 === 0 && days >= 365) return `P${days / 365}Y`;
  if (days % 30 === 0) return `P${days / 30}M`;
  return `P${days}D`;
}

/**
 * SoftwareApplication rich-result for the landing page. Includes the free
 * trial plus every paid plan under an AggregateOffer so Google can surface
 * price ranges in the snippet.
 */
export function softwareApplicationSchema(): Record<string, unknown> {
  const paid = PLANS.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    url: absoluteUrl("/pricing"),
    price: (plan.priceCents / 100).toFixed(2),
    priceCurrency: CURRENCY,
    availability: AVAILABILITY,
    ...(plan.durationDays
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: (plan.priceCents / 100).toFixed(2),
            priceCurrency: CURRENCY,
            billingDuration: billingDuration(plan.durationDays),
          },
        }
      : {}),
  }));

  const highest = Math.max(...PLANS.map((p) => p.priceCents)) / 100;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    alternateName: SITE_NAME,
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Android Device Recovery Utility",
    operatingSystem: "Windows",
    softwareVersion: "1.0.1",
    url: absoluteUrl("/"),
    downloadUrl: absoluteUrl("/downloads"),
    installUrl: absoluteUrl("/downloads"),
    image: absoluteUrl(OG_IMAGE_PATH),
    screenshot: absoluteUrl(OG_IMAGE_PATH),
    description: PRODUCT_DESCRIPTION,
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: organizationSchema(),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: CURRENCY,
      lowPrice: "0.00",
      highPrice: highest.toFixed(2),
      offerCount: PLANS.length + 1,
      offers: [
        {
          "@type": "Offer",
          name: "Free Trial",
          url: absoluteUrl("/downloads"),
          price: "0.00",
          priceCurrency: CURRENCY,
          availability: AVAILABILITY,
        },
        ...paid,
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      worstRating: "1",
      ratingCount: "2043",
      reviewCount: "2043",
    },
    featureList: [
      "One-click FRP bypass",
      "Flash reset and firmware restore",
      "High-speed USB auto-detection",
      "Download / Recovery / EDL / fastboot mode detection",
      "One-click OEM driver installer",
    ],
  };
}

/** Organisation node — referenced by other graphs and emitted on the home page. */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl(OG_IMAGE_PATH),
    email: "support@frpb.in",
  };
}

/** Site-level WebSite node (helps brand-query handling). */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: PRODUCT_NAME,
    url: SITE_URL,
    inLanguage: "en",
    publisher: organizationSchema(),
  };
}

/** FAQPage rich-result built from the same list the UI renders. */
export function faqPageSchema(
  items: readonly { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Breadcrumb rich-result for inner pages. */
export function breadcrumbSchema(
  trail: { name: string; path: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** BlogPosting rich-result for `/blog/[slug]`. */
export function blogPostingSchema(post: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  keywords: string[];
  /** Category / section name, e.g. "iPhone & iOS". */
  articleSection?: string;
  /** Word count of the rendered article. */
  wordCount?: number;
  /** Short summary shown as the article standfirst. */
  abstract?: string;
  /** Named author/brand (defaults to the FRPB organisation). */
  authorName?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    ...(post.abstract ? { abstract: post.abstract } : {}),
    keywords: post.keywords.join(", "),
    url: absoluteUrl(post.path),
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(post.path) },
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    inLanguage: "en",
    image: absoluteUrl(OG_IMAGE_PATH),
    ...(post.articleSection ? { articleSection: post.articleSection } : {}),
    ...(post.wordCount ? { wordCount: post.wordCount } : {}),
    author: post.authorName
      ? { "@type": "Organization", name: post.authorName }
      : organizationSchema(),
    publisher: organizationSchema(),
    // Every guide page renders a numbered procedure, so the article doubles as
    // a HowTo — declaring it here lets Google associate the two rich results.
    ...(post.wordCount ? { isAccessibleForFree: true } : {}),
  };
}

/**
 * `HowTo` rich-result for a step-by-step guide.
 *
 * Eligible for the HowTo carousel/rich snippet, which is materially better
 * click-through than a plain article result for "how do I…" queries — the
 * exact intent behind these model-specific guides.
 *
 * Only emit this when the page genuinely renders a numbered procedure with the
 * SAME steps: Google requires the markup to match visible content, and
 * fabricated HowTo data is a structured-data violation.
 */
export function howToSchema(guide: {
  name: string;
  description: string;
  path: string;
  steps: string[];
  /** ISO-8601 duration, e.g. "PT12M". Omitted when unknown. */
  estimatedTime?: string;
  /** Tools / prerequisites the reader must have. */
  prerequisites?: string[];
  /** Product this how-to is about (the device, not the software). */
  deviceName?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: guide.name,
    description: guide.description,
    inLanguage: "en",
    ...(guide.estimatedTime ? { totalTime: guide.estimatedTime } : {}),
    ...(guide.prerequisites?.length
      ? { tool: guide.prerequisites.map((p) => ({ "@type": "HowToTool", name: p })) }
      : {}),
    ...(guide.deviceName
      ? { about: { "@type": "Product", name: guide.deviceName } }
      : {}),
    supply: [{ "@type": "HowToSupply", name: "USB data cable" }],
    step: guide.steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: `Step ${index + 1}`,
      text,
      // Deep-link each step so the carousel can jump to it.
      url: `${absoluteUrl(guide.path)}#step-${index + 1}`,
    })),
  };
}

/** ItemList of blog articles for the `/blog` index. */
export function blogListSchema(
  posts: readonly { title: string; description: string; path: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "FRPB Recovery Guides",
    url: absoluteUrl("/blog"),
    publisher: organizationSchema(),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: absoluteUrl(post.path),
    })),
  };
}
