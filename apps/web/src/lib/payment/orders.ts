// FRPB — Razorpay payment order lifecycle helpers.
//
// Razorpay Standard Web Checkout is the single, exclusive payment gateway.
// This module centralises the rules every Razorpay route depends on so the
// create-order and verify-payment handlers apply them identically:
//
//   1. AMOUNT LOCK    — the chargeable amount is resolved from DUAL_PLANS,
//                       never from the client payload.
//   2. ORDER EXPIRY   — a PENDING order past `expiresAt` is EXPIRED and can no
//                       longer be claimed.
//   3. LICENSE GRANT  — a verified order mints exactly one license, linked back
//                       to the order so a re-verify is idempotent.
//   4. SIGNATURE GATE — the gateway HMAC signature is verified server-side
//                       before any license is granted (see lib/razorpay/server).

import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { PlanSlug } from "@frpb/shared";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto/sha256";
import { generateLicenseKey } from "@/lib/license/generate";
import { normalizeEmail } from "@/lib/auth/user-identity";
import { sendLicenseEmail } from "@/lib/email/resend";
import { dualAmount, getDualPlan, type DualCurrency } from "@/config/plans";

/** Razorpay orders expire 10 minutes after creation. */
export const ORDER_TTL_MS = 10 * 60 * 1000;

/**
 * Generate a collision-resistant internal order id, e.g.
 * "ORD-1A2B3C4D5E6F". Uppercase hex keeps it readable and URL-safe; the DB
 * unique index is the final collision guard.
 */
export function generateOrderId(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Expiry timestamp for an order created now. */
export function orderExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + ORDER_TTL_MS);
}

/**
 * Bulk-expire every stale PENDING order. Called opportunistically by the
 * create-order endpoint so the table self-heals without a scheduled cron.
 */
export async function expireStaleOrders(client: PrismaClient = prisma): Promise<number> {
  try {
    const res = await client.paymentOrder.updateMany({
      where: { status: "PENDING", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    return res.count;
  } catch {
    // Never let housekeeping break a live purchase.
    return 0;
  }
}

/**
 * Resolve the Prisma `Plan` row for a slug, creating it from the DUAL_PLANS
 * configuration when the seed has not run. This keeps a license FK always
 * pointing at a valid Plan row whose stored prices match the tiers actually
 * charged (₹1,900 / ₹13,999).
 */
async function ensurePlanRow(planSlug: PlanSlug, client: PrismaClient = prisma) {
  const existing = await client.plan.findUnique({ where: { slug: planSlug } });
  if (existing) return existing;

  const def = getDualPlan(planSlug);
  if (!def) throw new Error(`Unknown plan slug: ${planSlug}`);

  return client.plan.upsert({
    where: { slug: def.slug },
    update: {},
    create: {
      slug: def.slug,
      name: def.name,
      // USD is stored in cents ($20 = 2000), INR in paise (₹1,900 = 190000) —
      // the minor-unit convention every Prisma Plan row uses.
      priceCents: Math.round(def.usd * 100),
      priceInr: Math.round(def.inr * 100),
      currency: "USD",
      durationDays: def.durationDays,
      deviceLimit: def.deviceLimit,
      features: def.features,
    },
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface GrantResult {
  licenseId: string;
  licenseKey: string;
}

/**
 * Mint exactly one license for a PAID order and link it back.
 *
 * IDEMPOTENT: when the order already carries a `licenseId` the existing grant is
 * returned untouched, so a duplicate verify call can never issue a second key.
 * The raw key is returned so the verify response can display it once.
 */
export async function grantLicenseForOrder(
  orderId: string,
  client: PrismaClient = prisma
): Promise<GrantResult | null> {
  const order = await client.paymentOrder.findUnique({ where: { orderId } });
  if (!order) return null;

  // Already granted → return the existing license without re-minting.
  if (order.licenseId) {
    const existing = await client.license.findUnique({
      where: { id: order.licenseId },
      select: { id: true, key: true },
    });
    if (existing) return { licenseId: existing.id, licenseKey: existing.key };
  }

  const planSlug = order.planId as PlanSlug;
  const planRow = await ensurePlanRow(planSlug, client);

  const email = normalizeEmail(order.email);
  const user = await client.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const licenseKey = generateLicenseKey();
  const expiresAt =
    planRow.durationDays != null ? addDays(new Date(), planRow.durationDays) : null;

  // MINT + LINK ATOMICALLY.
  //
  // `license.create` followed by `paymentOrder.update` were two independent
  // writes. A crash, timeout, or pooler drop in the gap between them left a
  // license row with the order still pointing at `licenseId: null` — and the
  // retry path above (which keys off `order.licenseId`) then minted a SECOND key
  // for the same payment. Both writes now happen inside one transaction, and the
  // link is claimed conditionally (`licenseId: null`) so exactly one concurrent
  // grant can ever win.
  const license = await client.$transaction(async (tx) => {
    const created = await tx.license.create({
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
          provider: "RAZORPAY",
          orderId: order.orderId,
          providerTxnId: order.providerTxnId,
          planSlug,
          amount: order.amount,
          currency: order.currency,
        },
      },
    });

    // Race-safe claim: only succeeds while the order is still unlinked.
    const linked = await tx.paymentOrder.updateMany({
      where: { id: order.id, licenseId: null },
      data: { licenseId: created.id },
    });

    if (linked.count === 0) {
      // Another grant won concurrently. Discard our duplicate key inside the
      // same transaction and report the winner instead.
      const fresh = await tx.paymentOrder.findUnique({
        where: { id: order.id },
        select: { licenseId: true },
      });
      if (fresh?.licenseId && fresh.licenseId !== created.id) {
        await tx.license.delete({ where: { id: created.id } }).catch(() => {
          // If the delete fails the whole transaction rolls back anyway.
        });
        return null;
      }
    }

    return created;
  });

  // The transaction lost the race — return the winner's key, never a duplicate.
  if (!license) {
    const settled = await client.paymentOrder.findUnique({ where: { orderId } });
    if (settled?.licenseId) {
      const winner = await client.license.findUnique({
        where: { id: settled.licenseId },
        select: { id: true, key: true },
      });
      if (winner) return { licenseId: winner.id, licenseKey: winner.key };
    }
    return null;
  }

  // Best-effort delivery email — fired AFTER the transaction commits so a mail
  // outage can never roll back a granted license, and never blocks the grant.
  void sendLicenseEmail(
    {
      id: license.id,
      key: license.key,
      plan: { name: planRow.name },
      expiresAt: license.expiresAt,
    },
    email
  ).catch(() => {
    // Failure is recorded in EmailLog by the adapter.
  });

  return { licenseId: license.id, licenseKey };
}

/**
 * Persist a PENDING Razorpay order, stamping the gateway's order id as the
 * unique `providerTxnId` so the verify-payment handler can resolve it back.
 *
 * The amount is resolved from DUAL_PLANS for the requested currency — the
 * caller only supplies the plan slug and currency, so a tampered payload can
 * never set the price. `amount` is stored in WHOLE major units (₹1,900 / $20),
 * the convention `admin-analytics` assumes when it buckets the live ledger.
 */
export async function createRazorpayOrder(input: {
  planSlug: PlanSlug;
  email: string;
  userId?: string | null;
  providerTxnId: string;
  /** Charge currency resolved + validated by the caller (defaults to INR). */
  currency?: DualCurrency;
}): Promise<{ orderId: string; amount: number; currency: DualCurrency; expiresAt: Date }> {
  const plan = getDualPlan(input.planSlug);
  if (!plan) throw new Error(`Unknown plan slug: ${input.planSlug}`);

  const currency: DualCurrency = input.currency ?? "INR";
  const amount = dualAmount(plan, currency);

  const orderId = generateOrderId();
  const expiresAt = orderExpiry();

  await prisma.paymentOrder.create({
    data: {
      orderId,
      userId: input.userId ?? null,
      email: normalizeEmail(input.email),
      planId: plan.slug,
      // Server-resolved tier rate for the requested currency — never from the
      // client, and stored in whole major units.
      amount,
      currency,
      provider: "RAZORPAY",
      status: "PENDING",
      // NOT confirmed at creation. A freshly created order is provably unpaid:
      // `paymentConfirmed` is flipped to true ONLY after a server-verified
      // Razorpay signal (the signed verify callback or the signed
      // `payment.captured` webhook). Stamping it true here previously made an
      // unpaid order look settled to anything gating on this flag.
      paymentConfirmed: false,
      providerTxnId: input.providerTxnId,
      expiresAt,
    },
  });

  return { orderId, amount, currency, expiresAt };
}

/**
 * Mark a Razorpay order PAID after its signature-verified callback confirms
 * success, then grant the license. Idempotent: an already-PAID order is
 * returned untouched by the update guard.
 */
export async function markRazorpayOrderPaid(ref: {
  orderId?: string | null;
  providerTxnId?: string | null;
}): Promise<GrantResult | null> {
  const where = ref.orderId
    ? { orderId: ref.orderId }
    : ref.providerTxnId
      ? { providerTxnId: ref.providerTxnId }
      : null;
  if (!where) return null;

  const order = await prisma.paymentOrder.findUnique({ where });
  if (!order) return null;

  if (order.status !== "PAID") {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), paymentConfirmed: true },
    });
  }

  return grantLicenseForOrder(order.orderId);
}

/**
 * Claim a webhook event id for idempotent processing.
 *
 * Razorpay retries webhooks aggressively, so the same `eventId` can arrive many
 * times. The `WebhookEvent.eventId` unique index is the gate: the FIRST delivery
 * inserts the row and returns `true`; every retry hits the unique constraint,
 * returns `false`, and the caller must skip side effects. This makes
 * `payment.captured` handling exactly-once without a distributed lock — and the
 * reserved row doubles as an audit trail.
 *
 * A unique-constraint violation (`P2002`) is the expected "already seen" path;
 * any OTHER error re-throws so a genuine DB outage is surfaced rather than
 * silently swallowing the event.
 */
export async function reserveWebhookEvent(input: {
  provider: "RAZORPAY";
  eventId: string;
  eventType: string;
  payload: unknown;
  client?: PrismaClient;
}): Promise<boolean> {
  const client = input.client ?? prisma;
  try {
    await client.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload as object,
        status: "RECEIVED",
      },
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") return false;
    throw err;
  }
}

/** Mark a previously reserved webhook event as processed (audit trail). */
export async function markWebhookEvent(
  eventId: string,
  data: { status: string; licenseId?: string | null; error?: string | null },
  client: PrismaClient = prisma
): Promise<void> {
  try {
    await client.webhookEvent.update({
      where: { eventId },
      data: {
        status: data.status,
        licenseId: data.licenseId ?? null,
        error: data.error ?? null,
        processedAt: new Date(),
      },
    });
  } catch (err) {
    // Audit bookkeeping must never break license delivery.
    console.error(
      "[payment/orders] failed to update webhook event:",
      (err as Error)?.message ?? err
    );
  }
}
