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
export const PRODUCT_TAGLINE = "#1 FRP Bypass & Android Device Recovery Tool";
export const PRODUCT_DESCRIPTION =
  "One-click FRP bypass and flash reset tool for Samsung, Xiaomi, Vivo, Oppo, and MediaTek/Qualcomm devices. High-speed USB auto-detection.";

/** Primary high-volume query target for the landing page. */
export const PRIMARY_TITLE = `FRPB - ${PRODUCT_TAGLINE}`;

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
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
