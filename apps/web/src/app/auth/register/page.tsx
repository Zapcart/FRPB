// FRPB — /auth/register alias.
//
// Dedicated sign-up entry nested under /auth so share links of the form
// `/auth/register?ref=CODE` resolve instead of 404ing. Delegates to the shared
// auth shell/form in signup mode and forwards any `?ref=` code so the site-wide
// ReferralCapture island can persist it for checkout attribution.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";
import { normalizeRefCode } from "@/lib/referral/ref-capture";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Registration form — private, keep out of the index.
export const metadata = {
  ...pageMetadata({
    title: "Create account",
    description:
      "Create an FRPB account to activate licenses and manage bound devices.",
    path: "/auth/register",
  }),
  robots: { index: false, follow: false },
};

interface AuthRegisterPageProps {
  searchParams?: {
    returnTo?: string;
    callbackUrl?: string;
    plan?: string;
    ref?: string;
  };
}

export default async function AuthRegisterPage({
  searchParams,
}: AuthRegisterPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  // Normalize the referral code so untrusted query input is never echoed
  // verbatim; the capture island on this route persists it for checkout.
  const ref = normalizeRefCode(searchParams?.ref);

  return (
    <AuthShell>
      <AuthView
        initialMode="signup"
        returnTo={returnTo}
        selectedPlan={searchParams?.plan ?? null}
        referralCode={ref}
      />
    </AuthShell>
  );
}
