// FRPB — Real-time console log UI component.
//
// Designed to mirror the feel of professional tool consoles (e.g. UnlockTool /
// Dr.Fone-style log panels) while staying fully legitimate: the component is
// read-only — it only displays operation logs emitted by the Electron backend.
// It does NOT send or execute any device-modifying commands on its own.
//
// Operation flow typical logs (examples only — actual strings come from the
// engine via `window.frpb.device.onOperationEvent`):
//   "Checking device connection…"
//   "Device detected: SM-A127F (Samsung)"
//   "Reading device properties…"
//   "Authorization check…"
//   "Starting FRP remove — Odin-like phase (O)…"
//   "Remove FRP [1]…"
//   "Removing FRP (O)…"
//   "Progress: 65%"
//   "Operation complete."
//
// The panel itself is just a display surface — no device write access.
//
// Buffer management contract
// --------------------------
// The main process owns a single authoritative rolling buffer bounded to 500
// entries (MAX_OPERATION_LOGS in device.ts) and stamps every entry with a
// monotonic `seq`. This component mirrors that buffer locally so rendering is
// O(new entries) per poll instead of O(buffer):
//   * entries are appended by `seq` (never deduped by message) — repeated
//     engine lines such as several "Rebooting…" are preserved;
//   * the local list is capped to MAX_RENDERED_ENTRIES to bound DOM/memory;
//   * Clear records a tombstone (`clearedUpToRef`) and asks the main process to
//     drop everything up to that seq, so the next poll cannot resurrect lines
//     the user just cleared (sticky clear);
//   * on mount the component seeds from `getRunState()` so a tab opened mid
//     operation shows the full history, then follows `onOperationStatus`.

import { Terminal, Trash2, Copy, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry } from "../lib/ipc";

interface ConsoleLogProps {
  /** Whether the backend is currently running an operation. */
  running: boolean;
  /** Latest log entries (newest at bottom by default unless reversed). */
  entries: LogEntry[];
}

/** Hard cap on rendered entries — mirrors MAX_OPERATION_LOGS in device.ts. */
const MAX_RENDERED_ENTRIES = 500;

const STAGE_COLORS: Record<string, string> = {
  USB: "text-indigo-600 bg-indigo-50",
  ADB: "text-emerald-700 bg-emerald-50",
  BROM: "text-rose-700 bg-rose-50",
  FRP: "text-violet-700 bg-violet-50",
  ODIN: "text-amber-700 bg-amber-50",
  DEFAULT: "text-slate-600 bg-slate-50",
};

function tsNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeEntry(stage: string, message: string): LogEntry {
  return { ts: tsNow(), stage, message, pct: null, kind: "info" };
}

export default function ConsoleLog({ running, entries }: ConsoleLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [localEntries, setLocalEntries] = useState<LogEntry[]>([
    makeEntry("START", "Console initialized. Connect a device to begin."),
  ]);

  // Highest `seq` already rendered / cleared. Bumped by appends AND by Clear so
  // a poll that re-sends the (capped) buffer cannot re-add cleared lines.
  const lastSeqRef = useRef(0);
  // Identity fallback for any legacy entry that lacks a `seq` (defensive only).
  const seenRefs = useRef<WeakSet<LogEntry>>(new WeakSet());
  // Mirrors `running` but can be updated instantly from the push channel so the
  // "Live" badge flips without waiting for the 2s device poll.
  const [liveRunning, setLiveRunning] = useState(running);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLiveRunning(running);
  }, [running]);

  // Append only entries newer than what we have rendered/cleared.
  const mergeEntries = useCallback((incoming: LogEntry[]) => {
    if (!incoming.length) return;
    setLocalEntries((prev) => {
      const fresh: LogEntry[] = [];
      for (const e of incoming) {
        if (typeof e.seq === "number") {
          if (e.seq <= lastSeqRef.current) continue;
          lastSeqRef.current = e.seq;
          fresh.push(e);
        } else {
          // No seq: fall back to object identity within this session.
          if (seenRefs.current.has(e)) continue;
          seenRefs.current.add(e);
          fresh.push(e);
        }
      }
      if (!fresh.length) return prev;
      const merged = [...prev, ...fresh];
      return merged.length > MAX_RENDERED_ENTRIES
        ? merged.slice(merged.length - MAX_RENDERED_ENTRIES)
        : merged;
    });
  }, []);

  // Seed from the authoritative main-process snapshot, then follow the push
  // channel. Both paths funnel through mergeEntries so double-delivery is safe.
  useEffect(() => {
    let disposed = false;
    window.frpb.device
      .getRunState()
      .then((state) => {
        if (disposed) return;
        setLiveRunning(state.running);
        mergeEntries(state.logs);
      })
      .catch(() => {});
    const off = window.frpb.device.onOperationStatus((state) => {
      if (disposed) return;
      setLiveRunning(state.running);
      mergeEntries(state.logs);
    });
    return () => {
      disposed = true;
      off();
    };
  }, [mergeEntries]);

  // Keep the local view in sync with the shared status payload too (covers the
  // web-preview bridge, where onOperationStatus is a no-op subscription).
  useEffect(() => {
    mergeEntries(entries);
  }, [entries, mergeEntries]);

  // Auto-scroll to the newest entry.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [localEntries]);

  // Reset the "Copied" affordance timer on unmount.
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const clearLogs = useCallback(() => {
    // Tombstone everything currently shown, then drop it locally. The main
    // process drops `seq <= lastSeqRef` from its rolling buffer and broadcasts;
    // new entries keep the counter climbing, so they continue to flow through.
    const upTo = lastSeqRef.current;
    setLocalEntries([makeEntry("CLEAR", "Console cleared.")]);
    window.frpb.device.clearLogs(upTo).catch(() => {});
  }, []);

  const copyLogs = useCallback(() => {
    const text = localEntries
      .map(
        (e) =>
          `[${e.ts}] ${e.stage.padEnd(8)} ${e.message}${
            e.pct != null ? ` (${e.pct}%)` : ""
          }`
      )
      .join("\n");
    const clip = navigator.clipboard;
    if (!clip || typeof clip.writeText !== "function") return;
    clip
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [localEntries]);

  const empty = !localEntries.length ? (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Terminal className="h-8 w-8 text-slate-300 mb-2" />
      <p className="text-sm font-medium text-slate-400">Console log ready</p>
      <p className="text-xs text-slate-400 mt-1">
        Operation logs will appear here automatically.
      </p>
    </div>
  ) : (
    <div
      ref={logRef}
      className="h-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed"
    >
      <div className="flex items-center gap-2 pb-2 border-b border-slate-700 mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FRPB Console</span>
        {liveRunning && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="animate-pulse h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            Running
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {localEntries.map((e, i) => (
          <div key={`${e.ts}-${e.seq ?? i}-${i}`} className="flex items-start gap-2 text-slate-300">
            <span className="select-none shrink-0 text-slate-500 w-14 pt-0.5 text-[10px]">{e.ts}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[e.stage] ?? STAGE_COLORS.DEFAULT}`}>
              {e.stage}
            </span>
            <span className="flex-1 break-words">{e.message}</span>
            {e.pct != null && (
              <span className="shrink-0 text-emerald-400 font-semibold">{e.pct}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="frpb-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Console Log</h2>
          {liveRunning && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLogs}
            disabled={!localEntries.length}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={clearLogs}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
          <span className="text-[10px] text-slate-400">{localEntries.length} entries</span>
        </div>
      </div>

      {/* Log body */}
      <div className="bg-[#0f172a] p-3">{empty}</div>
    </div>
  );
}
