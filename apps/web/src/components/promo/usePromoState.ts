// FRPB — promo state hook.
//
// Server-safe promo status for client surfaces. The initial value is derived
// from the STATIC window (the same `LAUNCH_PROMO.endsAt` the server uses), so
// the first server render and the first client render agree; only after mount
// do we refine against the client clock. This avoids the classic hydration
// mismatch of reading `Date.now()` during render.

"use client";

import { useEffect, useState } from "react";
import { LAUNCH_PROMO, msUntilPromoEnds } from "@/config/promo";

export interface PromoState {
  /** True while the offer is open. */
  active: boolean;
  /** True once the deadline has passed. */
  expired: boolean;
  /** False during SSR/first paint, true after the client effect runs. */
  mounted: boolean;
  /** Milliseconds remaining; 0 once expired. */
  msRemaining: number;
  /** ISO deadline, exposed for countdown consumers. */
  endsAt: string;
}

/**
 * Resolve promo state on the client, updating once per second while the offer
 * is live so dependent copy (banners, suffixes) flips the instant it expires.
 */
export function usePromoState(now?: Date): PromoState {
  // Static, server-consistent initial value — never `Date.now()` at render.
  const initialMs = Math.max(0, new Date(LAUNCH_PROMO.endsAt).getTime() - 0);
  const [state, setState] = useState<PromoState>({
    active: true,
    expired: false,
    mounted: false,
    msRemaining: initialMs,
    endsAt: LAUNCH_PROMO.endsAt,
  });

  useEffect(() => {
    const tick = () => {
      const ms = msUntilPromoEnds();
      setState({
        active: ms > 0,
        expired: ms <= 0,
        mounted: true,
        msRemaining: Math.max(0, ms),
        endsAt: LAUNCH_PROMO.endsAt,
      });
    };
    tick();
    // Poll once per second so the banner and any dependent copy stay truthful.
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // A caller-supplied `now` (e.g. a server render) short-circuits the clock.
  if (now) {
    const ms = msUntilPromoEnds(now);
    return {
      active: ms > 0,
      expired: ms <= 0,
      mounted: true,
      msRemaining: Math.max(0, ms),
      endsAt: LAUNCH_PROMO.endsAt,
    };
  }

  return state;
}
