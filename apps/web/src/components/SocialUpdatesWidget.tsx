// FRPB — floating "Follow Updates" social engagement widget.
// Fixed bottom-right so it floats above every route (mounted in the root
// layout). Closed state is a compact badge; clicking toggles an upward
// popover card with links to the FRPB Telegram group and Instagram page.
//
// Client component: owns only local open/closed state plus Escape-key and
// click-outside dismissal. No async work, no global side effects.

"use client";

import { useEffect, useRef, useState } from "react";
import { Facebook, Instagram, Send, Sparkles, X } from "lucide-react";

/** External community destinations. Instagram URL is provided verbatim. */
const TELEGRAM_URL = "https://t.me/frpbnetwork";
const INSTAGRAM_URL =
  "https://www.instagram.com/frpb.unlock?stkn=aWJvZW83b2F2am04";
/** Facebook page is not published yet — button renders disabled as a placeholder. */
const FACEBOOK_URL: string | null = null;

interface SocialLink {
  label: string;
  href: string | null;
  icon: typeof Send;
  /** Tailwind classes for the solid CTA button. */
  className: string;
}

const SOCIAL_LINKS: readonly SocialLink[] = [
  {
    label: "Join Telegram Group",
    href: TELEGRAM_URL,
    icon: Send,
    className: "bg-sky-500 hover:bg-sky-600 focus-visible:outline-sky-500",
  },
  {
    label: "Follow Instagram Page",
    href: INSTAGRAM_URL,
    icon: Instagram,
    className:
      "bg-gradient-to-r from-fuchsia-600 to-orange-500 hover:from-fuchsia-700 hover:to-orange-600 focus-visible:outline-fuchsia-500",
  },
  {
    label: "Like Facebook Page",
    href: FACEBOOK_URL,
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
        aria-label="FRPB community links"
        aria-hidden={!open}
        className={`w-80 max-w-[calc(100vw-2.5rem)] origin-bottom-right overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-5 py-4 text-white">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close community widget"
            className="absolute right-3 top-3 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            <h2 className="text-base font-semibold leading-tight">
              Contact Us / FRPB Community
            </h2>
          </div>
          <p className="mt-1 pr-6 text-xs leading-relaxed text-emerald-50/90">
            Follow Instagram Page and Telegram for Updates!
          </p>
        </div>

        {/* White action section */}
        <div className="space-y-2.5 bg-white p-4">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon, className }) => {
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
                {label}
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
        aria-label={open ? "Close community links" : "Follow FRPB community updates"}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:translate-y-0"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <Send className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-300 ring-2 ring-emerald-600" />
          )}
        </span>
        <span className="whitespace-nowrap">Follow Updates!</span>
      </button>
    </div>
  );
}
