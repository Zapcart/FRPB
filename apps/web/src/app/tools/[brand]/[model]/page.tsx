// FRPB — /tools/[brand]/[model] model spoke (programmatic SEO).
//
// One statically-generated page per device-model × intent pair, e.g.
// `/tools/samsung/galaxy-a12-frp-bypass`. The `[model]` segment already carries
// the intent suffix (see `SEO_MODEL_PARAMS`), so a single dynamic segment covers
// both the FRP-bypass and lock-removal search intents.
//
// Route conventions (Next.js 14 App Router — params are synchronous):
//   - `generateStaticParams` pre-renders every spoke at build time.
//   - `dynamicParams = false` caps the URL space to the known matrix (no thin
//     404-spam pages for arbitrary segments).
//   - `notFound()` guards unknown segments (also covers a brand/model mismatch).
//
// Server component only — the heavy lifting lives in <ModelLandingPage>.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ModelLandingPage from "@/components/model-landing-page";
import { SEO_MODEL_PARAMS } from "@/data/seo-matrix";
import {
  buildModelContent,
  modelKeywords,
  modelMetaDescription,
  modelMetaTitle,
  parseModelSlug,
} from "@/lib/seo-matrix";
import { pageMetadata } from "@/lib/seo";

interface ModelSpokePageProps {
  params: { brand: string; model: string };
}

/** Only the pre-rendered matrix spokes are valid — everything else 404s. */
export const dynamicParams = false;

/** Pre-render one URL per device-model × intent pair. */
export function generateStaticParams(): { brand: string; model: string }[] {
  return SEO_MODEL_PARAMS.map((param) => ({
    brand: param.brand,
    model: param.model,
  }));
}

/**
 * Route metadata. The root layout title template appends " | FRPB", so the
 * generator returns the bare SERP title (intent-matched to the query).
 */
export function generateMetadata({ params }: ModelSpokePageProps): Metadata {
  const parsed = parseModelSlug(params.brand, params.model);
  if (!parsed) {
    return pageMetadata({
      title: "Model not found",
      description:
        "This FRPB device-model guide does not exist. Browse the full FRPB device matrix for Samsung, Xiaomi, Vivo, Realme, Oppo, OnePlus, Tecno, Infinix, Huawei, Motorola, Google and Nothing.",
      path: `/tools/${params.brand}/${params.model}`,
    });
  }

  const { record, intent } = parsed;
  return pageMetadata({
    title: modelMetaTitle(record, intent),
    description: modelMetaDescription(record, intent),
    path: record.paths[intent],
    keywords: modelKeywords(record, intent),
  });
}

export default function ModelSpokePage({ params }: ModelSpokePageProps) {
  const parsed = parseModelSlug(params.brand, params.model);
  if (!parsed) notFound();

  const { record, intent } = parsed;
  return (
    <ModelLandingPage
      content={buildModelContent(record, intent)}
      record={record}
      intent={intent}
    />
  );
}
