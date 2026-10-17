// FRPB — pricing plan grid (client island).
//
// The ONLY interactive part of the pricing surface: the two plan cards, their
// purchase buttons and the inline Razorpay feedback. Everything else on
// /pricing (hero, value callout, trust badges, FAQ, JSON-LD, footer) renders in
// the Server Component so the full content ships in the initial HTML.
//
// Performance contract:
//   • No heavy SDK is bundled into the first paint. The Supabase browser client
//     (~120 kB with @supabase/supabase-js) is a dynamic import resolved on
//     hover/focus/touch or on the click itself, so /pricing first-load JS stays
//     near the shared framework chunk instead of 209 kB.
//   • Button flips to its spinner on the click's OWN task (before any await) so
//     the UI responds in ~0ms — no dependence on the auth chunk or round trip.
//   • The Razorpay order is pre-created on hover / touch-start / focus (once per
//     plan) so the modal opens without the create-order round trip. The warm
//     order lives in the checkout-flow module cache; startRazorpayCheckout picks
//     it up automatically and falls back to a fresh order if stale/missing.
//   • A failed purchase always surfaces an inline message + a Retry action.

"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  ArrowRight,
  Monitor,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { type PlanSlug } from "@frpb/shared";
import { DUAL_PLANS, formatDualUsd } from "@/config/plans";
import {
  startRazorpayCheckout,
  prefetchCheckoutOrder,
} from "@/lib/razorpay/checkout-flow";
import { readStoredReferralCode } from "@/lib/referral/ref-capture";
import { savePendingPlan } from "@/lib/checkout/pending-plan";
import { trackBeginCheckout } from "@/lib/analytics/gtag";
import { usePromoState } from "@/components/promo/usePromoState";
import { monthlyBillingSuffixFor, promoMonthlyDaysFor } from "@/config/promo";

/**
 * Deferred Supabase browser client.
 *
 * The module is imported at interaction time rather than at module scope so
 * `@supabase/ssr` + `@supabase/supabase-js` stay out of the /pricing first-load
 * bundle. The promise is memoized (including rejections, which are cleared so a
 * later attempt can retry) to guarantee at most one network fetch per session.
 */
let supabaseClientModule: Promise<
  typeof import("@/lib/supabase/client")
> | null = null;

function loadSupabaseClient() {
  if (!supabaseClientModule) {
    supabaseClientModule = import("@/lib/supabase/client").catch((error) => {
      // Reset so a transient chunk-load failure can recover on the next attempt.
      supabaseClientModule = null;
      console.error("[pricing] failed to load Supabase auth chunk:", error);
      throw error;
    });
  }
  return supabaseClientModule;
}

/**
 * The grid renders from DUAL_PLANS (the authoritative tier rates) rather than
 * the shared legacy PLANS, so the displayed price is always exactly $20 or
 * $200 — matching the USD amount Razorpay charges at checkout.
 */
const PLAN_CARDS = DUAL_PLANS.map((plan) => ({
  plan,
  slug: plan.slug,
  name: plan.name,
  features: plan.features,
  deviceLimit: plan.deviceLimit,
  durationDays: plan.durationDays,
}));

export default function PricingPlanGrid() {
  const router = useRouter();
  // Live promo status — drives the MONTH_1 billing suffix and duration copy.
  // Seeded statically for SSR/first paint, then refined after mount.
  const promo = usePromoState();
  // Plan currently being paid for (null = idle) — drives the button spinner.
  const [processingPlan, setProcessingPlan] = useState<PlanSlug | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  // Once-per-plan warm guard so hover/touch storms cannot spam the orders API.
  const warmedRef = useRef<Set<string>>(new Set());
  // Last attempted plan — lets the Retry action re-run the exact same purchase.
  const lastAttemptRef = useRef<PlanSlug | null>(null);

  /**
   * Pre-create the Razorpay order ahead of the click. Fire-and-forget, never
   * blocks the UI, and deduped per plan by both this ref and the module cache.
   */
  const warmOrder = useCallback((planSlug: PlanSlug) => {
    if (warmedRef.current.has(planSlug)) return;
    warmedRef.current.add(planSlug);
    // Fetch the deferred auth chunk alongside the order prefetch so the module
    // is already parsed by the time the buyer taps. Errors are swallowed here
    // (handlePurchase re-attempts and reports them properly).
    void loadSupabaseClient().catch(() => undefined);
    void prefetchCheckoutOrder({
      planSlug,
      referralCode: readStoredReferralCode(),
    });
  }, []);

  /**
   * "Choose plan" / "Get lifetime access" → start the purchase funnel.
   *
   * Payments are USD-only and gated behind authentication: an unauthenticated
   * visitor is sent to the sign-up form with the selected plan attached, and the
   * pending-plan helper resumes checkout automatically once they are signed in.
   * Authenticated buyers go straight to the Razorpay Standard Web Checkout
   * modal, where the order is created server-side (amount locked to the USD tier
   * rate) and the captured signature is verified before any license is granted.
   */
  async function handlePurchase(planSlug: PlanSlug) {
    if (processingPlan) return;
    lastAttemptRef.current = planSlug;

    // ── Synchronous, network-free work FIRST ────────────────────────────────
    // These run on the click's own task, so React flips the button to its
    // spinner before ANY await yields to the event loop — the UI responds in
    // ~0ms and never waits on the auth round trip or order creation below.
    setCheckoutError(null);
    setCheckoutNotice(null);
    setProcessingPlan(planSlug);
    savePendingPlan(planSlug, "USD");

    // GA4 `begin_checkout` — fired on the click's own task (before any await),
    // so the event is queued even when the guest is redirected to /auth. The
    // helper no-ops safely on the server / before the tag loads.
    trackBeginCheckout({ plan: planSlug });

    // ── Single cached session read ──────────────────────────────────────────
    // getSession() is the one optimized call: the browser client hydrates the
    // session snapshot from cookies/local storage, so a signed-in buyer resolves
    // WITHOUT a network hop.
    let email: string | null = null;
    try {
      // Dynamic import: keeps the ~120 kB Supabase stack out of the /pricing
      // first load. The spinner is already rendering (set above), so this
      // resolves entirely behind the "Opening Secure Gateway…" state.
      const { createClient } = await loadSupabaseClient();
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      email = sessionData.session?.user?.email ?? null;
    } catch {
      email = null;
    }

    // Guests must authenticate before paying — never open the gateway without an
    // account. Redirect to the sign-up form; AuthView reads the pending plan and
    // resumes checkout for this exact plan once signup/sign-in succeeds.
    if (!email) {
      setProcessingPlan(null);
      const params = new URLSearchParams({
        mode: "signup",
        plan: planSlug,
        returnTo: "/checkout",
      });
      router.push(`/auth?${params.toString()}`);
      return;
    }

    // startRazorpayCheckout() is contractually non-throwing, but wrap it so an
    // unexpected error (loader rejection, provider SDK edge case) can never
    // leave the button stuck on its spinner or bubble into the React tree. Every
    // click resolves to a visible state via the finally block below.
    try {
      // The referral code (cookie/localStorage, 30-day window) is carried into
      // checkout so the server can apply the sanctioned discount. startRazorpay-
      // Checkout reads any warm order from the module cache, so no network hop is
      // needed here when the button was hovered/tapped first.
      const result = await startRazorpayCheckout({
        planSlug,
        email,
        referralCode: readStoredReferralCode(),
        onDismiss: () =>
          setCheckoutNotice("Checkout closed — no payment was taken."),
      });

      if (result.status === "paid") {
        setCheckoutNotice(
          "Payment successful — taking you to your dashboard…"
        );
        router.push("/dashboard");
        return;
      }

      if (result.status === "failed") {
        setCheckoutError(result.message);
      }
    } catch (error) {
      console.error("[pricing] checkout failed unexpectedly:", error);
      setCheckoutError(
        "We couldn't start checkout. Please try again in a moment."
      );
    } finally {
      // Always release the spinner, including on the paid path before navigating.
      setProcessingPlan(null);
    }
  }

  return (
    <>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 grid-cols-1 md:grid-cols-2">
        {PLAN_CARDS.map((card) => {
          const popular = card.slug === "LIFETIME";
          // Promo-aware billing suffix (MONTH_1 only) and duration line; both
          // derive from the same `promo.active` boolean so they can never
          // disagree.
          const billingSuffix =
            card.slug === "MONTH_1"
              ? monthlyBillingSuffixFor(promo.active)
              : "one-time";
          const durationLabel =
            card.slug === "MONTH_1"
              ? `${promoMonthlyDaysFor(promo.active)} days`
              : "Lifetime access";
          return (
            <div
              key={card.slug}
              className={`glass-panel-strong relative flex flex-col p-8 transition duration-300 hover:-translate-y-1 ${
                popular
                  ? "border-brand-300 ring-1 ring-brand-500/20 hover:shadow-glass-light-hover"
                  : "hover:border-white/80 hover:shadow-glass-light-hover"
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
                  MOST POPULAR · RECOMMENDED FOR SHOPS
                </span>
              )}
              <h2 className="text-xl font-bold text-slate-900">{card.name}</h2>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-black tracking-tight text-ink">
                  {formatDualUsd(card.plan.usd)}
                </span>
                <span className="text-sm font-medium text-slate-400">
                  {billingSuffix}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {card.deviceLimit} device{card.deviceLimit === 1 ? "" : "s"} ·{" "}
                {durationLabel}
              </p>

              {/* Tier benefit clarifiers: activations, license duration and
                  update entitlement spelled out so buyers never have to guess
                  what each plan includes. */}
              <ul className="mt-4 grid grid-cols-1 gap-1.5 text-xs font-medium text-slate-500 sm:grid-cols-3">
                <li className="inline-flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {card.deviceLimit} PC activation{card.deviceLimit === 1 ? "" : "s"}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {card.slug === "MONTH_1" ? durationLabel : "Lifetime license"}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  Free future updates
                </li>
              </ul>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-slate-600">
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        popular ? "bg-brand-500/10 text-brand-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void handlePurchase(card.slug)}
                onPointerEnter={() => warmOrder(card.slug)}
                onFocus={() => warmOrder(card.slug)}
                onTouchStart={() => warmOrder(card.slug)}
                disabled={processingPlan !== null}
                aria-busy={processingPlan === card.slug}
                className={`mt-8 inline-flex min-h-[48px] w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
                  popular
                    ? "bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {processingPlan === card.slug ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening Secure Gateway…
                  </>
                ) : (
                  <>
                    {card.slug === "LIFETIME" ? "Get lifetime access" : "Choose plan"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Payment-method trust row: reassures buyers that the checkout
                  accepts UPI and every major card/bank method via the Razorpay
                  gateway. */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">UPI</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Visa</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Mastercard</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Net Banking</span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Razorpay</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Razorpay checkout feedback — inline, with a Retry affordance on error */}
      {(checkoutError || checkoutNotice) && (
        <div
          role={checkoutError ? "alert" : "status"}
          className={`mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-xl border px-4 py-3 text-center text-sm ${
            checkoutError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <span>{checkoutError ?? checkoutNotice}</span>
          {checkoutError && lastAttemptRef.current && (
            <button
              type="button"
              onClick={() =>
                void handlePurchase(lastAttemptRef.current as PlanSlug)
              }
              className="inline-flex min-h-[36px] touch-manipulation items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>
      )}
    </>
  );
}
