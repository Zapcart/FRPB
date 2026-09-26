// FRPB — /whatsapp-transfer-tool (programmatic SEO free-utility route).
import type { Metadata } from "next";
import FreeToolLandingPage from "@/components/free-tool-landing-page";
import { pageMetadata } from "@/lib/seo";
import { FREE_TOOLS } from "@frpb/shared";

const content = FREE_TOOLS["whatsapp-transfer"];

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords.split(",").map((keyword) => keyword.trim()),
});

export default function WhatsappTransferToolPage() {
  return <FreeToolLandingPage content={content} />;
}
