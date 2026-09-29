import { describe, expect, it } from "vitest";

import {
  batteryBar,
  computeProgress,
  type QualifiedReferralCounts,
} from "./progress";

// FRPB — gamified unlock progress unit tests (Route A / Route B).

describe("computeProgress — Route A (2 Lifetime referrals)", () => {
  it("stays locked at 1/2 Lifetime referrals", () => {
    const p = computeProgress({ monthly: 0, lifetime: 1 });
    expect(p.unlocked).toBe(false);
    expect(p.unlockRoute).toBeNull();
    expect(p.routeA.complete).toBe(false);
    expect(p.routeA.lifetime).toEqual({ current: 1, required: 2 });
    expect(p.percent).toBe(50);
  });

  it("unlocks at exactly 2 Lifetime referrals", () => {
    const p = computeProgress({ monthly: 0, lifetime: 2 });
    expect(p.unlocked).toBe(true);
    expect(p.unlockRoute).toBe("ROUTE_A");
    expect(p.routeA.complete).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.downsellEligible).toBe(false);
  });

  it("stays unlocked above the threshold", () => {
    const p = computeProgress({ monthly: 0, lifetime: 5 });
    expect(p.unlocked).toBe(true);
    expect(p.unlockRoute).toBe("ROUTE_A");
  });
});

describe("computeProgress — Route B (4 Monthly + 1 Lifetime)", () => {
  it("stays locked at 4 Monthly + 0 Lifetime", () => {
    const p = computeProgress({ monthly: 4, lifetime: 0 });
    expect(p.unlocked).toBe(false);
    expect(p.routeB.complete).toBe(false);
    expect(p.percent).toBe(50); // monthly half complete only
  });

  it("stays locked at 3 Monthly + 1 Lifetime", () => {
    const p = computeProgress({ monthly: 3, lifetime: 1 });
    expect(p.unlocked).toBe(false);
    expect(p.unlockRoute).toBeNull();
    expect(p.routeA.percent).toBe(50);
    expect(p.routeB.complete).toBe(false);
    // Route B = (3/4 + 1/1) / 2 = 0.875 -> 88%.
    expect(p.percent).toBe(88);
  });

  it("unlocks at exactly 4 Monthly + 1 Lifetime", () => {
    const p = computeProgress({ monthly: 4, lifetime: 1 });
    expect(p.unlocked).toBe(true);
    expect(p.unlockRoute).toBe("ROUTE_B");
    expect(p.routeB.complete).toBe(true);
    expect(p.percent).toBe(100);
  });

  it("unlocks with extra referrals beyond Route B", () => {
    const p = computeProgress({ monthly: 9, lifetime: 3 });
    expect(p.unlocked).toBe(true);
    // Route A is complete too, and wins the tie for the reported route.
    expect(p.unlockRoute).toBe("ROUTE_A");
  });
});

describe("computeProgress — non-qualifying combinations stay locked", () => {
  it.each<QualifiedReferralCounts>([
    { monthly: 0, lifetime: 0 },
    { monthly: 1, lifetime: 1 },
    { monthly: 2, lifetime: 1 },
    { monthly: 3, lifetime: 1 }, // the explicitly-required case
    { monthly: 3, lifetime: 0 },
    { monthly: 4, lifetime: 0 },
  ])("does not unlock for %o", (counts) => {
    const p = computeProgress(counts);
    expect(p.unlocked).toBe(false);
    expect(p.unlockRoute).toBeNull();
  });
});

describe("computeProgress — progress percentage is max(A%, B%)", () => {
  it("reports the higher of the two routes", () => {
    const p = computeProgress({ monthly: 2, lifetime: 1 });
    // Route A: 1/2 = 50%. Route B: (2/4 + 1/1)/2 = 75%.
    expect(p.percent).toBe(75);
  });
});

describe("computeProgress — downsell eligibility", () => {
  it("is eligible at exactly 1/2 Lifetime and not otherwise", () => {
    expect(computeProgress({ monthly: 0, lifetime: 1 }).downsellEligible).toBe(
      true
    );
    expect(computeProgress({ monthly: 3, lifetime: 1 }).downsellEligible).toBe(
      true
    );
    expect(computeProgress({ monthly: 0, lifetime: 0 }).downsellEligible).toBe(
      false
    );
    expect(computeProgress({ monthly: 0, lifetime: 2 }).downsellEligible).toBe(
      false
    );
  });
});

describe("computeProgress — defensive input handling", () => {
  it("coerces negative/fractional/non-finite counts safely", () => {
    expect(computeProgress({ monthly: -5, lifetime: -1 }).unlocked).toBe(false);
    expect(computeProgress({ monthly: 2.9, lifetime: 1.9 }).lifetimeCount).toBe(
      1
    );
    const p = computeProgress({ monthly: Number.NaN, lifetime: Infinity });
    expect(p.unlocked).toBe(false);
    expect(p.monthlyCount).toBe(0);
  });
});

describe("batteryBar", () => {
  it("renders the 10-segment battery string", () => {
    expect(batteryBar(0)).toBe("[░░░░░░░░░░] 0% Unlocked");
    expect(batteryBar(50)).toBe("[▓▓▓▓▓░░░░░] 50% Unlocked");
    expect(batteryBar(100)).toBe("[▓▓▓▓▓▓▓▓▓▓] 100% Unlocked");
  });

  it("clamps out-of-range and rounds the percent", () => {
    expect(batteryBar(-10)).toBe("[░░░░░░░░░░] 0% Unlocked");
    expect(batteryBar(150)).toBe("[▓▓▓▓▓▓▓▓▓▓] 100% Unlocked");
    expect(batteryBar(88)).toBe("[▓▓▓▓▓▓▓▓▓░] 88% Unlocked");
  });
});
