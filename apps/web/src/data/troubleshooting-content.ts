// FRPB — troubleshooting "how-to" spoke content for the Phone Unlock hub.
//
// Data-only module (no JSX / no React) so it can be consumed by route files
// for both metadata and JSON-LD wiring, and by the sitemap route without
// pulling in the icon runtime.
//
// These are the informational, high-volume troubleshooting spokes that feed the
// commercial pillar hubs (`/tools/frp-bypass`, `/tools/phone-unlock`). Each entry
// is a complete, self-contained guide so the spoke renders a unique <title>,
// meta description, canonical and HowTo / FAQPage JSON-LD.

import type { FaqItem } from "@/lib/faq";

/** Icon key resolved to a lucide component by the rendering surface. */
export interface TroubleshootingFeature {
  icon: string;
  title: string;
  desc: string;
}

/** A numbered step in the on-page procedure (also the HowTo step). */
export interface TroubleshootingStep {
  title: string;
  desc: string;
}

/** Internal cross-link to a related guide or hub (topic-cluster crawl path). */
export interface TroubleshootingLink {
  path: string;
  anchor: string;
  blurb: string;
}

/** Complete view model for one troubleshooting spoke. */
export interface TroubleshootingContent {
  /** Canonical route path beginning with "/". */
  path: string;
  /** SEO <title> (root layout appends the "· FRPB" template). */
  title: string;
  /** Meta description + hero standfirst. */
  description: string;
  /** Focus keyword set. */
  keywords: string[];
  eyebrow: string;
  headingLead: string;
  headingHighlight: string;
  subheading: string;
  features: TroubleshootingFeature[];
  steps: TroubleshootingStep[];
  faq: FaqItem[];
  related: TroubleshootingLink[];
}

/** Canonical ids for the Android troubleshooting spokes. */
export type TroubleshootingId = "reset-redmi-phone" | "factory-reset-android";

const resetRedmiPhone: TroubleshootingContent = {
  path: "/tools/phone-unlock/reset-redmi-phone",
  title: "How to Reset a Redmi Phone 2026 — Full Guide (Locked or Unlocked)",
  description:
    "Step-by-step guide to reset a Redmi phone in 2026 — soft reset, recovery-mode factory reset and FRP-safe wipe for a Redmi device you own. Works on MIUI and HyperOS.",
  keywords: [
    "how to reset redmi phone",
    "redmi factory reset",
    "reset redmi phone without password",
    "redmi hard reset",
    "miui factory reset",
    "hyperos reset redmi",
    "redmi frp reset",
  ],
  eyebrow: "How to Reset a Redmi Phone",
  headingLead: "How to Reset a",
  headingHighlight: "Redmi Phone",
  subheading:
    "Reset a Redmi phone you own — from a quick soft reset to a full recovery-mode factory reset — and keep it FRP-safe so you can sign back in with your own Google account on MIUI 12–14 and HyperOS.",
  features: [
    {
      icon: "RefreshCw",
      title: "Soft Reset First",
      desc: "Covers the fast Settings → Factory reset path for a Redmi that still boots and is signed in to you.",
    },
    {
      icon: "ShieldCheck",
      title: "FRP-Safe Wipe",
      desc: "Explains how to remove your Google account before wiping so the reset never trips Factory Reset Protection.",
    },
    {
      icon: "Smartphone",
      title: "MIUI & HyperOS",
      desc: "Applies to Redmi Note, Redmi number series and POCO devices running MIUI 12–14 and HyperOS.",
    },
    {
      icon: "Usb",
      title: "Recovery Fallback",
      desc: "Covers the power + volume-up Recovery wipe for a Redmi that will not boot into the OS.",
    },
  ],
  steps: [
    {
      title: "Remove your Google account first",
      desc: "On a Redmi you still control, go to Settings → Accounts and remove your Google account. This is what keeps the reset FRP-safe.",
    },
    {
      title: "Open Settings → About phone → Factory reset",
      desc: "In MIUI or HyperOS, open Settings → About phone → Factory reset → Erase all data. Confirm and let the Redmi wipe user data.",
    },
    {
      title: "If it will not boot, use Recovery mode",
      desc: "Power off, then hold Power + Volume Up until the Redmi/MI logo appears, choose Wipe Data → Wipe All Data, and confirm.",
    },
    {
      title: "Sign back in with your own account",
      desc: "After the Redmi reboots, complete setup with the same Google account you used before so Factory Reset Protection is satisfied.",
    },
  ],
  faq: [
    {
      question: "How do I reset a Redmi phone without a password?",
      answer:
        "On a Redmi you own, a password reset is done through Recovery mode: power off, hold Power + Volume Up, then choose Wipe Data → Wipe All Data. This erases the lock but requires signing back in with the original Google account to pass FRP.",
    },
    {
      question: "Will a factory reset remove FRP on my Redmi?",
      answer:
        "No. Android's Factory Reset Protection (FRP) is a Google account lock, not a screen lock. A reset removes your data but FRP still asks for the last Google account — which is why you remove your account BEFORE resetting, or use an FRP bypass tool on a device you own.",
    },
    {
      question: "Does this work on MIUI and HyperOS?",
      answer:
        "Yes. The Settings path and the Recovery-mode wipe are the same across MIUI 12–14 and HyperOS on Redmi Note, Redmi number series and POCO devices.",
    },
  ],
  related: [
    {
      path: "/tools/phone-unlock/factory-reset-android",
      anchor: "How to factory reset Android without a password",
      blurb: "The generic Recovery-mode reset that works on Samsung, Xiaomi, Vivo and more.",
    },
    {
      path: "/tools/phone-unlock",
      anchor: "Phone Unlock Tools Hub",
      blurb: "Every FRPB unlock, reset and recovery module for Android phones.",
    },
    {
      path: "/tools/frp-bypass",
      anchor: "FRP Bypass Hub",
      blurb: "Remove the Google FRP lock on a phone you own when the account is unknown.",
    },
  ],
};

const factoryResetAndroid: TroubleshootingContent = {
  path: "/tools/phone-unlock/factory-reset-android",
  title: "How to Factory Reset Android Without a Password 2026 — Guide",
  description:
    "Factory reset Android without a password in 2026 using Recovery mode, plus the FRP-safe steps that stop Factory Reset Protection locking the phone after a wipe.",
  keywords: [
    "how to factory reset android without password",
    "factory reset android without password",
    "reset android phone without password",
    "hard reset android",
    "android recovery mode factory reset",
    "factory reset locked android",
  ],
  eyebrow: "Factory Reset Android — No Password",
  headingLead: "Factory Reset Android",
  headingHighlight: "Without a Password",
  subheading:
    "Wipe an Android phone you own without its screen password using Recovery mode, and follow the FRP-safe order of operations so the reset does not leave the device stuck on the Google verification screen.",
  features: [
    {
      icon: "RefreshCw",
      title: "Recovery-Mode Wipe",
      desc: "The hardware-key combination that reaches the wipe-data screen without unlocking the phone.",
    },
    {
      icon: "ShieldCheck",
      title: "FRP-Safe Order",
      desc: "Shows the exact sequence that avoids tripping Factory Reset Protection after the wipe.",
    },
    {
      icon: "Smartphone",
      title: "Any Android OEM",
      desc: "Samsung, Xiaomi/Redmi, Vivo, OPPO, realme, Motorola and Pixel — the keys differ, the flow does not.",
    },
    {
      icon: "Usb",
      title: "Tool-Assisted Option",
      desc: "When Recovery is locked, FRPB's Flash Reset performs the same wipe over USB on a device you own.",
    },
  ],
  steps: [
    {
      title: "Charge and power off the phone",
      desc: "Charge above 50% and power the Android device off completely before starting the reset.",
    },
    {
      title: "Boot into Recovery mode",
      desc: "Hold the OEM key combo — usually Power + Volume Up (Samsung: Power + Bixby + Volume Up) — until the Recovery menu appears.",
    },
    {
      title: "Wipe data / factory reset",
      desc: "Use the volume keys to highlight Wipe Data / Factory Reset and the power key to confirm, then choose to erase all user data.",
    },
    {
      title: "Reboot and satisfy FRP",
      desc: "Reboot the device and sign in with the original Google account. If the account is unknown, use an FRP bypass tool on a device you own.",
    },
  ],
  faq: [
    {
      question: "Can I factory reset Android without the password?",
      answer:
        "Yes, on a device you own. Recovery mode (power + volume keys) reaches Wipe Data / Factory Reset without needing the screen password — but Android's Factory Reset Protection still requires the last Google account afterwards.",
    },
    {
      question: "Why does the phone ask for the Google account after the reset?",
      answer:
        "That is Factory Reset Protection. Android remembers the Google account that was signed in and asks for it after a wipe to prove ownership. Signing in with the same account clears it.",
    },
    {
      question: "What if Recovery mode is locked too?",
      answer:
        "Some devices ship with Recovery locked. FRPB's Flash Reset performs an equivalent factory wipe over USB on a device you are authorised to service, then guides you back through FRP.",
    },
  ],
  related: [
    {
      path: "/tools/phone-unlock/reset-redmi-phone",
      anchor: "How to reset a Redmi phone",
      blurb: "The Redmi-specific MIUI and HyperOS reset walkthrough.",
    },
    {
      path: "/tools/phone-unlock",
      anchor: "Phone Unlock Tools Hub",
      blurb: "Every FRPB unlock, reset and recovery module for Android phones.",
    },
    {
      path: "/tools/frp-bypass",
      anchor: "FRP Bypass Hub",
      blurb: "Remove the Google FRP lock on a phone you own when the account is unknown.",
    },
  ],
};

/** All troubleshooting spokes, keyed by canonical id. */
export const TROUBLESHOOTING_GUIDES: Record<TroubleshootingId, TroubleshootingContent> = {
  "reset-redmi-phone": resetRedmiPhone,
  "factory-reset-android": factoryResetAndroid,
};

/** Ordered id list (stable for sitemap + navigation). */
export const TROUBLESHOOTING_GUIDE_IDS: TroubleshootingId[] = [
  "reset-redmi-phone",
  "factory-reset-android",
];

/** All troubleshooting spokes in declaration order. */
export const TROUBLESHOOTING_LIST: TroubleshootingContent[] =
  TROUBLESHOOTING_GUIDE_IDS.map((id) => TROUBLESHOOTING_GUIDES[id]);

/** Sitemap route descriptors (path + crawl hints) for the troubleshooting spokes. */
export const TROUBLESHOOTING_ROUTES: {
  path: string;
  changeFrequency: "monthly";
  priority: number;
}[] = TROUBLESHOOTING_LIST.map((guide) => ({
  path: guide.path,
  changeFrequency: "monthly",
  priority: 0.6,
}));

/** Resolve a troubleshooting spoke by its full path. */
export function getTroubleshootingGuide(
  path: string,
): TroubleshootingContent | undefined {
  return TROUBLESHOOTING_LIST.find((guide) => guide.path === path);
}

/** Sibling links (excludes the given path) for topic-cluster internal linking. */
export function troubleshootingLinks(excludePath?: string): TroubleshootingLink[] {
  return TROUBLESHOOTING_LIST.filter((guide) => guide.path !== excludePath).map(
    (guide) => ({
      path: guide.path,
      anchor: guide.title.replace(/\s*2026.*$/, "").trim(),
      blurb: guide.description,
    }),
  );
}
