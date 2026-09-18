import { NextRequest, NextResponse } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

/**
 * FRPB — GET /downloads/[file]
 *
 * Serves direct installer requests (e.g. /downloads/FRPB-Setup.exe, the
 * lowercase /downloads/frpb-setup.exe referenced in email templates, or the
 * macOS /downloads/FRPB-Setup.dmg) to a real file. Resolution order:
 *
 *   1. Local static file — streams public/downloads/<file> (case-insensitive
 *      match against the on-disk asset) if present, forcing an
 *      application/octet-stream attachment download.
 *   2. NEXT_PUBLIC_DOWNLOAD_URL — full URL to the installer asset; requests
 *      are 307-redirected there (works with GitHub Releases). If the value is
 *      a base (no filename) it is treated as a base instead.
 *   3. NEXT_PUBLIC_DOWNLOAD_BASE_URL — client-visible base; redirect to <base>/<file>.
 *   4. DOWNLOAD_BASE_URL — treated as a base; 307 redirect to <base>/<file>.
 *   5. GitHub Releases fallback — the same-named asset on the latest release.
 *
 * Returns 404 with a JSON body when the name is not a known installer, or when
 * no target can be resolved.
 */

// Node runtime is required for filesystem streaming.
export const runtime = "nodejs";
// Never cache/prerender: the on-disk asset and env vars are read per request.
export const dynamic = "force-dynamic";

const PUBLIC_DIR = path.join(process.cwd(), "public", "downloads");

const GITHUB_RELEASES_BASE = "https://github.com/Zapcart/FRPB/releases/latest/download";

// Canonical installer asset name served from GitHub Releases.
// electron-builder is configured with a fixed artifactName ("FRPB-Setup.exe"),
// so the public alias and the real asset name match.
const GITHUB_ASSET_ALIASES: Record<string, string> = {
  "frpb-setup.exe": "FRPB-Setup.exe",
  "frpb-setup.dmg": "FRPB-Setup.dmg",
};

/** Installer assets we are willing to serve; anything else is a 404. */
const ALLOWED_EXTENSIONS = [".exe", ".dmg"] as const;

function isInstaller(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function contentTypeFor(name: string): string {
  return name.toLowerCase().endsWith(".dmg")
    ? "application/x-apple-diskimage"
    : "application/octet-stream";
}

function json404(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const requested = path.basename(file || "").trim();

  // Only ever answer for known installer assets; anything else is 404.
  if (!requested || !isInstaller(requested)) {
    return json404("Not found.");
  }

  // ── 1. Stream the local static installer if it exists (case-insensitive). ─
  try {
    const dirEntries = await fs.readdir(PUBLIC_DIR);
    for (const entry of dirEntries) {
      if (entry.toLowerCase() !== requested.toLowerCase()) continue;
      const filePath = path.join(PUBLIC_DIR, entry);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;

      // Stream from disk instead of buffering the whole (multi-hundred MB)
      // installer into memory.
      const nodeStream = createReadStream(filePath);
      const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": contentTypeFor(entry),
          "Content-Disposition": `attachment; filename="${entry}"`,
          "Content-Length": String(stat.size),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch {
    // public/downloads missing or unreadable → fall through to redirects.
  }

  // ── 2. NEXT_PUBLIC_DOWNLOAD_URL configured? ──────────────────────────────
  // If it points at a concrete file (has a filename extension) redirect
  // straight to it; if it is a base (e.g. https://frpb.in/downloads) treat it
  // as a base so the installer name is still appended.
  const directUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim();
  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    const isFile = /\.[a-z0-9]{2,5}(\?.*)?$/i.test(directUrl);
    return NextResponse.redirect(
      isFile ? directUrl : `${directUrl.replace(/\/+$/, "")}/${requested}`,
      307
    );
  }

  // ── 3. NEXT_PUBLIC_DOWNLOAD_BASE_URL present? Redirect to <base>/<requested>. ──
  const publicBaseUrl = process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL?.trim();
  if (publicBaseUrl && /^https?:\/\//i.test(publicBaseUrl)) {
    return NextResponse.redirect(
      `${publicBaseUrl.replace(/\/+$/, "")}/${requested}`,
      307
    );
  }

  // ── 4. DOWNLOAD_BASE_URL present? Redirect to <base>/<requested>. ────────
  const baseUrl = process.env.DOWNLOAD_BASE_URL?.trim();
  if (baseUrl && /^https?:\/\//i.test(baseUrl)) {
    return NextResponse.redirect(
      `${baseUrl.replace(/\/+$/, "")}/${requested}`,
      307
    );
  }

  // ── 5. GitHub Releases fallback — the latest release's asset. ────────────
  // Translate the public alias (FRPB-Setup.exe) to the real electron-builder
  // asset name (FRPB-Recovery-Setup-<version>.exe) before redirecting.
  const assetName = GITHUB_ASSET_ALIASES[requested.toLowerCase()] ?? requested;
  return NextResponse.redirect(
    `${GITHUB_RELEASES_BASE}/${encodeURIComponent(assetName)}`,
    307
  );
}
