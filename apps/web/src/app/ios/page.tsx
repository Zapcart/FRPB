// FRPB — /ios hub (iOS Activation Lock & iCloud removal learn hub).
//
// Honest, owner-focused SEO hub for iPhone & iPad. FRPB is an Android FRP
// toolkit and has no iOS capability, so this hub routes visitors to Apple's
// official removal paths and the authoritative FRPB iOS blog guides instead of
// claiming any bypass. The heavy lifting lives in <IosLandingPage>.
//
// Statically generated; the root layout title template appends " | FRPB", so the
// metadata title is the bare SERP title (no brand suffix here).

import type { Metadata } from "next";

import IosLandingPage from "@/components/ios-landing-page";
import { IOS_HUB, IOS_HUB_PATH, iosHubLinks } from "@/data/ios-content";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: IOS_HUB.title,
    description: IOS_HUB.description,
    path: IOS_HUB_PATH,
    keywords: [...IOS_HUB.keywords],
  });
}

export default function IosHubPage() {
  return <IosLandingPage content={IOS_HUB} relatedLinks={iosHubLinks()} />;
}
