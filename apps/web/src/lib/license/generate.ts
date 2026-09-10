// FRPB — license key generation (FRPB-XXXX-XXXX-XXXX).

import { randomBytes } from "node:crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 (ambiguous)

/**
 * Generates a 16-char license key in the format FRPB-XXXX-XXXX-XXXX.
 * - 4 x 4-char groups (12 random chars total) → 12 × log2(32) ≈ 60 bits entropy.
 * - Character set excludes visually ambiguous characters.
 * - The raw key is shown to the user exactly once; lookups use its SHA-256.
 */
export function generateLicenseKey(): string {
  const group = () => {
    const bytes = randomBytes(4);
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += CHARSET[bytes[i]! % CHARSET.length];
    }
    return out;
  };
  return `FRPB-${group()}-${group()}-${group()}`;
}

/** Validate the FRPB key format. Shared with the desktop ActivationScreen. */
export const LICENSE_PATTERN = /^FRPB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidLicenseKey(key: string): boolean {
  return LICENSE_PATTERN.test(key.trim().toUpperCase());
}
