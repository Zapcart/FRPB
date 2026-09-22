// FRPB — native Next.js sitemap route (served at /sitemap.xml).
// Replaces the static public/sitemap.xml. Only public, indexable pages are
// listed; admin, dashboard, auth and checkout routes are intentionally omitted.

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog";
import { BRAND_PAGE_ROUTES } from "@/config/brand-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/downloads`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/eula`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/refund`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Programmatic brand-specific landing pages (Samsung, Xiaomi MIUI/HyperOS,
  // Vivo/Oppo/Realme, Qualcomm EDL). High-intent long-tail targets, so they
  // share the /downloads priority and are expected to change weekly.
  const brandPages: MetadataRoute.Sitemap = BRAND_PAGE_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const posts: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.dateModified),
    changeFrequency: "monthly",
    // Model-specific guides target high-intent long-tail queries, so they rank
    // slightly above the general index.
    priority: 0.7,
  }));

  // NOTE: the `?category=` blog filter views are intentionally NOT listed. Each
  // of them canonicalises to `/blog` (see the blog index metadata), so listing
  // them would only submit duplicate, non-canonical URLs. Keeping the sitemap
  // canonical-only concentrates crawl budget on URLs Google can actually index.
  return [...pages, ...brandPages, ...posts];
}
