// FRPB — referral code capture & persistence (client-safe, pure helpers).
//
// Why this exists: referral share links now point at the marketing home
// (`https://frpb.in/?ref=CODE`) rather than straight at `/checkout`. A referred
// visitor therefore lands on a public page, browses, signs up, and only pays
// later — so the code must survive that journey. We persist it in BOTH a cookie
// and localStorage so it is recoverable on the checkout route (server cookie
// read) *and* in any client island (localStorage read).
//
// Everything here is dependency-free and never throws: losing the code must
// degrade to an ordinary visit, never break rendering.

/** localStorage key that holds the captured referral code. */
export const REFERRAL_STORAGE_KEY = "frpb:referral-code";

/** Cookie name read by the /checkout server component as a query fallback. */
export const REFERRAL_COOKIE_KEY = "frpb_ref";

/** Cookie lifetime — a referral attribution window of 30 days. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Normalize untrusted input into a plausible referral code.
 *
 * The canonical charset is `FR` + 8 unambiguous chars, but we accept a slightly
 * wider alphanumeric token (uppercased) and let the server resolve/validate it
 * against the DB. Anything that could not be a code — empty, over-long, or
 * containing non-alphanumerics — returns null so it is never echoed verbatim.
 */
export function normalizeRefCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const candidate = raw.trim().toUpperCase();
  if (candidate.length < 3 || candidate.length > 32) return null;
  if (!/^[A-Z0-9]+$/.test(candidate)) return null;
  return candidate;
}

/**
 * Extract + normalize a `ref` value from a raw query string.
 * Returns null when absent or malformed. Uses URLSearchParams defensively.
 */
export function parseRefFromSearch(search: string | null | undefined): string | null {
  if (typeof search !== "string" || search.length === 0) return null;
  try {
    const params = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search
    );
    return normalizeRefCode(params.get("ref"));
  } catch {
    return null;
  }
}

/** True when we are running in a browser with a usable document. */
function canUseBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Persist the referral code to a first-party cookie and localStorage.
 *
 * Both sinks are attempted independently; a failure in one (e.g. Safari private
 * mode blocking storage) never prevents the other. Never throws.
 */
export function captureReferralCode(code: string): void {
  const normalized = normalizeRefCode(code);
  if (!normalized || !canUseBrowser()) return;

  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } catch {
    // Non-fatal: the cookie is the primary server-readable sink.
  }

  try {
    const secure =
      window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${REFERRAL_COOKIE_KEY}=${encodeURIComponent(
      normalized
    )}; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Non-fatal: localStorage may still have captured the code.
  }
}

/** Read back the persisted code from localStorage, then the cookie. */
export function readStoredReferralCode(): string | null {
  if (!canUseBrowser()) return null;

  try {
    const stored = normalizeRefCode(
      window.localStorage.getItem(REFERRAL_STORAGE_KEY)
    );
    if (stored) return stored;
  } catch {
    // Fall through to the cookie.
  }

  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE_KEY}=([^;]*)`)
    );
    if (match?.[1]) {
      return normalizeRefCode(decodeURIComponent(match[1]));
    }
  } catch {
    // Give up quietly.
  }

  return null;
}
