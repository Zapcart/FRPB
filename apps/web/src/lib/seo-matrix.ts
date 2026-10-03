// FRPB — programmatic SEO generators for the `/tools/*` device cluster.
//
// Pure, dependency-light builders that turn a `SeoModelRecord` + `SeoIntent`
// into everything a model spoke route needs:
//   - `<title>` / meta description / keyword set (Hack 2 — SERP intent match).
//   - A `BrandPageContent`-compatible view model (reuses the shared brand view).
//   - JSON-LD route context (per-route canonical `SoftwareApplication` node).
//   - Breadcrumb trail for `BreadcrumbList` rich results.
//
// No React, no I/O — safe to import from `generateMetadata`, route handlers and
// `generateStaticParams` at build time.

import { EXE_NAME, RELEASE_VERSION } from "@/config/download";
import type {
  BrandFeature,
  BrandPageContent,
  BrandStep,
} from "@/config/brand-pages";
import type { FaqItem } from "@/lib/faq";
import type { ChipsetFamily } from "@frpb/shared";
import {
  SEO_MODELS,
  TOOLS_BASE_PATH,
  INTENT_LABELS,
  type SeoIntent,
  type SeoModelRecord,
} from "@/data/seo-matrix";
import { modelClusterKeywords } from "@/data/seo-clusters";

/** Human-readable chipset label, including the "Unknown" fallback. */
function chipsetLabel(chipset: ChipsetFamily): string {
  return chipset === "Unknown" ? "Android" : chipset;
}

/** Mode entry guidance derived from chipset + manual-mode flags. */
function entryModeCopy(record: SeoModelRecord): string {
  if (record.manualMode && record.keyCombo) {
    return `hold ${record.keyCombo} to enter ${chipsetLabel(record.chipset)} BROM/EDL mode`;
  }
  return `boot it into Download mode (or BROM/EDL on ${chipsetLabel(record.chipset)} devices)`;
}

/**
 * SERP title tiers, longest-qualified first. The first variant that fits the
 * ~60-char display budget wins, so the "2026" differentiator is only dropped
 * when a long model name would otherwise be truncated by Google.
 */
function titleTiers(record: SeoModelRecord, intent: SeoIntent): string[] {
  const base = `${record.brandLabel} ${record.modelLabel}`;
  if (intent === "frp-bypass") {
    return [
      `${base} FRP Bypass Tool 2026 — One-Click Unlock`,
      `${base} FRP Bypass Tool — One-Click Unlock`,
      `${base} FRP Bypass Tool`,
      `${base} FRP Bypass`,
    ];
  }
  return [
    `${base} Lock Removal Tool 2026 — Remove Screen Lock`,
    `${base} Lock Removal Tool — Remove Screen Lock`,
    `${base} Lock Removal Tool`,
    `${base} Lock Removal`,
  ];
}

/**
 * Parse a `[model]` URL segment (already brand-scoped) back into its
 * `{ record, intent }`. Returns `null` for unknown segments so routes can
 * `notFound()` instead of rendering a thin/duplicate page.
 */
export function parseModelSlug(
  brandSlug: string,
  modelSegment: string,
): { record: SeoModelRecord; intent: SeoIntent } | null {
  for (const record of SEO_MODELS) {
    if (record.brandSlug !== brandSlug) continue;
    for (const intent of record.intents) {
      if (`${record.modelSlug}-${intent}` === modelSegment) {
        return { record, intent };
      }
    }
  }
  return null;
}

/**
 * Route title WITHOUT the site suffix — the root layout template appends
 * " | FRPB", matching every existing marketing route.
 */
export function modelMetaTitle(record: SeoModelRecord, intent: SeoIntent): string {
  const tiers = titleTiers(record, intent);
  const shortest = tiers.find((tier) => tier.length <= 60);
  const fallback =
    tiers[tiers.length - 1] ?? `${record.fullModelLabel} FRP Bypass Tool`;
  return shortest ?? fallback;
}

/** Direct-answer meta description (first sentence answers the query). */
export function modelMetaDescription(
  record: SeoModelRecord,
  intent: SeoIntent,
): string {
  const device = record.fullModelLabel;
  if (intent === "frp-bypass") {
    return `Bypass FRP on the ${device} in about 5 minutes. 1-click Google account unlock for ${chipsetLabel(
      record.chipset,
    )} devices with auto USB drivers — free Windows tool, no adware.`;
  }
  return `Remove the screen lock from the ${device} in about 5 minutes. 1-click lock removal for ${chipsetLabel(
    record.chipset,
  )} devices with auto USB drivers — free Windows tool, no adware.`;
}

/** Focus keyword set for a model spoke (intent cross-product ∪ brand ∪ core). */
export function modelKeywords(
  record: SeoModelRecord,
  intent: SeoIntent,
): string[] {
  return modelClusterKeywords(record, intent).slice(0, 14);
}

/** Chipset-aware benefit bullets rendered as an icon + copy grid. */
function modelFeatures(record: SeoModelRecord, intent: SeoIntent): BrandFeature[] {
  const chipset = chipsetLabel(record.chipset);
  const manualFeature: BrandFeature =
    record.manualMode && record.keyCombo
      ? {
          icon: "Terminal",
          title: `${chipset} BROM / EDL Ready`,
          desc: `Guided ${record.keyCombo} entry for ${chipset} devices that need a hardware key combo before flashing.`,
        }
      : {
          icon: "Zap",
          title: "Automatic Mode Detection",
          desc: `FRPB detects Download, Recovery and fastboot mode on the ${record.fullModelLabel} automatically — no manual key combos.`,
        };

  return [
    {
      icon: "Smartphone",
      title: `${record.modelLabel} Specific Workflow`,
      desc: `A tuned ${INTENT_LABELS[intent].toLowerCase()} procedure for the ${record.fullModelLabel}, not a generic Android guide.`,
    },
    {
      icon: "Cpu",
      title: `${chipset} Chipset Aware`,
      desc: `FRPB reads the ${record.fullModelLabel} chipset and picks the correct ${chipset} flash / bypass path before touching the device.`,
    },
    manualFeature,
    {
      icon: "Usb",
      title: "Driver Auto-Install",
      desc: `Missing ${chipset} USB drivers are detected and installed with one click before the ${INTENT_LABELS[
        intent
      ].toLowerCase()} runs.`,
    },
  ];
}

/** Device-specific, numbered procedure (also the HowTo / on-page steps). */
function modelSteps(record: SeoModelRecord, intent: SeoIntent): BrandStep[] {
  const device = record.fullModelLabel;
  return [
    {
      title: "Install FRPB on Windows",
      desc: `Download the signed ${EXE_NAME} installer (v${RELEASE_VERSION}) and launch it on Windows 10 or 11.`,
    },
    {
      title: `Connect the ${record.modelLabel} over USB`,
      desc: `Power the ${device} off, ${entryModeCopy(
        record,
      )}, then connect it with a USB data cable.`,
    },
    {
      title: `Install the ${chipsetLabel(record.chipset)} drivers`,
      desc: `If the drivers are missing, click Install Drivers — FRPB pulls the correct ${chipsetLabel(
        record.chipset,
      )} package automatically.`,
    },
    {
      title: `Run the one-click ${INTENT_LABELS[intent]}`,
      desc: `Press Start, let FRPB complete the ${chipsetLabel(
        record.chipset,
      )} sequence, then reboot the ${record.modelLabel} with the ${
        intent === "frp-bypass" ? "FRP lock" : "screen lock"
      } removed.`,
    },
  ];
}

/** Device + intent specific FAQ (rendered visibly AND as FAQPage JSON-LD). */
function modelFaq(record: SeoModelRecord, intent: SeoIntent): FaqItem[] {
  const device = record.fullModelLabel;
  const chipset = chipsetLabel(record.chipset);
  const action = intent === "frp-bypass" ? "bypass the FRP lock" : "remove the screen lock";
  return [
    {
      question: `Can FRPB ${action} on the ${device}?`,
      answer: `Yes. FRPB supports the ${device} on ${chipset} and walks an authorised owner through the ${INTENT_LABELS[
        intent
      ].toLowerCase()} in about 5 minutes, auto-detecting the correct mode before flashing.`,
    },
    {
      question: `Which mode do I need for the ${device}?`,
      answer: record.manualMode && record.keyCombo
        ? `The ${device} uses ${chipset}; FRPB guides you to hold ${record.keyCombo} to enter BROM/EDL mode, then handles the bypass automatically.`
        : `The ${device} uses ${chipset}. FRPB auto-detects Download mode, Recovery mode and fastboot, so you do not have to choose the method manually.`,
    },
    {
      question: `Do I need ${record.brandLabel} USB drivers for the ${device}?`,
      answer: `No. FRPB checks whether the correct ${chipset} driver is installed and installs it with one click, so no manual driver hunting is required.`,
    },
    {
      question: `Is FRPB allowed on the ${device}?`,
      answer: `FRPB is intended strictly for the device owner or an authorised repair professional. Only use it on a ${device} you own or have explicit permission to service.`,
    },
  ];
}

/**
 * Assemble a `BrandPageContent`-compatible view model so the model spoke can
 * reuse the shared `<BrandLandingPage>` render path without duplication.
 */
export function buildModelContent(
  record: SeoModelRecord,
  intent: SeoIntent,
): BrandPageContent {
  const intentLabel = INTENT_LABELS[intent];
  return {
    path: record.paths[intent],
    title: modelMetaTitle(record, intent),
    description: modelMetaDescription(record, intent),
    keywords: modelKeywords(record, intent),
    eyebrow: `${record.brandLabel} · ${record.modelLabel} — ${chipsetLabel(record.chipset)}`,
    headingLead: `${record.fullModelLabel}`,
    headingHighlight:
      intent === "frp-bypass" ? "FRP Bypass Tool" : "Lock Removal Tool",
    subheading:
      intent === "frp-bypass"
        ? `Remove the Google FRP lock from the ${record.fullModelLabel} with a one-click ${chipsetLabel(
            record.chipset,
          )} workflow. FRPB auto-detects the mode, installs drivers and clears the ${intentLabel.toLowerCase()} for the authorised owner.`
        : `Remove the screen lock from the ${record.fullModelLabel} with a one-click ${chipsetLabel(
            record.chipset,
          )} workflow. FRPB auto-detects the mode, installs drivers and completes the ${intentLabel.toLowerCase()} for the authorised owner.`,
    features: modelFeatures(record, intent),
    steps: modelSteps(record, intent),
    faq: modelFaq(record, intent),
  };
}

/** Route context for the per-spoke `SoftwareApplication` JSON-LD node. */
export function modelJsonLdContext(
  record: SeoModelRecord,
  intent: SeoIntent,
): { path: string; name: string; description: string } {
  return {
    path: record.paths[intent],
    name: `FRPB ${record.brandLabel} ${record.modelLabel} ${INTENT_LABELS[intent]} Module`,
    description: modelMetaDescription(record, intent),
  };
}

/** Breadcrumb trail (Tools → Brand → Model) for `BreadcrumbList` JSON-LD. */
export function modelBreadcrumbs(
  record: SeoModelRecord,
  intent: SeoIntent,
): { name: string; path: string }[] {
  return [
    { name: "Tools", path: TOOLS_BASE_PATH },
    { name: record.brandLabel, path: record.brandPath },
    {
      name: `${record.modelLabel} ${INTENT_LABELS[intent]}`,
      path: record.paths[intent],
    },
  ];
}
