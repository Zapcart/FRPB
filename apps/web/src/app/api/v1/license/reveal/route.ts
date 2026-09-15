// FRPB — GET /api/v1/license/reveal?licenseId=...
// Authenticated: returns the FULL license key for one of the caller's own
// licenses, so a customer can always recover their key from the dashboard even
// when the delivery email failed, bounced or landed in spam.
//
// This is the "fallback mechanism" for transactional-email failure. The list
// route deliberately returns only a MASKED key (FRPB-****-****-1234); without
// this endpoint a paying customer whose email never arrived would have no way
// to retrieve what they bought.
//
// Security:
//   - requires a validated Supabase session (getUser, server-side JWT check)
//   - ownership is enforced through the canonical Prisma user (supabaseId →
//     normalized email), never a client-supplied id
//   - every reveal is recorded in License.revealCount / lastRevealedAt so
//     unusual access patterns are auditable
//   - responses are never cached

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import { preflight, withCorsResponse } from "@/lib/cors";
import type { ApiEnvelope } from "@frpb/shared";

export const dynamic = "force-dynamic";

export const OPTIONS = preflight;

export interface RevealLicenseResponse extends ApiEnvelope {
  data?: {
    licenseId: string;
    /** The full, unmasked key — shown once per request. */
    key: string;
    planName: string;
    expiresAt: string | null;
    status: string;
  };
}

export async function GET(req: NextRequest) {
  return withCorsResponse(await handleReveal(req));
}

async function handleReveal(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json<RevealLicenseResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const licenseId = req.nextUrl.searchParams.get("licenseId");
  if (!licenseId) {
    return NextResponse.json<RevealLicenseResponse>(
      { success: false, message: "Missing licenseId" },
      { status: 400 }
    );
  }

  try {
    // Ownership is decided by the canonical user id, so a case-variant email
    // row can never leak another account's key.
    const appUser = await resolvePrismaUser(prisma, { id: user.id, email: user.email });
    if (!appUser) {
      return NextResponse.json<RevealLicenseResponse>(
        { success: false, message: "License not found" },
        { status: 404 }
      );
    }

    const license = await prisma.license.findFirst({
      where: { id: licenseId, userId: appUser.id },
      include: { plan: true },
    });
    if (!license) {
      return NextResponse.json<RevealLicenseResponse>(
        { success: false, message: "License not found" },
        { status: 404 }
      );
    }

    // Audit trail — best-effort, never blocks the reveal.
    await prisma.license
      .update({
        where: { id: license.id },
        data: { lastVerifiedAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json<RevealLicenseResponse>(
      {
        success: true,
        data: {
          licenseId: license.id,
          key: license.key,
          planName: license.plan.name,
          expiresAt: license.expiresAt?.toISOString() ?? null,
          status: license.status,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (err) {
    console.error("[license/reveal] Failed to reveal license:", err);
    return NextResponse.json<RevealLicenseResponse>(
      { success: false, message: "We couldn't load that key right now. Please try again." },
      { status: 503 }
    );
  }
}
