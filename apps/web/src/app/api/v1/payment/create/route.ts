// FRPB — POST /api/v1/payment/create
//
// Creates a DIRECT UPI payment order (self-hosted, zero-MDR) and returns the
// standard NPCI UPI URI + native intent URLs for the checkout page to render.
//
// Security:
//   - The amount is ALWAYS resolved from UPI_PLANS server-side. Any `amount`
//     present in the client payload is ignored entirely — a tampered body can
//     never under-pay.
//   - The order is persisted as PENDING with a hard 10-minute expiry.
//   - Rate limited to prevent abuse / order flooding.
//   - The customer email comes from the authenticated session when available,
//     otherwise from the (validated) request body.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { preflight, withCorsResponse } from "@/lib/cors";
import { getOptionalUser } from "@/lib/supabase/server";
import { upsertPrismaUser } from "@/lib/auth/user-identity";
import {
  UPI_PLANS,
  UPI_MERCHANT_NAME,
  UPI_MERCHANT_VPA,
  generateUpiIntentUrls,
  generateUpiUri,
  getUpiPlan,
} from "@/lib/upi";
import {
  expireStaleOrders,
  generateOrderId,
  orderExpiry,
  planNameFor,
} from "@/lib/payment/orders";
import { rateLimit, checkLockout, recordFailure, clearFailures } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const CreateSchema = z.object({
  planId: z.string().min(1).max(32),
  userEmail: z.string().email().max(160).optional(),
});

const DB_UNAVAILABLE_MESSAGE =
  "We're having trouble reaching our payment system right now. Please try again in a moment.";

/** Returned when an error escapes `handleCreate` entirely. */
const UNHANDLED_MESSAGE = "Database or payment service temporarily unavailable.";

/** Rate limit window — 10 orders per 15 min per IP/email. */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 15 * 60;

/**
 * Reduce a Prisma error code to an operational action. Without this the log
 * says only that the connection failed, which is true but not actionable.
 */
function prismaHint(code: string | null): string {
  switch (code) {
    case "P1000":
      return "Authentication failed — verify the DB password in DATABASE_URL.";
    case "P1001":
      return "Database host unreachable — check the Supabase project is not paused and the host/port are correct.";
    case "P1002":
      return "Connection timed out — the host is reachable but not accepting connections.";
    case "P1017":
      return "Server closed the connection — on Supabase port 6543 this usually means `?pgbouncer=true` is missing from DATABASE_URL.";
    case "P2021":
    case "P2022":
      return "Table/column missing — `prisma migrate deploy` has not been applied to this database.";
    case "P1003":
      return "Database does not exist — check the database name in the connection URL.";
    default:
      return "No recognised Prisma error code — inspect the message and stack above.";
  }
}

/**
 * Log the SHAPE of the connection URL without ever leaking the credential:
 * driver, host, port, database and which tuning flags are present. Invaluable
 * for spotting a pooler port with a missing `pgbouncer=true`, and safe to emit.
 */
function redactConnectionString(raw: string | undefined): string {
  const url = raw?.trim();
  if (!url) return "DATABASE_URL is not set";
  try {
    const u = new URL(url);
    const params = [...u.searchParams.keys()].sort();
    return `${u.protocol}//<redacted>@${u.hostname}:${u.port || "default"}${
      u.pathname
    }${params.length ? `?${params.join("&")}` : ""}`;
  } catch {
    return "DATABASE_URL is set but is not a parseable URL";
  }
}

export async function POST(req: NextRequest) {
  // TOP-LEVEL SAFETY NET.
  //
  // `withCorsResponse(await handleCreate(req))` evaluates the await BEFORE the
  // call is made, so any rejection from handleCreate escaped this handler
  // completely. Next.js then rendered a generic 500 **HTML** error page, which
  // the checkout client could not parse — surfacing as the misleading
  // "trouble reaching our payment system" banner with no actionable cause.
  //
  // Every failure now resolves to structured JSON. The catch block is itself
  // guarded so a throw from `withCorsResponse` (CORS header construction) can
  // never escape either.
  try {
    return withCorsResponse(await handleCreate(req));
  } catch (err) {
    console.error("[payment/create] UNHANDLED ROUTE ERROR:", err);
    // Structured context alongside the raw object — the raw dump alone is hard
    // to query in Vercel log search.
    console.error(
      JSON.stringify({
        tag: "payment/create",
        event: "unhandled_route_error",
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        code: (err as { code?: string })?.code ?? null,
      })
    );

    const body = { success: false, code: "DB_UNAVAILABLE", message: UNHANDLED_MESSAGE };
    try {
      return withCorsResponse(NextResponse.json(body, { status: 503 }));
    } catch {
      // Last resort: still JSON, just without CORS decoration.
      return NextResponse.json(body, { status: 503 });
    }
  }
}

async function handleCreate(req: NextRequest) {
  // 0. Rate limiting — prevent order flooding / abuse.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  const email = "pending"; // placeholder — real email resolved later
  const rateKey = `create:${ip}:${email}`;
  const rateResult = await rateLimit(rateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many payment requests. Please wait before trying again.",
        retryAfter: rateResult.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    );
  }

  // 1. Validate the request body. `amount` is deliberately NOT part of the
  //    schema — accepting it at all would invite a tampered payload.
  let parsed: z.infer<typeof CreateSchema>;
  try {
    parsed = CreateSchema.parse(await req.json());
  } catch (err) {
    await recordFailure([rateKey], 5, 300); // lockout after 5 bad requests
    return NextResponse.json(
      { success: false, message: "Invalid request", detail: (err as Error).message },
      { status: 400 }
    );
  }

  // 2. STRICT AMOUNT LOCK — resolve the plan (and therefore the price) from the
  //    backend table. An unknown planId is simply rejected.
  const plan = getUpiPlan(parsed.planId);
  if (!plan) {
    return NextResponse.json(
      {
        success: false,
        message: `Unknown plan. Valid plans: ${UPI_PLANS.map((p) => p.planId).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // 3. Resolve the buyer email — prefer the authenticated Supabase session.
  //
  //    EVERY step here is optional and individually guarded:
  //      • a missing Supabase env var makes createClient() throw synchronously,
  //      • a Supabase/DB outage makes the lookup reject,
  //      • the local user row may not exist for a first-time buyer.
  //    In all three cases the purchase simply continues as a guest — the
  //    license is bound by email at grant time. Guest checkout must never be a
  //    500.
  let emailAddr = parsed.userEmail ?? null;
  let userId: string | null = null;

  // `getOptionalUser()` was previously OUTSIDE any guard, contradicting the
  // contract documented above. It throws SYNCHRONOUSLY when the Supabase env
  // vars are absent (createClient) and rejects when Supabase is unreachable —
  // either way it produced an unhandled 500 before the order was ever touched.
  // A session lookup is a convenience, never a precondition for paying.
  let user: Awaited<ReturnType<typeof getOptionalUser>> = null;
  try {
    user = await getOptionalUser();
  } catch (err) {
    console.warn("[payment/create] session lookup failed; continuing as guest:", err);
  }

  if (user) {
    emailAddr = user.email;
    try {
      const record = await upsertPrismaUser(prisma, { id: user.id, email: user.email });
      userId = record.id;
    } catch (err) {
      // Auth succeeded but the local user row could not be written. Continue as
      // a guest rather than failing the checkout.
      console.warn("[payment/create] user upsert failed; continuing as guest:", err);
    }
  }

  if (!emailAddr) {
    return NextResponse.json(
      { success: false, message: "An email address is required to receive your license." },
      { status: 400 }
    );
  }

  // Rebuild rate key with real email for accurate tracking.
  const emailRateKey = `create:${ip}:${emailAddr}`;
  const emailRateResult = await rateLimit(emailRateKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!emailRateResult.allowed) {
    await clearFailures([rateKey]);
    return NextResponse.json(
      {
        success: false,
        message: "Too many payment requests for this email. Please wait before trying again.",
        retryAfter: emailRateResult.resetAt - Math.floor(Date.now() / 1000),
      },
      { status: 429 }
    );
  }

  // 4. Housekeeping — retire stale PENDING orders so the table self-heals.
  //    Fire-and-forget, but with an explicit catch: `expireStaleOrders` swallows
  //    internally today, and a bare `void` would silently become an unhandled
  //    rejection if that ever changed.
  void expireStaleOrders().catch((err) => {
    console.warn("[payment/create] stale-order housekeeping failed (non-fatal):", err);
  });

  // 5. Persist the order as PENDING with a 10-minute expiry.
  const orderId = generateOrderId();
  const expiresAt = orderExpiry();

  // PERSIST-OR-FAIL.
  //
  // The order row is the ONLY thing that makes a UPI payment verifiable: the
  // 12-digit UTR is reconciled against it by /payment/verify, and the live
  // status poller reads it every 3 seconds. Returning a QR with no persisted row
  // hands the customer a payment that can never be confirmed — money moves and
  // no license is ever issued.
  //
  // That failure mode is strictly worse than a retry, so a DB outage now fails
  // LOUDLY with a 503 instead of degrading. The amount is still resolved
  // server-side, so nothing about the price is ever client-controlled.
  //
  // For self-hosted UPI:
  //   - paymentConfirmed: false (admin must verify bank statement before license)
  //   - utrSuspicious: will be updated by verify endpoint if UTR looks suspicious
  let order: Awaited<ReturnType<typeof prisma.paymentOrder.create>>;
  try {
    order = await prisma.paymentOrder.create({
      data: {
        orderId,
        userId,
        email: emailAddr,
        planId: plan.planSlug,
        // Persisted from the SERVER-resolved plan, never from the client.
        amount: plan.amount,
        currency: "INR",
        provider: "UPI",
        status: "PENDING",
        // Self-hosted UPI: payment NOT confirmed until admin verifies bank statement.
        paymentConfirmed: false,
        // Will be updated by verify endpoint if UTR looks suspicious.
        utrSuspicious: false,
        expiresAt,
      },
    });
  } catch (err) {
    // This is THE failure behind the checkout banner: `prisma.paymentOrder.create`
    // rejected. Prisma signals runtime connection faults with distinct codes that
    // are otherwise invisible once the error is reduced to a friendly 503 —
    // surfacing them here is what makes the incident diagnosable from logs.
    //   P1000 auth failed · P1001 host unreachable · P1002 connect timeout
    //   P1017 server closed the connection (typical pooler/prepared-statement
    //         rejection when `?pgbouncer=true` is missing on port 6543)
    //   P2021/P2022 table/column missing — migration never applied
    const prismaCode = (err as { code?: string })?.code ?? null;
    console.error("[PAYMENT_CREATE_CRASH]", err);

    // Full stack + structured context. The raw object dump alone is not
    // searchable in Vercel logs, and the stack is the only way to tell a pooler
    // rejection apart from a schema/migration fault.
    console.error(
      JSON.stringify({
        tag: "PAYMENT_CREATE_CRASH",
        event: "order_persistence_failed",
        prismaCode,
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
        hint: prismaHint(prismaCode),
        // Connection shape only — never the credential itself.
        dbUrl: redactConnectionString(process.env.DATABASE_URL),
        hasDirectUrl: Boolean(process.env.DIRECT_URL?.trim()),
        rateLimitKey: emailRateKey,
        planId: parsed.planId,
      })
    );

    // Safe fallback: structured JSON, never an HTML 500 page, so the client can
    // parse it and show a real message instead of a connectivity guess.
    return NextResponse.json(
      { success: false, message: DB_UNAVAILABLE_MESSAGE, code: "DB_UNAVAILABLE" },
      { status: 503 }
    );
  }

  // 6. Build the UPI URI + native intent URLs + clear rate limit on success.
  const upiUri = generateUpiUri({
    orderId: order.orderId,
    planId: plan.planId,
    amount: plan.amount,
  });

  // Clear rate limit failures on successful order creation.
  await clearFailures([rateKey, emailRateKey]);

  return NextResponse.json(
    {
      success: true,
      order: {
        orderId: order.orderId,
        planId: plan.planId,
        planSlug: plan.planSlug,
        planName: planNameFor(plan.planSlug),
        amount: plan.amount,
        currency: "INR",
        provider: "UPI",
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        expiresAt: order.expiresAt.toISOString(),
        /** Seconds until expiry — drives the checkout countdown. */
        expiresInSeconds: Math.max(
          0,
          Math.floor((order.expiresAt.getTime() - Date.now()) / 1000)
        ),
      },
      merchant: { vpa: UPI_MERCHANT_VPA, name: UPI_MERCHANT_NAME },
      upiUri,
      intentUrls: generateUpiIntentUrls(upiUri),
      /**
       * Wire-compatibility field. Order persistence is now mandatory — a DB
       * outage returns 503 above — so this is always true. Retained so older
       * clients that branch on it keep working.
       */
      persisted: true,
    },
    { status: 201 }
  );
}
