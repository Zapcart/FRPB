// FRPB — client session hydration provider.
// Subscribes to Supabase auth state changes in the browser and refreshes
// server components so the UI (nav, dashboard shell) always matches the
// session that middleware + getUser() validated server-side.
//
// SESSION-STABILITY CONTRACT
// --------------------------
// `autoRefreshToken` silently renews the access token on a timer and on every
// window focus. That renewal is an INTERNAL auth detail — the user identity is
// unchanged. Previously this provider called `router.refresh()` on every
// TOKEN_REFRESHED, which re-fetched the RSC tree while the rotated auth cookies
// were still being written. The server component could therefore read the
// pre-rotation cookie jar, see no user, and `redirect()` to /auth — the
// "random auto-logout on a button click" symptom.
//
// Fix: refresh ONLY when the effective user identity actually changes
// (sign-in of a different user, or sign-out). Token rotations are ignored, and
// repeated events for the same identity are coalesced.

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-fetch the RSC tree at most once per this window (ms). */
const REFRESH_COALESCE_MS = 1_500;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Last identity the UI was rendered for. `null` = signed out.
  const lastUserIdRef = useRef<string | null | undefined>(undefined);
  // Timestamp of the last router.refresh() so bursts are coalesced.
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const prevUserId = lastUserIdRef.current;
      const identityChanged =
        prevUserId === undefined || prevUserId !== nextUserId;

      // Ignore pure token rotations (identity unchanged) — the whole point of
      // this fix. SIGNED_OUT always counts as an identity change (→ null).
      if (!identityChanged && event === "TOKEN_REFRESHED") return;
      if (!identityChanged) return;

      lastUserIdRef.current = nextUserId;

      // Coalesce rapid duplicate events (Supabase can emit SIGNED_IN +
      // INITIAL_SESSION back-to-back on mount).
      const now = Date.now();
      if (now - lastRefreshAtRef.current < REFRESH_COALESCE_MS) return;
      lastRefreshAtRef.current = now;

      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
