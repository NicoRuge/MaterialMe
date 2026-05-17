#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE = 'photos';
const ORIGINALS = path.join(BASE, '_originals');
const PREFIX = 'EDIT_';
const MAX_EDGE = 2400;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 82;
const PNG_COMPRESSION = 9;

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (p === ORIGINALS) continue;
      walk(p, out);
    } else if (entry.isFile() && entry.name.startsWith(PREFIX)) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMG_EXTS.has(ext)) out.push(p);
    }
  }
  return out;
}

async function optimize(input) {
  const dir = path.dirname(input);
  const base = path.basename(input);
  const ext = path.extname(base).toLowerCase();
  const targetName = base.slice(PREFIX.length);
  const output = path.join(dir, targetName);

  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${targetName}`);

  let pipeline = sharp(input, { failOn: 'none' })
    .rotate() // honour EXIF orientation, then write upright
    .withMetadata() // keep EXIF (camera, lens, exposure...)
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else {
    pipeline = pipeline.jpeg({
      quality: JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
    });
  }

  await pipeline.toFile(tmp);

  const inSize = fs.statSync(input).size;
  const outSize = fs.statSync(tmp).size;

  // Move original out of the way, then put optimized into place
  const relDir = path.relative(BASE, dir);
  const archiveDir = path.join(ORIGINALS, relDir);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(input, path.join(archiveDir, base));
  fs.renameSync(tmp, output);

  return { input, output, inSize, outSize };
}

(async () => {
  if (!fs.existsSync(BASE)) {
    console.error(`No "${BASE}" directory found.`);
    process.exit(1);
  }

  const files = walk(BASE);
  if (!files.length) {
    console.log(`No "${PREFIX}*" files found under ${BASE}/.`);
    return;
  }

  console.log(`Optimising ${files.length} file(s)…`);
  let totalIn = 0;
  let totalOut = 0;

  for (const f of files) {
    try {
      const r = await optimize(f);
      totalIn += r.inSize;
      totalOut += r.outSize;
      const pct = ((1 - r.outSize / r.inSize) * 100).toFixed(0);
      console.log(
        `  ${path.relative(BASE, r.input)}  →  ${path.relative(BASE, r.output)}  ` +
        `(${(r.inSize / 1024).toFixed(0)} → ${(r.outSize / 1024).toFixed(0)} KB, -${pct}%)`
      );
    } catch (err) {
      console.error(`  ✗ ${f}: ${err.message}`);
    }
  }

  if (totalIn) {
    const pct = ((1 - totalOut / totalIn) * 100).toFixed(0);
    console.log(
      `Done. Saved ${((totalIn - totalOut) / 1024 / 1024).toFixed(2)} MB ` +
      `(${(totalIn / 1024 / 1024).toFixed(2)} → ${(totalOut / 1024 / 1024).toFixed(2)} MB, -${pct}%).`
    );
    console.log(`Originals moved to ${ORIGINALS}/. Run "npm run build:photos" to refresh photos.json.`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
