// FRPB — email templates (Resend).
// Returns branded HTML for license delivery plus the marketing/onboarding
// sends (promo blast to existing users, welcome offer to new signups).
// All URLs come from env vars so links stay valid when installers are
// re-published.

export interface LicenseEmailTemplateInput {
  licenseKey: string;
  planName: string;
  expiresAt: Date | null;
  /**
   * Base download URL for installer assets (defaults to the GitHub Releases
   * tag directory, e.g. https://github.com/Zapcart/FRPB-Application/releases/download/v1.0.0).
   * Filenames are appended.
   */
  downloadUrl: string;
  quickStartPdfUrl: string;
}

/**
 * Join a base URL with a filename, preserving any query string already on the
 * base. Without this, a base like `https://x/downloads?token=1` would produce
 * `https://x/downloads?token=1/frpb-recovery-setup-1.0.1.exe` (broken).
 */
function joinUrl(base: string, filename: string): string {
  const [root = "", query] = base.split("?");
  return `${root.replace(/\/+$/, "")}/${filename}${query ? `?${query}` : ""}`;
}

export function licenseDeliveredTemplate(input: LicenseEmailTemplateInput): {
  subject: string;
  html: string;
} {
  const expiresLine = input.expiresAt
    ? `Valid until <strong>${input.expiresAt.toISOString().slice(0, 10)}</strong>`
    : "<strong>Lifetime access</strong> — never expires";

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0;color:#fff;font-size:22px;">Your FRPB license is ready 🎉</h1>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;">
              Thanks for purchasing the <strong style="color:#22d3ee;">${input.planName}</strong>.
              ${expiresLine}. Activate the desktop app with the key below.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;">
            <table role="presentation" width="100%" style="background:#020617;border:1px dashed #164e63;border-radius:12px;">
              <tr><td align="center" style="padding:20px;">
                <p style="margin:0;font-family:'Courier New',monospace;font-size:20px;letter-spacing:3px;color:#67e8f9;font-weight:bold;">${input.licenseKey}</p>
                <p style="margin:8px 0 0;color:#64748b;font-size:12px;">FRPB-XXXX-XXXX-XXXX · one-time display</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 6px;">
                  <a href="${joinUrl(input.downloadUrl, "FRPB-Recovery-Setup-1.0.1.exe")}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:8px;">⬇ Download for Windows</a>
                </td>
                <td align="center" style="padding:0 6px;">
                  <a href="${joinUrl(input.downloadUrl, "FRPB-Setup.dmg")}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:8px;">⬇ Download for macOS</a>
                </td>
              </tr>
            </table>
            <p style="text-align:center;margin:20px 0 0;">
              <a href="${input.quickStartPdfUrl}" style="color:#22d3ee;font-size:13px;">📄 View the Quick Start Guide (PDF)</a>
            </p>
            <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0 12px;" />
            <p style="color:#475569;font-size:12px;line-height:1.5;">
              This key is bound to your FRPB account and the devices you activate.
              It is verified online on every launch. Questions? Reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `Your FRPB License Key — ${input.planName}`,
    html,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketing / onboarding templates
//
// Both reuse the same 600px table-based dark card as the license email so the
// brand stays consistent across every touchpoint. Everything is inline-styled:
// Gmail/Outlook strip <style> blocks, and the previous license template already
// proved this markup renders correctly in the major clients.
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical pricing destination for every promo CTA. */
export const PRICING_URL = "https://frpb.in/pricing";
export const TELEGRAM_URL = "https://t.me/frpbnetwork";

export interface OfferEmailTemplateInput {
  /** Recipient's display name, if we know it. Falls back to a neutral greeting. */
  name?: string | null;
}

/** Shared shell so both marketing emails stay pixel-identical in structure. */
function offerShell(input: {
  greeting: string;
  headline: string;
  intro: string;
  bullets: string[];
  ctaLabel: string;
  footerNote: string;
}): string {
  const bullets = input.bullets
    .map(
      (item) => `<tr>
                <td valign="top" style="padding:0 0 10px;color:#22d3ee;font-size:14px;line-height:1.5;">✓</td>
                <td valign="top" style="padding:0 0 10px;color:#cbd5e1;font-size:14px;line-height:1.5;">${item}</td>
              </tr>`
    )
    .join("\n              ");

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 6px;color:#64748b;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">FRPB Network</p>
            <h1 style="margin:0 0 12px;color:#fff;font-size:24px;line-height:1.3;">${input.headline}</h1>
            <p style="margin:0;color:#94a3b8;font-size:15px;line-height:1.6;">${input.greeting}</p>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;">${input.intro}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0;">
            <table role="presentation" width="100%" style="background:#020617;border:1px dashed #164e63;border-radius:12px;">
              <tr><td align="center" style="padding:22px 20px;">
                <p style="margin:0;color:#64748b;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Limited-time launch price</p>
                <p style="margin:6px 0 0;color:#67e8f9;font-size:34px;font-weight:bold;line-height:1.1;">$20 <span style="color:#94a3b8;font-size:15px;font-weight:normal;">/ 6 months</span></p>
                <p style="margin:8px 0 0;color:#64748b;font-size:12px;">One-time payment · USD · no subscription</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${bullets}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 32px 28px;">
            <a href="${PRICING_URL}" style="display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:15px 36px;border-radius:10px;">${input.ctaLabel}</a>
            <p style="margin:14px 0 0;color:#475569;font-size:12px;">Instant license key by email after payment.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 14px;" />
            <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">${input.footerNote}</p>
            <p style="margin:10px 0 0;color:#475569;font-size:12px;line-height:1.6;">
              Need help? Reply to this email or join our Telegram:
              <a href="${TELEGRAM_URL}" style="color:#22d3ee;text-decoration:none;">@frpbnetwork</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * One-time promotional blast to users who already have an account.
 * Subject is fixed by the marketing brief — do not localise/alter casually,
 * it is what the campaign copy was approved against.
 */
export function promoOfferTemplate(input: OfferEmailTemplateInput = {}): {
  subject: string;
  html: string;
} {
  const name = input.name?.trim();
  const greeting = name
    ? `Hi ${name},`
    : "Hi there,";

  const html = offerShell({
    greeting,
    headline: "Get 6 months of FRPB for just $20 🚀",
    intro:
      "You already have a FRPB account — and for a limited time you can unlock <strong style=\"color:#22d3ee;\">6 full months of access for a one-time $20</strong>. No subscription, no auto-renewal, no hidden fees.",
    bullets: [
      "<strong style=\"color:#e2e8f0;\">6 months of full access</strong> for a single $20 payment",
      "Works on Windows and macOS with the official FRPB desktop app",
      "Instant license key delivered straight to your inbox",
      "Priority support via Telegram and email",
      "Launch pricing is temporary — the plan reverts to 2 months after the promo",
    ],
    ctaLabel: "Claim the $20 Offer →",
    footerNote:
      "You are receiving this because you have a FRPB account. Prices are in USD. This launch offer is limited and may end without notice.",
  });

  return { subject: "Special Offer: Get 6 Months FRPB Access for $20 🚀", html };
}

/**
 * Automated welcome email for a brand-new account.
 * Same offer, warmer framing, plus a note that they are already signed in.
 */
export function welcomeOfferTemplate(input: OfferEmailTemplateInput = {}): {
  subject: string;
  html: string;
} {
  const name = input.name?.trim();
  const greeting = name
    ? `Welcome aboard, ${name}!`
    : "Welcome aboard!";

  const html = offerShell({
    greeting,
    headline: "Your FRPB account is ready 🎉",
    intro:
      "Thanks for joining FRPB. Your account is active — and as a new member you can grab <strong style=\"color:#22d3ee;\">6 months of access for a one-time $20</strong> while the launch offer lasts.",
    bullets: [
      "<strong style=\"color:#e2e8f0;\">6 months of full access</strong> for a single $20 payment",
      "Instant license key by email — no waiting, no approval step",
      "One key per device, verified online on every launch",
      "Works on Windows and macOS",
      "Priority support via Telegram and email",
    ],
    ctaLabel: "Activate my $20 Offer →",
    footerNote:
      "You are receiving this because you just created a FRPB account. Prices are in USD. This launch offer is limited and may end without notice.",
  });

  return { subject: "Welcome to FRPB 🎉 — Get 6 Months for $20", html };
}
