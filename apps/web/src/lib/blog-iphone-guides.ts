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

/** Owner route for a forgotten passcode / Face ID lock (data-erasing — needs owner approval). */
const PASSCODE_OWNER_STEPS = [
  "Confirm the device is stuck on the passcode or Face ID screen and that you own it (or hold written owner permission).",
  "If the device has ever synced to iCloud with Find My on, use icloud.com/find → Erase This Device to erase it and remove Activation Lock together.",
  "Otherwise put the iPhone into recovery mode and restore it with Finder (macOS) or Apple Devices / iTunes (Windows).",
  "Sign in with the owning Apple ID when setup asks for it — that clears Activation Lock as the rightful owner.",
  "Set the device up as new (or restore a backup) and choose a passcode you will not forget.",
  "If you cannot supply the Apple ID, stop: the restore leaves the device at Activation Lock, which only the account owner or Apple Support can clear.",
];

/** Pre-purchase checks that prove a used iPhone is not Activation-Locked. */
const PRE_PURCHASE_CHECK_STEPS = [
  "Ask the seller to factory-reset the iPhone in front of you (Settings → General → Transfer or Reset iPhone → Erase All Content and Settings).",
  "Confirm it drops to the Hello / setup screen rather than an Activation Lock screen.",
  "Watch the seller sign out of iCloud, or verify at icloud.com/find that the device is gone from their account.",
  "Check the IMEI on the box or SIM tray against Settings → General → About before any reset.",
  "Test that a fresh Apple ID of yours can complete setup and reach the Home Screen.",
  "Walk away from any seller who refuses any of these steps — it is the single most reliable red flag.",
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

  modelGuide({
    slug: "ipad-icloud-activation-lock-removal-2026",
    title: "iPad iCloud Activation Lock Removal Guide 2026",
    description:
      "iPad iCloud Activation Lock removal in 2026 — the Find My route for a bootable iPad and Apple's proof-of-purchase process for one stuck on the Activation Lock screen. No software bypass exists.",
    excerpt:
      "iPads enforce Activation Lock exactly like iPhones, server-side and re-checked at activation. Here is the accurate 2026 owner route for both a bootable iPad and one stuck on the lock screen.",
    keywords: [
      "ipad icloud activation lock removal",
      "ipad activation lock bypass 2026",
      "remove icloud lock ipad",
      "ipad locked to owner",
      "apple activation lock removal",
    ],
    brand: "Apple",
    model: "iPad (all models)",
    androidVersions: [],
    osVersions: ["iPadOS 15", "iPadOS 16", "iPadOS 17", "iPadOS 18"],
    method: "manual",
    chipset: "Apple A-series / M-series",
    estimatedTime: "PT20M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "Activation Lock on iPad is the same server-side lock",
        paragraphs: [
          "Activation Lock is Find My's anti-theft layer. On an iPad it binds the device to the Apple ID signed in when Find My was enabled, and Apple's activation servers re-check that binding every time the iPad is set up or restored.",
          "Because the check is server-side, nothing stored on the iPad can clear it. Reinstalling iPadOS, using a DFU restore, or running any 'iPad unlock' utility changes the software on the device but cannot change what Apple's servers believe about ownership.",
        ],
      },
      {
        heading: "If the iPad still boots: the Find My route",
        paragraphs: [
          "When the iPad powers on past the lock screen, the account holder can release Activation Lock in seconds. Sign in at icloud.com/find (or on any Apple device with the same Apple ID) and choose Erase This Device, or simply Remove from Account.",
          "That action clears the lock server-side immediately and needs no tool, no fee and no waiting period — because the account owner is the key to the lock.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "If the iPad is stuck on the Activation Lock screen",
        paragraphs: [
          "A reset iPad shows an Activation Lock screen if the previous owner never signed out. Recovering it depends entirely on reaching that Apple ID or proving you own the hardware.",
          "First try to recover the account at iforgot.apple.com. If the account is genuinely gone — a deceased relative, a defunct business, a deleted address — Apple can clear the lock after verifying the device's purchase record.",
        ],
      },
      {
        heading: "Cellular iPads add one document",
        paragraphs: [
          "Wi-Fi iPads have a serial number; cellular iPad models also carry an IMEI. That IMEI is the cleanest identifier to quote in an Activation Lock removal request, and a carrier contract or invoice showing it is strong proof of purchase.",
          "Submit the request through Apple Support with the serial number or IMEI and the original receipt. Apple checks the sales record and clears the lock for the owner, usually within a few days and at no charge.",
        ],
      },
      {
        heading: "Why no iPad unlock tool can work",
        paragraphs: [
          "Older iPads built on A5–A11 chips share the checkm8 bootrom vulnerability, which is why they appear in jailbreak discussions. checkm8 gives code execution on the device; it does not touch a server-side entitlement.",
          "Every iPad from A12 onward is not even vulnerable to checkm8. In both cases the conclusion is identical: there is no on-device flag to flip, so no tool can clear Activation Lock on a device you do not own.",
        ],
      },
      {
        heading: "FRPB is an Android tool — worth being explicit",
        paragraphs: [
          "FRPB removes Android Factory Reset Protection and performs flash resets across Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola and MediaTek/Qualcomm hardware. It does not support iPadOS and cannot clear iCloud Activation Lock on any iPad.",
          "We publish these guides because the truthful answer is useful. For a locked iPad you own, the Apple ID holder or Apple Support is the only route that works.",
        ],
      },
    ],
    datePublished: "2026-03-09",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "iphone-forgotten-passcode-face-id-unlock-2026",
    title: "Forgotten iPhone Passcode or Face ID Lock: 2026 Owner's Guide",
    description:
      "Forgot your iPhone passcode, or is Face ID failing? The 2026 owner route — iCloud Erase, recovery-mode restore, and where Activation Lock fits in — plus why no tool bypasses a Secure Enclave passcode.",
    excerpt:
      "A forgotten passcode is not an Activation Lock, and the two are fixed differently. This is the honest 2026 route for an iPhone you own.",
    keywords: [
      "forgot iphone passcode unlock 2026",
      "iphone face id not working unlock",
      "iphone passcode removal owner",
      "reset iphone forgotten passcode",
      "iphone secure enclave passcode",
    ],
    brand: "Apple",
    model: "iPhone (Face ID / Touch ID models)",
    androidVersions: [],
    osVersions: ["iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A12 – A18 (Secure Enclave)",
    estimatedTime: "PT30M",
    prerequisites: COMMON_PREREQUISITES,
    steps: PASSCODE_OWNER_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "Passcode lock and Activation Lock are different problems",
        paragraphs: [
          "A passcode lock stops you reaching the Home Screen; Activation Lock stops the device being activated to a new owner. A forgotten passcode alone does not raise an Activation Lock screen — but the fix for a forgotten passcode can, if the device is not properly released.",
          "Knowing which one you are facing changes the route entirely, so check whether the screen asks for a six-digit passcode to continue setup, or names another person's Apple ID as 'locked to owner'. They are diagnosed and solved differently.",
        ],
      },
      {
        heading: "The Secure Enclave makes the passcode unreadable",
        paragraphs: [
          "Modern iPhones store the passcode hash in the Secure Enclave, a dedicated coprocessor that will not export it and enforces escalating delays and an optional erase-after-10-failures policy. There is no file to read, no server to query and no command that reveals it.",
          "That is why every legitimate solution ends in an erase, not a decryption. Anyone promising to 'read' or 'keep your data' while removing a passcode is describing a feature that does not exist on a locked, current iPhone.",
        ],
      },
      {
        heading: "The owner route: erase and restore",
        paragraphs: [
          "For an iPhone you own, the passcode is cleared by erasing the device. If it is connected to iCloud with Find My enabled, iCloud.com/find → Erase This Device both wipes it and removes Activation Lock in one step.",
          "If it has never synced or you prefer a cable, put it in recovery mode and restore with Finder (macOS) or Apple Devices / iTunes (Windows), then sign in with the owning Apple ID when setup asks for it.",
        ],
        steps: PASSCODE_OWNER_STEPS,
      },
      {
        heading: "When the restore lands on Activation Lock",
        paragraphs: [
          "Restoring a device that is still bound to someone else's Apple ID clears the passcode but leaves Activation Lock in place — the wipe removes the passcode, not the server-side ownership record. This is the moment many people mistake for a 'failed bypass'.",
          "The correct response is to supply the owning Apple ID, or, if it is genuinely unreachable, to submit an Activation Lock removal request to Apple with proof of purchase. A second erase will not help.",
        ],
      },
      {
        heading: "Face ID is a convenience layer, not a recovery path",
        paragraphs: [
          "Face ID and Touch ID unlock a device that is already authorised; they never authorise a device you cannot get past the passcode on. Setting them up requires the passcode first, and they are disabled after a restart or five failed attempts.",
          "So 'Face ID stopped working' is usually a passcode-recovery problem, and 'Face ID won't recognise me' after a restart simply means entering the passcode — there is nothing for a tool to bypass.",
        ],
      },
      {
        heading: "FRPB cannot help with an iPhone passcode",
        paragraphs: [
          "FRPB is a Windows Android toolkit for Factory Reset Protection on Samsung, Xiaomi, Vivo, OPPO, Realme, Motorola and MediaTek/Qualcomm devices. It does not read, reset or bypass an iPhone passcode or Face ID.",
          "If your locked device is Android, the per-model FRP guides on this blog are the accurate next step; if it is an iPhone you own, the owner erase route above is the one that works.",
        ],
      },
    ],
    datePublished: "2026-03-09",
    dateModified: "2026-09-17",
    readingMinutes: 8,
  }),

  modelGuide({
    slug: "ios-16-17-18-activation-lock-2026",
    title: "iOS 16, 17 & 18 Activation Lock: What Changed for 2026",
    description:
      "How Activation Lock behaves across iOS 16, 17 and 18 in 2026 — Stolen Device Protection, the improved owner-recovery flow, and the unchanged truth that only the owner or Apple can clear the lock.",
    excerpt:
      "iOS 16, 17 and 18 hardened the features around Activation Lock but left its server-side model intact. Here is what actually changed and what did not.",
    keywords: [
      "ios 18 activation lock",
      "ios 17 icloud lock removal",
      "ios 16 activation lock bypass 2026",
      "stolen device protection activation lock",
      "apple activation lock 2026",
    ],
    brand: "Apple",
    model: "iPhone (iOS 16–18)",
    androidVersions: [],
    osVersions: ["iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A12 – A18",
    estimatedTime: "PT20M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "The core model never changed",
        paragraphs: [
          "Across iOS 16, 17 and 18, Activation Lock remains an entitlement recorded on Apple's activation servers and re-checked at setup. The device holds a reference, not the decision — which is why no version of iOS ships with a bypass.",
          "Each release tightened the features around the lock rather than the lock's mechanism. Knowing which of those features you are dealing with tells you whether the standard owner route still applies — and in every case, it does.",
        ],
      },
      {
        heading: "iOS 17.3 added Stolen Device Protection",
        paragraphs: [
          "Stolen Device Protection (iOS 17.3 and later) adds a biometric requirement and a one-hour security delay before certain critical actions when you are away from familiar locations. Its purpose is to stop a thief who has shoulder-surfed your passcode from changing your Apple ID or turning off Find My.",
          "It does not create a new bypass surface — it closes one. For the legitimate owner it simply means some settings changes take longer; for a thief it means the device is even harder to repurpose.",
        ],
      },
      {
        heading: "Recovery contacts and the faster owner path",
        paragraphs: [
          "Recent iOS versions make account recovery more practical: recovery contacts, legacy contacts and improved iforgot flows mean the true owner has more ways to regain the Apple ID, which is the fastest lock-release available.",
          "Where none of those apply, the Apple Support Activation Lock removal request remains the fallback. Apple verifies the purchase record and clears the lock server-side for the owner.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "What 'iOS 18 activation lock bypass' searches actually mean",
        paragraphs: [
          "Most of those searches describe a phone stuck on the Activation Lock screen, not a genuine bypass. The honest answer for a device you own is the account or Apple Support route; for a device you do not own, no route exists.",
          "New iOS releases do not open bypasses — if anything they close them. A tool that claims to clear Activation Lock on iOS 18 is misrepresenting how the lock works.",
        ],
      },
      {
        heading: "FRPB's scope",
        paragraphs: [
          "FRPB provides no iOS functionality whatsoever. It is an Android recovery toolkit driving BROM, EDL, Fastboot and Download mode to clear Android's Factory Reset Protection.",
          "This guide exists so that the iOS 16/17/18 searches land on accurate information. If your device is Android, the model guides on this blog describe the exact FRP procedure.",
        ],
      },
    ],
    datePublished: "2026-03-09",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "check-icloud-activation-lock-before-buying-used-iphone-2026",
    title: "Check iCloud Activation Lock Before Buying a Used iPhone 2026",
    description:
      "A step-by-step 2026 checklist to confirm a used iPhone is free of iCloud Activation Lock before you pay — plus the red flags that mean you should walk away from the sale.",
    excerpt:
      "A few minutes of checking prevents the single most expensive used-iPhone mistake. Here is exactly what to verify, and when to walk away.",
    keywords: [
      "check activation lock before buying iphone",
      "used iphone icloud lock check 2026",
      "iphone imei activation lock check",
      "buying used iphone checklist",
      "iphone locked to owner seller",
    ],
    brand: "Apple",
    model: "iPhone (pre-purchase check)",
    androidVersions: [],
    osVersions: ["iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    estimatedTime: "PT15M",
    prerequisites: [
      "The physical iPhone in front of you, powered on",
      "Its original box or SIM tray to read the IMEI",
      "A working internet connection to check Apple's coverage and lock status",
      "Enough time to watch a full factory reset complete",
    ],
    steps: PRE_PURCHASE_CHECK_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "Why this check matters more than any spec",
        paragraphs: [
          "A used iPhone that is still bound to the seller's Apple ID will stop at an Activation Lock screen the moment it is reset, however good the screen or battery is. At that point it is worth parts money only.",
          "Activation Lock cannot be removed by any tool, so the entire value of the purchase hinges on confirming the lock is not present before you hand over money.",
        ],
      },
      {
        heading: "The five-minute verification",
        paragraphs: [
          "Do this with the seller present and before any payment. If any step is refused, treat it as a failed inspection rather than a negotiation point.",
        ],
        steps: PRE_PURCHASE_CHECK_STEPS,
      },
      {
        heading: "Reading the IMEI the right way",
        paragraphs: [
          "Find the IMEI in Settings → General → About, on the original box, or in the SIM tray of older models. Cross-check that the number matches in all available places — mismatches are a sign of a swapped chassis or a refurbished device being sold as new.",
          "You can confirm the device is not reported lost or stolen and see its Activation Lock state through Apple's coverage checker and any reputable IMEI check service. A device still signed in to someone's Find My will show as activation-locked.",
        ],
      },
      {
        heading: "Red flags that should end the sale",
        paragraphs: [
          "A seller who will not let you reset the phone in person, who 'will remove the account later', who insists you pay first, or who claims Activation Lock is easy to 'unlock with software' is describing a device you cannot safely buy.",
          "That last claim is both false and a reliable tell: no software clears Activation Lock. A seller who repeats it either does not understand the device they are selling or intends to sell you one that will never activate.",
        ],
      },
      {
        heading: "FRPB and used-device checks",
        paragraphs: [
          "FRPB is for Android Factory Reset Protection, not iOS Activation Lock, so it plays no part in inspecting an iPhone. Its relevance is to Android purchases, where FRP is the equivalent obstacle and can be cleared for a genuine owner.",
          "Whichever platform you are buying, the principle is identical: verify the device is free of its previous account before paying, because that is the one problem no tool reliably fixes.",
        ],
      },
    ],
    datePublished: "2026-03-09",
    dateModified: "2026-09-17",
    readingMinutes: 7,
  }),

  modelGuide({
    slug: "iphone-stuck-on-activation-lock-after-reset-2026",
    title: "iPhone Stuck on Activation Lock After Factory Reset: 2026 Fix",
    description:
      "An iPhone stuck on the Activation Lock screen after a factory reset needs the owning Apple ID or Apple's proof-of-purchase removal — not another wipe. Here is the 2026 fix, step by step.",
    excerpt:
      "A factory reset removes your data, not Activation Lock. If your iPhone now sits on the 'locked to owner' screen, this is the accurate 2026 way forward.",
    keywords: [
      "iphone activation lock after factory reset",
      "iphone stuck on activation lock screen",
      "activation lock removal after reset 2026",
      "iphone locked to owner fix",
      "apple id lock iphone reset",
    ],
    brand: "Apple",
    model: "iPhone (post-reset)",
    androidVersions: [],
    osVersions: ["iOS 15", "iOS 16", "iOS 17", "iOS 18"],
    method: "manual",
    chipset: "Apple A-series",
    estimatedTime: "PT20M",
    prerequisites: COMMON_PREREQUISITES,
    steps: OWNER_ROUTE_STEPS,
    category: "iphone",
    platform: "iOS",
    sections: [
      {
        heading: "Why a reset leaves the lock behind",
        paragraphs: [
          "A factory reset erases the data stored on the iPhone. Activation Lock is not stored there — it is an entitlement on Apple's activation servers, keyed to the Apple ID that had Find My enabled.",
          "So the reset cleans the device but leaves the ownership record intact, and the next setup flow stops at the Activation Lock screen. Resetting again changes nothing, because erasing device data was never what held the lock.",
        ],
      },
      {
        heading: "The only two fixes that work",
        paragraphs: [
          "Either the Apple ID holder signs in or removes the device from Find My, or Apple clears the lock after verifying your proof of purchase. There is no third option.",
        ],
        steps: OWNER_ROUTE_STEPS,
      },
      {
        heading: "If it was your device and your Apple ID",
        paragraphs: [
          "Enter the Apple ID and password when the Activation Lock screen appears. If you have forgotten the password, recover the account at iforgot.apple.com — completing recovery lets you sign in and the lock releases.",
          "If the account was deleted entirely, gather the original proof of purchase and submit an Activation Lock removal request to Apple Support. Your own ownership is what the process verifies.",
        ],
      },
      {
        heading: "If you bought it used and the seller is reachable",
        paragraphs: [
          "Ask the seller to sign in to icloud.com/find, select the device and choose Remove from Account (or Erase This Device). That releases Activation Lock server-side in under a minute and costs nothing.",
          "This is by far the fastest resolution, and a cooperative seller should have no objection. Reluctance here is itself informative about the sale.",
        ],
      },
      {
        heading: "If the lock cannot be cleared",
        paragraphs: [
          "When neither the Apple ID nor the proof of purchase exists, the iPhone cannot be activated for use. It retains parts value — display, battery, cameras, chassis — and that is the honest ceiling.",
          "Be wary of any service offering to remove Activation Lock in this situation; the only realistic outcomes are a device returned unchanged or hardware handed over and not recovered.",
        ],
      },
      {
        heading: "FRPB does not touch iOS",
        paragraphs: [
          "FRPB is an Android Factory Reset Protection toolkit and has no iOS capability. It cannot clear Activation Lock, and it does not claim to.",
          "On Android, FRP is the similar-looking lock — and there FRPB's per-model guides provide the genuine, owner-authorised procedure. For a locked iPhone you own, Apple Support is the route.",
        ],
      },
    ],
    datePublished: "2026-03-09",
    dateModified: "2026-09-17",
    readingMinutes: 8,
  }),
];
