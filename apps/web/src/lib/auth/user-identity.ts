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
//
// Performance (plans/performance-optimization.md §Task 2.4): a resolved row is
// cached for 60 s (shared Redis, else per-process memory) under both the
// supabaseId and normalized-email keys. Every write path invalidates before
// re-populating, so the cache can never mask a just-created or re-keyed row.
// Only the fields consumers actually read (`id`, `email`, `supabaseId`) are
// cached — the JSON-serialised shape carries no `Date`/relation data.

import type { PrismaClient } from "@prisma/client";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache";

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

/** Minimal, JSON-safe projection of a User row that callers consume. */
export interface ResolvedUser {
  id: string;
  email: string;
  supabaseId: string | null;
}

const IDENTITY_TTL_SECONDS = 60;

const sidKey = (supabaseId: string) => `uid:v1:sid:${supabaseId}`;
const emKey = (email: string) => `uid:v1:em:${email}`;

// Coalesce concurrent identical resolutions on this instance so a burst of
// requests for the same user shares one DB round-trip (in-memory only; harmless
// when multiple instances each do their own).
const inflight = new Map<string, Promise<ResolvedUser | null>>();

/** Persist a resolved row under BOTH lookup keys. Never throws (fail-open). */
async function cacheIdentity(user: ResolvedUser, supabaseId: string): Promise<void> {
  const payload: ResolvedUser = {
    id: user.id,
    email: user.email,
    supabaseId: user.supabaseId,
  };
  await Promise.all([
    cacheSet(sidKey(supabaseId), payload, IDENTITY_TTL_SECONDS),
    cacheSet(emKey(normalizeEmail(user.email)), payload, IDENTITY_TTL_SECONDS),
  ]);
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
): Promise<ResolvedUser | null> {
  const email = identity.email ? normalizeEmail(identity.email) : null;

  // Fast path: a cached row keyed by the immutable Supabase id.
  const cached = await cacheGet<ResolvedUser>(sidKey(identity.id));
  if (cached) return cached;

  const existing = inflight.get(sidKey(identity.id));
  if (existing) return existing;

  const pending = (async (): Promise<ResolvedUser | null> => {
    // Re-check the cache — another (coalesced) caller may have populated it.
    const again = await cacheGet<ResolvedUser>(sidKey(identity.id));
    if (again) return again;

    // 1. Stable key first.
    const bySupabaseId = await prisma.user.findUnique({
      where: { supabaseId: identity.id },
    });
    if (bySupabaseId) {
      await cacheIdentity(bySupabaseId, identity.id);
      return bySupabaseId;
    }

    if (!email) return null;

    // 2. Legacy/edge rows keyed only by email.
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (!byEmail) return null;

    // Backfill the stable key so future lookups skip this branch. Guarded: a
    // unique-constraint race (another request already backfilled) is harmless.
    if (!byEmail.supabaseId) {
      try {
        const updated = await prisma.user.update({
          where: { id: byEmail.id },
          data: { supabaseId: identity.id },
        });
        await cacheIdentity(updated, identity.id);
        return updated;
      } catch {
        await cacheIdentity(byEmail, identity.id);
        return byEmail;
      }
    }
    await cacheIdentity(byEmail, identity.id);
    return byEmail;
  })().finally(() => inflight.delete(sidKey(identity.id)));

  inflight.set(sidKey(identity.id), pending);
  return pending;
}

/**
 * Upsert the Prisma User for a Supabase identity using the CANONICAL email.
 * Both checkout and the webhook funnel through here so exactly one row is ever
 * created per Supabase account.
 *
 * Invalidates the identity cache (supabaseId + both old/new email keys) before
 * repopulating, so a freshly-created or re-keyed row is never masked by a
 * stale read.
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
    const previousEmail = normalizeEmail(existingBySupabaseId.email);
    if (existingBySupabaseId.email !== email) {
      try {
        const updated = await prisma.user.update({
          where: { id: existingBySupabaseId.id },
          data: { email },
        });
        await cacheDel(sidKey(identity.id), emKey(previousEmail), emKey(email));
        await cacheIdentity(updated, identity.id);
        return updated;
      } catch {
        // Email already taken by a different row — keep the existing row.
        await cacheDel(emKey(email));
        await cacheIdentity(existingBySupabaseId, identity.id);
        return existingBySupabaseId;
      }
    }
    await cacheIdentity(existingBySupabaseId, identity.id);
    return existingBySupabaseId;
  }

  const row = await prisma.user.upsert({
    where: { email },
    update: { supabaseId: identity.id },
    create: { email, supabaseId: identity.id },
  });
  await cacheDel(emKey(email));
  await cacheIdentity(row, identity.id);
  return row;
}
