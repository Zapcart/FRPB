// FRPB — route-aware session gate.
//
// `SessionProvider` creates a Supabase browser client and opens an auth-state
// subscription (`onAuthStateChange`) on mount. On a static marketing page that
// is pure overhead: nothing in the rendered HTML depends on a *live* session,
// yet the client pays for the SDK + subscription during hydration — directly
// competing with first paint and first touch on low-end phones.
//
// This gate mounts `SessionProvider` ONLY on the routes that actually consume
// live auth state (the authenticated app, checkout, and the auth forms). Every
// other route renders its children directly, so Supabase never initialises.
//
// `usePathname()` resolves identically on the server-rendered pass and the
// first client render, so there is no hydration mismatch.

"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "@/components/session-provider";

// Prefixes whose pages read live session state (nav state, dashboard shell,
// checkout identity, auth forms). Everything else is treated as static.
const AUTH_PREFIXES = ["/dashboard", "/admin", "/checkout", "/auth", "/login"];

export default function SessionGate({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname() ?? "/";
  const requiresSession = AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!requiresSession) {
    return <>{children}</>;
  }

  return <SessionProvider>{children}</SessionProvider>;
}
