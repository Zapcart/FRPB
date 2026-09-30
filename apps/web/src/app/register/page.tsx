// FRPB — /register alias (blueprint fix 7).
// Dedicated sign-up entry (mode defaults to signup); supports ?returnTo= and
// ?callbackUrl=.

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
    path: "/register",
  }),
  robots: { index: false, follow: false },
};

interface RegisterPageProps {
  searchParams?: { returnTo?: string; callbackUrl?: string; ref?: string };
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  // Normalize the referral code so untrusted query input is never echoed
  // verbatim; the capture island on this route persists it for checkout.
  const ref = normalizeRefCode(searchParams?.ref);

  return (
    <AuthShell>
      <AuthView initialMode="signup" returnTo={returnTo} referralCode={ref} />
    </AuthShell>
  );
}
