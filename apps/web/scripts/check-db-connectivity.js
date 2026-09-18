// FRPB — Supabase endpoint connectivity diagnostic.
//
// WHY THIS EXISTS
//   `db.<ref>.supabase.co` (the "direct" host) is IPv6-only on newer Supabase
//   projects. On an IPv4-only network `dns.resolve` returns nothing, and a raw
//   TCP dial neither connects nor fails promptly — Prisma then appears to HANG
//   rather than error, which is what makes a migration look "stuck".
//
//   The IPv4-safe replacement for DDL/migrations is the SESSION pooler on port
//   5432:  aws-0-<region>.pooler.supabase.com:5432
//   The transaction pooler on 6543 is for runtime queries only.
//
// This script is dependency-free (node:dns + node:net only) so it runs even
// when node_modules is incomplete, and it probes every candidate endpoint with
// a hard timeout so it can never hang the way `prisma db execute` did.

const dns = require("node:dns").promises;
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

const TCP_TIMEOUT_MS = 8000;

/** Minimal KEY=VALUE parser for apps/web/.env.local (no dotenv dependency). */
function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const out = {};
  try {
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
    console.log(`[env] loaded ${Object.keys(out).length} keys from ${envPath}`);
  } catch (err) {
    console.error(`[env] could not read ${envPath}: ${err.message}`);
  }
  return out;
}

/** Extract host + port from a Postgres URL without logging credentials. */
function parseTarget(urlString) {
  try {
    const u = new URL(urlString);
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: u.username,
    };
  } catch {
    return null;
  }
}

/** Resolve A (IPv4) and AAAA (IPv6) records independently. */
async function resolveHost(host) {
  const result = { ipv4: [], ipv6: [], v4Error: null, v6Error: null };
  try {
    result.ipv4 = (await dns.resolve4(host)).slice(0, 4);
  } catch (err) {
    result.v4Error = err.code;
  }
  try {
    result.ipv6 = (await dns.resolve6(host)).slice(0, 4);
  } catch (err) {
    result.v6Error = err.code;
  }
  return result;
}

/** Hard-timeout TCP dial — resolves { ok, ms, error } and never rejects. */
function probeTcp(host, port, timeoutMs = TCP_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, error: error ?? null });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, null));
    socket.once("timeout", () => finish(false, "TIMEOUT"));
    socket.once("error", (err) => finish(false, err.code || err.message));
    socket.connect(Number(port), host);
  });
}

async function probe(name, urlString) {
  if (!urlString) {
    console.log(`\n=== ${name} === (not set)`);
    return;
  }
  const target = parseTarget(urlString);
  if (!target) {
    console.log(`\n=== ${name} === UNPARSEABLE URL`);
    return;
  }

  console.log(`\n=== ${name} → ${target.host}:${target.port} (user=${target.user}) ===`);
  const resolved = await resolveHost(target.host);
  console.log(
    `  DNS A   (IPv4): ${resolved.ipv4.join(", ") || `(none) [${resolved.v4Error}]`}`
  );
  console.log(
    `  DNS AAAA(IPv6): ${resolved.ipv6.join(", ") || `(none) [${resolved.v6Error}]`}`
  );

  const conn = await probeTcp(target.host, target.port);
  console.log(
    `  TCP ${target.port}: ${conn.ok ? "REACHABLE" : "UNREACHABLE"} in ${conn.ms}ms` +
      (conn.error ? ` [${conn.error}]` : "")
  );
}

(async () => {
  const env = loadEnvLocal();

  // Candidate DDL endpoint: Supabase session pooler = same host, port 5432.
  let sessionPooler = null;
  if (env.DIRECT_URL) {
    sessionPooler = env.DIRECT_URL.replace(":5432", ":5432"); // direct host unchanged
  }
  const poolerHostMatch = /@([^/:]+\.pooler\.supabase\.com):(\d+)/.exec(
    env.DATABASE_URL || ""
  );
  const sessionPoolerUrl = poolerHostMatch
    ? `postgresql://x@${poolerHostMatch[1]}:5432/postgres`
    : null;

  await probe("DATABASE_URL (transaction pooler, runtime)", env.DATABASE_URL);
  await probe("DIRECT_URL (direct host, for migrations)", env.DIRECT_URL);
  await probe("SESSION POOLER (IPv4-safe migration path)", sessionPoolerUrl);

  console.log(
    "\nInterpretation: prefer the endpoint that resolves to an IPv4 address AND shows" +
      "\n'TCP REACHABLE'. For migrations use the session pooler on port 5432."
  );
})().catch((err) => {
  console.error("[diagnostic] fatal:", err);
  process.exitCode = 1;
});
