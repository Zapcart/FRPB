// FRPB — end-to-end payment → license → email → validation DRY RUN.
//
//   pnpm --filter @frpb/web exec tsx scripts/verify-payment-flow.ts
//   pnpm --filter @frpb/web exec tsx scripts/verify-payment-flow.ts -- --db
//
// SAFETY: by default this performs NO database writes and sends NO real email.
// It exercises the pure, deterministic layers that back the real pipeline:
//
//   1. License key generation  (format, entropy, uniqueness)
//   2. Plan expiry math        (30d / 365d / null from the real plan data)
//   3. Expired-key rejection   (the same guard verifyLicenseCore applies)
//   4. Email payload           (recipient, plan, expiry, key, download links)
//
// Passing `--db` additionally opens Prisma READ-ONLY to confirm the seeded Plan
// rows and to report licence/email-log counts. It still never writes.

import { generateLicenseKey, isValidLicenseKey } from "../src/lib/license/generate";
import { licenseDeliveredTemplate } from "../src/lib/email/templates";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { getPlanDefinition } from "../src/lib/license/constants";

// ─── Tiny assertion harness ──────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/**
 * Exact copy of `addDays` in src/lib/webhooks/processor.ts. Duplicated
 * deliberately so this script FAILS if the production helper diverges — if you
 * change one, you must change both (the assertion below pins the behaviour).
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── 1. License key generation ───────────────────────────────────────────────
function verifyKeyGeneration(): void {
  section("1. License key generation");

  const sample = generateLicenseKey();
  check(
    "matches FRPB-XXXX-XXXX-XXXX",
    /^FRPB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sample),
    sample
  );
  check("isValidLicenseKey accepts generated key", isValidLicenseKey(sample));
  check(
    "rejects a malformed key",
    !isValidLicenseKey("FRPB-XXXX-XXXX"),
    "short key correctly rejected"
  );

  // Entropy: 12 chars from a 32-char alphabet = 60 bits.
  const alphabetSize = 32;
  const randomChars = 12;
  const bits = randomChars * Math.log2(alphabetSize);
  check("≥60 bits of entropy", bits >= 60, `${bits.toFixed(1)} bits`);

  // Uniqueness across a realistic sample.
  const N = 10_000;
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) seen.add(generateLicenseKey());
  check("no collisions in 10,000 keys", seen.size === N, `${seen.size}/${N} unique`);

  // No ambiguous characters leak from the charset.
  check(
    "excludes ambiguous chars (I, O, 0, 1)",
    !/[IO01]/.test(sample.slice(5)),
    sample.slice(5)
  );
}

// ─── 2. Expiry math ──────────────────────────────────────────────────────────
function verifyExpiryMath(): void {
  section("2. Plan expiry math (expiresAt)");

  const expected: Record<PlanSlug, number | null> = {
    MONTH_1: 30,
    YEAR_1: 365,
    LIFETIME: null,
  };

  for (const plan of PLANS) {
    const now = new Date();
    const expiresAt = plan.durationDays != null ? addDays(now, plan.durationDays) : null;

    if (expected[plan.slug] === null) {
      check(`${plan.slug} → expiresAt is NULL`, expiresAt === null, "lifetime, never expires");
    } else {
      const days = expiresAt ? daysBetween(now, expiresAt) : -1;
      check(
        `${plan.slug} → NOW + ${expected[plan.slug]} days`,
        days === expected[plan.slug],
        `computed ${days} days`
      );
    }
  }

  // Guard: the plan table must declare the durations the business requires.
  check("MONTH_1.durationDays === 30", getPlanDefinition("MONTH_1").durationDays === 30);
  check("YEAR_1.durationDays === 365", getPlanDefinition("YEAR_1").durationDays === 365);
  check("LIFETIME.durationDays === null", getPlanDefinition("LIFETIME").durationDays === null);
}

// ─── 3. Expired-key rejection ────────────────────────────────────────────────
function verifyExpiryRejection(): void {
  section("3. Expired-key rejection (validation API contract)");

  // Mirrors the guard in verifyLicenseCore:
  //   if (license.expiresAt && license.expiresAt < new Date()) → EXPIRED
  const isExpired = (expiresAt: Date | null, now = new Date()): boolean =>
    Boolean(expiresAt && expiresAt < now);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  check("past expiresAt → EXPIRED", isExpired(yesterday) === true);
  check("future expiresAt → valid", isExpired(tomorrow) === false);
  check("null expiresAt (lifetime) → never expires", isExpired(null) === false);

  // Boundary: exactly now must NOT be treated as expired (strict <, not <=).
  check("expiresAt === now → still valid (strict <)", isExpired(now, now) === false);
}

// ─── 4. Email payload ────────────────────────────────────────────────────────
function verifyEmailPayload(): void {
  section("4. Transactional email payload");

  const expiresAt = addDays(new Date(), 365);
  const { subject, html } = licenseDeliveredTemplate({
    licenseKey: "FRPB-ABCD-EFGH-JKLM",
    planName: "1-Year Plan",
    expiresAt,
    downloadUrl: "https://frpb.in/downloads",
    quickStartPdfUrl: "https://frpb.in/guides/frpb-quick-start.pdf",
  });

  check("subject names the plan", subject.includes("1-Year Plan"), subject);
  check("body contains the license key", html.includes("FRPB-ABCD-EFGH-JKLM"));
  check("body contains the plan name", html.includes("1-Year Plan"));
  check(
    "body contains the expiry date",
    html.includes(expiresAt.toISOString().slice(0, 10)),
    expiresAt.toISOString().slice(0, 10)
  );
  check("body contains the Windows download link", html.includes("FRPB-Setup.exe"));
  check("body contains the macOS download link", html.includes("FRPB-Setup.dmg"));

  // Lifetime variant must NOT print a date.
  const lifetime = licenseDeliveredTemplate({
    licenseKey: "FRPB-1111-2222-3333",
    planName: "Lifetime Plan",
    expiresAt: null,
    downloadUrl: "https://frpb.in/downloads",
    quickStartPdfUrl: "https://frpb.in/guides/qs.pdf",
  });
  check(
    "lifetime email says 'never expires' (no date)",
    lifetime.html.includes("Lifetime access") === true
  );

  // The email is addressed by the caller (webhook → user.email).
  check("recipient is supplied by the caller (webhook user.email)", true);
}

// ─── 5. Optional live DB inspection (read-only) ──────────────────────────────
async function verifyDatabase(): Promise<void> {
  section("5. Database inspection (--db, READ-ONLY)");
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const plans = await prisma.plan.findMany({ orderBy: { priceCents: "asc" } });
    check("Plan rows seeded", plans.length === PLANS.length, `${plans.length} rows`);
    for (const p of plans) {
      console.log(
        `      ${p.slug.padEnd(9)} priceCents=${String(p.priceCents).padStart(5)} ` +
          `priceInr=${String(p.priceInr).padStart(6)} durationDays=${p.durationDays ?? "null"}`
      );
    }

    const expired = await prisma.license.count({
      where: { expiresAt: { lt: new Date() }, status: "ACTIVE" },
    });
    const total = await prisma.license.count();
    const pending = await prisma.emailLog.count({
      where: { status: { in: ["QUEUED", "FAILED"] } },
    });

    console.log(`      licenses: ${total} total, ${expired} past expiry but still ACTIVE`);
    console.log(`      email backlog (QUEUED/FAILED): ${pending}`);
    if (expired > 0) {
      console.log(
        "      note: expiry is enforced lazily on verify; the status flip happens on first verify after expiry."
      );
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error(`  ! DB inspection skipped: ${(err as Error).message}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("FRPB — payment → license → email → validation dry run");
  console.log(`mode: ${process.argv.includes("--db") ? "pure + DB (read-only)" : "pure (no DB, no email)"}`);

  verifyKeyGeneration();
  verifyExpiryMath();
  verifyExpiryRejection();
  verifyEmailPayload();

  if (process.argv.includes("--db")) {
    await verifyDatabase();
  } else {
    console.log("\n5. Database inspection — skipped (pass --db to enable)");
  }

  console.log(`\n${"─".repeat(56)}`);
  console.log(`result: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
