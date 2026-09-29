// FRPB — POST /api/v1/referral/unlock
//
// Gamified self-unlock endpoint. Two server-authoritative paths:
//
//   1. Route A / Route B (default): re-evaluate the authenticated user's
//      QUALIFIED referrals and grant the free Lifetime license the instant a
//      route completes. Idempotent — an already-unlocked user short-circuits.
//
//   2. Downsell (`{ orderId, downsell: true }`): a paid $75 Lifetime order
//      unlocks the buyer immediately. The amount + status are re-verified
//      server-side inside the service so a client can never forge the price.
//
// The response is never cached and only ever reflects the caller's own account.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { ApiEnvelope } from "@frpb/shared";
import {
  recomputeUnlock,
  handleDownsellUnlock,
  type UnlockResult,
} from "@/lib/referral/service";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

interface UnlockBody {
  orderId?: unknown;
  downsell?: unknown;
}

export interface ReferralUnlockResponse extends ApiEnvelope {
  data?: UnlockResult;
}

export async function POST(req: NextRequest): Promise<Response> {
  return withCorsResponse(await handleUnlock(req));
}

async function readBody(req: NextRequest): Promise<UnlockBody> {
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object") return parsed as UnlockBody;
  } catch {
    // Empty / malformed body is fine — defaults to the referral recompute path.
  }
  return {};
}

async function handleUnlock(req: NextRequest): Promise<Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json<ReferralUnlockResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await readBody(req);
  const wantsDownsell = body.downsell === true;
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";

  try {
    const appUser = await resolvePrismaUser(prisma, {
      id: user.id,
      email: user.email,
    });
    if (!appUser) {
      return NextResponse.json<ReferralUnlockResponse>(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    if (wantsDownsell) {
      if (!orderId) {
        return NextResponse.json<ReferralUnlockResponse>(
          { success: false, message: "Missing orderId for the downsell unlock." },
          { status: 400 }
        );
      }
      const downsell = await handleDownsellUnlock(orderId);
      return NextResponse.json<ReferralUnlockResponse>(
        {
          success: true,
          data: {
            unlocked: downsell.unlocked,
            route: "DOWNSELL",
            percent: downsell.unlocked ? 100 : 0,
            licenseId: downsell.licenseId,
          },
        },
        { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    const result = await recomputeUnlock(appUser.id);
    return NextResponse.json<ReferralUnlockResponse>(
      { success: true, data: result },
      { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("[referral/unlock] failed to evaluate unlock:", err);
    return NextResponse.json<ReferralUnlockResponse>(
      {
        success: false,
        message: "We couldn't check your unlock status right now. Please try again.",
      },
      { status: 503 }
    );
  }
}
