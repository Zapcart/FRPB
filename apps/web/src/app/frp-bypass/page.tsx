import type { Metadata } from "next";
import UnlockLandingPage from "@/components/unlock-landing-page";
import { pageMetadata } from "@/lib/seo";
import { UNLOCK_TOOLS } from "@frpb/shared";

const content = UNLOCK_TOOLS["frp-bypass"];

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords,
});

export default function FrpBypassPage() {
  return <UnlockLandingPage content={content} />;
}
