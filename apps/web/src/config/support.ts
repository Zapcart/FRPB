// FRPB — official support & community destinations (single source of truth).
//
// Centralises every "talk to us" surface so the floating support widget, the
// footer and any future touch-point cannot drift apart. All values are static
// public constants: nothing here is secret, and the only externally configured
// value (the WhatsApp line) is read from a public NEXT_PUBLIC_* env var so it is
// inlined at build time and never requires a code change to rotate.
//
// NOTE: No company WhatsApp number is committed to the repository. Set
// NEXT_PUBLIC_SUPPORT_WHATSAPP (digits or a full https://wa.me/<number> URL) in
// the deployment environment to light up the WhatsApp action. Until then the
// widget degrades gracefully to email + Telegram, which are always available.

import { SUPPORT_EMAIL } from "@/config/legal";

/**
 * Normalise a configured WhatsApp value into a click-to-chat URL.
 *
 * Accepts either a full `https://…` URL (returned verbatim) or a raw phone
 * number in any punctuation format (`+91 98765 43210` → `919876543210`). Values
 * too short to be a valid MSISDN return `null` so a malformed env var can never
 * render a broken action button.
 */
export function toWhatsAppUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, "");
  // E.164 numbers are 8–15 digits; anything shorter is almost certainly a typo.
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}

/** Resolved WhatsApp click-to-chat URL, or `null` when not configured. */
export const SUPPORT_WHATSAPP_URL = toWhatsAppUrl(
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP
);

/** Official Telegram community / support group. */
export const SUPPORT_TELEGRAM_URL = "https://t.me/frpbnetwork";

/** Official Instagram profile. */
export const SUPPORT_INSTAGRAM_URL = "https://www.instagram.com/frpbofficial";

/** Support inbox — always available fallback channel. */
export const SUPPORT_EMAIL_ADDRESS = SUPPORT_EMAIL;

/** Pre-built mailto link for the support inbox. */
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
