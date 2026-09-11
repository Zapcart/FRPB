// FRPB — smooth-scroll anchor.
// Client component so the landing page (a server component) can trigger a
// direct, dependency-free smooth scroll. No state, no async work, no
// re-renders — clicking resolves the target node and scrolls it into view.

"use client";

import type { ReactNode } from "react";

interface SmoothScrollLinkProps {
  targetId: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

export default function SmoothScrollLink({
  targetId,
  className,
  children,
  ariaLabel,
}: SmoothScrollLinkProps) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(targetId);
    if (!target) return; // Fall back to the browser's default anchor jump.
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Reflect the section in the URL without a hard jump or re-render.
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${targetId}`);
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  );
}
