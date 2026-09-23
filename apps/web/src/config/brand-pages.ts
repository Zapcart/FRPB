// FRPB — programmatic brand-specific landing page content.
//
// Single source of truth for the four high-intent device/chipset landing pages
// (Samsung, Xiaomi MIUI/HyperOS, Vivo/Oppo/Realme and Qualcomm EDL). Each route
// file stays thin: it only wires `metadata` + JSON-LD from the entry below, and
// renders the shared <BrandLandingPage> presentational component.
//
// Keeping the copy here — rather than inline in each route — guarantees the
// visible page, the FAQ schema and the sitemap entry can never drift apart.

import type { FaqItem } from "@/lib/faq";

/** A single hero/benefit/step bullet rendered as an icon + copy row. */
export interface BrandFeature {
  /** lucide-react icon name, resolved to a component by the shared view. */
  icon: BrandIconKey;
  title: string;
  desc: string;
}

/** Icon keys are intentionally constrained so the config stays data-only. */
export type BrandIconKey =
  | "Smartphone"
  | "ShieldCheck"
  | "KeyRound"
  | "Zap"
  | "Cpu"
  | "Usb"
  | "Terminal"
  | "Wrench"
  | "MonitorDown"
  | "CheckCircle2"
  | "Sparkles"
  | "LockOpen";

/** A numbered step in the on-page procedure. */
export interface BrandStep {
  title: string;
  desc: string;
}

export interface BrandPageContent {
  /** Route path beginning with "/" — used for canonical + sitemap + JSON-LD. */
  path: string;
  /** SEO title (root layout appends the "· FRPB" template). */
  title: string;
  /** Meta description + hero standfirst. */
  description: string;
  /** Focus keyword set for this landing page. */
  keywords: string[];
  /** Small eyebrow label above the hero heading. */
  eyebrow: string;
  /** Hero H1, split so a keyword span can be gradient-highlighted. */
  headingLead: string;
  headingHighlight: string;
  /** Supporting paragraph under the H1. */
  subheading: string;
  /** Short "what this page covers" benefit bullets. */
  features: BrandFeature[];
  /** Numbered, device-specific bypass procedure. */
  steps: BrandStep[];
  /** FAQ — rendered visibly AND emitted as FAQPage JSON-LD from this same list. */
  faq: readonly FaqItem[];
}

/**
 * Samsung — One UI / Knox, Download + BROM mode, Android 10-14.
 */
const samsung: BrandPageContent = {
  path: "/samsung-frp-bypass",
  title: "Samsung FRP Bypass Tool (2026) - One-Click Android 10-14 Unlock",
  description:
    "Bypass Samsung FRP lock on Android 10-14 with FRPB. One-click Galaxy unlock covering One UI, Knox security and Download / BROM mode — free Windows tool.",
  keywords: [
    "samsung frp bypass",
    "samsung frp bypass tool 2026",
    "samsung frp unlock",
    "galaxy frp bypass",
    "samsung knox frp bypass",
    "samsung brom mode",
  ],
  eyebrow: "Samsung Galaxy — One UI FRP",
  headingLead: "Samsung FRP Bypass Tool for",
  headingHighlight: "One-Click Android 10-14 Unlock",
  subheading:
    "Remove the Google FRP lock from Samsung Galaxy phones running One UI and Android 10 through 14. FRPB auto-detects Download mode and BROM mode, handles Knox security hand-off and unlocks in a single click.",
  features: [
    {
      icon: "Smartphone",
      title: "Every Galaxy Series",
      desc: "Galaxy S, Note, Z Fold/Flip and A-series on Exynos or Snapdragon — one workflow for them all.",
    },
    {
      icon: "ShieldCheck",
      title: "One UI & Knox Aware",
      desc: "Detects your One UI build and Knob/Knox state so the reset uses the correct Samsung security path.",
    },
    {
      icon: "Terminal",
      title: "Download & BROM Mode",
      desc: "Automatically drives Download mode and, for MTK Galaxies, Emergency Dial BROM mode — no manual key combos.",
    },
    {
      icon: "Usb",
      title: "Samsung USB Drivers Auto-Installed",
      desc: "Missing Samsung / Qualcomm / MediaTek drivers are detected and installed with one click before flashing.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed FRPB-Recovery-Setup-1.0.1.exe installer from the official GitHub Release (v1.0.0) and launch it on Windows 10 or 11.",
    },
    {
      title: "Connect the Galaxy over USB",
      desc: "Boot the Samsung device into Download mode, connect it with a data cable and let FRPB auto-detect the model, chipset and One UI build.",
    },
    {
      title: "Install the Samsung drivers",
      desc: "If the drivers are missing, click Install Drivers — FRPB pulls the correct Samsung / Qualcomm / MediaTek package automatically.",
    },
    {
      title: "Run the one-click FRP unlock",
      desc: "Press Start FRP Bypass, let FRPB complete the Knox hand-off and Download / BROM sequence, then reboot the device with the lock removed.",
    },
  ],
  faq: [
    {
      question: "Which Samsung models and Android versions does FRPB support?",
      answer:
        "FRPB supports Samsung Galaxy S, Note, Z Fold, Z Flip and A-series devices running Android 10, 11, 12, 13 and 14 (One UI 2-6), across Exynos, Snapdragon and MediaTek chipsets.",
    },
    {
      question: "Does FRPB bypass Samsung Knox security?",
      answer:
        "FRPB performs an authorised FRP bypass and hands off to the Samsung Download / BROM mode correctly for the device's One UI build. It does not disable Knox — the security platform remains intact for the owner.",
    },
    {
      question: "Do I need Samsung USB drivers before starting?",
      answer:
        "No. FRPB detects whether the correct Samsung, Qualcomm or MediaTek driver is present and installs it with one click, including the Emergency Dial BROM mode driver for MTK Galaxies.",
    },
    {
      question: "Is FRPB free to download for Samsung devices?",
      answer:
        "Yes. FRPB offers a free trial with no credit card required; paid licenses unlock the full FRP bypass and flash reset toolkit. The signed Samsung installer is served from the official GitHub Releases page.",
    },
  ],
};

/**
 * Xiaomi — MIUI / HyperOS, Mi Account, MTK + Snapdragon.
 */
const xiaomi: BrandPageContent = {
  path: "/xiaomi-miui-frp-bypass",
  title: "Xiaomi MIUI / HyperOS FRP Bypass Tool - Fast & Free Download",
  description:
    "Reset MIUI and HyperOS FRP lock on Xiaomi, Redmi and Poco devices with FRPB. Free one-click download with Mi Account removal guidance for MediaTek and Snapdragon phones.",
  keywords: [
    "xiaomi frp bypass",
    "miui frp bypass",
    "hyperos frp bypass",
    "redmi frp unlock",
    "poco frp reset",
    "mi account bypass",
  ],
  eyebrow: "Xiaomi · Redmi · Poco — MIUI & HyperOS",
  headingLead: "Xiaomi MIUI / HyperOS",
  headingHighlight: "FRP Bypass Tool",
  subheading:
    "Clear the FRP screen on Xiaomi, Redmi and Poco phones running MIUI or HyperOS. FRPB auto-detects Download and BROM mode and walks you through verified Mi Account recovery for authorised owners.",
  features: [
    {
      icon: "Smartphone",
      title: "Xiaomi, Redmi & Poco",
      desc: "One workflow for the whole family — Redmi Note, Poco X/F, Mi and current Xiaomi flagships.",
    },
    {
      icon: "Sparkles",
      title: "MIUI & HyperOS Ready",
      desc: "Build-aware handling for MIUI 12-14 and HyperOS, including the latest 2026 security patches.",
    },
    {
      icon: "KeyRound",
      title: "Mi Account Guidance",
      desc: "Verified Mi Account removal notes for owners who can prove legitimate recovery access.",
    },
    {
      icon: "Usb",
      title: "One-Click Driver Installer",
      desc: "Qualcomm and MediaTek USB drivers are checked and installed automatically before flashing.",
    },
  ],
  steps: [
    {
      title: "Download FRPB for Windows",
      desc: "Grab the signed FRPB-Recovery-Setup-1.0.1.exe from the official GitHub Release (v1.0.0) and install it on Windows 10 or 11.",
    },
    {
      title: "Boot the Xiaomi device to Download / BROM",
      desc: "Power the Redmi, Poco or Mi device into Download mode (or BROM mode on MTK models) and connect it over USB.",
    },
    {
      title: "Let FRPB install the drivers",
      desc: "FRPB reads the MIUI / HyperOS build, detects the chipset and installs the matching Qualcomm or MediaTek driver in one click.",
    },
    {
      title: "Run the MIUI FRP reset",
      desc: "Start the FRP bypass, follow the verified Mi Account steps, then reboot — the FRP lock is removed for the authorised owner.",
    },
  ],
  faq: [
    {
      question: "Does FRPB work on Xiaomi HyperOS as well as MIUI?",
      answer:
        "Yes. FRPB is build-aware for both MIUI 12-14 and HyperOS, including devices on the latest 2026 Android security patches, across Redmi, Poco and Xiaomi phones.",
    },
    {
      question: "Can FRPB remove a Mi Account lock?",
      answer:
        "FRPB provides FRP bypass and verified Mi Account removal guidance for authorised owners who can prove legitimate recovery access. It is intended strictly for device owners and repair professionals.",
    },
    {
      question: "Which chipsets are supported on Xiaomi devices?",
      answer:
        "FRPB supports Xiaomi, Redmi and Poco devices on MediaTek and Qualcomm Snapdragon chipsets. It auto-detects Download mode and MTK BROM mode so you do not choose the method manually.",
    },
    {
      question: "Is the Xiaomi MIUI FRP tool free?",
      answer:
        "The download is free, with a free trial and no credit card required. Paid licenses unlock the full FRP toolkit. The installer is hosted on the official GitHub Releases page and is adware-free.",
    },
  ],
};

/**
 * Vivo / Oppo / Realme — MediaTek BROM + Qualcomm, automated drivers.
 */
const vivoOppoRealme: BrandPageContent = {
  path: "/vivo-oppo-realme-frp",
  title: "Vivo, Oppo & Realme FRP Unlock Tool - MTK / BROM Mode Bypass",
  description:
    "Unlock FRP on Vivo, Oppo and Realme phones with FRPB. MediaTek BROM and Qualcomm EDL bypass with an automated one-click driver installer for Windows — free download.",
  keywords: [
    "vivo frp unlock",
    "oppo frp bypass",
    "realme frp bypass",
    "mtk brom frp",
    "vivo oppo realme frp tool",
    "mediatek frp bypass",
  ],
  eyebrow: "Vivo · Oppo · Realme — MTK & Qualcomm",
  headingLead: "Vivo, Oppo & Realme",
  headingHighlight: "FRP Unlock Tool",
  subheading:
    "Remove the FRP lock from Vivo, Oppo and Realme phones on MediaTek or Qualcomm platforms. FRPB drives MTK BROM and Qualcomm EDL mode and installs every required driver for you.",
  features: [
    {
      icon: "Cpu",
      title: "MediaTek & Qualcomm",
      desc: "Handles MTK BROM mode and Qualcomm EDL (9008) mode from one unified workflow.",
    },
    {
      icon: "Usb",
      title: "Automated Driver Installer",
      desc: "Detects missing MTK / Qualcomm / USB-DK drivers and installs them with a single click.",
    },
    {
      icon: "Zap",
      title: "High-Speed USB Detection",
      desc: "Stable, high-speed handshakes that survive BROM and EDL timing windows without dropping.",
    },
    {
      icon: "Smartphone",
      title: "ColourOS · Funtouch · Realme UI",
      desc: "Build-aware bypass across ColorOS, Funtouch OS and Realme UI on Android 10-14.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on your PC",
      desc: "Download the signed FRPB-Recovery-Setup-1.0.1.exe from the official GitHub Release (v1.0.0) and run it on Windows 10 or 11.",
    },
    {
      title: "Enter MTK BROM or Qualcomm EDL mode",
      desc: "Power the Vivo, Oppo or Realme device into MediaTek BROM mode or Qualcomm EDL (9008) mode and connect it over USB.",
    },
    {
      title: "Auto-install the drivers",
      desc: "Let FRPB detect the platform and run the automated driver installer — no manual Device Manager work required.",
    },
    {
      title: "Complete the FRP unlock",
      desc: "Start the bypass, hold the BROM/EDL timing window, then reboot the phone with the FRP lock removed.",
    },
  ],
  faq: [
    {
      question: "Which Vivo, Oppo and Realme chipsets does FRPB support?",
      answer:
        "FRPB supports MediaTek and Qualcomm-powered Vivo, Oppo and Realme devices running ColorOS, Funtouch OS and Realme UI on Android 10-14, in both MTK BROM mode and Qualcomm EDL (9008) mode.",
    },
    {
      question: "Do I need to install MediaTek or Qualcomm drivers manually?",
      answer:
        "No. FRPB includes an automated driver installer that detects the missing MTK, Qualcomm or USB-DK driver and installs it for you before the bypass starts.",
    },
    {
      question: "What is MTK BROM mode FRP bypass?",
      answer:
        "BROM (Boot ROM) mode is the low-level MediaTek recovery mode FRPB uses to access the device before Android boots. This is what allows an authorised owner to clear the FRP lock when the standard recovery path is blocked.",
    },
    {
      question: "Is the Vivo / Oppo / Realme FRP tool free to try?",
      answer:
        "Yes — FRPB offers a free trial with no credit card required, and the Windows installer is served from the official GitHub Releases page with no bundled adware or toolbars.",
    },
  ],
};

/**
 * Qualcomm EDL (Emergency Download 9008) deep-flash recovery.
 */
const qualcommEdl: BrandPageContent = {
  path: "/qualcomm-edl-frp-tool",
  title: "Qualcomm EDL Mode FRP Bypass Software - Deep Flash Recovery",
  description:
    "Qualcomm EDL 9008 mode FRP bypass and deep-flash recovery with FRPB. Unlock Snapdragon devices via Emergency Download mode with automated drivers — free Windows tool.",
  keywords: [
    "qualcomm edl tool",
    "edl mode frp bypass",
    "qualcomm 9008 frp",
    "deep flash frp",
    "snapdragon frp bypass",
    "edl frp unlock",
  ],
  eyebrow: "Qualcomm EDL 9008 — Deep Flash",
  headingLead: "Qualcomm EDL Mode",
  headingHighlight: "FRP Bypass Software",
  subheading:
    "Recover Snapdragon devices in Qualcomm EDL (Emergency Download 9008) mode. FRPB drives the EDL handshake, lays down raw firmware via deep flash and clears the FRP lock.",
  features: [
    {
      icon: "Zap",
      title: "EDL 9008 Handshake",
      desc: "Reliable Sahara / Firehose EDL entry with automatic retry so the 9008 window is never missed.",
    },
    {
      icon: "Cpu",
      title: "Deep Flash Recovery",
      desc: "Raw firmware read-back and restore for bricks, boot loops and corrupted partitions.",
    },
    {
      icon: "Usb",
      title: "Qualcomm Driver Auto-Install",
      desc: "HS-USB QDLoader 9008 drivers are detected and installed automatically before flashing.",
    },
    {
      icon: "Smartphone",
      title: "Cross-Brand Snapdragon",
      desc: "Works across Snapdragon phones from Samsung, Xiaomi, OnePlus, Google and others.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed FRPB-Recovery-Setup-1.0.1.exe from the official GitHub Release (v1.0.0) and install it on Windows 10 or 11.",
    },
    {
      title: "Put the device into EDL mode",
      desc: "Enter Emergency Download (9008) mode using your device's key combo or test point, then connect it over USB.",
    },
    {
      title: "Install the HS-USB QDLoader driver",
      desc: "FRPB detects the missing Qualcomm 9008 driver and installs it automatically, then confirms the EDL link.",
    },
    {
      title: "Run the deep-flash FRP bypass",
      desc: "Start the EDL job, let FRPB complete the Sahara / Firehose handshake and firmware restore, then boot the device with FRP removed.",
    },
  ],
  faq: [
    {
      question: "What is Qualcomm EDL (9008) mode and how does FRPB use it?",
      answer:
        "EDL (Emergency Download 9008) is the low-level boot mode built into Qualcomm Snapdragon chipsets. FRPB drives the Sahara / Firehose handshake in EDL mode to flash firmware and clear the FRP lock even when Android will not boot.",
    },
    {
      question: "Which Qualcomm devices does the EDL FRP tool support?",
      answer:
        "FRPB supports Snapdragon devices from Samsung, Xiaomi, OnePlus, Google Pixel and other brands that expose Qualcomm EDL (9008) mode, with automated HS-USB QDLoader driver installation.",
    },
    {
      question: "Can FRPB recover a bricked Snapdragon device?",
      answer:
        "Yes. Beyond FRP removal, FRPB performs deep-flash recovery — raw firmware read-back and restore — to recover Snapdragon phones stuck in a boot loop or with corrupted partitions.",
    },
    {
      question: "Is the Qualcomm EDL FRP tool free to download?",
      answer:
        "The download is free, with a free trial and no credit card required. The signed Windows installer is hosted on the official GitHub Releases page and contains no adware or bundled toolbars.",
    },
  ],
};

/** Keyed registry — the sitemap and routes read from this. */
export const BRAND_PAGES = {
  samsung,
  xiaomi,
  vivoOppoRealme,
  qualcommEdl,
} as const;

export type BrandPageKey = keyof typeof BRAND_PAGES;

/** Lightweight descriptors used to build sitemap entries without importing pages. */
export const BRAND_PAGE_ROUTES: readonly {
  path: string;
  changeFrequency: "weekly";
  priority: number;
}[] = [
  { path: samsung.path, changeFrequency: "weekly", priority: 0.8 },
  { path: xiaomi.path, changeFrequency: "weekly", priority: 0.8 },
  { path: vivoOppoRealme.path, changeFrequency: "weekly", priority: 0.8 },
  { path: qualcommEdl.path, changeFrequency: "weekly", priority: 0.8 },
];
