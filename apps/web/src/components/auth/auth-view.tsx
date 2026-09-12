// FRPB — shared auth form (used by /auth, /login, /register).
// Client component: sign in / sign up with Supabase email+password.
// Accepts an initial mode and a sanitized return target from the server page.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, User, ShieldCheck, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import { isPostHogEnabled } from "@/app/providers";

interface AuthViewProps {
  initialMode: "signin" | "signup";
  returnTo: string;
}

export default function AuthView({ initialMode, returnTo }: AuthViewProps) {
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

    // Session is set — go to the destination the user was heading to.
    // Use router.push instead of window.location.href so Next.js handles
    // the transition cleanly without dropping session cookies.
    router.push(returnTo);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="card p-8">
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
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
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
