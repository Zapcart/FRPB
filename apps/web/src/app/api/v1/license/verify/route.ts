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
import { preflight, withCorsResponse } from "@/lib/cors";

// Runtime-only route (rate limiting, DB) — never statically prerender.
export const dynamic = "force-dynamic";

// CORS preflight — the Electron client calls this endpoint cross-origin.
export const OPTIONS = preflight;

// 10 req/min per (IP, HWID); 5 consecutive failures → 1h lockout.
const MAX_PER_WINDOW = 10;
const WINDOW_SECONDS = 60;
const MAX_FAILURES = 5;
const LOCKOUT_SECONDS = 60 * 60;

// ─── Master test key (DEVELOPMENT ONLY) ────────────────────────────────
// Returns a synthetic ACTIVE LIFETIME profile so the desktop app can run
// through the full activate → dashboard flow locally without live payment
// webhooks or a DB-backed license row.
//
// The `FRPB-TEST-*` key is PUBLISHED in this repository, so accepting it in
// production would let anyone activate for free. `isMasterTestKey` is
// therefore fail-closed: it returns false in production unless
// ALLOW_DEV_TEST_KEYS=true was set deliberately.
function masterTestProfile(key: string) {
  return {
    success: true,
    status: "ACTIVE",
    message: "License activated (FRPB master test key)",
    // Marks the response as a dev/test bypass so it is never mistaken for a
    // purchased entitlement.
    isMasterTest: true,
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
  // Every branch gains the CORS headers at this single boundary.
  try {
    return withCorsResponse(await verify(req));
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

  // 1. Read + parse the body (cheap, no DB, no rate-limit writes).
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, status: "INVALID_REQUEST", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // 1.1 MASTER TEST KEY — evaluated FIRST, before strict schema validation.
  //
  //     Order matters: the shortcut must not depend on the client sending a
  //     well-formed `hardwareId`/`deviceName`. If it ran after `safeParse`, a
  //     desktop build whose hardware fingerprint failed to resolve (or a plain
  //     curl probe) would get a 400 and never reach the bypass — the exact
  //     "can't activate locally" class of failure this exists to prevent.
  //
  //     It remains strictly dev-gated: `isMasterTestKey` is fail-closed in
  //     production unless ALLOW_DEV_TEST_KEYS=true was set deliberately (the
  //     key is published in this repo, so accepting it in prod would hand out
  //     free entitlements).
  //
  //     On success it bypasses the DB and rate-limiter entirely and returns a
  //     synthetic ACTIVE LIFETIME profile, so activation works even when the
  //     Supabase database is unreachable.
  const probeKey =
    typeof (rawBody as { licenseKey?: unknown })?.licenseKey === "string"
      ? (rawBody as { licenseKey: string }).licenseKey
      : "";
  if (probeKey && isMasterTestKey(probeKey)) {
    return NextResponse.json(masterTestProfile(probeKey.trim().toUpperCase()));
  }

  // 2. Strict schema validation for every real licence key.
  const parsed = VerifyRequestSchema.safeParse(rawBody);
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
