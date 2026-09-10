// FRPB — Supabase server client (server components / route handlers).
// Binds the user's session to the request via the next/headers cookie store.
// Package: @supabase/ssr (replaces deprecated @supabase/auth-helpers-nextjs).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This is expected and safe to ignore when middleware is
            // refreshing user sessions on the edge.
          }
        },
      },
    }
  );
}
