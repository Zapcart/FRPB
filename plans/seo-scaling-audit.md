# FRPB — SEO Scaling Architecture Audit Report

**Date:** 2026-10-03
**Author:** Lead SEO Architect / Full-Stack Next.js Engineer
**Scope:** Programmatic SEO expansion for `/tools/*` device cluster + utility cross-linking
**Build:** `corepack pnpm --filter @frpb/web exec next build` → **Exit code 0**

---

## 1. Executive Summary

The SEO Scaling Architecture is **implemented, type-safe, and production-built**. The build
generated **214 static pages** with **zero TypeScript errors** and **no bundle regression**
(shared First Load JS unchanged at 87.5 kB).

The release adds a three-tier keyword-targeted page cluster:

| Tier | Route | Rendering | Pages |
|------|-------|-----------|-------|
| Index | `/tools` | Static (○) | 1 |
| Brand hub | `/tools/[brand]` | SSG (●) | 20 |
| Model spoke | `/tools/[brand]/[model]` | SSG (●) | 114 |

Every spoke targets a distinct `[brand] + [model] + [intent]` query surface, with a
`SoftwareApplication` + `FAQPage` + `BreadcrumbList` (+ `HowTo` on spokes) schema stack and
exact-match internal anchors — the on-page foundation for Position #1–#3 rankings.

---

## 2. Keyword Coverage Map

| Keyword class | Example targets | Landing surface |
|---------------|-----------------|-----------------|
| Core / brand | `frp bypass tool`, `frp tool`, `frpb`, `android lock removal tool` | `/`, `/tools` |
| Device × intent | `samsung galaxy s24 frp bypass`, `xiaomi redmi note 13 lock removal` | `/tools/[brand]/[model]` |
| OEM hub | `samsung frp tool`, `xiaomi lock removal tool` | `/tools/[brand]` |
| Utility | `virtual location`, `data eraser`, `phone transfer`, `whatsapp transfer` | existing utility canonicals |

**Coverage math:** 20 brands × curated models × 2 intents (`frp-bypass`, `lock-removal`)
= **114 indexable spokes** + **20 hubs** + **1 index** = **135 new SEO surfaces**.

---

## 3. Architecture Delivered

### 3.1 Data layer (pure, no I/O)
- **`apps/web/src/data/seo-matrix.ts`** — derives a typed, brand-grouped device matrix from the
  canonical shared registry (`KNOWN_MODELS` + `toCatalogEntry`), so web and desktop never drift.
  Exposes `SEO_MODELS`, `SEO_BRANDS`, `SEO_BRAND_PARAMS`, `SEO_MODEL_PARAMS`, `SEO_SPOKE_COUNT`.
  URL space is **capped** to the curated model set — no infinite/duplicate routes.
- **`apps/web/src/data/seo-clusters.ts`** — brand keyword clusters (hand-tuned overrides +
  deterministic fallback for every OEM), model × intent keyword cross-products, the ordered
  utility cluster, and the `SeoLink` internal-link graph with exact-match anchors.

### 3.2 Generator layer
- **`apps/web/src/lib/seo-matrix.ts`** — build-time metadata generators:
  `modelMetaTitle` (SERP-length-tiered, preserves the `2026` differentiator), `modelMetaDescription`
  (direct-answer first sentence), `modelKeywords`, `parseModelSlug` (returns `null` → `notFound()`),
  and the JSON-LD route context builders.

### 3.3 Presentation layer (server components only)
- **`components/seo/topic-cluster.tsx`** — reusable internal-link cluster widget.
- **`components/model-landing-page.tsx`** — shared spoke renderer.
- **`app/tools/page.tsx`** — `/tools` index over `SEO_BRANDS` with `#brands` + `#utilities`.
- **`app/tools/[brand]/page.tsx`** — brand hub with `#models` exact-match intent links.
- **`app/tools/[brand]/[model]/page.tsx`** — spoke with `generateStaticParams` +
  `dynamicParams = false` + `notFound()` guard.

---

## 4. Schema / Rich-Result Audit (Phase 5c)

| Route | SoftwareApplication | FAQPage | BreadcrumbList | HowTo |
|-------|:--:|:--:|:--:|:--:|
| `/tools` | — | — | ✅ | — |
| `/tools/[brand]` | ✅ | ✅ | ✅ | — |
| `/tools/[brand]/[model]` | ✅ | ✅ | ✅ | ✅ |

- All JSON-LD emitted via the shared `<JsonLd>` default export (escapes `<` → `\u003c`).
- Visible FAQ copy uses **direct-answer** first sentences (`brandFaq`, `modelFaq`) to match
  `FAQPage` mainEntity text.
- `HowTo` on spokes is rich-result eligible (`estimatedTime: PT6M`, prerequisites set).

---

## 5. Canonicalisation & Crawl Control

- **Strict canonicals:** `SITE_URL` (`NEXT_PUBLIC_APP_URL ?? "https://frpb.in"`) is the single
  origin source; every new route emits a self-referencing canonical.
- **No duplicate routes:** `dynamicParams = false` caps the URL space; unknown segments hit
  `notFound()` (no thin pages).
- **Sitemap:** `app/sitemap.ts` extended with `/tools` (0.7/weekly), `brandHubPages`
  (0.7/weekly) and `modelSpokePages` (0.6/monthly). Served statically at `/sitemap.xml`.
- **Robots:** `app/robots.ts` → `/robots.txt` (static).

---

## 6. Legacy Utility Redirects (Phase 5b)

Permanent **308** redirects in `next.config.mjs` consolidate legacy utility paths onto their
canonical routes (prevents duplicate-content dilution):

| Legacy alias | Canonical destination |
|--------------|-----------------------|
| `/virtual-location` | `/virtual-location-spoofer` |
| `/data-eraser` | `/android-data-eraser` |
| `/phone-transfer` | `/phone-to-phone-transfer` |
| `/whatsapp-transfer` | `/whatsapp-transfer-tool` |

> **Fix applied during build:** a TypeScript type annotation had been placed on the
> `legacyUtilityAliases` const inside the native-ESM `.mjs` file, which broke
> `next.config.mjs` loading (`SyntaxError: Missing initializer in const declaration`).
> The annotation was removed; the config now loads cleanly.

---

## 7. Build Verification (Phase 6)

```
✓ Compiled successfully
✓ Linting and checking validity of types   (0 TS errors)
✓ Generating static pages (214/214)
```

| Route | Mode | Paths |
|-------|------|-------|
| `/tools` | ○ Static | 1 |
| `/tools/[brand]` | ● SSG | 20 (samsung, xiaomi, oneplus + 17 more) |
| `/tools/[brand]/[model]` | ● SSG | 114 (galaxy-s24-frp-bypass, galaxy-s24-lock-removal, galaxy-s23-frp-bypass + 111 more) |
| `/sitemap.xml` | ○ Static | 1 |
| `/robots.txt` | ○ Static | 1 |

**Bundle:** new pages `576 B` route JS / `96.6 kB` First Load JS — **no regression**
(shared JS 87.5 kB; middleware 87.6 kB).

**Canonical utility routes present:** `/android-data-eraser`, `/phone-to-phone-transfer`,
`/virtual-location-spoofer`, `/whatsapp-transfer-tool`.

---

## 8. Task Checklist Status

| # | Task | Status |
|---|------|--------|
| 1 | Phase 0 — Code-mode recon | ✅ Completed |
| 2 | Phase 1a — `data/seo-matrix.ts` | ✅ Completed |
| 3 | Phase 1b — `data/seo-clusters.ts` | ✅ Completed |
| 4 | Phase 2 — `lib/seo-matrix.ts` generators | ✅ Completed |
| 5 | Phase 3a — `components/seo/topic-cluster.tsx` | ✅ Completed |
| 6 | Phase 3b — `components/model-landing-page.tsx` | ✅ Completed |
| 7 | Phase 4a — `app/tools/page.tsx` | ✅ Completed |
| 8 | Phase 4b — `app/tools/[brand]/page.tsx` | ✅ Completed |
| 9 | Phase 4c — `app/tools/[brand]/[model]/page.tsx` | ✅ Completed |
| 10 | Phase 5a — Extend `sitemap.ts` | ✅ Completed |
| 11 | Phase 5b — Legacy utility redirects | ✅ Completed |
| 12 | Phase 5c — Schema pass | ✅ Completed |
| 13 | Phase 6 — Build + SSG verification | ✅ Completed |
| 14 | Phase 6b — Audit report | ✅ Completed |

---

## 9. Follow-Ups (non-blocking, future optimisation)

1. **Submit sitemap** to Google Search Console / Bing Webmaster once the domain is live and
   request indexing for the 135 new URLs.
2. **Monitor Core Web Vitals** on the new SSG routes (already static — expected LCP benefit).
3. **Resolve pre-existing `baseUrl` deprecation warning** in `apps/web/tsconfig.json` (unrelated
   to this work; safe to defer until TS 7 migration).
4. **Iterate keyword overrides** in `BRAND_KEYWORD_OVERRIDES` as Search Console impressions
   reveal new long-tail winners.
