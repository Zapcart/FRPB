#!/usr/bin/env node
// FRPB — apply pending Prisma migrations to the target database.
//
// Runs `prisma migrate deploy` (NOT `migrate dev`) so production-safe,
// already-committed migrations are applied idempotently BEFORE the app builds
// and boots. This closes the "Database schema is out of date" failure where
// `prisma generate` refreshed the client types but the PostgreSQL schema was
// never migrated.
//
// Behaviour:
//   • SKIP_PRISMA_MIGRATE=1            → skip entirely (CI without DB access).
//   • No DATABASE_URL / DIRECT_URL set → skip with a warning (local build)
//     instead of failing hard.
//   • DB configured but migrate fails  → exit non-zero so the deploy surfaces
//     the real problem instead of silently shipping a stale schema.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(message) {
  console.log(`[migrate-deploy] ${message}`);
}

if (process.env.SKIP_PRISMA_MIGRATE === "1") {
  log("SKIP_PRISMA_MIGRATE=1 set — skipping prisma migrate deploy.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!databaseUrl) {
  log("No DATABASE_URL/DIRECT_URL in env — skipping prisma migrate deploy.");
  process.exit(0);
}

const binName = process.platform === "win32" ? "prisma.cmd" : "prisma";
const localBin = path.join(webRoot, "node_modules", ".bin", binName);
const command = existsSync(localBin) ? localBin : binName;

const result = spawnSync(command, ["migrate", "deploy"], {
  cwd: webRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`[migrate-deploy] failed to run prisma: ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === "number" && result.status !== 0) {
  console.error(`[migrate-deploy] prisma migrate deploy exited with code ${result.status}.`);
  process.exit(result.status);
}

log("Prisma migrations applied.");
