// FRPB — /checkout entry.
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway for
// every tier: there is no self-hosted UPI rail and no alternate gateway to
// branch on. Every plan settles in USD, so there is no display-currency branch.
// The page resolves the plan from the query string and pre-fills the signed-in
// email when present.
//
// FAIL-SAFE AUTH: this page never throws on a missing/unreachable auth
// dependency. It uses `getOptionalUser()`, which returns null instead of
// throwing, so a Supabase outage or absent env var degrades to a normal
// signed-out checkout rather than a blocking "Checkout unavailable" screen.
//
// The `?plan=` contract is preserved because `@/lib/checkout/pending-plan`'s
// `checkoutUrlFor()` resumes the funnel here after a sign-in round trip.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { getOptionalUser } from "@/lib/supabase/server";
import CheckoutPanel from "@/components/checkout/checkout-panel";
import { pageMetadata } from "@/lib/seo";
import {
  REFERRAL_COOKIE_KEY,
  normalizeRefCode,
} from "@/lib/referral/ref-capture";

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

interface CheckoutPageProps {
  searchParams?: { plan?: string; currency?: string; ref?: string };
}

interface SearchParamsInput {
  /** Next.js may hand a single value or an array for a repeated query key. */
  [key: string]: string | string[] | undefined;
}

/** Collapse a possibly-array query value to a single trimmed string or null. */
function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

/**
 * Read the persisted referral code from the first-party cookie. Never throws:
 * an absent request-scope cookie store simply yields null (guest checkout).
 */
function readRefCookie(): string | null {
  try {
    return cookies().get(REFERRAL_COOKIE_KEY)?.value ?? null;
  } catch {
    return null;
  }
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  // Defensive: `searchParams` is untrusted and can be absent entirely.
  const params = (searchParams ?? {}) as SearchParamsInput;

  const rawPlan = firstParam(params.plan);
  const planSlug =
    rawPlan && PLAN_SLUGS.has(rawPlan) ? (rawPlan as PlanSlug) : null;

  // No valid plan → let the user pick one.
  if (!planSlug) {
    redirect("/pricing");
  }

  // Referral code from a share link (`?ref=`) — normalized so untrusted input
  // can never be echoed verbatim. When the query omits it (the common case for
  // a visitor who landed on the home page and browsed in), fall back to the
  // code persisted in the first-party cookie by the site-wide ReferralCapture.
  const referralCode =
    normalizeRefCode(firstParam(params.ref)) ??
    normalizeRefCode(readRefCookie());

  // Never throws: null simply means "guest checkout", which Razorpay supports.
  const user = await getOptionalUser();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-white px-6 py-16">
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-canvas-mesh" />
      <CheckoutPanel
        planSlug={planSlug}
        email={user?.email ?? null}
        referralCode={referralCode}
      />
    </main>
  );
}
