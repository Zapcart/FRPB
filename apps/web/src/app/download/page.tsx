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
 *   3. GitHub Releases — the built-in default, i.e. the canonical release page
 *      https://github.com/quotexahsan90-cyber/FRPB-APP/releases/tag/v2
 *
 * Read per request so a redeployed binary or environment change is picked up
 * immediately, without touching the code.
 */
export const dynamic = "force-dynamic";

export default function DownloadPage(): never {
  redirect(resolveInstallerUrl());
}
