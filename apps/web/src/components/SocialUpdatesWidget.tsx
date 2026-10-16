// FRPB — floating Telegram support widget.
// Fixed bottom-right so it floats above every route (mounted in the root
// layout). Closed state is a compact badge; clicking toggles an upward
// popover card with the official support channels: Telegram (primary),
// email and Instagram.
//
// Client component: owns only local open/closed state plus Escape-key and
// click-outside dismissal. No async work, no global side effects.
//
// Destinations come from @/config/support so every support surface stays in
// sync; channels without a configured destination render as disabled so the
// widget never exposes a dead link.

"use client";

import { useEffect, useRef, useState } from "react";
import { Facebook, Instagram, Mail, Send, Sparkles, X } from "lucide-react";
import {
  SUPPORT_EMAIL_ADDRESS,
  SUPPORT_INSTAGRAM_URL,
  SUPPORT_MAILTO,
  SUPPORT_TELEGRAM_URL,
} from "@/config/support";

interface SupportLink {
  label: string;
  href: string | null;
  icon: typeof Send;
  /** Tailwind classes for the solid CTA button. */
  className: string;
}

// Telegram first — the official FRPB support channel — then email. Instagram
// and the still-unpublished Facebook page round out the list as social
// destinations. WhatsApp is intentionally NOT listed (Phase 1.3): FRPB support
// is delivered exclusively through the Telegram channel and email.
const SUPPORT_LINKS: readonly SupportLink[] = [
  {
    label: "Chat on Telegram",
    href: SUPPORT_TELEGRAM_URL,
    icon: Send,
    className: "bg-sky-500 hover:bg-sky-600 focus-visible:outline-sky-500",
  },
  {
    label: `Email ${SUPPORT_EMAIL_ADDRESS}`,
    href: SUPPORT_MAILTO,
    icon: Mail,
    className: "bg-slate-700 hover:bg-slate-800 focus-visible:outline-slate-600",
  },
  {
    label: "Follow Instagram Page",
    href: SUPPORT_INSTAGRAM_URL,
    icon: Instagram,
    className:
      "bg-gradient-to-r from-fuchsia-600 to-orange-500 hover:from-fuchsia-700 hover:to-orange-600 focus-visible:outline-fuchsia-500",
  },
  {
    label: "Like Facebook Page",
    href: null,
    icon: Facebook,
    className: "bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600",
  },
] as const;

export default function SocialUpdatesWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Dismiss on Escape, and on any pointer-down outside the popover.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (target && panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden">
      {/* Open popover card */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="FRPB support channels"
        aria-hidden={!open}
        className={`glass-panel-strong w-80 max-w-[calc(100vw-2.5rem)] origin-bottom-right overflow-hidden rounded-2xl transition-all duration-200 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 px-5 py-4 text-white">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close support widget"
            className="absolute right-2 top-2 grid h-11 w-11 touch-manipulation select-none place-items-center rounded-full text-white/80 transition-colors active:bg-white/25 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-200" aria-hidden="true" />
            <h2 className="text-base font-semibold leading-tight">
              Need Help? / Telegram Support
            </h2>
          </div>
          <p className="mt-1 pr-6 text-xs leading-relaxed text-sky-50/90">
            Join our official Telegram channel or email us — real technical help from our team.
          </p>
        </div>

        {/* White action section */}
        <div className="space-y-2.5 p-4">
          {SUPPORT_LINKS.map(({ label, href, icon: Icon, className }) => {
            const isDisabled = !href;
            return (
              <a
                key={label}
                href={href ?? "#"}
                target={isDisabled ? undefined : "_blank"}
                rel={isDisabled ? undefined : "noopener noreferrer"}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : undefined}
                onClick={(event) => {
                  if (isDisabled) event.preventDefault();
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isDisabled
                    ? "cursor-not-allowed bg-slate-300 text-slate-500 shadow-none"
                    : "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 " +
                      className
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{label}</span>
                {isDisabled && (
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    (soon)
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* Closed-state trigger badge */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close support channels" : "Open FRPB support channels"}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:translate-y-0"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <Send className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-300 ring-2 ring-sky-600" />
          )}
        </span>
        <span className="whitespace-nowrap">Telegram Support</span>
      </button>
    </div>
  );
}
