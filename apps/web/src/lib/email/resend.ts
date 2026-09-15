// FRPB — email delivery adapter (Resend).
// Logs every send in EmailLog; failures are recorded and re-sent by a cron job.
// NEVER blocks the webhook — a license is granted regardless of email outcome.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { licenseDeliveredTemplate } from "@/lib/email/templates";

// Lazy singleton — constructing Resend with an empty key throws, which would
// crash `next build` during page data collection when the env var is absent.
// The client is only created on first send (webhook time).
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY ?? "");
  }
  return resend;
}

export async function sendLicenseEmail(
  license: {
    id: string;
    key: string;
    plan: { name: string };
    expiresAt: Date | null;
  },
  to: string
): Promise<void> {
  const { subject, html } = licenseDeliveredTemplate({
    licenseKey: license.key,
    planName: license.plan.name,
    expiresAt: license.expiresAt,
    downloadUrl: process.env.DOWNLOAD_BASE_URL ?? "https://frpb.in/downloads",
    quickStartPdfUrl:
      process.env.QUICK_START_PDF_URL ?? "https://frpb.in/guides/frpb-quick-start.pdf",
  });

  const log = await prisma.emailLog.create({
    data: { to, template: "license-delivered", licenseId: license.id, status: "QUEUED" },
  });

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? "FRPB <no-reply@frpb.in>",
      to,
      subject,
      html,
    });
    if (error) throw error;

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerMsgId: data?.id, sentAt: new Date() },
    });
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: (err as Error).message },
    });
    // License is already granted — never fail the webhook for an email.
    // `retryFailedEmails()` re-sends rows stuck in QUEUED/FAILED; it is driven
    // by GET /api/v1/cron/email-retry. The dashboard's "Reveal key" action is
    // the customer-facing fallback if delivery never succeeds.
  }
}

/** Attempts allowed per email before it is left alone. */
const MAX_EMAIL_ATTEMPTS = 5;

/** Rows older than this are no longer retried (avoid infinite churn). */
const EMAIL_RETRY_WINDOW_HOURS = 48;

export interface EmailRetrySummary {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Re-send license-delivery emails that are stuck in QUEUED or FAILED.
 *
 * The webhook fires the delivery best-effort and never blocks the license
 * grant, so a transient Resend outage would otherwise leave a paying customer
 * without their key email. This drains that backlog.
 *
 * Safety:
 *   - only rows within the retry window are touched (no endless retries)
 *   - `attempts` is capped so a permanently-bad address is not hammered
 *   - each attempt writes its outcome back to EmailLog for observability
 */
export async function retryFailedEmails(
  limit = 25
): Promise<EmailRetrySummary> {
  const summary: EmailRetrySummary = { scanned: 0, sent: 0, failed: 0, skipped: 0 };

  const since = new Date(Date.now() - EMAIL_RETRY_WINDOW_HOURS * 60 * 60 * 1000);

  const pending = await prisma.emailLog.findMany({
    where: {
      template: "license-delivered",
      status: { in: ["QUEUED", "FAILED"] },
      createdAt: { gte: since },
      attempts: { lt: MAX_EMAIL_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const row of pending) {
    summary.scanned++;
    if (!row.licenseId) {
      summary.skipped++;
      continue;
    }

    // Re-read the license so the email always reflects current state.
    const license = await prisma.license.findUnique({
      where: { id: row.licenseId },
      include: { plan: true },
    });
    if (!license) {
      summary.skipped++;
      continue;
    }

    const { subject, html } = licenseDeliveredTemplate({
      licenseKey: license.key,
      planName: license.plan.name,
      expiresAt: license.expiresAt,
      downloadUrl: process.env.DOWNLOAD_BASE_URL ?? "https://frpb.in/downloads",
      quickStartPdfUrl:
        process.env.QUICK_START_PDF_URL ?? "https://frpb.in/guides/frpb-quick-start.pdf",
    });

    try {
      const { data, error } = await getResend().emails.send({
        from: process.env.EMAIL_FROM ?? "FRPB <no-reply@frpb.in>",
        to: row.to,
        subject,
        html,
      });
      if (error) throw error;

      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          providerMsgId: data?.id,
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });
      summary.sent++;
    } catch (err) {
      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          error: (err as Error).message,
        },
      });
      summary.failed++;
    }
  }

  return summary;
}
