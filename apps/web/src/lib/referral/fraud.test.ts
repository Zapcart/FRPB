import { describe, expect, it } from "vitest";

import { detectSelfReferral, isSelfReferral } from "./fraud";

// FRPB — self-referral / anti-abuse detection unit tests.

describe("detectSelfReferral", () => {
  it("flags the same user id", () => {
    const v = detectSelfReferral({
      referrerUserId: "user_1",
      referredUserId: "user_1",
    });
    expect(v.blocked).toBe(true);
    expect(v.reasons).toContain("same_user");
  });

  it("flags the same email (case/whitespace insensitive)", () => {
    const v = detectSelfReferral({
      referrerEmail: "  Foo@Example.com ",
      referredEmail: "foo@example.com",
    });
    expect(v.blocked).toBe(true);
    expect(v.reasons).toContain("same_email");
  });

  it("flags the same IP hash", () => {
    const v = detectSelfReferral({
      referrerIpHash: "sha256:abc",
      referredIpHash: "sha256:abc",
    });
    expect(v.blocked).toBe(true);
    expect(v.reasons).toContain("same_ip");
  });

  it("flags the same device fingerprint", () => {
    const v = detectSelfReferral({
      referrerDeviceHash: "dev_xyz",
      referredDeviceHash: "dev_xyz",
    });
    expect(v.blocked).toBe(true);
    expect(v.reasons).toContain("same_device");
  });

  it("collects every reason when multiple signals collide", () => {
    const v = detectSelfReferral({
      referrerUserId: "u1",
      referredUserId: "u1",
      referrerEmail: "a@b.com",
      referredEmail: "a@b.com",
      referrerIpHash: "ip",
      referredIpHash: "ip",
      referrerDeviceHash: "dev",
      referredDeviceHash: "dev",
    });
    expect(v.blocked).toBe(true);
    expect(v.reasons).toEqual([
      "same_user",
      "same_email",
      "same_ip",
      "same_device",
    ]);
  });

  it("allows a genuine, distinct referral", () => {
    const v = detectSelfReferral({
      referrerUserId: "user_1",
      referredUserId: "user_2",
      referrerEmail: "a@example.com",
      referredEmail: "b@example.com",
      referrerIpHash: "ip_a",
      referredIpHash: "ip_b",
      referrerDeviceHash: "dev_a",
      referredDeviceHash: "dev_b",
    });
    expect(v.blocked).toBe(false);
    expect(v.reasons).toEqual([]);
  });

  it("is not fooled by missing signals (does not false-positive)", () => {
    const v = detectSelfReferral({
      referrerUserId: "user_1",
      referredUserId: null,
      referrerEmail: null,
      referredEmail: undefined,
    });
    expect(v.blocked).toBe(false);
  });

  it("treats empty/whitespace strings as absent", () => {
    const v = detectSelfReferral({
      referrerEmail: "   ",
      referredEmail: "",
      referrerIpHash: "",
      referredIpHash: "   ",
    });
    expect(v.blocked).toBe(false);
  });
});

describe("isSelfReferral", () => {
  it("is a boolean convenience wrapper", () => {
    expect(isSelfReferral({ referrerUserId: "u", referredUserId: "u" })).toBe(
      true
    );
    expect(isSelfReferral({ referrerUserId: "u", referredUserId: "v" })).toBe(
      false
    );
  });
});
