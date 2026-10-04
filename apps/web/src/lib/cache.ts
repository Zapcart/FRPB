// FRPB — shared TTL cache (Upstash Redis REST, in-memory fallback).
//
// Mirrors the backend-resolution + fail-open philosophy of [`rate-limit.ts`](frpb/apps/web/src/lib/rate-limit.ts:1):
//   • Production uses Upstash Redis REST (reads UPSTASH_REDIS_REST_URL/TOKEN),
//     so the cache is SHARED across serverless/PM2 instances.
//   • Local dev / a host without Redis transparently falls back to a per-process
//     TTL Map. Still correct, just not shared across instances.
//   • Every store operation FAILS OPEN: a degraded or unreachable cache must
//     never throw into a request path — a miss simply re-reads the source of
//     truth (the database).
//
// Values are JSON-serialised, so callers must pass JSON-safe payloads and must
// not assume `Date` instances survive a round-trip (persist ISO strings and
// revive on read where a real `Date` is needed).

import { Redis } from "@upstash/redis";

// ─── Backend resolution ────────────────────────────────────────────────────
let _redis: Redis | null = null;
let _redisFailed = false;

function getRedis(): Redis | null {
  if (_redisFailed) return null;
  if (!_redis) {
    // Redis.fromEnv() does NOT throw when the UPSTASH_REDIS_* vars are missing
    // — it builds a client with an undefined URL that only fails at request
    // time. Guard explicitly so an un-provisioned host falls back to memory.
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redisFailed = true;
      return null;
    }
    try {
      _redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
    } catch {
      _redisFailed = true;
      return null;
    }
  }
  return _redis;
}

// Minimal TTL Map used only when Redis is unavailable (single-instance dev).
class MemoryKV {
  private store = new Map<string, { value: string; expiresAt: number }>();

  get(key: string): string | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(...keys: string[]): void {
    for (const k of keys) this.store.delete(k);
  }
}

const mem = new MemoryKV();

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Read a cached value. Returns `null` on a miss AND on any store failure
 * (fail-open), so a cache outage degrades to "always re-read the DB" rather
 * than an error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get<T>(key);
      return (value ?? null) as T | null;
    } catch (err) {
      console.error(`[cache] get failed for "${key}" — treating as a miss:`, err);
      return null;
    }
  }

  const raw = mem.get(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[cache] corrupt memory entry for "${key}" — dropping:`, err);
    mem.del(key);
    return null;
  }
}

/** Write a JSON-safe value with a TTL. Never throws (fail-open). */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      console.error(`[cache] set failed for "${key}" — continuing uncached:`, err);
    }
    return;
  }

  try {
    mem.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    console.error(`[cache] set failed for "${key}" — continuing uncached:`, err);
  }
}

/** Delete one or more keys. Never throws (fail-open). */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(...keys);
    } catch (err) {
      console.error(`[cache] del failed for [${keys.join(", ")}] — continuing:`, err);
    }
    return;
  }
  mem.del(...keys);
}
