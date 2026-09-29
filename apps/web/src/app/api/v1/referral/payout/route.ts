// FRPB — POST /api/v1/referral/payout
//
// VIP cash payout request. The authenticated user asks to cash out part of
// their released balance; the service atomically RESERVES funds
// ({cashBalanceCents: {gte: amount}}) so concurrent requests can never
// over-draw. Denials map to precise HTTP semantics:
//
//   user_not_found        → 404
//   below_minimum         → 400 (amount under the configured minimum)
//   insufficient_balance  → 400 (amount exceeds the released balance)
//   db_error              → 503 (transient)
//
// The response is never cached.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { ApiEnvelope } from "@frpb/shared";
import {
  requestPayout,
  type PayoutRequestInput,
  type PayoutDenial,
} from "@/lib/referral/service";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

interface PayoutBody {
  amountCents?: unknown;
  method?: unknown;
  destination?: unknown;
}

export interface ReferralPayoutResponse extends ApiEnvelope {
  data?: {
    payoutId: string;
    balanceCents: number;
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  return withCorsResponse(await handlePayout(req));
}

async function readBody(req: NextRequest): Promise<PayoutBody> {
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object") return parsed as PayoutBody;
  } catch {
    // Malformed body → treated as empty → validation below rejects it.
  }
  return {};
}

/** Coerce a loosely-typed body into a validated {@link PayoutRequestInput}. */
function parseInput(body: PayoutBody): PayoutRequestInput | null {
  const amountCents =
    typeof body.amountCents === "number" && Number.isFinite(body.amountCents)
      ? Math.floor(body.amountCents)
      : NaN;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

  const method = typeof body.method === "string" ? body.method.trim() : null;
  const destination =
    typeof body.destination === "string" ? body.destination.trim() : null;

  return { amountCents, method, destination };
}

/** Human-readable message for each denial reason. */
function denialMessage(error: PayoutDenial): string {
  switch (error) {
    case "below_minimum":
      return "Your payout is below the minimum cash-out amount.";
    case "insufficient_balance":
      return "Your available balance is too low for this payout.";
    case "user_not_found":
      return "Account not found.";
    case "db_error":
    default:
      return "We couldn't process your payout right now. Please try again.";
  }
}

/** HTTP status for each denial reason (defaults to 503 for transient errors). */
function denialStatus(error: PayoutDenial): number {
  switch (error) {
    case "below_minimum":
    case "insufficient_balance":
      return 400;
    case "user_not_found":
      return 404;
    case "db_error":
    default:
      return 503;
  }
}

async function handlePayout(req: NextRequest): Promise<Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json<ReferralPayoutResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await readBody(req);
  const input = parseInput(body);
  if (!input) {
    return NextResponse.json<ReferralPayoutResponse>(
      { success: false, message: "Enter a valid payout amount." },
      { status: 400 }
    );
  }

  try {
    const appUser = await resolvePrismaUser(prisma, {
      id: user.id,
      email: user.email,
    });
    if (!appUser) {
      return NextResponse.json<ReferralPayoutResponse>(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    const result = await requestPayout(appUser.id, input);
    if (!result.ok || !result.payoutId) {
      const error: PayoutDenial = result.error ?? "db_error";
      return NextResponse.json<ReferralPayoutResponse>(
        { success: false, message: denialMessage(error) },
        { status: denialStatus(error) }
      );
    }

    return NextResponse.json<ReferralPayoutResponse>(
      {
        success: true,
        data: { payoutId: result.payoutId, balanceCents: result.balanceCents },
      },
      { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("[referral/payout] failed to process payout:", err);
    return NextResponse.json<ReferralPayoutResponse>(
      { success: false, message: "We couldn't process your payout right now. Please try again." },
      { status: 503 }
    );
  }
}
