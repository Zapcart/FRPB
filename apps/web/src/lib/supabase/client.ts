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
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  );
