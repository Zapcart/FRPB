// FRPB — Edge middleware.
// Refresh the Supabase session cookies on every matched request so a
// near-expiry token is transparently renewed before it lapses (the previous
// matcher only ran on /dashboard, so /pricing and /checkout could silently
// log the user out). Cookies are refreshed everywhere; a redirect to the
// login entry only ever happens for the genuinely protected /dashboard tree
// when there is no valid user — public routes are never force-logged-out.
//
// Also stamps the original pathname onto the request as `x-pathname` so
// server-component layouts (e.g. the dashboard shell) can preserve the
// exact deep link when they redirect to the auth entry.

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, verifyAdminKey } from "@/lib/admin/auth";

export async function updateSession(request: NextRequest) {
  // Expose the original pathname downstream for post-auth redirect fidelity.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  /** Ensure the refreshed auth cookies are bound to the outbound response. */
  const withRefreshedCookies = (response: NextResponse): NextResponse => {
    // Carry every cookie the Supabase client rotated onto the response so a
    // renewed session is never dropped on the way back to the browser. Skip
    // names already present to avoid clobbering a redirect's own cookies.
    const existing = new Set(response.cookies.getAll().map((c) => c.name));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      if (!existing.has(cookie.name)) response.cookies.set(cookie);
    });
    // Auth-dependent payloads must never be served from a shared cache: a
    // stale authenticated/unauth RSC response desyncs the UI from the cookie
    // jar and looks exactly like a spontaneous logout.
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  // Distinguish three outcomes:
  //   - an affirmative user            → authenticated
  //   - an affirmative "no session"    → unauthenticated (bounce /dashboard)
  //   - a TRANSIENT failure (network /   → unknown: never redirect, let the
  //     5xx from the Supabase endpoint)     server component decide
  //
  // Collapsing the third case into "unauthenticated" is what turned a momentary
  // Supabase blip into a spontaneous logout when the user clicked a nav link.
  let user: { id: string } | null = null;
  let verified = true;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // A missing/expired session is an AFFIRMATIVE answer, not a failure.
      // Supabase returns AuthSessionMissingError with status 400/401 in that
      // case; anything else (5xx, fetch failure) is transient → unverified.
      const status = (error as { status?: number }).status ?? 0;
      user = data?.user ?? null;
      if (!user && status >= 500) verified = false;
      if (!user && status === 0 && /fetch|network|timeout/i.test(error.message ?? "")) {
        verified = false;
      }
    } else {
      user = data.user ?? null;
    }
  } catch {
    // Thrown fetch/network error → treat as unverified, never as "logged out".
    verified = false;
  }

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");

  // Only the protected dashboard tree redirects when unauthenticated.
  // /pricing, /checkout, /auth and other public routes are left alone: a
  // transient 401 there must never turn into a forced logout, and a valid
  // session must never be interrupted.
  // Only bounce when we are CERTAIN the visitor is unauthenticated. A transient
  // verification failure (`verified === false`) passes through so the dashboard
  // layout — which re-checks server-side — makes the call with a fresh read.
  if (isDashboard && !user && verified) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("returnTo", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Carry any refreshed session cookies onto the redirect so the login hop
    // does not clobber a still-valid (just-renewed) session.
    return withRefreshedCookies(redirectResponse);
  }

  // ── Admin owner-key hand-off ─────────────────────────────────────────────
  // Visiting /admin?key=<owner key> is a one-shot convenience link. We promote
  // the key into an HttpOnly, SameSite=Lax cookie and REDIRECT to the clean
  // /admin URL so the credential never lingers in browser history, the Referer
  // header, or any copy-pasted address.
  //
  // The key is intentionally NOT stripped-and-served in a single hop: a cookie
  // set on a normal 200 response is not guaranteed to be attached to that same
  // request's server-render read. Bouncing through a redirect guarantees the
  // server component sees the cookie on the very next request.
  //
  // NOTE: this branch is deliberately independent of Supabase — an owner holding
  // the key must not be blocked by an auth outage. `/admin` is also not part of
  // the protected `/dashboard` tree above.
  if (pathname.startsWith("/admin")) {
    const candidate = request.nextUrl.searchParams.get("key");
    if (candidate) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("key");

      // A bad key lands on the clean URL and is shown the login form, rather
      // than an error page that would confirm/deny key validity.
      if (!verifyAdminKey(candidate)) {
        return withRefreshedCookies(NextResponse.redirect(cleanUrl));
      }

      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(ADMIN_COOKIE, candidate, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/admin",
        maxAge: ADMIN_COOKIE_MAX_AGE,
      });
      return withRefreshedCookies(response);
    }
  }

  return withRefreshedCookies(supabaseResponse);
}

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on every page/route so the session is refreshed app-wide, while
  // skipping static assets and the public download binaries for speed.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|downloads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2)$).*)",
  ],
};
