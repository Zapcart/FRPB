// FRPB — Admin access resolution (Node/server-only).
//
// Answers one question for the /admin tree: "may this request see the console?"
// Access is granted by EITHER of two independent credentials:
//
//   1. OWNER KEY  — a verified admin key. It arrives either as a `?key=` query
//                   parameter (which the Edge middleware promotes into an
//                   HttpOnly cookie and then strips from the URL) or already as
//                   the `frpb_admin_key` cookie on subsequent requests.
//   2. SUPABASE   — a signed-in Supabase user, preserving the previous
//                   behaviour for staff who log in normally.
//
// NODE-ONLY: imports `next/headers` (via lib/supabase/server), so this file must
// never be imported by middleware. The pure key logic lives in ./auth, which is
// Edge-safe.

import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminKey } from "./auth";
import { getOptionalUser, type AuthenticatedUser } from "@/lib/supabase/server";

/** How /admin access was granted. */
export interface AdminAccess {
  authorized: boolean;
  /** "key" = owner cookie, "user" = Supabase session, null = denied. */
  via: "key" | "user" | null;
  user: AuthenticatedUser | null;
}

/**
 * Resolve admin access for the current request.
 *
 * Never throws: a missing Supabase configuration or an unreachable identity
 * provider simply yields `user: null`, and the owner-key path still works. This
 * is what stops a misconfigured auth dependency from locking the operator out of
 * /admin (the previous layout called the throwing `createClient()` directly and
 * hard-redirected on any falsy user).
 */
export async function resolveAdminAccess(): Promise<AdminAccess> {
  // 1. Owner key — the HttpOnly cookie set by middleware after a ?key= visit.
  let cookieKey: string | undefined;
  try {
    cookieKey = cookies().get(ADMIN_COOKIE)?.value;
  } catch {
    // `cookies()` is unavailable outside a request scope; fall through to user.
    cookieKey = undefined;
  }
  if (verifyAdminKey(cookieKey)) {
    return { authorized: true, via: "key", user: null };
  }

  // 2. Supabase session — NOT accepted for admin console.
  // Admin access is EXCLUSIVELY via owner key (ADMIN_LICENSE_KEY).
  // Any visitor with a Supabase session must never reach /admin.
  // (Supabase user lookup removed — was: getOptionalUser())

  return { authorized: false, via: null, user: null };
}
