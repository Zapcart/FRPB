import { AlertTriangle, ArrowLeft, CheckCircle2, Smartphone } from "lucide-react";
import { BRANDS, seriesFooter } from "./shared";

interface BrandScreenProps {
  selectedBrand: string | null;
  onSelectBrand: (brand: string) => void;
  onBack: () => void;
  onStart: () => void;
  canStart: boolean;
  busy: boolean;
  detectedBrand?: string;
  detectedModel?: string;
  modelInput: string;
  onModelChange: (value: string) => void;
  isConnected: boolean;
}

/**
 * Screen 2 — Brand Selection.
 * Radio grid of 19 supported brands. Detection stays brand-agnostic; the
 * selected brand only tunes which methods are offered on Screen 3.
 */
export default function BrandScreen({
  selectedBrand,
  onSelectBrand,
  onBack,
  onStart,
  canStart,
  busy,
  detectedBrand,
  detectedModel,
  modelInput,
  onModelChange,
  isConnected,
}: BrandScreenProps) {
  const detected = detectedBrand ?? detectedModel;

  return (
    <div className="frpb-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Left — phone mockup */}
        <div className="hidden flex-col items-center justify-center gap-6 border-r border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/60 p-8 lg:flex">
          <div className="w-full max-w-[240px] rounded-[2rem] border-[6px] border-slate-900 bg-white p-3 shadow-2xl">
            <div className="rounded-[1.4rem] bg-slate-100 p-4">
              <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-slate-300" />
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Google
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">Verify your account</div>
                <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  To use this device, first verify it's yours. Sign in with the Google Account that
                  was previously synced on this device.
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-400">
                  Email or phone
                </div>
                <div className="mt-2 rounded-lg bg-brand-600 py-2 text-center text-[10px] font-semibold text-white">
                  Next
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500">
            Bypass the FRP lock screen and regain access
            <br />
            to your own device.
          </p>
        </div>

        {/* Right — brand grid */}
        <div className="p-6">
          <button
            onClick={onBack}
            disabled={busy}
            className="frpb-btn-ghost mb-4 px-3 py-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <h2 className="text-lg font-bold text-slate-900">Quickly Remove Google FRP Lock</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select your device brand to continue. Detection is automatic — choose the brand of the
            connected device.
          </p>

          {detected && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Detected: {detected}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {BRANDS.map((brand) => {
              const active = selectedBrand === brand;
              return (
                <button
                  key={brand}
                  onClick={() => onSelectBrand(brand)}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      active ? "border-brand-500 bg-brand-500" : "border-slate-300"
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </span>
                  <Smartphone className="h-4 w-4 shrink-0 opacity-60" />
                  {brand}
                </button>
              );
            })}
          </div>

          {/* Manual model input (optional refinement) */}
          <div className="mt-4">
            <label
              htmlFor="frp-model-manual"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Device model (optional)
            </label>
            <input
              id="frp-model-manual"
              value={modelInput}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={busy}
              placeholder="e.g. Galaxy S21, Redmi Note 12, Pixel 6a…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="frpb-input"
            />
          </div>

          {!isConnected && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Connect a device first — operations require an active ADB connection.
            </p>
          )}

          <button
            onClick={onStart}
            disabled={!canStart || busy}
            className="frpb-btn-primary mt-5 w-full py-3 text-sm font-bold"
          >
            Start
          </button>

          <div className="mt-4 flex flex-col items-center gap-1 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <span className="font-medium text-slate-500">{seriesFooter(selectedBrand)}</span>
            <span>Complete bypass: use another account after bypass</span>
          </div>
        </div>
      </div>
    </div>
  );
}
