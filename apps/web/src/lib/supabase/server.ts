// FRPB — Supabase server client (server components / route handlers).
// Binds the user's session to the request via the next/headers cookie store.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).
//
// Server components/route handlers only — client components must use the
// persistent cookie-based browser client (lib/supabase/client.ts).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** True when Supabase credentials are present in this process. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/**
 * Build the request-scoped Supabase client.
 *
 * @throws when NEXT_PUBLIC_SUPABASE_* are absent. Callers that must not fail
 *   hard (public pages, guest checkout) should use {@link getOptionalUser}
 *   instead of calling this directly.
 */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }
  const cookieStore = cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          console.warn("[supabase] Could not set cookie in Server Component:", error);
        }
      },
    },
  });
}

/** Minimal shape of the authenticated identity a route actually needs. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Resolve the signed-in user WITHOUT ever throwing.
 *
 * Returns `null` when:
 *   • Supabase env vars are missing (misconfigured or not needed for this flow),
 *   • the identity provider is unreachable,
 *   • there is simply no valid session.
 *
 * This is the safe primitive for public surfaces (the /checkout entry, guest
 * checkout, pricing). Previously those callers invoked `createClient()` directly
 * and a missing env var threw *synchronously* inside a Server Component — which
 * surfaced as the blocking "Checkout unavailable" screen rather than a normal
 * signed-out experience. Guest and self-hosted-UPI flows must never be blocked
 * by an optional auth dependency.
 */
export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    return { id: user.id, email: user.email };
  } catch (err) {
    console.warn("[supabase] optional user lookup failed (continuing as guest):", err);
    return null;
  }
}
