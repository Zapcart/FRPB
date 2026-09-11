// FRPB — /checkout entry (authenticated purchase hand-off).
// Server component: confirms the session, validates the requested plan, then
// mounts the client that starts the gateway checkout. Unauthenticated users
// are sent back to the login entry with the plan and this path preserved so
// the purchase resumes automatically after sign-in.

import { redirect } from "next/navigation";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "@/components/checkout/checkout-client";

export const dynamic = "force-dynamic";

const PLAN_SLUGS = new Set<string>(PLANS.map((plan) => plan.slug));

interface CheckoutPageProps {
  searchParams?: { plan?: string };
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const rawPlan = searchParams?.plan;
  const planSlug =
    rawPlan && PLAN_SLUGS.has(rawPlan) ? (rawPlan as PlanSlug) : null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → login, preserving the plan + post-auth destination.
  if (!user) {
    const query = new URLSearchParams({ redirectTo: "/checkout" });
    if (planSlug) query.set("plan", planSlug);
    redirect(`/auth/login?${query.toString()}`);
  }

  // Signed in but no valid plan → let the user pick one.
  if (!planSlug) {
    redirect("/pricing");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <CheckoutClient planSlug={planSlug} />
    </main>
  );
}
