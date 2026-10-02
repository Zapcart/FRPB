// FRPB — shared auth form (used by /auth, /login, /register).
// Client component: sign in / sign up with Supabase email+password.
// Accepts an initial mode and a sanitized return target from the server page.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, User, ShieldCheck, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLANS, formatMoney, priceFor } from "@frpb/shared";
import posthog from "posthog-js";
import { isPostHogEnabled } from "@/app/providers";
import { readPendingPlan } from "@/lib/checkout/pending-plan";
import { normalizeRefCode } from "@/lib/referral/ref-capture";

interface AuthViewProps {
  initialMode: "signin" | "signup";
  /** Server-sanitized post-auth destination (defaults to the dashboard). */
  returnTo: string;
  /**
   * Plan the visitor was purchasing, forwarded from the pricing page. Rendered
   * as a confirmation badge so they can see what they are signing up for.
   * Validated against the canonical plan list before display.
   */
  selectedPlan?: string | null;
  /**
   * Referral code captured from `?ref=` on a share link (already normalized
   * server-side). When present, a freshly-authenticated referred visitor is
   * forwarded to checkout with the code attached so attribution is preserved.
   */
  referralCode?: string | null;
}

/**
 * Append a `ref` query parameter to an internal path, preserving any existing
 * query string and hash fragment. Used to re-attach referral attribution when
 * honouring a caller-supplied `returnTo`.
 */
function appendRef(path: string, ref: string): string {
  const hashIndex = path.indexOf("#");
  const base = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : path.slice(hashIndex);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}ref=${encodeURIComponent(ref)}${hash}`;
}

/** Where to send the user after a successful authentication. */
const DASHBOARD_PATH = "/dashboard";

export default function AuthView({
  initialMode,
  returnTo,
  selectedPlan = null,
  referralCode = null,
}: AuthViewProps) {
  // Only render a badge for a real plan slug — never echo arbitrary query input.
  const badgePlan = PLANS.find((p) => p.slug === selectedPlan) ?? null;
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Blueprint fix 8 — email-confirmation is not an error, it's a notice.
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const client = createClient();

    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is enabled, show an informational notice
      if (!data.session) {
        setNotice("Account created! Check your inbox to confirm your email, then sign in.");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    // A session now exists, so authentication succeeded. Capture the event
    // before navigating away. Guarded so it is a no-op during SSR and when
    // PostHog is unconfigured (no NEXT_PUBLIC_POSTHOG_KEY).
    if (typeof window !== "undefined" && isPostHogEnabled()) {
      posthog.capture("user_logged_in", { method: "email_password", mode });
    }

    // Re-validate the referral code on the client (defense in depth) so a
    // malformed value can never be reflected into the destination URL.
    const ref = normalizeRefCode(referralCode);

    // A caller-supplied `returnTo` is honoured only when it is an in-app path
    // that is not itself a checkout route (the server already sanitizes it and
    // defaults it to `/dashboard`). When a referral code is present we re-attach
    // it so attribution survives the round trip.
    if (returnTo && !returnTo.startsWith("/checkout")) {
      // Use router.push (not window.location.href) so Next.js handles the
      // transition without a full reload that could drop session cookies.
      router.push(ref ? appendRef(returnTo, ref) : returnTo);
      return;
    }

    // Referred visitor arriving through a share link: forward them to the
    // checkout step for the plan they had picked, with the referral code
    // attached. This is an intentional forward for a referral-driven signup —
    // NOT a silent auto-resume of the $20 payment page — so both the chosen
    // plan and the attribution are preserved.
    const pending = readPendingPlan();
    if (ref && pending) {
      router.push(
        `/checkout?plan=${encodeURIComponent(
          pending.planSlug
        )}&currency=${encodeURIComponent(pending.currency)}&ref=${encodeURIComponent(
          ref
        )}`
      );
      return;
    }

    // Everyone else lands on the dashboard. We deliberately DO NOT auto-resume
    // checkout here: a freshly-authenticated user must land on `/dashboard`,
    // never straight on the payment page. The dashboard surfaces a plan chooser
    // for users without an active license, so purchase intent is preserved
    // without hijacking the redirect.
    router.push(DASHBOARD_PATH);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-panel-strong p-8">
        {/* Plan confirmation badge — shows a visitor arriving mid-purchase
            exactly what they are signing up for, so they do not have to trust
            that the selection survived the redirect. */}
        {badgePlan && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-brand-200/70 bg-brand-50/70 px-3.5 py-2.5 backdrop-blur">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
            <p className="text-xs text-brand-800">
              Continuing with the{" "}
              <span className="font-bold">{badgePlan.name}</span>{" "}
              <span className="text-brand-600">
                ({formatMoney(priceFor(badgePlan, "USD"), "USD")})
              </span>
              . You'll complete payment right after this step.
            </p>
          </div>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "signin"
            ? "Sign in to manage your licenses and downloads."
            : "Sign up to buy a plan and activate FRPB."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <User className="h-4 w-4 text-slate-400" /> Full name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="glass-input"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Mail className="h-4 w-4 text-slate-400" /> Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="glass-input"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Lock className="h-4 w-4 text-slate-400" /> Password
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-input"
            />
          </label>

          {notice && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-700"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-accent flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="-my-2 inline-flex min-h-[44px] touch-manipulation select-none items-center px-1 font-semibold text-brand-600 transition active:text-brand-800 hover:text-brand-700 hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Your credentials are protected with industry-standard encryption.
      </p>
    </div>
  );
}
