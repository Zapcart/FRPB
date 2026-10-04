import { redirect } from "next/navigation";
import { resolveInstallerUrl } from "@/config/download";

/**
 * FRPB — /download
 *
 * Canonical short link that always triggers a download of the latest compiled
 * desktop installer. Resolution (see src/config/download.ts):
 *
 *   1. NEXT_PUBLIC_DOWNLOAD_URL — explicit override, used verbatim.
 *   2. DOWNLOAD_BASE_URL — treated as a base; <base>/<installer>.exe is used.
 *   3. GitHub Releases — the built-in default, i.e.
 *      https://github.com/Zapcart/FRPB-Application/releases/download/v2.0.0/FRPB-Recovery-Setup-1.0.1.exe
 *
 * Read per request so a redeployed binary or environment change is picked up
 * immediately, without touching the code.
 */
export const dynamic = "force-dynamic";

export default function DownloadPage(): never {
  redirect(resolveInstallerUrl());
}
