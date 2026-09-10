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
    // A cron job re-sends rows stuck in QUEUED/FAILED.
  }
}
