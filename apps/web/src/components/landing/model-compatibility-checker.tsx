"use client";

// FRPB — interactive "Search Your Phone Model" compatibility checker.
//
// Client component (needs an input + live filtering). It answers the single
// biggest pre-purchase objection — "will it work on MY phone?" — by running the
// visitor's query against the SAME model catalog the desktop app and API use
// (`@frpb/shared`). Every result is derived from real shipped product data, so
// there is no invented social proof: a match means the model is genuinely in the
// supported catalog; no match is reported honestly with a Telegram fallback.

import { useMemo, useState } from "react";
import { Check, Cpu, Info, Search, Smartphone, X } from "lucide-react";
import { modelCatalog, searchModels, type ModelCatalogEntry } from "@frpb/shared";
import { SUPPORT_TELEGRAM_URL } from "@/config/support";

/** Example models (all present in the catalog) used as one-tap suggestions. */
const QUICK_PICKS = ["Samsung Galaxy A05", "Redmi 12 5G", "Vivo Y17s"] as const;

/** Max result rows rendered for a single query. */
const MAX_RESULTS = 8;

export default function ModelCompatibilityChecker() {
  const [query, setQuery] = useState("");

  // Catalog size is static at runtime — compute once for the honest total.
  const totalModels = useMemo(() => modelCatalog().length, []);

  const trimmed = query.trim();

  const results = useMemo<ModelCatalogEntry[]>(() => {
    if (!trimmed) return [];
    try {
      return searchModels({ query: trimmed }).slice(0, MAX_RESULTS);
    } catch (error) {
      // Defensive: a catalog hiccup must never crash the landing page.
      console.error("[model-checker] search failed:", error);
      return [];
    }
  }, [trimmed]);

  const hasQuery = trimmed.length > 0;
  const noMatch = hasQuery && results.length === 0;

  return (
    <section
      id="compatibility"
      aria-label="Device compatibility checker"
      className="relative mx-auto max-w-7xl px-6 pt-14 sm:pt-16"
    >
      <div className="glass-panel glass-sheen relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-[90px]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="text-center">
            <span className="badge mb-4">
              <Smartphone className="h-3.5 w-3.5 text-brand-500" />
              Compatibility check
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Search your phone model
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              Type a model (for example <span className="font-semibold text-ink">Samsung A05</span>,{" "}
              <span className="font-semibold text-ink">Redmi 12 5G</span> or{" "}
              <span className="font-semibold text-ink">Vivo Y17s</span>) to check whether FRPB
              supports it for FRP bypass and diagnostics.
            </p>
          </div>

          {/* Search box */}
          <div className="mt-6">
            <label htmlFor="model-search" className="sr-only">
              Search your phone model
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />
              <input
                id="model-search"
                type="text"
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Samsung Galaxy A05, Redmi 12 5G, POCO C71"
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm font-medium text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
              {hasQuery ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* One-tap suggestions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Try:
              </span>
              {QUICK_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  onClick={() => setQuery(pick)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  {pick}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div aria-live="polite" className="mt-6">
            {hasQuery && results.length > 0 ? (
              <ul className="space-y-2">
                {results.map((entry) => (
                  <li
                    key={entry.model}
                    className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-ink">{entry.model}</p>
                        <p className="text-[11px] font-medium text-emerald-700">
                          Supported for FRP Bypass & Diagnostics
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <Cpu className="h-3 w-3" />
                        {entry.chipset}
                      </span>
                      {entry.manualMode ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          <Info className="h-3 w-3" />
                          Guided key-combo step
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {noMatch ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-4 text-sm text-amber-800">
                <p className="font-semibold">
                  No catalog match for &ldquo;{trimmed}&rdquo;.
                </p>
                <p className="mt-1 leading-relaxed text-amber-700">
                  FRPB supports {totalModels} catalogued models across Samsung, Xiaomi, Vivo,
                  OPPO, Realme, Motorola, Pixel and more. Try a broader term (just the brand),
                  or ask our team on the{" "}
                  <a
                    href={SUPPORT_TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    official Telegram channel
                  </a>
                  .
                </p>
              </div>
            ) : null}

            {!hasQuery ? (
              <p className="text-center text-xs text-slate-400">
                {totalModels} models in the supported catalog. Start typing to check yours.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
