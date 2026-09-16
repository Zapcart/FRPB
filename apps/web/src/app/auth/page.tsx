// FRPB — /auth entry (sign in / sign up).
// Server component: sanitizes the post-auth destination (accepts both
// `returnTo` and `callbackUrl`) and renders the shared auth shell/form.

import AuthShell from "@/components/auth/auth-shell";
import AuthView from "@/components/auth/auth-view";
import { safeReturnTo } from "@/lib/auth/return-to";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Auth form — private, keep out of the index.
export const metadata = {
  ...pageMetadata({
    title: "Sign in",
    description: "Sign in to your FRPB account to manage licenses and devices.",
    path: "/auth",
  }),
  robots: { index: false, follow: false },
};

interface AuthPageProps {
  searchParams?: {
    returnTo?: string;
    callbackUrl?: string;
    /** "signup" opens the create-account form (used by the purchase funnel). */
    mode?: string;
    /** Plan the visitor was buying — rendered as a confirmation badge. */
    plan?: string;
  };
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const returnTo = safeReturnTo(
    searchParams?.returnTo ?? searchParams?.callbackUrl
  );

  // Visitors arriving mid-purchase land on the signup form; everyone else gets
  // the default sign-in form.
  const initialMode = searchParams?.mode === "signup" ? "signup" : "signin";

  return (
    <AuthShell>
      <AuthView
        initialMode={initialMode}
        returnTo={returnTo}
        selectedPlan={searchParams?.plan ?? null}
      />
    </AuthShell>
  );
}
