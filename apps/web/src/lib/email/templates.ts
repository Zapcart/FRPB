// FRPB — email templates (Resend).
// Returns branded HTML for license delivery. All URLs come from env vars so
// links stay valid when installers are re-published.

export interface LicenseEmailTemplateInput {
  licenseKey: string;
  planName: string;
  expiresAt: Date | null;
  /** Base download URL (e.g. https://frpb.in/downloads). Filenames are appended. */
  downloadUrl: string;
  quickStartPdfUrl: string;
}

/**
 * Join a base URL with a filename, preserving any query string already on the
 * base. Without this, a base like `https://x/downloads?token=1` would produce
 * `https://x/downloads?token=1/frpb-setup.exe` (broken).
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
                  <a href="${joinUrl(input.downloadUrl, "FRPB-Setup.exe")}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:8px;">⬇ Download for Windows</a>
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
