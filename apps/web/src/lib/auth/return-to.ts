// FRPB — auth redirect target sanitizer.
// Shared by the auth entry pages so a malicious/foreign `returnTo` (open
// redirect) can never be honored. Only single-slash internal paths pass.

export function safeReturnTo(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw) return fallback;
  const candidate = raw.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("://")
  ) {
    return fallback;
  }
  return candidate;
}
