// FRPB — POST /api/v1/auth/welcome
//
// Sends the automated Welcome + "$20 for 6 months" offer to the
// currently-authenticated user, exactly once.
//
// WHY A ROUTE (and not just the auth callback):
//   `app/auth/callback/route.ts` only exchanges a PKCE code — it never creates a
//   Prisma user and is skipped entirely for email+password signups (which happen
//   client-side in components/auth/auth-view.tsx). This handler is therefore
//   called by the client immediately AFTER a session exists, which covers both
//   the signup and the first-sign-in paths.
//
// SAFETY
//   • The recipient is taken from the verified session — never from the request
//     body — so this endpoint cannot be used to blast arbitrary addresses.
//   • Idempotency is enforced by EmailLog (`template` + `to`), so repeated or
//     concurrent calls send at most one email.
//   • Always returns 200 with a status field; a marketing email must never
//     surface as an error in the signup UX.

import { NextResponse } from "next/server";
import { getOptionalUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  EMAIL_TEMPLATE_WELCOME,
  isEmailConfigured,
  sendWelcomeOfferEmail,
} from "@/lib/email/resend";

export const dynamic = "force-dynamic";

type Status = "sent" | "already-sent" | "skipped" | "failed";

interface WelcomeResponse {
  success: boolean;
  status: Status;
  message?: string;
}

function respond(body: WelcomeResponse, httpStatus = 200) {
  return NextResponse.json(body, { status: httpStatus });
}

/** Best-effort display name — Prisma row first, then nothing. */
async function lookupName(email: string, supabaseId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ supabaseId }, { email }] },
      select: { name: true },
    });
    return user?.name?.trim() || null;
  } catch (err) {
    // A missing/incomplete user row must not block the welcome email.
    console.warn(
      `[auth/welcome] could not look up name for ${email}:`,
      (err as Error)?.message ?? err
    );
    return null;
  }
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return respond(
      { success: false, status: "skipped", message: "Supabase is not configured." },
      503
    );
  }

  const user = await getOptionalUser();
  if (!user?.email) {
    return respond({ success: false, status: "skipped", message: "Not signed in." }, 401);
  }

  if (!isEmailConfigured()) {
    console.error("[auth/welcome] RESEND_API_KEY missing — welcome email not sent");
    return respond({
      success: false,
      status: "skipped",
      message: "Email is not configured.",
    });
  }

  try {
    const name = await lookupName(user.email, user.id);
    const result = await sendWelcomeOfferEmail(user.email, { name });

    if (result.sent) {
      return respond({ success: true, status: "sent" });
    }
    if (result.alreadySent) {
      return respond({ success: true, status: "already-sent" });
    }
    return respond({
      success: false,
      status: "failed",
      message: result.error ?? "Welcome email could not be sent.",
    });
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    console.error(`[auth/welcome] unexpected failure for ${user.email}: ${message}`);
    return respond({ success: false, status: "failed", message });
  }
}

/** Convenience probe — confirms the route is deployed and the template id it uses. */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      template: EMAIL_TEMPLATE_WELCOME,
      emailConfigured: isEmailConfigured(),
      supabaseConfigured: isSupabaseConfigured(),
    },
  });
}
