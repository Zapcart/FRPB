import type { Metadata } from "next";
import UnlockLandingPage from "@/components/unlock-landing-page";
import { pageMetadata } from "@/lib/seo";
import { iosLinks } from "@/data/seo-clusters";
import { UNLOCK_TOOLS } from "@frpb/shared";

const base = UNLOCK_TOOLS["icloud-bypass"];

/**
 * iOS cross-links: the honest `/ios` learn hub + its spokes. The default
 * `related` set is Android-focused, so this appends the owner-focused Apple
 * guides — keeping high-intent "icloud" queries on-site and routing them to the
 * legitimate removal paths instead of bouncing to a competitor.
 */
const content = {
  ...base,
  related: [...base.related, ...iosLinks()],
};

export const metadata: Metadata = pageMetadata({
  title: base.title,
  description: base.description,
  path: base.path,
  keywords: base.keywords,
});

export default function IcloudBypassPage() {
  return <UnlockLandingPage content={content} />;
}
