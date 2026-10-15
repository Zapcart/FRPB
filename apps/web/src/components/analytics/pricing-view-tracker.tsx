// FRPB — fires the `view_pricing` GA4 event once per pricing surface view.
//
// Used by two surfaces:
//   • `/pricing`      — rendered on mount (the page IS the pricing view).
//   • home `#pricing` — rendered inside the pricing section; uses an
//                       IntersectionObserver so the event only fires when the
//                       visitor actually scrolls the section into view.
//
// Kept as a Client Component so the server-rendered pages that embed it (the
// home page, in particular) stay Server Components and keep shipping zero JS
// for that tree. StrictMode's double-invoked effects are guarded with a ref so
// development never double-counts a single view.

"use client";

import { useEffect, useRef } from "react";

import { trackViewPricing } from "@/lib/analytics/gtag";

interface PricingViewTrackerProps {
  /** Where the pricing view happened — e.g. "page" or "home_section". */
  source: string;
  /**
   * When true, defer the event until the element scrolls into the viewport.
   * When false (default) the event fires on mount.
   */
  observeVisibility?: boolean;
}

export default function PricingViewTracker({
  source,
  observeVisibility = false,
}: PricingViewTrackerProps) {
  const firedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function fire(): void {
      if (firedRef.current) return;
      firedRef.current = true;
      trackViewPricing({ source });
    }

    // Fire-on-mount mode (the standalone /pricing route).
    if (!observeVisibility) {
      fire();
      return;
    }

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // No observer support (or no node yet) — fall back to firing immediately
      // rather than losing the signal entirely.
      fire();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [observeVisibility, source]);

  // Renders no visible UI — a zero-height marker the observer can watch.
  return <div ref={containerRef} aria-hidden="true" className="h-0 w-0" />;
}
