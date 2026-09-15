// FRPB — webhook idempotency engine (§5.3).
// Guarantees exactly-once license grant per provider event:
//   1. WebhookEvent.eventId unique index = dedupe key (RECEIVED → PROCESSING → PROCESSED|FAILED|IGNORED)
//   2. Payment.providerTxnId unique index = double-guard against races
// License + Payment are created atomically inside a $transaction.
// Email delivery is best-effort and NEVER blocks the transaction.

import type { Prisma, PrismaClient } from "@prisma/client";

// Prisma generates the PaymentProvider enum but does not export it as a value;
// use the string literal union matching the schema enum for runtime comparisons.
type PaymentProviderName = "STRIPE" | "RAZORPAY" | "CASHFREE" | "PAYGLOCAL";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto/sha256";
import { generateLicenseKey } from "@/lib/license/generate";
import { getPlanDefinition } from "@/lib/license/constants";
import { sendLicenseEmail } from "@/lib/email/resend";
import { normalizeEmail } from "@/lib/auth/user-identity";
import type { PlanSlug } from "@frpb/shared";

export interface WebhookProcessInput {
  provider: PaymentProviderName;
  /** Provider event id (evt_… / event_…). Unique → idempotency. */
  eventId: string;
  /** e.g. checkout.session.completed / payment_intent.succeeded / payment.captured */
  eventType: string;
  /** Raw provider payload for audit + replay */
  payload: unknown;
  /** Provider txn id — Payment.providerTxnId (unique). */
  txnId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  planSlug: PlanSlug;
}

export type WebhookProcessResult =
  | { outcome: "PROCESSED"; licenseId: string }
  | { outcome: "DUPLICATE"; licenseId?: string }
  | { outcome: "IGNORED"; reason: string }
  | { outcome: "FAILED"; error: string };

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function processWebhook(
  input: WebhookProcessInput,
  client: PrismaClient = prisma
): Promise<WebhookProcessResult> {
  // ── 1. Idempotency gate: unique eventId ──────────────────────────────
  // A concurrent duplicate will fail the unique constraint → treated as DUPLICATE.
  let event: Awaited<ReturnType<typeof client.webhookEvent.create>>;
  try {
    event = await client.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload as object,
        status: "RECEIVED",
      },
    });
  } catch (err) {
    // Unique constraint violation → event already recorded.
    const existing = await client.webhookEvent.findUnique({
      where: { eventId: input.eventId },
    });
    if (existing) {
      if (existing.status === "PROCESSED") {
        return { outcome: "DUPLICATE", licenseId: existing.licenseId ?? undefined };
      }
      return { outcome: "FAILED", error: "Event already in-flight" };
    }
    return { outcome: "FAILED", error: (err as Error).message };
  }

  try {
    // ── 2. Double-guard: has this txn already been granted? ────────────
    // NOTE: /api/v1/checkout writes a PENDING row with the SAME providerTxnId
    // before the customer pays. Only a row that already carries a licenseId
    // means "already granted" — a bare PENDING row must be reconciled (updated)
    // inside the transaction below, never mistaken for a duplicate.
    const existingPayment = await client.payment.findUnique({
      where: { providerTxnId: input.txnId },
    });
    if (existingPayment?.licenseId) {
      await client.webhookEvent.update({
        where: { id: event.id },
        data: { status: "IGNORED", processedAt: new Date(), licenseId: existingPayment.licenseId },
      });
      return { outcome: "DUPLICATE", licenseId: existingPayment.licenseId };
    }

    await client.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSING" },
    });

    // ── 3. Plan + user resolution ──────────────────────────────────────
    const planDef = getPlanDefinition(input.planSlug);

    // Find the Plan row (must exist from seed). If missing, fall back to snapshot.
    const planRow = await client.plan.findUnique({
      where: { slug: input.planSlug },
    });
    if (!planRow) {
      throw new Error(`Plan row missing for slug ${input.planSlug} — run prisma db seed`);
    }

    // Upsert the User by CANONICAL email (webhook is the source of truth for
    // the purchase). Uses the same normalization as checkout so both paths
    // resolve to a single Prisma row per Supabase account.
    const email = normalizeEmail(input.customerEmail);
    const user = await client.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // ── 4. Generate license key (raw shown once, SHA-256 stored) ───────
    const licenseKey = generateLicenseKey();
    const expiresAt =
      planRow.durationDays != null ? addDays(new Date(), planRow.durationDays) : null;

    // ── 5. Atomic grant: Payment + License (+ webhook status) ──────────
    const granted = await client.$transaction(async (tx: Prisma.TransactionClient) => {
      const license = await tx.license.create({
        data: {
          key: licenseKey,
          keySha256: sha256(licenseKey),
          userId: user.id,
          planId: planRow.id,
          status: "ACTIVE",
          deviceLimit: planRow.deviceLimit,
          maxActivations: 1,
          activatedAt: new Date(),
          expiresAt,
          metadata: {
            provider: input.provider,
            eventId: input.eventId,
            planSlug: input.planSlug,
          },
        },
      });

      const paymentData = {
        userId: user.id,
        licenseId: license.id,
        provider: input.provider,
        providerTxnId: input.txnId,
        providerEventId: input.eventId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: "SUCCEEDED" as const,
        planSlug: input.planSlug,
      };

      // Reconcile the PENDING row created at checkout (same providerTxnId)
      // instead of colliding with its unique index; otherwise insert it now.
      const payment = existingPayment
        ? await tx.payment.update({ where: { id: existingPayment.id }, data: paymentData })
        : await tx.payment.create({ data: paymentData });

      await tx.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date(), licenseId: license.id },
      });

      return { license, payment };
    });

    // ── 6. Best-effort email (never blocks the grant) ──────────────────
    void sendLicenseEmail(
      {
        id: granted.license.id,
        key: granted.license.key,
        plan: { name: planRow.name },
        expiresAt: granted.license.expiresAt,
      },
      user.email
    ).catch(() => {
      // Failure already recorded in EmailLog by the adapter.
    });

    return { outcome: "PROCESSED", licenseId: granted.license.id };
  } catch (err) {
    const message = (err as Error).message;
    await client.webhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", processedAt: new Date(), error: message },
    }).catch(() => {
      // Best-effort status write; the event row preserves the raw payload for replay.
    });
    return { outcome: "FAILED", error: message };
  }
}
