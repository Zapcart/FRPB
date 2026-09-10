// FRPB — Supabase browser client (client components).
// Anonymous key is safe for the browser; RLS + session guard secure the data.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).

import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
