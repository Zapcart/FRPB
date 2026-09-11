// FRPB — Supabase browser client (client components).
// Anonymous key is safe for the browser; RLS + session guard secure the data.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).

import { createBrowserClient } from "@supabase/ssr";

// Persistent auth storage is required so ordinary interactions (e.g. opening
// checkout) never invalidate the session. `persistSession` + `autoRefreshToken`
// keep the auth cookies alive across renders and navigations. We intentionally
// do NOT override `storageKey` — it must stay aligned with the server client
// and middleware cookie names to avoid spurious logouts.
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
