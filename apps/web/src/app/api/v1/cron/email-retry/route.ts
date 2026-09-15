// FRPB — GET /api/v1/cron/email-retry
// Drains the license-delivery email backlog (rows stuck in QUEUED/FAILED),
// honouring the retry contract documented in lib/email/resend.ts.
//
// Auth: a shared secret in the `Authorization: Bearer <CRON_SECRET>` header.
// Fails CLOSED — if CRON_SECRET is unset the route returns 503 rather than
// running unauthenticated, because a public trigger here would let anyone
// force outbound email and burn the Resend quota (or spam customers).
//
// Point a Vercel Cron (or any scheduler) at this path, e.g. every 10 minutes.

import { NextRequest, NextResponse } from "next/server";
import { retryFailedEmails } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, message: "CRON_SECRET is not configured; retry disabled." },
      { status: 503 }
    );
  }
  if (!authorised(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await retryFailedEmails();
    return NextResponse.json({ success: true, data: summary }, { status: 200 });
  } catch (err) {
    console.error("[cron/email-retry] Failed:", err);
    return NextResponse.json(
      { success: false, message: "Retry pass failed." },
      { status: 500 }
    );
  }
}
