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

  // Serverless connection budget.
  //
  // Supabase's transaction pooler multiplexes many client connections onto a
  // small number of Postgres backends, but each serverless instance still opens
  // its OWN pool. A per-instance `connection_limit` above the pooler's headroom
  // is the classic cause of `P1001`/`P1002`/`P1017` under load — the exact
  // errors that surface to the customer as a 503 DB_UNAVAILABLE on checkout.
  // Tuning (and lowering, not raising) these values is safe to do at runtime:
  // Prisma merges them into the datasource URL it is handed.
  return applyServerlessPoolTuning(runtimeUrl);
}

/**
 * Merge serverless-safe pool tuning into the pooler URL without clobbering any
 * operator-supplied value. PgBouncer (port 6543) must NEVER be given more than
 * a couple of connections per instance, so the defaults below are deliberately
 * low; on the direct/session port the defaults are left untouched.
 */
function applyServerlessPoolTuning(url: string): string {
  try {
    const parsed = new URL(url);
    const isTransactionPooler = parsed.port === "6543";
    const defaults: Record<string, string> = {
      // Bounded wait for a TCP/TLS handshake to the pooler.
      connect_timeout: "15",
      // Fail fast instead of queueing requests until the serverless function
      // itself times out (which yields an unparseable platform 500/503).
      pool_timeout: "20",
    };
    if (isTransactionPooler) defaults.connection_limit = "10";

    let mutated = false;
    for (const [key, value] of Object.entries(defaults)) {
      if (!parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, value);
        mutated = true;
      }
    }
    return mutated ? parsed.toString() : url;
  } catch {
    // Not a parseable URL — hand it back untouched so Prisma reports the real
    // syntax problem instead of a silently mangled string.
    return url;
  }
}

function createPrismaClient(): PrismaClient {
  const url = resolveDatasourceUrl();
  return new PrismaClient({
    // The resolved/tuned URL is passed EXPLICITLY. `resolveDatasourceUrl()`
    // validates the environment and merges the serverless pool tuning; this
    // value was previously computed and discarded, so the tuning never reached
    // the client and the pooler defaults applied instead.
    ...(url ? { datasources: { db: { url } } } : {}),
    // Explicit override: keeps the client bootable when DATABASE_URL is absent
    // (resolveDatasourceUrl already logs an actionable message in that case).
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

// CACHE UNCONDITIONALLY — production included.
//
// This previously read `if (process.env.NODE_ENV !== "production")`, so on
// Vercel (NODE_ENV=production) the global was NEVER populated. Every serverless
// module evaluation therefore constructed a brand-new PrismaClient with its own
// connection pool, exhausting the Supabase pooler; the next query then failed
// with P1001/P1002/P1017 and surfaced as the 503 DB_UNAVAILABLE on checkout.
// Reusing one client per lambda module instance is the documented Prisma
// serverless pattern and keeps the connection budget bounded.
globalForPrisma.prisma = prisma;
