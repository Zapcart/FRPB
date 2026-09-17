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
  /**
   * Health of the live tracker. The payment step is rendered ONLY while this is
   * "live": without a persisted order row there is nothing for the 3-second
   * poller or the UTR verifier to resolve, so showing a QR would invite payments
   * that can never be auto-verified.
   */
  const [tracking, setTracking] = useState<"idle" | "live" | "unavailable">("idle");
  /** Transient poll failures — drives the degraded badge + retry backoff. */
  const [trackingDegraded, setTrackingDegraded] = useState(false);
  const pollFailuresRef = useRef(0);
  const [pollFailures, setPollFailures] = useState(0);

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
    setTracking("idle");
    setTrackingDegraded(false);
    pollFailuresRef.current = 0;
    setPollFailures(0);
    try {
      // Two DISTINCT failure classes, handled and logged separately so a
      // production incident is unambiguous:
      //   • NETWORK — offline / DNS / CORS: fetch() itself rejects.
      //   • HTTP    — a 4xx/5xx arrives; the body may be JSON *or* a platform
      //               HTML error page, so parsing must not be assumed to work.
      let res: Response;
      try {
        res = await fetch("/api/v1/payment/create", {
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
      } catch (err) {
        console.error("[checkout/upi] NETWORK failure creating order:", err);
        setError("Could not reach the payment service. Check your connection and retry.");
        return;
      }

      // A bare Vercel/Next 500 or 503 returns text/html. An unguarded
      // res.json() throws a SyntaxError there, which the old catch-all then
      // reported to the customer as a connectivity problem — masking a genuine
      // server fault.
      let data: {
        success?: boolean;
        message?: string;
        code?: string;
        order?: CreatedOrder;
        upiUri?: string;
        intentUrls?: IntentUrls;
        persisted?: boolean;
      } = {};
      let bodyWasJson = true;
      try {
        data = await res.json();
      } catch {
        bodyWasJson = false;
      }

      if (!res.ok || !bodyWasJson || !data.success || !data.order || !data.upiUri) {
        console.error(
          "[checkout/upi] HTTP failure creating order — " +
            `status=${res.status} ` +
            `contentType=${res.headers.get("content-type") ?? "unknown"} ` +
            `json=${bodyWasJson} code=${data.code ?? "none"}`,
          data
        );
        // Only ever surface a message the server actually authored.
        setError(
          (bodyWasJson ? data.message : undefined) ??
            "We couldn't start the payment. Please try again in a moment."
        );
        return;
      }
      // LIVE TRACKING IS A HARD REQUIREMENT, not a nice-to-have.
      //
      // A non-persisted order has no database row, so BOTH the status poller and
      // POST /payment/verify are guaranteed to fail on it — verify returns 404
      // ("Order not found"). Previously the QR was still rendered with a soft
      // "you can still pay normally" notice, which produced the reported pair of
      // errors: "Live order tracking is temporarily unavailable" next to a
      // "Verification failed" on every UTR submit, after real money had moved.
      // Refuse the step up front so no unverifiable payment can be initiated.
      if (data.persisted === false) {
        setTracking("unavailable");
        setError(
          "Live order tracking is temporarily unavailable, so we can't take a payment right now. " +
            "No money has been sent — please retry in a moment."
        );
        return;
      }
      setOrder(data.order);
      setUpiUri(data.upiUri);
      setIntentUrls(data.intentUrls ?? null);
      setSecondsLeft(data.order.expiresInSeconds);
      setTracking("live");
    } catch (err) {
      // Should be unreachable — network and body-parse failures are handled
      // above. Kept as a final net so an unexpected throw cannot leave the UI
      // stuck on the "creating" spinner.
      console.error("[checkout/upi] UNEXPECTED failure creating order:", err);
      setTracking("idle");
      setError("Something went wrong starting the payment. Please retry.");
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

  // ── Real-time status polling (3s, exponential backoff under failure) ──────
  //
  // Previously a catch-all `catch {}` swallowed EVERY transport failure and a
  // non-ok response was never inspected at all — `data.success` was simply
  // undefined on a 404/500, so the tracker failed completely silently and the
  // page sat on "waiting for payment" forever. Now: 404 is terminal and
  // explicit, 5xx is counted and surfaces a visible degraded badge, and the
  // interval backs off to 15s so a hard outage does not hammer the API.
  useEffect(() => {
    if (!order || paid || expired || tracking !== "live") return;
    const orderId = order.orderId;

    let timer: number | undefined;
    let cancelled = false;

    const schedule = () => {
      // 3s while healthy; 6s → 12s → 15s (cap) as consecutive failures accrue.
      const failures = pollFailuresRef.current;
      const delay = failures === 0 ? 3000 : Math.min(3000 * 2 ** failures, 15000);
      timer = window.setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/v1/payment/status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );

        if (res.status === 404) {
          // Terminal: the order row genuinely does not exist. Retrying forever
          // only spun the UI.
          setTracking("unavailable");
          setError(
            "We lost track of this order. Please start a new payment. If you have already paid, " +
              "your UTR is recorded and support can activate the license for you."
          );
          return;
        }

        if (!res.ok) {
          pollFailuresRef.current += 1;
          setPollFailures(pollFailuresRef.current);
          if (pollFailuresRef.current >= 2) setTrackingDegraded(true);
          return;
        }

        pollFailuresRef.current = 0;
        setPollFailures(0);
        setTrackingDegraded(false);

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
        // Transport-level failure (offline, DNS, aborted request). Count it so
        // the badge appears and the interval backs off — never fail silently.
        pollFailuresRef.current += 1;
        setPollFailures(pollFailuresRef.current);
        if (pollFailuresRef.current >= 2) setTrackingDegraded(true);
      } finally {
        if (!cancelled) schedule();
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [order, paid, expired, tracking, router]);

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

      // Parse defensively. An unhandled server exception returns an HTML 500
      // body, and `res.json()` throwing here was swallowed by the outer catch —
      // which is exactly what turned a server-side DB fault into the misleading
      // "Verification failed. Please check your connection and retry."
      let data: {
        success?: boolean;
        status?: string;
        message?: string;
        licenseKey?: string;
        grantFailed?: boolean;
      } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setError(
          "Verification failed on our side (server error). Your payment is not lost — please retry, " +
            "or contact support with your UTR."
        );
        return;
      }

      // 404 = the order row is gone. Retrying cannot help; say so precisely
      // instead of blaming the customer's connection.
      if (res.status === 404) {
        setTracking("unavailable");
        setError(
          data.message ??
            "We couldn't find that order. Please start a new payment — if you have already paid, contact support with your UTR."
        );
        return;
      }

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
      // Do not claim the license is active when minting failed on the server —
      // the customer would be told to expect a key that never arrives.
      setNotice(
        data.grantFailed
          ? "Payment verified — finalising your license. Redirecting to your dashboard…"
          : "Payment verified — your license is active. Redirecting…"
      );
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
      // Only reached for genuine transport failures now that the response body
      // is parsed defensively above.
      setError(
        "We couldn't reach the server to verify this UTR. Check your connection and retry — your payment is safe."
      );
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
      {/* Gate on `tracking === "live"`: never invite a payment that the poller
          and the UTR verifier cannot resolve. */}
      {order && upiUri && !paid && tracking === "live" && (
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

      {trackingDegraded && !paid && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Live tracking is having trouble reaching the server — retrying automatically
          {pollFailures > 0 ? ` (attempt ${pollFailures})` : ""}.
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
