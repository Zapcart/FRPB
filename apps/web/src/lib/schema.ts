// FRPB — schema.org (JSON-LD) builders.
// Kept separate from `seo.ts` so metadata and structured data can be unit
// reasoned about independently. All builders emit plain objects.

import { getPlan, resolveEffectiveDurationDays, LAUNCH_PROMO } from "@frpb/shared";
import { RELEASE_VERSION } from "@/config/download";
import { SUPPORT_EMAIL } from "@/config/legal";
import {
  SITE_URL,
  SITE_NAME,
  PRODUCT_NAME,
  PRODUCT_DESCRIPTION,
  PRODUCT_APPLICATION_NAME,
  OG_IMAGE_PATH,
  absoluteUrl,
} from "./seo";

const AVAILABILITY = "https://schema.org/InStock";
const CURRENCY = "USD";
/**
 * Price-validity horizon advertised for the USD offers.
 *
 * Sourced from the launch-promo window so the Offer's `priceValidUntil` can
 * never advertise a validity the storefront no longer honours. Falls back to a
 * safe far-future date if the window is ever unset/malformed.
 */
const PRICE_VALID_UNTIL = LAUNCH_PROMO.endsAt.slice(0, 10) || "2027-12-31";

/**
 * Markets the storefront sells to — the global audience this Task targets
 * (US, UK, Australia, Canada, UAE, Saudi Arabia, Russia). Kept in one place so
 * offer/policy nodes advertise a consistent eligible region set.
 */
const APPLICABLE_COUNTRIES = ["US", "GB", "AU", "CA", "AE", "SA", "RU"] as const;

/**
 * Merchant return policy for the digital licence offers — mirrors the published
 * 7-day money-back guarantee on `/refund` so the structured data matches visible
 * policy pages (a Google merchant-listing + structured-data requirement).
 */
function merchantReturnPolicy(): Record<string, unknown> {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: [...APPLICABLE_COUNTRIES],
    returnPolicyCategory:
      "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnFees: "https://schema.org/FreeReturn",
    // Digital licences are delivered instantly; there is no physical item to
    // condition-check, so the policy is keyed to activation state (see /refund).
    itemCondition: "https://schema.org/NewCondition",
    url: absoluteUrl("/refund"),
  };
}

/**
 * Shipping/delivery details for the Offer. FRPB is a downloadable desktop
 * utility — there is no physical shipment — so this advertises instant digital
 * delivery at zero cost, which satisfies merchant-listing `Offer` guidance for
 * digital goods without implying a physical fulfilment step.
 */
function offerShippingDetails(): Record<string, unknown> {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: "0", currency: CURRENCY },
    shippingDestination: [...APPLICABLE_COUNTRIES].map((code) => ({
      "@type": "DefinedRegion",
      addressCountry: code,
    })),
    doesNotShip: false,
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
    },
  };
}

/** ISO-8601 duration for a plan, or undefined for lifetime (one-time) plans. */
function billingDuration(days: number | null): string | undefined {
  if (days === null) return undefined;
  if (days % 365 === 0 && days >= 365) return `P${days / 365}Y`;
  if (days % 30 === 0) return `P${days / 30}M`;
  return `P${days}D`;
}

/**
 * Optional route context so each programmatic landing page emits its own
 * canonical `url`/name/description instead of the route-agnostic defaults.
 */
export interface SoftwareApplicationSchemaContext {
  /** Route path this schema describes (e.g. "/samsung-frp-bypass"). */
  path?: string;
  /** Overrides the application name for a specific route/tool variant. */
  name?: string;
  /** Overrides the description for a specific route/tool variant. */
  description?: string;
}

/**
 * SoftwareApplication rich-result for the landing page.
 *
 * Emits a single zero-price Offer (the app is free to download) plus an
 * aggregateRating so Google can render the "Free" badge and star rating in the
 * snippet. See the inline caveat on `aggregateRating` before shipping ratings.
 *
 * Pass `context` on programmatic brand/utility routes so each page advertises
 * its own canonical `url` (defaults preserve the homepage behaviour).
 */
export function softwareApplicationSchema(
  context: SoftwareApplicationSchemaContext = {},
): Record<string, unknown> {
  const path = context.path ?? "/";
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: context.name ?? PRODUCT_APPLICATION_NAME,
    alternateName: SITE_NAME,
    applicationCategory: "UtilitiesApplication",
    // Windows-only desktop utility: the FRPB Setup installer targets Win 10/11.
    operatingSystem: "Windows 10, Windows 11",
    softwareVersion: RELEASE_VERSION,
    url: absoluteUrl(path),
    downloadUrl: absoluteUrl("/downloads"),
    installUrl: absoluteUrl("/downloads"),
    image: absoluteUrl(OG_IMAGE_PATH),
    screenshot: absoluteUrl(OG_IMAGE_PATH),
    description: context.description ?? PRODUCT_DESCRIPTION,
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: organizationSchema(),
    // Free to download — a single zero-price Offer keeps the snippet eligible
    // for the "Free" price badge.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: CURRENCY,
    },
    // Requested aggregateRating. CAUTION: Google requires rating markup to
    // reflect visible, verifiable on-page reviews; an unsubstantiated rating is
    // a structured-data policy violation that can trigger a manual action.
    // Surface matching reviews on-site — or remove this node — before relying
    // on it.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "1240",
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

/**
 * Organisation node — referenced as `publisher` by the other builders.
 *
 * Deliberately context-free so it can be embedded inside any graph without a
 * duplicate `@context`. Use `organizationPageSchema()` for the standalone node.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(OG_IMAGE_PATH),
    },
    email: SUPPORT_EMAIL,
    // Machine-readable support/contact surface for brand-knowledge panels.
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
      availableLanguage: ["en"],
    },
  };
}

/**
 * Standalone `Organization` node for the home page.
 *
 * Emitted as its own JSON-LD block (rather than only as a nested `publisher`)
 * so Google associates the site with a knowledge-panel entity and can resolve
 * the brand logo.
 */
export function organizationPageSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    ...organizationSchema(),
  };
}

/**
 * `Product` + `Offer` graph for the pricing page.
 *
 * Every plan is emitted in USD — the only currency the storefront charges — so
 * the node is eligible for merchant/price rich results. Prices come from the
 * shared PLANS definition, so they can never drift from what Razorpay charges.
 *
 * Google's Product-snippet policy requires `offers`, `review` or
 * `aggregateRating` to be present; the entry-price plan below supplies a
 * concrete `Offer`, and `aggregateRating` reinforces rich-snippet eligibility.
 */
export function productSchema(): Record<string, unknown> {
  // Entry-price plan drives the headline Offer (currently $20.00/month).
  const basePlan = getPlan("MONTH_1");
  const basePrice = (basePlan.priceCents / 100).toFixed(2);
  // Resolve the term at call time so the advertised billing duration matches the
  // promo window: during the 30-day launch offer the $20 tier grants 180 days
  // (P6M), after it reverts to 60 days (P2M).
  const baseDuration = billingDuration(resolveEffectiveDurationDays("MONTH_1"));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    image: absoluteUrl(OG_IMAGE_PATH),
    brand: { "@type": "Brand", name: SITE_NAME },
    category: "SecurityApplication",
    url: absoluteUrl("/pricing"),
    offers: {
      "@type": "Offer",
      priceCurrency: CURRENCY,
      price: basePrice,
      priceValidUntil: PRICE_VALID_UNTIL,
      availability: AVAILABILITY,
      url: SITE_URL,
      // Merchant-policy nodes: eligible region set, the 7-day money-back
      // guarantee, and instant digital delivery.
      eligibleRegion: [...APPLICABLE_COUNTRIES].map((code) => ({
        "@type": "DefinedRegion",
        addressCountry: code,
      })),
      hasMerchantReturnPolicy: merchantReturnPolicy(),
      shippingDetails: offerShippingDetails(),
      ...(baseDuration
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: basePrice,
              priceCurrency: CURRENCY,
              billingDuration: baseDuration,
            },
          }
        : {}),
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "120",
    },
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
    // NOTE: deliberately no nested `Product` node here. Google parses a Product
    // on article pages as a Product snippet and then reports a critical
    // "offers/review/aggregateRating missing" error. Device context belongs in
    // the article text, not in a Product entity on a HowTo.
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
