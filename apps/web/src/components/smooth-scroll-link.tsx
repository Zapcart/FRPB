// FRPB — smooth-scroll anchor.
// Client component so the landing page (a server component) can trigger a
// direct, dependency-free smooth scroll. No state, no async work, no
// re-renders — tapping resolves the target node and scrolls it into view.
//
// Mobile note: `touch-manipulation` disables the legacy 300ms double-tap-to-zoom
// click delay, and `relative z-10` keeps the CTA above decorative overlays so
// the very first touch is captured immediately (0ms delay).

"use client";

import { useCallback } from "react";
import type { MouseEvent, ReactNode } from "react";

interface SmoothScrollLinkProps {
  targetId: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

// Ensures instant, predictable tap handling regardless of the caller's classes.
const BASE_CLASSES = "relative z-10 cursor-pointer touch-manipulation select-none";

export default function SmoothScrollLink({
  targetId,
  className,
  children,
  ariaLabel,
}: SmoothScrollLinkProps) {
  const handleScrollToTarget = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return; // Fall back to the browser's default anchor jump.
      event.preventDefault();
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      // Reflect the section in the URL without a hard jump or re-render.
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${targetId}`);
      }
    },
    [targetId]
  );

  const mergedClassName = className
    ? `${BASE_CLASSES} ${className}`
    : BASE_CLASSES;

  return (
    <a
      href={`#${targetId}`}
      onClick={handleScrollToTarget}
      aria-label={ariaLabel}
      className={mergedClassName}
    >
      {children}
    </a>
  );
}
