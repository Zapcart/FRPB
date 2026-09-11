// FRPB — /login alias (blueprint fix 7).
// Dedicated sign-in entry; supports ?returnTo= and ?callbackUrl=.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: {
    returnTo?: string;
    callbackUrl?: string;
    redirectTo?: string;
    plan?: string;
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Accept `redirectTo` (preferred) as well as the legacy `returnTo`/`callbackUrl`.
  const base = safeReturnTo(
    searchParams?.redirectTo ??
      searchParams?.returnTo ??
      searchParams?.callbackUrl
  );

  // Preserve the selected plan across the post-login hop so the destination
  // (e.g. /checkout) can resume the exact purchase the user started.
  const plan = searchParams?.plan;
  let returnTo = base;
  if (plan) {
    const [path, existingQuery = ""] = base.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("plan", plan);
    returnTo = `${path}?${params.toString()}`;
  }

  return (
    <AuthShell>
      <AuthView initialMode="signin" returnTo={returnTo} />
    </AuthShell>
  );
}
