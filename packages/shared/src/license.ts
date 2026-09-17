// FRPB — license types + zod validation shared by web API and desktop client.

import { z } from "zod";

// ─── Verify request (Desktop App → POST /api/v1/license/verify) ────────────

export const VerifyRequestSchema = z.object({
  licenseKey: z.string().min(1).max(64),
  hardwareId: z.string().min(1).max(128),
  deviceName: z.string().min(1).max(128).optional().default(""),
  os: z.string().optional().default(""),
  appVersion: z.string().optional().default(""),
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

// ─── Verify response statuses ───────────────────────────────────────────────

export const VerifyStatusValues = [
  "ACTIVE",
  "DEVICE_LIMIT_EXCEEDED",
  "INVALID_KEY",
  "EXPIRED",
  "REVOKED",
  "RATE_LIMITED",
  "LOCKED",
  "INVALID_REQUEST",
  "SERVER_ERROR",
] as const;

export type VerifyStatus = (typeof VerifyStatusValues)[number];

// ─── License profile returned on success ────────────────────────────────────

export interface LicenseProfile {
  key: string;
  plan: PlanSlug;
  planName: string;
  expiresAt: string | null;
  deviceLimit: number;
  devicesUsed: number;
  activatedAt: string;
}

// ─── API envelope ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  status?: VerifyStatus | string;
  message?: string;
  license?: LicenseProfile;
  data?: T;
}

export interface VerifyResponse extends ApiResponse {
  httpStatus: number;
  status: VerifyStatus;
  license?: LicenseProfile;
  /**
   * True when the response came from the dev/test master-key shortcut rather
   * than a real licence lookup. Lets the client label it and ensures a bypass
   * response is never mistaken for a purchased entitlement.
   */
  isMasterTest?: boolean;
}

// ─── Unbind request (Dashboard → POST /api/v1/license/unbind) ──────────────

export const UnbindRequestSchema = z.object({
  deviceId: z.string().min(1),
});

export type UnbindRequest = z.infer<typeof UnbindRequestSchema>;

// ─── Checkout request (Web → POST /api/v1/checkout) ────────────────────────

export const CheckoutRequestSchema = z.object({
  planSlug: z.enum(["MONTH_1", "YEAR_1", "LIFETIME"]),
  /** Currency for display — defaults to USD. INR rails through Direct UPI. */
  currency: z.enum(["USD", "INR"]).optional().default("USD"),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  message?: string;
}

import type { PlanSlug } from "./plans";
