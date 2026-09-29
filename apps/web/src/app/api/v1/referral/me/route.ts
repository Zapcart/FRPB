// FRPB — GET /api/v1/referral/me
//
// Authenticated. Returns the caller's full gamified-referral dashboard payload:
// referral code + share link, the live unlock progress (Route A / Route B),
// pending vs qualified counts, VIP cash balance and payout history.
//
// This is the single read model the Referral Modal / Battery Progress Bar /
// VIP Cash Affiliate Hub render from. It NEVER mutates referral state — all
// writes flow through the dedicated POST routes (or payment settlement).
//
// Security mirrors license/reveal:
//   - requires a validated Supabase session (getUser, server-side JWT check)
//   - the subject is the canonical Prisma user (supabaseId → normalized email),
//     never a client-supplied id
//   - responses are never cached

import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { upsertPrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { ApiEnvelope } from "@frpb/shared";
import { getReferralSummary, type ReferralSummary } from "@/lib/referral/service";

export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export interface ReferralMeResponse extends ApiEnvelope {
  data?: { summary: ReferralSummary };
}

export async function GET() {
  return withCorsResponse(await handleMe());
}

async function handleMe(): Promise<Response> {
  // Guarded BEFORE instantiation: `createClient()` throws synchronously when the
  // Supabase env vars are absent (a misconfigured deployment / missing secret).
  // Without this check that throw escaped the try/catch and surfaced as an
  // uncaught 500; we now return a structured 503 the client renders as a
  // transient "try again" state instead.
  if (!isSupabaseConfigured()) {
    console.error("[referral/me] Supabase is not configured; NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing.");
    return NextResponse.json<ReferralMeResponse>(
      { success: false, message: "Referral service is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  let user: { id: string; email?: string | null } | null = null;
  try {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (err) {
    // Auth-provider/network failure is not an unauthorized state — surface it as
    // a transient 503 so the client retries rather than forcing a sign-in CTA.
    console.error("[referral/me] failed to resolve Supabase session:", err);
    return NextResponse.json<ReferralMeResponse>(
      { success: false, message: "We couldn't verify your session right now. Please try again." },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  if (!user?.email) {
    // Expected unauthenticated state: a benign 401 the client treats as
    // "signed out" (surfacing a sign-in CTA) rather than an error. Marked
    // no-store so no edge/CDN layer can cache a stale auth rejection.
    return NextResponse.json<ReferralMeResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }

  try {
    // Auto-onboard: a signed-in user who has never purchased has no Prisma row
    // yet. Upsert it on demand so referral onboarding never 404s for
    // non-purchasing visitors (the identity module keeps exactly one row per
    // Supabase account via the stable supabaseId key).
    const appUser = await upsertPrismaUser(prisma, { id: user.id, email: user.email });

    const summary = await getReferralSummary(appUser.id);
    if (!summary) {
      return NextResponse.json<ReferralMeResponse>(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json<ReferralMeResponse>(
      { success: true, data: { summary } },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (err) {
    console.error("[referral/me] failed to load summary:", err);
    return NextResponse.json<ReferralMeResponse>(
      { success: false, message: "We couldn't load your referral data right now. Please try again." },
      { status: 503 }
    );
  }
}
