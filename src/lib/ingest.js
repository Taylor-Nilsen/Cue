import { readTextLayer, textLayerIsUsable, renderPage } from './pdf.js';
import { cleanPage } from './preprocess.js';
import { recognizePage, disposeOcr } from './ocr.js';
import { keepAwake, releaseWake } from './wakelock.js';

/**
 * Turn the script pages of a PDF into positioned lines of text.
 *
 * Two roads in. A clean digital export already knows its own words, so we take
 * them. Anything else is treated as what it usually is — a photograph of a
 * page — and gets straightened, cleaned, and read.
 *
 * @param {any} pdf an already-open pdf.js document
 * @param {{from: number, to: number}} range the pages holding dialogue
 * @param {(update: {message: string, current: number, total: number}) => void} onProgress
 * @returns {Promise<{pages: Page[], scanned: boolean}>}
 */
export async function ingestPdf(pdf, range, onProgress = () => {}) {
  const from = Math.max(1, range?.from ?? 1);
  const to = Math.min(pdf.numPages, range?.to ?? pdf.numPages);
  const total = to - from + 1;

  onProgress({ message: 'Opening your script…', current: 0, total: 0 });
  // Reading a long scan takes minutes. Letting the screen lock halfway
  // through is a good way to come back to a job that never finished.
  keepAwake();

  // Sniff a few pages to decide which road we're on, rather than deciding page
  // by page and ending up with a script read two different ways.
  const scanned = !(await hasRealTextLayer(pdf, from, to));

  const pages = [];
  for (let n = from; n <= to; n++) {
    const done = n - from + 1;
    onProgress({ message: `Reading page ${done} of ${total}…`, current: done, total });

    const page = await pdf.getPage(n);
    let result = null;

    if (!scanned) {
      result = await readTextLayer(page);
    }
    if (!result) {
      const canvas = await renderPage(page);
      result = await recognizePage(cleanPage(canvas));
      canvas.width = canvas.height = 0; // let the bitmap go; scripts get long
    }

    pages.push({ number: n, ...result });
    page.cleanup();
    // Yield so the progress bar actually paints between pages.
    await new Promise((r) => setTimeout(r, 0));
  }

  if (scanned) await disposeOcr();
  releaseWake();
  return { pages, scanned };
}

async function hasRealTextLayer(pdf, from, to) {
  const probes = [from, Math.ceil((from + to) / 2), to].filter((n, i, a) => a.indexOf(n) === i);
  let good = 0;
  for (const n of probes) {
    const page = await pdf.getPage(n);
    const layer = await readTextLayer(page);
    if (textLayerIsUsable(layer)) good++;
    page.cleanup();
  }
  return good >= Math.ceil(probes.length / 2);
}
