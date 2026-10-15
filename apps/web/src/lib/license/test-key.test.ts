import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isMasterTestKey,
  devTestKeysAllowed,
  MASTER_TEST_KEY_ENV,
  LEGACY_MASTER_TEST_KEY_ENV,
  ALLOW_DEV_TEST_KEYS_ENV,
} from "./test-key";

// FRPB — master test-key gating (security) unit tests.
//
// These lock in the hardened behavior: there is NO committed master key, the
// bypass is env-provisioned only, and production is fail-closed unless the
// operator explicitly opts in (ALLOW_DEV_TEST_KEYS or an env master key).

afterEach(() => {
  vi.unstubAllEnvs();
});

const DEV_KEY = "FRPB-DEV-LOCAL-0001";
const PRIVATE_KEY = "FRPB-PRIVATE-MASTER-9999";

describe("isMasterTestKey — development/test", () => {
  it("accepts an env-provisioned master key (no committed default)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(MASTER_TEST_KEY_ENV, DEV_KEY);
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(isMasterTestKey(DEV_KEY)).toBe(true);
    // Normalizes case and whitespace.
    expect(isMasterTestKey("  frpb-dev-local-0001  ")).toBe(true);
  });

  it("accepts the legacy MASTER_TEST_LICENSE_KEY env name", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, DEV_KEY);
    expect(isMasterTestKey(DEV_KEY)).toBe(true);
  });

  it("accepts the broader FRPB-TEST-* prefix in dev", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(isMasterTestKey("frpb-test-anything")).toBe(true);
  });

  it("rejects unrelated keys even in dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(isMasterTestKey("FRPB-ABCD-EFGH-0000")).toBe(false);
  });
});

describe("isMasterTestKey — production is fail-closed", () => {
  it("rejects the removed published key when nothing is opted in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(ALLOW_DEV_TEST_KEYS_ENV, "");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(devTestKeysAllowed()).toBe(false);
    expect(isMasterTestKey("FRPB-TEST-1234-5678")).toBe(false);
  });

  it("still rejects the whole FRPB-TEST-* prefix", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(ALLOW_DEV_TEST_KEYS_ENV, "");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(false);
  });

  it("re-enables the prefix only when ALLOW_DEV_TEST_KEYS=true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(ALLOW_DEV_TEST_KEYS_ENV, "true");
    vi.stubEnv(MASTER_TEST_KEY_ENV, "");
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(devTestKeysAllowed()).toBe(true);
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(true);
  });

  it("honors a private env master key and rejects the published key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(ALLOW_DEV_TEST_KEYS_ENV, "");
    vi.stubEnv(MASTER_TEST_KEY_ENV, PRIVATE_KEY);
    vi.stubEnv(LEGACY_MASTER_TEST_KEY_ENV, "");
    expect(isMasterTestKey(PRIVATE_KEY)).toBe(true);
    // The old hardcoded key is no longer the configured master key.
    expect(isMasterTestKey("FRPB-TEST-1234-5678")).toBe(false);
    // The prefix stays gated unless ALLOW_DEV_TEST_KEYS is also set.
    expect(isMasterTestKey("FRPB-TEST-ANYTHING")).toBe(false);
  });
});
