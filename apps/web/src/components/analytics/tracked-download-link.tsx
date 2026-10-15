// FRPB — client wrapper that fires the `click_download` GA4 event.
//
// The Hero, home header and /downloads CTAs all live in Server Components
// (which ship zero JS by design). Adding an `onClick` there would force those
// whole trees to become Client Components, regressing the bundle for a
// telemetry call. Instead the server components render this thin client
// wrapper: only the anchor's small event handler ships to the browser.
//
// The wrapper is intentionally a transparent passthrough — it renders an
// `<a>`/Link with whatever props the server gave it and simply prepends the
// tracking call. Tracking never blocks navigation: the helper is synchronous
// and never throws, and gtag has already queued the event before the browser
// follows the link.

"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

import { trackDownloadClick } from "@/lib/analytics/gtag";

interface TrackedDownloadLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Where the CTA appears — e.g. "hero", "header", "downloads". */
  source: string;
  /** Optional plan/limb hint for segmentation. */
  label?: string;
  children: ReactNode;
}

export default function TrackedDownloadLink({
  source,
  label,
  children,
  onClick,
  ...rest
}: TrackedDownloadLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    trackDownloadClick({ source, label });
    onClick?.(event);
  }

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}
