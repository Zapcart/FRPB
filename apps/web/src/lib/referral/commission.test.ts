import { describe, expect, it } from "vitest";

import {
  commissionKindForPlan,
  commissionRateBps,
  computeCommission,
  sumReleasedCents,
} from "./commission";

// FRPB — VIP cash affiliate commission unit tests.

describe("commission rates", () => {
  it("maps plans to their commission kind", () => {
    expect(commissionKindForPlan("MONTH_1")).toBe("MONTHLY_RECURRING");
    expect(commissionKindForPlan("LIFETIME")).toBe("LIFETIME_UPFRONT");
  });

  it("uses 30% for Monthly and 50% for Lifetime", () => {
    expect(commissionRateBps("MONTH_1")).toBe(3_000);
    expect(commissionRateBps("LIFETIME")).toBe(5_000);
  });
});

describe("computeCommission", () => {
  it("pays 30% ($6) on a referred $20/mo monthly sale", () => {
    const c = computeCommission("MONTH_1", 2_000);
    expect(c).toEqual({
      kind: "MONTHLY_RECURRING",
      baseCents: 2_000,
      rateBps: 3_000,
      amountCents: 600,
    });
  });

  it("pays 50% ($100) on a referred $200 lifetime sale", () => {
    const c = computeCommission("LIFETIME", 20_000);
    expect(c).toEqual({
      kind: "LIFETIME_UPFRONT",
      baseCents: 20_000,
      rateBps: 5_000,
      amountCents: 10_000,
    });
  });

  it("pays 50% ($80) on a referral-discounted $160 lifetime sale", () => {
    const c = computeCommission("LIFETIME", 16_000);
    expect(c.amountCents).toBe(8_000);
  });

  it("serialises recurring monthly income correctly ($6 -> $60 over 10 months)", () => {
    let total = 0;
    for (let month = 0; month < 10; month += 1) {
      total += computeCommission("MONTH_1", 2_000).amountCents;
    }
    expect(total).toBe(6_000);
  });

  it("guards against negative / non-finite bases", () => {
    expect(computeCommission("LIFETIME", -100).amountCents).toBe(0);
    expect(computeCommission("MONTH_1", Number.NaN).amountCents).toBe(0);
    expect(computeCommission("LIFETIME", Number.POSITIVE_INFINITY).baseCents).toBe(
      0
    );
  });
});

describe("sumReleasedCents", () => {
  it("sums only RELEASED rows", () => {
    const total = sumReleasedCents([
      { status: "RELEASED", amountCents: 600 },
      { status: "PENDING", amountCents: 10_000 },
      { status: "RELEASED", amountCents: 10_000 },
      { status: "CANCELLED", amountCents: 600 },
    ]);
    expect(total).toBe(10_600);
  });

  it("is defensive against malformed rows", () => {
    const total = sumReleasedCents([
      { status: "RELEASED", amountCents: Number.NaN },
      { status: "RELEASED", amountCents: -500 },
      { status: "RELEASED", amountCents: 1_000 },
    ]);
    expect(total).toBe(1_000);
  });

  it("returns 0 for an empty list", () => {
    expect(sumReleasedCents([])).toBe(0);
  });
});
