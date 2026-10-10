// FRPB — native Next.js sitemap route (served at /sitemap.xml).
// Replaces the static public/sitemap.xml. Only public, indexable pages are
// listed; admin, dashboard, auth and checkout routes are intentionally omitted.

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog";
import { BRAND_PAGE_ROUTES } from "@/config/brand-pages";
import {
  SEO_BRAND_PARAMS,
  SEO_MODEL_PARAMS,
  TOOLS_BASE_PATH,
} from "@/data/seo-matrix";
import { FREE_TOOL_ROUTES, UNLOCK_TOOL_ROUTES } from "@frpb/shared";
import { IOS_HUB_PATH, IOS_SPOKE_PATHS } from "@/data/ios-content";

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
      url: `${SITE_URL}${TOOLS_BASE_PATH}`,
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

  // Free utility lead-magnet landing pages (WhatsApp Transfer, Phone Transfer,
  // Data Eraser, Virtual Location). High-volume informational queries that feed
  // the install funnel, so they are listed alongside the brand pages.
  const freeToolPages: MetadataRoute.Sitemap = FREE_TOOL_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // High-intent unlock / system-mode landing pages (Flash Reset, FRP Bypass,
  // Screen Unlock, Reboot Mode, iCloud Bypass, Samsung Account, Bootloop
  // Recovery, Data Recovery). Commercial-intent queries, so they share the
  // /downloads priority and are expected to change weekly.
  const unlockToolPages: MetadataRoute.Sitemap = UNLOCK_TOOL_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Programmatic device-cluster hubs (`/tools/[brand]`). One per OEM brand,
  // each linking every supported model spoke. They sit one tier below the
  // /tools index, so they list weekly at 0.7.
  const brandHubPages: MetadataRoute.Sitemap = SEO_BRAND_PARAMS.map((param) => ({
    url: `${SITE_URL}${TOOLS_BASE_PATH}/${param.brand}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Programmatic model spokes (`/tools/[brand]/[model]`). The long-tail rank
  // engine — one page per device-model × intent pair. Higher churn than the
  // static pages, so they list monthly at 0.6 and avoid cannibalising hubs.
  const modelSpokePages: MetadataRoute.Sitemap = SEO_MODEL_PARAMS.map((param) => ({
    url: `${SITE_URL}${TOOLS_BASE_PATH}/${param.brand}/${param.model}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // iOS (iPhone & iPad) learn cluster: the `/ios` hub plus its owner-focused
  // spokes. These are informational, Apple-official removal guides — not a
  // device matrix — so they list monthly at 0.6 alongside the model spokes.
  const iosPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}${IOS_HUB_PATH}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...IOS_SPOKE_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

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
  return [
    ...pages,
    ...brandPages,
    ...freeToolPages,
    ...unlockToolPages,
    ...brandHubPages,
    ...modelSpokePages,
    ...iosPages,
    ...posts,
  ];
}
