// FRPB — Free Utilities tab.
//
// Renders the shared FREE_TOOLS catalogue (WhatsApp Transfer, Phone Transfer,
// Data Eraser, Virtual Location) and drives the native desktop operations
// exposed through `window.frpb.freeTools` (see electron/ipc/free-tools.ts).
//
// The screen is UI-only: it never talks to ADB directly. It builds a typed
// `FreeToolRunRequest`, invokes the bridge, and renders the `FreeToolRunResult`
// both from the invoke response (final state) and from streamed
// `FreeToolOperationEvent`s (live progress) so long operations stay responsive.
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FreeToolId,
  FreeToolLogLine,
  FreeToolRunRequest,
  FreeToolRunResult,
} from "@frpb/shared";
import { FREE_TOOLS, FREE_TOOL_IDS } from "@frpb/shared";
import type { DeviceStatus } from "../lib/ipc";
import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  MapPin,
  MessageCircle,
  Play,
  RefreshCw,
  Smartphone,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Icon + category configuration                                             */
/* -------------------------------------------------------------------------- */

/** Maps each free tool onto its lucide component. Keyed by `FreeToolId` (the
 *  shared `FreeToolMeta` is data-only and carries no icon) so the config stays
 *  JSX-free and importable from the Electron main process. */
const FREE_TOOL_ICONS: Record<FreeToolId, LucideIcon> = {
  "whatsapp-transfer": MessageCircle,
  "phone-transfer": Smartphone,
  "data-eraser": Eraser,
  "virtual-location": MapPin,
};

/** Selectable data categories per tool. Tools with no selectable scope (data
 *  eraser, virtual location) use an empty list and render dedicated inputs. */
const TOOL_CATEGORIES: Record<FreeToolId, ReadonlyArray<{ id: string; label: string }>> = {
  "whatsapp-transfer": [
    { id: "chats", label: "Chats & messages" },
    { id: "media", label: "Photos & videos" },
    { id: "documents", label: "Documents" },
  ],
  "phone-transfer": [
    { id: "contacts", label: "Contacts" },
    { id: "messages", label: "SMS & call logs" },
    { id: "media", label: "Photos & videos" },
    { id: "apps", label: "Apps & app data" },
  ],
  "data-eraser": [],
  "virtual-location": [],
};

/** Tools that wipe irreversibly and therefore require explicit acknowledgement. */
const DESTRUCTIVE_TOOLS: ReadonlySet<FreeToolId> = new Set<FreeToolId>(["data-eraser"]);

/** Tools that need the phone to be ADB-authorized before they can run. */
const ADB_ONLY_TOOLS: ReadonlySet<FreeToolId> = new Set<FreeToolId>([
  "whatsapp-transfer",
  "phone-transfer",
  "virtual-location",
]);

const LOG_TONE: Record<FreeToolLogLine["level"], string> = {
  info: "text-slate-500",
  warn: "text-amber-600",
  error: "text-rose-600",
  success: "text-emerald-600",
};

interface ToastState {
  message: string;
  tone: "error" | "neutral";
}

export interface FreeUtilitiesScreenProps {
  status: DeviceStatus | null;
  onRefresh: () => void;
  operationRunning: boolean;
}

/**
 * Free Utilities workspace. A 4-card catalogue opens a per-tool run panel with
 * its own scope controls, live progress and a scrollable operation log.
 */
export default function FreeUtilitiesScreen({
  status,
  onRefresh,
  operationRunning,
}: FreeUtilitiesScreenProps) {
  const [activeTool, setActiveTool] = useState<FreeToolId>("whatsapp-transfer");
  // Per-tool category selection, reset whenever the active tool changes.
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FreeToolRunResult | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const meta = FREE_TOOLS[activeTool];
  const connected = Boolean(status?.connected) || status?.state === "CONNECTED";
  const authorized = connected && status?.authorized !== false;
  const needsAuth = ADB_ONLY_TOOLS.has(activeTool) && (!authorized || !connected);
  const busy = running || operationRunning;

  // Reset tool-scoped inputs on switch so stale values never leak across tools.
  useEffect(() => {
    setSelected({});
    setAcknowledged(false);
    setLatitude("");
    setLongitude("");
    setResult(null);
    setToast(null);
  }, [activeTool]);

  // Live progress: the main process streams `FreeToolOperationEvent`s for the
  // running tool. Only the active tool's events are surfaced here.
  useEffect(() => {
    let disposed = false;
    const off = window.frpb.freeTools.onEvent((event) => {
      if (disposed || event.tool !== activeTool) return;
      setResult(event.result);
    });
    return () => {
      disposed = true;
      off();
    };
  }, [activeTool]);

  const categories = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([id]) => id),
    [selected]
  );

  const toggleCategory = useCallback((id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const canRun = useMemo(() => {
    if (busy) return false;
    if (needsAuth) return false;
    if (DESTRUCTIVE_TOOLS.has(activeTool) && !acknowledged) return false;
    if (activeTool === "virtual-location") {
      const lat = Number.parseFloat(latitude);
      const lng = Number.parseFloat(longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return false;
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) return false;
    }
    return true;
  }, [busy, needsAuth, activeTool, acknowledged, latitude, longitude]);

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setRunning(true);
    setResult(null);
    setToast(null);

    const request: FreeToolRunRequest = { tool: activeTool };
    if (status?.serial) request.sourceSerial = status.serial;
    if (categories.length > 0) request.categories = categories;
    if (activeTool === "data-eraser") request.acknowledged = acknowledged;
    if (activeTool === "virtual-location") {
      request.latitude = Number.parseFloat(latitude);
      request.longitude = Number.parseFloat(longitude);
    }

    try {
      const res = await window.frpb.freeTools.run(request);
      setResult(res);
      if (!res.success) {
        setToast({ message: res.error ?? res.message, tone: "error" });
      } else {
        // A transfer/erase changes device state — refresh the shared poll.
        onRefresh();
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "The operation could not be started. Check the device connection and try again.";
      setToast({ message, tone: "error" });
    } finally {
      setRunning(false);
    }
  }, [
    canRun,
    activeTool,
    status?.serial,
    categories,
    acknowledged,
    latitude,
    longitude,
    onRefresh,
  ]);

  const progress =
    result?.progress != null ? Math.min(Math.max(result.progress, 0), 100) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Intro */}
      <header className="frpb-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Free Utilities & Tools</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Four no-cost tools included with FRPB Recovery. Pick one to run it on the
              connected device.
            </p>
          </div>
        </div>
      </header>

      {/* Catalogue */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FREE_TOOL_IDS.map((id) => {
          const tool = FREE_TOOLS[id];
          const Icon = FREE_TOOL_ICONS[id];
          const active = id === activeTool;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTool(id)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition ${
                active
                  ? "border-brand-300 bg-brand-50/60 shadow-sm"
                  : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  active ? "bg-white text-brand-600" : "bg-slate-50 text-slate-500"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  {tool.eyebrow}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  {tool.tagline}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                <Play className="h-3 w-3" />
                Try For Free
              </span>
            </button>
          );
        })}
      </div>

      {/* Run panel */}
      <section className="frpb-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
              {(() => {
                const Icon = FREE_TOOL_ICONS[activeTool];
                return <Icon className="h-5 w-5" />;
              })()}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{meta.eyebrow}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{meta.tagline}</p>
            </div>
          </div>
          {DESTRUCTIVE_TOOLS.has(activeTool) && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">
              <AlertTriangle className="h-3 w-3" />
              Destructive
            </span>
          )}
        </div>

        {/* Device line */}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
          {connected ? (
            <>
              <span className="font-medium text-slate-800">
                {status?.brand ?? "Android"}
                {status?.model ? ` ${status.model}` : ""}
              </span>
              <span className="font-mono text-slate-400">
                {status?.serial ?? "unknown serial"}
              </span>
              {status?.authorized === false && (
                <span className="ml-auto font-medium text-amber-600">
                  Authorize USB debugging
                </span>
              )}
            </>
          ) : (
            <span>No device connected — plug in a phone to run this tool.</span>
          )}
        </div>

        {/* Tool-specific scope controls */}
        {TOOL_CATEGORIES[activeTool].length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-700">What to transfer</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {TOOL_CATEGORIES[activeTool].map((cat) => (
                <label
                  key={cat.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 transition hover:border-brand-300"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[cat.id])}
                    onChange={() => toggleCategory(cat.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {cat.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTool === "virtual-location" && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Latitude
              <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                min={-90}
                max={90}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 37.7749"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Longitude
              <input
                type="number"
                inputMode="decimal"
                step="0.000001"
                min={-180}
                max={180}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. -122.4194"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none transition focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
              />
            </label>
          </div>
        )}

        {DESTRUCTIVE_TOOLS.has(activeTool) && (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5 text-xs text-rose-800">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
            />
            <span>
              I understand this permanently erases all data on the connected device and
              cannot be undone. I have made a backup.
            </span>
          </label>
        )}

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!canRun}
            className="frpb-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {busy ? "Running…" : "Run"} {meta.eyebrow}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="frpb-btn-ghost inline-flex items-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            Refresh device
          </button>
          {needsAuth && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {connected
                ? "Enable USB debugging and accept the authorization prompt."
                : "Connect an ADB-authorized device first."}
            </span>
          )}
        </div>

        {/* Progress + log */}
        {result && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  result.success ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {result.message}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {result.phase}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  result.success ? "bg-emerald-500" : "bg-brand-500"
                }`}
                style={{ width: `${progress ?? (result.success ? 100 : 8)}%` }}
              />
            </div>
            {result.logs.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed">
                {result.logs.map((line, i) => (
                  <div key={`${line.at}-${i}`} className={LOG_TONE[line.level]}>
                    <span className="text-slate-500">
                      [{String(line.at).padStart(5, "0")}ms]
                    </span>{" "}
                    {line.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guided steps (help when idle) */}
        {!result && meta.steps.length > 0 && (
          <ol className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
            {meta.steps.map((step, index) => (
              <li key={step.title} className="flex gap-2 text-xs text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                  {index + 1}
                </span>
                <span>
                  <span className="font-medium text-slate-800">{step.title}</span>
                  {step.desc ? ` — ${step.desc}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Error toast */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-xl shadow-rose-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <p className="flex-1 whitespace-pre-wrap break-words text-sm text-slate-700">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
