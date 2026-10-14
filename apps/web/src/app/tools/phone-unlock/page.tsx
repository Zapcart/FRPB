// FRPB — /tools/phone-unlock pillar hub (Hub & Spoke, Android unlock pillar).
//
// The Android unlock / reset pillar. Renders the shared <PillarHubPage> with
// the troubleshooting spokes (Redmi reset, factory reset without password),
// OEM brand hubs, screen-lock removal model guides and the utility cluster —
// all fed by the same typed selectors the brand and model spokes use.
//
// Static server component; deterministically shadows `/tools/[brand]` for
// `phone-unlock`, and hosts the `[topic]` troubleshooting spokes beneath it.

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

const content = getPillarHub("phone-unlock");

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords,
});

/** Cross-links to the sibling pillar hubs (spoke graph breadth). */
const siblingHubs: SeoLink[] = [
  {
    path: "/tools/frp-bypass",
    anchor: "FRP Bypass Hub",
    blurb: "Remove the Google FRP lock on an Android phone you own over USB.",
  },
  {
    path: "/tools/icloud-bypass",
    anchor: "iCloud Activation Lock Hub",
    blurb: "Owner-only iPhone & iPad Activation Lock removal for iOS 17 and iOS 18.",
  },
];

const sections: PillarSection[] = [
  {
    id: "guides",
    heading: "Reset & unlock guides",
    intro: "Step-by-step walkthroughs for resetting and unlocking an Android phone you own.",
    links: troubleshootingLinks(),
    columns: 2,
    cta: "Read the guide",
  },
  {
    id: "brands",
    heading: "Unlock tools by brand",
    intro: "Pick your phone maker for a model-by-model unlock and reset guide.",
    links: allBrandLinks(),
    columns: 3,
    cta: "Open brand hub",
  },
  {
    id: "models",
    heading: "Popular screen-lock removal guides",
    intro: "High-demand handsets with an exact-match screen unlock walkthrough.",
    links: featuredModelLinks("lock-removal", 12),
    columns: 3,
    cta: "Open device guide",
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

export default function PhoneUnlockHubPage() {
  return <PillarHubPage content={content} sections={sections} />;
}
