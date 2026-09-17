// FRPB — Admin analytics Server Actions.
//
// This module runs on the server ONLY ("use server"), so the private owner key
// (ADMIN_LICENSE_KEY) and the Prisma queries never reach the browser bundle.
//
// Two actions:
//   • authorizeAdminKey  — verifies an owner key and installs the HttpOnly
//                          admin cookie that unlocks /admin.
//   • refreshAdminAnalytics — re-reads analytics for the client shell.

"use server";

import { cookies } from "next/headers";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import { emptyAdminAnalytics } from "./data";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  verifyAdminKey,
} from "@/lib/admin/auth";
import { resolveAdminAccess } from "@/lib/admin/access";
import type { AdminAnalyticsResponse } from "@frpb/shared/analytics";

export interface RefreshAnalyticsResult {
  ok: boolean;
  data?: AdminAnalyticsResponse;
  error?: string;
}

export interface AuthorizeAdminKeyResult {
  ok: boolean;
  error?: string;
}

/**
 * Verify an owner key submitted from the /admin login form and, on success, set
 * the HttpOnly `frpb_admin_key` cookie so subsequent Server Component renders
 * resolve access without the key ever appearing in the URL again.
 *
 * A Server Action is a public POST endpoint, so the key is validated HERE on the
 * server with a constant-time comparison — never in the browser.
 */
export async function authorizeAdminKey(
  candidate: string
): Promise<AuthorizeAdminKeyResult> {
  if (!verifyAdminKey(candidate?.trim())) {
    return { ok: false, error: "Invalid admin key." };
  }

  cookies().set(ADMIN_COOKIE, candidate.trim(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  return { ok: true };
}

/**
 * Refresh the analytics payload for the client shell.
 *
 * Authorization accepts EITHER credential — a verified owner-key cookie OR a
 * signed-in Supabase user. The previous implementation checked `user` only, so
 * an owner who unlocked the console with a key would render the dashboard and
 * then have every refresh fail with "Unauthorized".
 *
 * FAIL-SAFE: a Server Action that throws is reported to the client as a generic
 * error, which on Vercel showed up as an unhandled failure whenever the database
 * was down. The DB read is therefore wrapped and returns the same zero-metrics
 * fallback the page loader uses, so the console degrades instead of erroring.
 */
export async function refreshAdminAnalytics(): Promise<RefreshAnalyticsResult> {
  const access = await resolveAdminAccess();
  if (!access.authorized) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const data = await getAdminAnalytics();
    if (!data) {
      return { ok: false, data: emptyAdminAnalytics(), error: "Database unavailable" };
    }
    return { ok: true, data };
  } catch (err) {
    // `ok: false` here means "stale/placeholder data", NOT "forbidden" — the
    // client previously threw on a null payload and blanked the console.
    console.warn(
      "[admin] refresh failed — returning safe empty payload:",
      (err as Error)?.message ?? err
    );
    return { ok: false, data: emptyAdminAnalytics(), error: "Database unavailable" };
  }
}
