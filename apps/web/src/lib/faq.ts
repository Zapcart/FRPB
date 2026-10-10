// FRPB — homepage FAQ content.
// Single source of truth: the visible <FaqSection> and the FAQPage JSON-LD
// both read from this list so the markup can never drift from the schema.

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ: readonly FaqItem[] = [
  // High-intent questions surfaced first so both the visible FAQ section and
  // the FAQPage JSON-LD lead with the queries answer engines cite.
  {
    question: "Is FRPB safe to download?",
    answer: "Yes, FRPB is clean, tested, and hosted via official GitHub Releases.",
  },
  {
    question: "Which Android versions does FRPB support?",
    answer:
      "FRPB supports Android 10, 11, 12, 13, and 14 across Samsung, Xiaomi, Vivo, Oppo, and Realme devices.",
  },
  {
    question: "Does FRPB require a PC?",
    answer:
      "Yes, FRPB Desktop App runs on Windows PC with one-click automated drivers.",
  },
  {
    question: "What is an FRP lock and what does the FRPB FRP bypass tool do?",
    answer:
      "FRP (Factory Reset Protection) is the Google account lock Android applies after a factory reset. FRPB is an FRP bypass tool that detects a connected Samsung, Xiaomi, Vivo or Oppo device over USB and walks you through removing the FRP lock so an authorised owner can use the phone again.",
  },
  {
    question: "Which devices and chipsets does the Samsung and Xiaomi FRP tool support?",
    answer:
      "FRPB supports Samsung, Xiaomi, Vivo, Oppo, OnePlus, Google Pixel and most other Android brands across Qualcomm, MediaTek and Exynos chipsets. The flash reset app auto-detects Download mode, Recovery mode, EDL and fastboot so you do not have to pick the method manually.",
  },
  {
    question: "Do I need USB drivers or ADB installed before using FRPB?",
    answer:
      "No. FRPB bundles high-speed USB auto-detection and a one-click OEM driver installer. It checks for the correct Samsung, Google, OnePlus, MediaTek or Qualcomm driver and installs it for you if it is missing — nothing else to set up.",
  },
  {
    question: "Does the FRPB FRP lock removal app require a license?",
    answer:
      "Yes. Download the FRPB desktop app, then activate an FRPB Active License to unlock the full FRP lock removal and flash reset toolkit across one to five devices. 6-month and lifetime licenses are available, and every license verifies online over TLS with hashed device binding.",
  },
  {
    question: "Which Windows versions does the FRPB desktop app support?",
    answer:
      "FRPB runs on Windows 11, 10, 8 and 7 (64-bit). The installer is code-signed and served with a SHA-256 checksum, and includes no adware or bundled toolbars.",
  },
  {
    question: "Is it legal to use an FRP bypass tool?",
    answer:
      "FRPB is intended strictly for authorised device owners and repair professionals. You must own the device or have explicit permission from its owner. Using an FRP bypass tool on a device you do not own may break anti-theft protections and violate applicable law.",
  },
  {
    question: "How long does the $20 plan last?",
    answer:
      "During the 30-day launch offer the $20 plan grants 6 months (180 days) of access. When the countdown on the pricing page reaches zero, the same $20 plan reverts to 2 months (60 days). The price never changes — only the included term — and your exact duration is fixed server-side at the instant you pay.",
  },
];

/**
 * iOS / iCloud FAQ. Owner-focused, honest answers about Activation Lock and
 * iCloud removal. Rendered on the `/ios` hub (and its spokes) alongside the
 * matching FAQPage JSON-LD so the visible copy and the schema stay in lockstep.
 */
export const IOS_FAQ: readonly FaqItem[] = [
  {
    question: "Can FRPB bypass iCloud Activation Lock?",
    answer:
      "No. FRPB is an Android Factory Reset Protection toolkit and has no iOS capability. Our iOS pages explain the legitimate, owner-only removal paths Apple provides.",
  },
  {
    question: "Who is allowed to remove Activation Lock on an iPhone or iPad?",
    answer:
      "Only the person who owns the device and controls the Apple ID on it, or an Apple-authorised service provider acting on their behalf with the original proof of purchase.",
  },
  {
    question: "How do I remove Activation Lock if I forgot my Apple ID password?",
    answer:
      "Recover the account at iforgot.apple.com. Once you sign in with the recovered Apple ID, Activation Lock clears automatically and you can turn off Find My as normal.",
  },
  {
    question: "Why can't a third-party tool just remove Activation Lock?",
    answer:
      "Activation Lock is enforced by Apple's servers against the device's secure hardware. It cannot be cleared offline by any software, so any app claiming to bypass iCloud or Activation Lock instantly is a scam or malware.",
  },
];
