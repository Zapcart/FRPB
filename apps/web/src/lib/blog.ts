// FRPB — blog content library.
// Plain data (no MDX runtime) so the blog routes stay statically renderable and
// fully indexable. Each post is optimised for a distinct high-volume query and
// links back to the primary software download CTA.

export interface BlogSection {
  heading?: string;
  paragraphs?: string[];
  steps?: string[];
}

/**
 * Transport the guide's method actually uses. Drives the Connection-Wizard
 * cross-link and, more importantly, keeps each guide honest about what it
 * requires (a BROM guide must not read like a fastboot guide).
 */
export type FrpMethod =
  | "brom" // MediaTek BROM / Preloader
  | "edl" // Qualcomm Emergency Download 9008
  | "fastboot"
  | "download" // Samsung Odin / Download mode
  | "mtp"
  | "manual"; // No automated transport — hardware/service path only

/**
 * Blog category used by the /blog index filtering tabs. Kept as a small closed
 * union so a filter tab can never reference a category no post can carry.
 */
export type BlogCategory =
  | "iphone" // iPhone / iOS activation lock
  | "samsung" // Samsung Galaxy FRP
  | "xiaomi" // Xiaomi / Redmi / POCO / HyperOS
  | "android" // General Android FRP (Vivo, OPPO, Realme, Motorola, …)
  | "qualcomm"; // Chipset-specific (Qualcomm EDL 9008, MediaTek BROM)

/** Operating system a guide targets. Drives the platform badge and metadata. */
export type BlogPlatform = "iOS" | "Android";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  datePublished: string;
  dateModified: string;
  readingMinutes: number;
  keywords: string[];
  sections: BlogSection[];

  // ── Structured, model-specific SEO metadata (optional) ────────────────────
  // These exist so the per-route <head> and the HowTo/Article JSON-LD can be
  // populated FROM STRUCTURE rather than by hand-writing meta copy per post.
  // A guide that omits them still renders; it simply omits the extras.
  /** Manufacturer, e.g. "Samsung". */
  brand?: string;
  /** Marketing model name, e.g. "Galaxy S24 Ultra". */
  model?: string;
  /** Android versions this guide is verified against, e.g. ["14", "15"]. */
  androidVersions?: string[];
  /** Primary transport the automated path uses. */
  method?: FrpMethod;
  /** Chipset family, when the guide is chipset-specific. */
  chipset?: string;
  /** ISO-8601 duration for the HowTo schema (e.g. "PT12M"). */
  estimatedTime?: string;
  /** Tools/conditions required — surfaced in HowTo `tool`/`supply`. */
  prerequisites?: string[];

  // ── Category / platform metadata (drives filtering + badges) ──────────────
  /** Filtering bucket shown as a tab on /blog. Derived when omitted. */
  category?: BlogCategory;
  /** "iOS" | "Android" — rendered as a badge on the card and the article. */
  platform?: BlogPlatform;
  /**
   * OS versions this guide is verified against, e.g. ["14", "15"] for Android
   * or ["iOS 17", "iOS 18"] for iPhone. Complements `androidVersions`.
   */
  osVersions?: string[];
}

/**
 * Model-specific, high-intent guides live in their own modules so this file
 * stays readable and the corpora can be edited independently. All three are
 * merged below so the blog index, category tabs, sitemap and dynamic route pick
 * them up with no further wiring:
 *
 *   ./blog-guides         — the core FRP guide set (Samsung, Xiaomi, MediaTek…)
 *   ./blog-android-guides — high-volume Android OEM/model guides
 *   ./blog-iphone-guides  — iPhone / iCloud Activation Lock guides
 */
import { MODEL_GUIDES } from "./blog-guides";
import { ANDROID_MODEL_GUIDES } from "./blog-android-guides";
import { IPHONE_GUIDES } from "./blog-iphone-guides";

export const BLOG_POSTS: readonly BlogPost[] = [
  ...MODEL_GUIDES,
  ...ANDROID_MODEL_GUIDES,
  ...IPHONE_GUIDES,
  {
    slug: "how-to-bypass-samsung-frp-2026",
    title: "How to Bypass Samsung FRP in 2026: Step-by-Step Guide",
    description:
      "Step-by-step Samsung FRP bypass guide for 2026 — remove the Google account lock on your Galaxy device with FRPB's one-click Samsung FRP tool and high-speed USB auto-detection.",
    excerpt:
      "Factory Reset Protection can lock a Galaxy device you legitimately own. This guide walks through a safe, one-click Samsung FRP bypass with FRPB in 2026.",
    datePublished: "2026-01-12",
    dateModified: "2026-02-04",
    readingMinutes: 7,
    keywords: [
      "samsung frp tool",
      "samsung frp bypass 2026",
      "frp bypass tool",
      "remove google account lock",
      "galaxy frp unlock",
    ],
    sections: [
      {
        heading: "Why your Samsung is stuck on the FRP lock",
        paragraphs: [
          "Factory Reset Protection (FRP) is an anti-theft layer Google enables on every modern Galaxy device. The moment a factory reset finishes, Android demands the Google account that was last signed in before the wipe. If that account is gone — a traded-in phone, a forgotten credential, a refurbished unit — the device stops at the verification screen.",
          "An FRP bypass tool restores access for authorised owners. FRPB is built for technicians and repair shops that need a repeatable, auditable process instead of manually flashing firmware with mismatched Odin packages.",
        ],
      },
      {
        heading: "What you need before you start",
        paragraphs: [
          "FRPB runs on Windows 11, 10, 8 and 7 (64-bit) and bundles everything you need. There is no separate ADB install, no Odin download and no driver hunting — the Samsung FRP tool auto-detects the USB state and installs the correct OEM driver when it is missing.",
        ],
        steps: [
          "Download FRPB from frpb.in and install it on your Windows PC.",
          "Charge the Galaxy device to at least 30% so it does not drop out mid-operation.",
          "Use a quality USB data cable — not a charge-only cable.",
          "Remove any screen lock so the utility can read the device state.",
        ],
      },
      {
        heading: "Step-by-step Samsung FRP bypass with FRPB",
        steps: [
          "Open FRPB and let the Live Device Monitor finish its USB scan.",
          "Connect the Galaxy device. FRPB detects Download, Recovery or MTP mode automatically.",
          "Confirm the detected model so the correct FRP method is selected for the chipset (Exynos, Qualcomm or MediaTek).",
          "Click FRP Bypass and accept the authorisation disclaimer — you must own the device or have explicit permission.",
          "Let the flash reset app run. Progress is streamed live, and every stage is rollback-safe.",
          "When the operation completes, the device reboots to the setup wizard with the account lock cleared.",
        ],
      },
      {
        heading: "Fix it once, then keep it repeatable",
        paragraphs: [
          "Service shops rarely see a single device. FRPB stores encrypted local license profiles and hashed device binding so a single license covers one to five machines, and every run is logged for your own records.",
          "If a handset fails partway through, re-run the operation — the tool re-reads the current USB state rather than assuming the previous result.",
        ],
      },
    ],
  },
  {
    slug: "xiaomi-frp-tool-fastboot-mtp-recovery",
    title: "Xiaomi FRP Tool — Fastboot & MTP One-Click Recovery",
    description:
      "Use FRPB as a Xiaomi FRP tool to clear the Mi account lock over fastboot or MTP. One-click Xiaomi FRP bypass for Redmi, POCO and Mi devices with automatic mode detection.",
    excerpt:
      "Redmi, POCO and Mi devices expose two very different FRP paths — fastboot and MTP. FRPB detects which one your device is offering and runs the matching Xiaomi FRP bypass.",
    datePublished: "2026-01-19",
    dateModified: "2026-02-04",
    readingMinutes: 6,
    keywords: [
      "xiaomi frp bypass",
      "xiaomi frp tool",
      "fastboot frp unlock",
      "mtp frp bypass",
      "redmi frp lock removal",
    ],
    sections: [
      {
        heading: "Xiaomi FRP is not one lock — it is two",
        paragraphs: [
          "Xiaomi devices enforce FRP slightly differently from Samsung. Depending on firmware and region, the lock is cleared either from fastboot with a valid authorised account handshake, or from MTP with the device booted far enough for ADB sideloading.",
          "Picking the wrong path is the single most common cause of a failed Xiaomi FRP bypass. FRPB removes that guesswork by probing the USB descriptor and telling you which recovery route the handset is actually offering.",
        ],
      },
      {
        heading: "Fastboot vs MTP — which will FRPB use?",
        paragraphs: [
          "Fastboot mode is entered with the volume-down and power combination and exposes the bootloader. MTP mode is a normal-ish boot where the device presents as a media transfer device and allows ADB commands.",
          "FRPB reads the active USB IDs and picks the method for you. You always see the detected mode before anything runs, so there is no silent flashing.",
        ],
        steps: [
          "For fastboot recovery, put the device into fastboot using Volume Down + Power.",
          "For MTP recovery, boot the device normally and enable USB debugging where the firmware permits it.",
          "Let FRPB's Live Device Monitor confirm the mode before continuing.",
        ],
      },
      {
        heading: "Running the Xiaomi FRP bypass",
        steps: [
          "Launch FRPB and wait for the driver check to finish — MediaTek and Qualcomm drivers install on demand.",
          "Connect the Redmi, POCO or Mi device and confirm the auto-detected model and chipset.",
          "Click FRP Bypass and accept the authorisation disclaimer.",
          "Watch the live console as FRPB walks the fastboot or MTP recovery sequence.",
          "The device reboots into the setup wizard with the Mi account lock removed.",
        ],
      },
      {
        heading: "Common blockers and how FRPB handles them",
        paragraphs: [
          "Anti-Rollback and Region-Locked are the two errors Xiaomi technicians hit most often. FRPB surfaces the raw tool output rather than hiding it, so you can confirm the cause and switch to the documented manual guide the app provides for that exact model.",
          "For stubborn units, the guided manual mode walks through each command with copy-ready steps instead of a single opaque button.",
        ],
      },
    ],
  },
  {
    slug: "what-is-frp-lock-and-how-frpb-resolves-it",
    title: "What is FRP Lock and How FRPB.in Resolves It",
    description:
      "What is an FRP lock? Understand Android Factory Reset Protection and how the FRPB flash reset app removes the FRP lock on devices you are authorised to repair.",
    excerpt:
      "FRP lock is Android's anti-theft backstop after a factory reset. Here is exactly what it protects, when it becomes a problem, and how FRPB resolves it safely.",
    datePublished: "2026-01-05",
    dateModified: "2026-01-28",
    readingMinutes: 5,
    keywords: [
      "what is frp lock",
      "frp lock removal",
      "frp bypass tool",
      "factory reset protection",
      "android frp",
    ],
    sections: [
      {
        heading: "What is FRP lock, exactly?",
        paragraphs: [
          "Factory Reset Protection is a Google security feature introduced with Android 5.1 Lollipop. When a factory reset is triggered from Settings or Recovery, the device records the last signed-in Google account and refuses to complete setup until that same account is verified.",
          "That is the entire point: a thief who wipes a stolen phone cannot simply resell it as new. The lock persists through the reset, which is why FRP is consistently effective against casual theft.",
        ],
      },
      {
        heading: "When an FRP lock becomes a legitimate problem",
        paragraphs: [
          "FRP only causes trouble for honest owners and repair professionals. Typical cases include a phone bought second-hand whose seller never removed their account, a device reset after a factory repair, or a business fleet where the provisioning account was deleted.",
          "In every one of those situations, the person holding the device has a legitimate right to it — but Android has no way to know that. That gap is what an FRP bypass tool is designed to close.",
        ],
      },
      {
        heading: "How FRPB resolves the FRP lock",
        paragraphs: [
          "FRPB is a Windows desktop utility that drives Android's own service interfaces rather than guessing. It detects the device over USB, identifies the chipset family, then runs the documented FRP lock removal sequence for that platform.",
        ],
        steps: [
          "Download FRPB and install it — no ADB, Odin or driver hunting required.",
          "Connect the device and let high-speed USB auto-detection identify mode, model and chipset.",
          "Run the FRP bypass or flash reset operation and follow the live console output.",
          "The device restarts into the setup wizard with the account lock cleared.",
        ],
      },
      {
        heading: "Is using an FRP bypass tool legal?",
        paragraphs: [
          "FRPB is intended strictly for authorised device owners and licensed repair professionals. You must own the device or hold explicit permission from its owner.",
          "Using an FRP bypass tool on hardware you do not own may defeat anti-theft protections and can be illegal in your jurisdiction. FRPB states this plainly in-app, records your acknowledgement before each run, and keeps a local operation log.",
        ],
      },
    ],
  },
];

/** Look up a single post by slug. */
export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

/**
 * Resolve a post's filtering category.
 *
 * An explicit `category` always wins (iPhone guides declare it, since "iPhone"
 * cannot be inferred from an Android brand). Otherwise it is derived from the
 * brand/chipset so every existing guide lands in a sensible tab without being
 * hand-edited.
 */
export function categoryOf(post: BlogPost): BlogCategory {
  if (post.category) return post.category;
  const brand = (post.brand ?? "").toLowerCase();
  const model = (post.model ?? "").toLowerCase();
  const chipset = (post.chipset ?? "").toLowerCase();
  if (brand.includes("apple") || model.includes("iphone")) return "iphone";
  if (chipset.includes("qualcomm") || post.method === "edl") return "qualcomm";
  if (brand.includes("samsung")) return "samsung";
  if (
    brand.includes("xiaomi") ||
    brand.includes("redmi") ||
    brand.includes("poco") ||
    model.includes("hyperos")
  ) {
    return "xiaomi";
  }
  if (chipset.includes("mediatek") || post.method === "brom") return "qualcomm";
  return "android";
}

/** Resolve the platform badge for a post. */
export function platformOf(post: BlogPost): BlogPlatform {
  if (post.platform) return post.platform;
  return categoryOf(post) === "iphone" ? "iOS" : "Android";
}

/**
 * Filter tabs shown on /blog. `all` is the implicit "no filter" tab.
 *
 * A tab may span MORE THAN ONE category: the "Xiaomi / Android" tab covers both
 * `xiaomi` and the general `android` bucket, which is why the grouping logic
 * lives on the tab rather than being inferred from the id.
 */
export interface BlogCategoryTab {
  id: TabId;
  label: string;
  /** Categories this tab includes (ignored for the "all" tab). */
  categories: readonly BlogCategory[];
}

export type TabId = BlogCategory | "all" | "android-all";

export const BLOG_CATEGORY_TABS: readonly BlogCategoryTab[] = [
  { id: "all", label: "All guides", categories: [] },
  { id: "iphone", label: "iPhone / iOS", categories: ["iphone"] },
  { id: "samsung", label: "Samsung", categories: ["samsung"] },
  // "Xiaomi / Android" deliberately covers the general Android bucket too.
  { id: "xiaomi", label: "Xiaomi / Android", categories: ["xiaomi", "android"] },
  { id: "qualcomm", label: "Qualcomm EDL", categories: ["qualcomm"] },
] as const;

/** Posts belonging to a tab (or every post for the "all" tab). */
export function postsByCategory(tabId: TabId): readonly BlogPost[] {
  if (tabId === "all") return BLOG_POSTS;
  const tab = BLOG_CATEGORY_TABS.find((t) => t.id === tabId);
  if (!tab) return [];
  const wanted = new Set(tab.categories);
  return BLOG_POSTS.filter((post) => wanted.has(categoryOf(post)));
}

/** Count of posts per tab, used to render the tab labels. */
export function categoryCounts(): Record<string, number> {
  const counts: Record<string, number> = { all: BLOG_POSTS.length };
  for (const tab of BLOG_CATEGORY_TABS) {
    counts[tab.id] = postsByCategory(tab.id).length;
  }
  return counts;
}

/** Every category that appears in at least one tab (for validation). */
export const COVERED_CATEGORIES: ReadonlySet<BlogCategory> = new Set(
  BLOG_CATEGORY_TABS.flatMap((t) => [...t.categories])
);

/**
 * The canonical ordered procedure for a post — the first section that actually
 * renders a numbered list. Shared by the article body, the HowTo JSON-LD and the
 * table of contents so the three can never drift apart.
 */
export function howToStepsFor(post: BlogPost): string[] {
  return post.sections.find((s) => s.steps?.length)?.steps ?? [];
}

/** Every numbered step in the post, across all sections (the rendered set). */
export function allStepsFor(post: BlogPost): string[] {
  return post.sections.flatMap((s) => s.steps ?? []);
}

/**
 * Turn a heading into a stable, URL-safe anchor id.
 *
 * Used by BOTH the table of contents links and the `<h2 id>` emitted in the
 * article body — sharing one function is what guarantees a TOC link always
 * resolves to the heading it names.
 */
export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface TocEntry {
  id: string;
  label: string;
}

/**
 * Build the table of contents from a post's section headings.
 *
 * Duplicate headings are de-duplicated by suffixing the anchor, so two sections
 * that share a title (or slugify to the same string) still get distinct,
 * working links instead of one dead entry.
 */
export function tableOfContentsFor(post: BlogPost): TocEntry[] {
  const seen = new Map<string, number>();
  const entries: TocEntry[] = [];
  for (const section of post.sections) {
    if (!section.heading) continue;
    const base = slugifyHeading(section.heading) || `section-${entries.length + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    entries.push({ id, label: section.heading });
  }
  return entries;
}

/**
 * Approximate reading time in minutes from the rendered word count.
 *
 * `readingMinutes` is authored per post, but a long guide edited with new
 * sections would silently keep a stale number. This recomputes from the actual
 * prose and is used when the authored value looks out of date.
 */
export function computeReadingMinutes(post: BlogPost): number {
  const words = post.sections.reduce((total, section) => {
    const paragraphs = (section.paragraphs ?? []).join(" ").split(/\s+/).length;
    const steps = (section.steps ?? []).join(" ").split(/\s+/).length;
    const heading = (section.heading ?? "").split(/\s+/).length;
    return total + paragraphs + steps + heading;
  }, 0);
  // ~200 words/minute, clamped to a sane floor so a short guide never reads "0".
  return Math.max(1, Math.round(words / 200));
}
