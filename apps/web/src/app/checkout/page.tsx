// FRPB — /checkout entry.
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway for
// every tier: there is no self-hosted UPI rail and no alternate gateway to
// branch on. The page resolves the plan + display currency from the query
// string, keeps the funnel usable for signed-out buyers (Razorpay collects the
// payer email), and pre-fills the signed-in email when present.
//
// FAIL-SAFE AUTH: this page never throws on a missing/unreachable auth
// dependency. It uses `getOptionalUser()`, which returns null instead of
// throwing, so a Supabase outage or absent env var degrades to a normal
// signed-out checkout rather than a blocking "Checkout unavailable" screen.
//
// The `?plan=` / `?currency=` contract is preserved because
// `@/lib/checkout/pending-plan`'s `checkoutUrlFor()` resumes the funnel here
// after a sign-in round trip.

import { redirect } from "next/navigation";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { getOptionalUser } from "@/lib/supabase/server";
import CheckoutPanel from "@/components/checkout/checkout-panel";
import { pageMetadata } from "@/lib/seo";

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
  searchParams?: { plan?: string; currency?: string };
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const rawPlan = searchParams?.plan;
  const planSlug =
    rawPlan && PLAN_SLUGS.has(rawPlan) ? (rawPlan as PlanSlug) : null;

  // Preserve the customer's chosen display currency across the auth hop so the
  // amount shown matches what they saw on the pricing page.
  const rawCurrency = searchParams?.currency;
  const currency: "USD" | "INR" =
    rawCurrency && CURRENCIES.has(rawCurrency)
      ? (rawCurrency as "USD" | "INR")
      : "USD";

  // No valid plan → let the user pick one.
  if (!planSlug) {
    redirect("/pricing");
  }

  // Never throws: null simply means "guest checkout", which Razorpay supports.
  const user = await getOptionalUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <CheckoutPanel
        planSlug={planSlug}
        currency={currency}
        email={user?.email ?? null}
      />
    </main>
  );
}
