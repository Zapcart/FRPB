// FRPB — referral & VIP affiliate service layer (server-side only).
//
// This is the ONLY module that mutates referral state. It is deliberately
// defensive:
//   • every money value is INTEGER CENTS (the domain modules + DB store cents);
//   • every write that could be raced is guarded by either a unique constraint
//     (P2002 === "already done") or a conditional `updateMany` claim;
//   • the public functions degrade to a safe no-op rather than throwing into a
//     payment / webhook path.
//
// Two-phase model (matches the product spec):
//   PHASE 1 — self-unlock: qualified referrals count toward a FREE Lifetime
//             plan (Route A: 2 Lifetime, Route B: 4 Monthly + 1 Lifetime).
//   PHASE 2 — VIP cash affiliate: once unlocked, FUTURE referred sales earn
//             cash (30% Monthly, 50% Lifetime).
//
// Refund-lock: referrals + commissions are created `PENDING` with a
// `releaseAt = paidAt + refundLockDays`. Only `releaseDue*` flips them live, so
// a chargeback inside the window can never have already paid out.

import { randomBytes } from "node:crypto";

import { normalizeEmail } from "@/lib/auth/user-identity";
import { sha256 } from "@/lib/crypto/sha256";
import { generateLicenseKey } from "@/lib/license/generate";
import { ensurePlanRow } from "@/lib/payment/orders";
import { prisma } from "@/lib/prisma";

import { computeCommission, sumReleasedCents } from "./commission";
import {
  REFERRAL_RULES,
  discountedPriceCents,
  downsellPriceCents,
  referralDiscountCents,
  releaseAtFrom,
  type ReferralPlanId,
} from "./config";
import { detectSelfReferral, type FraudSignals } from "./fraud";
import {
  computeProgress,
  type QualifiedReferralCounts,
  type UnlockProgress,
  type UnlockRouteId,
} from "./progress";

type UnlockRouteValue = "ROUTE_A" | "ROUTE_B" | "DOWNSELL";

/** Human-friendly, unambiguous referral code charset (no I/O/0/1). */
const REFERRAL_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_ATTEMPTS = 6;

function randomReferralCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += REFERRAL_CODE_CHARSET[bytes[i]! % REFERRAL_CODE_CHARSET.length];
  }
  return `FR${out}`;
}

/** Absolute site origin for building share links, or null when unconfigured. */
function siteBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

/** List (undiscounted) price in cents for a plan — derived from config. */
function listCents(planId: ReferralPlanId): number {
  return discountedPriceCents(planId) + referralDiscountCents(planId);
}

/** PaymentOrder.amount is stored in WHOLE major units → convert to cents. */
function toCents(wholeUnits: number): number {
  if (!Number.isFinite(wholeUnits)) return 0;
  return Math.round(wholeUnits * 100);
}

function isP2002(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2002";
}

// ────────────────────────────────────────────────────────────────────────────
// Referral code issuance
// ────────────────────────────────────────────────────────────────────────────

export interface ReferralCodeRow {
  id: string;
  code: string;
  userId: string;
}

/**
 * Return the caller's referral code, creating one on first use.
 *
 * Idempotent by `ReferralCode.userId @unique`: a concurrent first request may
 * race, and the loser falls back to the winner's row instead of minting a
 * second code. Code collisions are retried a bounded number of times.
 */
export async function getOrCreateReferralCode(
  userId: string
): Promise<ReferralCodeRow | null> {
  if (!userId) return null;

  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) {
    return { id: existing.id, code: existing.code, userId: existing.userId };
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    try {
      const created = await prisma.referralCode.create({
        data: { userId, code: randomReferralCode() },
      });
      return { id: created.id, code: created.code, userId: created.userId };
    } catch (err) {
      if (isP2002(err)) {
        // Either the user already has a code (race) or the random code collided.
        const raced = await prisma.referralCode.findUnique({ where: { userId } });
        if (raced) {
          return { id: raced.id, code: raced.code, userId: raced.userId };
        }
        continue; // code collision — try another.
      }
      console.error(
        "[referral] failed to allocate referral code",
        (err as Error)?.message ?? err
      );
      throw err;
    }
  }

  console.error("[referral] exhausted referral-code attempts for user", userId);
  return null;
}

/** Uppercase + trim an untrusted referral-code input, or null when empty. */
export function sanitizeReferralCodeInput(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return code.length > 0 ? code : null;
}

export interface ResolvedReferralCode {
  id: string;
  code: string;
  referrerId: string;
}

/**
 * Resolve a redeemed referral code to its active owner for checkout discounting.
 *
 * Returns null for an unknown or deactivated code so the caller silently charges
 * the standard tier rate. A user redeeming their OWN code is intentionally NOT
 * filtered here — that is a discount-granting self-referral, and the credit
 * itself is rejected later at settlement by the shared self-referral fraud gate.
 */
export async function resolveActiveReferralCode(
  rawCode: unknown
): Promise<ResolvedReferralCode | null> {
  const code = sanitizeReferralCodeInput(rawCode);
  if (!code) return null;

  try {
    const row = await prisma.referralCode.findUnique({
      where: { code },
      select: { id: true, code: true, userId: true, active: true },
    });
    if (!row || !row.active) return null;
    return { id: row.id, code: row.code, referrerId: row.userId };
  } catch (err) {
    console.error(
      "[referral] failed to resolve referral code",
      (err as Error)?.message ?? err
    );
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard summary
// ────────────────────────────────────────────────────────────────────────────

export interface ReferralListItem {
  id: string;
  planId: string;
  status: string;
  selfReferral: boolean;
  amountPaidCents: number;
  discountCents: number;
  releaseAt: string;
  createdAt: string;
}

export interface PayoutListItem {
  id: string;
  amountCents: number;
  method: string;
  status: string;
  createdAt: string;
}

export interface ReferralSummary {
  userId: string;
  code: string | null;
  link: string | null;
  isLifetimeUnlocked: boolean;
  unlockRoute: string | null;
  unlockedAt: string | null;
  /** max(Route A %, Route B %) driven by QUALIFIED referrals only. */
  progress: UnlockProgress;
  qualifiedCounts: QualifiedReferralCounts;
  /** Referrals inside the 14-day refund lock (not yet counted toward unlock). */
  pendingCounts: QualifiedReferralCounts;
  cashBalanceCents: number;
  pendingCashCents: number;
  lifetimeCashCents: number;
  payoutMinCents: number;
  referrals: ReferralListItem[];
  payouts: PayoutListItem[];
}

export async function getReferralSummary(
  userId: string
): Promise<ReferralSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isLifetimeUnlocked: true,
      unlockRoute: true,
      unlockedAt: true,
      cashBalanceCents: true,
    },
  });
  if (!user) return null;

  const codeRow = await prisma.referralCode.findUnique({ where: { userId } });

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      planId: true,
      status: true,
      selfReferral: true,
      amountPaidCents: true,
      discountCents: true,
      releaseAt: true,
      createdAt: true,
    },
  });

  const qualifiedCounts: QualifiedReferralCounts = { monthly: 0, lifetime: 0 };
  const pendingCounts: QualifiedReferralCounts = { monthly: 0, lifetime: 0 };

  for (const row of referrals) {
    if (row.selfReferral || row.status === "REJECTED") continue;
    const bucket =
      row.status === "QUALIFIED"
        ? qualifiedCounts
        : row.status === "PENDING"
          ? pendingCounts
          : null;
    if (!bucket) continue;
    if (row.planId === "LIFETIME") bucket.lifetime += 1;
    else bucket.monthly += 1;
  }

  const progress = computeProgress(qualifiedCounts);

  const commissions = await prisma.commission.findMany({
    where: { userId },
    select: { status: true, amountCents: true },
  });
  const lifetimeCashCents = sumReleasedCents(commissions);
  const pendingCashCents = commissions
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + Math.max(0, Math.floor(c.amountCents)), 0);

  const payouts = await prisma.payoutRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      amountCents: true,
      method: true,
      status: true,
      createdAt: true,
    },
  });

  const base = siteBaseUrl();
  const code = codeRow?.code ?? null;

  return {
    userId,
    code,
    link:
      base && code
        ? `${base}/checkout?ref=${encodeURIComponent(code)}`
        : null,
    isLifetimeUnlocked: user.isLifetimeUnlocked,
    unlockRoute: user.unlockRoute ?? null,
    unlockedAt: user.unlockedAt ? user.unlockedAt.toISOString() : null,
    progress,
    qualifiedCounts,
    pendingCounts,
    cashBalanceCents: user.cashBalanceCents,
    pendingCashCents,
    lifetimeCashCents,
    payoutMinCents: REFERRAL_RULES.payoutMinCents,
    referrals: referrals.map((row) => ({
      id: row.id,
      planId: row.planId,
      status: row.status,
      selfReferral: row.selfReferral,
      amountPaidCents: row.amountPaidCents,
      discountCents: row.discountCents,
      releaseAt: row.releaseAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
    payouts: payouts.map((row) => ({
      id: row.id,
      amountCents: row.amountCents,
      method: row.method,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Referral recording (called at payment settlement)
// ────────────────────────────────────────────────────────────────────────────

export type ReferralOutcome =
  | "recorded"
  | "rejected_self_referral"
  | "duplicate"
  | "no_code"
  | "not_paid"
  | "code_inactive"
  | "no_order";

export interface RecordReferralResult {
  outcome: ReferralOutcome;
  referralId: string | null;
  selfReferralReasons: string[];
}

/** Resolve the Prisma buyer for a payment order (userId, else by email). */
async function resolveBuyer(order: { userId: string | null; email: string }) {
  if (order.userId) {
    const byId = await prisma.user.findUnique({ where: { id: order.userId } });
    if (byId) return byId;
  }
  const email = normalizeEmail(order.email);
  return prisma.user.upsert({ where: { email }, update: {}, create: { email } });
}

/**
 * Attribute a PAID order to the referral code it carried at checkout.
 *
 * The row is created `PENDING` (refund lock); `releaseDueReferrals` later
 * promotes it to `QUALIFIED`, which is what actually counts toward unlock.
 * Idempotent by `Referral.referredUserId @unique` — a repeated settlement (e.g.
 * verify callback + webhook) can never double-count a referral. Self-referrals
 * are recorded as `REJECTED` for audit but never qualify or accrue commission.
 */
export async function recordReferralFromOrder(
  orderId: string,
  signals?: Partial<FraudSignals>
): Promise<RecordReferralResult> {
  const blank: RecordReferralResult = {
    outcome: "no_order",
    referralId: null,
    selfReferralReasons: [],
  };
  if (!orderId) return blank;

  const order = await prisma.paymentOrder.findUnique({ where: { orderId } });
  if (!order) return blank;
  if (!order.referralCode) return { ...blank, outcome: "no_code" };
  if (order.status !== "PAID") return { ...blank, outcome: "not_paid" };

  const codeRow = await prisma.referralCode.findUnique({
    where: { code: order.referralCode },
    include: { user: true },
  });
  if (!codeRow || !codeRow.active) {
    return { ...blank, outcome: "code_inactive" };
  }

  const referrer = codeRow.user;
  const buyer = await resolveBuyer(order);

  const verdict = detectSelfReferral({
    referrerUserId: referrer.id,
    referredUserId: buyer.id,
    referrerEmail: referrer.email,
    referredEmail: order.email,
    referrerIpHash: signals?.referrerIpHash ?? null,
    referredIpHash: signals?.referredIpHash ?? null,
    referrerDeviceHash: signals?.referrerDeviceHash ?? null,
    referredDeviceHash: signals?.referredDeviceHash ?? null,
  });

  const planId = order.planId as ReferralPlanId;
  const amountPaidCents = toCents(order.amount);
  const discountCents = Math.max(0, listCents(planId) - amountPaidCents);
  const paidAt = order.paidAt ?? new Date();
  const releaseAt = releaseAtFrom(paidAt);

  let referral: { id: string; releaseAt: Date };
  try {
    referral = await prisma.referral.create({
      data: {
        codeId: codeRow.id,
        referrerId: referrer.id,
        referredUserId: buyer.id,
        planId: order.planId,
        amountPaidCents,
        discountCents,
        selfReferral: verdict.blocked,
        status: verdict.blocked ? "REJECTED" : "PENDING",
        qualifiesUnlock: !verdict.blocked,
        releaseAt,
        ipHash: signals?.referredIpHash ?? null,
        visitorHash: signals?.referredDeviceHash ?? null,
      },
      select: { id: true, releaseAt: true },
    });
  } catch (err) {
    if (isP2002(err)) {
      const existing = await prisma.referral.findUnique({
        where: { referredUserId: buyer.id },
        select: { id: true },
      });
      return {
        outcome: "duplicate",
        referralId: existing?.id ?? null,
        selfReferralReasons: [],
      };
    }
    console.error(
      "[referral] failed to record referral",
      (err as Error)?.message ?? err
    );
    throw err;
  }

  if (verdict.blocked) {
    console.warn("[referral] blocked self-referral", {
      referrerId: referrer.id,
      referredUserId: buyer.id,
      reasons: verdict.reasons,
    });
    return {
      outcome: "rejected_self_referral",
      referralId: referral.id,
      selfReferralReasons: verdict.reasons,
    };
  }

  // Best-effort usage counter — a failure here must never break settlement.
  try {
    await prisma.referralCode.update({
      where: { id: codeRow.id },
      data: { uses: { increment: 1 } },
    });
  } catch (err) {
    console.error(
      "[referral] failed to increment referral code uses",
      (err as Error)?.message ?? err
    );
  }

  // Cash commission flows ONLY to an already-unlocked (VIP) referrer. The
  // referral that UNLOCKS a user earns the free plan, not cash — matching the
  // two-phase design (Phase 1 self-unlock, Phase 2 cash affiliate).
  if (referrer.isLifetimeUnlocked) {
    await accrueCommission({
      id: referral.id,
      referrerId: referrer.id,
      planId: order.planId,
      amountPaidCents,
      releaseAt: referral.releaseAt,
    });
  }

  return {
    outcome: "recorded",
    referralId: referral.id,
    selfReferralReasons: [],
  };
}

/** Create the PENDING commission row for a settled referral (idempotent). */
async function accrueCommission(referral: {
  id: string;
  referrerId: string;
  planId: string;
  amountPaidCents: number;
  releaseAt: Date;
}): Promise<void> {
  const planId = referral.planId as ReferralPlanId;
  const computation = computeCommission(planId, referral.amountPaidCents);
  if (computation.amountCents <= 0) return;

  try {
    await prisma.commission.create({
      data: {
        userId: referral.referrerId,
        referralId: referral.id,
        kind: computation.kind,
        baseCents: computation.baseCents,
        rateBps: computation.rateBps,
        amountCents: computation.amountCents,
        status: "PENDING",
        releaseAt: referral.releaseAt,
      },
    });
  } catch (err) {
    // @@unique([referralId, kind]) — already accrued for this referral.
    if (isP2002(err)) return;
    console.error(
      "[referral] failed to accrue commission",
      (err as Error)?.message ?? err
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Unlock (free Lifetime) grant
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mint the free Lifetime license and flip the user into the VIP tier.
 *
 * Race-safe: the license is created inside a transaction and the unlock is
 * claimed with a conditional `updateMany` ({isLifetimeUnlocked: false}). A
 * concurrent grant loses the claim and discards its duplicate license, so a
 * user can never hold two unlock licenses.
 */
async function grantUnlockLicense(
  userId: string,
  route: UnlockRouteValue
): Promise<string | null> {
  const planRow = await ensurePlanRow("LIFETIME");
  const licenseKey = generateLicenseKey();

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { isLifetimeUnlocked: true },
    });
    if (!current || current.isLifetimeUnlocked) return null;

    const license = await tx.license.create({
      data: {
        key: licenseKey,
        keySha256: sha256(licenseKey),
        userId,
        planId: planRow.id,
        status: "ACTIVE",
        deviceLimit: planRow.deviceLimit,
        maxActivations: 1,
        activatedAt: new Date(),
        expiresAt: null,
        metadata: { source: "REFERRAL_UNLOCK", route, planSlug: "LIFETIME" },
      },
      select: { id: true },
    });

    const claimed = await tx.user.updateMany({
      where: { id: userId, isLifetimeUnlocked: false },
      data: {
        isLifetimeUnlocked: true,
        unlockRoute: route,
        unlockedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      // Another grant won concurrently — discard our duplicate key.
      await tx.license
        .delete({ where: { id: license.id } })
        .catch(() => {
          // If the delete fails the whole transaction rolls back anyway.
        });
      return null;
    }

    console.info("[referral] lifetime unlocked via referral engine", {
      userId,
      route,
      licenseId: license.id,
    });
    return license.id;
  });
}

export interface UnlockResult {
  unlocked: boolean;
  route: UnlockRouteId | "DOWNSELL" | null;
  percent: number;
  licenseId: string | null;
}

/**
 * Recompute a user's unlock tier from their QUALIFIED referrals and grant the
 * free Lifetime license the moment Route A or Route B completes. Idempotent —
 * an already-unlocked user short-circuits without a second grant.
 */
export async function recomputeUnlock(userId: string): Promise<UnlockResult> {
  const rows = await prisma.referral.findMany({
    where: { referrerId: userId, status: "QUALIFIED", qualifiesUnlock: true },
    select: { planId: true },
  });

  const counts: QualifiedReferralCounts = { monthly: 0, lifetime: 0 };
  for (const row of rows) {
    if (row.planId === "LIFETIME") counts.lifetime += 1;
    else counts.monthly += 1;
  }

  const progress = computeProgress(counts);
  if (!progress.unlocked || !progress.unlockRoute) {
    return {
      unlocked: false,
      route: null,
      percent: progress.percent,
      licenseId: null,
    };
  }

  const route: UnlockRouteValue = progress.unlockRoute;
  const licenseId = await grantUnlockLicense(userId, route);
  return { unlocked: true, route, percent: progress.percent, licenseId };
}

/**
 * Server-authoritative gate for the Lifetime partial-credit downsell ($75):
 * the user must NOT already be unlocked and must sit at exactly 1/2 Lifetime
 * qualified referrals (the "partial credit" offer the UI presents). Keeps the
 * sanctioned $75 price from being self-selected by an ineligible buyer.
 */
export async function isDownsellEligible(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [user, rows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { isLifetimeUnlocked: true },
      }),
      prisma.referral.findMany({
        where: { referrerId: userId, status: "QUALIFIED", qualifiesUnlock: true },
        select: { planId: true },
      }),
    ]);
    if (!user || user.isLifetimeUnlocked) return false;
    const counts: QualifiedReferralCounts = { monthly: 0, lifetime: 0 };
    for (const row of rows) {
      if (row.planId === "LIFETIME") counts.lifetime += 1;
      else counts.monthly += 1;
    }
    return computeProgress(counts).downsellEligible;
  } catch (err) {
    // Fail CLOSED — a lookup failure must never authorize the cheaper price.
    console.error("[referral] downsell eligibility check failed:", {
      userId,
      error: (err as Error)?.message ?? err,
    });
    return false;
  }
}

/**
 * DOWNSELL path: a paid $75 Lifetime order unlocks the buyer immediately
 * (partial-credit offer shown when Route A sits at exactly 1/2). The amount is
 * re-checked server-side so a client can never trigger this with a stray price.
 */
export interface DownsellUnlockResult {
  unlocked: boolean;
  licenseId: string | null;
}

export async function handleDownsellUnlock(
  orderId: string
): Promise<DownsellUnlockResult> {
  const order = await prisma.paymentOrder.findUnique({ where: { orderId } });
  if (!order || order.status !== "PAID" || order.planId !== "LIFETIME") {
    return { unlocked: false, licenseId: null };
  }
  if (toCents(order.amount) !== downsellPriceCents()) {
    return { unlocked: false, licenseId: null };
  }
  const buyer = await resolveBuyer(order);
  const licenseId = await grantUnlockLicense(buyer.id, "DOWNSELL");
  return { unlocked: licenseId !== null, licenseId };
}

// ────────────────────────────────────────────────────────────────────────────
// Refund-lock release (run by a cron / admin job)
// ────────────────────────────────────────────────────────────────────────────

/** Promote PENDING referrals past their lock into QUALIFIED + recheck unlocks. */
export async function releaseDueReferrals(now: Date = new Date()): Promise<number> {
  const due = await prisma.referral.findMany({
    where: { status: "PENDING", qualifiesUnlock: true, releaseAt: { lte: now } },
    select: { id: true, referrerId: true },
  });
  if (due.length === 0) return 0;

  const referrers = new Set<string>();
  let released = 0;
  for (const row of due) {
    const claimed = await prisma.referral.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "QUALIFIED" },
    });
    if (claimed.count > 0) {
      released += 1;
      referrers.add(row.referrerId);
    }
  }

  for (const referrerId of referrers) {
    try {
      await recomputeUnlock(referrerId);
    } catch (err) {
      console.error("[referral] unlock recompute failed", {
        referrerId,
        error: (err as Error)?.message ?? err,
      });
    }
  }
  return released;
}

/** Release PENDING commissions past their lock and credit the cash balance. */
export async function releaseDueCommissions(
  now: Date = new Date()
): Promise<number> {
  const due = await prisma.commission.findMany({
    where: { status: "PENDING", releaseAt: { lte: now } },
    select: { id: true, userId: true, amountCents: true },
  });
  if (due.length === 0) return 0;

  let released = 0;
  for (const row of due) {
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.commission.updateMany({
          where: { id: row.id, status: "PENDING" },
          data: { status: "RELEASED", releasedAt: now },
        });
        if (claimed.count > 0) {
          await tx.user.update({
            where: { id: row.userId },
            data: {
              cashBalanceCents: { increment: Math.max(0, row.amountCents) },
            },
          });
          released += 1;
        }
      });
    } catch (err) {
      console.error("[referral] commission release failed", {
        commissionId: row.id,
        error: (err as Error)?.message ?? err,
      });
    }
  }
  return released;
}

export interface ReleaseReport {
  referrals: number;
  commissions: number;
}

/** Run the full refund-lock release sweep. Commissions first, then unlocks. */
export async function releaseAllDue(
  now: Date = new Date()
): Promise<ReleaseReport> {
  const commissions = await releaseDueCommissions(now);
  const referrals = await releaseDueReferrals(now);
  return { referrals, commissions };
}

// ────────────────────────────────────────────────────────────────────────────
// VIP cash payouts
// ────────────────────────────────────────────────────────────────────────────

export interface PayoutRequestInput {
  amountCents: number;
  method?: string | null;
  destination?: string | null;
}

export type PayoutDenial =
  | "user_not_found"
  | "below_minimum"
  | "insufficient_balance"
  | "db_error";

export interface PayoutRequestResult {
  ok: boolean;
  error: PayoutDenial | null;
  payoutId: string | null;
  balanceCents: number;
}

/**
 * Request a cash payout against the released balance.
 *
 * The balance is RESERVED atomically: a conditional `updateMany`
 * ({cashBalanceCents: {gte: amount}}) decrements only when the funds exist, so
 * two concurrent requests can never over-draw the same balance. A rejected
 * payout must be refunded by an admin action (out of scope here).
 */
export async function requestPayout(
  userId: string,
  input: PayoutRequestInput
): Promise<PayoutRequestResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cashBalanceCents: true },
  });
  if (!user) {
    return { ok: false, error: "user_not_found", payoutId: null, balanceCents: 0 };
  }

  const amount = Math.max(
    0,
    Math.floor(Number.isFinite(input.amountCents) ? input.amountCents : 0)
  );
  if (amount < REFERRAL_RULES.payoutMinCents) {
    return {
      ok: false,
      error: "below_minimum",
      payoutId: null,
      balanceCents: user.cashBalanceCents,
    };
  }
  if (amount > user.cashBalanceCents) {
    return {
      ok: false,
      error: "insufficient_balance",
      payoutId: null,
      balanceCents: user.cashBalanceCents,
    };
  }

  try {
    const payout = await prisma.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: userId, cashBalanceCents: { gte: amount } },
        data: { cashBalanceCents: { decrement: amount } },
      });
      if (claimed.count === 0) return null;
      return tx.payoutRequest.create({
        data: {
          userId,
          amountCents: amount,
          method: input.method?.trim() || "UPI",
          destination: input.destination?.trim() || null,
          status: "REQUESTED",
        },
        select: { id: true },
      });
    });

    if (!payout) {
      return {
        ok: false,
        error: "insufficient_balance",
        payoutId: null,
        balanceCents: user.cashBalanceCents,
      };
    }

    return {
      ok: true,
      error: null,
      payoutId: payout.id,
      balanceCents: user.cashBalanceCents - amount,
    };
  } catch (err) {
    console.error("[referral] payout request failed", {
      userId,
      error: (err as Error)?.message ?? err,
    });
    return {
      ok: false,
      error: "db_error",
      payoutId: null,
      balanceCents: user.cashBalanceCents,
    };
  }
}
