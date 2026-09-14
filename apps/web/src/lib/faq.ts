// FRPB — homepage FAQ content.
// Single source of truth: the visible <FaqSection> and the FAQPage JSON-LD
// both read from this list so the markup can never drift from the schema.

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQ: readonly FaqItem[] = [
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
    question: "Is the FRPB FRP lock removal app free to try?",
    answer:
      "Yes. You can download FRPB and run the free trial with no credit card required. Paid monthly, yearly and lifetime licenses unlock the full FRP lock removal and flash reset toolkit across one to five devices. Every license verifies online over TLS with hashed device binding.",
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
];
