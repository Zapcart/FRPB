// FRPB — /tools/icloud-bypass pillar hub (Hub & Spoke, iOS pillar).
//
// The iOS Activation Lock pillar. FRPB is an Android toolkit with no iOS
// capability, so this hub is deliberately honest: it routes visitors to the
// owner-only `/ios` learn hub and its authoritative guides, then cross-links
// back to the Android pillars and utility tools. Emits the full JSON-LD set via
// the shared <PillarHubPage>.
//
// Static server component; deterministically shadows `/tools/[brand]` for
// `icloud-bypass`.

import type { Metadata } from "next";

import PillarHubPage, { type PillarSection } from "@/components/tools/pillar-hub-page";
import { getPillarHub } from "@/data/pillar-hubs";
import { iosLinks, utilityLinks, type SeoLink } from "@/data/seo-clusters";
import { pageMetadata } from "@/lib/seo";

const content = getPillarHub("icloud-bypass");

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords,
});

/** Cross-links to the Android pillar hubs (keeps high-intent traffic on-site). */
const androidHubs: SeoLink[] = [
  {
    path: "/tools/frp-bypass",
    anchor: "FRP Bypass Hub",
    blurb: "Remove the Google FRP lock on an Android phone you own over USB.",
  },
  {
    path: "/tools/phone-unlock",
    anchor: "Phone Unlock Tools Hub",
    blurb: "Screen unlock, factory reset and recovery guides for every Android OEM.",
  },
];

const sections: PillarSection[] = [
  {
    id: "ios",
    heading: "iPhone & iPad Activation Lock guides",
    intro: "Owner-only paths for iCloud Activation Lock, the Apple ID and the \"iPhone is not activated\" screen.",
    links: iosLinks(),
    columns: 2,
    cta: "Open guide",
  },
  {
    id: "android-hubs",
    heading: "Android FRP & unlock hubs",
    intro: "FRPB is an Android FRP toolkit — jump to the Android pillar for the tool itself.",
    links: androidHubs,
    columns: 2,
    cta: "Open hub",
  },
  {
    id: "utilities",
    heading: "Free device utility tools",
    intro: "Location spoofing, data erasing, phone transfer and WhatsApp transfer — included.",
    links: utilityLinks(),
    columns: 2,
    cta: "Open tool",
  },
];

export default function IcloudBypassHubPage() {
  return <PillarHubPage content={content} sections={sections} />;
}
