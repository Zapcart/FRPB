// FRPB — canonical Supabase ↔ Prisma user identity resolution.
//
// The bug this module exists to eliminate: every license route matched the
// Prisma User purely on `email`, while checkout wrote the row with the RAW
// Supabase email and the webhook upserted with a LOWERCASED one. Because
// `User.email` is `@unique` but Postgres treats "User@X.com" and "user@x.com"
// as different values, a mixed-case signup could create TWO rows — the license
// attached to one, the dashboard query hitting the other. Result: a signed-in
// user seeing "no licenses" / the yellow "Choose a plan" warning.
//
// This module makes user identity a single, stable thing:
//   1. `supabaseId` (the immutable Supabase Auth UUID) when known — the only
//      identifier that survives an email change.
//   2. Otherwise the NORMALIZED (lowercased, trimmed) email.
// Whenever a row is found by email but is missing the supabaseId, we backfill
// it, so future lookups use the stable key.

import type { PrismaClient } from "@prisma/client";

/** Canonical form of an email used for every Prisma read/write. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface SupabaseIdentity {
  /** Supabase Auth user UUID. */
  id: string;
  /** Email as reported by Supabase (may be mixed case). */
  email?: string | null;
}

/**
 * Resolve the canonical Prisma User row for a Supabase identity.
 *
 * Lookup order:
 *   1. `supabaseId` — stable across email changes.
 *   2. normalized `email` — legacy rows created before supabaseId was stored.
 *
 * When found by email without a supabaseId, the id is backfilled so subsequent
 * requests take the fast, stable path. Returns `null` when the user has never
 * purchased (no Prisma row yet) — callers must treat that as "no licenses",
 * never as an error.
 */
export async function resolvePrismaUser(
  prisma: PrismaClient,
  identity: SupabaseIdentity
) {
  const email = identity.email ? normalizeEmail(identity.email) : null;

  // 1. Stable key first.
  const bySupabaseId = await prisma.user.findUnique({
    where: { supabaseId: identity.id },
  });
  if (bySupabaseId) return bySupabaseId;

  if (!email) return null;

  // 2. Legacy/edge rows keyed only by email.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (!byEmail) return null;

  // Backfill the stable key so future lookups skip this branch. Guarded: a
  // unique-constraint race (another request already backfilled) is harmless.
  if (!byEmail.supabaseId) {
    try {
      return await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseId: identity.id },
      });
    } catch {
      return byEmail;
    }
  }
  return byEmail;
}

/**
 * Upsert the Prisma User for a Supabase identity using the CANONICAL email.
 * Both checkout and the webhook funnel through here so exactly one row is ever
 * created per Supabase account.
 */
export async function upsertPrismaUser(
  prisma: PrismaClient,
  identity: SupabaseIdentity & { email: string }
) {
  const email = normalizeEmail(identity.email);

  // Prefer attaching to an existing row found by the stable key (handles an
  // email change without creating a duplicate).
  const existingBySupabaseId = await prisma.user.findUnique({
    where: { supabaseId: identity.id },
  });
  if (existingBySupabaseId) {
    if (existingBySupabaseId.email !== email) {
      try {
        return await prisma.user.update({
          where: { id: existingBySupabaseId.id },
          data: { email },
        });
      } catch {
        // Email already taken by a different row — keep the existing row.
        return existingBySupabaseId;
      }
    }
    return existingBySupabaseId;
  }

  return prisma.user.upsert({
    where: { email },
    update: { supabaseId: identity.id },
    create: { email, supabaseId: identity.id },
  });
}
