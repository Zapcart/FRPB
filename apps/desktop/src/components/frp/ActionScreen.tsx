import { type ReactNode, type Ref } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Usb,
  XCircle,
} from "lucide-react";
import type { ChipsetFamily, DeviceConnectionState } from "@frpb/shared";
import type { OperationResult } from "../../lib/ipc";
import { connectionGuideFor, opLabel, type ConnectionGuide } from "./shared";
import ModelPicker from "./ModelPicker";

/** Connection state → small human-readable badge label + tone. */
const CONNECTION_LABEL: Record<DeviceConnectionState, string> = {
  disconnected: "No device",
  adb: "Connected · ADB",
  fastboot: "Connected · Fastboot",
  mtp: "Connected · MTP",
  brom: "Connected · BROM",
  edl: "Connected · EDL",
  com: "Connected · COM",
};

export interface ActionProgress {
  stage: string;
  pct: number;
  /** Overall pipeline completion (0-100). */
  overall: number;
  /** Current task completion (0-100). */
  current: number;
}

interface ActionScreenProps {
  // Step 1 — auto-detected device info
  detected: boolean;
  brand: string | null;
  model: string | null;
  serial: string | null;
  port: string | null;
  chipset: ChipsetFamily;
  connection: DeviceConnectionState;
  driverInstalled: boolean;
  // Step 2 — model selection
  selectedModel: string;
  onSelectModel: (model: string) => void;
  // Step 3 — actions
  connected: boolean;
  busy: boolean;
  runningOp: "flash-reset" | "frp-bypass" | null;
  progress: ActionProgress | null;
  result: OperationResult | null;
  opLog: Array<{ time: string; message: string }>;
  logRef: Ref<HTMLDivElement>;
  onRefresh: () => void;
  onFlashReset: () => void;
  onFrpBypass: () => void;
}

/**
 * Steps 1-3 — the entire simplified workflow on a single screen (Parts 2-4).
 *
 *   Step 1  auto-detected Device Info (brand + connection status badge)
 *   Step 2  searchable Model dropdown filtered by brand + CPU architecture
 *   Step 3  exactly two big actions: Flash Reset + FRP Bypass
 *
 * Below the actions a professional dual progress bar (Overall + Current Task)
 * and a real-time stage console stream the automated execution.
 */
export default function ActionScreen({
  detected,
  brand,
  model,
  serial,
  port,
  chipset,
  connection,
  driverInstalled,
  selectedModel,
  onSelectModel,
  connected,
  busy,
  runningOp,
  progress,
  result,
  opLog,
  logRef,
  onRefresh,
  onFlashReset,
  onFrpBypass,
}: ActionScreenProps) {
  const overall = progress?.overall ?? 0;
  const current = progress?.current ?? 0;
  const guide: ConnectionGuide = connectionGuideFor(brand ?? null, "general");

  return (
    <div className="flex flex-col gap-5">
      {/* ── Step 1 — Auto-detected device info ──────────────────────────────── */}
      <section className="frpb-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
              1
            </span>
            <h2 className="text-sm font-bold text-slate-900">Device Information</h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="frpb-btn-ghost px-3 py-1.5 text-xs"
          >
            Rescan
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          <DetectedField
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="Brand / Model"
            value={[brand, model].filter(Boolean).join(" ") || null}
          />
          <DetectedField
            icon={<Usb className="h-3.5 w-3.5" />}
            label="Serial / Port"
            value={serial ?? port ?? null}
          />
          <DetectedField
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="Chipset"
            value={chipset !== "Unknown" ? chipset : null}
          />
          <DetectedField
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Driver"
            value={driverInstalled ? "Installed" : null}
          />
        </div>

        {/* Connection status badge */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              {connection === "disconnected" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {CONNECTION_LABEL[connection]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600">
              <XCircle className="h-4 w-4" />
              Waiting for device — plug in your phone
            </span>
          )}
          {detected && brand && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              Auto-detected
            </span>
          )}
        </div>
      </section>

      {/* ── Step 2 — Model search ───────────────────────────────────────────── */}
      <section className="frpb-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
            2
          </span>
          <h2 className="text-sm font-bold text-slate-900">Select Your Model</h2>
        </div>
        <ModelPicker
          detectedBrand={brand}
          detectedChipset={chipset}
          selectedModel={selectedModel || null}
          onSelectModel={onSelectModel}
          disabled={busy}
        />
      </section>

      {/* ── Step 3 — Two primary actions ────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
            3
          </span>
          <h2 className="text-sm font-bold text-slate-900">Choose an Action</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Flash Reset — clear screen lock */}
          <button
            type="button"
            onClick={onFlashReset}
            disabled={busy}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200">
              {runningOp === "flash-reset" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Lock className="h-7 w-7" />
              )}
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-slate-900">🔓 Flash Reset</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Clear screen lock — wipe data & remove PIN / pattern / password.
              </span>
            </span>
          </button>

          {/* FRP Bypass — Google account lock */}
          <button
            type="button"
            onClick={onFrpBypass}
            disabled={busy}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-brand-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md shadow-brand-200">
              {runningOp === "frp-bypass" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <KeyRound className="h-7 w-7" />
              )}
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-slate-900">🛡️ FRP Bypass</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Remove Google (Gmail) account lock after a factory reset.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-3 inline-flex items-start gap-1.5 rounded-md bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No USB debugging needed — choosing an action opens a guided connection wizard
          (BROM / EDL / Fastboot key combination).
        </p>

        {/* Current target + connection guide while running */}
        {busy && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Running {runningOp ? opLabel(runningOp) : "operation"}…
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {guide.title} · {guide.listeningLabel}
            </p>
            <div className="mt-2 rounded-lg border border-brand-200 bg-white px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                Hold
              </span>
              <span className="ml-2 text-sm font-bold text-slate-900">{guide.keyCombo}</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Dual progress + live stage console (Part 4) ─────────────────────── */}
      {(busy || progress || result) && (
        <section className="frpb-card p-5">
          <DualProgressBars
            stage={progress?.stage ?? null}
            overall={overall}
            current={current}
          />

          {result && (
            <div
              className={`mt-4 flex items-start gap-3 rounded-xl border p-3.5 ${
                result.success
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    result.success ? "text-emerald-800" : "text-rose-700"
                  }`}
                >
                  {result.message}
                </p>
                {result.detail && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">
                    {result.detail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Real-time stage console ([Device Connected] → [Chipset Matched] → …) */}
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Live progress
            </div>
            <div
              ref={logRef}
              className="max-h-56 overflow-y-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200"
            >
              {opLog.length === 0 ? (
                <div className="text-slate-500">Waiting for the engine…</div>
              ) : (
                opLog.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-slate-500">{entry.time}</span>
                    <span
                      className={
                        entry.message.startsWith("!")
                          ? "text-rose-300"
                          : entry.message.includes("[")
                            ? "text-emerald-300"
                            : ""
                      }
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** A single auto-detected telemetry cell. */
function DetectedField({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-slate-800">{value ?? "—"}</div>
    </div>
  );
}

/**
 * Professional dual progress bar (Part 4): an Overall bar (whole operation) and
 * a Current Task bar (active step). Both are clamped to 0-100 and reach 100 on
 * completion.
 */
function DualProgressBars({
  stage,
  overall,
  current,
}: {
  stage: string | null;
  overall: number;
  current: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const o = clamp(overall);
  const c = clamp(current);
  return (
    <div className="flex flex-col gap-3">
      <ProgressBar label="Overall Progress" value={o} tone="brand" />
      <ProgressBar
        label={stage ? `Current Task — ${stage}` : "Current Task"}
        value={c}
        tone="emerald"
      />
    </div>
  );
}

function ProgressBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "emerald";
}) {
  const fill =
    tone === "brand"
      ? "bg-gradient-to-r from-brand-500 to-accent-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{value}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
