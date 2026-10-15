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
// Tool + system-mode corpus, generated from FREE_TOOLS / UNLOCK_TOOLS in
// @frpb/shared so each blog guide can never drift from its landing page.
import { TOOL_AND_MODE_GUIDES } from "./blog-tool-guides";

export const BLOG_POSTS: readonly BlogPost[] = [
  ...MODEL_GUIDES,
  ...ANDROID_MODEL_GUIDES,
  ...IPHONE_GUIDES,
  ...TOOL_AND_MODE_GUIDES,
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
  // ── 2026 high-volume placeholder guides (Task 19) ──────────────────────────
  // Two very high-volume informational queries the site had no URL for. Both
  // are authored as full, self-contained guides (not stubs) so the pages carry
  // real value, structured sections and a working HowTo step list — which is
  // what keeps them indexable rather than Thin Content. `category`/`platform`
  // are declared explicitly so they land in the correct /blog filter tabs.
  {
    slug: "how-to-factory-reset-android-without-password",
    title: "How to Factory Reset Android Without a Password (2026 Guide)",
    description:
      "Factory reset an Android phone without the screen password using Settings, Recovery mode or hardware keys — then learn how to clear the FRP Google account lock that follows a wipe.",
    excerpt:
      "Locked out of your Android phone? You can factory reset it without the password from Recovery or hardware keys — but FRP asks for the Google account afterwards. Here is the full, honest picture.",
    datePublished: "2026-03-02",
    dateModified: "2026-03-02",
    readingMinutes: 7,
    category: "android",
    platform: "Android",
    brand: "Generic",
    model: "Android",
    androidVersions: ["13", "14", "15"],
    method: "manual",
    estimatedTime: "PT12M",
    prerequisites: [
      "The device charged above 30% so it does not drop out mid-wipe",
      "Your Google account credentials — or proof that you own the device",
      "A Windows 10 or 11 PC with FRPB installed (only needed to clear FRP afterwards)",
    ],
    keywords: [
      "how to factory reset android without password",
      "factory reset android without google account",
      "hard reset android locked phone",
      "factory reset from recovery mode android",
      "frp lock after factory reset",
    ],
    sections: [
      {
        heading: "What a factory reset does — and what it does not remove",
        paragraphs: [
          "A factory reset erases everything in the user data partition: apps, photos, messages and the screen lock credential (PIN, pattern or password). That is why a reset is the standard fix for a forgotten password when you can still reach the Settings menu, and the last resort when you cannot.",
          "What a reset does NOT remove is Factory Reset Protection. From Android 5.1 onward, a reset performed without the owner's sign-out leaves an FRP flag tied to the last Google account. The phone boots to the setup wizard and then refuses to continue until that same account is verified — even though the password that locked the screen is gone.",
        ],
      },
      {
        heading: "Reset from Settings when you still have access",
        steps: [
          "Open Settings → System → Reset options (the exact path varies by OEM skin).",
          "Choose Erase all data (factory reset) and confirm with your PIN, pattern or password.",
          "Wait for the device to reboot and show the setup wizard.",
          "If it asks for the previous Google account, jump to the FRP section below.",
        ],
      },
      {
        heading: "Reset from Recovery mode when the screen is locked",
        paragraphs: [
          "Every Android phone ships a stock Recovery menu that can wipe data without the screen password. The key combination differs by brand: Volume Up + Power on most devices, Volume Down + Power on some Samsung and Motorola models, and Volume Up + Volume Down + Power on many Pixel and Xiaomi units.",
        ],
        steps: [
          "Power the device off completely, then hold the recovery key combination for the model.",
          "At the bootloader or recovery screen, use the volume keys to move and Power to select.",
          "Choose Wipe data / factory reset, then confirm (on modern Android you may still be asked for the lock credential).",
          "Select Reboot system now — the device returns to the setup wizard.",
        ],
      },
      {
        heading: "The FRP catch: the Google account check after a wipe",
        paragraphs: [
          "If the phone was wiped without signing out of the owning Google account first, setup will stop at “Verify your account”. This is not a bug and not a leftover password — it is the anti-theft layer working as designed, and it is the single most common reason a reset does not feel like it “worked”.",
          "There are only two legitimate ways past it: sign in with the original Google account, or use a documented FRP bypass tool on a device you own or are authorised to repair.",
        ],
      },
      {
        heading: "Clearing FRP on a device you own with FRPB",
        steps: [
          "Download FRPB from frpb.in and install it on your Windows PC.",
          "Connect the phone over a quality USB data cable and let FRPB's Live Device Monitor detect the mode and chipset.",
          "Confirm the auto-detected model matches the handset in front of you.",
          "Click FRP Bypass and accept the authorised-owner disclaimer.",
          "Watch the live console until the phone reboots into the setup wizard with the account lock cleared.",
        ],
      },
      {
        heading: "When to stop and get the owner involved",
        paragraphs: [
          "FRPB is intended strictly for authorised device owners and licensed repair professionals. You must own the device or hold explicit written permission from its owner. Bypassing FRP on hardware you do not own may defeat an anti-theft control and can be illegal in your jurisdiction.",
          "If the phone belongs to someone else — a seller, a previous owner or a stranger — the correct route is to have that person sign in or remove the device from their Google account. No tool should be used to strip a lock you have no right to remove.",
        ],
      },
    ],
  },
  {
    slug: "fix-iphone-is-not-activated-message",
    title: "Fix the “iPhone Is Not Activated” Message (2026 Guide)",
    description:
      "Fix “iPhone is not activated” during setup: check the network, Apple servers, date and time and the Apple ID — plus how to tell a server error apart from Activation Lock.",
    excerpt:
      "“iPhone is not activated because the activation server cannot be reached” is usually a network or server hiccup — but it can also be Activation Lock. Here is how to tell them apart and fix each.",
    datePublished: "2026-03-02",
    dateModified: "2026-03-02",
    readingMinutes: 6,
    category: "iphone",
    platform: "iOS",
    brand: "Apple",
    model: "iPhone",
    osVersions: ["iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    estimatedTime: "PT10M",
    prerequisites: [
      "A stable Wi-Fi or cellular connection",
      "Your Apple ID and password, if the device is yours",
      "The original proof of purchase for any Activation Lock removal request",
    ],
    keywords: [
      "iphone is not activated",
      "activation server cannot be reached iphone",
      "iphone not activated after reset",
      "fix iphone activation error",
      "iphone activation lock vs server error",
    ],
    sections: [
      {
        heading: "Two very different problems behind one message",
        paragraphs: [
          "“iPhone is not activated because the activation server cannot be reached” and “This iPhone is linked to an Apple ID” both stop setup, but they are unrelated problems. The first is a connectivity or Apple-service hiccup that resolves in minutes. The second is Activation Lock, a server-side ownership check that only the Apple ID owner or Apple Support can clear.",
          "Reading the exact wording matters: if the message names an Apple ID or asks you to enter one, you are looking at Activation Lock. If it only mentions the activation server, the device itself is unlocked and the iPhone just cannot talk to Apple.",
        ],
      },
      {
        heading: "Quick fixes for the activation-server error",
        steps: [
          "Switch off Wi-Fi and use a different network, or the other way around — carrier IPs and captive portals are common culprits.",
          "Reboot the iPhone and the router, then retry the activation step.",
          "Check that the device date and time are correct, or set them to automatic — a skewed clock breaks the activation handshake.",
          "Restore the iPhone with Finder (macOS) or Apple Devices / iTunes (Windows) to force a clean activation attempt.",
          "Wait 15–30 minutes if apple.com/support/systemstatus shows an Apple activation-service incident, then retry.",
        ],
      },
      {
        heading: "If the device is Activation Locked",
        paragraphs: [
          "When setup asks for a specific Apple ID, the iPhone is tied to that account server-side and re-verifies it on every activation. There is no software bypass for a device you do not own, and FRPB does not offer one. The only legitimate routes are to recover the owning Apple ID or to ask Apple to clear the lock against proof of purchase.",
        ],
        steps: [
          "Try to recover the owning Apple ID at iforgot.apple.com — Activation Lock clears the moment the owner signs in.",
          "Gather the original proof of purchase (receipt, invoice or carrier contract).",
          "Submit an Activation Lock removal request at apple.com/support or at any Apple Store or Authorised Service Provider.",
          "Wait for Apple to verify the purchase and clear the lock server-side, then activate with your own Apple ID.",
        ],
      },
      {
        heading: "When the message is not fixable at home",
        paragraphs: [
          "If a device you bought second-hand asks for someone else's Apple ID, treat it as a red flag and stop. Ask the seller to remove the iPhone from their account and sign out of iCloud before you pay — a legitimate seller can always do this in front of you.",
          "FRPB publishes these iPhone guides to answer very high-volume searches honestly. We do not claim an iCloud or Activation Lock bypass for hardware you do not own, because no legitimate tool can clear an ownership check that Apple performs on its own servers.",
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
 * Internal-link shape shared with the SEO topic clusters.
 *
 * Structurally identical to `SeoLink` in `@/data/seo-clusters`, but declared
 * locally so the article route can hand links straight to `<TopicCluster>`
 * without importing the heavier cluster/keyword data graph.
 */
export interface BlogLink {
  path: string;
  anchor: string;
  blurb: string;
}

/**
 * Related-guides selector — the internal-link cluster shown in the article
 * footer.
 *
 * Ranks sibling posts by topical relevance so the cluster reinforces the
 * brand/category/method entity Google uses to decide whether a crawled URL
 * belongs in the index:
 *
 *   1. Same brand (two Samsung guides)          — strongest topical signal
 *   2. Same category tab (Samsung / Xiaomi / …) — same hub
 *   3. Same transport method (BROM / EDL / …)   — same procedure class
 *   4. Same platform (iOS vs Android)           — same audience
 *
 * The post itself is always excluded and results are de-duplicated by slug, so
 * a caller can pass a possibly-empty result to `<TopicCluster>` (which renders
 * nothing when empty) without guarding.
 */
export function relatedPosts(post: BlogPost, limit = 4): BlogLink[] {
  const category = categoryOf(post);
  const platform = platformOf(post);
  const brand = (post.brand ?? "").toLowerCase();

  const score = (other: BlogPost): number => {
    let s = 0;
    if (brand && (other.brand ?? "").toLowerCase() === brand) s += 8;
    if (categoryOf(other) === category) s += 4;
    if (post.method && other.method === post.method) s += 2;
    if (platformOf(other) === platform) s += 1;
    return s;
  };

  return BLOG_POSTS.filter((other) => other.slug !== post.slug)
    .map((other) => ({ other, rank: score(other) }))
    // Stable ranking: by relevance, then title for a deterministic order.
    .sort((a, b) => b.rank - a.rank || a.other.title.localeCompare(b.other.title))
    .slice(0, Math.max(0, limit))
    .map(({ other }) => ({
      path: `/blog/${other.slug}`,
      anchor: other.title,
      blurb: other.excerpt,
    }));
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
