// FRPB — pricing route metadata.
// `page.tsx` is a client component (it starts checkout), so its SEO metadata
// lives here in the server-rendered segment layout instead.

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing — FRP Bypass & Device Recovery Plans",
  description:
    "Simple FRPB pricing for the FRP bypass and flash reset tool. Monthly, yearly and lifetime licenses — every plan unlocks the complete FRPB device recovery toolkit.",
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
