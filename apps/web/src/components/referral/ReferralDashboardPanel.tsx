// FRPB — dashboard referral surface (gamified unlock + VIP cash affiliate hub).
//
// An always-visible dashboard card that mirrors the ReferralModal content inline
// so users see their live battery progress + earnings without opening a dialog.
//
// Server-authoritative by design: every qualification, commission and payout
// eligibility decision is recomputed by the backend. This component is a pure
// view over GET /api/v1/referral/me and POST /api/v1/referral/payout.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BatteryCharging,
  Check,
  Clock,
  Copy,
  Gift,
  Loader2,
  Share2,
  Sparkles,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { startRazorpayCheckout } from "@/lib/razorpay/checkout-flow";

/* ------------------------------------------------------------------ types */

interface RouteRequirement {
  current: number;
  required: number;
}

interface RouteProgress {
  route: "ROUTE_A" | "ROUTE_B";
  monthly: RouteRequirement;
  lifetime: RouteRequirement;
  percent: number;
  complete: boolean;
}

interface UnlockProgress {
  monthlyCount: number;
  lifetimeCount: number;
  routeA: RouteProgress;
  routeB: RouteProgress;
  percent: number;
  unlocked: boolean;
  unlockRoute: "ROUTE_A" | "ROUTE_B" | null;
  downsellEligible: boolean;
}

interface ReferralSummary {
  userId: string;
  code: string | null;
  link: string | null;
  isLifetimeUnlocked: boolean;
  unlockRoute: string | null;
  unlockedAt: string | null;
  progress: UnlockProgress;
  cashBalanceCents: number;
  pendingCashCents: number;
  lifetimeCashCents: number;
  payoutMinCents: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface ReferralDashboardPanelProps {
  /** Signed-in buyer email (prefilled on the downsell checkout). */
  email?: string | null;
}

type Feedback = { kind: "success" | "error"; text: string } | null;

/* --------------------------------------------------------------- helpers */

/** Format integer cents as a fixed USD string (e.g. 7500 → "$75.00"). */
function formatUsd(cents: number): string {
  const value = Number.isFinite(cents) ? cents : 0;
  return `$${(value / 100).toFixed(2)}`;
}

/** Fetch a JSON envelope, returning `data` only on a successful response. */
async function fetchJson<T>(input: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, init);
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.success) {
      console.error("[referral/panel] request rejected:", response.status, payload);
      return null;
    }
    return (payload.data ?? null) as T | null;
  } catch (err) {
    console.error("[referral/panel] request threw:", input, err);
    return null;
  }
}

/** Render the Dr.Fone-style battery string: [ ▓▓▓▓▓░░░░░ ] 50% Unlocked. */
function batteryBar(percent: number, segments = 10): string {
  const cells = Math.max(1, Math.floor(segments));
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((pct / 100) * cells);
  return `[${"▓".repeat(filled)}${"░".repeat(cells - filled)}] ${pct}% Unlocked`;
}

/* ----------------------------------------------------------- sub-views */

function ProgressRow({
  label,
  current,
  required,
  done,
}: {
  label: string;
  current: number;
  required: number;
  done: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-slate-600">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
          }`}
          aria-hidden="true"
        >
          {done ? <Check className="h-3 w-3" /> : ""}
        </span>
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${
          done ? "text-emerald-600" : "text-slate-500"
        }`}
      >
        {Math.min(current, required)} / {required}
      </span>
    </li>
  );
}

/* --------------------------------------------------------------- panel */

export default function ReferralDashboardPanel({ email }: ReferralDashboardPanelProps) {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Payout form state.
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  const [destination, setDestination] = useState("");
  const [payoutFeedback, setPayoutFeedback] = useState<Feedback>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const data = await fetchJson<{ summary: ReferralSummary }>("/api/v1/referral/me");
    if (!data?.summary) {
      setLoadError("We couldn't load your referral progress. Please try again later.");
      setLoading(false);
      return;
    }
    setSummary(data.summary);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const progress = summary?.progress;

  async function handleCopyLink() {
    if (!summary?.link) return;
    try {
      await navigator.clipboard.writeText(summary.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[referral/panel] clipboard write failed:", err);
      setFeedback({ kind: "error", text: "Couldn't copy — select the link manually." });
    }
  }

  async function handleDownsell() {
    setBusy(true);
    setFeedback(null);
    const result = await startRazorpayCheckout({
      planSlug: "LIFETIME",
      email: email ?? null,
      downsell: true,
    });
    if (result.status === "paid") {
      await loadSummary();
      setFeedback({
        kind: "success",
        text: "Lifetime unlocked at the $75 partial-credit price. Welcome to the VIP hub!",
      });
    } else if (result.status === "failed") {
      setFeedback({ kind: "error", text: result.message });
    }
    setBusy(false);
  }

  async function handlePayout(event: React.FormEvent) {
    event.preventDefault();
    setPayoutFeedback(null);

    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setPayoutFeedback({ kind: "error", text: "Enter a valid payout amount." });
      return;
    }
    const amountCents = Math.floor(dollars * 100);

    setBusy(true);
    const data = await fetchJson<{ payoutId: string; balanceCents: number }>(
      "/api/v1/referral/payout",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          method,
          destination: destination.trim() || undefined,
        }),
      }
    );
    setBusy(false);

    if (!data) {
      setPayoutFeedback({
        kind: "error",
        text: "Payout request could not be processed. Check your balance and try again.",
      });
      return;
    }
    setAmount("");
    setDestination("");
    setPayoutFeedback({
      kind: "success",
      text: `Payout requested. Remaining balance: ${formatUsd(data.balanceCents)}.`,
    });
    await loadSummary();
  }

  const unlocked = summary?.isLifetimeUnlocked ?? false;
  const percent = progress?.percent ?? 0;
  const downsellEligible = progress?.downsellEligible ?? false;

  return (
    <section
      id="referral"
      aria-label="Referral rewards"
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-indigo-950 px-5 py-5 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
          <Share2 className="h-3.5 w-3.5" /> Referral Engine
        </div>
        <h2 className="mt-1 text-lg font-bold leading-snug">
          {unlocked
            ? "Your VIP Cash Affiliate Hub"
            : "Refer Friends & Unlock 100% FREE $150 Lifetime Plan"}
        </h2>
        <p className="mt-1 text-sm text-blue-100/90">
          {unlocked
            ? "You're unlocked. Earn recurring cash on every future sale."
            : "Invited friends get 20% OFF the Lifetime Plan."}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        {loading && !summary ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your progress…
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : summary && progress ? (
          <>
            {/* Share link */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your referral link
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={summary.link ?? "Generating…"}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Your referral link"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!summary.link}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {!unlocked ? (
              <>
                {/* Battery progress bar */}
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BatteryCharging className="h-4 w-4 text-brand-600" />
                    Unlock Progress
                  </div>
                  <p
                    className="font-mono text-sm tracking-tight text-slate-900"
                    aria-label={`Progress ${percent} percent`}
                  >
                    {batteryBar(percent)}
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                    />
                  </div>
                </div>

                {/* Route checklists */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-xl border p-3 ${
                      progress.routeA.complete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Route A · 2 Lifetime
                    </p>
                    <ul className="space-y-1.5">
                      <ProgressRow
                        label="Lifetime users"
                        current={progress.routeA.lifetime.current}
                        required={progress.routeA.lifetime.required}
                        done={
                          progress.routeA.lifetime.current >= progress.routeA.lifetime.required
                        }
                      />
                    </ul>
                  </div>
                  <div
                    className={`rounded-xl border p-3 ${
                      progress.routeB.complete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200"
                    }`}
                  >
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Route B · 4 Monthly + 1 Lifetime
                    </p>
                    <ul className="space-y-1.5">
                      <ProgressRow
                        label="Monthly users"
                        current={progress.routeB.monthly.current}
                        required={progress.routeB.monthly.required}
                        done={progress.routeB.monthly.current >= progress.routeB.monthly.required}
                      />
                      <ProgressRow
                        label="Lifetime user"
                        current={progress.routeB.lifetime.current}
                        required={progress.routeB.lifetime.required}
                        done={
                          progress.routeB.lifetime.current >= progress.routeB.lifetime.required
                        }
                      />
                    </ul>
                  </div>
                </div>

                {/* Urgency badge */}
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    <strong>First 48 Hours Bonus:</strong> unlock within 48h to claim Priority
                    Support & a VIP Badge!
                  </span>
                </div>

                {/* Partial downsell credit */}
                {downsellEligible && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex items-start gap-2">
                      <Gift className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-indigo-900">
                          You&rsquo;re 1 referral away — claim Lifetime now for $75
                        </p>
                        <p className="mt-1 text-xs text-indigo-700">
                          Apply your 50% partial-credit downsell. Your $150 Lifetime Plan unlocks
                          immediately at the reduced price of <strong>$75</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={handleDownsell}
                          disabled={busy}
                          className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          Claim Lifetime for $75
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {feedback && (
                  <div
                    className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                      feedback.kind === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {feedback.kind === "success" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{feedback.text}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* VIP Cash Affiliate Hub */}
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Trophy className="h-4 w-4" /> Lifetime unlocked via{" "}
                  {progress.unlockRoute ?? summary.unlockRoute ?? "your referrals"}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Available cash
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {formatUsd(summary.cashBalanceCents)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pending (14-day lock)
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {formatUsd(summary.pendingCashCents)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Lifetime earned
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                      {formatUsd(summary.lifetimeCashCents)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Wallet className="h-3.5 w-3.5" /> Commission rates
                  </p>
                  <p className="mt-1">Future Monthly sales → 30% recurring cash ($6/mo)</p>
                  <p>Future Lifetime sales → 50% upfront cash ($75 per sale)</p>
                  <p className="mt-1 flex items-center gap-1.5 text-slate-400">
                    <Clock className="h-3 w-3" /> Credits stay PENDING for 14 days
                    (refund/cancellation lock) before release.
                  </p>
                </div>

                {/* Payout request */}
                <form onSubmit={handlePayout} className="space-y-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Wallet className="h-4 w-4 text-brand-600" /> Request a payout
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">Amount (USD)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="50.00"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">Method</span>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="UPI">UPI</option>
                        <option value="PAYPAL">PayPal</option>
                        <option value="BANK">Bank transfer</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">Destination</span>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="you@upi / email"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">
                    Minimum payout: {formatUsd(summary.payoutMinCents)}.
                  </p>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    Request payout
                  </button>
                  {payoutFeedback && (
                    <div
                      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                        payoutFeedback.kind === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {payoutFeedback.kind === "success" ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{payoutFeedback.text}</span>
                    </div>
                  )}
                </form>
              </>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
