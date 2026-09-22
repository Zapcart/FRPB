// FRPB — /vivo-oppo-realme-frp programmatic landing page.
// Thin route: metadata + JSON-LD come from the shared brand page machinery.

import type { Metadata } from "next";
import BrandLandingPage from "@/components/brand-landing-page";
import { BRAND_PAGES } from "@/config/brand-pages";
import { pageMetadata } from "@/lib/seo";

const content = BRAND_PAGES.vivoOppoRealme;

export const metadata: Metadata = pageMetadata({
  title: content.title,
  description: content.description,
  path: content.path,
  keywords: content.keywords,
});

export default function VivoOppoRealmeFrpPage() {
  return <BrandLandingPage content={content} />;
}
