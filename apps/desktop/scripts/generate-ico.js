#!/usr/bin/env node
/**
 * Generate the FRPB Windows .ico from the PNG logo.
 *
 * Zero npm dependencies: uses the built-in PowerShell + System.Drawing
 * (present on every Windows host) to produce high-quality resized PNGs, then
 * wraps those PNGs into a valid multi-resolution ICO container. PNG-compressed
 * ICO entries are supported natively by Windows Vista+ and by electron-builder
 * / rcedit, so no BMP conversion or ImageMagick is required.
 *
 * Output: apps/desktop/build/frpb.ico (matches `build.win.icon` in package.json)
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SIZES = [16, 24, 32, 48, 64, 128, 256];

function resolveSrc() {
  const candidates = [
    path.resolve(__dirname, "..", "src", "assets", "logo.png"),
    path.resolve(__dirname, "..", "public", "logo.png"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Build an ICO container from an ordered list of {size, png} entries. */
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  entries.forEach((entry, i) => {
    const base = i * 16;
    const dim = entry.size >= 256 ? 0 : entry.size; // 0 encodes 256
    dir.writeUInt8(dim, base + 0); // width
    dir.writeUInt8(dim, base + 1); // height
    dir.writeUInt8(0, base + 2); // color count (0 = 32bpp)
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // planes
    dir.writeUInt16LE(32, base + 6); // bit count
    dir.writeUInt32LE(entry.png.length, base + 8); // bytes in resource
    dir.writeUInt32LE(offset, base + 12); // image data offset
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/** Resize the source PNG to each target size using PowerShell System.Drawing. */
function renderResizedPngs(src, outDir) {
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    `$src = [System.Drawing.Image]::FromFile(${JSON.stringify(src)})`,
    `$outDir = ${JSON.stringify(outDir)}`,
    `$sizes = @(${SIZES.join(",")})`,
    "foreach ($s in $sizes) {",
    "  $bmp = New-Object System.Drawing.Bitmap($s, $s)",
    "  $g = [System.Drawing.Graphics]::FromImage($bmp)",
    "  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
    "  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality",
    "  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality",
    "  $g.Clear([System.Drawing.Color]::Transparent)",
    "  $ratio = [Math]::Min($s / $src.Width, $s / $src.Height)",
    "  $w = [int]($src.Width * $ratio)",
    "  $h = [int]($src.Height * $ratio)",
    "  $x = [int](($s - $w) / 2)",
    "  $y = [int](($s - $h) / 2)",
    "  $g.DrawImage($src, $x, $y, $w, $h)",
    "  $g.Dispose()",
    "  $bmp.Save((Join-Path $outDir (\"icon_\" + $s + \".png\")), [System.Drawing.Imaging.ImageFormat]::Png)",
    "  $bmp.Dispose()",
    "}",
    "$src.Dispose()",
  ].join("\n");

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { stdio: "inherit" },
  );

  if (result.error) throw new Error(`Failed to launch PowerShell: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`PowerShell icon resize exited with code ${result.status}`);
}

function main() {
  if (process.platform !== "win32") {
    console.log("[icon] Non-Windows platform detected; skipping .ico generation.");
    return;
  }

  const src = resolveSrc();
  if (!src) {
    console.error("[icon] Could not locate logo.png (checked src/assets and public).");
    process.exit(1);
  }

  const out = path.resolve(__dirname, "..", "build", "frpb.ico");
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "frpb-ico-"));
  try {
    console.log("[icon] rendering sizes from", src);
    renderResizedPngs(src, tmpDir);

    const entries = SIZES.map((size) => {
      const pngPath = path.join(tmpDir, `icon_${size}.png`);
      if (!fs.existsSync(pngPath)) throw new Error(`Expected resized PNG missing: ${pngPath}`);
      return { size, png: fs.readFileSync(pngPath) };
    });

    const ico = buildIco(entries);
    fs.writeFileSync(out, ico);
    console.log(`[icon] wrote ${out} (${(ico.length / 1024).toFixed(1)} KB, ${entries.length} sizes)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error("[icon] failed:", err);
  process.exit(1);
}
