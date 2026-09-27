// FRPB — floating support & FAQ drawer.
// The bottom-right trigger expands into a compact support-bot drawer with
// quick FAQ chips and a free-text box that composes a pre-filled mailto to the
// FRPB support inbox. Positioned one slot above the SocialUpdatesWidget
// (bottom-28 vs bottom-5) and behind its z-50 popover so the two floating
// widgets never overlap.
//
// Client component: owns local open state, the message draft, and
// Escape / click-outside dismissal. No async work.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronRight,
  LifeBuoy,
  Mail,
  MessageCircle,
  Send,
  Smartphone,
  X,
  type LucideIcon,
} from "lucide-react";
import { SUPPORT_EMAIL, mailtoHref } from "@/config/legal";

interface SupportFaq {
  label: string;
  icon: LucideIcon;
  href: string;
}

const SUPPORT_FAQS: readonly SupportFaq[] = [
  { label: "Google FRP Lock Removal Steps", icon: Smartphone, href: "/#features" },
  { label: "License Key not received?", icon: Mail, href: "/recover" },
  { label: "Device not recognized by PC?", icon: LifeBuoy, href: "/#features" },
];

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Dismiss on Escape, and on any pointer-down outside the drawer.
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Compose a mailto to the support inbox, pre-filling the typed message as
    // the subject so the help conversation opens with context.
    const subject = query.trim() || "FRPB support request";
    if (typeof window !== "undefined") {
      window.location.href = `${mailtoHref(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}`;
    }
  }

  return (
    <div className="fixed bottom-28 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      {/* Support drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="FRPB support assistant"
        aria-hidden={!open}
        className={`flex w-[22rem] max-w-[calc(100vw-2.5rem)] origin-bottom-right flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-600 to-accent-600 px-5 py-4 text-white">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close support assistant"
            className="absolute right-2 top-2 grid h-11 w-11 touch-manipulation select-none place-items-center rounded-full text-white/80 transition-colors active:bg-white/25 hover:bg-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold leading-tight">
              FRPB Support Assistant
            </h2>
          </div>
          <p className="mt-1.5 pr-6 text-xs leading-relaxed text-brand-50/90">
            Hi there — pick a topic below or ask us anything. We usually reply within a
            few hours.
          </p>
        </div>

        {/* Quick FAQ chips */}
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick answers
          </p>
          {SUPPORT_FAQS.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-ink hover:shadow-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
            </Link>
          ))}
        </div>

        {/* Free-text composer → support mailto */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-white p-4">
          <label htmlFor="frpb-support-message" className="sr-only">
            Type a message or search help
          </label>
          <input
            id="frpb-support-message"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a message or search help..."
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            aria-label="Send message to FRPB support"
            className="grid h-11 w-11 shrink-0 touch-manipulation select-none place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        {/* Contact footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[11px] text-slate-400">
          <span>Need more help?</span>
          <a
            href={mailtoHref(SUPPORT_EMAIL)}
            className="flex items-center gap-1.5 font-semibold text-slate-500 transition hover:text-ink"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      {/* Closed-state trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close support assistant" : "Open FRPB support assistant"}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:translate-y-0"
      >
        <LifeBuoy
          className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
          aria-hidden="true"
        />
        <span className="whitespace-nowrap">Support</span>
      </button>
    </div>
  );
}
