import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Rasterize at ~200 DPI equivalent; below this, OCR on a photocopy falls apart. */
const RASTER_SCALE = 2.2;

export async function openPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

/**
 * Pull the embedded text layer, if there is one worth having.
 *
 * The spec assumes every upload is a scan — and most rehearsal scripts are —
 * but plenty of them are a clean export, and OCR-ing a document that already
 * knows its own words would be slower *and* less accurate. So: take the text
 * layer when it's real, fall back to reading the page as a photograph when
 * it isn't.
 *
 * @returns {Promise<{lines: Line[], pageWidth: number, pageHeight: number}|null>}
 */
export async function readTextLayer(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((i) => i.str && i.str.trim());
  if (items.length < 4) return null;

  // pdf.js reports y from the bottom; flip it so everything downstream can
  // think in "distance from the top of the page" like a human reading.
  const boxes = items.map((i) => {
    const x = i.transform[4];
    const yBottom = i.transform[5];
    const h = Math.abs(i.transform[3]) || i.height || 10;
    return { text: i.str, x0: x, x1: x + (i.width || 0), y: viewport.height - yBottom, h };
  });

  return { lines: groupIntoLines(boxes), pageWidth: viewport.width, pageHeight: viewport.height };
}

/** True when the text layer has enough real words to trust over OCR. */
export function textLayerIsUsable(result) {
  if (!result) return false;
  const text = result.lines.map((l) => l.text).join(' ');
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const words = text.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  // A scanned page often carries a junk text layer of a dozen stray glyphs.
  return letters > 120 && words.length > 25;
}

/** Render one page to a canvas for OCR. */
export async function renderPage(page, scale = RASTER_SCALE) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Cluster positioned text fragments into visual lines. Fragments whose
 * baselines sit within half a line-height of each other belong together.
 */
export function groupIntoLines(boxes) {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const lines = [];
  for (const b of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(b.y - last.y) <= Math.max(4, b.h * 0.6)) {
      last.parts.push(b);
      last.x1 = Math.max(last.x1, b.x1);
      last.y = (last.y * (last.parts.length - 1) + b.y) / last.parts.length;
    } else {
      lines.push({ y: b.y, x0: b.x0, x1: b.x1, h: b.h, parts: [b] });
    }
  }
  return lines.map((l) => {
    l.parts.sort((a, b) => a.x0 - b.x0);
    return {
      x0: Math.min(...l.parts.map((p) => p.x0)),
      x1: l.x1,
      y: l.y,
      h: l.h,
      text: joinParts(l.parts),
      // A text layer is exact, so every word is fully confident.
      words: l.parts.flatMap((p) =>
        p.text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, conf: 100 })),
      ),
    };
  });
}

function joinParts(parts) {
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i > 0) {
      const prev = parts[i - 1];
      const gap = p.x0 - prev.x1;
      // pdf.js splits mid-word for kerning; only insert a space for a real gap.
      if (gap > Math.max(1, p.h * 0.18) && !/\s$/.test(out)) out += ' ';
    }
    out += p.text;
  }
  return out.replace(/\s+/g, ' ').trim();
}
