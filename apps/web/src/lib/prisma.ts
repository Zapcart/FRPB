// FRPB — PrismaClient singleton (dev hot-reload safe).

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Validate the connection environment BEFORE constructing the client.
 *
 * This matters because `schema.prisma` declares BOTH `url = env("DATABASE_URL")`
 * and `directUrl = env("DIRECT_URL")`. Prisma resolves both at client
 * CONSTRUCTION, so a host that defines only `DATABASE_URL` throws while this
 * module is being imported — i.e. before any route-level try/catch can run.
 * The observable symptom is an unparseable 500/503 from every DB-backed route
 * ("We're having trouble reaching our payment system right now").
 *
 * Returning an explicit runtime URL via `datasources` keeps the app bootable in
 * that case, and every branch logs an actionable message instead of failing
 * silently. `directUrl` is only consumed by `prisma migrate` / DDL — the runtime
 * query client never needs the direct (non-pooled) connection.
 */
function resolveDatasourceUrl(): string | undefined {
  const runtimeUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();

  if (!runtimeUrl) {
    console.error(
      "[prisma] DATABASE_URL is not set. All database operations will fail. " +
        "Set DATABASE_URL to the Supabase transaction-pooler URL " +
        "(port 6543) with `?pgbouncer=true&connection_limit=1`."
    );
    return undefined;
  }

  // Supabase's transaction pooler (PgBouncer/Supavisor on 6543) rejects
  // Prisma's prepared statements unless pgbouncer mode is enabled. Omitting the
  // flag is the documented cause of the intermittent "Database connecting…"
  // degradation, so this is called out loudly rather than left to surface as a
  // random query timeout under load.
  const usesTransactionPooler = /:6543(\/|\?|$)/.test(runtimeUrl);
  if (usesTransactionPooler && !/[?&]pgbouncer=true/.test(runtimeUrl)) {
    console.error(
      "[prisma] DATABASE_URL targets the Supabase pooler (port 6543) without " +
        "`?pgbouncer=true`. Prepared statements will be rejected under load. " +
        "Append `?pgbouncer=true&connection_limit=1`."
    );
  }

  if (!directUrl) {
    console.error(
      "[prisma] DIRECT_URL is not set. Falling back to DATABASE_URL for runtime " +
        "queries so the service can still boot. Set DIRECT_URL to the direct " +
        "session connection (port 5432) before running `prisma migrate`."
    );
  }

  // Unsubstituted copies of the template are the single most common cause of
  // "auth failed" in a fresh deployment: the URL parses, the host resolves, and
  // Postgres rejects the credentials. Detect it eagerly and name the fix, rather
  // than letting it surface later as an opaque P1000 during checkout.
  const PLACEHOLDER_MARKERS = ["YOUR_PROJECT", "PASSWORD", "your-project", "your_password", "changeme"];
  const placeholder = PLACEHOLDER_MARKERS.find(
    (marker) => runtimeUrl.includes(marker) || directUrl?.includes(marker)
  );
  if (placeholder) {
    console.error(
      `[prisma] DATABASE_URL/DIRECT_URL still contains the placeholder value ` +
        `"${placeholder}". Replace it with the real Supabase connection string in ` +
        `apps/web/.env.local (local) or the hosting provider's env settings ` +
        `(production).`
    );
  }

  return runtimeUrl;
}

function createPrismaClient(): PrismaClient {
  const url = resolveDatasourceUrl();
  return new PrismaClient({
    // Explicit override: prevents the client from failing to construct when
    // DIRECT_URL is absent (see resolveDatasourceUrl).
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let client = globalForPrisma.prisma;

if (!client) {
  try {
    client = createPrismaClient();
    console.log("[prisma] Client initialized successfully");
    // Log connection mode for operational visibility.
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (dbUrl) {
      try {
        const u = new URL(dbUrl);
        const isPooler = u.port === "6543";
        const hasPgbouncer = u.searchParams.has("pgbouncer");
        console.log(
          `[prisma] Connection: ${isPooler ? "pooler (6543)" : "direct (" + u.port + ")"}` +
          (hasPgbouncer ? " [pgbouncer=true OK]" : isPooler ? " [WARNING: pgbouncer missing]" : "")
        );
      } catch {
        console.log("[prisma] Connection: URL parseable but could not analyze");
      }
    }
  } catch (err) {
    // Construction failed (bad URL syntax, missing env, unresolvable host).
    // Re-throw so the caller fails fast — but log the precise cause first, since
    // the route-level guards will deliberately reduce it to a generic 503.
    console.error("[prisma] FATAL: PrismaClient construction failed:", err);
    throw err;
  }
}

export const prisma = client;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
