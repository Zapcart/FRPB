// FRPB — Direct-UPI order lifecycle helpers.
//
// Centralises the three rules the direct-UPI rail depends on so every route
// (create / verify / status) applies them identically:
//
//   1. AMOUNT LOCK   — the chargeable amount is resolved from the UPI_PLANS
//                      table, never from the client payload.
//   2. 10-MIN EXPIRY — a PENDING order past `expiresAt` is EXPIRED and can no
//                      longer be claimed.
//   3. LICENSE GRANT — a verified order mints exactly one license, linked back
//                      to the order so a re-verify is idempotent.

import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PLANS, type PlanSlug } from "@frpb/shared";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto/sha256";
import { generateLicenseKey } from "@/lib/license/generate";
import { getPlanDefinition } from "@/lib/license/constants";
import { normalizeEmail } from "@/lib/auth/user-identity";
import { sendLicenseEmail } from "@/lib/email/resend";
import { getUpiPlan } from "@/lib/upi";

/** Direct-UPI orders expire 10 minutes after creation. */
export const ORDER_TTL_MS = 10 * 60 * 1000;

/**
 * The public plan ids accepted by the direct-UPI rail → shared PlanSlug.
 * Mirrors UPI_PLANS in lib/upi.ts (which also carries the locked amounts).
 */
export function planSlugForUpiPlanId(planId: string): PlanSlug | null {
  return getUpiPlan(planId)?.planSlug ?? null;
}

/**
 * Generate a collision-resistant public order id, e.g.
 * "ORD-1A2B3C4D5E6F". Crockford-style uppercase hex keeps it readable and
 * URL/UPI-safe; the DB unique index is the final collision guard.
 */
export function generateOrderId(): string {
  return `ORD-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** Expiry timestamp for an order created now. */
export function orderExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + ORDER_TTL_MS);
}

/** True when a PENDING order has passed its expiry window. */
export function isExpired(order: { status: string; expiresAt: Date }): boolean {
  return order.status === "PENDING" && order.expiresAt.getTime() <= Date.now();
}

/**
 * Lazily transition a single order to EXPIRED when its window has passed and
 * persist the change (so the status endpoint and the DB agree). Returns the
 * effective status string.
 */
export async function resolveOrderStatus(
  order: { id: string; status: string; expiresAt: Date },
  client: PrismaClient = prisma
): Promise<"PENDING" | "PAID" | "FAILED" | "EXPIRED"> {
  if (isExpired(order)) {
    try {
      await client.paymentOrder.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });
    } catch {
      // A concurrent claim may have flipped it to PAID — re-read and trust DB.
    }
    const fresh = await client.paymentOrder.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    return (fresh?.status as "PENDING" | "PAID" | "FAILED" | "EXPIRED") ?? "EXPIRED";
  }
  return order.status as "PENDING" | "PAID" | "FAILED" | "EXPIRED";
}

/**
 * Bulk-expire every stale PENDING order. Called opportunistically by the create
 * endpoint so the table self-heals without a scheduled cron.
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
 * Resolve the Prisma `Plan` row for a slug, creating it from the shared plan
 * definition when the seed has not run. This keeps the direct-UPI rail
 * self-sufficient: a license FK always has a valid Plan row to point at.
 */
async function ensurePlanRow(planSlug: PlanSlug, client: PrismaClient = prisma) {
  const existing = await client.plan.findUnique({ where: { slug: planSlug } });
  if (existing) return existing;

  const def = getPlanDefinition(planSlug);
  return client.plan.upsert({
    where: { slug: planSlug },
    update: {},
    create: {
      slug: def.slug,
      name: def.name,
      priceCents: def.priceCents,
      priceInr: def.priceInr,
      currency: def.currency,
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
 * Idempotent: when the order already carries a `licenseId` the existing grant is
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

  const license = await client.license.create({
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
        provider: "DIRECT_UPI",
        orderId: order.orderId,
        utr: order.utr,
        planSlug,
        amount: order.amount,
      },
    },
  });

  await client.paymentOrder.update({
    where: { id: order.id },
    data: { licenseId: license.id },
  });

  // Best-effort delivery email — never blocks the grant.
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

/** Human plan name for the given shared slug (used in API responses). */
export function planNameFor(planSlug: PlanSlug): string {
  return PLANS.find((p) => p.slug === planSlug)?.name ?? planSlug;
}
