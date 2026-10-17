// FRPB — one-time "$20 for 6 months" promo blast to existing users.
//
//   pnpm --filter @frpb/web exec tsx scripts/send-promo-to-existing-users.ts
//   pnpm --filter @frpb/web exec tsx scripts/send-promo-to-existing-users.ts -- --dry-run
//   pnpm --filter @frpb/web exec tsx scripts/send-promo-to-existing-users.ts -- --limit 5
//
// RECIPIENT SOURCE
//   1. Supabase Auth Admin API (listUsers, paginated) when
//      SUPABASE_SERVICE_ROLE_KEY is present — this is the authoritative list of
//      every registered auth user, including people who never triggered a
//      Prisma write.
//   2. Otherwise it falls back to the Prisma `User` table, which already holds
//      every account the app has provisioned (id/email pair). The fallback
//      exists because the service-role key is deliberately NOT shipped in the
//      web app's runtime env; the blast must still be runnable.
//
// SAFETY
//   - Idempotent: a recipient who already has a SENT `promo-6mo-20usd` row in
//     EmailLog is skipped, so re-running never double-sends.
//   - Throttled: sequential sends with a delay, because Resend's default limit
//     is 2 requests/second and a burst would 429 the whole campaign.
//   - Obvious test/placeholder domains are skipped — hard bounces on a brand new
//     domain are the fastest way to lose sending reputation.
//   - `--dry-run` prints the exact plan and sends nothing.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Env bootstrap ───────────────────────────────────────────────────────────
// Must run BEFORE the Prisma/Resend modules are imported: PrismaClient resolves
// DATABASE_URL/DIRECT_URL at construction time. `tsx` runs this file directly,
// so there is no Next.js env loader here — parse .env.local ourselves (same
// dependency-free approach as scripts/check-db-connectivity.js).
function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.warn(`[promo] no .env.local at ${envPath} — relying on process.env`);
    return;
  }

  let loaded = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2];
    if (!key || rawValue === undefined) continue;

    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Real environment wins (lets CI/production override a local file).
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }
  console.info(`[promo] loaded ${loaded} key(s) from ${envPath}`);
}

loadEnvLocal();

// ─── CLI options ─────────────────────────────────────────────────────────────
interface Options {
  dryRun: boolean;
  limit: number | null;
  delayMs: number;
}

function parseArgs(argv: string[]): Options {
  const getNumber = (flag: string): number | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    const parsed = Number(argv[idx + 1]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  return {
    dryRun: argv.includes("--dry-run"),
    limit: getNumber("--limit"),
    delayMs: getNumber("--delay") ?? 600,
  };
}

// ─── Recipient sources ───────────────────────────────────────────────────────
interface Recipient {
  email: string;
  name?: string | null;
  source: "supabase-admin" | "prisma";
}

/** Placeholder domains that can only ever bounce. */
const BLOCKED_DOMAIN_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /@test\.(com|org)$/i,
  /@localhost$/i,
  /@mailinator\.com$/i,
  /@yopmail\.com$/i,
];

function isUsableAddress(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  return !BLOCKED_DOMAIN_PATTERNS.some((pattern) => pattern.test(email));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Authoritative path: Supabase Auth Admin `listUsers`, paged.
 * Returns null (rather than throwing) when the key is absent so the caller can
 * fall back cleanly.
 */
async function fetchFromSupabaseAdmin(): Promise<Recipient[] | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!serviceKey) {
    console.warn("[promo] SUPABASE_SERVICE_ROLE_KEY not set — using Prisma User table");
    return null;
  }
  if (!supabaseUrl) {
    console.warn("[promo] NEXT_PUBLIC_SUPABASE_URL not set — using Prisma User table");
    return null;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const perPage = 1000;
    const recipients: Recipient[] = [];
    let page = 1;

    // Hard page ceiling so a malformed API response can never spin forever.
    for (; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);

      const users = data?.users ?? [];
      for (const user of users) {
        if (!user.email) continue;
        const meta = (user.user_metadata ?? {}) as { full_name?: string };
        recipients.push({
          email: normalizeEmail(user.email),
          name: meta.full_name ?? null,
          source: "supabase-admin",
        });
      }

      console.info(`[promo] fetched page ${page} (${users.length} user(s))`);
      if (users.length < perPage) break;
    }

    return recipients;
  } catch (err) {
    console.error(
      `[promo] Supabase Admin listUsers failed: ${(err as Error)?.message ?? err}`
    );
    console.warn("[promo] falling back to Prisma User table");
    return null;
  }
}

/** Fallback path: every account the app has provisioned. */
async function fetchFromPrisma(): Promise<Recipient[]> {
  const { prisma } = await import("../src/lib/prisma");
  try {
    const rows = await prisma.user.findMany({
      select: { email: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    return rows
      .filter((row) => Boolean(row.email))
      .map((row) => ({
        email: normalizeEmail(row.email),
        name: row.name ?? null,
        source: "prisma" as const,
      }));
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  console.info("──────────────────────────────────────────────────────────");
  console.info("FRPB — promo blast: 6 months for $20");
  console.info(`  mode        : ${options.dryRun ? "DRY RUN (no email sent)" : "LIVE"}`);
  console.info(`  delay       : ${options.delayMs}ms between sends`);
  console.info(`  limit       : ${options.limit ?? "none"}`);
  console.info("──────────────────────────────────────────────────────────");

  // 1. Resolve recipients (Admin API first, Prisma fallback).
  const adminRecipients = await fetchFromSupabaseAdmin();
  const raw = adminRecipients ?? (await fetchFromPrisma());

  // 2. Normalise + de-duplicate by address (an address can exist in both
  //    sources during a migration).
  const byEmail = new Map<string, Recipient>();
  for (const recipient of raw) {
    if (!byEmail.has(recipient.email)) byEmail.set(recipient.email, recipient);
  }

  const all = [...byEmail.values()];
  const usable = all.filter((r) => isUsableAddress(r.email));
  const blocked = all.length - usable.length;

  console.info(
    `[promo] ${all.length} unique address(es) found ` +
      `(source: ${usable[0]?.source ?? "n/a"}); ${blocked} skipped as test/placeholder`
  );

  if (usable.length === 0) {
    console.error("[promo] nothing to send — aborting");
    process.exitCode = 1;
    return;
  }

  const targets = options.limit ? usable.slice(0, options.limit) : usable;

  // 3. Import the sender AFTER env is loaded (module reads RESEND_API_KEY lazily
  //    but EmailLog dedupe needs the DB to be reachable).
  const { sendPromoEmail, isEmailConfigured } = await import("../src/lib/email/resend");

  if (!options.dryRun && !isEmailConfigured()) {
    console.error(
      "[promo] RESEND_API_KEY is missing or malformed — aborting before any send"
    );
    process.exitCode = 1;
    return;
  }

  const summary = {
    attempted: 0,
    sent: 0,
    alreadySent: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < targets.length; i++) {
    const recipient = targets[i];
    if (!recipient) continue;
    const position = `[${i + 1}/${targets.length}]`;

    if (options.dryRun) {
      console.info(`${position} DRY RUN → ${recipient.email}`);
      summary.attempted++;
      continue;
    }

    summary.attempted++;
    const result = await sendPromoEmail(recipient.email, { name: recipient.name });

    if (result.sent) {
      summary.sent++;
      console.info(`${position} ✓ SENT   ${recipient.email}`);
    } else if (result.alreadySent) {
      summary.alreadySent++;
      console.info(`${position} = SKIP   ${recipient.email} (already received)`);
    } else {
      summary.failed++;
      const message = result.error ?? "unknown error";
      summary.errors.push(`${recipient.email}: ${message}`);
      console.error(`${position} ✗ FAILED ${recipient.email} — ${message}`);
    }

    // Throttle between sends (skip the trailing wait).
    if (i < targets.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.info("──────────────────────────────────────────────────────────");
  console.info("PROMO BLAST COMPLETE");
  console.info(`  attempted   : ${summary.attempted}`);
  console.info(`  sent        : ${summary.sent}`);
  console.info(`  already sent: ${summary.alreadySent}`);
  console.info(`  failed      : ${summary.failed}`);
  console.info(`  blocked     : ${blocked}`);
  console.info(`  elapsed     : ${elapsed}s`);
  console.info("──────────────────────────────────────────────────────────");

  if (summary.errors.length > 0) {
    console.error("[promo] failures:");
    for (const error of summary.errors) console.error(`  - ${error}`);
  }

  // Non-zero exit when nothing went out, so a CI/scheduler notices.
  if (summary.sent === 0 && summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[promo] FATAL:", (err as Error)?.stack ?? err);
  process.exitCode = 1;
});
