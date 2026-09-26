// FRPB — free utility tools: shared models, feature metadata, route helpers and
// IPC contracts.
//
// Single source of truth for the four free lead-magnet utilities promoted across
// frpb.in (WhatsApp Transfer, Phone Transfer, Data Eraser, Virtual Location).
// Consumed by:
//   - apps/web  (programmatic SEO landing routes + home "Free Utilities" section)
//   - apps/desktop (the "Free Utilities" tab and its IPC bridge contracts)
//
// The shapes intentionally mirror the brand-page SEO config idiom so the web
// layer can render them through the same presentational component.

/** Stable identifier for each free utility. Used as a route slug, IPC op key and
 *  analytics dimension. Never reorder/reuse — treat as a persisted enum. */
export type FreeToolId =
  | "whatsapp-transfer"
  | "phone-transfer"
  | "data-eraser"
  | "virtual-location";

/** Coarse grouping used to colour cards and filter the utilities grid. */
export type FreeToolCategory = "transfer" | "privacy" | "location";

/** How much of the tool runs on-device vs. requiring the desktop app. All four
 *  utilities are fully offline; the desktop app is the execution surface. */
export type FreeToolPlatform = "desktop";

/** A single highlighted capability shown on the card and landing page. */
export interface FreeToolFeature {
  /** Lucide icon key resolved by the consuming UI layer. */
  icon: FreeToolIconKey;
  title: string;
  desc: string;
}

/** One numbered step in the guided workflow wizard. */
export interface FreeToolStep {
  title: string;
  desc: string;
}

/** FAQ entry rendered on the landing page + emitted as FAQPage JSON-LD.
 *  Structurally identical to the web FaqItem so it can be passed straight in. */
export interface FreeToolFaq {
  question: string;
  answer: string;
}

/** Icon keys available to the free-tools UI. Kept as a closed union so the web
 *  and desktop icon maps stay exhaustive at compile time. */
export type FreeToolIconKey =
  | "MessageCircle"
  | "Smartphone"
  | "Eraser"
  | "MapPin"
  | "ShieldCheck"
  | "Zap"
  | "Wifi"
  | "Lock"
  | "Download"
  | "CheckCircle2"
  | "Sparkles"
  | "RefreshCw";

/** Full metadata for one free utility. Data-only (no JSX) so it is safe to
 *  import from both server components and the Electron main process. */
export interface FreeToolMeta {
  id: FreeToolId;
  /** SEO <title> / card heading. */
  title: string;
  /** Canonical route path, e.g. "/whatsapp-transfer-tool". */
  path: string;
  /** Short pill/label shown on the card CTA. */
  eyebrow: string;
  /** One-line value proposition (cards + meta description). */
  tagline: string;
  /** Longer meta description for the landing page. */
  description: string;
  /** Space-separated keyword list for <meta name="keywords">. */
  keywords: string;
  category: FreeToolCategory;
  platform: FreeToolPlatform;
  /** Relative weight for "popularity"-style ordering (higher = promoted). */
  popularity: number;
  features: readonly FreeToolFeature[];
  steps: readonly FreeToolStep[];
  faq: readonly FreeToolFaq[];
  /** Primary asset/skill the utility operates on (for card subtitles). */
  target: string;
}

/** Canonical map of all free utilities keyed by id. */
export const FREE_TOOLS: Record<FreeToolId, FreeToolMeta> = {
  "whatsapp-transfer": {
    id: "whatsapp-transfer",
    title: "WhatsApp Transfer Tool — Move Chats to a New Phone",
    path: "/whatsapp-transfer-tool",
    eyebrow: "WhatsApp Transfer",
    tagline: "Move WhatsApp chats, photos and videos to a new Android phone in minutes.",
    description:
      "Transfer WhatsApp chats, images, videos and attachments from one Android phone to another — no cloud backup, no data plan required. FRPB connects both devices over a local USB link and copies the WhatsApp media store directly, preserving chat history.",
    keywords:
      "whatsapp transfer, move whatsapp chats, whatsapp data migration android, transfer whatsapp to new phone, whatsapp backup alternative",
    category: "transfer",
    platform: "desktop",
    popularity: 100,
    target: "WhatsApp",
    features: [
      {
        icon: "MessageCircle",
        title: "Full chat history",
        desc: "Copies text threads, group chats and archived conversations without gaps.",
      },
      {
        icon: "Download",
        title: "Media included",
        desc: "Moves photos, voice notes and videos from the WhatsApp media store.",
      },
      {
        icon: "ShieldCheck",
        title: "100% offline",
        desc: "Runs over a local USB connection — nothing is uploaded to a server.",
      },
      {
        icon: "Zap",
        title: "Minute-fast",
        desc: "Optimised copy engine moves gigabytes in a fraction of the time.",
      },
    ],
    steps: [
      { title: "Connect both phones", desc: "Plug the old and new Android devices into your PC via USB." },
      { title: "Detect WhatsApp data", desc: "FRPB scans the WhatsApp package and media store on the source device." },
      { title: "Start the transfer", desc: "Pick chats or transfer everything, then let the wizard copy the data." },
      { title: "Open on the new phone", desc: "Verify your number in WhatsApp and your history appears instantly." },
    ],
    faq: [
      {
        question: "Do I need a cloud backup to transfer WhatsApp?",
        answer:
          "No. The WhatsApp Transfer tool copies the chat database and media store directly over USB, so you don't need Google Drive or any cloud backup.",
      },
      {
        question: "Will my WhatsApp chats transfer with photos and videos?",
        answer:
          "Yes. The transfer includes text messages, group chats, images, voice notes and videos stored in the WhatsApp media folder.",
      },
      {
        question: "Does the WhatsApp Transfer tool require a license?",
        answer:
          "The utility is included with the FRPB desktop app and full module execution requires an active FRPB license key — no subscription and no watermark.",
      },
      {
        question: "Are my chats uploaded anywhere?",
        answer:
          "Never. The transfer happens entirely over a local USB connection between your PC and your phones.",
      },
    ],
  },

  "phone-transfer": {
    id: "phone-transfer",
    title: "Phone to Phone Transfer — Android Data Migration",
    path: "/phone-to-phone-transfer",
    eyebrow: "Phone Transfer",
    tagline: "Copy contacts, photos, videos, SMS and apps between any two Android phones.",
    description:
      "Move contacts, call logs, SMS, photos, videos, music and documents from one Android phone to another. FRPB's Phone Transfer wizard runs over USB, works cross-brand, and never routes your personal data through a server.",
    keywords:
      "phone to phone transfer, android data transfer, transfer contacts photos android, switch android phones, copy data between phones",
    category: "transfer",
    platform: "desktop",
    popularity: 90,
    target: "Any Android",
    features: [
      {
        icon: "Smartphone",
        title: "Cross-brand",
        desc: "Works between Samsung, Xiaomi, OPPO, vivo, realme, Pixel and more.",
      },
      {
        icon: "Download",
        title: "Any file type",
        desc: "Contacts, SMS, call logs, gallery, music, videos and documents.",
      },
      {
        icon: "RefreshCw",
        title: "Selective copy",
        desc: "Transfer everything or tick only the categories you need.",
      },
      {
        icon: "ShieldCheck",
        title: "No cloud",
        desc: "Direct USB-to-USB style transfer — your data never leaves your devices.",
      },
    ],
    steps: [
      { title: "Connect both devices", desc: "Attach the source and destination Android phones via USB." },
      { title: "Choose what to move", desc: "Select contacts, media, messages or full device data." },
      { title: "Run the transfer", desc: "FRPB copies the selected categories with live progress." },
      { title: "Verify", desc: "Open the destination phone and confirm your data is present." },
    ],
    faq: [
      {
        question: "Can I transfer between different Android brands?",
        answer:
          "Yes. Phone Transfer is brand-agnostic and works between any two Android phones that support USB debugging.",
      },
      {
        question: "Which data types can I move?",
        answer:
          "Contacts, call logs, SMS, photos, videos, music and documents. You can transfer everything or pick specific categories.",
      },
      {
        question: "Does it require root?",
        answer:
          "No root is required. The wizard enables USB debugging on both devices and copies data through the standard Android APIs.",
      },
      {
        question: "Is there a transfer size limit?",
        answer:
          "No artificial limit. You are only bound by your devices' storage and the speed of the USB connection.",
      },
    ],
  },

  "data-eraser": {
    id: "data-eraser",
    title: "Android Data Eraser — Permanently Wipe Your Phone",
    path: "/android-data-eraser",
    eyebrow: "Data Eraser",
    tagline: "Permanently erase all data from your Android phone before selling or trading it.",
    description:
      "Securely and permanently erase every trace of data from your Android phone — accounts, messages, photos, apps and settings. FRPB's Data Eraser performs a full factory wipe and partition erase so your personal data cannot be recovered.",
    keywords:
      "android data eraser, wipe android phone, factory reset android, erase phone before selling, permanently delete android data",
    category: "privacy",
    platform: "desktop",
    popularity: 80,
    target: "All Android data",
    features: [
      {
        icon: "Eraser",
        title: "Full wipe",
        desc: "Factory-resets data, cache and user partitions in a single operation.",
      },
      {
        icon: "Lock",
        title: "Non-recoverable",
        desc: "Erases partitions so personal files can't be recovered by recovery tools.",
      },
      {
        icon: "ShieldCheck",
        title: "Account-aware",
        desc: "Guides you through removing Google and OEM accounts before the wipe.",
      },
      {
        icon: "CheckCircle2",
        title: "Resale ready",
        desc: "A clean device state suitable for handing your phone to a new owner.",
      },
    ],
    steps: [
      { title: "Back up first", desc: "Export anything you want to keep — the wipe is permanent." },
      { title: "Connect the phone", desc: "Plug in the Android device and confirm USB debugging." },
      { title: "Confirm erase", desc: "Review the warning and confirm the irreversible operation." },
      { title: "Device erased", desc: "FRPB wipes the device and reboots it to a clean state." },
    ],
    faq: [
      {
        question: "Is the erase really permanent?",
        answer:
          "Yes. The Data Eraser performs a factory reset combined with a partition wipe, so personal data cannot be recovered with ordinary tools.",
      },
      {
        question: "Should I remove my Google account first?",
        answer:
          "Yes — remove your Google and OEM accounts before erasing to avoid Factory Reset Protection locking the device for the next owner.",
      },
      {
        question: "Can I cancel after confirming?",
        answer:
          "No. The erase is irreversible once started. FRPB asks for explicit confirmation and warns you to back up first.",
      },
      {
        question: "Does the Data Eraser require a license?",
        answer:
          "The utility is included with the FRPB desktop app and full module execution requires an active FRPB license key.",
      },
    ],
  },

  "virtual-location": {
    id: "virtual-location",
    title: "Virtual Location Spoofer — Fake GPS on Android",
    path: "/virtual-location-spoofer",
    eyebrow: "Virtual Location",
    tagline: "Set any GPS location on your Android phone for games, apps and testing.",
    description:
      "Simulate any GPS location on your Android phone. FRPB's Virtual Location tool mocks the location provider over ADB, so you can test location features, play location-based games and protect your privacy — no root required.",
    keywords:
      "virtual location android, fake gps android, spoof location android, mock gps without root, location spoofer",
    category: "location",
    platform: "desktop",
    popularity: 70,
    target: "GPS location",
    features: [
      {
        icon: "MapPin",
        title: "Any coordinates",
        desc: "Enter a latitude/longitude or pick a point on the map.",
      },
      {
        icon: "Zap",
        title: "Instant switch",
        desc: "Move the simulated position on the fly without restarting the app.",
      },
      {
        icon: "Lock",
        title: "No root",
        desc: "Uses the system mock-location provider over ADB — no rooting needed.",
      },
      {
        icon: "Wifi",
        title: "App-friendly",
        desc: "Works with mapping apps, ride-hailing and location-based games.",
      },
    ],
    steps: [
      { title: "Connect your phone", desc: "Plug in the Android device and allow USB debugging." },
      { title: "Enable mock location", desc: "FRPB configures the developer mock-location provider automatically." },
      { title: "Pick a location", desc: "Search an address, drop a pin or enter coordinates." },
      { title: "Spoof instantly", desc: "The device reports your chosen location to all apps." },
    ],
    faq: [
      {
        question: "Do I need to root my phone?",
        answer:
          "No. Virtual Location uses the standard Android mock-location developer option over ADB, so root is not required.",
      },
      {
        question: "Can I move the location while an app is running?",
        answer:
          "Yes. You can change the simulated position on the fly and the new coordinates apply immediately.",
      },
      {
        question: "Will it reset when I unplug?",
        answer:
          "The mock provider stops when you disable it or disconnect. Re-enable it from the FRPB tab whenever you need it again.",
      },
      {
        question: "Does the Virtual Location tool require a license?",
        answer:
          "The utility is included with the FRPB desktop app and full module execution requires an active FRPB license key.",
      },
    ],
  },
};

/** Ordered id list — controls card order on the home page and sitemap output. */
export const FREE_TOOL_IDS: readonly FreeToolId[] = [
  "whatsapp-transfer",
  "phone-transfer",
  "data-eraser",
  "virtual-location",
];

/** Sitemap-ready route descriptors mirroring BRAND_PAGE_ROUTES. */
export const FREE_TOOL_ROUTES: readonly {
  path: string;
  changeFrequency: "weekly";
  priority: number;
}[] = FREE_TOOL_IDS.map((id) => ({
  path: FREE_TOOLS[id].path,
  changeFrequency: "weekly" as const,
  priority: 0.7,
}));

/** Type guard for arbitrary string input (route params, IPC payloads). */
export function isFreeToolId(value: unknown): value is FreeToolId {
  return typeof value === "string" && value in FREE_TOOLS;
}

/** Resolve a free tool by id, returning null for unknown input. */
export function getFreeTool(id: string): FreeToolMeta | null {
  return isFreeToolId(id) ? FREE_TOOLS[id] : null;
}

/** Turn a free-tool id into its canonical site path. */
export function freeToolPath(id: FreeToolId): string {
  return FREE_TOOLS[id].path;
}

/* -------------------------------------------------------------------------- */
/*  IPC contract — desktop app                                                */
/* -------------------------------------------------------------------------- */

/** Which free utility an operation targets. Mirrors FreeToolId 1:1. */
export type FreeToolOperationKind = FreeToolId;

/** Lifecycle phase reported by the desktop main process while a free-tool
 *  operation runs. Kept small and serialisable for the renderer. */
export type FreeToolPhase =
  | "idle"
  | "preparing"
  | "running"
  | "waiting-device"
  | "success"
  | "error"
  | "cancelled";

/** Request payload for `device:freeTool:run`. */
export interface FreeToolRunRequest {
  tool: FreeToolOperationKind;
  /** Source device serial (transfer tools). Falls back to the active device. */
  sourceSerial?: string;
  /** Destination device serial (transfer tools). */
  targetSerial?: string;
  /** Category selection for transfer utilities (e.g. ["contacts","media"]). */
  categories?: string[];
  /** Latitude/longitude for the virtual-location utility. */
  latitude?: number;
  /** Longitude for the virtual-location utility. */
  longitude?: number;
  /** Explicit user acknowledgement for destructive operations (data eraser). */
  acknowledged?: boolean;
}

/** A single progress line emitted during a free-tool operation. */
export interface FreeToolLogLine {
  level: "info" | "warn" | "error" | "success";
  message: string;
  /** Milliseconds since operation start, for stable ordering in the UI. */
  at: number;
}

/** Result returned by `device:freeTool:run` and streamed via
 *  `device:freeTool:event`. */
export interface FreeToolRunResult {
  tool: FreeToolOperationKind;
  phase: FreeToolPhase;
  /** 0–100 completion estimate; null when indeterminate. */
  progress: number | null;
  message: string;
  success: boolean;
  logs: FreeToolLogLine[];
  /** Human-readable error, present only when success is false. */
  error?: string;
}

/** Event envelope pushed to the renderer on the free-tool event channel. */
export interface FreeToolOperationEvent {
  tool: FreeToolOperationKind;
  result: FreeToolRunResult;
}
