// FRPB — Direct UPI checkout (self-hosted, zero-MDR).
//
// The customer experience for the direct-UPI rail:
//   1. Pick one of the three fixed plans (₹1,900 / ₹4,900 / ₹9,999).
//   2. Desktop → a dynamic QR code encoding the NPCI UPI URI + a 10-minute
//      countdown. Mobile web → "Pay with PhonePe / Google Pay / Paytm" buttons
//      that fire the matching native app intent URL.
//   3. Pay, then paste the 12-digit UPI reference (UTR/RRN) and hit
//      "Verify Payment".
//   4. A 3-second status poll redirects to /dashboard?payment=success the moment
//      the backend confirms PAID.
//
// The amount is NEVER sent from here in a way the server trusts — the create
// endpoint resolves the price from its own plan table.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { formatDualInr, getDualPlan } from "@/config/plans";
import type { UpiPlanId } from "@/lib/upi";

/**
 * Fixed direct-UPI plans for display — amounts are sourced from DUAL_PLANS via
 * config/plans so the INR tiers have a single definition (₹1,900 / ₹4,900 /
 * ₹9,999). The server re-resolves every amount; these values are presentational.
 */
const PLANS = (
  [
    { planId: "MONTHLY", tag: "Starter" },
    { planId: "YEARLY", tag: "Best value" },
    { planId: "LIFETIME", tag: "Forever" },
  ] as const
).map((p) => {
  const plan = getDualPlan(p.planId === "MONTHLY" ? "MONTH_1" : p.planId === "YEARLY" ? "YEAR_1" : "LIFETIME");
  return {
    planId: p.planId as UpiPlanId,
    tag: p.tag,
    name: plan?.name ?? p.planId,
    amount: plan?.inr ?? 0,
  };
});

type PlanId = UpiPlanId;

interface CreatedOrder {
  orderId: string;
  planId: PlanId;
  planName: string;
  amount: number;
  expiresInSeconds: number;
}

interface IntentUrls {
  generic: string;
  phonepe: string;
  gpay: string;
  paytm: string;
}

interface DirectUpiCheckoutProps {
  /** Buyer email when the visitor is signed in (prefills the field). */
  defaultEmail?: string | null;
  /** Plan to pre-select, when arriving from the payment-method modal. */
  initialPlanId?: UpiPlanId | null;
}

/** Mobile-browser detection (client only) — decides QR vs intent buttons. */
function detectMobile(ua: string): boolean {
  return /android|iphone|ipad|ipod|mobile|phonepe|paytm|tez/i.test(ua);
}

export default function DirectUpiCheckout({
  defaultEmail = null,
  initialPlanId = null,
}: DirectUpiCheckoutProps) {
  const router = useRouter();

  const [planId, setPlanId] = useState<PlanId>(initialPlanId ?? "YEARLY");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [upiUri, setUpiUri] = useState<string | null>(null);
  const [intentUrls, setIntentUrls] = useState<IntentUrls | null>(null);
  const [utr, setUtr] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const plan = useMemo(() => PLANS.find((p) => p.planId === planId)!, [planId]);

  // Detect mobile after mount to avoid an SSR/client hydration mismatch.
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMobile(detectMobile(navigator.userAgent));
    }
  }, []);

  // ── Create the order + build the UPI URI ──────────────────────────────────
  const createOrder = useCallback(async () => {
    setError(null);
    setNotice(null);
    setCreating(true);
    setUtr("");
    setCopied(false);
    try {
      const res = await fetch("/api/v1/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId,
          // Only sent for the buyer's convenience; the server re-derives the
          // authoritative email from the session when one exists.
          userEmail: email.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        order?: CreatedOrder;
        upiUri?: string;
        intentUrls?: IntentUrls;
        persisted?: boolean;
      };
      if (!res.ok || !data.success || !data.order || !data.upiUri) {
        setError(data.message ?? "Could not start the payment. Please try again.");
        return;
      }
      setOrder(data.order);
      setUpiUri(data.upiUri);
      setIntentUrls(data.intentUrls ?? null);
      setSecondsLeft(data.order.expiresInSeconds);
      // A non-persisted order still works — the payment settles to the VPA and
      // the UTR verification reconciles it. Tell the customer so the missing
      // live status polling is expected rather than looking like a stall.
      if (data.persisted === false) {
        setNotice(
          "Live order tracking is temporarily unavailable — you can still pay normally. " +
            "After paying, enter your UTR below to activate your license."
        );
      }
    } catch {
      setError("Could not reach the payment service. Check your connection and retry.");
    } finally {
      setCreating(false);
    }
  }, [planId, email]);

  // ── 10-minute countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!order || paid) return;
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [order, paid, secondsLeft]);

  const expired = Boolean(order) && secondsLeft <= 0 && !paid;

  // ── Real-time status polling (every 3s) ───────────────────────────────────
  useEffect(() => {
    if (!order || paid || expired) return;
    const orderId = order.orderId;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/v1/payment/status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          success?: boolean;
          status?: string;
          licenseId?: string | null;
        };
        if (!data.success) return;
        if (data.status === "PAID") {
          setPaid(true);
          setNotice("Payment confirmed! Redirecting to your dashboard…");
          // Complete through the unified callback so license activation and the
          // final redirect match the PayGlocal rail exactly.
          window.setTimeout(
            () =>
              router.push(
                `/api/v1/payment/callback?provider=upi&orderId=${encodeURIComponent(
                  orderId
                )}`
              ),
            900
          );
        } else if (data.status === "EXPIRED") {
          setSecondsLeft(0);
          setError("This order expired after 10 minutes. Please start a new payment.");
        }
      } catch {
        // Transient network hiccup — the next tick retries.
      }
    };

    const timer = window.setInterval(() => void poll(), 3000);
    void poll();
    return () => window.clearInterval(timer);
  }, [order, paid, expired, router]);

  // ── Manual UTR verification ───────────────────────────────────────────────
  const verifyPayment = useCallback(async () => {
    if (!order) return;
    setError(null);
    setNotice(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/v1/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.orderId, utrNumber: utr.trim() }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        status?: string;
        message?: string;
        licenseKey?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.message ?? "We couldn't verify that UPI reference.");
        return;
      }
      if (data.licenseKey) {
        try {
          window.sessionStorage.setItem("frpb.lastLicenseKey", data.licenseKey);
        } catch {
          // Session storage may be unavailable; the key is also emailed.
        }
      }
      setPaid(true);
      setNotice("Payment verified — your license is active. Redirecting…");
      // Route through the unified callback so activation + redirect are shared
      // with the PayGlocal rail.
      window.setTimeout(
        () =>
          router.push(
            `/api/v1/payment/callback?provider=upi&orderId=${encodeURIComponent(
              order.orderId
            )}&utr=${encodeURIComponent(utr.trim())}`
          ),
        900
      );
    } catch {
      setError("Verification failed. Please check your connection and retry.");
    } finally {
      setVerifying(false);
    }
  }, [order, utr, router]);

  const copyVpa = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("alixpay@axl");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the VPA is always visible on screen.
    }
  }, []);

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60
  ).padStart(2, "0")}`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ── Step 1 — choose a plan ─────────────────────────────────────────── */}
      <section className="card p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Direct UPI Checkout</h1>
            <p className="text-xs text-slate-500">
              Pay straight to our merchant VPA — no aggregator, instant activation.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => {
            const active = p.planId === planId;
            return (
              <button
                key={p.planId}
                type="button"
                onClick={() => {
                  setPlanId(p.planId);
                  setOrder(null);
                  setUpiUri(null);
                  setIntentUrls(null);
                  setError(null);
                  setNotice(null);
                }}
                disabled={creating || paid}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                  active
                    ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200"
                    : "border-slate-200 bg-white hover:border-brand-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {p.tag}
                  </span>
                  {active && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{p.name}</div>
                <div className="mt-0.5 text-xl font-extrabold text-slate-900">
                  {formatDualInr(p.amount)}
                </div>
              </button>
            );
          })}
        </div>

        <label
          htmlFor="upi-email"
          className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Email for license delivery
        </label>
        <input
          id="upi-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={creating || paid}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
        />

        <button
          type="button"
          onClick={() => void createOrder()}
          disabled={creating || paid || (!order && !email.trim())}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating payment request…
            </>
          ) : order ? (
            "Regenerate payment request"
          ) : (
            `Pay ${formatDualInr(plan.amount)} via UPI`
          )}
        </button>
      </section>

      {/* ── Step 2 — pay ───────────────────────────────────────────────────── */}
      {order && upiUri && !paid && (
        <section className="card mt-5 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              {expired ? "Expired" : `Expires in ${mmss}`}
            </span>
            <span className="text-xs text-slate-400">
              Order <span className="font-mono text-slate-600">{order.orderId}</span>
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Amount</span>
              <span className="font-bold text-slate-900">
                {formatDualInr(order.amount)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-slate-600">Merchant VPA</span>
              <button
                type="button"
                onClick={() => void copyVpa()}
                className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-brand-700"
              >
                alixpay@axl
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : ""}
              </button>
            </div>
          </div>

          {/* Desktop → dynamic QR. Mobile → native app intent buttons. */}
          {isMobile ? (
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {intentUrls && (
                <>
                  <IntentButton href={intentUrls.phonepe} label="PhonePe" tone="purple" />
                  <IntentButton href={intentUrls.gpay} label="Google Pay" tone="blue" />
                  <IntentButton href={intentUrls.paytm} label="Paytm" tone="sky" />
                </>
              )}
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <QRCodeSVG value={upiUri} size={208} level="M" includeMargin />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <Smartphone className="h-3.5 w-3.5" />
                Scan with any UPI app — PhonePe, Google Pay, Paytm, BHIM.
              </p>
            </div>
          )}

          {/* Manual UTR verification */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <label
              htmlFor="upi-utr"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Already paid? Enter your 12-digit UPI Ref / UTR
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="upi-utr"
                inputMode="numeric"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 412345678901"
                disabled={verifying || expired}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm tracking-wider text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => void verifyPayment()}
                disabled={verifying || expired || utr.replace(/\D/g, "").length < 12}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify Payment"
                )}
              </button>
            </div>
          </div>

          <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your license activates automatically the moment your UPI reference is
            confirmed. Every payment can be claimed exactly once.
          </p>
        </section>
      )}

      {/* ── Status / errors ───────────────────────────────────────────────── */}
      {paid && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <BadgeCheck className="h-4 w-4" />
          Payment confirmed — taking you to your dashboard…
        </div>
      )}

      {notice && !paid && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** A single native-app payment button. */
function IntentButton({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "purple" | "blue" | "sky";
}) {
  const tones: Record<typeof tone, string> = {
    purple: "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    sky: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
  };
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${tones[tone]}`}
    >
      <Wallet className="h-4 w-4" />
      Pay with {label}
    </a>
  );
}
