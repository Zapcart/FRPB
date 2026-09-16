// FRPB — root layout
// Uses Inter via next/font; light-mode SaaS theme (tailwind config tokens).
// Internal app pages (e.g. /dashboard) paint their own opaque surfaces on top.
// SessionProvider keeps client + server session state in sync (blueprint fix 4).
// Global metadata carries the canonical origin, OG/Twitter cards and robots
// directives; per-route copy lives in each page's `metadata` export.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "@/components/session-provider";
import { PostHogProvider } from "./providers";
import JsonLd from "@/components/seo/json-ld";
import {
  SITE_URL,
  SITE_NAME,
  PRODUCT_DESCRIPTION,
  PRIMARY_TITLE,
  PRIMARY_KEYWORDS,
} from "@/lib/seo";
import { softwareApplicationSchema } from "@/lib/schema";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "FRPB — FRP Bypass & Device Recovery Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PRIMARY_TITLE,
    description: PRODUCT_DESCRIPTION,
    images: ["/logo.png"],
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
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  // Third-party site-ownership verification tags.
  //
  // `verification.other` is rendered by Next.js into <head> as
  //   <meta name="<key>" content="<value>" />
  // so this emits exactly: <meta name="monetag" content="a262f070..." />
  // Using the Metadata API (rather than a raw <meta> in the JSX) guarantees it
  // is hoisted into <head> on every route, including the statically generated
  // marketing pages.
  verification: {
    other: {
      monetag: "a262f070adebeef495eec6ef5c52af34",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        {/*
          Monetag In-Page Push (zone 11816708).

          `strategy="afterInteractive"` is deliberate and load-bearing here:
          next/script defers execution until AFTER hydration, so the third-party
          tag cannot run during hydration and cause a DOM mismatch. It also
          never blocks client-side navigation.

          Placed as a direct child of <body> — outside the provider tree — so it
          is not tied to any client component's lifecycle and stays mounted
          across App Router navigations.

          NOTE: this tag is served to EVERY route, including the authenticated
          /dashboard and /admin surfaces. In-page push advertising on a paid
          product's own dashboard is usually undesirable — if that is not
          intended, move this <Script> into the marketing pages (or gate it on
          the pathname) rather than the root layout.
        */}
        <Script
          id="monetag-inpage-push"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='11816708',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));`,
          }}
        />
        <PostHogProvider>
          <SessionProvider>{children}</SessionProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
