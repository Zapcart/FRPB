// FRPB — /tools/frp-bypass pillar hub (Hub & Spoke, commercial top).
//
// The FRP (Google lock) removal pillar. Renders the shared <PillarHubPage>
// with a keyword-targeted spoke set: OEM brand hubs, high-demand model guides
// (Samsung / Xiaomi / Vivo / Motorola …), the reset troubleshooting guides and
// the free utility cluster. Emits SoftwareApplication + FAQPage + HowTo +
// BreadcrumbList JSON-LD via the shared view.
//
// Static server component; `dynamicParams` is irrelevant here because the route
// is static and deterministically shadows `/tools/[brand]` for `frp-bypass`.

import type { Metadata } from "next";

import PillarHubPage, { type PillarSection } from "@/components/tools/pillar-hub-page";
import { getPillarHub } from "@/data/pillar-hubs";
import {
  allBrandLinks,
  featuredModelLinks,
  utilityLinks,
  type SeoLink,
} from "@/data/seo-clusters";
import { troubleshootingLinks } from "@/data/troubleshooting-content";
import { pageMetadata } from "@/lib/seo";

const content = getPillarHub("frp-bypass");

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords,
});

/** Cross-links to the sibling pillar hubs (spoke graph breadth). */
const siblingHubs: SeoLink[] = [
  {
    path: "/tools/phone-unlock",
    anchor: "Phone Unlock Tools Hub",
    blurb: "Screen unlock, factory reset and recovery guides for every Android OEM.",
  },
  {
    path: "/tools/icloud-bypass",
    anchor: "iCloud Activation Lock Hub",
    blurb: "Owner-only iPhone & iPad Activation Lock removal for iOS 17 and iOS 18.",
  },
];

const sections: PillarSection[] = [
  {
    id: "brands",
    heading: "FRP bypass by brand",
    intro: "Pick your phone maker for a model-by-model FRP bypass guide.",
    links: allBrandLinks(),
    columns: 3,
    cta: "Open brand hub",
  },
  {
    id: "models",
    heading: "Popular device FRP guides",
    intro: "High-demand handsets, each with an exact-match FRP bypass walkthrough.",
    links: featuredModelLinks("frp-bypass", 12),
    columns: 3,
    cta: "Open device guide",
  },
  {
    id: "troubleshooting",
    heading: "Reset & troubleshooting guides",
    intro: "Factory reset and lock-recovery walkthroughs that pair with the FRP bypass tool.",
    links: troubleshootingLinks(),
    columns: 2,
    cta: "Read the guide",
  },
  {
    id: "utilities",
    heading: "Free device utility tools",
    intro: "Location spoofing, data erasing, phone transfer and WhatsApp transfer — included.",
    links: utilityLinks(),
    columns: 2,
    cta: "Open tool",
  },
  {
    id: "related",
    heading: "More FRPB hubs",
    links: siblingHubs,
    columns: 2,
    cta: "Open hub",
  },
];

export default function FrpBypassHubPage() {
  return <PillarHubPage content={content} sections={sections} />;
}
