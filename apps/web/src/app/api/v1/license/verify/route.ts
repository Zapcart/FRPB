// FRPB — POST /api/v1/license/verify
// Desktop app online verification. Anti-fraud: rate limit per IP + HWID,
// brute-force lockout, validation via shared zod schema. (Blueprint §5.0/§5.1)

import { NextRequest, NextResponse } from "next/server";
import { VerifyRequestSchema } from "@frpb/shared";
import { prisma } from "@/lib/prisma";
import { verifyLicenseCore } from "@/lib/license/verify";
import { isMasterTestKey } from "@/lib/license/test-key";
import {
  rateLimit,
  checkLockout,
  recordFailure,
  clearFailures,
} from "@/lib/rate-limit";

// Runtime-only route (rate limiting, DB) — never statically prerender.
export const dynamic = "force-dynamic";

// 10 req/min per (IP, HWID); 5 consecutive failures → 1h lockout.
const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 60;
const MAX_FAILURES = 5;
const LOCKOUT_SECONDS = 60 * 60;

// ─── Master test key (development only) ────────────────────────────────
// Returns a synthetic ACTIVE LIFETIME profile so the desktop app can run
// through the full activate → dashboard flow locally without live payment
// webhooks or a DB-backed license row. Hard-disabled in production.
function masterTestProfile(key: string) {
  return {
    success: true,
    status: "ACTIVE",
    message: "License activated (FRPB master test key)",
    license: {
      key,
      plan: "LIFETIME",
      planName: "Lifetime Plan",
      expiresAt: null,
      deviceLimit: 5,
      devicesUsed: 1,
      activatedAt: new Date().toISOString(),
    },
  } as const;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  // Top-level catch-all: no matter what happens below (unexpected Prisma
  // errors, rate-limiter failures, serialization issues), the client always
  // receives structured JSON — never an HTML error page or an empty 500.
  try {
    return await verify(req);
  } catch (err) {
    console.error("[license/verify] unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        status: "SERVER_ERROR",
        message: "We couldn't process the request right now. Please try again in a moment.",
      },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function verify(req: NextRequest) {
  const ip = clientIp(req);

  // 1. Body validation (cheap) before any rate-limit writes
  let parsed;
  try {
    parsed = VerifyRequestSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, status: "INVALID_REQUEST", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        status: "INVALID_REQUEST",
        message: parsed.error.issues[0]?.message ?? "Invalid request",
      },
      { status: 400 }
    );
  }

  const { licenseKey, hardwareId, deviceName } = parsed.data;

  // 1.5 Master test key — dev-only shortcut. `isMasterTestKey` is hard-disabled
  //     in production, so this branch only runs during local development. It
  //     bypasses the database entirely (no Prisma connection attempt) and
  //     returns a synthetic ACTIVE LIFETIME profile so the desktop app can run
  //     through the full activate → dashboard flow instantly — even when the
  //     Supabase DB is unreachable. Rate-limit and lockout are intentionally
  //     skipped so local testing stays frictionless.
  if (isMasterTestKey(licenseKey)) {
    return NextResponse.json(masterTestProfile(licenseKey.trim().toUpperCase()));
  }

  // 2. Rate limit per IP and per HWID (fixed-window counters)
  const ipKey = `verify:ip:${ip}`;
  const hwidKey = `verify:hwid:${hardwareId}`;
  const [ipRl, hwidRl] = await Promise.all([
    rateLimit(ipKey, MAX_PER_WINDOW, WINDOW_SECONDS),
    rateLimit(hwidKey, MAX_PER_WINDOW, WINDOW_SECONDS),
  ]);

  if (!ipRl.allowed || !hwidRl.allowed) {
    return NextResponse.json(
      {
        success: false,
        status: "RATE_LIMITED",
        message: "Too many attempts. Please try again later.",
        retryAfterSeconds: Math.max(ipRl.resetAt, hwidRl.resetAt) - Math.floor(Date.now() / 1000),
      },
      { status: 429, headers: { "Retry-After": String(Math.max(ipRl.resetAt, hwidRl.resetAt) - Math.floor(Date.now() / 1000)) } }
    );
  }

  // 3. Brute-force lockout check
  if (await checkLockout([ipKey, hwidKey])) {
    return NextResponse.json(
      { success: false, status: "LOCKED", message: "Account temporarily locked. Try again later." },
      { status: 423 }
    );
  }

  // 4. Core verification (UNBOUND re-activation, device limits, expiry).
  //    Guarded: if the DB is unreachable, return a structured 503 instead of
  //    letting the Prisma error bubble into an empty-bodied 500 that the
  //    desktop client can't render meaningfully.
  let result: Awaited<ReturnType<typeof verifyLicenseCore>>;
  try {
    result = await verifyLicenseCore({ prisma, key: licenseKey, hardwareId, deviceName });
  } catch (err) {
    console.error("[license/verify] DB unreachable during verification:", err);
    return NextResponse.json(
      {
        success: false,
        status: "SERVER_ERROR",
        message:
          "We couldn't reach our license servers right now. Please check your connection and try again in a moment.",
      },
      { status: 503 }
    );
  }

  // 5. On failure → record failure; on success → clear counter
  if (!result.body.success) {
    await recordFailure([ipKey, hwidKey], MAX_FAILURES, LOCKOUT_SECONDS);
  } else {
    await clearFailures([ipKey, hwidKey]);
  }

  return NextResponse.json(result.body, { status: result.httpStatusCode });
}
