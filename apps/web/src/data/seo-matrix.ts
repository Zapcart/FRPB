// FRPB — programmatic SEO device matrix (data layer).
//
// Derives a typed, brand-grouped device matrix from the canonical shared
// registry (`KNOWN_MODELS` + `toCatalogEntry`) so the web app and the desktop
// wizard never drift. This module is intentionally pure and dependency-light:
// it produces the slug/path vocabulary consumed by `lib/seo-matrix.ts`,
// the `/tools/*` routes, the sitemap and the topic-cluster widget.
//
// Design notes:
// - One curated model → two intent variants (`frp-bypass`, `lock-removal`).
// - The `[model]` URL segment is the brand-stripped model slug + intent suffix,
//   e.g. "Samsung Galaxy S24" → `/tools/samsung/galaxy-s24-frp-bypass`.
// - The matrix is capped to the curated `KNOWN_MODELS` set (quality over
//   quantity) — there is no infinite URL space.

import {
  KNOWN_MODELS,
  toCatalogEntry,
  type ChipsetFamily,
} from "@frpb/shared";

/** Supported search intents for a model spoke. */
export type SeoIntent = "frp-bypass" | "lock-removal";

/** Canonical intent order (stable rendering + deterministic sitemaps). */
export const SEO_INTENTS: readonly SeoIntent[] = ["frp-bypass", "lock-removal"];

/** Human-readable intent labels used in H1 / meta copy. */
export const INTENT_LABELS: Record<SeoIntent, string> = {
  "frp-bypass": "FRP Bypass",
  "lock-removal": "Lock Removal",
};

/** URL base for the whole tools cluster. */
export const TOOLS_BASE_PATH = "/tools";

/** A single model × intent spoke record. */
export interface SeoModelRecord {
  /** Full display label, e.g. "Samsung Galaxy S24". */
  fullModelLabel: string;
  /** Brand-stripped display label, e.g. "Galaxy S24". */
  modelLabel: string;
  /** Brand-stripped slug, e.g. "galaxy-s24". */
  modelSlug: string;
  /** Owning brand display label, e.g. "Samsung". */
  brandLabel: string;
  /** Owning brand slug, e.g. "samsung". */
  brandSlug: string;
  /** Inferred chipset family (drives mode copy + manual key combo). */
  chipset: ChipsetFamily;
  /** True when the device needs a hardware key combination first (BROM/EDL). */
  manualMode: boolean;
  /** Human-readable key combination when `manualMode` is true. */
  keyCombo?: string;
  /** Intents this model exposes (always both, in canonical order). */
  intents: readonly SeoIntent[];
  /** Canonical brand hub path, e.g. "/tools/samsung". */
  brandPath: string;
  /** Canonical spoke paths keyed by intent. */
  paths: Record<SeoIntent, string>;
}

/** A brand hub grouping all of its model spokes. */
export interface SeoBrandRecord {
  brandLabel: string;
  brandSlug: string;
  /** Canonical brand hub path, e.g. "/tools/samsung". */
  path: string;
  models: SeoModelRecord[];
}

/** `generateStaticParams` shape for the brand hub route. */
export interface SeoBrandParam {
  brand: string;
}

/** `generateStaticParams` shape for the model spoke route. */
export interface SeoModelParam {
  brand: string;
  model: string;
}

/**
 * Deterministic URL slug. Lowercases, converts `&` to "and", strips
 * punctuation and collapses whitespace into single hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip a leading brand token from a full model label (case-insensitive). */
function stripBrandPrefix(fullModel: string, brandLabel: string): string {
  const trimmed = fullModel.trim();
  const prefix = `${brandLabel} `;
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    const stripped = trimmed.slice(prefix.length).trim();
    return stripped.length > 0 ? stripped : trimmed;
  }
  return trimmed;
}

/** Build the canonical spoke path for a brand/model/intent triple. */
export function modelIntentPath(
  brandSlug: string,
  modelSlug: string,
  intent: SeoIntent,
): string {
  return `${TOOLS_BASE_PATH}/${brandSlug}/${modelSlug}-${intent}`;
}

/** Build the canonical brand hub path. */
export function brandHubPath(brandSlug: string): string {
  return `${TOOLS_BASE_PATH}/${brandSlug}`;
}

/**
 * Derive the full model matrix from the shared registry. Models whose brand
 * cannot be inferred are excluded — they cannot be marketed or routed.
 */
function buildMatrix(): SeoModelRecord[] {
  const records: SeoModelRecord[] = [];

  for (const fullModelLabel of KNOWN_MODELS) {
    const entry = toCatalogEntry(fullModelLabel);
    const brandLabel = entry.brand;
    if (!brandLabel || brandLabel === "Unknown") continue;

    const modelLabel = stripBrandPrefix(fullModelLabel, brandLabel);
    const brandSlug = slugify(brandLabel);
    const modelSlug = slugify(modelLabel) || slugify(fullModelLabel);
    if (!brandSlug || !modelSlug) continue;

    const paths = SEO_INTENTS.reduce(
      (acc, intent) => {
        acc[intent] = modelIntentPath(brandSlug, modelSlug, intent);
        return acc;
      },
      {} as Record<SeoIntent, string>,
    );

    records.push({
      fullModelLabel,
      modelLabel,
      modelSlug,
      brandLabel,
      brandSlug,
      chipset: entry.chipset,
      manualMode: entry.manualMode,
      keyCombo: entry.keyCombo,
      intents: SEO_INTENTS,
      brandPath: brandHubPath(brandSlug),
      paths,
    });
  }

  return records;
}

/** Flat, intent-expanded matrix of every model spoke. */
export const SEO_MODELS: readonly SeoModelRecord[] = buildMatrix();

/** Brand hubs, preserving first-appearance order from the shared registry. */
export const SEO_BRANDS: readonly SeoBrandRecord[] = (() => {
  const bySlug = new Map<string, SeoBrandRecord>();
  for (const model of SEO_MODELS) {
    const existing = bySlug.get(model.brandSlug);
    if (existing) {
      existing.models.push(model);
      continue;
    }
    bySlug.set(model.brandSlug, {
      brandLabel: model.brandLabel,
      brandSlug: model.brandSlug,
      path: model.brandPath,
      models: [model],
    });
  }
  return Array.from(bySlug.values());
})();

/** `generateStaticParams` payload for `/tools/[brand]`. */
export const SEO_BRAND_PARAMS: readonly SeoBrandParam[] = SEO_BRANDS.map(
  (brand) => ({ brand: brand.brandSlug }),
);

/**
 * `generateStaticParams` payload for `/tools/[brand]/[model]`.
 * The `model` segment already carries the intent suffix.
 */
export const SEO_MODEL_PARAMS: readonly SeoModelParam[] = SEO_MODELS.flatMap(
  (model) =>
    model.intents.map((intent) => ({
      brand: model.brandSlug,
      model: `${model.modelSlug}-${intent}`,
    })),
);

/** Total number of statically-generated spoke URLs. */
export const SEO_SPOKE_COUNT = SEO_MODEL_PARAMS.length;

/** Resolve a brand hub by slug. */
export function getBrandHub(brandSlug: string): SeoBrandRecord | undefined {
  return SEO_BRANDS.find((brand) => brand.brandSlug === brandSlug);
}

/** Resolve a model spoke by brand slug + full `[model]` segment. */
export function getModelSpoke(
  brandSlug: string,
  modelSegment: string,
): SeoModelRecord | undefined {
  return SEO_MODELS.find(
    (model) =>
      model.brandSlug === brandSlug &&
      model.intents.some(
        (intent) => `${model.modelSlug}-${intent}` === modelSegment,
      ),
  );
}

/** All sibling spokes for a model (same brand, excluding itself). */
export function siblingModels(record: SeoModelRecord): SeoModelRecord[] {
  return SEO_MODELS.filter(
    (candidate) =>
      candidate.brandSlug === record.brandSlug &&
      candidate.modelSlug !== record.modelSlug,
  );
}
