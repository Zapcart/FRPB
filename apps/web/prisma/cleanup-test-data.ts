// FRPB — One-off cleanup: purge development/test rows so the admin dashboard
// starts from a clean slate for the live launch.
//
// WHAT IT REMOVES
//   • The dev account(s) listed in TARGET_EMAILS and everything that belongs to
//     them: licenses, devices, payments, payment orders, email logs, FRP unlock
//     requests and page views.
//   • Any license whose id starts with a known throwaway prefix (the temporary
//     keys created while wiring up checkout).
//   • Any payment order that was never confirmed by a verified Razorpay capture
//     (`paymentConfirmed = false`) — the mock/unverified rows that used to
//     inflate the revenue cards. With those gone the "settled revenue" and
//     "active licenses" figures reset to zero for a fresh production start.
//
// SAFETY
//   • Runs as a DRY RUN by default and prints exactly what it would delete.
//   • Pass CONFIRM=1 to actually delete. All writes happen inside ONE
//     transaction, so a failure leaves the database untouched.
//   • Capture-confirmed orders for real customers are NEVER touched.
//
// USAGE
//   pnpm --filter @frpb/web db:cleanup-test-data          # dry run
//   CONFIRM=1 pnpm --filter @frpb/web db:cleanup-test-data # apply

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Load KEY=VALUE pairs from the Next.js env files into `process.env` for any
 * key that is not already set. tsx (unlike `next dev`) does not read
 * `.env.local`, so without this the CLI would fail with
 * "Environment variable not found: DATABASE_URL". Values already present in the
 * real environment always win, and a missing file is ignored.
 */
function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const contents = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        // Strip a single layer of matching quotes.
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // File absent (or unreadable) — nothing to load from this candidate.
    }
  }
}

loadEnvFiles();

const prisma = new PrismaClient();

/** Dev accounts to remove. Override with CLEANUP_EMAILS="a@x.com,b@y.com". */
const TARGET_EMAILS: string[] = (
  process.env.CLEANUP_EMAILS ?? "9823ahsanshaikh@gmail.com,test@frpb.local"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

/** Throwaway license ids created during development (matched by prefix). */
const TARGET_LICENSE_ID_PREFIXES: string[] = ["cmu64srr", "cmu6279s"];

const CONFIRM = process.env.CONFIRM === "1";

interface Counts {
  users: number;
  licenses: number;
  devices: number;
  payments: number;
  paymentOrders: number;
  emailLogs: number;
  frpRequests: number;
  pageViews: number;
}

function log(label: string, value: number | string): void {
  console.log(`  ${label.padEnd(16, ".")} ${value}`);
}

/**
 * Resolve the exact set of row ids to purge. Read-only so it can be used for
 * both the dry run and the confirmed delete.
 */
async function resolveTargets() {
  const users = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, email: true },
  });
  const userIds = users.map((u) => u.id);

  const licenses = await prisma.license.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        ...TARGET_LICENSE_ID_PREFIXES.map((prefix) => ({
          id: { startsWith: prefix },
        })),
      ],
    },
    select: { id: true, key: true, userId: true },
  });
  const licenseIds = licenses.map((l) => l.id);

  const paymentOrderWhere = {
    OR: [
      { userId: { in: userIds } },
      { licenseId: { in: licenseIds } },
      { email: { in: TARGET_EMAILS } },
      // Never-captured orders are mock/unverified by definition.
      { paymentConfirmed: false },
    ],
  };

  const paymentWhere = {
    OR: [{ userId: { in: userIds } }, { licenseId: { in: licenseIds } }],
  };

  const emailLogWhere = {
    OR: [{ licenseId: { in: licenseIds } }, { to: { in: TARGET_EMAILS } }],
  };

  const [
    devices,
    payments,
    paymentOrders,
    emailLogs,
    frpRequests,
    pageViews,
  ] = await Promise.all([
    prisma.licenseDevice.count({ where: { licenseId: { in: licenseIds } } }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.paymentOrder.count({ where: paymentOrderWhere }),
    prisma.emailLog.count({ where: emailLogWhere }),
    prisma.frpUnlockRequest.count({ where: { userId: { in: userIds } } }),
    prisma.pageView.count({ where: { userId: { in: userIds } } }),
  ]);

  const counts: Counts = {
    users: users.length,
    licenses: licenses.length,
    devices,
    payments,
    paymentOrders,
    emailLogs,
    frpRequests,
    pageViews,
  };

  return {
    users,
    licenses,
    userIds,
    licenseIds,
    paymentOrderWhere,
    paymentWhere,
    emailLogWhere,
    counts,
  };
}

async function main(): Promise<void> {
  console.log("🧹 FRPB test-data cleanup");
  console.log(`   target emails : ${TARGET_EMAILS.join(", ")}`);
  console.log(`   license prefixes : ${TARGET_LICENSE_ID_PREFIXES.join(", ")}`);
  console.log(`   mode : ${CONFIRM ? "APPLY (deleting)" : "DRY RUN (no writes)"}`);
  console.log("");

  const t = await resolveTargets();

  console.log("Rows matched:");
  log("users", t.counts.users);
  log("licenses", t.counts.licenses);
  log("devices", t.counts.devices);
  log("payments", t.counts.payments);
  log("payment orders", t.counts.paymentOrders);
  log("email logs", t.counts.emailLogs);
  log("frp requests", t.counts.frpRequests);
  log("page views", t.counts.pageViews);
  console.log("");

  if (t.users.length > 0) {
    console.log("Matched users:");
    for (const u of t.users) console.log(`   • ${u.email} (${u.id})`);
  }
  if (t.licenses.length > 0) {
    console.log("Matched licenses:");
    for (const l of t.licenses) console.log(`   • ${l.key} (${l.id})`);
  }
  console.log("");

  const total =
    t.counts.users +
    t.counts.licenses +
    t.counts.devices +
    t.counts.payments +
    t.counts.paymentOrders +
    t.counts.emailLogs +
    t.counts.frpRequests +
    t.counts.pageViews;

  if (total === 0) {
    console.log("✅ Nothing to clean up — the database is already empty of test rows.");
    return;
  }

  if (!CONFIRM) {
    console.log(
      `\n⚠️  DRY RUN: ${total} row(s) would be deleted. Re-run with CONFIRM=1 to apply.`
    );
    return;
  }

  // Delete children before parents so foreign keys are always satisfied,
  // regardless of the schema's default referential actions.
  await prisma.$transaction(async (tx) => {
    await tx.emailLog.deleteMany({ where: t.emailLogWhere });
    await tx.payment.deleteMany({ where: t.paymentWhere });
    await tx.paymentOrder.deleteMany({ where: t.paymentOrderWhere });
    await tx.licenseDevice.deleteMany({ where: { licenseId: { in: t.licenseIds } } });
    await tx.license.deleteMany({ where: { id: { in: t.licenseIds } } });
    await tx.frpUnlockRequest.deleteMany({ where: { userId: { in: t.userIds } } });
    await tx.pageView.deleteMany({ where: { userId: { in: t.userIds } } });
    await tx.user.deleteMany({ where: { id: { in: t.userIds } } });
  });

  console.log(`\n✅ Deleted ${total} row(s). Revenue and license counters are reset.`);
}

main()
  .catch((error) => {
    console.error("❌ Cleanup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
