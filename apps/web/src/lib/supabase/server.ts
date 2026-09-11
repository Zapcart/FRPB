// FRPB — Supabase server client (server components / route handlers).
// Binds the user's session to the request via the next/headers cookie store.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).
//
// Server components/route handlers only — client components must use the
// persistent cookie-based browser client (lib/supabase/client.ts).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required."
    );
  }
  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient(url, key, {
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
