#!/usr/bin/env node
/**
 * Generate FRPB Windows .ico from the PNG logo.
 * Uses pure Node + zero external binaries (no ImageMagick required).
 * Produces a 256×256 ICO that electron-builder will bundle into the NSIS
 * installer and the exe resources.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const SRC = path.resolve(__dirname, "public", "logo.png");
const OUT = path.resolve(__dirname, "build", "frpb.ico");

async function main() {
  console.log("[icon] reading", SRC);
  const img = await loadImage(SRC);

  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(OUT, buf);

  console.log("[icon] wrote", OUT, `(${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error("[icon] failed:", err);
  process.exit(1);
});
