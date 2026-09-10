// FRPB — /login alias (blueprint fix 7).
// Dedicated sign-in entry; supports ?returnTo= and ?callbackUrl=.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: { returnTo?: string; callbackUrl?: string };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  return (
    <AuthShell>
      <AuthView initialMode="signin" returnTo={returnTo} />
    </AuthShell>
  );
}
