// FRPB — OAuth / email-link callback route (Google, magic links).
//
// Supabase redirects the browser here after a successful OAuth consent (or a
// PKCE email link). We exchange the one-time `code` for a session, then bounce
// the visitor to their intended destination.
//
// Package: @supabase/ssr (createServerClient). The cookie store is bound to the
// response so the freshly-issued auth cookies are persisted on the redirect
// that leaves this handler.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** In-app destination used when no valid `next` target was supplied. */
const DEFAULT_REDIRECT = "/dashboard";
/** Safe failure destination (the callback never surfaces a raw error page). */
const FAILURE_REDIRECT = "/auth/login?error=oauth";

/**
 * Only honour same-origin, in-app paths. Rejects absolute URLs, protocol-relative
 * (`//evil.com`) and backslash-trick values so an attacker cannot turn the
 * callback into an open redirect.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  return raw;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? DEFAULT_REDIRECT;

  // Missing/blocked env: treat as a failed sign-in rather than throwing.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[auth/callback] Supabase env missing — cannot exchange OAuth code"
    );
    return NextResponse.redirect(`${origin}${FAILURE_REDIRECT}`);
  }

  // No code means the provider denied the request or the link is malformed.
  if (!code) {
    return NextResponse.redirect(`${origin}${FAILURE_REDIRECT}`);
  }

  // Response object the cookie writer mutates as Supabase rotates the session.
  const response = NextResponse.redirect(`${origin}${next}`);

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
      return NextResponse.redirect(`${origin}${FAILURE_REDIRECT}`);
    }

    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected error exchanging code:", err);
    return NextResponse.redirect(`${origin}${FAILURE_REDIRECT}`);
  }
}
