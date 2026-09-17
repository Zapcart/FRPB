// FRPB — landing-page credibility metrics.
//
// CREDIBILITY POLICY
// ------------------
// Every figure rendered on the marketing site must be something we can actually
// stand behind. The previous landing page advertised "120,000+ devices
// recovered" and "4.9/5 from 2,000+ reviews" — numbers with no source, which is
// both a brand-credibility risk and, in several jurisdictions, a consumer-law
// problem.
//
// This module replaces invented social proof with VERIFIABLE capability facts
// derived from the shipped product data (the model catalog and the supported
// chipset/mode matrix). Anything that would require real usage telemetry is
// intentionally absent until a genuine, consented data source exists.
//
// If live usage counters are added later, they MUST come from a real database
// aggregate (see the commented `loadLiveMetrics` sketch at the bottom) — never
// from a hardcoded constant.

import { KNOWN_MODELS } from "@frpb/shared";

/** Chipset families the engine drives, each verified by a distinct transport. */
export const SUPPORTED_CHIPSETS = [
  "MediaTek (BROM / Preloader)",
  "Qualcomm (EDL 9008)",
  "Samsung Exynos",
  "UNISOC / Spreadtrum",
] as const;

/** Boot modes the desktop engine can reach and operate in. */
export const SUPPORTED_MODES = [
  "ADB",
  "Fastboot",
  "Recovery",
  "Samsung Download (Odin)",
  "Qualcomm EDL",
  "MediaTek BROM",
  "MTP",
] as const;

export interface HomeMetrics {
  /** Human label for the number of catalogued device models. */
  supportedModels: string;
  /** Raw model count, for structured data. */
  supportedModelCount: number;
  /** Number of supported chipset families. */
  chipsetFamilies: string;
  /** Number of reachable boot modes. */
  supportedModes: string;
}

/**
 * Derive the landing metrics from the real product catalog.
 *
 * `KNOWN_MODELS` is the same list the desktop app's model picker and the API's
 * `device:searchModels` handler serve, so the headline number is literally the
 * number of models a customer can select — not an invented activity figure.
 */
export function homeMetrics(): HomeMetrics {
  const count = KNOWN_MODELS.length;
  return {
    // Rounded down to the nearest 10 and rendered as "N+" so the claim stays
    // truthful even as the catalog grows between deploys.
    supportedModels: `${Math.floor(count / 10) * 10}+`,
    supportedModelCount: count,
    chipsetFamilies: `${SUPPORTED_CHIPSETS.length}`,
    supportedModes: `${SUPPORTED_MODES.length}`,
  };
}

/**
 * Server-side aggregate of REAL platform activity, for when live counters are
 * wanted. Left unwired deliberately: it requires a consented, database-backed
 * source, and a marketing page must never display a number it cannot verify.
 *
 *   export async function loadLiveMetrics(prisma) {
 *     const [activations, licenses] = await Promise.all([
 *       prisma.license.count({ where: { status: "ACTIVE" } }),
 *       prisma.license.count(),
 *     ]);
 *     return { activations, licenses };
 *   }
 */
