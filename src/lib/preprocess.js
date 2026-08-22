/**
 * Getting a photocopy ready to read.
 *
 * A rehearsal script is usually a photocopy of a photocopy that someone
 * scanned crooked, or a phone photo taken in a dim green room. OCR is far more
 * forgiving once the page is straight, evenly lit, and free of speckle — so
 * every page goes through deskew, contrast normalization, and a light denoise
 * before it's read.
 */

const MAX_SKEW_DEG = 6;
const SKEW_STEP_DEG = 0.25;
const ANALYSIS_WIDTH = 720;

/** @returns {HTMLCanvasElement} a cleaned-up copy of the page. */
export function cleanPage(canvas) {
  const angle = estimateSkew(canvas);
  const straight = Math.abs(angle) > 0.15 ? rotate(canvas, -angle) : canvas;
  normalizeContrast(straight);
  despeckle(straight);
  return straight;
}

/* ------------------------------------------------------------------ skew */

/**
 * Text lines make horizontal bands of ink. At the correct angle those bands
 * line up and the row-by-row ink profile gets spiky; at the wrong angle it
 * smears flat. So: try every plausible angle and keep the spikiest.
 */
export function estimateSkew(canvas) {
  const { data, width, height } = grayscaleSample(canvas, ANALYSIS_WIDTH);
  const threshold = otsu(data);
  const ink = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) ink[i] = data[i] < threshold ? 1 : 0;

  let best = 0;
  let bestScore = -Infinity;
  for (let deg = -MAX_SKEW_DEG; deg <= MAX_SKEW_DEG; deg += SKEW_STEP_DEG) {
    const score = profileSharpness(ink, width, height, Math.tan((deg * Math.PI) / 180));
    if (score > bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  return best;
}

/** Shear-sample the ink into row sums, then score how sharply they vary. */
function profileSharpness(ink, width, height, slope) {
  const rows = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x += 2) {
      const sy = y + Math.round((x - width / 2) * slope);
      if (sy < 0 || sy >= height) continue;
      sum += ink[sy * width + x];
    }
    rows[y] = sum;
  }
  let score = 0;
  for (let y = 1; y < height; y++) {
    const d = rows[y] - rows[y - 1];
    score += d * d;
  }
  return score;
}

function rotate(canvas, deg) {
  const rad = (deg * Math.PI) / 180;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

/* -------------------------------------------------------------- contrast */

/**
 * Stretch the page so paper is white and ink is black, using percentiles
 * rather than min/max — a single dust speck shouldn't define "black", and a
 * blown-out highlight shouldn't define "white".
 */
export function normalizeContrast(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;

  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    hist[(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0]++;
  }
  const total = px.length / 4;
  const lo = percentile(hist, total, 0.02);
  const hi = percentile(hist, total, 0.98);
  const span = Math.max(1, hi - lo);

  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = Math.max(0, Math.min(255, Math.round(((v - lo) / span) * 255)));
  }
  for (let i = 0; i < px.length; i += 4) {
    const g = lut[(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0];
    px[i] = px[i + 1] = px[i + 2] = g;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function percentile(hist, total, fraction) {
  let seen = 0;
  const target = total * fraction;
  for (let v = 0; v < 256; v++) {
    seen += hist[v];
    if (seen >= target) return v;
  }
  return 255;
}

/* --------------------------------------------------------------- speckle */

/**
 * Scanner dust is dark pixels with no dark neighbours. Real ink is never
 * alone. Anything isolated gets bleached back to paper.
 */
export function despeckle(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  const w = canvas.width;
  const h = canvas.height;
  const dark = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) dark[p] = px[i] < 110 ? 1 : 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!dark[p]) continue;
      const n =
        dark[p - w - 1] + dark[p - w] + dark[p - w + 1] +
        dark[p - 1] + dark[p + 1] +
        dark[p + w - 1] + dark[p + w] + dark[p + w + 1];
      if (n <= 1) {
        const i = p * 4;
        px[i] = px[i + 1] = px[i + 2] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------------------------------------------------------- shared */

function grayscaleSample(canvas, targetWidth) {
  const scale = Math.min(1, targetWidth / canvas.width);
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, width, height);
  const px = ctx.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    data[p] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
  }
  return { data, width, height };
}

/** Otsu's method: the threshold that best splits ink from paper. */
export function otsu(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = v;
    }
  }
  return best;
}
