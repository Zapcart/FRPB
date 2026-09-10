// FRPB — /auth entry (sign in / sign up).
// Server component: sanitizes the post-auth destination (accepts both
// `returnTo` and `callbackUrl`) and renders the shared auth shell/form.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

interface AuthPageProps {
  searchParams?: { returnTo?: string; callbackUrl?: string };
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  return (
    <AuthShell>
      <AuthView initialMode="signin" returnTo={returnTo} />
    </AuthShell>
  );
}
