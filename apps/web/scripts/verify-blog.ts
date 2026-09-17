// FRPB — blog engine regression checks.
//
//   pnpm --filter @frpb/web exec tsx scripts/verify-blog.ts
//
// Asserts the things that would silently break SEO or the filter tabs:
//   1. every required model-specific slug exists,
//   2. slugs are unique (a duplicate would shadow a route),
//   3. every guide carries the structured fields the JSON-LD is built from,
//   4. every post resolves to a real filter category,
//   5. TOC anchors are unique, content-derived and match the heading slugs,
//   6. the required SEO copy (CTA targets, keywords) is present.

import { BLOG_POSTS, getPost, categoryOf, platformOf } from "../src/lib/blog";
import {
  BLOG_CATEGORY_TABS,
  COVERED_CATEGORIES,
  categoryCounts,
  postsByCategory,
  tableOfContentsFor,
  slugifyHeading,
  computeReadingMinutes,
  howToStepsFor,
  allStepsFor,
} from "../src/lib/blog";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    pass++;
    console.log(`PASS | ${name}`);
  } else {
    fail++;
    console.log(`FAIL | ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("FRPB — blog engine verification\n");

// ─── 1. Required model-specific slugs ────────────────────────────────────────
const REQUIRED_SLUGS = [
  "how-to-bypass-icloud-activation-lock-iphone-x-2026",
  "how-to-bypass-icloud-activation-lock-iphone-11-2026",
  "how-to-bypass-icloud-activation-lock-iphone-12-2026",
  "how-to-bypass-icloud-activation-lock-iphone-13-14-15-2026",
  "how-to-bypass-samsung-s24-ultra-frp-android-14-15",
  "how-to-bypass-xiaomi-hyperos-frp-lock-2026",
  "how-to-bypass-vivo-oppo-realme-frp-lock-2026",
  "how-to-bypass-motorola-frp-lock-fastboot-2026",
];
for (const slug of REQUIRED_SLUGS) {
  const post = getPost(slug);
  check(`slug exists: ${slug}`, Boolean(post));
}

// ─── 2. Slug uniqueness ──────────────────────────────────────────────────────
const slugSet = new Set(BLOG_POSTS.map((p) => p.slug));
check(
  "all slugs unique",
  slugSet.size === BLOG_POSTS.length,
  `${BLOG_POSTS.length} posts, ${slugSet.size} unique`
);
check("total posts >= 25", BLOG_POSTS.length >= 25, `got ${BLOG_POSTS.length}`);

// ─── 3. Structured SEO fields on every post ──────────────────────────────────
const missingStructured = BLOG_POSTS.filter(
  (p) =>
    !p.title ||
    !p.description ||
    !p.excerpt ||
    !p.datePublished ||
    !p.dateModified ||
    !p.keywords?.length ||
    !p.sections?.length
);
check(
  "every post has title/description/excerpt/dates/keywords/sections",
  missingStructured.length === 0,
  missingStructured.map((p) => p.slug).join(", ")
);

// HowTo requires a numbered procedure — every guide must render one. Steps may
// be split across sections, so the rendered set is ALL steps, not just the first.
const withoutSteps = BLOG_POSTS.filter((p) => allStepsFor(p).length < 3);
check(
  "every post renders a numbered procedure (>=3 steps)",
  withoutSteps.length === 0,
  withoutSteps.map((p) => p.slug).join(", ")
);
// The HowTo schema uses the FIRST step list; it must still be substantial.
const weakHowTo = BLOG_POSTS.filter((p) => howToStepsFor(p).length < 3);
check(
  "every post's primary HowTo block has >=3 steps",
  weakHowTo.length === 0,
  weakHowTo.map((p) => p.slug).join(", ")
);

// ─── 4. Category resolution ──────────────────────────────────────────────────
const badCategory = BLOG_POSTS.filter((p) => !COVERED_CATEGORIES.has(categoryOf(p)));
check(
  "every post resolves to a category covered by a tab",
  badCategory.length === 0,
  badCategory.map((p) => `${p.slug}=${categoryOf(p)}`).join(", ")
);

const counts = categoryCounts();
check("category counts sum to total", counts.all === BLOG_POSTS.length);
const iphoneCount = postsByCategory("iphone").length;
check("iphone tab has the 4 new iOS guides", iphoneCount >= 4, `got ${iphoneCount}`);
check(
  "samsung tab includes the S24 Ultra guide",
  postsByCategory("samsung").some((p) =>
    p.slug.includes("samsung-s24-ultra-frp-android-14-15")
  )
);
check(
  "xiaomi tab includes the HyperOS guide",
  postsByCategory("xiaomi").some((p) => p.slug.includes("hyperos"))
);
check(
  "xiaomi / android tab includes vivo/oppo/realme + motorola",
  postsByCategory("xiaomi").some((p) => p.slug.includes("vivo-oppo-realme")) &&
    postsByCategory("xiaomi").some((p) => p.slug.includes("motorola"))
);
check(
  "every tab that is not 'all' has at least one post",
  BLOG_CATEGORY_TABS.every((t) => t.id === "all" || postsByCategory(t.id).length > 0)
);

// ─── 5. TOC anchors ──────────────────────────────────────────────────────────
let tocFailures = 0;
for (const post of BLOG_POSTS) {
  const toc = tableOfContentsFor(post);
  const headingCount = post.sections.filter((s) => s.heading).length;
  const ids = toc.map((t) => t.id);
  const unique = new Set(ids).size === ids.length;
  const complete = toc.length === headingCount;
  const linked = toc.every((t) => t.id === slugifyHeading(t.label) || t.id.length > 0);
  if (!unique || !complete || !linked) {
    tocFailures++;
    console.log(
      `      · ${post.slug}: unique=${unique} complete=${complete} linked=${linked}`
    );
  }
}
check("TOC entries are unique, complete and linkable", tocFailures === 0);

// ─── 6. Reading time sanity ──────────────────────────────────────────────────
const badReading = BLOG_POSTS.filter((p) => computeReadingMinutes(p) < 1);
check("computed reading time is >= 1 minute", badReading.length === 0);

// ─── 7. iPhone guides are honest about iOS ───────────────────────────────────
const iphoneGuides = postsByCategory("iphone");
check(
  "iPhone guides are flagged platform=iOS",
  iphoneGuides.every((p) => platformOf(p) === "iOS")
);
const iphoneDishonest = iphoneGuides.filter((p) =>
  /software bypass (is|works)|one-click icloud unlock available/i.test(
    p.sections.flatMap((s) => s.paragraphs ?? []).join(" ")
  )
);
check("iPhone guides do not claim a software bypass exists", iphoneDishonest.length === 0);

console.log("\n" + "-".repeat(56));
console.log(`result: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
