// FRPB — currency resolution for the pricing page.
//
// Goal: default the currency toggle to the rail the visitor can actually pay
// with — INR (Direct UPI, India) or USD (PayGlocal, rest of world) — without
// asking them to think about it.
//
// SIGNAL ORDER (deliberately conservative):
//   1. An explicit user choice, persisted from a previous visit. Always wins.
//   2. PostHog geoip properties, when they are already on the client.
//   3. The browser's own timezone → region mapping (synchronous, offline).
//   4. Navigator.language region tag.
//   5. Default USD.
//
// WHY INTL IS THE FALLBACK AND NOT THE PRIMARY: PostHog's `$geoip_*` properties
// are attached to the /decide response and land ASYNCHRONOUSLY, often after the
// pricing page has already painted. Reading them synchronously returns
// undefined on a first visit, so a geoip-only implementation would silently
// always fall back to USD. The timezone check is synchronous and correct for
// the dominant case (India), with geoip upgrading accuracy once available.

import type { CheckoutCurrency } from "./pending-plan";

export const CURRENCY_STORAGE_KEY = "frpb:currency";

/** localStorage key for a previously persisted user choice. */
function readStoredCurrency(): CheckoutCurrency | null {
  try {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored === "USD" || stored === "INR") return stored;
  } catch {
    // Storage unavailable (strict privacy mode) — fall through to detection.
  }
  return null;
}

/** Persist the visitor's explicit choice. Never throws. */
export function storeCurrency(currency: CheckoutCurrency): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Non-fatal: the choice simply is not remembered next visit.
  }
}

/**
 * Country/region from PostHog's geoip properties, when present.
 *
 * Guarded because these fields are (a) async — see the module note — and
 * (b) absent entirely when NEXT_PUBLIC_POSTHOG_KEY is unset (local builds).
 */
function readPostHogRegion(): string | null {
  try {
    // Imported lazily to keep this module usable in environments where the
    // posthog bundle is not loaded (and to avoid a hard dependency).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const posthog = require("posthog-js").default as {
      get_property?: (key: string) => unknown;
    };
    if (typeof posthog?.get_property !== "function") return null;
    const country =
      (posthog.get_property("$geoip_country_code") as string | undefined) ??
      (posthog.get_property("$geoip_country_name") as string | undefined) ??
      null;
    return typeof country === "string" ? country.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** True when a country/region string denotes India. */
function isIndia(region: string): boolean {
  const r = region.trim().toUpperCase();
  return r === "IN" || r === "IND" || r === "INDIA";
}

/**
 * Region from the browser timezone. Synchronous, offline, and accurate for the
 * single case that matters most here (India → INR). Non-India regions
 * deliberately fall through to USD rather than being guessed per-country.
 */
function regionFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (/kolkata|calcutta/i.test(tz)) return "IN";
  } catch {
    // Intl unavailable.
  }
  return null;
}

/** Region from the navigator locale tag (e.g. "en-IN" → "IN"). */
function regionFromLocale(): string | null {
  try {
    const lang = navigator.language ?? "";
    const match = /[-_]([A-Za-z]{2})$/.exec(lang);
    if (match?.[1]) return match[1].toUpperCase();
  } catch {
    // navigator unavailable.
  }
  return null;
}

/**
 * Resolve the currency to show on the pricing page.
 *
 * Returns `{ currency, source }` so the UI can honestly say "auto-detected"
 * only when detection (not a stored user choice) produced the value.
 */
export function resolveDefaultCurrency(): {
  currency: CheckoutCurrency;
  source: "stored" | "geo" | "detected";
} {
  const stored = readStoredCurrency();
  if (stored) return { currency: stored, source: "stored" };

  const geoRegion = readPostHogRegion();
  if (geoRegion) {
    return { currency: isIndia(geoRegion) ? "INR" : "USD", source: "geo" };
  }

  const tzRegion = regionFromTimezone();
  if (tzRegion) {
    return { currency: isIndia(tzRegion) ? "INR" : "USD", source: "detected" };
  }

  const localeRegion = regionFromLocale();
  if (localeRegion) {
    return { currency: isIndia(localeRegion) ? "INR" : "USD", source: "detected" };
  }

  return { currency: "USD", source: "detected" };
}
