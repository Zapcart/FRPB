// FRPB — iOS (iPhone & iPad) SEO hub + spoke content (data layer).
//
// Apple devices are intentionally NOT part of the programmatic Android device
// matrix (`data/seo-matrix.ts`), which is derived from the shared `KNOWN_MODELS`
// registry. Adding Apple there would generate false "iCloud bypass tool" spokes
// for an Android-only application and violate the iOS accuracy rules.
//
// Instead, iOS coverage lives here as an honest, owner-focused learn hub that
// routes visitors to the authoritative FRPB blog guides — never claiming iOS
// bypass capability.
//
// Pure + dependency-free (mirrors `config/brand-pages.ts`) so it can be imported
// by the sitemap and `generateStaticParams` without pulling in React.

import type { BrandIconKey } from "@/config/brand-pages";
import type { SeoLink } from "./seo-clusters";

/** Canonical hub path for the iOS learn cluster. */
export const IOS_HUB_PATH = "/ios";

/**
 * Explicit accuracy notice rendered on every iOS page. FRPB is an Android
 * Factory Reset Protection toolkit and has no iOS capability, so iOS pages are
 * educational owner guides rather than tool claims.
 */
export const IOS_ACCURACY_NOTICE =
  "FRPB is an Android FRP toolkit and does not bypass iCloud, Activation Lock or any iOS security feature. These iOS pages are educational guides for device owners, and every removal path below runs through Apple's official support channels.";

export interface IosFeature {
  icon: BrandIconKey;
  title: string;
  desc: string;
}

export interface IosStep {
  title: string;
  desc: string;
}

export interface IosFaq {
  question: string;
  answer: string;
}

/** Shared, render-ready shape for the iOS hub and its spokes. */
export interface IosPageContent {
  path: string;
  eyebrow: string;
  headingLead: string;
  headingHighlight: string;
  subheading: string;
  features: readonly IosFeature[];
  steps: readonly IosStep[];
  faq: readonly IosFaq[];
}

/** A single iOS spoke (topic landing page under `/ios`). */
export interface IosSpoke extends IosPageContent {
  /** URL segment below `/ios`, e.g. "ipad-activation-lock-removal". */
  slug: string;
  /** Full page title (the layout template appends “· FRPB”). */
  title: string;
  description: string;
  keywords: readonly string[];
  /** Blog guide slugs (relative to `/blog/`) that support this spoke. */
  guideSlugs: readonly string[];
}

/** The `/ios` hub page record. */
export interface IosHub extends IosPageContent {
  title: string;
  description: string;
  keywords: readonly string[];
}

/** Shared owner-flow steps referenced by more than one iOS spoke. */
const OWNER_REMOVAL_STEPS: readonly IosStep[] = [
  {
    title: "Confirm you are the owner",
    desc: "Activation Lock and iCloud Lock are anti-theft features. Only the original Apple ID holder can remove them — there is no legitimate third-party bypass.",
  },
  {
    title: "Recover the Apple ID password",
    desc: "Try Apple's account recovery at iforgot.apple.com first. Most locks clear the moment the original credentials are entered on the device.",
  },
  {
    title: "Remove the device from Find My",
    desc: "From a trusted device or iCloud.com, sign in, open Find My, select the device and choose Remove This Device to clear Activation Lock.",
  },
  {
    title: "Use Apple official support",
    desc: "If the Apple ID is unrecoverable and you hold the original proof of purchase, Apple Support can reset Activation Lock directly.",
  },
];

const OWNER_FAQ: readonly IosFaq[] = [
  {
    question: "Can FRPB bypass iCloud Activation Lock?",
    answer:
      "No. FRPB is an Android Factory Reset Protection toolkit and has no iOS capability. This page explains the legitimate, owner-only removal paths Apple provides.",
  },
  {
    question: "Who is allowed to remove Activation Lock?",
    answer:
      "Only the person who owns the device and controls the Apple ID on it, or an Apple-authorised service provider acting on their behalf with proof of purchase.",
  },
  {
    question: "Why can't a tool just remove Activation Lock?",
    answer:
      "Activation Lock is enforced by Apple's servers against the secure enclave. It cannot be cleared offline by any software, so any app claiming to do so is a scam or malware.",
  },
];

/** The `/ios` hub. */
export const IOS_HUB: IosHub = {
  path: IOS_HUB_PATH,
  title: "iOS Activation Lock & iCloud Removal Hub 2026 — iPhone & iPad",
  description:
    "Owner-focused guides to remove iCloud Activation Lock on iPhone and iPad, clear passcode and Face ID locks, and understand Activation Lock on iOS 16, 17 and 18. Official, legitimate removal paths only.",
  keywords: [
    "icloud activation lock removal",
    "ios activation lock 2026",
    "iphone activation lock removal",
    "ipad icloud bypass",
    "apple id lock removal",
    "remove activation lock ios 18",
  ],
  eyebrow: "iOS Guides — iPhone & iPad",
  headingLead: "iOS Activation Lock &",
  headingHighlight: "iCloud Removal Hub",
  subheading:
    "Legitimate, owner-first removal paths for iCloud Activation Lock, passcode and Face ID locks across iPhone and iPad — with honest guidance on what Apple will and will not do.",
  features: [
    {
      icon: "Smartphone",
      title: "iPhone X → 15 & iPad",
      desc: "Covers every iPhone generation from the X to the 15 series plus current iPad models.",
    },
    {
      icon: "ShieldCheck",
      title: "Owner-Only Removal",
      desc: "Every path requires the original Apple ID or verifiable proof of purchase.",
    },
    {
      icon: "KeyRound",
      title: "Passcode & Face ID",
      desc: "Forgotten-passcode and biometric lock recovery steps that stay within Apple's terms.",
    },
    {
      icon: "Sparkles",
      title: "iOS 16 / 17 / 18",
      desc: "What changed across recent iOS releases and how it affects lock removal in 2026.",
    },
  ],
  steps: OWNER_REMOVAL_STEPS,
  faq: [
    ...OWNER_FAQ,
    {
      question: "Does the FRPB Android tool work on iPhone?",
      answer:
        "No. FRPB is a Windows toolkit for Android Factory Reset Protection. For iPhone and iPad you should follow the iOS guides here and Apple's official recovery flows.",
    },
  ],
};

/** All iOS spokes, in canonical display order. */
export const IOS_SPOKES: readonly IosSpoke[] = [
  {
    slug: "icloud-activation-lock-removal",
    path: `${IOS_HUB_PATH}/icloud-activation-lock-removal`,
    title: "iCloud Activation Lock Removal 2026 — iPhone Guide",
    description:
      "How to remove iCloud Activation Lock on an iPhone you own: recover the Apple ID, clear Find My, and use Apple Support when the account is unrecoverable. Legitimate owner paths only.",
    keywords: [
      "icloud activation lock removal",
      "remove icloud lock iphone",
      "iphone activation lock removal 2026",
      "apple id activation lock",
      "turn off activation lock iphone",
    ],
    eyebrow: "iPhone — iCloud Activation Lock",
    headingLead: "iPhone iCloud Activation Lock",
    headingHighlight: "Removal Guide",
    subheading:
      "Work through Activation Lock on an iPhone you own using Apple's official recovery paths — from resetting the Apple ID password to a proof-of-purchase unlock through Apple Support.",
    features: [
      {
        icon: "ShieldCheck",
        title: "Owner Verification",
        desc: "Confirm the Apple ID and device ownership before any removal step.",
      },
      {
        icon: "KeyRound",
        title: "Apple ID Recovery",
        desc: "Reset the account password at iforgot.apple.com to clear the lock instantly.",
      },
      {
        icon: "Smartphone",
        title: "Find My Removal",
        desc: "Sign out of iCloud and select Remove This Device to clear Activation Lock.",
      },
      {
        icon: "Usb",
        title: "Proof-of-Purchase Path",
        desc: "Escalate to Apple Support when the original Apple ID is truly unrecoverable.",
      },
    ],
    steps: OWNER_REMOVAL_STEPS,
    faq: OWNER_FAQ,
    guideSlugs: [
      "how-to-bypass-icloud-activation-lock-iphone-13-14-15-2026",
      "how-to-bypass-icloud-activation-lock-iphone-12-2026",
      "how-to-bypass-icloud-activation-lock-iphone-11-2026",
      "iphone-stuck-on-activation-lock-after-reset-2026",
    ],
  },
  {
    slug: "ipad-activation-lock-removal",
    path: `${IOS_HUB_PATH}/ipad-activation-lock-removal`,
    title: "iPad iCloud Activation Lock Removal 2026 — Owner's Guide",
    description:
      "Remove iCloud Activation Lock on an iPad you own: Apple ID recovery, Find My removal and Apple Support escalation for a proof-of-purchase unlock. No fake bypass tools.",
    keywords: [
      "ipad icloud bypass",
      "ipad activation lock removal",
      "remove icloud lock ipad",
      "ipad pro activation lock 2026",
      "ipad air icloud removal",
    ],
    eyebrow: "iPad — iCloud Activation Lock",
    headingLead: "iPad Activation Lock",
    headingHighlight: "Removal Guide",
    subheading:
      "Clear Activation Lock on an iPad you own using Apple's official tools and support channels, with the same owner-first steps Apple uses for iPhone.",
    features: [
      {
        icon: "Smartphone",
        title: "iPad & iPad Pro",
        desc: "Applies to iPad, iPad Air, iPad mini and iPad Pro on current iPadOS.",
      },
      {
        icon: "ShieldCheck",
        title: "Ownership First",
        desc: "Removal requires the original Apple ID or valid proof of purchase.",
      },
      {
        icon: "KeyRound",
        title: "Apple ID Recovery",
        desc: "Reset the account at iforgot.apple.com to unlock the iPad immediately.",
      },
      {
        icon: "Terminal",
        title: "Apple Support Path",
        desc: "Documented escalation route for unrecoverable Apple ID scenarios.",
      },
    ],
    steps: OWNER_REMOVAL_STEPS,
    faq: OWNER_FAQ,
    guideSlugs: [
      "ipad-icloud-activation-lock-removal-2026",
      "check-icloud-activation-lock-before-buying-used-iphone-2026",
      "ios-16-17-18-activation-lock-2026",
    ],
  },
  {
    slug: "iphone-passcode-face-id-unlock",
    path: `${IOS_HUB_PATH}/iphone-passcode-face-id-unlock`,
    title: "Forgotten iPhone Passcode & Face ID Unlock 2026",
    description:
      "Forgotten iPhone passcode or Face ID lock? Legitimate owner options: erase-and-restore, iCloud recovery and Apple Support — with a clear warning about fake unlock tools.",
    keywords: [
      "iphone forgotten passcode unlock",
      "face id lock removal",
      "iphone passcode unlock 2026",
      "reset iphone without passcode",
      "iphone screen lock removal owner",
    ],
    eyebrow: "iPhone — Passcode & Face ID",
    headingLead: "iPhone Passcode & Face ID",
    headingHighlight: "Unlock Guide",
    subheading:
      "Recover a forgotten iPhone passcode or biometric lock through Apple's supported erase-and-restore paths, and understand the trade-offs of each option.",
    features: [
      {
        icon: "KeyRound",
        title: "Passcode Recovery",
        desc: "Erase-and-restore via Finder, iTunes or iCloud when the code is lost.",
      },
      {
        icon: "ShieldCheck",
        title: "Secure Enclave",
        desc: "Passcode and Face ID data are hardware-bound and cannot be extracted.",
      },
      {
        icon: "Smartphone",
        title: "Face ID / Touch ID",
        desc: "Re-configure biometrics after a legitimate erase-and-restore cycle.",
      },
      {
        icon: "Wrench",
        title: "Account Recovery",
        desc: "Use Apple ID recovery to restore access without losing backups.",
      },
    ],
    steps: [
      {
        title: "Confirm device ownership",
        desc: "Passcode removal requires the Apple ID or proof of purchase for the iPhone — the lock protects the owner's data.",
      },
      {
        title: "Try your Apple ID recovery",
        desc: "If Face ID or passcode is failing, recover the Apple ID at iforgot.apple.com so your iCloud backup stays reachable.",
      },
      {
        title: "Erase and restore",
        desc: "Use Finder, iTunes or iCloud Erase iPhone to reset the passcode, then restore from your backup.",
      },
      {
        title: "Re-enrol biometrics",
        desc: "After the restore, set a new passcode and re-enrol Face ID or Touch ID from Settings.",
      },
    ],
    faq: [
      ...OWNER_FAQ,
      {
        question: "Will I lose my data by removing the passcode?",
        answer:
          "Removing a forgotten iPhone passcode via erase-and-restore wipes the device. Restore from an iCloud or computer backup to bring your data back.",
      },
    ],
    guideSlugs: [
      "iphone-forgotten-passcode-face-id-unlock-2026",
      "iphone-stuck-on-activation-lock-after-reset-2026",
      "how-to-bypass-icloud-activation-lock-iphone-13-14-15-2026",
    ],
  },
  {
    slug: "ios-16-17-18-activation-lock",
    path: `${IOS_HUB_PATH}/ios-16-17-18-activation-lock`,
    title: "iOS 16, 17 & 18 Activation Lock Guide 2026",
    description:
      "How Activation Lock and iCloud behavior changed across iOS 16, iOS 17 and iOS 18, and what those changes mean for legitimate owner-side lock removal in 2026.",
    keywords: [
      "ios 18 activation lock",
      "ios 17 icloud lock",
      "ios 16 activation lock",
      "activation lock changes ios",
      "apple id lock ios 18 2026",
    ],
    eyebrow: "iOS 16 / 17 / 18 — Activation Lock",
    headingLead: "iOS 16, 17 & 18",
    headingHighlight: "Activation Lock Guide",
    subheading:
      "Track how Apple hardened Activation Lock and iCloud across recent iOS releases, and how those shifts affect the owner-side removal steps you can take today.",
    features: [
      {
        icon: "Cpu",
        title: "Release-by-Release",
        desc: "What changed in Activation Lock behaviour from iOS 16 through iOS 18.",
      },
      {
        icon: "ShieldCheck",
        title: "Stolen Device Protection",
        desc: "How iOS 17.3's security delay tightens Apple ID and passcode changes.",
      },
      {
        icon: "KeyRound",
        title: "Recovery Contacts",
        desc: "Using Apple's Account Recovery to regain a locked Apple ID in 2026.",
      },
      {
        icon: "Sparkles",
        title: "Future-Proof Steps",
        desc: "Owner guidance that stays valid as Apple ships new iOS releases.",
      },
    ],
    steps: OWNER_REMOVAL_STEPS,
    faq: OWNER_FAQ,
    guideSlugs: [
      "ios-16-17-18-activation-lock-2026",
      "check-icloud-activation-lock-before-buying-used-iphone-2026",
      "ipad-icloud-activation-lock-removal-2026",
    ],
  },
];

/** `generateStaticParams` payload for `/ios/[topic]`. */
export const IOS_SPOKE_PARAMS: readonly { topic: string }[] = IOS_SPOKES.map(
  (spoke) => ({ topic: spoke.slug }),
);

/** Canonical paths of every iOS spoke (feeds the sitemap). */
export const IOS_SPOKE_PATHS: readonly string[] = IOS_SPOKES.map((s) => s.path);

/** Resolve an iOS spoke by its `[topic]` slug. */
export function getIosSpoke(slug: string): IosSpoke | undefined {
  return IOS_SPOKES.find((spoke) => spoke.slug === slug);
}

/**
 * Hub → spoke internal-link graph with exact-match anchors (SEO Hack 4/5/12).
 * Optionally excludes one path (e.g. the spoke currently being rendered).
 */
export function iosHubLinks(excludePath?: string): SeoLink[] {
  return IOS_SPOKES.filter((spoke) => spoke.path !== excludePath).map((spoke) => ({
    path: spoke.path,
    anchor: spoke.eyebrow,
    blurb: spoke.description,
  }));
}
