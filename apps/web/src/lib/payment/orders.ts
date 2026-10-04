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
//   5. REFERRAL SETTLE— a PAID order is attributed to the referral code it
//                       carried and (for a $75 Lifetime order) unlocks the
//                       buyer. Best-effort + idempotent: it can NEVER block or
//                       roll back the license grant.

import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { PlanSlug } from "@frpb/shared";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto/sha256";
import { generateLicenseKey } from "@/lib/license/generate";
import { normalizeEmail } from "@/lib/auth/user-identity";
import { hasSentLicenseEmail, sendLicenseEmailDeferred } from "@/lib/email/resend";
import {
  dualAmount,
  getDualPlan,
  isAllowedInrAmount,
  isSanctionedUsdAmount,
  type DualCurrency,
} from "@/config/plans";

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
export async function ensurePlanRow(planSlug: PlanSlug, client: PrismaClient = prisma) {
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
  /**
   * Whether the license-delivery email was dispatched. With the deferred
   * dispatcher this is `true` once the send has been scheduled (or a prior
   * delivery is already recorded as SENT) and `false` when email is not
   * configured — in which case the retry cron still drains the EmailLog row.
   */
  emailSent: boolean;
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

  // Already granted → return the existing license without re-minting. Do NOT
  // resend the email; just report whether a delivery email ever went out.
  if (order.licenseId) {
    const existing = await client.license.findUnique({
      where: { id: order.licenseId },
      select: { id: true, key: true },
    });
    if (existing) {
      return {
        licenseId: existing.id,
        licenseKey: existing.key,
        emailSent: await hasSentLicenseEmail(existing.id),
      };
    }
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
      if (winner) {
        return {
          licenseId: winner.id,
          licenseKey: winner.key,
          emailSent: await hasSentLicenseEmail(winner.id),
        };
      }
    }
    return null;
  }

  // Deliver the license email AFTER the transaction commits, so a mail outage
  // can never roll back a granted license. The dispatch is DEFERRED (fire-and-
  // forget) so a slow or down Resend API never stalls the payment HTTP response
  // — the adapter bounds the send with a timeout and records any failure in
  // EmailLog for the retry cron. `sendLicenseEmailDeferred` returns `true` once
  // the send is scheduled and `false` when email is not configured.
  const emailSent = sendLicenseEmailDeferred(
    {
      id: license.id,
      key: license.key,
      plan: { name: planRow.name },
      expiresAt: license.expiresAt,
    },
    email
  );

  // Structured per-transaction audit line (provider ref → email → key → mail
  // status). Mirrors the webhook's log so BOTH settlement paths (signed verify
  // callback and signed webhook) are equally greppable when diagnosing a
  // missing key or a dropped delivery email.
  console.info("[payment] license granted", {
    orderId: order.orderId,
    providerTxnId: order.providerTxnId,
    email,
    licenseId: license.id,
    licenseStatus: license.status,
    emailStatus: emailSent ? "SCHEDULED" : "QUEUED_FOR_RETRY",
  });

  return { licenseId: license.id, licenseKey, emailSent };
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
/**
 * Defense-in-depth sanction check for a supplied override amount. The checkout
 * route already validates against the sanctioned set, but the lib re-checks so
 * a buggy/compromised caller can never persist an arbitrary charge amount.
 */
function isSanctionedChargeAmount(amount: number, currency: DualCurrency): boolean {
  return currency === "INR" ? isAllowedInrAmount(amount) : isSanctionedUsdAmount(amount);
}

export async function createRazorpayOrder(input: {
  planSlug: PlanSlug;
  email: string;
  userId?: string | null;
  providerTxnId: string;
  /** Charge currency resolved + validated by the caller (defaults to INR). */
  currency?: DualCurrency;
  /**
   * Optional server-validated charge amount in whole major units. When present
   * the caller (checkout) has already resolved a sanctioned amount — e.g. a
   * referral-discounted $120 Lifetime price. It is re-sanctioned here as a
   * defense-in-depth guard before persistence.
   */
  amount?: number;
  /** Referral code redeemed at checkout (persisted for settlement accrual). */
  referralCode?: string | null;
}): Promise<{ orderId: string; amount: number; currency: DualCurrency; expiresAt: Date }> {
  const plan = getDualPlan(input.planSlug);
  if (!plan) throw new Error(`Unknown plan slug: ${input.planSlug}`);

  const currency: DualCurrency = input.currency ?? "INR";
  const tierAmount = dualAmount(plan, currency);
  const amount =
    typeof input.amount === "number" &&
    Number.isFinite(input.amount) &&
    isSanctionedChargeAmount(input.amount, currency)
      ? input.amount
      : tierAmount;

  const referralCode =
    typeof input.referralCode === "string" && input.referralCode.trim()
      ? input.referralCode.trim().toUpperCase()
      : null;

  const orderId = generateOrderId();
  const expiresAt = orderExpiry();

  await prisma.paymentOrder.create({
    data: {
      orderId,
      userId: input.userId ?? null,
      email: normalizeEmail(input.email),
      planId: plan.slug,
      // Server-resolved tier rate (or a sanctioned referral-discounted amount)
      // for the requested currency — never from the client, stored in whole
      // major units.
      amount,
      currency,
      provider: "RAZORPAY",
      status: "PENDING",
      // Referral code redeemed at checkout, carried onto the order so the
      // settlement seam can accrue the referral after payment is confirmed.
      referralCode,
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
 * Best-effort referral settlement for an order that has just been marked PAID.
 *
 * Runs BOTH referral side effects this settlement seam owns:
 *   • `recordReferralFromOrder` — attributes the order to its referral code,
 *     creating the refund-locked PENDING Referral (and a PENDING Commission for
 *     an already-unlocked VIP referrer);
 *   • `handleDownsellUnlock` — unlocks the buyer immediately for a paid $75
 *     Lifetime downsell, which carries no referral code.
 *
 * Both operations are individually idempotent (unique `referredUserId` +
 * conditional unlock claim), so a duplicate verify callback or a retried
 * webhook can never double-count.
 *
 * The referral service imports `ensurePlanRow` from THIS module, so a static
 * import here would form a circular dependency. The dynamic `import()` defers
 * loading until settlement time (after both modules are fully initialised),
 * breaking the cycle. The whole block is wrapped so a referral failure is
 * logged but can NEVER break license delivery.
 */
async function settleReferralForOrder(orderId: string): Promise<void> {
  try {
    const { recordReferralFromOrder, handleDownsellUnlock } = await import(
      "@/lib/referral/service"
    );

    const result = await recordReferralFromOrder(orderId);
    if (result.outcome === "recorded") {
      console.info("[payment] referral recorded", {
        orderId,
        referralId: result.referralId,
      });
    } else if (result.outcome === "rejected_self_referral") {
      console.warn("[payment] referral rejected (self-referral)", {
        orderId,
        referralId: result.referralId,
        reasons: result.selfReferralReasons,
      });
    }

    // Independent of code attribution: a full-price $75 Lifetime order has no
    // referral code but still unlocks the buyer (no-op for every other plan).
    const downsell = await handleDownsellUnlock(orderId);
    if (downsell.unlocked) {
      console.info("[payment] downsell unlock granted", {
        orderId,
        licenseId: downsell.licenseId,
      });
    }
  } catch (err) {
    console.error(
      "[payment] referral settlement failed (license unaffected):",
      (err as Error)?.message ?? err
    );
  }
}

/**
 * Mark a Razorpay order PAID after its signature-verified callback confirms
 * success, then grant the license. Idempotent: an already-PAID order is
 * returned untouched by the update guard.
 *
 * After the PAID transition it also runs best-effort referral settlement so
 * BOTH confirmation paths (the signed verify callback and the signed
 * `payment.captured` webhook) accrue referrals and downsell unlocks identically.
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

  // Referral attribution + downsell unlock. Fully guarded and idempotent, so it
  // is safe to run on every settlement (including an idempotent re-verify).
  await settleReferralForOrder(order.orderId);

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
