import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * FRPB — GET /downloads/[file]
 *
 * Serves direct installer requests (e.g. /downloads/FRPB-Setup.exe or the
 * lowercase /downloads/frpb-setup.exe referenced in email templates) to a real
 * file. Resolution order:
 *
 *   1. Local static file — serves public/downloads/<file> (case-insensitive
 *      match against the .exe on disk) if present.
 *   2. NEXT_PUBLIC_DOWNLOAD_URL — full URL to the installer asset; requests
 *      are 307-redirected there (works with GitHub Releases).
 *   3. DOWNLOAD_BASE_URL — treated as a base; 307 redirect to <base>/<file>.
 *   4. GitHub Releases fallback — latest FRPB-Setup.exe asset.
 *
 * Returns 404 with a JSON body when no target can be resolved.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public", "downloads");

const GITHUB_FALLBACK = "https://github.com/Zapcart/FRPB/releases/latest/download/FRPB-Setup.exe";

const EXE_MIME = "application/octet-stream";

function json404(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const requested = path.basename(file || "").trim();

  // Only ever answer for .exe installer names; anything else is 404.
  if (!requested || !requested.toLowerCase().endsWith(".exe")) {
    return json404("Not found.");
  }

  // ── 1. Serve the local static installer if it exists (case-insensitive). ─
  try {
    const dirEntries = await fs.readdir(PUBLIC_DIR);
    for (const entry of dirEntries) {
      if (entry.toLowerCase() !== requested.toLowerCase()) continue;
      const filePath = path.join(PUBLIC_DIR, entry);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;

      const data = await fs.readFile(filePath);
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          "Content-Type": EXE_MIME,
          "Content-Disposition": `attachment; filename="${entry}"`,
          "Content-Length": String(stat.size),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch {
    // public/downloads missing or unreadable → fall through to redirects.
  }

  // ── 2. Full absolute URL configured? Redirect straight to it. ────────────
  const directUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim();
  if (directUrl && /^https?:\/\//i.test(directUrl)) {
    return NextResponse.redirect(directUrl, 307);
  }

  // ── 3. BASE_URL present? Redirect to <base>/<requested>. ─────────────────
  const baseUrl = process.env.DOWNLOAD_BASE_URL?.trim();
  if (baseUrl && /^https?:\/\//i.test(baseUrl)) {
    return NextResponse.redirect(
      `${baseUrl.replace(/\/+$/, "")}/${requested}`,
      307
    );
  }

  // ── 4. GitHub Releases fallback. ─────────────────────────────────────────
  return NextResponse.redirect(GITHUB_FALLBACK, 307);
}
