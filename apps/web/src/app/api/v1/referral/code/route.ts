// FRPB — POST /api/v1/referral/code
//
// Authenticated. Returns the caller's referral code + share link, MINTING one
// on first use. Idempotent by design: `ReferralCode.userId` is @unique, so a
// double-click or concurrent first request can never allocate two codes — the
// service layer falls back to the winner's row.
//
// No request body is required. Mirrors license/unbind's envelope + status model.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { ApiEnvelope } from "@frpb/shared";
import { getOrCreateReferralCode } from "@/lib/referral/service";
import { discountedPriceCents } from "@/lib/referral/config";

export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export interface ReferralCodeResponse extends ApiEnvelope {
  data?: {
    code: string;
    link: string | null;
    /** The discounted Lifetime price a referred friend pays, in cents. */
    lifetimeDiscountedCents: number;
  };
}

export async function POST() {
  return withCorsResponse(await handleCode());
}

function siteBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

async function handleCode(): Promise<Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json<ReferralCodeResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const appUser = await resolvePrismaUser(prisma, { id: user.id, email: user.email });
    if (!appUser) {
      return NextResponse.json<ReferralCodeResponse>(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    const row = await getOrCreateReferralCode(appUser.id);
    if (!row) {
      return NextResponse.json<ReferralCodeResponse>(
        { success: false, message: "We couldn't generate your referral link right now. Please try again." },
        { status: 503 }
      );
    }

    const base = siteBaseUrl();
    return NextResponse.json<ReferralCodeResponse>(
      {
        success: true,
        data: {
          code: row.code,
          link: base
            ? `${base}/checkout?ref=${encodeURIComponent(row.code)}`
            : null,
          lifetimeDiscountedCents: discountedPriceCents("LIFETIME"),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (err) {
    console.error("[referral/code] failed to issue code:", err);
    return NextResponse.json<ReferralCodeResponse>(
      { success: false, message: "We couldn't generate your referral link right now. Please try again." },
      { status: 503 }
    );
  }
}
