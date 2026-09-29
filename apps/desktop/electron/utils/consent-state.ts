// FRPB — Shared consent state (single source of truth).
// All IPC handlers (device.ts + 4 new modules) import from here instead of
// maintaining their own local CONSENT_OPS / consentGrantedFor / checkConsent /
// acceptConsent registrations, which would create duplicate IPC channel conflicts.

import { log } from "./logger";

// ─── Operation kinds covered by consent ────────────────────────────────────
export const CONSENT_OPS = [
  "flash-reset",
  "frp-bypass",
  "unlock-screen",
  "reboot-mode",
  "icloud-bypass",
  "samsung-account",
  "bootloop-recovery",
  "data-recovery",
] as const;
export type ConsentOp = (typeof CONSENT_OPS)[number];

// ─── Grants store ──────────────────────────────────────────────────────────
const consentGrantedFor = new Set<ConsentOp>();

// ─── checkConsent: returns full state for ALL 8 operations ────────────────
export function getConsentState(): {
  flashReset: boolean;
  frpBypass: boolean;
  unlockScreen: boolean;
  rebootMode: boolean;
  icloudBypass: boolean;
  samsungAccount: boolean;
  bootloopRecovery: boolean;
  dataRecovery: boolean;
} {
  return {
    flashReset:    consentGrantedFor.has("flash-reset"),
    frpBypass:     consentGrantedFor.has("frp-bypass"),
    unlockScreen:  consentGrantedFor.has("unlock-screen"),
    rebootMode:    consentGrantedFor.has("reboot-mode"),
    icloudBypass:  consentGrantedFor.has("icloud-bypass"),
    samsungAccount: consentGrantedFor.has("samsung-account"),
    bootloopRecovery: consentGrantedFor.has("bootloop-recovery"),
    dataRecovery:  consentGrantedFor.has("data-recovery"),
  };
}

// ─── acceptConsent: validates OP + records grant ──────────────────────────
export interface AcceptConsentResult {
  ok: boolean;
  error?: string;
  flashReset?: boolean;
  frpBypass?: boolean;
  unlockScreen?: boolean;
  rebootMode?: boolean;
  icloudBypass?: boolean;
  samsungAccount?: boolean;
  bootloopRecovery?: boolean;
  dataRecovery?: boolean;
}

export function acceptConsentOp(operation: unknown): AcceptConsentResult {
  const op = String(operation);
  if (!CONSENT_OPS.includes(op as ConsentOp)) {
    return { ok: false, error: `Unknown operation: ${op}` };
  }
  consentGrantedFor.add(op as ConsentOp);
  log.info(`[consent] granted for ${op}`);
  return {
    ok: true,
    flashReset:    consentGrantedFor.has("flash-reset"),
    frpBypass:     consentGrantedFor.has("frp-bypass"),
    unlockScreen:  consentGrantedFor.has("unlock-screen"),
    rebootMode:    consentGrantedFor.has("reboot-mode"),
    icloudBypass:  consentGrantedFor.has("icloud-bypass"),
    samsungAccount: consentGrantedFor.has("samsung-account"),
    bootloopRecovery: consentGrantedFor.has("bootloop-recovery"),
    dataRecovery:  consentGrantedFor.has("data-recovery"),
  };
}

// ─── Helpers for other modules to check/grant without re-registering IPC ──
export function isConsentGranted(op: ConsentOp): boolean {
  return consentGrantedFor.has(op);
}

export function grantConsent(op: ConsentOp): void {
  consentGrantedFor.add(op);
  log.info(`[consent] programmatic grant for ${op}`);
}
