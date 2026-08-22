// Vendors the OCR runtime into public/tess so the built site is fully
// self-hosted: no unpkg CDN at runtime, and the service worker can precache
// everything for offline use. Runs on postinstall and before every build.
import { copyFileSync, mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tess');
mkdirSync(out, { recursive: true });

const FROM_NODE_MODULES = [
  'tesseract.js/dist/worker.min.js',
  'tesseract.js-core/tesseract-core-simd-lstm.js',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-lstm.js',
  'tesseract.js-core/tesseract-core-lstm.wasm',
  'tesseract.js-core/tesseract-core-lstm.wasm.js',
];

for (const rel of FROM_NODE_MODULES) {
  const src = join(root, 'node_modules', rel);
  if (!existsSync(src)) {
    console.warn(`[copy-assets] missing ${rel} — run npm install first`);
    continue;
  }
  copyFileSync(src, join(out, rel.split('/').pop()));
}

// The English language data isn't on npm; pull it once and keep it.
const LANG = join(out, 'eng.traineddata.gz');
const LANG_URL = 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz';
if (existsSync(LANG) && statSync(LANG).size > 1_000_000) {
  console.log('[copy-assets] eng.traineddata.gz already present');
} else {
  process.stdout.write('[copy-assets] downloading eng.traineddata.gz … ');
  try {
    const res = await fetch(LANG_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(LANG, Buffer.from(await res.arrayBuffer()));
    console.log('done');
  } catch (err) {
    console.log('failed');
    console.warn(`[copy-assets] could not fetch OCR language data (${err.message}).`);
    console.warn(`[copy-assets] download it by hand into public/tess/:\n  ${LANG_URL}`);
  }
}
