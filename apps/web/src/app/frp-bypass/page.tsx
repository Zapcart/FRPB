import type { Metadata } from "next";
import UnlockLandingPage from "@/components/unlock-landing-page";
import { pageMetadata } from "@/lib/seo";
import { UNLOCK_TOOLS } from "@frpb/shared";

const content = UNLOCK_TOOLS["frp-bypass"];

// CTR-optimised title (TASK 16): keyword-first with an explicit "| FRPB" brand
// suffix, so it is emitted verbatim via `absoluteTitle` — this skips the root
// layout’s "%s | FRPB" template and avoids duplicating the brand token.
export const metadata: Metadata = pageMetadata({
  title: "FRP Bypass Tool 2026 - One-Click Android Unlock | FRPB",
  description: content.description,
  path: content.path,
  keywords: content.keywords,
  absoluteTitle: true,
});

export default function FrpBypassPage() {
  return <UnlockLandingPage content={content} />;
}
