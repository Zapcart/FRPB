// FRPB — unlock & system-mode landing page content.
//
// Single source of truth for the eight high-intent "unlock / system mode"
// programmatic SEO pages (Flash Reset, FRP Bypass, Screen Unlock, Reboot Mode,
// iCloud Bypass, Samsung Account Unlock, Bootloop Recovery, Data Recovery).
//
// This module is intentionally DATA-ONLY (no JSX, no React, no lucide imports)
// so it can be consumed by:
//   * the Next.js route files in apps/web (metadata + JSON-LD wiring), and
//   * the /sitemap.xml route, which must not pull in the icon runtime.
//
// Keeping the copy here — rather than inline in each route — guarantees the
// visible page, the FAQ schema and the sitemap entry can never drift apart.

/** A hero/benefit bullet rendered as an icon + copy row (icon key is a string
 *  so this file stays free of any icon dependency). */
export interface UnlockToolFeature {
  icon: string;
  title: string;
  desc: string;
}

/** A numbered step in the on-page procedure. */
export interface UnlockToolStep {
  title: string;
  desc: string;
}

/** A single FAQ entry — rendered visibly AND emitted as FAQPage JSON-LD. */
export interface UnlockToolFaq {
  question: string;
  answer: string;
}

/** Internal cross-link to a related mode guide. */
export interface UnlockToolRelated {
  path: string;
  anchor: string;
  blurb: string;
}

export interface UnlockToolMeta {
  id: UnlockToolId;
  /** Canonical route path beginning with "/" — canonical + sitemap + JSON-LD. */
  path: string;
  /** SEO <title> (the root layout appends the "· FRPB" template). */
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
  features: readonly UnlockToolFeature[];
  /** Numbered, mode-specific procedure. */
  steps: readonly UnlockToolStep[];
  /** FAQ — rendered visibly AND emitted as FAQPage JSON-LD from this list. */
  faq: readonly UnlockToolFaq[];
  /** Keyword-rich links to the other mode guides (internal linking). */
  related: readonly UnlockToolRelated[];
}

/** Canonical id union — one per high-intent unlock / system mode page. */
export type UnlockToolId =
  | "flash-reset"
  | "frp-bypass"
  | "unlock-screen"
  | "reboot-mode"
  | "icloud-bypass"
  | "samsungaccount"
  | "bootloop-recovery"
  | "data-recovery";

/** Shared authorisation disclaimer reused by every mode page footer. */
export const UNLOCK_DISCLAIMER =
  "FRPB is intended strictly for authorised device owners and licensed repair professionals. You must own the device or hold explicit permission from its owner. Using these tools on hardware you do not own may defeat anti-theft protections and can be illegal in your jurisdiction.";

/* -------------------------------------------------------------------------- */
/*  Mode entries                                                              */
/* -------------------------------------------------------------------------- */

const flashReset: UnlockToolMeta = {
  id: "flash-reset",
  path: "/flash-reset",
  title: "Flash Reset Android 2026 — Hard Reset Without Password (1-Click)",
  description:
    "Hard reset Android without a password using FRPB's one-click flash reset. Wipe and restore a locked phone to factory state over USB — Samsung, Xiaomi, MTK and Qualcomm. Free Windows tool.",
  keywords: [
    "flash reset android",
    "how to hard reset android without password",
    "hard reset android without password",
    "flash reset tool",
    "factory reset locked android",
    "wipe android without password",
  ],
  eyebrow: "Flash Reset — Factory Wipe",
  headingLead: "Hard Reset Android",
  headingHighlight: "Without the Password",
  subheading:
    "Perform a clean flash reset on a device you are authorised to service. FRPB wipes user data and restores factory state over USB — no password, no pattern and no bootloader guesswork.",
  features: [
    {
      icon: "RefreshCw",
      title: "One-Click Factory Wipe",
      desc: "Clears user data and cache in a single, rollback-safe flash reset operation.",
    },
    {
      icon: "ShieldCheck",
      title: "Rollback-Safe Stages",
      desc: "Every stage is streamed live so you can see exactly what is wiped and when.",
    },
    {
      icon: "Smartphone",
      title: "All Major OEMs",
      desc: "Works across Samsung, Xiaomi, OPPO, vivo, realme and Pixel on Android 10–15.",
    },
    {
      icon: "Usb",
      title: "Auto Driver Install",
      desc: "Missing USB, MediaTek or Qualcomm drivers are detected and installed for you.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed FRPB-Recovery-Setup installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Connect the device over USB",
      desc: "Boot the handset into Download, Recovery, BROM or EDL mode and connect a quality data cable.",
    },
    {
      title: "Confirm the detected model",
      desc: "FRPB identifies the model, chipset and firmware build so the correct flash path is selected automatically.",
    },
    {
      title: "Run the flash reset",
      desc: "Click Flash Reset, acknowledge the authorisation notice, then let the wipe complete and reboot to factory state.",
    },
  ],
  faq: [
    {
      question: "Can I hard reset an Android phone without the password?",
      answer:
        "Yes — a flash reset clears the user-data partition over USB from a PC, so a forgotten password or pattern does not block the wipe on a device you are authorised to service.",
    },
    {
      question: "Does a flash reset delete all my data?",
      answer:
        "A flash reset wipes user data, accounts and settings and returns the device to factory state. Back up anything you need before running the operation.",
    },
    {
      question: "Which devices support the FRPB flash reset?",
      answer:
        "FRPB supports Samsung, Xiaomi, Redmi, POCO, OPPO, vivo, realme and Pixel devices on Android 10–15, across Exynos, Snapdragon and MediaTek chipsets.",
    },
    {
      question: "Do I need a license for the flash reset tool?",
      answer:
        "The flash reset module is included with an FRPB Active License. The signed Windows installer is served from the official GitHub Releases page and is adware-free.",
    },
  ],
  related: [],
};

const frpBypass: UnlockToolMeta = {
  id: "frp-bypass",
  path: "/frp-bypass",
  title: "FRP Bypass Tool 2026 — Google Account Lock Removal (1-Click)",
  description:
    "Remove the Google Account FRP lock in minutes. FRPB is a one-click FRP bypass tool for Samsung, Xiaomi, Vivo, Oppo, Realme and MTK/Qualcomm devices. Free Windows download.",
  keywords: [
    "frp bypass tool",
    "google account lock removal",
    "google account lock removal frp bypass tool",
    "frp bypass 2026",
    "remove google account frp lock",
    "factory reset protection bypass",
  ],
  eyebrow: "FRP Bypass — Google Account Lock",
  headingLead: "FRP Bypass Tool for",
  headingHighlight: "Google Account Lock Removal",
  subheading:
    "Clear the Factory Reset Protection screen on a device you legitimately own. FRPB detects the chipset and drives the documented FRP removal sequence over Download, BROM or EDL mode.",
  features: [
    {
      icon: "LockOpen",
      title: "One-Click FRP Removal",
      desc: "Removes the Google account verification screen without manual firmware flashing.",
    },
    {
      icon: "Cpu",
      title: "Chipset-Aware Paths",
      desc: "Selects the correct method for Exynos, Snapdragon or MediaTek automatically.",
    },
    {
      icon: "Terminal",
      title: "Live Operation Log",
      desc: "Every stage is streamed to a console so the run is auditable and repeatable.",
    },
    {
      icon: "Usb",
      title: "No Driver Hunting",
      desc: "OEM and chipset USB drivers install on demand before the bypass begins.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and install it on Windows 10 or 11.",
    },
    {
      title: "Connect the locked phone",
      desc: "Boot the device into the mode its firmware exposes — Download, Recovery, BROM or EDL — and plug it in over USB.",
    },
    {
      title: "Let FRPB identify the chipset",
      desc: "FRPB reads the model and chipset and confirms which FRP path it will use.",
    },
    {
      title: "Run the FRP bypass",
      desc: "Click FRP Bypass, accept the authorisation disclaimer and reboot into setup with the account lock cleared.",
    },
  ],
  faq: [
    {
      question: "What is an FRP bypass tool?",
      answer:
        "An FRP bypass tool re-enables access to a device blocked by Google's Factory Reset Protection, for owners and repair professionals who can prove legitimate rights to the hardware.",
    },
    {
      question: "Is removing the Google account lock legal?",
      answer:
        "It is legal only when you own the device or hold explicit permission from the owner. FRPB requires you to confirm authorisation before each run and keeps a local operation log.",
    },
    {
      question: "Which Android versions does the FRP bypass support?",
      answer:
        "FRPB supports Android 10, 11, 12, 13, 14 and 15 across Samsung, Xiaomi, Redmi, POCO, OPPO, vivo, realme and Pixel devices.",
    },
    {
      question: "Do I need a paid license for FRP bypass?",
      answer:
        "Full module execution requires an FRPB Active License. The installer is hosted on the official GitHub Releases page and contains no adware or bundled toolbars.",
    },
  ],
  related: [],
};

const unlockScreen: UnlockToolMeta = {
  id: "unlock-screen",
  path: "/unlock-screen",
  title: "Screen Unlock Tool 2026 — Bypass Pattern, PIN & Fingerprint",
  description:
    "Unlock a locked Android screen fast. FRPB bypasses pattern, PIN, password and fingerprint locks on devices you own, over USB — Samsung, Xiaomi, Oppo, Vivo and more. Free Windows tool.",
  keywords: [
    "bypass pattern lock",
    "unlock android screen",
    "bypass pin and fingerprint",
    "screen unlock tool",
    "remove screen lock android",
    "unlock pattern lock without reset",
  ],
  eyebrow: "Screen Unlock — Pattern · PIN · Biometrics",
  headingLead: "Bypass Pattern, PIN and",
  headingHighlight: "Fingerprint Locks",
  subheading:
    "Remove a forgotten pattern, PIN, password or fingerprint lock from a device you are authorised to service. FRPB clears the secure lock settings over USB without guesswork.",
  features: [
    {
      icon: "LockOpen",
      title: "Every Lock Type",
      desc: "Handles pattern, PIN, numeric/alpha password and enrolled fingerprint locks.",
    },
    {
      icon: "Smartphone",
      title: "Cross-Brand Support",
      desc: "Samsung, Xiaomi, OPPO, vivo, realme and Pixel on current Android releases.",
    },
    {
      icon: "Zap",
      title: "Fast USB Detection",
      desc: "High-speed mode detection identifies the right unlock path in seconds.",
    },
    {
      icon: "ShieldCheck",
      title: "Safe & Auditable",
      desc: "Each unlock is logged and requires an authorisation acknowledgement first.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and launch it on Windows 10 or 11.",
    },
    {
      title: "Connect the locked device",
      desc: "Boot the phone into Recovery, Download or MTP mode and connect it over a data cable.",
    },
    {
      title: "Confirm the detected model",
      desc: "FRPB auto-detects the model and Android version to choose the correct screen-unlock routine.",
    },
    {
      title: "Run the screen unlock",
      desc: "Start Screen Unlock, accept the authorisation notice, then remove the lock and set a new one.",
    },
  ],
  faq: [
    {
      question: "Can FRPB bypass a pattern, PIN and fingerprint lock?",
      answer:
        "Yes. FRPB removes pattern, PIN, password and enrolled biometric locks on devices you are authorised to service, clearing the secure lock settings over USB.",
    },
    {
      question: "Will unlocking the screen erase my data?",
      answer:
        "Removing the screen lock itself does not require a full wipe on supported devices, but some firmware revisions force a factory reset for security. FRPB warns you before any destructive step.",
    },
    {
      question: "Does the screen unlock work on Samsung and Xiaomi?",
      answer:
        "FRPB supports screen unlock across Samsung, Xiaomi, Redmi, POCO, OPPO, vivo, realme and Pixel devices on Android 10–15.",
    },
    {
      question: "Is a license required for the screen unlock tool?",
      answer:
        "The screen unlock module is part of the FRPB Active License. The Windows installer is served from the official GitHub Releases page with no bundled adware.",
    },
  ],
  related: [],
};

const rebootMode: UnlockToolMeta = {
  id: "reboot-mode",
  path: "/reboot-mode",
  title: "Reboot Mode Tool 2026 — Enter Fastboot, Recovery & Download",
  description:
    "Enter Fastboot, Recovery, Download, BROM and EDL modes in one click. FRPB's Reboot Mode tool switches an Android device into any system mode over USB — no key-combo guesswork.",
  keywords: [
    "enter fastboot mode",
    "enter recovery mode android",
    "reboot to download mode",
    "adb reboot bootloader",
    "enter edl mode",
    "reboot mode tool",
  ],
  eyebrow: "Reboot Mode — Fastboot · Recovery · Download",
  headingLead: "Enter Fastboot, Recovery and",
  headingHighlight: "Download Modes Easily",
  subheading:
    "Switch a connected device into Fastboot, Recovery, Download, BROM or EDL mode with a single click. FRPB's Reboot Mode tool removes the timing-window guesswork from every workflow.",
  features: [
    {
      icon: "Terminal",
      title: "One-Click Mode Switch",
      desc: "Jump straight into Fastboot, Recovery, Download, BROM or EDL mode from the desktop app.",
    },
    {
      icon: "Zap",
      title: "Timing-Window Helper",
      desc: "Automated prompts hit the BROM and EDL windows so handshakes are never missed.",
    },
    {
      icon: "Cpu",
      title: "Chipset-Aware",
      desc: "Chooses the correct reboot command for Exynos, Snapdragon and MediaTek devices.",
    },
    {
      icon: "Usb",
      title: "Driver Auto-Install",
      desc: "Installs the required USB driver for the target mode before rebooting.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Connect the Android device",
      desc: "Plug the phone into your PC over a data cable and let the Live Device Monitor detect it.",
    },
    {
      title: "Pick the target mode",
      desc: "Choose Fastboot, Recovery, Download, BROM or EDL — FRPB confirms the chipset supports it.",
    },
    {
      title: "Reboot into the mode",
      desc: "Click Reboot and let FRPB drive the device into the selected mode, ready for the next operation.",
    },
  ],
  faq: [
    {
      question: "How do I enter Fastboot mode with FRPB?",
      answer:
        "Connect the device, select Fastboot as the target mode and click Reboot. FRPB issues the correct bootloader command so you do not have to time Volume Down + Power manually.",
    },
    {
      question: "Can FRPB reboot a phone into EDL or BROM mode?",
      answer:
        "Yes. FRPB supports EDL (Qualcomm 9008) and BROM (MediaTek) entry with automated timing prompts for chipsets that allow software entry.",
    },
    {
      question: "Which modes does the Reboot Mode tool support?",
      answer:
        "Fastboot, Recovery, Download (Samsung Odin), BROM and EDL modes are supported across Samsung, Xiaomi, OPPO, vivo, realme and Pixel devices.",
    },
    {
      question: "Do I need a license to use the Reboot Mode tool?",
      answer:
        "The Reboot Mode tool is included with an FRPB Active License, and the Windows installer is served from the official GitHub Releases page.",
    },
  ],
  related: [],
};

const icloudBypass: UnlockToolMeta = {
  id: "icloud-bypass",
  path: "/icloud-bypass",
  title: "iCloud Bypass 2026 — iOS Activation Lock Unlock Guide",
  description:
    "iOS activation lock bypass and unlock guide for iPhone and iPad. FRPB's iCloud Bypass walks authorised owners through the Activation Lock removal process over USB. Free Windows tool.",
  keywords: [
    "icloud bypass",
    "ios activation lock bypass",
    "icloud activation lock unlock",
    "iphone activation lock removal",
    "bypass icloud activation lock 2026",
    "ipad activation lock bypass",
  ],
  eyebrow: "iCloud Bypass — iOS Activation Lock",
  headingLead: "iOS Activation Lock Bypass &",
  headingHighlight: "Unlock Guide",
  subheading:
    "Work through Activation Lock on an iPhone or iPad you are authorised to service. FRPB's iCloud Bypass guides the removal process over USB with a clear, auditable workflow.",
  features: [
    {
      icon: "Smartphone",
      title: "iPhone & iPad",
      desc: "Covers current iPhone and iPad models on supported iOS releases.",
    },
    {
      icon: "ShieldCheck",
      title: "Authorised-Owner Flow",
      desc: "Every step requires an explicit authorisation acknowledgement first.",
    },
    {
      icon: "Terminal",
      title: "Guided Steps",
      desc: "On-screen instructions walk you through the Activation Lock removal order.",
    },
    {
      icon: "Usb",
      title: "USB Device Detection",
      desc: "Reads the connected Apple device details before any operation begins.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Connect the iPhone or iPad",
      desc: "Plug the device into your PC over a data cable and let FRPB read its details.",
    },
    {
      title: "Confirm the device state",
      desc: "FRPB shows the detected model and Activation Lock status so you can verify the correct flow.",
    },
    {
      title: "Follow the iCloud bypass guide",
      desc: "Step through the Activation Lock removal process, submitting your ownership confirmation as required.",
    },
  ],
  faq: [
    {
      question: "What is iCloud Activation Lock?",
      answer:
        "Activation Lock is Apple's anti-theft feature that ties an iPhone or iPad to the owner's Apple ID. After a reset, the device requires that Apple ID before it can be set up again.",
    },
    {
      question: "Can FRPB bypass iCloud Activation Lock?",
      answer:
        "FRPB guides authorised owners and repair professionals through the Activation Lock removal process. It must only be used on hardware you own or are explicitly permitted to service.",
    },
    {
      question: "Which devices does iCloud Bypass support?",
      answer:
        "FRPB's iCloud Bypass covers current iPhone and iPad models on supported iOS releases, reading the connected device details over USB before any operation.",
    },
    {
      question: "Do I need a license for the iCloud Bypass tool?",
      answer:
        "The iCloud Bypass guide is included with an FRPB Active License. The Windows installer is served from the official GitHub Releases page and is adware-free.",
    },
  ],
  related: [],
};

const samsungAccount: UnlockToolMeta = {
  id: "samsungaccount",
  path: "/samsungaccount",
  title: "Samsung Account Unlock 2026 — Bypass Samsung Account Lock",
  description:
    "Bypass the Samsung account lock on a Galaxy you are authorised to service. FRPB removes Samsung account / Find My Mobile locks over USB with a clear, one-click workflow. Free Windows tool.",
  keywords: [
    "samsung account unlock",
    "bypass samsung account lock",
    "samsung account lock removal",
    "samsung find my mobile bypass",
    "remove samsung account galaxy",
    "samsung account unlock tool",
  ],
  eyebrow: "Samsung Account — Find My Mobile",
  headingLead: "Bypass the",
  headingHighlight: "Samsung Account Lock",
  subheading:
    "Clear the Samsung account / Find My Mobile lock on a Galaxy device you are authorised to service. FRPB drives the documented Samsung removal flow over USB.",
  features: [
    {
      icon: "Smartphone",
      title: "Every Galaxy Series",
      desc: "Galaxy S, Note, Z Fold/Flip and A-series on One UI 2–6.",
    },
    {
      icon: "KeyRound",
      title: "Samsung Account Removal",
      desc: "Handles the Samsung account verification screen for authorised owners.",
    },
    {
      icon: "ShieldCheck",
      title: "Find My Mobile Aware",
      desc: "Detects the Find My Mobile lock state before selecting the removal path.",
    },
    {
      icon: "Usb",
      title: "Samsung Driver Auto-Install",
      desc: "Installs the required Samsung / Qualcomm / MediaTek driver automatically.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Connect the Galaxy device",
      desc: "Boot the Samsung device into Download or Recovery mode and connect it over USB.",
    },
    {
      title: "Install the Samsung drivers",
      desc: "Let FRPB detect and install any missing driver, then confirm the detected model and One UI build.",
    },
    {
      title: "Run the Samsung account unlock",
      desc: "Start the unlock, follow the account-removal prompts and reboot with the Samsung account lock cleared.",
    },
  ],
  faq: [
    {
      question: "Can FRPB bypass a Samsung account lock?",
      answer:
        "FRPB removes the Samsung account verification screen for authorised owners and repair professionals who can prove legitimate rights to the Galaxy device.",
    },
    {
      question: "What is the Find My Mobile lock?",
      answer:
        "Find My Mobile is Samsung's remote lock tied to your Samsung account. FRPB detects whether it is active and selects the correct removal path for the device's One UI build.",
    },
    {
      question: "Which Samsung models are supported?",
      answer:
        "FRPB supports Galaxy S, Note, Z Fold, Z Flip and A-series devices running One UI 2–6 across Exynos, Snapdragon and MediaTek chipsets.",
    },
    {
      question: "Do I need a license for the Samsung account unlock tool?",
      answer:
        "The Samsung account unlock module is included with an FRPB Active License. The signed Windows installer is served from the official GitHub Releases page.",
    },
  ],
  related: [],
};

const bootloopRecovery: UnlockToolMeta = {
  id: "bootloop-recovery",
  path: "/bootloop-recovery",
  title: "Bootloop Recovery 2026 — Fix Android Stuck on Boot Logo",
  description:
    "Fix an Android phone stuck on the boot logo or stuck in a bootloop. FRPB's Bootloop Recovery reflashes firmware over USB on Samsung, Xiaomi, MTK and Qualcomm devices. Free Windows tool.",
  keywords: [
    "android stuck on boot logo",
    "fix android bootloop",
    "bootloop recovery",
    "android boot loop fix",
    "phone stuck on logo",
    "reflash android firmware",
  ],
  eyebrow: "Bootloop Recovery — Stuck on Boot Logo",
  headingLead: "Fix Android Stuck on the",
  headingHighlight: "Boot Logo / Bootloop",
  subheading:
    "Recover a phone trapped on the boot logo or in a bootloop. FRPB reflashes stock firmware over USB across Samsung, Xiaomi, MTK and Qualcomm platforms to restore a clean boot.",
  features: [
    {
      icon: "RefreshCw",
      title: "Firmware Reflash",
      desc: "Restores stock firmware to break the bootloop and recover a clean system boot.",
    },
    {
      icon: "Cpu",
      title: "Multi-Chipset Flashing",
      desc: "Drives Odin, MTK BROM, Qualcomm EDL and Fastboot flash paths automatically.",
    },
    {
      icon: "Terminal",
      title: "Live Flashing Log",
      desc: "Every partition write is streamed so you can watch progress and catch errors early.",
    },
    {
      icon: "Usb",
      title: "Driver Auto-Install",
      desc: "Installs the correct Odin / MTK / Qualcomm driver before flashing begins.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Select the firmware package",
      desc: "Choose the stock firmware matching your exact model from FRPB's firmware catalog.",
    },
    {
      title: "Connect the device in flash mode",
      desc: "Boot into Download, BROM or EDL mode and connect the phone over USB.",
    },
    {
      title: "Run the bootloop recovery",
      desc: "Click Flash, let FRPB complete the firmware restore, then reboot into a healthy system.",
    },
  ],
  faq: [
    {
      question: "Can FRPB fix an Android stuck on the boot logo?",
      answer:
        "Yes. Bootloop Recovery reflashes the matching stock firmware over USB, which resolves most bootlogo loops and corrupted-partition failures on supported devices.",
    },
    {
      question: "Will bootloop recovery erase my data?",
      answer:
        "Reflashing firmware typically wipes user data to guarantee a clean boot. Back up anything recoverable before running the operation.",
    },
    {
      question: "Which brands support bootloop recovery?",
      answer:
        "FRPB supports bootloop recovery across Samsung (Odin), Xiaomi, and MediaTek / Qualcomm devices via BROM, EDL and Fastboot flashing.",
    },
    {
      question: "Do I need a license for the Bootloop Recovery tool?",
      answer:
        "The Bootloop Recovery module is part of the FRPB Active License. The Windows installer is served from the official GitHub Releases page.",
    },
  ],
  related: [],
};

const dataRecovery: UnlockToolMeta = {
  id: "data-recovery",
  path: "/data-recovery",
  title: "Android Data Recovery 2026 — Recover Deleted Photos & Contacts",
  description:
    "Recover deleted photos, contacts, videos and messages from an Android phone. FRPB's Data Recovery scans the device over USB and extracts recoverable media. Free Windows tool.",
  keywords: [
    "android data recovery",
    "recover deleted photos android",
    "recover deleted contacts",
    "recover deleted videos android",
    "android photo recovery",
    "phone data recovery tool",
  ],
  eyebrow: "Data Recovery — Deleted Photos & Media",
  headingLead: "Recover Deleted Photos,",
  headingHighlight: "Contacts & Media",
  subheading:
    "Scan an Android phone for deleted photos, videos, contacts, messages and documents, then extract the recoverable files to your PC — without uploading anything to the cloud.",
  features: [
    {
      icon: "RefreshCw",
      title: "Deep Scan",
      desc: "Scans the accessible storage for deleted photos, videos, audio and documents.",
    },
    {
      icon: "Smartphone",
      title: "Categorised Results",
      desc: "Recoverable items are grouped by type — images, video, contacts, messages and more.",
    },
    {
      icon: "Download",
      title: "USB Extraction",
      desc: "Extract the files you choose straight to your PC over a local USB connection.",
    },
    {
      icon: "ShieldCheck",
      title: "100% Offline",
      desc: "Scanning and extraction run locally — nothing leaves your computer.",
    },
  ],
  steps: [
    {
      title: "Install FRPB on Windows",
      desc: "Download the signed installer from the official GitHub Release and run it on Windows 10 or 11.",
    },
    {
      title: "Connect the Android device",
      desc: "Plug the phone into your PC over USB and let FRPB detect the storage layout.",
    },
    {
      title: "Run the data recovery scan",
      desc: "Start the scan and watch recoverable photos, videos, contacts and messages appear by category.",
    },
    {
      title: "Extract the files you need",
      desc: "Select the items to recover and extract them safely to your computer.",
    },
  ],
  faq: [
    {
      question: "Can I recover deleted photos from an Android phone?",
      answer:
        "Yes. FRPB scans the accessible storage for deleted media and lists everything it can recover, so you can extract your photos and videos to a PC.",
    },
    {
      question: "Does data recovery require root?",
      answer:
        "FRPB recovers what the device exposes over USB without root wherever the firmware allows it. Deeper recovery may need elevated access on some models, which the app indicates before scanning.",
    },
    {
      question: "What file types can the data recovery tool find?",
      answer:
        "FRPB scans for photos, videos, audio, documents, contacts and messages, grouping recoverable items by category for easy review.",
    },
    {
      question: "Do I need a license for the Data Recovery tool?",
      answer:
        "The Data Recovery module is included with an FRPB Active License. The Windows installer is hosted on the official GitHub Releases page and is adware-free.",
    },
  ],
  related: [],
};

/* -------------------------------------------------------------------------- */
/*  Registry + derived sitemap routes                                         */
/* -------------------------------------------------------------------------- */

/** Ordered id list — controls registry order and sitemap output order. */
export const UNLOCK_TOOL_IDS: readonly UnlockToolId[] = [
  "flash-reset",
  "frp-bypass",
  "unlock-screen",
  "reboot-mode",
  "icloud-bypass",
  "samsungaccount",
  "bootloop-recovery",
  "data-recovery",
];

/** Keyword-rich cross-links shared by every mode page (internal linking). */
const UNLOCK_CROSS_LINKS: readonly UnlockToolRelated[] = [
  {
    path: "/frp-bypass",
    anchor: "FRP bypass tool (2026)",
    blurb: "One-click Google account lock removal for Android devices.",
  },
  {
    path: "/flash-reset",
    anchor: "Flash reset Android",
    blurb: "Hard reset without a password and restore factory state.",
  },
  {
    path: "/unlock-screen",
    anchor: "Screen unlock tool",
    blurb: "Bypass pattern, PIN and fingerprint locks over USB.",
  },
  {
    path: "/reboot-mode",
    anchor: "Reboot mode tool",
    blurb: "Enter Fastboot, Recovery, Download, BROM and EDL modes.",
  },
  {
    path: "/icloud-bypass",
    anchor: "iCloud bypass (iOS)",
    blurb: "iOS Activation Lock bypass and unlock guide.",
  },
  {
    path: "/samsungaccount",
    anchor: "Samsung account unlock",
    blurb: "Bypass the Samsung account and Find My Mobile lock.",
  },
  {
    path: "/bootloop-recovery",
    anchor: "Bootloop recovery",
    blurb: "Fix Android stuck on the boot logo or in a bootloop.",
  },
  {
    path: "/data-recovery",
    anchor: "Data recovery",
    blurb: "Recover deleted photos, contacts and media from Android.",
  },
  {
    path: "/samsung-frp-bypass",
    anchor: "Samsung FRP bypass",
    blurb: "Device-specific Galaxy One UI FRP unlock guide.",
  },
  {
    path: "/xiaomi-miui-frp-bypass",
    anchor: "Xiaomi MIUI / HyperOS FRP",
    blurb: "Mi Account removal for Redmi, POCO and Mi phones.",
  },
  {
    path: "/qualcomm-edl-frp-tool",
    anchor: "Qualcomm EDL 9008 deep flash",
    blurb: "Snapdragon Emergency Download recovery and repair.",
  },
];

const UNLOCK_ENTRIES: readonly UnlockToolMeta[] = [
  flashReset,
  frpBypass,
  unlockScreen,
  rebootMode,
  icloudBypass,
  samsungAccount,
  bootloopRecovery,
  dataRecovery,
];

/** Canonical map of all unlock/system-mode pages keyed by id. */
export const UNLOCK_TOOLS: Record<UnlockToolId, UnlockToolMeta> = UNLOCK_ENTRIES.reduce(
  (acc, entry) => {
    const related = UNLOCK_CROSS_LINKS.filter((link) => link.path !== entry.path).slice(0, 6);
    acc[entry.id] = { ...entry, related };
    return acc;
  },
  {} as Record<UnlockToolId, UnlockToolMeta>
);

/** Sitemap-ready route descriptors mirroring BRAND_PAGE_ROUTES. */
export const UNLOCK_TOOL_ROUTES: readonly {
  path: string;
  changeFrequency: "weekly";
  priority: number;
}[] = UNLOCK_TOOL_IDS.map((id) => ({
  path: UNLOCK_TOOLS[id].path,
  changeFrequency: "weekly" as const,
  priority: 0.8,
}));

/** Type guard for arbitrary string input (route params, IPC payloads). */
export function isUnlockToolId(value: unknown): value is UnlockToolId {
  return typeof value === "string" && value in UNLOCK_TOOLS;
}

/** Resolve an unlock tool by id, returning null for unknown input. */
export function getUnlockTool(id: string): UnlockToolMeta | null {
  return isUnlockToolId(id) ? UNLOCK_TOOLS[id] : null;
}
