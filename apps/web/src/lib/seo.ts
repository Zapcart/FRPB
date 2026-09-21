// FRPB — SEO constants + helpers.
// Single source of truth for the canonical origin, default metadata copy,
// keyword sets and JSON-LD builders used across the marketing routes.

import type { Metadata } from "next";

/** Canonical, absolute origin for every public URL / sitemap entry. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in"
).replace(/\/$/, "");

export const SITE_NAME = "FRPB";

/** Product-level constants re-used by metadata + structured data. */
export const PRODUCT_NAME = "FRPB Recovery";
export const PRODUCT_TAGLINE = "FRP Bypass & Android Device Recovery Tool";
export const PRODUCT_DESCRIPTION =
  "Free-to-try FRP bypass and flash reset tool for Samsung, Xiaomi, Vivo, Oppo and MediaTek/Qualcomm devices — Windows & macOS, one-click USB detection.";

/**
 * Primary high-volume query target for the landing page.
 *
 * Keyword-first, benefit-led and year-qualified to win the SERP against
 * generic competitors, while still landing under the ~60-char display limit
 * (`54` chars) so Google does not truncate the differentiator.
 */
export const PRIMARY_TITLE = "FRP Bypass Tool 2026 — One-Click Android Unlock | FRPB";

/**
 * Focus keyword set attached to the landing page + core routes.
 * Ordered by commercial intent — the 2026-qualified and chipset-specific
 * queries first, since those convert best for a paid desktop tool.
 */
export const PRIMARY_KEYWORDS = [
  "samsung frp bypass 2026",
  "xiaomi unlock tool",
  "mtk brom tool",
  "qualcomm edl repair",
  "frp bypass tool",
  "samsung frp tool",
  "flash reset app",
  "frp lock removal",
];

/** Social share card. Single source so OG + Twitter never drift apart. */
export const OG_IMAGE_PATH = "/logo.png";
export const OG_IMAGE_ALT = "FRPB — FRP Bypass & Device Recovery Tool";
/**
 * Intrinsic dimensions of the social share card. Declared explicitly so the
 * crawler can allocate the correct aspect-ratio box before the asset loads —
 * avoids the "no dimension" warning in Rich Results and layout shift in preview.
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Absolute URL helper for canonicals, OG urls and sitemap entries. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/**
 * Builds a per-route `Metadata` object with a canonical URL, OpenGraph and a
 * Twitter card. Pages only supply the copy that differs.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  image = OG_IMAGE_PATH,
  imageAlt = OG_IMAGE_ALT,
}: {
  /** Raw page title; the root layout template appends “· FRPB”. */
  title: string;
  description: string;
  /** Route path beginning with “/” — becomes the canonical URL. */
  path: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
}): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_IN",
      title,
      description,
      url: canonical,
      images: [
        {
          url: image,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
