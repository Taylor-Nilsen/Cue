import { openPdf, readTextLayer, textLayerIsUsable, renderPage } from './pdf.js';
import { cleanPage } from './preprocess.js';
import { recognizePage, disposeOcr } from './ocr.js';

/**
 * Turn an uploaded PDF into positioned lines of text, one bundle per page.
 *
 * Two roads in. A clean digital export already knows its own words, so we take
 * them. Anything else is treated as what it usually is — a photograph of a
 * page — and gets straightened, cleaned, and read.
 *
 * @param {File} file
 * @param {(update: {message: string, current: number, total: number}) => void} onProgress
 * @returns {Promise<{pages: Page[], scanned: boolean}>}
 */
export async function ingestPdf(file, onProgress = () => {}) {
  onProgress({ message: 'Opening your script…', current: 0, total: 0 });
  const pdf = await openPdf(file);
  const total = pdf.numPages;

  // Sniff the first few pages to decide which road we're on, rather than
  // deciding page by page and ending up with a script read two different ways.
  const scanned = !(await hasRealTextLayer(pdf, total));

  const pages = [];
  for (let n = 1; n <= total; n++) {
    onProgress({
      message: scanned ? `Reading page ${n} of ${total}…` : `Reading page ${n} of ${total}`,
      current: n,
      total,
    });

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

  await pdf.destroy();
  if (scanned) await disposeOcr();
  return { pages, scanned };
}

async function hasRealTextLayer(pdf, total) {
  const probes = [1, Math.ceil(total / 2), total].filter((n, i, a) => a.indexOf(n) === i);
  let good = 0;
  for (const n of probes) {
    const page = await pdf.getPage(n);
    const layer = await readTextLayer(page);
    if (textLayerIsUsable(layer)) good++;
    page.cleanup();
  }
  return good >= Math.ceil(probes.length / 2);
}
