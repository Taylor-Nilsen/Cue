import { createWorker, PSM } from 'tesseract.js';

/**
 * On-device OCR. Everything it needs — the worker, the wasm core, the English
 * language data — is served from our own origin (see scripts/copy-assets.mjs),
 * so a first visit primes the cache and every visit after that works with no
 * network at all.
 */

/**
 * These have to be absolute URLs, not relative ones.
 *
 * tesseract.js fetches its worker and re-serves it as a blob: URL, and inside
 * that worker `importScripts('./tess/worker.min.js')` resolves against the
 * blob rather than the page — which fails with "The URL is invalid" and takes
 * the whole ingest down with it. Resolving against document.baseURI up front
 * gives an absolute URL that still honours a subfolder deployment.
 */
const TESS = new URL('tess/', document.baseURI).href;

let sessionPromise = null;

export function ocrSession() {
  if (!sessionPromise) {
    sessionPromise = createWorker('eng', 1, {
      workerPath: `${TESS}worker.min.js`,
      workerBlobURL: false,
      corePath: TESS,
      langPath: TESS,
      // 'write', not 'refresh'. Refresh re-downloads the 11 MB of language
      // data on every single visit and overwrites the cache with it, which
      // both wastes a rehearsal room's worth of tethering and quietly breaks
      // the promise that Cue works offline after the first read.
      cacheMethod: 'write',
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
          .map((w) => ({
            text: w.text.trim(),
            conf: w.confidence ?? 0,
            // Where each word sits matters as much as what it says: scanning a
            // bound book catches a strip of the facing page, and OCR happily
            // runs it into the start of a real line. Only the coordinates give
            // that away.
            x0: w.bbox?.x0 ?? line.bbox.x0,
            x1: w.bbox?.x1 ?? line.bbox.x1,
          }))
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
