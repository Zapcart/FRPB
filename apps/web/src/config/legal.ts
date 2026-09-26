/**
 * FRPB — Central legal & compliance configuration.
 *
 * Single source of truth for the site-wide legal disclaimer, the contact
 * addresses required by the Digital Personal Data Protection (DPDP) Act, 2023,
 * and the company identity / processor disclosures reused by the legal pages
 * and the global footer.
 *
 * Keeping this here (mirroring `config/download.ts`) means the disclaimer,
 * support/legal addresses, operator identity and named sub-processors are
 * defined once and reused everywhere, so a future edit never has to be hunted
 * down across files.
 */

/** Support mailbox — general help, account, billing and product queries. */
export const SUPPORT_EMAIL = "support@frpb.in";

/** Legal/privacy mailbox — DPDP / GDPR / CCPA data-access and erasure requests. */
export const LEGAL_EMAIL = "legal@frpb.in";

/** Postal jurisdiction shown alongside the contact addresses. */
export const LEGAL_LOCATION = "FRPB, India";

/**
 * Operator identity shown in every footer and legal page. Kept as discrete
 * fields so the trade name, entity descriptor and jurisdiction are rendered
 * consistently rather than being re-typed (and drifting) on each page.
 */
export const COMPANY_NAME = "FRPB";
export const COMPANY_ENTITY = "FRPB (sole proprietorship)";
export const COMPANY_ADDRESS = "India";
export const COMPANY_JURISDICTION = "India";

/** Canonical site origin, used for processing / cross-border disclosures. */
export const LEGAL_WEBSITE = "https://frpb.in";

/**
 * Third-party sub-processors disclosed in the Privacy Policy. Naming them
 * explicitly (rather than a generic "service providers" clause) satisfies the
 * GDPR Article 13/14 transparency duty and the CCPA "service provider"
 * disclosure requirement.
 */
export const DATA_PROCESSORS = {
  payments: "Razorpay",
  email: "Resend",
  analytics: "PostHog",
  auth: "Supabase",
} as const;

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
