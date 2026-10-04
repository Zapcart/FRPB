// FRPB — email delivery adapter (Resend).
//
// Every send is recorded in EmailLog and every failure is BOTH persisted and
// logged loudly. The license-grant path AWAITS this adapter, so a missing API
// key or a provider outage can never silently drop a customer's key.
//
// A mail failure NEVER rolls back a granted license: the row stays in
// QUEUED/FAILED and GET /api/v1/cron/email-retry re-sends it.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { licenseDeliveredTemplate } from "@/lib/email/templates";
import { GITHUB_RELEASES_BASE } from "@/config/download";

// Lazy singleton — constructing Resend with an empty key throws, which would
// crash `next build` during page data collection when the env var is absent.
// The client is only created on first send (webhook time).
let resend: Resend | null = null;

/**
 * How long a single Resend API call may hang before we give up on it.
 *
 * The license-grant path previously awaited `emails.send()` with no ceiling, so
 * a slow or wedged provider could stall the payment webhook / verify response
 * indefinitely. Every send is now raced against this deadline; a timeout is
 * recorded as a normal EmailLog failure and retried by the cron drain.
 */
const EMAIL_SEND_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RESEND_SEND_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 8000;
})();

/**
 * Validate the Resend API key shape.
 *
 * Resend keys are `re_`-prefixed. Checking the format here turns a stale or
 * placeholder key into an immediate, actionable failure (recorded in EmailLog)
 * instead of a mid-flow "Invalid API key" from the provider.
 */
export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  return Boolean(key && key.startsWith("re_") && key.length >= 12);
}

/** Reject after `ms`, with a descriptive error the EmailLog can store. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[email] ${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    // Previously this constructed Resend with "" and let the send reject; that
    // rejection was swallowed by the caller's empty catch. Throw a clear,
    // actionable message instead.
    throw new Error("RESEND_API_KEY is not configured — cannot send email");
  }
  if (!resend) resend = new Resend(key);
  return resend;
}

function fromAddress(): string {
  // Canonical sender. Precedence:
  //   1. RESEND_FROM_EMAIL — the explicit Resend "from" override;
  //   2. EMAIL_FROM        — legacy alias still set in some environments;
  //   3. the branded support address as a final, safe default.
  // Falls back gracefully so a missing/renamed env var never blocks delivery.
  return (
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "FRPB Support <support@frpb.in>"
  );
}

/** License fields needed to render the delivery email. */
export interface LicenseEmailLicense {
  id: string;
  key: string;
  plan: { name: string };
  expiresAt: Date | null;
}

/** Build the license-delivery subject + HTML from current license state. */
function buildLicenseEmail(license: LicenseEmailLicense): { subject: string; html: string } {
  return licenseDeliveredTemplate({
    licenseKey: license.key,
    planName: license.plan.name,
    expiresAt: license.expiresAt,
    // Installers are hosted on GitHub Releases (see src/config/download.ts).
    downloadUrl: process.env.DOWNLOAD_BASE_URL ?? GITHUB_RELEASES_BASE,
    quickStartPdfUrl:
      process.env.QUICK_START_PDF_URL ?? "https://frpb.in/guides/frpb-quick-start.pdf",
  });
}

/** Persist a failure outcome; never let failure logging mask the failure. */
async function recordFailure(logId: string, message: string): Promise<void> {
  try {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        error: message.slice(0, 1000),
        attempts: { increment: 1 },
      },
    });
  } catch (err) {
    console.error(
      `[email] could not record EmailLog failure (row ${logId}):`,
      (err as Error)?.message ?? err
    );
  }
}

/**
 * Send one already-built email and keep its EmailLog row in sync.
 *
 * Throws on ANY failure AFTER recording it, so the caller can log with its own
 * context (order id, customer email). The license grant is never rolled back.
 */
async function dispatch(input: {
  to: string;
  subject: string;
  html: string;
  logId: string;
  licenseId: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    const message =
      "RESEND_API_KEY is missing or malformed (expected an `re_` key) — license email was not sent";
    console.error(`[email] ${message} (to=${input.to}, license=${input.licenseId})`);
    await recordFailure(input.logId, message);
    throw new Error(message);
  }

  try {
    const { data, error } = await withTimeout(
      getResend().emails.send({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
      EMAIL_SEND_TIMEOUT_MS,
      `send to ${input.to}`
    );
    if (error) throw new Error(error.message ?? String(error));

    await prisma.emailLog.update({
      where: { id: input.logId },
      data: { status: "SENT", providerMsgId: data?.id, sentAt: new Date(), error: null },
    });
    console.info(`[email] license email sent to ${input.to} (msg=${data?.id ?? "n/a"})`);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    console.error(`[email] license email FAILED to ${input.to}: ${message}`);
    // Drop the cached client so the next attempt builds a fresh connection;
    // otherwise a wedged socket could keep failing until the process restarts.
    resend = null;
    await recordFailure(input.logId, message);
    throw err instanceof Error ? err : new Error(message);
  }
}

/**
 * Send the license-delivery email for a freshly granted license.
 *
 * Creates the EmailLog (QUEUED) row first, then dispatches. Throws on failure
 * so the caller can log it — the license is already granted regardless.
 */
export async function sendLicenseEmail(license: LicenseEmailLicense, to: string): Promise<void> {
  const { subject, html } = buildLicenseEmail(license);

  let logId: string;
  try {
    const log = await prisma.emailLog.create({
      data: { to, template: "license-delivered", licenseId: license.id, status: "QUEUED" },
    });
    logId = log.id;
  } catch (err) {
    console.error(
      `[email] could not create EmailLog for ${to} (license ${license.id}):`,
      (err as Error)?.message ?? err
    );
    throw err instanceof Error ? err : new Error(String(err));
  }

  await dispatch({ to, subject, html, logId, licenseId: license.id });
}

/**
 * Non-blocking variant for latency-sensitive paths (payment verify / webhook).
 *
 * Creates the EmailLog row and kicks off the send WITHOUT awaiting it, so a
 * Resend outage can never stall the HTTP response (the license is already
 * committed by the caller). This is safe on an always-on EC2/PM2 process — the
 * Node process keeps running after the response is flushed.
 *
 * Returns `false` when email is not configured (the caller must NOT claim a
 * send happened) and `true` once the dispatch has been scheduled. Delivery is
 * reconciled asynchronously through EmailLog + the email-retry cron drain.
 */
export function sendLicenseEmailDeferred(
  license: LicenseEmailLicense,
  to: string
): boolean {
  if (!isEmailConfigured()) {
    console.error(
      `[email] RESEND_API_KEY missing or malformed — deferred license email to ${to} skipped (license ${license.id})`
    );
    return false;
  }

  // Fire-and-forget. `dispatch` records any failure in EmailLog, which the cron
  // re-sends from, so nothing needs to bubble back to the caller.
  void (async () => {
    try {
      await sendLicenseEmail(license, to);
    } catch (err) {
      console.error(
        `[email] deferred license email to ${to} (license ${license.id}) failed:`,
        (err as Error)?.message ?? err
      );
    }
  })();

  return true;
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
 * The grant path dispatches best-effort and never blocks the license, so a
 * transient Resend outage would otherwise leave a paying customer without
 * their key. This drains that backlog.
 *
 * Safety:
 *   - only rows within the retry window are touched (no endless retries)
 *   - `attempts` is capped so a permanently-bad address is not hammered
 *   - each attempt writes its outcome back to EmailLog for observability
 */
export async function retryFailedEmails(limit = 25): Promise<EmailRetrySummary> {
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

    const { subject, html } = buildLicenseEmail(license);
    try {
      await dispatch({
        to: row.to,
        subject,
        html,
        logId: row.id,
        licenseId: license.id,
      });
      summary.sent++;
    } catch {
      // dispatch() already logged + persisted the failure — keep draining.
      summary.failed++;
    }
  }

  return summary;
}

/**
 * Whether a license has at least one successfully delivered email.
 * Backs the `emailSent` flag returned by the license-grant path.
 */
export async function hasSentLicenseEmail(licenseId: string): Promise<boolean> {
  try {
    const sent = await prisma.emailLog.findFirst({
      where: { licenseId, template: "license-delivered", status: "SENT" },
      select: { id: true },
    });
    return Boolean(sent);
  } catch (err) {
    console.error(
      `[email] could not check delivery status for license ${licenseId}:`,
      (err as Error)?.message ?? err
    );
    return false;
  }
}
