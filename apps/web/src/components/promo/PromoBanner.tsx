// FRPB — launch-offer promo banner.
//
// Wraps CountdownTimer with the headline/subtext copy and a soft CTA. Renders
// nothing once the window has expired (the standard term needs no banner), so
// callers can mount it unconditionally on marketing surfaces.

"use client";

import { Sparkles } from "lucide-react";
import CountdownTimer from "@/components/promo/CountdownTimer";
import { usePromoState } from "@/components/promo/usePromoState";
import { promoHeadline, promoSubtext } from "@/config/promo";

export interface PromoBannerProps {
  /** Optional href for the inline CTA (defaults to pricing anchor). */
  ctaHref?: string;
  /** Optional compact layout for tighter sections. */
  compact?: boolean;
  className?: string;
}

export default function PromoBanner({
  ctaHref = "/pricing",
  compact = false,
  className,
}: PromoBannerProps) {
  const promo = usePromoState();

  // Hidden until mounted (avoids a flash) and after expiry (nothing to show).
  if (!promo.mounted || !promo.active) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-accent-500/10 to-transparent p-4 sm:p-5 ${
        className ?? ""
      }`}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-900/20">
            <Sparkles className="h-5 w-5 text-white" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900 sm:text-base">
              {promoHeadline()}
            </p>
            {!compact && (
              <p className="mt-0.5 max-w-xl text-xs text-slate-600 sm:text-sm">
                {promoSubtext()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <CountdownTimer endsAt={promo.endsAt} variant={compact ? "inline" : "banner"} />
          {!compact && (
            <a
              href={ctaHref}
              className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Claim the launch offer →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
