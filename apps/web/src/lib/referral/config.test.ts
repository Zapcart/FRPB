import { describe, expect, it } from "vitest";

import {
  BPS_DENOMINATOR,
  REFERRAL_RULES,
  applyBps,
  downsellPriceCents,
  discountedPriceCents,
  isSanctionedReferralAmount,
  referralDiscountCents,
  releaseAtFrom,
} from "./config";

// FRPB — referral config (pricing / discount / sanction) unit tests.

describe("applyBps", () => {
  it("floors the basis-point portion of a cent amount", () => {
    expect(applyBps(15_000, 2_000)).toBe(3_000); // 20% of $150 = $30
    expect(applyBps(2_000, 3_000)).toBe(600); // 30% of $20 = $6
    expect(applyBps(15_000, 5_000)).toBe(7_500); // 50% of $150 = $75
  });

  it("floors fractional cents (never over-credits)", () => {
    expect(applyBps(999, 2_000)).toBe(199); // 199.8 -> 199
    expect(applyBps(333, 5_000)).toBe(166); // 166.5 -> 166
  });

  it("returns 0 for non-positive or non-finite inputs", () => {
    expect(applyBps(0, 2_000)).toBe(0);
    expect(applyBps(-100, 2_000)).toBe(0);
    expect(applyBps(15_000, 0)).toBe(0);
    expect(applyBps(Number.NaN, 2_000)).toBe(0);
    expect(applyBps(15_000, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("uses a 10000 bps denominator", () => {
    expect(BPS_DENOMINATOR).toBe(10_000);
    expect(applyBps(10_000, 10_000)).toBe(10_000); // 100%
  });
});

describe("referral discounting", () => {
  it("gives referred friends 20% off the Lifetime plan ($150 -> $120)", () => {
    expect(referralDiscountCents("LIFETIME")).toBe(3_000);
    expect(discountedPriceCents("LIFETIME")).toBe(12_000);
  });

  it("gives 0% off the Monthly plan (fully protected MRR)", () => {
    expect(referralDiscountCents("MONTH_1")).toBe(0);
    expect(discountedPriceCents("MONTH_1")).toBe(2_000);
  });

  it("computes the 50% partial-credit downsell price ($75)", () => {
    expect(downsellPriceCents()).toBe(7_500);
  });
});

describe("isSanctionedReferralAmount", () => {
  it("accepts the Lifetime list, discounted, and downsell prices", () => {
    expect(isSanctionedReferralAmount("LIFETIME", 15_000)).toBe(true);
    expect(isSanctionedReferralAmount("LIFETIME", 12_000)).toBe(true);
    expect(isSanctionedReferralAmount("LIFETIME", 7_500)).toBe(true);
  });

  it("accepts the Monthly list price and rejects the lifetime downsell", () => {
    expect(isSanctionedReferralAmount("MONTH_1", 2_000)).toBe(true);
    expect(isSanctionedReferralAmount("MONTH_1", 7_500)).toBe(false);
  });

  it("rejects arbitrary self-invented amounts", () => {
    expect(isSanctionedReferralAmount("LIFETIME", 1)).toBe(false);
    expect(isSanctionedReferralAmount("LIFETIME", 14_999)).toBe(false);
    expect(isSanctionedReferralAmount("MONTH_1", 1_500)).toBe(false);
    expect(isSanctionedReferralAmount("LIFETIME", -12_000)).toBe(false);
  });
});

describe("releaseAtFrom", () => {
  it("adds the 14-day refund-lock window", () => {
    const paidAt = new Date("2026-01-01T00:00:00.000Z");
    const release = releaseAtFrom(paidAt);
    const expectedMs = REFERRAL_RULES.refundLockDays * 24 * 60 * 60 * 1000;
    expect(release.getTime() - paidAt.getTime()).toBe(expectedMs);
    expect(release.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const paidAt = new Date("2026-01-01T00:00:00.000Z");
    releaseAtFrom(paidAt);
    expect(paidAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
