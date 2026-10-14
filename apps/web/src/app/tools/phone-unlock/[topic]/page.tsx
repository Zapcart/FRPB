// FRPB — Android troubleshooting spoke route (`/tools/phone-unlock/[topic]`).
//
// Statically generated how-to guides under the Phone Unlock pillar hub. Each
// spoke renders a unique <title> + meta description + canonical (via
// `pageMetadata`) and the full HowTo / FAQPage / SoftwareApplication JSON-LD
// through `<GuideLandingPage>`. Unknown segments 404 (no thin/duplicate pages).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideLandingPage from "@/components/guide-landing-page";
import { pageMetadata } from "@/lib/seo";
import {
  TROUBLESHOOTING_GUIDES,
  TROUBLESHOOTING_GUIDE_IDS,
  type TroubleshootingId,
} from "@/data/troubleshooting-content";

export const dynamicParams = false;

export function generateStaticParams(): { topic: string }[] {
  return TROUBLESHOOTING_GUIDE_IDS.map((topic) => ({ topic }));
}

export function generateMetadata({
  params,
}: {
  params: { topic: string };
}): Metadata {
  const content = TROUBLESHOOTING_GUIDES[params.topic as TroubleshootingId];
  if (!content) {
    return pageMetadata({
      title: "Guide not found",
      description: "This troubleshooting guide is not available.",
      path: "/tools/phone-unlock",
    });
  }
  return pageMetadata({
    title: content.title,
    description: content.description,
    path: content.path,
    keywords: content.keywords,
  });
}

export default function PhoneUnlockGuidePage({
  params,
}: {
  params: { topic: string };
}) {
  const content = TROUBLESHOOTING_GUIDES[params.topic as TroubleshootingId];
  if (!content) notFound();
  return <GuideLandingPage content={content} />;
}
