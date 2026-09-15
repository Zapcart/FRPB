// FRPB — GET /api/v1/license/list
// Authenticated: lists the signed-in user's licenses + per-license device usage.
// Returns masked keys (last 4 chars) — full keys are shown only on the
// "copy license" action after a second auth factor (enhancement §5.4).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolvePrismaUser } from "@/lib/auth/user-identity";
import type { ListLicensesItem, ListLicensesResponse } from "@frpb/shared";
import { preflight, withCorsResponse } from "@/lib/cors";

// Session + DB work — never statically prerender this route.
export const dynamic = "force-dynamic";

// CORS preflight for cross-origin (desktop) callers.
export const OPTIONS = preflight;

export async function GET() {
  return withCorsResponse(await handleList());
}

async function handleList() {
  // 1. Resolve the Supabase user — getUser() validates the JWT server-side,
  //    so a stale/expired cookie cannot be treated as a valid session.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json<ListLicensesResponse>(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Resolve the canonical Prisma user (supabaseId first, normalized email
  //    fallback). Matching on raw email alone previously missed licenses that
  //    were granted to a lowercased row — the "no licenses" false negative.
  try {
    const appUser = await resolvePrismaUser(prisma, {
      id: user.id,
      email: user.email,
    });

    // No Prisma row yet simply means "no purchases" — an empty list, never an
    // error and never a 503.
    if (!appUser) {
      return NextResponse.json<ListLicensesResponse>(
        { success: true, data: { licenses: [] } },
        { status: 200 }
      );
    }

    const licenses = await prisma.license.findMany({
      where: { userId: appUser.id },
      include: {
        plan: true,
        _count: { select: { devices: { where: { status: { not: "UNBOUND" } } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Shape into the shared envelope
    const items: ListLicensesItem[] = licenses.map(
      (l: (typeof licenses)[number]) => ({
        id: l.id,
        key: maskKey(l.key),
        plan: l.plan.slug,
        planName: l.plan.name,
        status: l.status,
        expiresAt: l.expiresAt?.toISOString() ?? null,
        deviceLimit: l.deviceLimit,
        devicesUsed: l._count.devices,
        createdAt: l.createdAt.toISOString(),
      })
    );

    return NextResponse.json<ListLicensesResponse>(
      { success: true, data: { licenses: items } },
      { status: 200 }
    );
  } catch (err) {
    // DB unreachable — respond 503 with a friendly message, never a stack trace.
    console.error("[license/list] Failed to load licenses:", err);
    return NextResponse.json<ListLicensesResponse>(
      {
        success: false,
        message:
          "We couldn't load your licenses right now. Please try again in a moment.",
      },
      { status: 503 }
    );
  }
}

function maskKey(key: string): string {
  const groups = key.split("-");
  if (groups.length === 4) {
    return `FRPB-****-****-${groups[3]}`;
  }
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
