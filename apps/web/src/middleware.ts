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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");

  // Only the protected dashboard tree redirects when unauthenticated.
  // /pricing, /checkout, /auth and other public routes are left alone: a
  // transient 401 there must never turn into a forced logout, and a valid
  // session must never be interrupted.
  if (isDashboard && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("returnTo", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Carry any refreshed session cookies onto the redirect so the login hop
    // does not clobber a still-valid (just-renewed) session.
    return withRefreshedCookies(redirectResponse);
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
