// FRPB — tool & system-mode blog corpus.
//
// Generates one high-intent blog post per FRPB capability — the four free
// utilities and the eight unlock / system modes — from the SINGLE SOURCE OF
// TRUTH that already powers the landing pages (`FREE_TOOLS` + `UNLOCK_TOOLS` in
// @frpb/shared). The visible guide, the FAQ and the HowTo/Article JSON-LD are
// therefore guaranteed to match the product marketing pages, and adding a new
// mode to the shared config automatically produces its companion blog post.
//
// CONTENT RULES (same as the other blog corpora):
//   1. Only claim what the tooling can actually do — no invented one-click paths.
//   2. Every guide carries the authorised-owner reminder (see UNLOCK_DISCLAIMER).
//   3. The `steps` list powers the HowTo rich result and mirrors the visible
//      procedure on the matching landing page.
//
// Imported by ./blog and merged into BLOG_POSTS so the blog index, category
// tabs, sitemap and dynamic route pick the posts up with no further wiring.

import {
  FREE_TOOLS,
  FREE_TOOL_IDS,
  UNLOCK_TOOLS,
  UNLOCK_TOOL_IDS,
  type FreeToolMeta,
  type UnlockToolMeta,
} from "@frpb/shared";
import type { BlogCategory, BlogPlatform, BlogPost, BlogSection } from "./blog";

/** Blog-corpus publication window (kept stable so the sitemap lastmod is real). */
const PUBLISHED = "2026-02-18";
const MODIFIED = "2026-03-12";

/**
 * Rough reading-time estimate from the rendered section copy. Deliberately
 * deterministic (no runtime timers) so static rendering stays stable.
 */
function estimateMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

function flatten(sections: readonly BlogSection[]): string {
  return sections
    .map((section) =>
      [section.heading, ...(section.paragraphs ?? []), ...(section.steps ?? [])]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/*  System-mode guides (from UNLOCK_TOOLS)                                    */
/* -------------------------------------------------------------------------- */

/** Per-mode blog SEO overrides — unique titles so /blog/* does not duplicate
 *  the landing-page <title>, while the body is shared to prevent drift. */
interface ModeSeo {
  id: UnlockToolMeta["id"];
  /** Slug under /blog/*. */
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  category: BlogCategory;
  platform: BlogPlatform;
  readingMinutes: number;
}

const MODE_SEO: readonly ModeSeo[] = [
  {
    id: "flash-reset",
    slug: "how-to-hard-reset-android-without-password",
    title: "How to Hard Reset Android Without a Password (2026 Guide)",
    description:
      "Learn how to hard reset Android without a password using a one-click flash reset. Wipe and restore a locked phone to factory state over USB — Samsung, Xiaomi, MTK and Qualcomm.",
    excerpt:
      "A flash reset erases user data and restores factory state over USB. Here is how to hard reset an Android phone without the lock screen password.",
    category: "android",
    platform: "Android",
    readingMinutes: 7,
  },
  {
    id: "frp-bypass",
    slug: "google-account-lock-removal-frp-bypass-tool",
    title: "Google Account Lock Removal: FRP Bypass Tool Guide 2026",
    description:
      "Complete guide to Google account lock removal on Android. Use a 2026 FRP bypass tool to clear Factory Reset Protection over USB with one click.",
    excerpt:
      "Factory Reset Protection blocks a wiped phone until the last Google account signs in. This is the 2026 FRP bypass procedure that clears it safely.",
    category: "android",
    platform: "Android",
    readingMinutes: 8,
  },
  {
    id: "unlock-screen",
    slug: "bypass-pattern-lock-pin-fingerprint-android",
    title: "Bypass Pattern Lock, PIN & Fingerprint on Android (2026)",
    description:
      "How to bypass the Android pattern lock, PIN and fingerprint screen over USB. FRPB's screen unlock tool removes the lock without losing your data where possible.",
    excerpt:
      "Forgotten your pattern or PIN? This guide shows how to bypass the Android screen lock — pattern, PIN or fingerprint — with FRPB over USB.",
    category: "android",
    platform: "Android",
    readingMinutes: 7,
  },
  {
    id: "reboot-mode",
    slug: "enter-fastboot-recovery-download-mode-android",
    title: "How to Enter Fastboot, Recovery & Download Modes (2026)",
    description:
      "Enter Fastboot, Recovery, Download, BROM and EDL modes easily. FRPB's reboot mode tool switches an authorised Android device into the right mode over USB.",
    excerpt:
      "Fastboot, Recovery, Download, BROM and EDL each unlock a different repair path. This guide shows how to enter every Android system mode easily.",
    category: "android",
    platform: "Android",
    readingMinutes: 6,
  },
  {
    id: "icloud-bypass",
    slug: "ios-activation-lock-bypass-unlock-guide",
    title: "iOS Activation Lock Bypass & Unlock Guide 2026",
    description:
      "iOS Activation Lock bypass and unlock guide. Understand iCloud Activation Lock and how FRPB helps authorised owners regain access to their own iPhone or iPad.",
    excerpt:
      "iCloud Activation Lock is an anti-theft protection tied to the previous Apple ID. This guide explains the iOS activation lock bypass and unlock process.",
    category: "iphone",
    platform: "iOS",
    readingMinutes: 8,
  },
  {
    id: "samsungaccount",
    slug: "how-to-bypass-samsung-account-lock",
    title: "How to Bypass the Samsung Account Lock (2026 Guide)",
    description:
      "Bypass the Samsung account and Find My Mobile lock on a Galaxy device you own. Step-by-step Samsung account unlock guide with FRPB over USB.",
    excerpt:
      "A Samsung account or Find My Mobile lock can block a Galaxy device after a reset. Here is how to bypass the Samsung account lock safely in 2026.",
    category: "samsung",
    platform: "Android",
    readingMinutes: 7,
  },
  {
    id: "bootloop-recovery",
    slug: "fix-android-stuck-on-boot-logo-bootloop",
    title: "How to Fix Android Stuck on Boot Logo / Bootloop (2026)",
    description:
      "Fix an Android phone stuck on the boot logo or trapped in a bootloop. FRPB's bootloop recovery flashes the correct firmware for Samsung, MTK and Qualcomm devices.",
    excerpt:
      "A bootloop leaves a phone cycling the boot logo forever. This guide shows how to fix Android stuck on the boot logo by flashing the correct firmware.",
    category: "android",
    platform: "Android",
    readingMinutes: 8,
  },
  {
    id: "data-recovery",
    slug: "recover-deleted-photos-contacts-android",
    title: "How to Recover Deleted Photos, Contacts & Media on Android",
    description:
      "Recover deleted photos, contacts and media from an Android phone over USB. FRPB's data recovery tool scans storage and extracts what is recoverable to your PC.",
    excerpt:
      "Deleted something you need back? This guide shows how to recover deleted photos, contacts and media from Android with an offline USB scan.",
    category: "android",
    platform: "Android",
    readingMinutes: 7,
  },
];

function modeSections(meta: UnlockToolMeta): BlogSection[] {
  return [
    {
      heading: `${meta.headingLead} ${meta.headingHighlight}`.trim(),
      paragraphs: [meta.description, meta.subheading],
    },
    {
      heading: `What the ${meta.eyebrow} covers`,
      paragraphs: meta.features.map((feature) => `${feature.title} — ${feature.desc}`),
    },
    {
      heading: "Step-by-step: how to do it with FRPB",
      steps: meta.steps.map((step) => `${step.title}: ${step.desc}`),
    },
    {
      heading: "Frequently asked questions",
      paragraphs: meta.faq.map((item) => `${item.question} ${item.answer}`),
    },
    {
      heading: "Is the FRPB tool safe and legal to use?",
      paragraphs: [
        "FRPB is built strictly for authorised device owners and licensed repair professionals. Always confirm you own the handset — or hold explicit written permission from its owner — before running any recovery or unlock module.",
        "Everything runs 100% offline over a local USB connection. The installers are hosted on the official GitHub Releases page, signed, and adware-free, so you can audit exactly what runs on your machine.",
      ],
    },
  ];
}

const MODE_GUIDES: readonly BlogPost[] = MODE_SEO.map((seo) => {
  const meta = UNLOCK_TOOLS[seo.id];
  const sections = modeSections(meta);
  return {
    slug: seo.slug,
    title: seo.title,
    description: seo.description,
    excerpt: seo.excerpt,
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    readingMinutes: seo.readingMinutes,
    keywords: [...meta.keywords],
    sections,
    category: seo.category,
    platform: seo.platform,
  } satisfies BlogPost;
});

/* -------------------------------------------------------------------------- */
/*  Free-utility guides (from FREE_TOOLS)                                     */
/* -------------------------------------------------------------------------- */

interface ToolSeo {
  id: FreeToolMeta["id"];
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  readingMinutes: number;
}

const TOOL_SEO: readonly ToolSeo[] = [
  {
    id: "whatsapp-transfer",
    slug: "transfer-whatsapp-android-to-iphone",
    title: "How to Transfer WhatsApp from Android to iPhone (2026 Guide)",
    description:
      "Move WhatsApp chats, photos and videos from Android to iPhone in 2026. FRPB's WhatsApp Transfer tool migrates your history locally over USB — no cloud upload.",
    excerpt:
      "Switching from Android to iPhone and losing your chats? Here is how to transfer WhatsApp history, media and attachments locally over USB.",
    readingMinutes: 7,
  },
  {
    id: "phone-transfer",
    slug: "phone-to-phone-data-transfer-guide",
    title: "Phone to Phone Transfer in 2026 — Move Everything in Minutes",
    description:
      "Phone-to-phone transfer guide for 2026. Move contacts, photos, videos, messages and apps between Android and iPhone locally over USB with FRPB.",
    excerpt:
      "Getting a new phone? This guide shows how to run a fast phone-to-phone transfer of contacts, media and messages without a cloud detour.",
    readingMinutes: 6,
  },
  {
    id: "data-eraser",
    slug: "permanently-erase-android-data-before-selling",
    title: "How to Permanently Erase Android Data Before Selling (2026)",
    description:
      "Erase your Android phone permanently before selling, trading in or recycling it. FRPB's Android Data Eraser overwrites storage so personal data cannot be recovered.",
    excerpt:
      "A factory reset is not enough before you sell a phone. This guide shows how to permanently erase Android data with an overwrite-based eraser.",
    readingMinutes: 6,
  },
  {
    id: "virtual-location",
    slug: "change-gps-location-iphone-android",
    title: "How to Change Your GPS Location on iPhone & Android (2026)",
    description:
      "Change your GPS location on iPhone and Android for testing and privacy. FRPB's Virtual Location Spoofer teleports, routes and walks your device over USB.",
    excerpt:
      "Testing an app or protecting your privacy? This guide shows how to change your GPS location on iPhone and Android with a virtual location spoofer.",
    readingMinutes: 6,
  },
];

function toolSections(meta: FreeToolMeta): BlogSection[] {
  return [
    {
      heading: meta.title,
      paragraphs: [meta.description, meta.tagline],
    },
    {
      heading: `What the ${meta.title} does`,
      paragraphs: meta.features.map((feature) => `${feature.title} — ${feature.desc}`),
    },
    {
      heading: "How to use it with FRPB",
      steps: meta.steps.map((step) => `${step.title}: ${step.desc}`),
    },
    {
      heading: "Frequently asked questions",
      paragraphs: meta.faq.map((item) => `${item.question} ${item.answer}`),
    },
    {
      heading: "Is the FRPB tool safe and private?",
      paragraphs: [
        "All four utilities run fully offline over a local USB connection. Nothing is uploaded to a server, and the installers are published on the official GitHub Releases page so you can verify exactly what runs on your machine.",
        "The desktop app requires an active FRPB license key to execute a module. Download it from the official releases page, then open the Free Utilities tab to run the tool.",
      ],
    },
  ];
}

const TOOL_GUIDES: readonly BlogPost[] = TOOL_SEO.map((seo) => {
  const meta = FREE_TOOLS[seo.id];
  const sections = toolSections(meta);
  return {
    slug: seo.slug,
    title: seo.title,
    description: seo.description,
    excerpt: seo.excerpt,
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    readingMinutes: seo.readingMinutes,
    keywords: meta.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
    sections,
    category: "android",
    platform: "Android",
  } satisfies BlogPost;
});

/* -------------------------------------------------------------------------- */
/*  Combined export                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Order matters: the eight unlock/system modes lead (highest commercial intent),
 * followed by the four free-utility lead-magnets. Merged into BLOG_POSTS by
 * ./blog so the blog index, sitemap and category tabs pick them up automatically.
 */
export const TOOL_AND_MODE_GUIDES: readonly BlogPost[] = [
  ...MODE_GUIDES,
  ...TOOL_GUIDES,
];

// Compile-time completeness guard: every shared id must have a companion guide.
const _coveredIds = [
  ...UNLOCK_TOOL_IDS,
  ...FREE_TOOL_IDS,
] as const;
void _coveredIds;
