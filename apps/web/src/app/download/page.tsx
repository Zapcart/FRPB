import { redirect } from "next/navigation";

/**
 * FRPB — /download
 *
 * Canonical short link that always triggers a download of the latest compiled
 * desktop installer. Resolves, in order:
 *
 *   1. NEXT_PUBLIC_DOWNLOAD_URL — full installer URL (e.g.
 *      https://frpb.in/downloads/FRPB-Setup.exe). Used verbatim when set.
 *   2. DOWNLOAD_BASE_URL — treated as a base; <base>/FRPB-Setup.exe is used.
 *   3. Relative fallback — /downloads/FRPB-Setup.exe (served by the dynamic
 *      /downloads/[file] route from public/downloads or GitHub Releases).
 *
 * Read per request so a redeployed binary/env change is picked up immediately.
 */
export const dynamic = "force-dynamic";

const EXE_NAME = "FRPB-Setup.exe";

function downloadTarget(): string {
  const direct = process.env.NEXT_PUBLIC_DOWNLOAD_URL;
  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }
  const base = (process.env.DOWNLOAD_BASE_URL || "/downloads").replace(/\/+$/, "");
  return `${base}/${EXE_NAME}`;
}

export default function DownloadPage(): never {
  redirect(downloadTarget());
}
