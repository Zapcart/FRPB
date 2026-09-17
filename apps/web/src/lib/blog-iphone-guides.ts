// FRPB — iPhone / iCloud Activation Lock guide corpus.
//
// ACCURACY RULES (please preserve when editing):
//   1. There is NO legitimate software bypass for iCloud Activation Lock on a
//      device you do not own. Apple ties the lock to the Apple ID server-side
//      and re-verifies it on every activation. We do NOT claim otherwise.
//   2. Each guide therefore documents the legitimate owner routes (Apple ID
//      recovery, Apple Support activation-lock removal with proof of purchase)
//      plus the honest technical limitations, and states plainly when a device
//      cannot be recovered.
//   3. The authorised-owner reminder is mandatory and appended by modelGuide().
//
// These guides exist to answer very high-volume "iPhone X/11/12/13 iCloud lock"
// searches with truthful, useful content — which is also what keeps the content
// compliant with Google's helpful-content and structured-data policies.

import { modelGuide } from "./blog-guides";
import type { BlogPost } from "./blog";

/** Shared prerequisites for every legitimate activation-lock route. */
const COMMON_PREREQUISITES = [
  "Original proof of purchase (receipt, invoice or carrier contract)",
  "The Apple ID email used on the device, if you have it",
  "A working phone, tablet or computer with internet access",
  "The device's IMEI or serial number (Settings → General → About, box, or SIM tray)",
];

/** A step block that is identical across models — the Apple Support route. */
const OWNER_ROUTE_STEPS = [
  "Confirm the device is locked by an Activation Lock screen naming an Apple ID.",
  "Try to recover that Apple ID at iforgot.apple.com — Activation Lock clears the moment the owner signs in.",
  "If the Apple ID is unreachable, gather the original proof of purchase.",
  "Submit an Activation Lock removal request at apple.com/support (or at any Apple Store / Authorised Service Provider).",
  "Apple verifies the purchase, then clears the lock server-side — usually within a few days.",
  "Activate the iPhone again and complete setup with your own Apple ID.",
];

export const IPHONE_GUIDES: readonly BlogPost[] = [
  modelGuide({
    slug: "how-to-bypass-icloud-activation-lock-iphone-x-2026",
    title: "iPhone X iCloud Activation Lock: Legitimate Removal Guide 2026",
    description:
      "iPhone X iCloud Activation Lock removal in 2026: what actually works, which checkm8 shortcuts are dead, and the Apple Support route that clears the lock for the rightful owner.",
    excerpt:
      "The iPhone X sits on the checkm8 boundary — old enough for hardware tools, new enough that none of them clear Activation Lock. Here is what genuinely works in 2026.",
    keywords: [
      "iphone x icloud lock removal",
      "iphone x activation lock bypass 2026",
      "bypass icloud activation lock iphone x",
      "iphone x icloud unlock",
      "checkm8 activation lock",
    ],
    brand: "Apple",
    model: "iPhone X",
    androidVersions: [],
    osVersions: ["iOS 11", "iOS 12", "iOS 13", "iOS 14", "iOS 15", "iOS 16"],
    method: "manual",
    chipset: "Apple A11 Bionic",
    estimatedTime: "PT20M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "What the iPhone X Activation Lock actually is",
        paragraphs: [
          "Activation Lock is Find My iPhone's anti-theft layer. When it is enabled, the iPhone stores a reference to the signed-in Apple ID on Apple's servers, not on the handset. On every activation the device asks those servers whether the lock has been released.",
          "That design detail is the whole story: because the check happens server-side, no local utility, jailbreak or firmware reflash can clear it. Anything that claims to remove Activation Lock from the iPhone itself is describing a device that was never truly locked, or a scam.",
        ],
      },
      {
        heading: "Why the checkm8 era does not clear Activation Lock on the iPhone X",
        paragraphs: [
          "The iPhone X (A11) is vulnerable to checkm8, the bootrom exploit in Apple's A5–A11 chips. That exploit allows unsigned code execution at the lowest level — which is why it powers jailbreak and some forensic tooling.",
          "It does not, and cannot, clear Activation Lock. The exploit gives code execution on the device; Activation Lock is a server-side entitlement. A bootrom exploit cannot change what Apple's servers believe about the device. This is the single most common misconception in iPhone X search results, and it is why so many tools advertise a capability they do not have.",
        ],
      },
      {
        heading: "The legitimate route for the rightful owner",
        paragraphs: [
          "If you own the iPhone X — a second-hand purchase from a seller who forgot to remove their account, an inherited device, or a business handset whose Apple ID was deleted — you have two practical options.",
          "First, recover the Apple ID. If you can reach the account email, signing in at iforgot.apple.com and completing recovery removes Activation Lock immediately, because the owner is the lock's key. Second, if the account is genuinely gone, Apple can clear the lock after verifying your ownership of the hardware.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "Removing Activation Lock through Apple Support",
        paragraphs: [
          "Apple's official process is the Activation Lock removal request. You submit the device's IMEI or serial number together with proof of purchase, and Apple checks the original sales record.",
          "Acceptable proof is what an owner would actually have: the original invoice or receipt showing the device identifier, a carrier contract, or an insurance replacement document. A photograph of a phone alone is not proof of purchase. Turnaround is typically a few business days, and there is no charge for the owner.",
          "If you bought the device second-hand and the seller is reachable, the fastest path by far is asking them to sign out of iCloud or remove the device at icloud.com/find. That takes the seller thirty seconds and avoids the whole process.",
        ],
      },
      {
        heading: "What to do when a seller will not help",
        paragraphs: [
          "A seller who refuses to remove Activation Lock is the clearest possible signal that something is wrong with the sale. An iPhone X that is permanently locked is worth parts value only, and no amount of searching will change that.",
          "If you paid by a method with buyer protection, open a dispute with the platform and cite the Activation Lock screen as evidence of a non-functional item. If you paid in cash to a private seller, the loss is usually not recoverable — which is exactly why checking for Activation Lock before paying matters.",
        ],
      },
      {
        heading: "Is FRPB relevant to the iPhone X?",
        paragraphs: [
          "No. FRPB is an Android recovery toolkit — it drives MediaTek BROM, Qualcomm EDL, Fastboot and Samsung Download mode to clear Android's Factory Reset Protection and perform flash resets. It does not touch iOS, and it cannot clear iCloud Activation Lock on any iPhone.",
          "We say this plainly rather than sending you to a checkout page that cannot help. If your work is Android repair, FRPB is built for exactly that; if it is an iPhone you own with a lock, Apple Support is your route.",
        ],
      },
    ],
    datePublished: "2026-03-02",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "how-to-bypass-icloud-activation-lock-iphone-11-2026",
    title: "iPhone 11 iCloud Activation Lock Removal Guide 2026",
    description:
      "How to remove iCloud Activation Lock on an iPhone 11 in 2026 — the Apple Support proof-of-purchase route, Apple ID recovery, and why there is no software bypass.",
    excerpt:
      "The iPhone 11 (A13) is past the checkm8 window entirely. Here is the honest 2026 picture for owners and repair shops.",
    keywords: [
      "iphone 11 icloud lock removal",
      "iphone 11 activation lock bypass 2026",
      "bypass icloud activation lock iphone 11",
      "iphone 11 icloud unlock",
      "iphone 11 activation lock removal",
    ],
    brand: "Apple",
    model: "iPhone 11",
    androidVersions: [],
    osVersions: ["iOS 13", "iOS 14", "iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A13 Bionic",
    estimatedTime: "PT18M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "Activation Lock on the iPhone 11, explained",
        paragraphs: [
          "The iPhone 11 runs A13 and ships from iOS 13, with updates available through iOS 18. Activation Lock behaviour is identical across all of them: the lock is registered to an Apple ID on Apple's activation servers and is re-checked every time the device is activated.",
          "Nothing stored on the handset can bypass that check. A restore, a DFU restore or a fresh IPSW install all clear the operating system but leave Activation Lock in place — which is exactly why so many people discover that a restore did not help.",
        ],
      },
      {
        heading: "Why there is no software bypass for A13 devices",
        paragraphs: [
          "The checkm8 bootrom exploit affects A5 through A11 only. The iPhone 11's A13 chip fixed that class of vulnerability, so even the hardware-level jailbreak routes that exist for older iPhones are unavailable here.",
          "Even if they were available, they would not help. Activation Lock is enforced by Apple's servers at activation time, not by a local flag. A tool that cannot change the server's answer cannot remove the lock, however deep its device access goes.",
        ],
      },
      {
        heading: "The owner route: recover the Apple ID first",
        paragraphs: [
          "The overwhelming majority of locked iPhone 11 devices are locked to an account the current holder can reach but has forgotten the password for. That is a password problem, not a bypass problem, and it has a fast fix.",
          "Go to iforgot.apple.com and begin account recovery using the Apple ID email or phone number shown on the Activation Lock screen. Account recovery takes a few days by design, but it clears Activation Lock completely and costs nothing.",
        ],
      },
      {
        heading: "When the Apple ID is truly gone",
        paragraphs: [
          "If the account no longer exists, Apple's Activation Lock removal request is the correct path. You provide the device IMEI or serial number plus the original proof of purchase, and Apple validates it against the original sale record.",
          "Repair shops should set expectations here: this is a documentation process, not a technical one. A device with no recoverable proof of purchase will not be unlocked, and a shop that promises otherwise is promising something it cannot deliver.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "Buying a used iPhone 11 — avoid the lock entirely",
        paragraphs: [
          "Before money changes hands, ask the seller to erase the device in front of you via Settings → General → Transfer or Reset iPhone → Erase All Content and Settings. A clean erase that reaches the Hello screen with no Activation Lock is the only reliable proof.",
          "Then confirm with the IMEI on a service like Apple's own coverage checker, and keep the conversation in a channel that leaves a written record. That single step prevents the entire problem this guide solves.",
        ],
      },
      {
        heading: "Where FRPB fits — and where it does not",
        paragraphs: [
          "FRPB is an Android repair toolkit for Factory Reset Protection on Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola, MediaTek and Qualcomm devices. It has no iOS capability whatsoever.",
          "We deliberately do not sell an iPhone 11 unlock, because a legitimate one does not exist for a device that is not yours. If your workshop handles Android handsets alongside iPhones, FRPB covers the Android half honestly and accurately.",
        ],
      },
    ],
    datePublished: "2026-03-02",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "how-to-bypass-icloud-activation-lock-iphone-12-2026",
    title: "iPhone 12 iCloud Activation Lock Removal Guide 2026",
    description:
      "Remove iCloud Activation Lock on an iPhone 12 in 2026 via Apple ID recovery or Apple's proof-of-purchase request, plus what genuinely does not work on A14 devices.",
    excerpt:
      "iPhone 12 on A14 with 5G and iOS 14–18. The lock rules are unchanged — this is the accurate, current 2026 walkthrough for owners and technicians.",
    keywords: [
      "iphone 12 icloud lock removal",
      "iphone 12 activation lock bypass 2026",
      "bypass icloud activation lock iphone 12",
      "iphone 12 icloud unlock 2026",
      "activation lock removal service",
    ],
    brand: "Apple",
    model: "iPhone 12",
    androidVersions: [],
    osVersions: ["iOS 14", "iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A14 Bionic",
    estimatedTime: "PT18M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "How Activation Lock behaves on the iPhone 12",
        paragraphs: [
          "The iPhone 12 family (A14) shipped on iOS 14 and receives updates through iOS 18. Activation Lock is bound to the Apple ID on Apple's servers and re-verified at every activation, so the version of iOS on the device changes nothing about the lock.",
          "This is why guides that tell you to update, downgrade or restore firmware in order to 'remove' Activation Lock are describing steps that cannot affect the outcome. The firmware is not where the lock lives.",
        ],
      },
      {
        heading: "The two routes that actually work",
        paragraphs: [
          "There are exactly two legitimate ways an iPhone 12 Activation Lock is cleared: the account owner signs in (or removes the device from Find My), or Apple clears the lock after verifying proof of purchase.",
          "Everything else offered online — paid 'iCloud unlock services', remote unlocking software, or a shop promising to wipe the lock — either asks for your device and returns nothing, or takes payment for a step you could do yourself for free.",
        ],
      },
      {
        heading: "Step-by-step: recover the Apple ID",
        paragraphs: [
          "If the Activation Lock screen names an Apple ID you have some claim to, account recovery is the fastest legitimate route. Apple's recovery flow is deliberately slow, because it is designed to defeat exactly the kind of account takeover that would make Activation Lock worthless.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "Submitting a proof-of-purchase removal request",
        paragraphs: [
          "When the Apple ID is genuinely unreachable, submit an Activation Lock removal request through Apple Support. You will need the IMEI or serial number and documentation that ties the device to you: an original invoice, a carrier contract, or an insurance document showing the identifier.",
          "Screenshots of a marketplace listing are not proof of purchase. If that is all you have, contact the seller first — a cooperative seller can remove the device from their iCloud account in under a minute, which resolves the lock instantly.",
        ],
      },
      {
        heading: "Warnings for used-device buyers",
        paragraphs: [
          "A locked iPhone 12 has parts value, not resale value. Any listing that shows an Activation Lock screen and describes the device as 'easily unlocked' is misleading — and one that says 'no iCloud' while showing a Hello screen should be verified before payment.",
          "Ask for a short video of the erase completing to the Hello screen with no lock. That is the only reliable pre-purchase check, and a legitimate seller will have no objection to providing it.",
        ],
      },
      {
        heading: "FRPB and iOS — setting the record straight",
        paragraphs: [
          "FRPB does not unlock iPhones. It is a Windows toolkit for Android Factory Reset Protection and flash resets, working through MediaTek BROM, Qualcomm EDL, Fastboot and Samsung Download mode.",
          "If you arrived here looking for an Android FRP solution, our Android guides cover the exact per-model procedures. If you have a locked iPhone 12 you own, Apple Support is the route that works.",
        ],
      },
    ],
    datePublished: "2026-03-02",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "how-to-bypass-icloud-activation-lock-iphone-13-14-15-2026",
    title: "iPhone 13, 14 & 15 iCloud Activation Lock Guide 2026",
    description:
      "iCloud Activation Lock removal for iPhone 13, 14 and 15 in 2026 — Apple ID recovery, Apple's proof-of-purchase process, and why no bypass tool works on A15/A16/A17.",
    excerpt:
      "iPhone 13 through 15 span A15 to A17 Pro. The Activation Lock rules have not changed, and no software bypass exists. Here is the accurate 2026 guide.",
    keywords: [
      "iphone 13 icloud lock removal",
      "iphone 14 activation lock bypass 2026",
      "iphone 15 icloud unlock",
      "bypass icloud activation lock 2026",
      "apple activation lock removal",
    ],
    brand: "Apple",
    model: "iPhone 13 / 14 / 15",
    androidVersions: [],
    osVersions: ["iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A15 / A16 / A17 Pro",
    estimatedTime: "PT20M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "One lock, four generations",
        paragraphs: [
          "The iPhone 13 (A15), iPhone 14 (A15/A16) and iPhone 15 (A16/A17 Pro) all enforce Activation Lock identically. The chips are faster and the Secure Enclave is tighter, but the mechanism is unchanged: the lock lives on Apple's servers and is checked at activation.",
          "Grouping them is useful because the practical answer is identical for all three, and because the searches for them share the same intent — a device is stuck on an Activation Lock screen and the holder needs the real 2026 procedure.",
        ],
      },
      {
        heading: "No A15/A16/A17 software bypass exists",
        paragraphs: [
          "The checkm8 bootrom era ended with the A11. A12 and later — which covers every device in this guide — are not vulnerable to it, and no comparable public bootrom exploit has emerged.",
          "More importantly, even a hypothetical bootrom exploit would not help. Activation Lock is an entitlement granted by Apple's activation servers. There is no on-device flag to flip, so a device-side exploit has no target to attack.",
        ],
      },
      {
        heading: "Route one: the owner removes the lock in minutes",
        paragraphs: [
          "If the Apple ID belongs to you or to someone who can be reached, this is the fastest path by a wide margin. The account owner signs in on the device, or removes it from their Find My list at icloud.com/find.",
          "That action releases Activation Lock server-side immediately. There is no fee, no tool and no waiting period — it is a single authenticated action from the account holder.",
        ],
      },
      {
        heading: "Route two: Apple Support with proof of purchase",
        paragraphs: [
          "When the account is genuinely gone, Apple can clear the lock after verifying that you own the hardware. Submit an Activation Lock removal request with the IMEI or serial number and original proof of purchase.",
          "Acceptable evidence is a receipt or invoice showing the device identifier, a carrier contract, or an insurance replacement document. Apple will not clear a lock on documentation that does not establish ownership, and no third-party service can shortcut that check.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "What to do if the device is not yours and the owner is gone",
        paragraphs: [
          "A locked iPhone 13, 14 or 15 with no recoverable Apple ID and no proof of purchase cannot be activated for use. It retains parts value — display, battery, cameras, chassis — but that is the ceiling.",
          "Any service charging to remove Activation Lock on such a device is either returning it unchanged or asking you to hand over hardware you will not get back. Neither outcome is worth the fee.",
        ],
      },
      {
        heading: "FRPB is an Android tool — worth being clear",
        paragraphs: [
          "FRPB exists to remove Android's Factory Reset Protection and perform flash resets across Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola and MediaTek/Qualcomm hardware. It cannot and does not unlock iOS devices.",
          "We publish these iPhone guides because the honest answer is genuinely useful, and because sending iPhone owners to an Android tool would waste their time. For Android FRP, the per-model guides on this blog cover the exact procedure.",
        ],
      },
    ],
    datePublished: "2026-03-02",
    dateModified: "2026-09-17",
    readingMinutes: 8,
  }),
];
