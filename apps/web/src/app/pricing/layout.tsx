// FRPB — pricing route metadata.
// `page.tsx` is a client component (it starts checkout), so its SEO metadata
// lives here in the server-rendered segment layout instead.

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  // Keyword-first + year-qualified; 50 chars before the "| FRPB" template so the
  // price hook is never truncated in the SERP.
  title: "FRP Bypass Tool Pricing (2026) — Plans from $20",
  description:
    "FRP bypass tool pricing for 2026: 60-day and lifetime licenses with instant activation and a 7-day money-back guarantee. All plans are charged in USD.",
  path: "/pricing",
  keywords: [
    "frp bypass tool price",
    "samsung frp tool license",
    "flash reset app pricing",
    "frp lock removal software",
  ],
});

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
