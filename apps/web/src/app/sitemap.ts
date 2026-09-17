// FRPB — native Next.js sitemap route (served at /sitemap.xml).
// Replaces the static public/sitemap.xml. Only public, indexable pages are
// listed; admin, dashboard, auth and checkout routes are intentionally omitted.

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BLOG_CATEGORY_TABS, BLOG_POSTS } from "@/lib/blog";

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

  // Category-filtered index views are indexable landing pages in their own
  // right for broad queries ("iPhone iCloud lock guides"), so they are listed
  // alongside the articles.
  const categoryPages: MetadataRoute.Sitemap = BLOG_CATEGORY_TABS.filter(
    (tab) => tab.id !== "all"
  ).map((tab) => ({
    url: `${SITE_URL}/blog?category=${tab.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const posts: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.dateModified),
    changeFrequency: "monthly",
    // Model-specific guides target high-intent long-tail queries, so they rank
    // slightly above the general index.
    priority: 0.7,
  }));

  return [...pages, ...categoryPages, ...posts];
}
