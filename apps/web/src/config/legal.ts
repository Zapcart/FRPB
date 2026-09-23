/**
 * FRPB — Central legal & compliance configuration.
 *
 * Single source of truth for the site-wide legal disclaimer and the contact
 * addresses required by the Digital Personal Data Protection (DPDP) Act, 2023.
 *
 * Keeping this here (mirroring `config/download.ts`) means the disclaimer and
 * support/legal addresses are defined once and reused by every footer and the
 * privacy policy, so a future edit never has to be hunted down across files.
 */

/** Support mailbox — general help, account and product queries. */
export const SUPPORT_EMAIL = "support@frpb.in";

/** Legal/privacy mailbox — DPDP data-access, correction and erasure requests. */
export const LEGAL_EMAIL = "legal@frpb.in";

/** Postal jurisdiction shown alongside the contact addresses. */
export const LEGAL_LOCATION = "FRPB, India";

/**
 * Small-print disclaimer rendered in every site footer. FRPB is a recovery
 * utility, so we state plainly that it is intended only for authorised device
 * owners / certified technicians and that bypassing protections on
 * unauthorised devices is prohibited.
 */
export const LEGAL_DISCLAIMER =
  "Disclaimer: FRPB is a device recovery utility intended strictly for authorized device owners and certified repair technicians. Users must own or have legal authorization for the devices they service. Use of FRPB to bypass security protections on unauthorized devices is strictly prohibited.";

/** Convenience: `mailto:` href for a given address. */
export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
