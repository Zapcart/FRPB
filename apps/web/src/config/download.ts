/**
 * FRPB — Central download & release configuration.
 *
 * Single source of truth for the desktop-installer download target, the
 * current release version and the release notes surfaced in the UI.
 *
 * The production binary is hosted on GitHub Releases so the download inherits
 * GitHub's high domain authority and sidesteps the Chrome /
 * Windows Defender SmartScreen "uncommonly downloaded" warnings that a
 * low-reputation first-party host attracts.
 */

/** GitHub organisation/repository that publishes the desktop installers. */
export const GITHUB_REPO = "Zapcart/FRPB-Application";

/**
 * Semantic product version shown in UI copy (badges, "What's new" headings,
 * structured-data `softwareVersion`). Kept separate from the git *tag* below so
 * display versioning and the published release tag can evolve independently.
 */
export const RELEASE_VERSION = "1.0.0";

/**
 * Published GitHub Release tag used to build every download URL. The v1.0.0
 * release is the canonical distribution point for the current build.
 */
export const RELEASE_TAG = "v1.0.0";

/** Canonical Windows installer asset name (matches electron-builder artifactName). */
export const EXE_NAME = "FRPB-Recovery-Setup-1.0.1.exe";

/** Canonical macOS installer asset name. */
export const DMG_NAME = "FRPB-Setup.dmg";

/**
 * Versioned GitHub Releases directory that hosts the raw installer assets, e.g.
 * https://github.com/Zapcart/FRPB-Application/releases/download/v1.0.0
 */
export const GITHUB_RELEASES_BASE = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}`;

/**
 * Canonical GitHub Release *page* for the current build:
 * https://github.com/Zapcart/FRPB-Application/releases/tag/v1.0.0
 *
 * Retained as a non-broken human-facing fallback (e.g. a "All releases" link),
 * but the primary download CTAs now point straight at the raw installer asset
 * ({@link GITHUB_DOWNLOAD_URL}) so a click starts the download immediately.
 */
export const GITHUB_RELEASES_TAG = `https://github.com/${GITHUB_REPO}/releases/tag/${RELEASE_TAG}`;

/**
 * Direct, ready-to-click URL for the Windows installer asset on the pinned
 * release:
 * https://github.com/Zapcart/FRPB-Application/releases/download/v1.0.0/FRPB-Recovery-Setup-1.0.1.exe
 */
export const GITHUB_DOWNLOAD_URL = `${GITHUB_RELEASES_BASE}/${EXE_NAME}`;

/**
 * Public asset alias → canonical published asset name. Email templates and
 * legacy links use the lowercase alias; GitHub stores the mixed-case asset.
 */
export const GITHUB_ASSET_ALIASES: Record<string, string> = {
  "frpb-recovery-setup-1.0.1.exe": EXE_NAME,
  // Legacy alias retained so previously shared lowercase links keep resolving.
  "frpb-setup.exe": EXE_NAME,
  "frpb-setup.dmg": DMG_NAME,
};

/**
 * Exact end-user guidance for the first-launch browser / SmartScreen notice,
 * rendered directly beneath the primary download button.
 */
export const SMARTSCREEN_NOTICE =
  "Note: If Chrome or Windows SmartScreen shows a standard 'Unrecognized App' notice on first launch, click 'Keep' or 'More Info -> Run Anyway' to complete the setup.";

/** Release notes for the currently published build. */
export const RELEASE_NOTES: readonly string[] = [
  "Added support for latest 2026 Android security patches.",
  "Enhanced BROM/EDL auto-driver installer.",
  "Performance and connection stability improvements.",
];

/**
 * Resolve the installer URL used by the landing page, header, `/download` and
 * `/downloads`. Resolution priority:
 *
 *   1. `NEXT_PUBLIC_DOWNLOAD_URL` — explicit override; a concrete file URL is
 *      used verbatim, a bare base has the asset name appended.
 *   2. `DOWNLOAD_BASE_URL` — treated as a base directory.
 *   3. GitHub Releases — the direct installer asset
 *      ({@link GITHUB_DOWNLOAD_URL}). Clicking any CTA immediately starts the
 *      download of the v1.0.0 setup file from the pinned release.
 *
 * Read per request so an environment change is picked up without a code edit.
 */
export function resolveInstallerUrl(exeName: string = EXE_NAME): string {
  const direct = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim();
  if (direct) {
    // A concrete asset (…/file.exe) OR a Release *page* (…/releases/tag/…) is a
    // complete destination — never append a filename, or we'd build a broken
    // path like `…/releases/tag/v1.0.0/frpb-recovery-setup-1.0.1.exe`.
    const isPage = /\/releases\/tag\//i.test(direct);
    const isFile = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(direct);
    if (isPage || isFile) return direct;
    return `${direct.replace(/\/+$/, "")}/${exeName}`;
  }

  const base = process.env.DOWNLOAD_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${exeName}`;

  // Direct asset download: a click immediately starts the setup-file download.
  return GITHUB_DOWNLOAD_URL;
}
