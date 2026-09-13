import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cpu, Search, Smartphone } from "lucide-react";
import type { ChipsetFamily, ModelCatalogEntry } from "@frpb/shared";

/** Chipset filter chips shown above the results list. "All" = no chipset filter. */
const CHIPSETS: Array<ChipsetFamily | "All"> = [
  "All",
  "MediaTek",
  "Qualcomm",
  "Samsung Exynos",
];

interface ModelPickerProps {
  /** Brand reported by the auto-detection engine — used as the brand filter. */
  detectedBrand: string | null;
  /** Chipset reported by the auto-detection engine — pre-selects the filter. */
  detectedChipset: ChipsetFamily | null;
  selectedModel: string | null;
  onSelectModel: (model: string) => void;
  disabled?: boolean;
}

/**
 * Step 2 — searchable model picker (Part 2).
 *
 * Replaces the old 19-brand grid + free-text input with a single typeahead that
 * queries the strongly-typed shared catalog through `device:searchModels`,
 * filtered by the auto-detected brand and CPU architecture (MediaTek / Qualcomm).
 * Manual entry is always accepted for models not in the catalog.
 */
export default function ModelPicker({
  detectedBrand,
  detectedChipset,
  selectedModel,
  onSelectModel,
  disabled = false,
}: ModelPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [chipsetFilter, setChipsetFilter] = useState<ChipsetFamily | "All">("All");
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Pre-select the chipset filter from the auto-detected device (once known).
  useEffect(() => {
    if (detectedChipset && detectedChipset !== "Unknown") setChipsetFilter(detectedChipset);
  }, [detectedChipset]);

  // Close the dropdown on any outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounced catalog search — re-runs when query / brand / chipset changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      window.frpb.device
        .searchModels({
          query: query.trim() || null,
          brand: detectedBrand,
          chipset: chipsetFilter === "All" ? null : chipsetFilter,
        })
        .then((res) => {
          if (!cancelled) setResults(res);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, detectedBrand, chipsetFilter]);

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (r) => r.model.toLowerCase() === trimmed.toLowerCase()
  );

  function choose(model: string) {
    onSelectModel(model);
    setQuery(model);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder="Search your model — e.g. Galaxy A54, Redmi Note 12…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Context line: which brand / chipset the results are filtered by. */}
      {(detectedBrand || (chipsetFilter !== "All" && chipsetFilter !== null)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {detectedBrand && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              <Smartphone className="h-3 w-3" />
              {detectedBrand}
            </span>
          )}
          {chipsetFilter !== "All" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              <Cpu className="h-3 w-3" />
              {chipsetFilter}
            </span>
          )}
        </div>
      )}

      {/* Chipset architecture filter */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CHIPSETS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => {
              setChipsetFilter(c);
              setOpen(true);
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-60 ${
              chipsetFilter === c
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Results dropdown */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {loading && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              No catalog match — you can still enter the model manually.
            </div>
          ) : (
            results.slice(0, 60).map((entry) => {
              const isSelected = selectedModel === entry.model;
              return (
                <button
                  key={entry.model}
                  type="button"
                  onClick={() => choose(entry.model)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 ${
                    isSelected ? "bg-brand-50/60" : ""
                  }`}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-800">
                      {entry.model}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">{entry.brand}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold text-slate-500">
                        {entry.chipset}
                      </span>
                      {entry.manualMode && (
                        <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
                          key combo
                        </span>
                      )}
                    </span>
                  </span>
                  {isSelected && <span className="text-xs font-semibold text-brand-600">✓</span>}
                </button>
              );
            })
          )}

          {/* Manual entry fallback for models not present in the catalog. */}
          {trimmed.length > 0 && !hasExactMatch && (
            <button
              type="button"
              onClick={() => choose(trimmed)}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2 text-left transition hover:bg-slate-50"
            >
              <span className="text-sm text-slate-700">
                Use <span className="font-semibold">“{trimmed}”</span> manually
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
