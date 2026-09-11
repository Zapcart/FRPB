// FRPB — root layout
// Uses Inter via next/font; light-mode SaaS theme (tailwind config tokens).
// Internal app pages (e.g. /dashboard) paint their own opaque surfaces on top.
// SessionProvider keeps client + server session state in sync (blueprint fix 4).

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "FRPB — Device Recovery & Utility Suite",
    template: "%s · FRPB",
  },
  description:
    "Recover, unlock and manage your mobile devices. FRPB brings recovery mode tools, driver center and step-by-step guides into one desktop app.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://frpb.in"
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "FRPB",
    title: "FRPB — Device Recovery & Utility Suite",
    description:
      "Recover, unlock and manage your mobile devices. FRPB brings recovery mode tools, driver center and step-by-step guides into one desktop app.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "FRPB — Mobile Unlock System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FRPB — Device Recovery & Utility Suite",
    description:
      "Recover, unlock and manage your mobile devices. FRPB brings recovery mode tools, driver center and step-by-step guides into one desktop app.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
