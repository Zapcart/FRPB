// FRPB — native Next.js robots route (served at /robots.txt).
// Replaces the static public/robots.txt. Public marketing and legal pages are
// crawlable; authenticated/private surfaces and the API are blocked so they
// never dilute the index.

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/api/",
          "/auth",
          "/login",
          "/register",
          "/checkout",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
