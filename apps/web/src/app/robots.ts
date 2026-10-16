import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Generative Engine Optimization (GEO / AIO).
 *
 * The private application surfaces below stay disallowed for everyone. Every
 * other path is explicitly opened to the major Generative-AI / answer-engine
 * crawlers so FRPB can be retrieved, cited and summarised by tools like
 * ChatGPT, Perplexity, Google AI Overviews, Claude and Bing Chat. `*` remains
 * as the catch-all for conventional search engines.
 *
 * Each named agent inherits the same crawlable public surface, kept in sync
 * with the wildcard rule so behaviour is identical regardless of which
 * AI crawler fetches the site.
 */
const DISALLOWED_PATHS = [
  "/admin",
  "/dashboard",
  "/api/",
  "/auth",
  "/login",
  "/register",
  "/checkout",
];

/** Major Generative-AI / LLM crawler user-agents to admit explicitly. */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI / ChatGPT training + retrieval
  "ChatGPT-User", // ChatGPT live browsing
  "OAI-SearchBot", // OpenAI SearchGPT
  "PerplexityBot", // Perplexity AI
  "Google-Extended", // Google Gemini / AI Overviews grounding
  "ClaudeBot", // Anthropic Claude
  "anthropic-ai", // Anthropic legacy agent
  "CCBot", // Common Crawl (feeds many LLMs)
  "Bytespider", // ByteDance / TikTok AI
  "Applebot-Extended", // Apple Intelligence
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Catch-all for conventional search engines.
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      // Explicit allow rules for Generative-AI crawlers (GEO/AIO).
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
