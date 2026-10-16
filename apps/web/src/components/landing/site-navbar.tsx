// FRPB — landing-page navigation bar (client component).
//
// WHY A CLIENT COMPONENT: the home page (app/page.tsx) is a Server Component
// and therefore cannot hold the `open`/`closed` state a hamburger toggle
// requires. The previous inline <header> rendered a plain <button
// aria-label="Menu"> with no handler, no state and no panel — so tapping the
// icon on mobile did nothing. Extracting the navbar into this small client
// component keeps the rest of the page a zero-JS Server Component while giving
// the menu real interactivity.
//
// Accessibility contract:
//   • The toggle is a disclosure button with aria-expanded / aria-controls.
//   • The mobile panel is a labelled modal region (role="dialog", aria-modal).
//   • Escape closes it, focus is moved into the panel on open and returned to
//     the toggle on close, and body scroll is locked while it is open.
//   • Every link closes the menu (routes navigate; in-page anchors jump).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Menu, MessageCircle, X } from "lucide-react";

import TrackedDownloadLink from "@/components/analytics/tracked-download-link";
import { SUPPORT_TELEGRAM_URL } from "@/config/support";

interface NavLink {
  label: string;
  href: string;
  /** External links open in a new tab and are not routed through next/link. */
  external?: boolean;
}

/** In-page section anchors rendered on desktop (preserves existing behaviour). */
const SECTION_LINKS: readonly NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Pro Tools", href: "#free-tools" },
  { label: "Supported Brands", href: "#brands" },
  { label: "Pricing", href: "#pricing" },
  { label: "Guides", href: "#guides" },
  { label: "FAQ", href: "#faq" },
  { label: "EULA", href: "#eula" },
];

/**
 * Primary destinations surfaced in the mobile menu. Section links use a
 * root-relative prefix (`/#…`) so they resolve correctly even when the navbar
 * is reached from a non-home route.
 */
const MOBILE_LINKS: readonly NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Supported Models", href: "/#supported-models" },
  { label: "Guides & Blog", href: "/blog" },
  { label: "Free Tools", href: "/tools" },
];

interface SiteNavbarProps {
  /** Resolved installer URL — read on the server (env) and passed down. */
  downloadUrl: string;
}

export default function SiteNavbar({ downloadUrl }: SiteNavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Auto-close whenever the route changes (covers client-side navigation).
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Escape-to-close + body scroll lock while the panel is open.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        toggleRef.current?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    // Move focus into the panel so keyboard/SR users land on the close control.
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <header className="glass-nav sticky top-0 z-50">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px]">
        {/* Crisp logo lockup */}
        <Link href="/" className="group flex items-center gap-2.5" onClick={close}>
          <Image
            src="/logo.png"
            alt="FRPB — FRP bypass and Android device recovery tool"
            width={72}
            height={72}
            priority
            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 transition group-hover:ring-slate-300"
          />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-ink">FRPB</span>
            <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">
              Utility Suite
            </span>
          </span>
        </Link>

        {/* Primary navigation (desktop) */}
        <div className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/pricing"
            className="hidden text-sm font-semibold text-slate-500 transition hover:text-ink md:inline-flex"
          >
            Pricing Plans
          </Link>
          <Link
            href="/auth"
            className="hidden text-sm font-semibold text-slate-500 transition hover:text-ink md:inline-flex"
          >
            Sign in
          </Link>
          <TrackedDownloadLink
            href={downloadUrl}
            source="header"
            label="header_download_windows"
            className="btn-accent btn-shine hidden px-4 py-2.5 text-xs sm:inline-flex md:text-sm"
          >
            <Download className="h-4 w-4" />
            Download for Windows
          </TrackedDownloadLink>

          {/* Hamburger — opens the mobile panel below. */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 touch-manipulation select-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition active:scale-95 active:bg-slate-100 hover:border-slate-300 hover:text-ink lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Overlay + slide-down panel. Mounted only when open so it is removed
          from the tab order and accessibility tree when closed. */}
      {open && (
        <div className="lg:hidden">
          {/* Scrim — click to dismiss. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-slate-900/40 backdrop-blur-sm"
          />

          <div
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="absolute inset-x-0 top-full z-50 origin-top border-b border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 pb-6 pt-4 sm:px-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Menu
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {MOBILE_LINKS.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-ink"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ),
              )}

              {/* Telegram support — external community/support surface. */}
              <a
                href={SUPPORT_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-ink"
              >
                <MessageCircle className="h-4 w-4 text-brand-500" />
                Telegram Support
              </a>

              {/* Primary CTA */}
              <TrackedDownloadLink
                href={downloadUrl}
                source="mobile_nav"
                label="mobile_nav_download_windows"
                onClick={close}
                className="btn-accent btn-shine mt-3 w-full justify-center px-4 py-3 text-sm"
              >
                <Download className="h-4 w-4" />
                Download Setup (.exe)
              </TrackedDownloadLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
