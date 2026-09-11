// FRPB — SHA-256 helper (node:crypto). Used to hash license keys for lookup.

import { createHash, createHmac } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * HMAC-SHA256 (RFC 2104) — keyed digest for hardware fingerprinting.
 * Uses node:crypto's createHmac; the previous implementation hashed a naive
 * `input + secret` concatenation, which is not an HMAC and is vulnerable to
 * length-extension attacks.
 */
export function hmacSha256(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}
