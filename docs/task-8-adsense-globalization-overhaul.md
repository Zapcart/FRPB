# Task 8 — AdSense Compliance, Global Localization, Download & Promo Overhaul

**Status:** Plan (T8-PLAN)
**Predecessor:** Task 7 (`c5231df`) — limited-time $20 pricing + iOS SEO expansion
**Scope:** Monorepo `frpb/` — Next.js 14 App Router (`apps/web`), shared pricing/promo (`packages/shared`)

---

## 1. Objectives (from the request)

1. **AdSense approval & quality** — clean navigation, zero broken links, proper header/footer, clear access to legal pages (Privacy, Terms, EULA, **Contact**, **About Us**); deep unique content on blog + tool pages; JSON-LD for offers, aggregateRating and merchant policies; remove obsolete `Host:` directive from `robots.ts`; canonical-only sitemap.
2. **Global audience optimization** — remove India-local operational references (text, metadata, footers, contact, structured data, INR defaults); enforce **USD ($)** as primary currency everywhere; global contact formatting & support handles.
3. **Global download links** — all anchors/buttons → `https://github.com/quotexahsan90-cyber/FRPB-APP/releases/tag/v2`.
4. **Pricing promo & countdown** — $20 → **6 months / 180 days** as temporary intro launch offer (later shifts to 4 months); Lifetime stays **$200**; dynamic, responsive urgency countdown timer.
5. **iOS SEO expansion** — spokes for **iPhone 13, 14, 15, iPad** targeting iCloud activation-lock bypass and face/passcode removal, with valid canonicals.
6. **Ship** — `pnpm typecheck` + production build green, commit, push to `origin/main` on `Zapcart/FRPB`.

---

## 2. Reconnaissance Findings (current state)

### 2.1 Routes present
Legal/quality pages: `/privacy`, `/terms`, `/eula`, `/refund` exist.
**MISSING: `/contact` and `/about`.** Footer "About Us" currently points at `/#guides`.

Tool/blog routes: `/tools`, `/tools/[brand]`, `/tools/[brand]/[model]`, `/blog`, `/blog/[slug]`, `/ios`, `/ios/[topic]` (4 spokes), plus standalone unlock/product landing pages (`/frp-bypass`, `/icloud-bypass`, `/samsung-frp-bypass`, `/xiaomi-miui-frp-bypass`, `/vivo-oppo-realme-frp`, `/unlock-screen`, `/data-recovery`, `/bootloop-recovery`, `/flash-reset`, `/reboot-mode`, `/samsungaccount`, `/android-data-eraser`, `/qualcomm-edl-frp-tool`, `/virtual-location-spoofer`, `/phone-to-phone-transfer`, `/whatsapp-transfer-tool`, `/download`, `/downloads`).

### 2.2 Concrete defects to fix

| # | File | Issue | Fix |
|---|------|-------|-----|
| D1 | `apps/web/src/config/legal.ts` | `LEGAL_LOCATION="FRPB, India"`, `COMPANY_ADDRESS="India"`, `COMPANY_JURISDICTION="India"` | Globalize (remove India) |
| D2 | `apps/web/src/app/layout.tsx:54` | `openGraph.locale: "en_IN"` | `"en_US"` |
| D3 | `apps/web/src/lib/seo.ts:97` | `openGraph.locale: "en_IN"` | `"en_US"` |
| D4 | `apps/web/src/app/privacy/page.tsx` | `toLocaleDateString("en-IN")` (≈67–72), "…from {COMPANY_JURISDICTION}" (80), "India's DPDP Act, 2023" (88) | Neutral global wording + `en-US` locale |
| D5 | `apps/web/src/app/robots.ts:27` | obsolete `host: SITE_URL` | remove |
| D6 | `apps/web/src/config/download.ts` | old repo `Zapcart/FRPB-Application`, `RELEASE_VERSION="2.0.0"`, `EXE_NAME="…1.0.1.exe"` | new repo + `v2` tag URL |
| D7 | `apps/web/src/lib/schema.ts` | offers + aggregateRating present; **no merchant-policy / return-policy JSON-LD** | add `merchantReturnPolicySchema` + `offerShippingDetailsSchema`, emit on pricing |
| D8 | `apps/web/src/data/ios-content.ts` | 4 spokes, no dedicated iPhone 13/14/15 spokes | add per-model spokes |
| D9 | `apps/web/src/app/tools/page.tsx` | hand-written `"… | FRPB"` title → double suffix with root `"%s | FRPB"` | use `pageMetadata()`/short title |
| D10 | Footer | "About Us" → `/#guides` | point at new `/about`; add `/contact` |
| D11 | admin/payment/referral/supabase | INR/UPI/`en-IN` operational traces (internal/admin + storefront-adjacent) | globalize storefront-facing; leave internal admin INR reporting intact unless user-facing |
| D12 | catalog pages | image/render fields — most landing pages already pass a `hero` image; a few text-only catalog entries render without media | ensure every surfaced catalog entry has imagery in `seo-matrix`/`brand-pages` |

### 2.3 Already-correct (verify only)
- Promo infra: `$20 / 180d` (`LAUNCH_PROMO.promoDurationDays=180`), `$200` lifetime, `CountdownTimer`/`PromoBanner`/`usePromoState`, `config/promo.ts` helpers.
- `DUAL_PLANS`: `MONTH_1` usd 20 / durationDays 180; `LIFETIME` usd 200 / null.
- Server-side entitlement resolution in `lib/payment/orders.ts`.
- Sitemap is canonical-only (needs `/contact` + `/about` additions).

---

## 3. Design Decisions

### 3.1 Globalization strategy — `config/legal.ts` is the single source of truth
Introduce a globally-neutral operating identity (no country of "operations"), keeping the brand legal descriptor but removing the India imprint:

```ts
export const LEGAL_LOCATION = "Global (remote-first)";
export const COMPANY_ADDRESS = "Remote — worldwide";
export const COMPANY_JURISDICTION = "Global"; // neutral; avoids India-specific jurisdiction claims
```

All downstream consumers (`Footer`, `privacy`, `terms`, `eula`, `refund`, `schema`) inherit automatically — no per-file string duplication. Add a **global support handle** constant set:
```ts
export const SUPPORT_EMAIL = "support@frpb.in";   // brand-domain mailbox, country-neutral
export const LEGAL_EMAIL   = "legal@frpb.in";
```
Email domain (`frpb.in`) is a brand asset, not an operational-location disclosure; it stays. All *location/date/currency* formatting globals flip to US-centric defaults.

### 3.2 Locale & formatting
- `openGraph.locale: "en_US"` (both `layout.tsx`, `seo.ts`).
- Date rendering → `toLocaleDateString("en-US", …)`.
- Currency → USD-only on storefront; INR confined to internal admin reporting.

### 3.3 Download config rewrite
```ts
export const GITHUB_REPO      = "quotexahsan90-cyber/FRPB-APP";
export const RELEASE_VERSION  = "2.0.0";   // display version (badges, structured data)
export const RELEASE_TAG      = "v2";      // published git tag used in every URL
export const GITHUB_RELEASES_TAG  = `https://github.com/${GITHUB_REPO}/releases/tag/${RELEASE_TAG}`;
export const GITHUB_RELEASES_BASE = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}`;
```
- Keep `resolveInstallerUrl()` API stable so Footer/download pages don't break.
- Keep legacy asset-name aliases so `downloads/[file]/route.ts` redirects keep resolving.
- **Empty release guard:** if the new tag has no published assets yet, `resolveInstallerUrl()` must fall back to `GITHUB_RELEASES_TAG` (never emit a dangling 404 asset URL).

### 3.4 New legal/quality pages
Create `/contact` and `/about` as server components with:
- `pageMetadata()` (canonical, OG, description).
- **About**: brand story, mission, editorial/verification method, accuracy notice, team-quality signals — the "authoritativeness" content AdSense reviewers look for. No India references.
- **Contact**: `mailto:` support + legal addresses, response-time expectation, no physical country imprint, `ContactPage` JSON-LD.
- Add both to `sitemap.ts` and to header/footer navigation.

### 3.5 Structured data additions (`schema.ts`)
Emit `merchantReturnPolicySchema()` + `offerShippingDetailsSchema()` (digital-goods defaults: no physical shipping / instant delivery) alongside `productSchema()` on `/pricing`, satisfying the "merchant policies" JSON-LD requirement. Reuse existing `aggregateRating` blocks (no new fake data).

### 3.6 iOS spoke expansion (`ios-content.ts`)
Add spokes keyed by device family while keeping the Android-only accuracy notice intact:
`iphone-13-activation-lock-removal`, `iphone-14-activation-lock-removal`, `iphone-15-activation-lock-removal`, `ipad-pro-activation-lock-removal`.
Each spoke carries: unique title/description, canonical via existing `pagesMetadata` plumbing, FAQ block, steps, and cross-links to `IOS_HUB` + related spokes. `sitemap.ts` already iterates `IOS_*` so new slugs auto-list.

### 3.7 Promo verification (no logic change)
Confirm: `$20` → 180 days active while `LAUNCH_PROMO` live; falls back to 120 days when expired; Lifetime `$200` unaffected; `CountdownTimer` renders client-side (hydration-safe via `usePromoState`). No Razorpay amount mutation.

---

## 4. Implementation Sequence (maps to todos)

1. **T8-GLOBAL-INDIA / USD** — `config/legal.ts` (D1) → `layout.tsx` (D2) → `seo.ts` (D3) → `privacy/page.tsx` (D4) → scan & fix remaining `en-IN`/`INR`/UPI on storefront surfaces (D11).
2. **T8-ROBOTS** — remove `host` (D5); confirm sitemap canonical-only.
3. **T8-DOWNLOAD** — rewrite `config/download.ts` (D6); verify every anchor uses `GITHUB_RELEASES_TAG`.
4. **T8-ADSENSE-NAV** — create `/contact` + `/about`; wire header/footer; add to sitemap (D10); fix `tools/page.tsx` title suffix (D9).
5. **T8-ADSENSE-SCHEMA** — add merchant-policy/shipping JSON-LD (D7).
6. **T8-ADSENSE-CONTENT** — deepen thin blog/tool pages; ensure catalog media present (D12).
7. **T8-IOS** — add iPhone 13/14/15 + iPad spokes (D8).
8. **T8-PROMO** — verify only.
9. **T8-VERIFY** — `corepack pnpm --filter @frpb/shared build`, `tsc --noEmit`, `next build`.
10. **T8-GIT** — commit + push to `origin/main` (`Zapcart/FRPB`).

---

## 5. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Dangling download asset URL if tag v2 has no assets | `resolveInstallerUrl()` falls back to tag page |
| Double title suffix | route page titles become short; rely on root template; audit all `title:` literals |
| Removing jurisdiction could breach consumer-law disclosure | keep brand entity + emails; replace with neutral global + "see Terms" pointer; user explicitly requested India removal |
| Hydration mismatch on countdown | keep `usePromoState().active` boolean pattern; never read `Date` during render |
| Breadth of edits breaking typecheck | typecheck after each cluster; single final build |

---

## 6. Definition of Done
- `/contact`, `/about` live, in sitemap, linked in nav/footer.
- `robots.ts` has no `Host:`; sitemap lists canonical URLs only.
- No `en_IN`/`en-IN`/India-operational strings on any storefront/metadata/schema surface.
- All download CTAs resolve to `…/FRPB-APP/releases/tag/v2`.
- `$20`/180d promo + `$200` lifetime + countdown verified.
- Merchant-policy + offer + aggregateRating JSON-LD present.
- iOS spokes for iPhone 13/14/15 + iPad with canonical tags.
- `pnpm typecheck` and production build pass; commit pushed to `origin/main`.
