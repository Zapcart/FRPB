// FRPB — dashboard referrals
// Server component: resolves the signed-in user's email, then renders the
// referral engine (unique share link + gamified unlock progress + VIP cash hub).
//
// This is the dedicated surface required so authenticated users can grab their
// unique referral URL from a stable, linkable route (`/dashboard/referrals`)
// rather than an in-page anchor on the dashboard home.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import ReferralDashboardPanel from "@/components/referral/ReferralDashboardPanel";

// Private, authenticated surface — never indexed by search engines.
export const metadata = {
  ...pageMetadata({
    title: "Refer & Earn",
    description:
      "Share your unique FRPB referral link, track unlock progress and manage your VIP cash affiliate earnings.",
    path: "/dashboard/referrals",
  }),
  robots: { index: false, follow: false },
};

// Session work — never statically prerender this route.
export const dynamic = "force-dynamic";

export default async function DashboardReferralsPage() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // The dashboard layout gates auth too, but defence-in-depth: a direct server
  // render (or a layout bypass) must never expose the referral surface.
  if (!authUser) {
    const headerStore = headers();
    const requestedPath = headerStore.get("x-pathname");
    const returnTo =
      requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/dashboard/referrals";
    redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const email = authUser.email ?? "";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
          <Share2 className="h-3.5 w-3.5" /> Refer & Earn
        </div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Your referral dashboard
        </h2>
        <p className="max-w-2xl text-sm text-slate-500">
          Copy your unique link below and share it. Invited friends get 20% off, and you earn
          recurring cash on every successful activation.
        </p>
      </header>

      {/* Referral engine: unique share link + gamified unlock progress + VIP cash hub. */}
      <ReferralDashboardPanel email={email} />
    </div>
  );
}
