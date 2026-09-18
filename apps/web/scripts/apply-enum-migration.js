// FRPB — Apply the `PENDING_VERIFICATION` enum migration via the Prisma Client.
//
// WHY THIS EXISTS (and not `prisma db execute`)
//   `prisma db execute` HUNG indefinitely against this Supabase project: the
//   "direct" host `db.<ref>.supabase.co` is IPv6-only (AAAA-only, no A record),
//   so an IPv4-only network dials an unroutable address that neither connects
//   nor fails promptly. The CLI has no timeout, so it stalls forever.
//
//   The Prisma Client, by contrast, talks to the pooler host (IPv4) and is the
//   same code path the running app already uses successfully. This script:
//     1. loads apps/web/.env.local (no dotenv dependency),
//     2. runs the idempotent `ALTER TYPE ... ADD VALUE IF NOT EXISTS` DDL,
//     3. verifies the value is present in pg_enum, and
//     4. hard-times-out every attempt so it can never hang the terminal.
//
// Endpoints are attempted in order; the transaction pooler (6543) is tried
// first because it is the connection the application itself proves works.

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const ATTEMPT_TIMEOUT_MS = 30000;

const MIGRATION_FILE = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260918000000_add_pending_verification_status",
  "migration.sql"
);

/** Reject a promise after `ms` so an unroutable/hung connection cannot stall us. */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms (${label})`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Minimal KEY=VALUE parser for .env.local. */
function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const out = {};
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

/** Strip any query params (pgbouncer/connection_limit) to derive the sibling port. */
function toPort(urlString, port) {
  try {
    const u = new URL(urlString);
    u.port = String(port);
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Execute the migration DDL + verification against one URL. */
async function attempt(label, url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const sql = fs.readFileSync(MIGRATION_FILE, "utf8").trim();
    console.log(`\n[${label}] connecting…`);
    await withTimeout(prisma.$connect(), ATTEMPT_TIMEOUT_MS, `${label} connect`);
    console.log(`[${label}] connected. Applying DDL:\n  ${sql.split(/\r?\n/).pop()}`);

    await withTimeout(prisma.$executeRawUnsafe(sql), ATTEMPT_TIMEOUT_MS, `${label} DDL`);
    console.log(`[${label}] DDL applied.`);

    // Verify against the catalogue — authoritative evidence the label is live.
    const rows = await withTimeout(
      prisma.$queryRawUnsafe(
        `SELECT e.enumlabel AS label
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'UpiOrderStatus'
          ORDER BY e.enumsortorder`
      ),
      ATTEMPT_TIMEOUT_MS,
      `${label} verify`
    );
    const labels = rows.map((r) => r.label);
    console.log(`[${label}] UpiOrderStatus labels: ${labels.join(", ")}`);
    return { ok: labels.includes("PENDING_VERIFICATION"), labels };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

(async () => {
  const env = loadEnvLocal();
  const runtime = env.DATABASE_URL;
  if (!runtime) {
    console.error("[apply] DATABASE_URL missing from .env.local");
    process.exit(1);
  }

  // Order matters: the app-proven runtime pooler first, then sibling endpoints.
  const candidates = [
    ["transaction-pooler:6543", runtime],
    ["session-pooler:5432", toPort(runtime, 5432)],
  ].filter(([, url]) => Boolean(url));

  const errors = [];
  for (const [label, url] of candidates) {
    try {
      const result = await attempt(label, url);
      if (result.ok) {
        console.log(`\n✅ SUCCESS via ${label}. PENDING_VERIFICATION is live in the database.`);
        process.exit(0);
      }
      errors.push(`${label}: connected but enum value missing`);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.error(`[${label}] FAILED: ${message}`);
      errors.push(`${label}: ${message}`);
    }
  }

  console.error("\n❌ All endpoints failed to apply the migration:");
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
})();
