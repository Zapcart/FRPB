// FRPB — pillar hub (Hub & Spoke) content for the tools cluster.
//
// Data-only module (no JSX / no React / no lucide imports) so it can be
// consumed by the route files in `apps/web`, by `generateMetadata` and by the
// `/sitemap.xml` route without pulling in the icon runtime.
//
// The three pillar hubs are the commercial tops of the topic clusters designed
// in T12-ARCH:
//   * `/tools/frp-bypass`     — FRP (Google lock) removal pillar
//   * `/tools/phone-unlock`   — Android unlock / reset pillar
//   * `/tools/icloud-bypass`  — iOS Activation Lock pillar (owner-only, honest)
//
// Every hub carries a 2026-fresh title/description (Android 15/16, iOS 17/18),
// an explicit "Proof of Ownership" trust notice (E-E-A-T) and the HowTo /
// FAQPage copy that the shared <PillarHubPage> renders and emits as JSON-LD.

import { IOS_FAQ, type FaqItem } from "@/lib/faq";

/** A hero/benefit bullet rendered as an icon + copy row. */
export interface PillarHubFeature {
  /** lucide-react icon name, resolved by the shared view (never imported here). */
  icon: string;
  title: string;
  desc: string;
}

/** A numbered step in the on-page procedure (also the HowTo step). */
export interface PillarHubStep {
  title: string;
  desc: string;
}

/** Ownership / authorisation trust notice (E-E-A-T). */
export interface PillarHubNotice {
  title: string;
  body: string;
}

/** Complete view model for one pillar hub. */
export interface PillarHubContent {
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
  features: PillarHubFeature[];
  steps: PillarHubStep[];
  faq: FaqItem[];
  notice: PillarHubNotice;
}

/** Canonical ids for the three pillar hubs. */
export type PillarHubId = "frp-bypass" | "phone-unlock" | "icloud-bypass";

const frpBypass: PillarHubContent = {
  path: "/tools/frp-bypass",
  title: "FRP Bypass Tool 2026 — Google Lock Removal for Android 15 & 16",
  description:
    "FRP bypass tool for 2026: remove the Google Factory Reset Protection lock on Samsung, Xiaomi, Vivo, Motorola and more over USB. Works on Android 10 through Android 16 — free Windows app for devices you own.",
  keywords: [
    "frp bypass tool",
    "frp bypass 2026",
    "google frp lock removal",
    "frp bypass android 15",
    "frp bypass android 16",
    "remove google account lock",
    "android frp tool",
    "samsung frp bypass tool",
  ],
  eyebrow: "FRP Bypass Hub",
  headingLead: "FRP Bypass Tool for",
  headingHighlight: "Android 15 & 16 (2026)",
  subheading:
    "Remove the Google Factory Reset Protection lock from an Android phone you own — one-click over USB, across Samsung, Xiaomi, Vivo, OPPO, realme, Motorola and Pixel, on Android 10 through Android 16.",
  features: [
    {
      icon: "Zap",
      title: "One-Click FRP Removal",
      desc: "FRPB detects the connected device over USB and clears the Google FRP lock in a single click — no manual ADB commands.",
    },
    {
      icon: "Smartphone",
      title: "Android 10 → 16",
      desc: "Tuned for the Android 15 and Android 16 security patches across every supported OEM.",
    },
    {
      icon: "Cpu",
      title: "Qualcomm, MediaTek & Exynos",
      desc: "Auto-selects Download, Recovery, EDL or fastboot mode for the connected chipset.",
    },
    {
      icon: "ShieldCheck",
      title: "Own-Device Only",
      desc: "Built for owners and repair technicians — no account credentials and no network calls during the bypass.",
    },
  ],
  steps: [
    {
      title: "Confirm you own the device",
      desc: "FRPB is for phones you own or are authorised to service. Have the device and a USB data cable ready.",
    },
    {
      title: "Install FRPB and connect over USB",
      desc: "Download the Windows app, launch it and connect the Android phone. FRPB installs the correct driver automatically.",
    },
    {
      title: "Run the one-click FRP bypass",
      desc: "Pick the detected phone and click Bypass FRP. FRPB walks the device through the removal and reports each stage live.",
    },
    {
      title: "Finish Google setup with your account",
      desc: "When the phone reboots to setup, sign in with your own Google account to complete activation on Android 15/16.",
    },
  ],
  faq: [
    {
      question: "What is an FRP bypass tool?",
      answer:
        "An FRP bypass tool removes Android's Factory Reset Protection — the Google account lock Android applies after a factory reset. FRPB detects a connected phone over USB and clears that lock so an authorised owner can use the device again.",
    },
    {
      question: "Does this FRP bypass work on Android 15 and Android 16?",
      answer:
        "Yes. FRPB is updated for the 2026 Android 15 and Android 16 security patches across Samsung, Xiaomi, Vivo, OPPO, realme, Motorola and Pixel, as well as older Android 10–14 builds.",
    },
    {
      question: "Do I need the previous Google account to run the bypass?",
      answer:
        "No. The bypass is designed for the case where the previous account is unknown — but you must own the device or be a technician authorised to service it.",
    },
    {
      question: "Is FRP bypass legal?",
      answer:
        "It is legal only on a device you own or are explicitly authorised to service. Using an FRP bypass on hardware you do not own can defeat anti-theft protections and violate the law in your jurisdiction.",
    },
  ],
  notice: {
    title: "Proof of Ownership / Own-Device Authorization",
    body: "Run FRPB only on a phone you own or have written authorisation to service. FRPB performs no device-attestation bypass and makes no network calls during the unlock — it is a recovery utility, not an anti-theft defeat tool.",
  },
};

const phoneUnlock: PillarHubContent = {
  path: "/tools/phone-unlock",
  title: "Phone Unlock Tools 2026 — Screen Lock, FRP & Factory Reset Guides",
  description:
    "Phone unlock tools for 2026: remove the screen lock, bypass Google FRP and factory-reset an Android phone you own. Step-by-step guides for every major OEM on Android 15 and Android 16.",
  keywords: [
    "phone unlock tool",
    "android phone unlock tool 2026",
    "unlock phone without password",
    "screen lock removal android",
    "how to reset a redmi phone",
    "how to factory reset android without password",
    "android unlock tools",
    "remove pattern lock android",
  ],
  eyebrow: "Phone Unlock Tools Hub",
  headingLead: "Phone Unlock Tools &",
  headingHighlight: "Reset Guides (2026)",
  subheading:
    "Unlock, reset and recover an Android phone you own — remove the screen lock, bypass Google FRP, or factory-reset a Redmi, Samsung, Vivo, OPPO or Motorola device with step-by-step guides and one-click USB tools.",
  features: [
    {
      icon: "LockOpen",
      title: "Screen Lock Removal",
      desc: "Remove the PIN, pattern, password or fingerprint lock on an Android phone you own.",
    },
    {
      icon: "ShieldCheck",
      title: "Google FRP Bypass",
      desc: "Clear the Factory Reset Protection lock when the previous Google account is unknown.",
    },
    {
      icon: "RefreshCw",
      title: "Factory & Flash Reset",
      desc: "Wipe and restore factory state over USB — including via Recovery mode when the OS will not boot.",
    },
    {
      icon: "Usb",
      title: "One-Click USB Drivers",
      desc: "Auto-installs the correct Samsung, Google, MediaTek or Qualcomm driver before you start.",
    },
  ],
  steps: [
    {
      title: "Charge and back up the phone you own",
      desc: "Charge above 50% and, where the device still boots, back up the data you want to keep before unlocking or resetting.",
    },
    {
      title: "Install FRPB and connect over USB",
      desc: "Download the Windows app, launch it and connect the Android phone. FRPB auto-detects the OEM and installs the driver.",
    },
    {
      title: "Choose the unlock module",
      desc: "Pick Screen Unlock, FRP Bypass or Flash Reset in FRPB — the tool detects Download, Recovery or EDL mode automatically.",
    },
    {
      title: "Sign back in with your own account",
      desc: "After the unlock or reset, complete Android setup with your own Google account to satisfy Factory Reset Protection.",
    },
  ],
  faq: [
    {
      question: "What is the easiest way to unlock an Android phone I own?",
      answer:
        "For a phone you own, FRPB's one-click Screen Unlock removes the PIN, pattern or password over USB. If the phone was reset and shows the Google lock instead, use the FRP Bypass module in the same tool.",
    },
    {
      question: "Can I factory reset Android without the password?",
      answer:
        "Yes, on a device you own. Recovery mode reaches Wipe Data / Factory Reset without the screen password — see the guides below — and Android's Factory Reset Protection still applies afterwards.",
    },
    {
      question: "Does unlocking or resetting remove my data?",
      answer:
        "A screen-lock removal keeps your data. A factory reset or flash reset erases user data by design, so back up first whenever the phone still boots.",
    },
    {
      question: "Which phones are supported in 2026?",
      answer:
        "Samsung, Xiaomi/Redmi, Vivo, OPPO, realme, OnePlus, Motorola, Google Pixel and more, spanning MediaTek, Qualcomm and Exynos chipsets on Android 10 through Android 16.",
    },
  ],
  notice: {
    title: "Proof of Ownership / Own-Device Authorization",
    body: "Every guide and module on this hub is for phones you own or are authorised to service. Have your proof of purchase or repair authorisation on hand — FRPB never asks for, or stores, a device's previous account credentials.",
  },
};

const icloudBypass: PillarHubContent = {
  path: "/tools/icloud-bypass",
  title: "iCloud Activation Lock Hub 2026 — Owner Removal for iOS 17 & 18",
  description:
    "iCloud Activation Lock removal in 2026 for iPhone and iPad: recover the Apple ID, clear Find My and use Apple Support — honest, owner-only paths for iOS 17 and iOS 18. No fake bypass apps.",
  keywords: [
    "icloud activation lock removal",
    "icloud bypass 2026",
    "remove activation lock iphone",
    "iphone is not activated message",
    "icloud lock removal ios 18",
    "apple activation lock",
    "ipad icloud removal",
  ],
  eyebrow: "iCloud Activation Lock Hub",
  headingLead: "iCloud Activation Lock",
  headingHighlight: "Removal (2026)",
  subheading:
    "Work through iCloud Activation Lock, the \"iPhone is not activated\" screen, passcode and Face ID locks on an iPhone or iPad you own — using the legitimate, Apple-official removal paths for iOS 17 and iOS 18.",
  features: [
    {
      icon: "ShieldCheck",
      title: "Owner-Only Removal",
      desc: "Every path below requires the original Apple ID or verifiable proof of purchase.",
    },
    {
      icon: "KeyRound",
      title: "Apple ID Recovery",
      desc: "Reset a forgotten password at iforgot.apple.com to clear Activation Lock the moment you sign in.",
    },
    {
      icon: "Smartphone",
      title: "iPhone & iPad, iOS 17 / 18",
      desc: "Covers current iPhone and iPad models running iOS 17 and iOS 18.",
    },
    {
      icon: "Info",
      title: "No Fake Bypass",
      desc: "Activation Lock is enforced by Apple's servers — no software can clear it offline, and we say so plainly.",
    },
  ],
  steps: [
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
  ],
  faq: [...IOS_FAQ],
  notice: {
    title: "Honest iOS Guidance — Owner Authorization",
    body: "FRPB is an Android FRP toolkit and has no iOS capability. These pages are educational, owner-only guides and every removal path runs through Apple's official support channels. Treat any app that promises an instant iCloud bypass as a scam or malware.",
  },
};

/** All pillar hubs, keyed by canonical id. */
export const PILLAR_HUBS: Record<PillarHubId, PillarHubContent> = {
  "frp-bypass": frpBypass,
  "phone-unlock": phoneUnlock,
  "icloud-bypass": icloudBypass,
};

/** Ordered id list (stable for navigation + sitemap). */
export const PILLAR_HUB_IDS: PillarHubId[] = ["frp-bypass", "phone-unlock", "icloud-bypass"];

/** Sitemap route descriptors (path + crawl hints) for the pillar hubs. */
export const PILLAR_HUB_ROUTES: {
  path: string;
  changeFrequency: "weekly";
  priority: number;
}[] = PILLAR_HUB_IDS.map((id) => ({
  path: PILLAR_HUBS[id].path,
  changeFrequency: "weekly",
  priority: 0.8,
}));

/** Resolve a pillar hub by its canonical id. */
export function getPillarHub(id: PillarHubId): PillarHubContent {
  return PILLAR_HUBS[id];
}
