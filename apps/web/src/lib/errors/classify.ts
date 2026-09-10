// FRPB — client error classification for error boundaries.
// Shared by the root + dashboard boundaries so auth, DB and generic failures
// each get accurate, friendly copy.

export type BoundaryErrorKind = "auth" | "db" | "generic";

const DB_ERROR_PATTERN =
  /P1001|P1002|P1003|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection (refused|reset|timed out)|connect (refused|timed out)|unable to connect|database.*unreachable/i;

const AUTH_ERROR_PATTERN =
  /AuthSessionMissingError|auth.*session.*missing|401|unauthorized|invalid.*token|jwt.*(expired|invalid)|refresh.*token|supabase/i;

export function classifyBoundaryError(
  error: Error & { digest?: string }
): BoundaryErrorKind {
  const message = error.message ?? "";
  if (AUTH_ERROR_PATTERN.test(message)) return "auth";
  if (DB_ERROR_PATTERN.test(message)) return "db";
  return "generic";
}
