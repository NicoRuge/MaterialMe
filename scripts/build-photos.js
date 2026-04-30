#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BASE = 'photos';
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const categories = fs
  .readdirSync(BASE, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const manifest = {};
for (const cat of categories) {
  const dir = path.join(BASE, cat);
  const files = fs
    .readdirSync(dir)
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((f) => `${BASE}/${cat}/${f}`);
  manifest[cat] = files;
}

fs.writeFileSync('photos.json', JSON.stringify(manifest, null, 2) + '\n');

const summary = Object.fromEntries(
  Object.entries(manifest).map(([k, v]) => [k, v.length])
);
console.log('Wrote photos.json:', summary);
