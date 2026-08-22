import { createWorker, PSM } from 'tesseract.js';

/**
 * On-device OCR. Everything it needs — the worker, the wasm core, the English
 * language data — is served from our own origin (see scripts/copy-assets.mjs),
 * so a first visit primes the cache and every visit after that works with no
 * network at all.
 */

const BASE = import.meta.env.BASE_URL;
const TESS = `${BASE}tess/`;

let sessionPromise = null;

export function ocrSession() {
  if (!sessionPromise) {
    sessionPromise = createWorker('eng', 1, {
      workerPath: `${TESS}worker.min.js`,
      corePath: TESS,
      langPath: TESS,
      cacheMethod: 'refresh',
    }).then(async (worker) => {
      await worker.setParameters({
        // A script page is a single column of text with generous margins.
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      return worker;
    });
  }
  return sessionPromise;
}

export async function disposeOcr() {
  if (!sessionPromise) return;
  const worker = await sessionPromise.catch(() => null);
  sessionPromise = null;
  await worker?.terminate();
}

/**
 * Read one prepared page image.
 *
 * Returns lines with per-word confidence still attached — that score is what
 * lets the look-over screen underline exactly the words Cue wasn't sure about
 * instead of making you proofread the whole script.
 *
 * @returns {Promise<{lines: Line[], pageWidth: number, pageHeight: number}>}
 */
export async function recognizePage(canvas) {
  const worker = await ocrSession();
  const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });

  const lines = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const words = (line.words ?? [])
          .map((w) => ({ text: w.text.trim(), conf: w.confidence ?? 0 }))
          .filter((w) => w.text);
        if (!words.length) continue;
        const text = words.map((w) => w.text).join(' ');
        lines.push({
          x0: line.bbox.x0,
          x1: line.bbox.x1,
          y: line.bbox.y0,
          h: Math.max(1, line.bbox.y1 - line.bbox.y0),
          text,
          words,
        });
      }
    }
  }
  lines.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  return { lines, pageWidth: canvas.width, pageHeight: canvas.height };
}
