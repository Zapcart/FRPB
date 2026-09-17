// FRPB — PayGlocal environment resolution (single source of truth).
//
// Two naming conventions exist in the wild and both must work, so every lookup
// falls through an alias chain rather than reading one variable directly:
//
//   Merchant id   PAYGLOCAL_MERCHANT_ID
//   API key       PAYGLOCAL_API_KEY → PAYGLOCAL_MERCHANT_KEY
//   Base URL      PAYGLOCAL_BASE_URL → PAYGLOCAL_API_BASE
//   Secret        PAYGLOCAL_MERCHANT_SECRET (webhook signature)
//
// Keeping the fallback here means a deployment configured with EITHER naming
// scheme talks to the gateway, and a missing key surfaces as a single, explicit
// config error instead of a confusing 401 from PayGlocal.

export interface PayGlocalConfig {
  merchantId: string;
  apiKey: string;
  baseUrl: string;
  secret?: string;
  apiVersion: string;
}

/** First defined, non-empty environment variable from the given names. */
function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Raised when the PayGlocal rail is not fully configured. */
export class PayGlocalConfigError extends Error {
  constructor(readonly missing: string) {
    super(`PayGlocal is not configured (missing ${missing}).`);
    this.name = "PayGlocalConfigError";
  }
}

/**
 * Resolve the PayGlocal configuration, or throw {@link PayGlocalConfigError}
 * naming the first missing variable.
 */
export function resolvePayGlocalConfig(): PayGlocalConfig {
  const merchantId = firstEnv("PAYGLOCAL_MERCHANT_ID");
  if (!merchantId) throw new PayGlocalConfigError("PAYGLOCAL_MERCHANT_ID");

  const apiKey = firstEnv("PAYGLOCAL_API_KEY", "PAYGLOCAL_MERCHANT_KEY");
  if (!apiKey) {
    throw new PayGlocalConfigError("PAYGLOCAL_API_KEY (or PAYGLOCAL_MERCHANT_KEY)");
  }

  const baseUrl = (
    firstEnv("PAYGLOCAL_BASE_URL", "PAYGLOCAL_API_BASE") ?? "https://api.payglocal.in"
  ).replace(/\/+$/, "");

  return {
    merchantId,
    apiKey,
    baseUrl,
    secret: firstEnv("PAYGLOCAL_MERCHANT_SECRET"),
    apiVersion: firstEnv("PAYGLOCAL_API_VERSION") ?? "v1",
  };
}

/** True when the minimum PayGlocal credentials are present. */
export function isPayGlocalConfigured(): boolean {
  try {
    resolvePayGlocalConfig();
    return true;
  } catch {
    return false;
  }
}
