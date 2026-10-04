// FRPB — scroll-triggered signup modal (landing page).
//
// Nudges anonymous visitors toward creating an account ONLY after they have
// shown genuine interest: the modal opens when BOTH 10 seconds have elapsed AND
// the visitor has scrolled at least 200px down the landing page. It is skipped
// entirely for signed-in users and never re-appears after a dismissal (persisted
// in localStorage so it stays quiet across the session and future visits).
//
// Mounted code-split (ssr:false) from `components/floating-widgets.tsx` so it
// never sits in the primary hydration bundle.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { isPostHogEnabled } from "@/app/providers";

/** Time the visitor must spend on the page before the modal may open (ms). */
const DELAY_MS = 10_000;
/** Scroll depth (px) the visitor must reach before the modal may open. */
const SCROLL_THRESHOLD = 200;
/** localStorage flag: set once the visitor dismisses (or signs in on) the modal. */
const DISMISS_KEY = "frpb.signupModal.dismissed";

/** Origins that must never be used as an OAuth redirect target in production. */
const LOCAL_HOST_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * Resolve the public app origin used to build the OAuth `redirectTo`.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_APP_URL`  — canonical public URL (inlined at build time).
 *   2. `NEXT_PUBLIC_SITE_URL` — legacy alias used elsewhere in the codebase.
 *   3. `window.location.origin` — local development / direct hits.
 *
 * PRODUCTION SAFETY: `window.location.origin` can resolve to a local/LAN host
 * when the app is reached through a proxy with a rewritten Host header, or when
 * a build is missing its public-origin env. Shipping `http://localhost:3000`
 * as the OAuth `redirectTo` makes Supabase discard it and fall back to the
 * dashboard "Site URL", stranding the browser on localhost. In production we
 * therefore refuse a localhost origin, log loudly, and fall back to the
 * canonical `https://frpb.in`. A trailing slash is stripped so the joined path
 * never doubles up.
 */
function resolveAppOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL)
    ?.trim()
    .replace(/\/+$/, "");
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const runtime = window.location.origin;
    if (process.env.NODE_ENV === "production" && LOCAL_HOST_PATTERN.test(runtime)) {
      console.error(
        "[scroll-signup] refusing localhost OAuth origin in production; " +
          "set NEXT_PUBLIC_APP_URL. Falling back to https://frpb.in"
      );
      return "https://frpb.in";
    }
    return runtime;
  }
  return "";
}

export default function ScrollSignupModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate flags — the modal may only open once ALL of these align.
  const timerReadyRef = useRef(false);
  const scrolledRef = useRef(false);
  const suppressedRef = useRef(false); // dismissed or already authenticated
  const dialogRef = useRef<HTMLDivElement>(null);

  /** Open the modal if every precondition still holds. */
  const maybeReveal = useCallback(() => {
    if (suppressedRef.current) return;
    if (!timerReadyRef.current || !scrolledRef.current) return;
    setOpen(true);
    if (typeof window !== "undefined" && isPostHogEnabled()) {
      posthog.capture("signup_modal_shown", { surface: "landing_scroll" });
    }
  }, []);

  /** Persist the dismissal so the modal never nags again. */
  const dismiss = useCallback(() => {
    suppressedRef.current = true;
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch (err) {
      // Private-mode / storage-blocked browsers: still close for this session.
      console.error("[scroll-signup] localStorage write failed:", err);
    }
  }, []);

  // Landing-page only + one-shot trigger wiring.
  useEffect(() => {
    if (pathname !== "/") return;

    // Already dismissed on a previous visit.
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        suppressedRef.current = true;
        return;
      }
    } catch (err) {
      console.error("[scroll-signup] localStorage read failed:", err);
    }

    const supabase = createClient();
    let disposed = false;

    // Never prompt a visitor who is already signed in.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (disposed) return;
        if (data.session?.user) suppressedRef.current = true;
      })
      .catch((err) => {
        console.error("[scroll-signup] session lookup failed:", err);
      });

    // If the visitor authenticates while the page is open, close and stay quiet.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        suppressedRef.current = true;
        setOpen(false);
      }
    });

    // Condition 1 — dwell time.
    const timer = window.setTimeout(() => {
      timerReadyRef.current = true;
      maybeReveal();
    }, DELAY_MS);

    // Condition 2 — scroll depth.
    const handleScroll = () => {
      if (scrolledRef.current) return;
      const depth =
        window.scrollY || document.documentElement.scrollTop || 0;
      if (depth >= SCROLL_THRESHOLD) {
        scrolledRef.current = true;
        maybeReveal();
      }
    };
    // Seed the flag in case the visitor reloads already scrolled down.
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe();
    };
  }, [pathname, maybeReveal]);

  // Modal-only affordances: Escape to close, scroll lock, initial focus.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, dismiss]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined" && isPostHogEnabled()) {
        posthog.capture("signup_modal_google_click", {
          surface: "landing_scroll",
        });
      }
      const supabase = createClient();
      const origin = resolveAppOrigin() || window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (oauthError) {
        console.error("[scroll-signup] Google OAuth failed:", oauthError.message);
        setError("Could not start Google sign-in. Please try again.");
        setLoading(false);
      }
      // On success the browser is redirected to Google — no further state change.
    } catch (err) {
      console.error("[scroll-signup] unexpected OAuth error:", err);
      setError("Could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scroll-signup-title"
    >
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        aria-label="Close signup prompt"
        onClick={dismiss}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        className="glass-panel-strong relative w-full max-w-md p-8 outline-none"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close signup prompt"
          className="absolute right-4 top-4 -m-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Sparkles className="h-5 w-5" />
        </span>

        <h2
          id="scroll-signup-title"
          className="mt-4 text-2xl font-bold tracking-tight text-slate-900"
        >
          Unlock your FRPB toolkit
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Create a free account to download FRPB, run the free tools, and manage
          your licenses — no card required.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="btn-accent mt-6 flex w-full items-center justify-center gap-2.5 px-6 py-3 text-sm font-bold text-white disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleGlyph className="h-4 w-4" />
          )}
          Continue with Google
        </button>

        <Link
          href="/auth/signup"
          onClick={dismiss}
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-glass-edge bg-glass-soft px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition hover:bg-glass"
        >
          Sign up with email
        </Link>

        <p className="mt-5 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            onClick={dismiss}
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Minimal, dependency-free Google brand mark. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
