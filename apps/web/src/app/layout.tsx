// FRPB — root layout
// Uses Inter via next/font; light-mode SaaS theme (tailwind config tokens).
// Internal app pages (e.g. /dashboard) paint their own opaque surfaces on top.
// SessionProvider keeps client + server session state in sync (blueprint fix 4).
// Global metadata carries the canonical origin, OG/Twitter cards and robots
// directives; per-route copy lives in each page's `metadata` export.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import FloatingWidgets from "@/components/floating-widgets";
import PageViewTracker from "@/components/analytics/page-view-tracker";
import ReferralCapture from "@/components/referral/ReferralCapture";
import { PostHogProvider } from "./providers";
import {
  SITE_URL,
  SITE_NAME,
  PRODUCT_DESCRIPTION,
  PRIMARY_TITLE,
  PRIMARY_KEYWORDS,
  OG_IMAGE_PATH,
  OG_IMAGE_ALT,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from "@/lib/seo";
import "./globals.css";

// `display: "swap"` renders the fallback font immediately and swaps in Inter
// once loaded — eliminates the render-blocking font request on mobile and the
// invisible-text (FOIT) window that hurts LCP.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: PRIMARY_TITLE,
    template: "%s | FRPB",
  },
  description: PRODUCT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: PRIMARY_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  // Canonical for the marketing root — every other route overrides this.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE_NAME,
    title: PRIMARY_TITLE,
    description: PRODUCT_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PRIMARY_TITLE,
    description: PRODUCT_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: OG_IMAGE_PATH, type: "image/png" }],
    apple: [{ url: OG_IMAGE_PATH, sizes: "180x180", type: "image/png" }],
  },
  // No third-party ad-network or site-verification tags are emitted. All such
  // entries were removed by request, so the layout ships zero ad-network
  // references of any kind.
};

// ISR default for the crawlable marketing surface (home, blog, tools, brand and
// free-tool routes). These pages are pure static content, so a 1-hour window
// keeps the Chromium-visible HTML identical to the sitemap/canonical URLs and
// lets copy edits propagate without a full redeploy. Routes that genuinely need
// per-request rendering (auth, checkout, dashboard, admin, API) already declare
// `export const dynamic = "force-dynamic"` and opt out of this default.
export const revalidate = 3600;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        <PostHogProvider>
          <SessionProvider>{children}</SessionProvider>
          {/* Captures a ?ref= referral code from ANY landing route and persists
              it (cookie + localStorage) for the later checkout. Renders null. */}
          <ReferralCapture />
          {/* First-party page-view beacon → admin "VISITORS (30D)" metric. */}
          <PageViewTracker />
          {/* Site-wide floating widgets (bottom-right), both code-split with
              next/dynamic `{ ssr: false }` inside FloatingWidgets so they stay
              out of the primary hydration bundle and never block first
              interaction on low-end mobile CPUs. The support assistant sits
              above the community widget (bottom-28 vs bottom-5) so the two
              never overlap. */}
          <FloatingWidgets />
        </PostHogProvider>
      </body>
    </html>
  );
}
