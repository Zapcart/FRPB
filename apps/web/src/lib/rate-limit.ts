// FRPB — anti-fraud rate limiting + brute-force lockout.
// Production: Upstash Redis REST (reads UPSTASH_REDIS_REST_URL/TOKEN).
// Local dev: transparent in-memory fallback so the verify route works
// without provisioning Redis. Mirrors plans/frpb-architecture-blueprint.md §5.0.

import { Redis } from "@upstash/redis";

// ─── Backend resolution ────────────────────────────────────────────────────
let _redis: Redis | null = null;
let _redisFailed = false;

function getRedis(): Redis | null {
  if (_redisFailed) return null;
  if (!_redis) {
    // Redis.fromEnv() does NOT throw when UPSTASH_REDIS_* vars are missing —
    // it builds a client with an undefined URL that only fails at request time
    // ("Failed to parse URL from /pipeline"). Guard explicitly so local dev
    // falls back to the in-memory store as documented above.
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      _redisFailed = true;
      return null;
    }
    try {
      _redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
    } catch {
      // Unrecoverable construction failure → use the in-memory store.
      _redisFailed = true;
      return null;
    }
  }
  return _redis;
}

// Minimal TTL Map used only when Redis is unavailable (single-instance dev).
class MemoryKV {
  private store = new Map<string, { value: number; expiresAt: number }>();

  private live(key: string): { value: number; expiresAt: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  get(key: string): number | undefined {
    return this.live(key)?.value;
  }

  incr(key: string, ttlSeconds: number): number {
    const entry = this.live(key);
    const value = (entry?.value ?? 0) + 1;
    this.store.set(key, {
      value,
      // Refresh the TTL on first write only (fixed-window bucket semantics).
      expiresAt: entry ? entry.expiresAt : Date.now() + ttlSeconds * 1000,
    });
    return value;
  }

  set(key: string, value: number, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(...keys: string[]): void {
    for (const k of keys) this.store.delete(k);
  }
}

const mem = new MemoryKV();

// ─── Rate limit ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch seconds when the window resets
}

// Fixed-window counter — one bucket per (key, windowStart)
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const redisKey = `rl:${key}:${windowStart}`;

  const redis = getRedis();
  let count: number;
  if (redis) {
    count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
  } else {
    count = mem.incr(redisKey, windowSeconds);
  }

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt: windowStart + windowSeconds,
  };
}

// ─── Brute-force lockout ──────────────────────────────────────────────────

export async function checkLockout(keys: string[]): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const results = await Promise.all(keys.map((k) => redis.get(`lock:${k}`)));
    return results.some((v) => v === "1" || v === 1);
  }
  return keys.some((k) => mem.get(`lock:${k}`) === 1);
}

export async function recordFailure(
  keys: string[],
  maxFailures: number,
  lockoutSeconds: number
): Promise<{ lockedNow: boolean }> {
  const redis = getRedis();
  let lockedNow = false;

  for (const k of keys) {
    let count: number;
    if (redis) {
      count = await redis.incr(`fail:${k}`);
      if (count === 1) await redis.expire(`fail:${k}`, lockoutSeconds);
    } else {
      count = mem.incr(`fail:${k}`, lockoutSeconds);
    }

    if (count >= maxFailures) {
      if (redis) {
        await redis.set(`lock:${k}`, "1", { ex: lockoutSeconds });
        await redis.del(`fail:${k}`); // reset counter after locking
      } else {
        mem.set(`lock:${k}`, 1, lockoutSeconds);
        mem.del(`fail:${k}`);
      }
      lockedNow = true;
    }
  }
  return { lockedNow };
}

export async function clearFailures(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const delKeys = keys.map((k) => `fail:${k}`);
  const redis = getRedis();
  if (redis) await redis.del(...delKeys);
  else mem.del(...delKeys);
}
