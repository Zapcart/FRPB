// FRPB — Supabase browser client (client components).
// Anonymous key is safe for the browser; RLS + session guard secure the data.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).

import { createBrowserClient } from "@supabase/ssr";

// Persistent auth storage is required so ordinary interactions (e.g. opening
// checkout) never invalidate the session. `persistSession` + `autoRefreshToken`
// keep the auth cookies alive across renders and navigations. We intentionally
// do NOT override `storageKey` — it must stay aligned with the server client
// and middleware cookie names to avoid spurious logouts.
//
// `detectSessionInUrl` is intentionally DISABLED. OAuth/email links return the
// PKCE `?code=` to the server route `/auth/callback`, which is the single owner
// of the exchange (it writes the resulting session cookies onto its response).
// Leaving detection on let the browser client ALSO attempt to consume the same
// one-time code from the URL, racing the server handler for a code that can be
// used only once — the loser surfaced as a `401` on
// `POST /auth/v1/token?grant_type=pkce`. Turning it off makes the flow
// deterministic: only the callback route ever calls `exchangeCodeForSession`.
export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // NEXT_PUBLIC_* values are inlined at build time. If either is absent the
  // resulting client sends a blank/undefined `apikey`, and GoTrue rejects every
  // request with an opaque "Invalid API key" that is hard to trace in the
  // browser. Surface the misconfiguration loudly before it becomes a mystery.
  if (!url || !anonKey) {
    console.error(
      "[supabase/client] missing public auth env at build time — auth will " +
        `fail. url=${url ? "set" : "MISSING"}, key=${anonKey ? "set" : "MISSING"}. ` +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createBrowserClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
};
