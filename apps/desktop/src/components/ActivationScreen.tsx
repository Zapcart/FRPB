import { useEffect, useState } from "react";
import type { VerifyStatus } from "@frpb/shared";
import type { LicenseProfile } from "../lib/ipc";
import { MASTER_TEST_KEY, isWebPreviewMode } from "../lib/webFallback";
import logoUrl from "../assets/logo.png";
import {
  KeyRound,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const STATUS_MESSAGES: Partial<Record<VerifyStatus, string>> = {
  DEVICE_LIMIT_EXCEEDED:
    "Device limit reached for this license. Free up a device from your FRPB dashboard, then retry.",
  INVALID_KEY: "This license key is invalid. Please double-check it and try again.",
  EXPIRED: "This license has expired. Renew it from your FRPB dashboard.",
  REVOKED: "This license has been revoked. Contact support if you believe this is a mistake.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  LOCKED:
    "This license is locked due to repeated failed attempts. Contact support to unlock it.",
  INVALID_REQUEST: "The request was invalid. Please update the app and retry.",
  SERVER_ERROR: "Our server hit an error. Please try again in a moment.",
};

/** Shown whenever activation cannot reach the verification server. */
const OFFLINE_MESSAGE =
  "Offline Mode: Please check your internet connection to verify your license key.";

/** Branded copy for the license-key placeholder (never a hardcoded test key). */
const LICENSE_PLACEHOLDER = "Enter your license key";

/**
 * True when text carries a raw technical API path / transport detail that must
 * never be shown in the activation banner (e.g. the /api/v1/license/verify
 * endpoint or an ECONNREFUSED code).
 */
function looksTechnical(text: string): boolean {
  return (
    /https?:\/\//i.test(text) ||
    /\/api\//i.test(text) ||
    /\bECONNREFUSED\b/i.test(text) ||
    /\bENOTFOUND\b/i.test(text) ||
    /\bETIMEDOUT\b/i.test(text) ||
    /\bfetch failed\b/i.test(text) ||
    /\bundici\b/i.test(text)
  );
}

/**
 * Final renderer-side guard: replace any message that leaks a raw API path or
 * transport code with the friendly offline copy. The main process already
 * sanitises its messages — this is defence in depth so the banner stays
 * professional even if a raw error slips through IPC.
 */
function friendlyError(message: string | undefined | null): string {
  if (!message) return OFFLINE_MESSAGE;
  return looksTechnical(message) ? OFFLINE_MESSAGE : message;
}

interface ActivationScreenProps {
  cached: LicenseProfile | null;
  onActivated: (profile: LicenseProfile) => void;
}

/**
 * Entry screen shown when this install has no persisted license session.
 *
 * The key field ALWAYS starts empty and shows the neutral
 * "Enter your license key" placeholder. There is no hardcoded or pre-filled
 * test key anywhere in the field: previously it was seeded from the encrypted
 * cache, which meant that after activating with the shared FRPB-TEST-* key the
 * published test string appeared in the box on every launch and looked
 * hardcoded. A previously activated key is still offered, but only behind an
 * explicit "use previous key" action the user has to click.
 */
export default function ActivationScreen({ cached, onActivated }: ActivationScreenProps) {
  // Deliberately empty: never seeded from the cache, never hardcoded.
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [activated, setActivated] = useState<LicenseProfile | null>(null);

  // Saved key from a previous activation on this machine, offered as an
  // opt-in convenience rather than being written into the field automatically.
  const previousKey = cached?.key ?? "";
  const canOfferPreviousKey =
    previousKey.length > 0 && key.length === 0 && !verifying && !activated;

  // Dev-only hint: the master test key exists solely for local browser preview
  // (Vite dev server without Electron). `import.meta.env.DEV` is statically
  // replaced by Vite — in production builds it evaluates to `false`, so this
  // branch (and the test key string it references) is eliminated entirely and
  // never reaches an end user's bundle.
  const showTestKeyHint = import.meta.env.DEV && isWebPreviewMode();

  async function handleVerify() {
    const trimmed = key.trim().toUpperCase().replace(/\s+/g, "");
    if (!trimmed) {
      setError("Enter your FRPB license key to continue.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await window.frpb.license.verify(trimmed);
      if (res.success && res.license) {
        setActivated(res.license);
        setTimeout(() => onActivated(res.license!), 650);
      } else {
        // Prefer the server's message but always route it through the
        // technical-detail guard so a raw URL can never reach the banner.
        setError(
          friendlyError(
            res.message ?? STATUS_MESSAGES[res.status] ?? "Activation failed."
          )
        );
      }
    } catch (err) {
      // A thrown IPC error is almost always transport-level (offline). Show the
      // user-friendly offline copy rather than the raw exception text.
      setError(
        err instanceof Error && err.message ? friendlyError(err.message) : OFFLINE_MESSAGE
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero-glow p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="FRPB"
            className="mb-4 h-14 w-14 rounded-2xl object-cover shadow-glow ring-1 ring-slate-900/5"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            FRPB Recovery
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Activate your license to unlock the recovery toolkit.
          </p>
        </div>

        {showTestKeyHint ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Web preview mode: use the master test key{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                {MASTER_TEST_KEY}
              </code>{" "}
              to explore the dashboard.
            </span>
          </div>
        ) : null}

        {/* Card */}
        <div className="frpb-card p-6">
          {activated ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
              <h2 className="text-lg font-semibold text-slate-900">License activated</h2>
              <p className="mt-1 text-sm text-slate-500">Opening FRPB Recovery…</p>
            </div>
          ) : (
            <>
              <label
                htmlFor="license-key"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                License key
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="license-key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerify();
                  }}
                  placeholder={LICENSE_PLACEHOLDER}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="frpb-input py-2.5 pl-10 pr-3 font-mono"
                />
              </div>

              {canOfferPreviousKey && (
                <button
                  type="button"
                  onClick={() => setKey(previousKey.toUpperCase())}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition hover:text-brand-700"
                >
                  <KeyRound className="h-3 w-3" />
                  Use the key activated on this machine previously
                </button>
              )}

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="frpb-btn-primary mt-4 w-full py-2.5"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Activate license"
                )}
              </button>

              <button
                onClick={() =>
                  window.frpb.links.openExternal("https://frpb.in/#pricing").catch(() => {})
                }
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Get a license
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          This device is bound to the license upon activation. Manage devices from your FRPB
          dashboard.
        </p>
      </div>
    </div>
  );
}
