// FRPB — webhook signature-secret resolution + production enforcement.
//
// WHY THIS EXISTS
// ---------------
// A payment webhook that is accepted without signature verification is an open
// door: anyone who learns the endpoint URL can POST a fake "payment succeeded"
// payload and be granted a free license. The previous behaviour was to verify
// ONLY when a secret happened to be configured, which meant a production deploy
// missing that env var silently accepted unauthenticated webhooks.
//
// The rule enforced here:
//   • production  → the secret is MANDATORY. A missing secret is a fatal
//                   configuration error and the webhook route refuses to run.
//   • development → verification is still applied when a secret is present; when
//                   absent, the caller is told explicitly so it can log a
//                   warning and accept (local testing convenience only).
//
// Alias chains are supported because the two provider integrations in this
// codebase historically used different variable names.

/** Hosted providers that sign webhooks. (INR/Direct-UPI has no webhook.) */
export type WebhookProvider = "PAYGLOCAL";

/** Thrown when a required production webhook secret is not configured. */
export class WebhookSecretConfigError extends Error {
  constructor(
    readonly provider: WebhookProvider,
    readonly variableNames: readonly string[]
  ) {
    super(
      `${provider} webhook secret is not configured. A production deployment ` +
        `MUST set ${variableNames.join(" or ")} — without it, webhook signature ` +
        `verification is impossible and forged payment events would be accepted.`
    );
    this.name = "WebhookSecretConfigError";
  }
}

/** Environment variable names accepted for each provider (first match wins). */
const SECRET_ENV: Record<WebhookProvider, readonly string[]> = {
  PAYGLOCAL: ["PAYGLOCAL_WEBHOOK_SECRET", "PAYGLOCAL_MERCHANT_SECRET"],
};

/** First defined, non-empty environment variable from the given names. */
function firstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** True when running in a production build. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Resolve the webhook secret for a provider.
 *
 * @throws {WebhookSecretConfigError} in production when no secret is set.
 */
export function requireWebhookSecret(provider: WebhookProvider): string {
  const names = SECRET_ENV[provider];
  const secret = firstEnv(names);
  if (secret) return secret;

  if (isProduction()) {
    throw new WebhookSecretConfigError(provider, names);
  }

  // Development: make the gap obvious rather than silently degrading.
  console.warn(
    `[webhooks] ${provider} secret is unset (${names.join(" / ")}). ` +
      `Signature verification is DISABLED — this is only acceptable in development.`
  );
  return "";
}

/** Non-throwing variant: the secret, or null when unavailable. */
export function getWebhookSecret(provider: WebhookProvider): string | null {
  return firstEnv(SECRET_ENV[provider]) ?? null;
}
