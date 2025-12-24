#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`postbuild_alias: ${message}`);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const distAssetsDir = path.join(distDir, 'assets');
const outPath = path.join(distAssetsDir, 'app.js');

if (!fs.existsSync(distIndexPath)) {
  fail('`dist/index.html` bulunamadı. Önce `npm run build` çalıştırın.');
}

const html = fs.readFileSync(distIndexPath, 'utf8');
const scriptSrcMatch = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/i);
if (!scriptSrcMatch) {
  fail('`dist/index.html` içinde `type="module"` script bulunamadı.');
}

const moduleSrc = scriptSrcMatch[1];
const entryFileName = path.posix.basename(moduleSrc);
if (!entryFileName || !entryFileName.endsWith('.js')) {
  fail(`Beklenmeyen module src: ${moduleSrc}`);
}

fs.mkdirSync(distAssetsDir, { recursive: true });
fs.writeFileSync(outPath, `import "./${entryFileName}";\n`, 'utf8');

console.log(`postbuild_alias: ${path.relative(rootDir, outPath)} -> ${entryFileName}`);
