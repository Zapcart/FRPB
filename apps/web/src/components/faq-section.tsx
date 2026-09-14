// FRPB — reusable FAQ section.
// Server component: renders the visible accordion (native <details>, so no
// client JS is required) straight from the shared FAQ list. The accompanying
// FAQPage JSON-LD is emitted by the caller from the *same* array, which keeps
// the on-page copy and the structured data in lockstep.

import { ChevronRight, HelpCircle } from "lucide-react";
import { HOME_FAQ, type FaqItem } from "@/lib/faq";

export interface FaqSectionProps {
  /** Questions to render. Defaults to the homepage FAQ list. */
  items?: readonly FaqItem[];
  /** Anchor id — link to `#faq` (or a custom id) from the nav. */
  id?: string;
  heading?: string;
  intro?: string;
}

export default function FaqSection({
  items = HOME_FAQ,
  id = "faq",
  heading = "Frequently asked questions",
  intro = "Everything technicians ask before they run their first FRP bypass or flash reset with FRPB.",
}: FaqSectionProps) {
  if (!items.length) return null;

  return (
    <section id={id} className="border-t border-white/10 bg-night-900/40">
      <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent-400 backdrop-blur">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{heading}</h2>
          {intro ? (
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              {intro}
            </p>
          ) : null}
        </div>

        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-md transition duration-300 open:border-white/20 open:bg-white/[0.06] open:shadow-glass hover:border-white/20 hover:bg-white/[0.05]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white marker:hidden [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-90 group-open:text-accent-400" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
