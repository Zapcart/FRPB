// FRPB — /checkout entry.
//
// Two rails, selected by currency:
//   • INR → the SELF-HOSTED Direct UPI engine (zero-MDR): the customer pays
//     straight to the merchant VPA via QR / native UPI app and the license is
//     granted on UTR verification. No sign-in is required to pay — the license
//     is bound to the email entered at checkout.
//   • USD → the authenticated gateway hand-off (CheckoutClient), which redirects
//     to the provider-hosted checkout and grants via webhook.
//
// FAIL-SAFE AUTH: this page never throws on a missing/unreachable auth
// dependency. It uses `getOptionalUser()`, which returns null instead of
// throwing, so a Supabase outage or absent env var degrades to a normal
// signed-out experience rather than the blocking "Checkout unavailable" screen.
// The self-hosted UPI rail in particular must never be blocked by an optional
// third-party service.

import { redirect } from "next/navigation";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { getOptionalUser } from "@/lib/supabase/server";
import CheckoutClient from "@/components/checkout/checkout-client";
import DirectUpiCheckout from "@/components/checkout/direct-upi-checkout";
import { getDualPlan } from "@/config/plans";
import { pageMetadata } from "@/lib/seo";
import type { UpiPlanId } from "@/lib/upi";

export const dynamic = "force-dynamic";

// Purchase hand-off — transactional, never indexed.
export const metadata = {
  ...pageMetadata({
    title: "Checkout",
    description: "Complete your FRPB license purchase.",
    path: "/checkout",
  }),
  robots: { index: false, follow: false },
};

const PLAN_SLUGS = new Set<string>(PLANS.map((plan) => plan.slug));
const CURRENCIES = new Set<string>(["USD", "INR"]);

interface CheckoutPageProps {
  searchParams?: { plan?: string; currency?: string; method?: string };
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const rawPlan = searchParams?.plan;
  const planSlug =
    rawPlan && PLAN_SLUGS.has(rawPlan) ? (rawPlan as PlanSlug) : null;

  // Preserve the customer's chosen currency across the auth hop so the amount
  // charged matches the amount they were shown on the pricing page.
  const rawCurrency = searchParams?.currency;
  const currency: "USD" | "INR" =
    rawCurrency && CURRENCIES.has(rawCurrency) ? (rawCurrency as "USD" | "INR") : "USD";

  // `?method=upi` forces the direct-UPI rail regardless of currency.
  const wantsUpi = searchParams?.method === "upi" || currency === "INR";

  // Never throws: null simply means "treat this visitor as a guest".
  const user = await getOptionalUser();

  // ── Direct UPI rail (self-hosted, zero-MDR) ────────────────────────────────
  // Deliberately NOT gated behind sign-in: a buyer can pay from a direct link
  // and receive the license by email. The signed-in email (when present) is
  // prefilled for convenience. This branch is reached BEFORE any auth check so
  // it can never be blocked by an auth failure.
  if (wantsUpi) {
    const initialPlanId = (getDualPlan(planSlug ?? "")?.orderPlanId as
      | UpiPlanId
      | undefined) ?? null;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <DirectUpiCheckout
          defaultEmail={user?.email ?? null}
          initialPlanId={initialPlanId}
        />
      </main>
    );
  }

  // ── Gateway rail (USD) — requires a signed-in account ──────────────────────
  // Not signed in (or auth unavailable) → login, preserving plan + currency.
  if (!user) {
    const query = new URLSearchParams({ redirectTo: "/checkout" });
    if (planSlug) query.set("plan", planSlug);
    query.set("currency", currency);
    redirect(`/auth/login?${query.toString()}`);
  }

  // Signed in but no valid plan → let the user pick one.
  if (!planSlug) {
    redirect("/pricing");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <CheckoutClient planSlug={planSlug} currency={currency} />
    </main>
  );
}
