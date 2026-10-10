// FRPB — /ios/[topic] spoke (iOS Activation Lock & iCloud removal learn hub).
//
// One statically-generated page per iOS topic, e.g.
// `/ios/ipad-activation-lock-removal`. Mirrors the `/tools/[brand]/[model]`
// programmatic-SEO conventions:
//   - `generateStaticParams` pre-renders every spoke at build time.
//   - `dynamicParams = false` caps the URL space to the known topic list (no
//     thin 404-spam pages for arbitrary segments).
//   - `notFound()` guards unknown segments.
//
// Server component only — the view lives in <IosLandingPage>.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import IosLandingPage from "@/components/ios-landing-page";
import {
  IOS_HUB_PATH,
  IOS_SPOKE_PARAMS,
  getIosSpoke,
  iosHubLinks,
} from "@/data/ios-content";
import { pageMetadata } from "@/lib/seo";

interface IosSpokePageProps {
  params: { topic: string };
}

/** Only the pre-rendered iOS spokes are valid — everything else 404s. */
export const dynamicParams = false;

/** Pre-render one URL per iOS topic. */
export function generateStaticParams(): { topic: string }[] {
  return IOS_SPOKE_PARAMS.map((param) => ({ topic: param.topic }));
}

/**
 * Route metadata. The root layout title template appends " | FRPB", so the
 * generator returns the bare SERP title (topic-matched to the query).
 */
export function generateMetadata({ params }: IosSpokePageProps): Metadata {
  const spoke = getIosSpoke(params.topic);
  if (!spoke) {
    return pageMetadata({
      title: "iOS topic not found",
      description:
        "This FRPB iOS guide does not exist. Browse the FRPB iOS hub for owner-focused iPhone and iPad Activation Lock and iCloud removal guidance.",
      path: `${IOS_HUB_PATH}/${params.topic}`,
    });
  }

  return pageMetadata({
    title: spoke.title,
    description: spoke.description,
    path: spoke.path,
    keywords: [...spoke.keywords],
  });
}

export default function IosSpokePage({ params }: IosSpokePageProps) {
  const spoke = getIosSpoke(params.topic);
  if (!spoke) notFound();

  return (
    <IosLandingPage
      content={spoke}
      relatedLinks={iosHubLinks(spoke.path)}
      guideSlugs={spoke.guideSlugs}
    />
  );
}
