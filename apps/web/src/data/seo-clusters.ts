// FRPB — programmatic SEO topic clusters + internal-link graph.
//
// Sits on top of `data/seo-matrix.ts` (device vocabulary) and the shared
// `FREE_TOOLS` registry to build:
//   1. Brand keyword sets (hub + spoke targeting).
//   2. Model × intent keyword cross-products.
//   3. Utility cross-link sets (WhatsApp → Phone → Data Eraser → Location).
//   4. Internal-link selectors with EXACT-MATCH anchors (Hack 4/5/12).
//
// Pure + side-effect free so it can be imported by server components,
// `generateStaticParams`, the sitemap and the build-time metadata generators.

import { FREE_TOOLS, FREE_TOOL_IDS, type FreeToolId } from "@frpb/shared";
import {
  SEO_BRANDS,
  SEO_MODELS,
  siblingModels,
  type SeoBrandRecord,
  type SeoIntent,
  type SeoModelRecord,
} from "./seo-matrix";

/** A single internal link with an exact-match anchor + descriptive blurb. */
export interface SeoLink {
  path: string;
  anchor: string;
  blurb: string;
}

/** A brand hub cluster: keyword set + its model spokes. */
export interface BrandCluster {
  brandSlug: string;
  brandLabel: string;
  hubPath: string;
  keywords: string[];
  models: SeoModelRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand keyword clusters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hand-tuned keyword sets for the highest-value OEMs. Anything not listed
 * falls back to the deterministic generator below — no brand is ever missing.
 */
const BRAND_KEYWORD_OVERRIDES: Record<string, readonly string[]> = {
  samsung: [
    "samsung frp tool",
    "samsung frp bypass tool 2026",
    "samsung lock removal tool",
    "samsung account bypass",
    "remove frp on samsung",
  ],
  xiaomi: [
    "xiaomi frp tool",
    "xiaomi miui frp bypass",
    "redmi frp bypass tool",
    "xiaomi lock removal tool",
    "remove mi account lock",
  ],
  vivo: ["vivo frp tool", "vivo lock removal tool", "vivo frp bypass 2026", "remove frp on vivo"],
  oppo: ["oppo frp tool", "oppo lock removal tool", "oppo frp bypass 2026", "remove frp on oppo"],
  realme: [
    "realme frp tool",
    "realme lock removal tool",
    "realme frp bypass 2026",
    "remove frp on realme",
  ],
  oneplus: ["oneplus frp tool", "oneplus lock removal tool", "oneplus frp bypass 2026"],
  motorola: ["motorola frp tool", "moto frp bypass tool", "motorola lock removal tool"],
  google: ["google pixel frp tool", "pixel frp bypass", "pixel lock removal tool"],
  tecno: ["tecno frp tool", "tecno frp bypass 2026", "tecno lock removal tool"],
  infinix: ["infinix frp tool", "infinix frp bypass 2026", "infinix lock removal tool"],
  huawei: ["huawei frp tool", "huawei lock removal tool", "huawei frp bypass 2026"],
  nothing: ["nothing phone frp bypass", "nothing phone frp tool"],
};

/** Deterministic brand keyword generator for OEMs without an override. */
function generatedBrandKeywords(brandLabel: string): string[] {
  const lower = brandLabel.toLowerCase();
  return [
    `${lower} frp tool`,
    `${lower} frp bypass tool`,
    `${lower} lock removal tool`,
    `${lower} frp bypass 2026`,
    `${lower} unlock tool`,
    `remove frp on ${lower}`,
  ];
}

/** Dedupe preserving first-seen order. */
function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

/** Full keyword set for a brand hub (overrides ∪ generated). */
export function brandClusterKeywords(brandLabel: string, brandSlug: string): string[] {
  const overrides = BRAND_KEYWORD_OVERRIDES[brandSlug] ?? [];
  return unique([...overrides, ...generatedBrandKeywords(brandLabel)]);
}

/** Resolve a brand hub cluster by slug. */
export function clusterForBrand(brandSlug: string): BrandCluster | undefined {
  const hub: SeoBrandRecord | undefined = SEO_BRANDS.find((b) => b.brandSlug === brandSlug);
  if (!hub) return undefined;
  return {
    brandSlug: hub.brandSlug,
    brandLabel: hub.brandLabel,
    hubPath: hub.path,
    keywords: brandClusterKeywords(hub.brandLabel, hub.brandSlug),
    models: hub.models,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Model × intent keyword cross-product
// ─────────────────────────────────────────────────────────────────────────────

/** Keyword cross-product for a single model spoke. */
export function modelClusterKeywords(record: SeoModelRecord, intent: SeoIntent): string[] {
  const full = record.fullModelLabel.toLowerCase();
  const short = record.modelLabel.toLowerCase();
  const brand = record.brandLabel.toLowerCase();
  const brandSlug = record.brandSlug;

  const intentKeywords =
    intent === "frp-bypass"
      ? [
          `${full} frp bypass`,
          `${full} frp bypass tool`,
          `${full} frp tool 2026`,
          `${short} frp bypass`,
          `${brand} ${short} frp bypass`,
          `remove frp on ${full}`,
        ]
      : [
          `${full} lock removal`,
          `${full} lock removal tool`,
          `${full} screen lock removal`,
          `${short} lock removal`,
          `${brand} ${short} lock removal`,
          `remove screen lock on ${full}`,
        ];

  return unique([
    ...intentKeywords,
    ...brandClusterKeywords(record.brandLabel, brandSlug),
    `${brand} frp tool`,
    "android lock removal tool",
    "frp bypass tool",
    record.chipset !== "Unknown" ? `${record.chipset} frp bypass` : "",
  ].filter(Boolean));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility cluster + cross-links
// ─────────────────────────────────────────────────────────────────────────────

interface UtilityClusterEntry extends SeoLink {
  id: FreeToolId;
  label: string;
  keywords: string[];
}

/** Ordered utility cluster — also defines the cross-link priority. */
export const UTILITY_CLUSTER: readonly UtilityClusterEntry[] = FREE_TOOL_IDS.map((id) => {
  const tool = FREE_TOOLS[id];
  const primary = tool.keywords.split(",")[0]?.trim() ?? tool.eyebrow.toLowerCase();
  return {
    id,
    label: tool.eyebrow,
    path: tool.path,
    anchor: primary,
    blurb: tool.tagline,
    keywords: tool.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  };
});

/**
 * Cross-link sets: every utility links to the others in the canonical order
 * (WhatsApp Transfer → Phone Transfer → Data Eraser → Virtual Location).
 */
export const UTILITY_CROSS_LINKS: Record<FreeToolId, SeoLink[]> = (() => {
  const map = {} as Record<FreeToolId, SeoLink[]>;
  for (const entry of UTILITY_CLUSTER) {
    map[entry.id] = UTILITY_CLUSTER.filter((other) => other.id !== entry.id).map((other) => ({
      path: other.path,
      anchor: other.anchor,
      blurb: other.blurb,
    }));
  }
  return map;
})();

/** Utility cross-links for one tool id (excluding itself). */
export function utilityCrossLinks(id: FreeToolId, limit = 3): SeoLink[] {
  return (UTILITY_CROSS_LINKS[id] ?? []).slice(0, limit);
}

/** Every utility as a link (used by the `/tools` index + spokes). */
export function utilityLinks(): SeoLink[] {
  return UTILITY_CLUSTER.map(({ path, anchor, blurb }) => ({ path, anchor, blurb }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Model / brand internal-link selectors
// ─────────────────────────────────────────────────────────────────────────────

/** Exact-match anchor for a model spoke, e.g. "Samsung Galaxy A12 FRP bypass". */
export function modelAnchor(record: SeoModelRecord, intent: SeoIntent = "frp-bypass"): string {
  const suffix = intent === "frp-bypass" ? "FRP bypass" : "lock removal";
  return `${record.fullModelLabel} ${suffix}`;
}

/** Sibling model spokes (same brand) as internal links. */
export function relatedModels(record: SeoModelRecord, limit = 6): SeoLink[] {
  return siblingModels(record)
    .slice(0, limit)
    .map((sibling) => ({
      path: sibling.paths["frp-bypass"],
      anchor: modelAnchor(sibling, "frp-bypass"),
      blurb: `Remove FRP and screen lock on the ${sibling.fullModelLabel}.`,
    }));
}

/** Sibling brand hubs (all other OEMs) as internal links. */
export function relatedBrands(brandSlug: string, limit = 6): SeoLink[] {
  return SEO_BRANDS.filter((brand) => brand.brandSlug !== brandSlug)
    .slice(0, limit)
    .map((brand) => ({
      path: brand.path,
      anchor: `${brand.brandLabel} FRP tool`,
      blurb: `FRP bypass and lock removal for all ${brand.brandLabel} models.`,
    }));
}

/** Total number of model spokes across the whole matrix. */
export const CLUSTER_MODEL_COUNT = SEO_MODELS.length;
