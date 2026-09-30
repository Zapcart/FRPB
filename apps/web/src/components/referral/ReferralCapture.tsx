// FRPB — referral capture island.
//
// Mounted once in the site-wide layout so ANY entry point (?ref=CODE landing on
// the home page, a blog post, /pricing, /register, …) captures and persists the
// referral code. Renders nothing and swallows every error — a capture failure
// must never surface to the visitor or trigger an error boundary.

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  captureReferralCode,
  parseRefFromSearch,
} from "@/lib/referral/ref-capture";

/**
 * Routes where a stale ?ref= must NOT be re-captured (session/transactional).
 *
 * Note `/auth` and `/login` are intentionally absent from this list: a visitor
 * arriving at a signup surface with `?ref=CODE` (e.g. `/auth/signup?ref=CODE`)
 * must have the code persisted so attribution survives signup.
 */
const SKIP_PREFIXES = ["/checkout", "/dashboard", "/admin"];

export default function ReferralCapture(): null {
  const pathname = usePathname();

  // Re-run when the path changes: a soft navigation may land on a route whose
  // URL still carries `?ref=` (e.g. the home page after a client transition).
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const path = pathname ?? window.location.pathname ?? "/";
      if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

      const code = parseRefFromSearch(window.location.search);
      if (code) captureReferralCode(code);
    } catch (err) {
      console.error("[referral] failed to capture referral code:", err);
    }
  }, [pathname]);

  return null;
}
