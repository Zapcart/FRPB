// FRPB — /register alias (blueprint fix 7).
// Dedicated sign-up entry (mode defaults to signup); supports ?returnTo= and
// ?callbackUrl=.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

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
