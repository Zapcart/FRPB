# Task 7 — Limited-Time Pricing (Countdown Urgency) + iOS SEO Expansion + Link Integrity

**Status:** Planning (Step 1). No code changes yet.
**Scope:** FRPB platform — Next.js 14 (App Router), Supabase, Tailwind, Prisma.
**Goal:** Introduce a limited-time launch offer where **$20 grants 6 months (180 days)** during the promo window and automatically degrades to **$20 for 4 months (120 days)** once the dynamic countdown expires; expand iOS-specific SEO content; enforce internal-link integrity; then push to GitHub `origin/main` (`Zapcart/FRPB`).

---

## 0. Grounding (verified against the current codebase @ HEAD 8975035)

| Concern | File | Fact |
|---|---|---|
| Charge amount (authoritative) | [`config/plans.ts`](../apps/web/src/config/plans.ts) | `DUAL_PLANS` USD/INR are hardcoded, server-resolved. Monitored by `assertPlansInSync()`. |
| Canonical plan def | [`packages/shared/src/plans.ts`](../packages/shared/src/plans.ts) | `PLANS` MONTH_1 `durationDays: 180`. |
| **Real entitlement** | [`lib/payment/orders.ts`](../apps/web/src/lib/payment/orders.ts) | Line 160: `expiresAt = planRow.durationDays != null ? addDays(now, planRow.durationDays) : null`. **This is where duration actually becomes a license expiry.** |
| Plan-row creation | `ensurePlanRow()` (same file) | Seeds the Prisma `Plan` row from `DUAL_PLANS` when absent — `durationDays` copied from config. |
| Pricing UI | [`app/pricing/page.tsx`](../apps/web/src/app/pricing/page.tsx) | Client component. `BILLING_SUFFIX = { MONTH_1: "/ 6 months", LIFETIME: "one-time" }` (line 104) — hardcoded copy. Renders `durationDays` (line 316). |
| Checkout UI | [`components/checkout/checkout-panel.tsx`](../apps/web/src/components/checkout/checkout-panel.tsx) | Line 111 renders `${plan.durationDays} days`. |
| Landing | [`app/page.tsx`](../apps/web/src/app/page.tsx) | `PRICING_NOTES = { MONTH_1: "per 6 months" }` (line 159); line 556 renders `durationDays`. |
| Structured data | [`lib/schema.ts`](../apps/web/src/lib/schema.ts) | `PRICE_VALID_UNTIL = "2027-12-31"` (line 20); `billingDuration(days)` → `P6M` for 180 (line 23). |
| Blog model | [`lib/blog.ts`](../apps/web/src/lib/blog.ts) | `relatedPosts()` (line 340) auto-derives links from brand/model → **new iOS posts self-link for free**. |
| iOS corpus | [`lib/blog-iphone-guides.ts`](../apps/web/src/lib/blog-iphone-guides.ts) | STRICT accuracy rules: **no legitimate software iCloud activation-lock bypass exists**; documents owner-only routes (Apple ID recovery / proof-of-purchase support). FRPB is Android-only and does **not** touch iOS. |
| Sitemap | [`app/sitemap.ts`](../apps/web/src/app/sitemap.ts) | Iterates `BLOG_POSTS` — **new posts auto-include**, canonical-only. |

### The single most important finding
Because the $20 tier's **price is unchanged** across the promo switch, **no Razorpay amount / order-creation / signature logic changes**. Only two things move:
1. **`durationDays`** (180 → 120) — which must be resolved **server-side at payment time** so a buyer receives exactly what was advertised when they paid.
2. **Display copy + a live countdown** on the marketing/checkout surfaces.

The server-side entitlement change is the *substance* of the task; the countdown is its *communication*.

---

## 1. Pricing & Launch-Promo Strategy (Step 2a)

### 1.1 Single source of truth
Create **`packages/shared/src/promo.ts`** (dependency-free, unit-testable) and export from the shared index:

```ts
export const LAUNCH_PROMO = {
  code: "LAUNCH6",
  label: "Launch Offer — 6 months for the price of 4",
  /** Promo deadline (UTC). After this instant the $20 tier drops to 120 days. */
  endsAt: "2026-12-31T23:59:59.000Z",
  promoDurationDays: 180,   // during the offer
  standardDurationDays: 120 // after the offer
} as const;

export function isPromoActive(now: Date = new Date()): boolean;
export function msUntilPromoEnds(now: Date = new Date()): number;      // <=0 when expired
export function resolveMonthlyDurationDays(now: Date = new Date()): number; // 180 | 120
```

- **`apps/web/src/config/promo.ts`** re-exports the above plus UI-only helpers (`promoLabel`, `promoEndsAtIso`, `promoActive()`), so UI never lags the shared window.
- **`packages/shared/src/plans.ts`**: MONTH_1 `durationDays` stays `LAUNCH_PROMO.promoDurationDays` (the advertised headline). Add a commented note that the *effective* duration is resolved at payment time.
- **`config/plans.ts`**: keep `durationDays: LAUNCH_PROMO.promoDurationDays`; extend `assertPlansInSync()` to also verify the promo window constant is consistent across shared/web.

**Why a shared constant, not a date literal in each file:** the deadline must be identical everywhere or the banner and the license grant disagree — the exact class of bug `assertPlansInSync()` already guards against.

### 1.2 Server-side entitlement (the real switch)
In [`lib/payment/orders.ts`](../apps/web/src/lib/payment/orders.ts), `grantLicenseForOrder()` resolves the granted duration from the promo window instead of the static plan row:

```ts
import { resolveMonthlyDurationDays } from "@frpb/shared";
// ...
const planSlug = order.planId as PlanSlug;
const planRow = await ensurePlanRow(planSlug, client);
const grantedDurationDays =
  planSlug === "MONTH_1" ? resolveMonthlyDurationDays(new Date()) : planRow.durationDays;
const expiresAt =
  grantedDurationDays != null ? addDays(new Date(), grantedDurationDays) : null;
```

- Record `promoActive` + `grantedDurationDays` in `metadata` for audit.
- `ensurePlanRow()` still stores the headline 180 so the Plan row stays stable; entitlement is computed per grant (idempotent — the existing `order.licenseId` guard means a promo expiry can never retro-issue a second key).

### 1.3 Countdown Timer component
Create **`apps/web/src/components/promo/CountdownTimer.tsx`** — `"use client"`:
- Props: `endsAt: string` (ISO), `className?`, `variant?: "banner" | "inline"`, `onExpire?`.
- **Hydration-safe:** renders a stable placeholder on first paint; computes `target = new Date(endsAt).getTime()` and starts a 1s interval inside `useEffect` only. Never reads `Date.now()` during render.
- **Accessibility:** `role="timer"` + `aria-live="polite"`; `aria-label="Time remaining in launch offer"`. Renders `Dd HHh MMm SSs` segments; when expired, renders the "Offer ended — standard term applies" state and invokes `onExpire`.
- **Responsive:** `grid-flow-col` segments that collapse gracefully on mobile; honours `prefers-reduced-motion`.
- **Cleanup:** `clearInterval` on unmount/expiry (no leaked timers).

Supporting: **`components/promo/usePromoState.ts`** — hook returning `{ active, expired, mounted }` with a server-safe default (`active` initialised from the static window, refined after mount to avoid hydration drift).

### 1.4 Injection points
| Surface | Change |
|---|---|
| `/pricing` | `PromoBanner` (new, wraps `CountdownTimer`) above the plan grid. `BILLING_SUFFIX` becomes promo-aware: MONTH_1 shows `"/ 6 months (launch offer)"` while active, `"/ 4 months"` after. Duration line reads `180 days`/`120 days` accordingly. Copy lives in config, not inline. |
| Checkout ([`checkout-panel.tsx`](../apps/web/src/components/checkout/checkout-panel.tsx)) | Inline note + compact `CountdownTimer` for MONTH_1 only ("Your $20 unlocks 6 months — offer ends in …"). LIFETIME untouched. |
| Landing ([`app/page.tsx`](../apps/web/src/app/page.tsx)) | `PromoBanner` in the `#pricing` section; `PRICING_NOTES.MONTH_1` becomes promo-aware. |
| Structured data | `productSchema().priceValidUntil` sourced from `LAUNCH_PROMO.endsAt`; `billingDuration(180)` → `P6M` already correct; post-promo recomputes to `P4M`. |
| FAQ | Add one promo FAQ ("How long does the $20 launch offer last?") to `PRICING_FAQS` + mirrored `FAQPage` JSON-LD. |

---

## 2. iOS Content & Blog Expansion (Step 2b)

**Non-negotiable accuracy rule (inherited from the existing corpus):** there is **no legitimate software iCloud Activation Lock bypass**. New posts document **owner-only routes** (Apple ID recovery at *iforgot.apple.com*, Apple Support Activate-Lock removal with proof of purchase) and explicitly state FRPB is Android-only and does **not** touch iOS. This keeps the content honest, policy-safe, and genuinely SEO-durable.

### 2.1 New blog guides — append to [`lib/blog-iphone-guides.ts`](../apps/web/src/lib/blog-iphone-guides.ts)
Each uses the existing `modelGuide({...})` wrapper → unique title/description/`keywords`/canonical, `platform: "iOS"`, `category: "iphone"`, `osVersions`, `prerequisites`, `method: "manual"`:

1. **iPad iCloud Activation Lock — Owner Removal Guide (iPadOS 16/17/18)**
2. **iPhone Passcode / "Forgot Passcode" — Owner Reset Guide (iOS 17 & iOS 18)**
3. **Face ID & Touch ID Lock Removal — Owner Re-enroll Guide (iOS 16/17/18)**
4. **iOS 18 Activation Lock — What Changed & Owner Recovery Steps**
5. **Second-Hand iPhone Activation Lock — Buyer Safety & Owner Removal**
6. **iPhone Activation Lock after Factory Reset — Complete Owner Walkthrough**

Every post cross-links (in `related`/body) to the `icloud-bypass` tool page and `/pricing` (the $20 launch offer), and to sibling iPhone spokes.

### 2.2 iOS tool landing pages / SEO spokes
- Add an **Apple/iPhone device family** to the shared model catalog consumed by [`data/seo-matrix.ts`](../apps/web/src/data/seo-matrix.ts) so the programmatic spoke generator emits `brandHubPath("apple")` + model spokes (`/tools/apple/iphone-15`, …) with unique metadata + canonical via the existing `pageMetadata`/`softwareApplicationSchema` context.
- Reuse the existing **`icloud-bypass`** unlock-tool entry for the iOS hub; add iOS-specific keyword overrides in [`data/seo-clusters.ts`](../apps/web/src/data/seo-clusters.ts) (`apple`, `iphone`, `ipad`).
- **sitemap:** automatic via `BLOG_POSTS` + `UNLOCK_TOOL_ROUTES`/`SEO_MODEL_PARAMS` — verify, no manual edits.

---

## 3. Internal Linking & Link Integrity (Step 2c)

1. **Backlink flow:** new iPhone spokes link **up** to the Apple brand hub, **across** to sibling iOS spokes, and **down** to the `icloud-bypass` tool + `/pricing`. The `TopicCluster` block on `/blog/[slug]` already renders `relatedPosts()` — new posts inherit it because `relatedPosts()` keys off `brand`/`model`.
2. **No broken routes:** audit every new `href` against the emitted route tree (`dir /S /B page.tsx`) and the shared route constants (`BRAND_PAGE_ROUTES`, `FREE_TOOL_ROUTES`, `UNLOCK_TOOL_ROUTES`, `SEO_*_PARAMS`). Any anchor without a concrete target is removed or repointed.
3. **Zero-orphan check:** every new post must appear in `BLOG_POSTS` (⇒ sitemap + `/blog` index + `relatedPosts`) and be reachable from at least one hub.

---

## 4. Verification & Git (Step 2d)

1. `corepack pnpm --filter @frpb/shared build && corepack pnpm --filter @frpb/web typecheck` → **exit 0, 0 errors**.
2. Production build (`prisma generate` → `migrate-deploy.mjs` no-op without `DATABASE_URL` → `next build`) → **exit 0**; confirm `/pricing`, `/checkout`, new iOS `/blog/*` and `/tools/apple/*` are registered.
3. `git status` clean after commit; commit with a scoped message; `git push origin main` to `Zapcart/FRPB` (local branch is 3 commits ahead — push publishes all pending commits).

---

## 5. File Manifest

**New**
- `packages/shared/src/promo.ts`
- `apps/web/src/config/promo.ts`
- `apps/web/src/components/promo/CountdownTimer.tsx`
- `apps/web/src/components/promo/PromoBanner.tsx`
- `apps/web/src/components/promo/usePromoState.ts`

**Modified**
- `packages/shared/src/plans.ts`, `packages/shared/src/index.ts`
- `apps/web/src/config/plans.ts`
- `apps/web/src/lib/payment/orders.ts`  ← server-side entitlement (substance)
- `apps/web/src/app/pricing/page.tsx`, `apps/web/src/components/checkout/checkout-panel.tsx`, `apps/web/src/app/checkout/page.tsx`, `apps/web/src/app/page.tsx`
- `apps/web/src/lib/schema.ts`
- `apps/web/src/lib/blog-iphone-guides.ts`
- `apps/web/src/data/seo-clusters.ts` (+ Apple family in shared model catalog)

---

## 6. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Countdown / hydration mismatch | Compute time only in `useEffect`; stable SSR placeholder; `usePromoState` refines after mount. |
| Promo deadline drift between shared/web/UI | One shared `LAUNCH_PROMO`; extended `assertPlansInSync`. |
| Buyer charged $20 but granted wrong term | Duration resolved **server-side at grant time**; audited in license `metadata`. |
| iOS content over-claiming a nonexistent bypass | Reuse the corpus's strict owner-only accuracy rules; state FRPB is Android-only. |
| Broken internal links | Route-tree + shared-route-constant audit before commit. |
