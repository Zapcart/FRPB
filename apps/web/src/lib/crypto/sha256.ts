// FRPB — SHA-256 helper (node:crypto). Used to hash license keys for lookup.

import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** HMAC-SHA256 — used for hardware fingerprinting (getHardwareId). */
export function hmacSha256(input: string, secret: string): string {
  return createHash("sha256").update(input + secret, "utf8").digest("hex");
}
