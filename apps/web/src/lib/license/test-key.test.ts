import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MASTER_TEST_LICENSE_KEY,
  isMasterTestKey,
  devTestKeysAllowed,
} from "./test-key";

// FRPB — master test-key gating (security) unit tests.
//
// These lock in the Task 4 fail-closed behavior: the built-in, published
// constant must NEVER activate the product in production unless the operator
// explicitly opts in (ALLOW_DEV_TEST_KEYS or MASTER_TEST_LICENSE_KEY).

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMasterTestKey — development/test", () => {
  it("accepts the built-in key with zero env setup", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_TEST_KEYS", "");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(isMasterTestKey(MASTER_TEST_LICENSE_KEY)).toBe(true);
  });

  it("accepts the broader FRPB-TEST-* prefix", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(isMasterTestKey("frpb-test-anything")).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(isMasterTestKey("  frpb-test-1234-5678  ")).toBe(true);
  });

  it("rejects unrelated keys", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isMasterTestKey("FRPB-ABCD-EFGH-0000")).toBe(false);
  });
});

describe("isMasterTestKey — production is fail-closed", () => {
  it("rejects the built-in key when nothing is opted in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_TEST_KEYS", "");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(devTestKeysAllowed()).toBe(false);
    expect(isMasterTestKey(MASTER_TEST_LICENSE_KEY)).toBe(false);
  });

  it("still rejects the whole FRPB-TEST-* prefix", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_TEST_KEYS", "");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(false);
  });

  it("re-enables the built-in key only when ALLOW_DEV_TEST_KEYS=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_TEST_KEYS", "true");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "");
    expect(devTestKeysAllowed()).toBe(true);
    expect(isMasterTestKey(MASTER_TEST_LICENSE_KEY)).toBe(true);
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(true);
  });

  it("honors a private MASTER_TEST_LICENSE_KEY and drops the built-in one", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_TEST_KEYS", "");
    vi.stubEnv("MASTER_TEST_LICENSE_KEY", "FRPB-PRIVATE-MASTER-9999");
    expect(isMasterTestKey("FRPB-PRIVATE-MASTER-9999")).toBe(true);
    // The published constant is not the configured master key.
    expect(isMasterTestKey(MASTER_TEST_LICENSE_KEY)).toBe(false);
    // The prefix stays gated unless ALLOW_DEV_TEST_KEYS is also set.
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(false);
  });
});
