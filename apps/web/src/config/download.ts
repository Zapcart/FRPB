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

/** Current published release tag (without the leading `v`). */
export const RELEASE_VERSION = "1.0.0";

/** Canonical Windows installer asset name (matches electron-builder artifactName). */
export const EXE_NAME = "FRPB-Setup.exe";

/** Canonical macOS installer asset name. */
export const DMG_NAME = "FRPB-Setup.dmg";

/**
 * Versioned GitHub Releases download directory, e.g.
 * https://github.com/Zapcart/FRPB-Application/releases/download/v1.0.0
 */
export const GITHUB_RELEASES_BASE = `https://github.com/${GITHUB_REPO}/releases/download/v${RELEASE_VERSION}`;

/**
 * Direct, ready-to-click URL for the Windows installer:
 * https://github.com/Zapcart/FRPB-Application/releases/download/v1.0.0/FRPB-Setup.exe
 */
export const GITHUB_DOWNLOAD_URL = `${GITHUB_RELEASES_BASE}/${EXE_NAME}`;

/**
 * Public asset alias → canonical published asset name. Email templates and
 * legacy links use the lowercase alias; GitHub stores the mixed-case asset.
 */
export const GITHUB_ASSET_ALIASES: Record<string, string> = {
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
 *   3. GitHub Releases — the built-in default ({@link GITHUB_DOWNLOAD_URL}).
 *
 * Read per request so an environment change is picked up without a code edit.
 */
export function resolveInstallerUrl(exeName: string = EXE_NAME): string {
  const direct = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim();
  if (direct) {
    const isFile = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(direct);
    return isFile ? direct : `${direct.replace(/\/+$/, "")}/${exeName}`;
  }

  const base = (
    process.env.DOWNLOAD_BASE_URL?.trim() || GITHUB_RELEASES_BASE
  ).replace(/\/+$/, "");

  return `${base}/${exeName}`;
}
