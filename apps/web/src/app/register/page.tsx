// FRPB — /register alias (blueprint fix 7).
// Dedicated sign-up entry (mode defaults to signup); supports ?returnTo= and
// ?callbackUrl=.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Registration form — private, keep out of the index.
export const metadata = {
  ...pageMetadata({
    title: "Create account",
    description:
      "Create a free FRPB account to activate licenses and manage bound devices.",
    path: "/register",
  }),
  robots: { index: false, follow: false },
};

interface RegisterPageProps {
  searchParams?: { returnTo?: string; callbackUrl?: string };
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  return (
    <AuthShell>
      <AuthView initialMode="signup" returnTo={returnTo} />
    </AuthShell>
  );
}
