import { displayName } from './names.js';

/**
 * Turning a pile of positioned text into a script.
 *
 * Nothing here decides on its own. Every signal — where a line sits, how it's
 * capitalised, what punctuation it carries, what follows it — adds or removes
 * confidence, and anything that stays uncertain is handed to the look-over
 * screen instead of being silently guessed.
 */

/** Below this, a word gets underlined for a human glance. */
export const LOW_CONFIDENCE = 72;

const SCENE_RE = /^\s*(ACT\b|SCENE\b|PROLOGUE\b|EPILOGUE\b|INT\.|EXT\.|INT\/EXT)/i;
const STAGE_VERBS = /^\s*\(?\s*(enter|exit|exeunt|re-?enter|curtain|blackout|lights?\s+(up|down|fade)|beat|pause|silence|they|she|he|aside)\b/i;
const CUE_INLINE_RE = /^\s*([A-Z][A-Z0-9 .'’&#-]{0,30}?[A-Z0-9.)])\s*[.:]\s+(\S.*)$/;

export function parseScript(pages, fallbackTitle = 'Untitled script') {
  const width = median(pages.map((p) => p.pageWidth)) || 612;
  const withMeta = pages.map((p) => ({
    ...p,
    lines: p.lines.map((l) => ({
      ...l,
      indent: l.x0 / (p.pageWidth || width),
      right: l.x1 / (p.pageWidth || width),
      yFrac: l.y / (p.pageHeight || 792),
    })),
  }));

  // Score detection runs on raw OCR, before denoise: cleaning the worst lines
  // off a page of staves lifts its average confidence and hides exactly the
  // signal we're looking for.
  const scorePagesSetAside = trimScore(withMeta);
  denoise(withMeta);
  stripRunningHeads(withMeta);
  const body = trimMatter(withMeta);
  const title = findTitle(withMeta, fallbackTitle);
  const lines = classify(body);
  return {
    title,
    lines,
    characters: collectCharacters(lines),
    notes: { scorePagesSetAside },
  };
}

/* ----------------------------------------------------------------- score */

/**
 * Many published scripts have the vocal score bound in at the back, and a page
 * of staves is not something OCR can read — it comes back as "re = ud =" and
 * "dome TIT 5" and syllables split across barlines. Left in, twenty-five pages
 * of that fill the cast list with ghosts and would be read aloud mid-song.
 *
 * Two signals separate them cleanly: on this script the dialogue pages
 * averaged 91% confidence with 21% one- and two-character tokens, while the
 * score pages averaged 62% and 62%. The boundary between them was one page
 * wide.
 *
 * Only a run at the very back is ever dropped, and only a run of at least
 * three pages. A score lives at the back; a bad page in the middle is just a
 * bad page, and the look-over exists for those.
 */
const SCORE_MIN_RUN = 3;

function trimScore(pages) {
  let first = pages.length;
  while (first > 0 && looksLikeScore(pages[first - 1])) first--;

  const run = pages.length - first;
  if (run < SCORE_MIN_RUN || first === 0) return 0;
  pages.splice(first, run);
  return run;
}

function looksLikeScore(page) {
  const words = page.lines.flatMap((l) => l.words ?? []);
  if (words.length < 20) return false;

  const confidence = words.reduce((sum, w) => sum + (w.conf ?? 100), 0) / words.length;
  const fragments =
    words.filter((w) => w.text.replace(/[^A-Za-z0-9]/g, '').length <= 2).length / words.length;
  return confidence < 75 && fragments > 0.45;
}

/* --------------------------------------------------------------- denoise */

/**
 * Scanner litter, removed before anything tries to read meaning into it.
 *
 * The seam down the left edge of a photocopy comes back as a stray ":" or "3"
 * or "i" glued to the front of the line, and the top of a page can produce a
 * run of pure garbage. Left alone, the first kind corrupts character names and
 * the second gets read aloud in a rehearsal.
 *
 * Every rule here leans on OCR's own confidence, so a clean text layer — where
 * every word is fully confident — passes through untouched.
 */
function denoise(pages) {
  for (const page of pages) {
    page.lines = page.lines
      .map(stripLeadingLitter)
      .filter((line) => line && !isLitter(line));
  }
}

function stripLeadingLitter(line) {
  const words = line.words ?? [];
  if (words.length < 2) return line;

  const first = words[0];
  const stray =
    first.text.length === 1 &&
    !/^[AI]$/i.test(first.text) &&
    (first.conf < 60 || !/[A-Za-z0-9]/.test(first.text));
  if (!stray) return line;

  const rest = words.slice(1);
  return { ...line, words: rest, text: rest.map((w) => w.text).join(' ') };
}

function isLitter(line) {
  const text = line.text.trim();
  if (!text) return true;
  if (!/[A-Za-z0-9]/.test(text)) return true; // a lone ":" or "|"

  const words = line.words ?? [];
  if (!words.length) return true;
  const confidence = words.reduce((sum, w) => sum + (w.conf ?? 100), 0) / words.length;
  if (confidence >= 45) return false;

  // Low confidence on its own isn't enough — a smudged character name is still
  // a character name. It's low confidence *and* a line made mostly of
  // punctuation that means the scanner was reading a coffee ring.
  const junk = (text.match(/[^A-Za-z0-9\s]/g) || []).length / text.length;
  return junk > 0.3;
}

/* ------------------------------------------------- running heads & matter */

/**
 * Anything that repeats in the same spot page after page — a running title, a
 * page number, a revision stamp — is furniture, not script. Digits are masked
 * so "Page 4" and "Page 5" count as the same thing.
 */
function stripRunningHeads(pages) {
  if (pages.length < 3) return;
  const seen = new Map();
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.yFrac > 0.09 && line.yFrac < 0.91) continue;
      const key = headKey(line);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key).add(page.number);
    }
  }
  const minPages = Math.max(2, pages.length * 0.4);
  const repeated = [...seen.entries()].filter(([, p]) => p.size >= minPages).map(([k]) => k);
  if (!repeated.length) return;
  for (const page of pages) {
    page.lines = page.lines.filter((line) => {
      if (line.yFrac > 0.09 && line.yFrac < 0.91) return true;
      const key = headKey(line);
      return !key || !repeated.some((known) => nearlySame(known, key));
    });
  }
}

/**
 * The same header can come back badly enough mangled that even the letters
 * differ — one page of this script read "PFTFR AND THE STARCATCHER". Allowing
 * a few characters of slop catches those without catching real lines, which
 * are nowhere near this similar to a running title.
 */
function nearlySame(a, b, tolerance = 4) {
  if (a === b) return true;
  if (a.slice(0, a.indexOf('|')) !== b.slice(0, b.indexOf('|'))) return false; // different edge
  if (Math.abs(a.length - b.length) > tolerance) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      best = Math.min(best, row[j]);
    }
    if (best > tolerance) return false; // no path can recover from here
    previous = row;
  }
  return previous[b.length] <= tolerance;
}

/**
 * A running head reads the same on every page — but OCR doesn't. The same
 * title strip came back as "PETER AND THE STARCATCHER -7 =" on one page and
 * "PETER AND THE STARCATCHER Ld" on the next, so matching the whole line
 * exactly missed every one of them and the title ended up cast as a character.
 * Keying on the first stretch of letters alone survives the noise.
 */
function headKey(line) {
  const letters = line.text.replace(/[^A-Za-z]/g, '').toLowerCase();
  if (letters.length < 6) return null;
  return `${line.yFrac < 0.5 ? 'top' : 'bottom'}|${letters.slice(0, 18)}`;
}

/** Set aside the cover page, the cast list, and whatever's stapled to the back. */
function trimMatter(pages) {
  const flat = [];
  for (const page of pages) for (const line of page.lines) flat.push({ ...line, page: page.number });

  // A scene heading is the strongest possible "the script starts here"; only
  // fall back to the first character cue when the script has no headings at all.
  let start = flat.findIndex((l) => SCENE_RE.test(l.text));
  if (start < 0) {
    for (let i = 0; i < flat.length; i++) {
      if (looksLikeCue(flat[i], flat, i)) {
        start = firstOfPage(flat, i);
        break;
      }
    }
  }
  if (start < 0) start = 0;

  let end = flat.length;
  for (let i = flat.length - 1; i > start; i--) {
    if (SCENE_RE.test(flat[i].text) || /[.!?…]["'’)]?$/.test(flat[i].text)) {
      end = i + 1;
      break;
    }
  }
  return flat.slice(start, end);
}

// Back up to the top of the page the script actually starts on.
function firstOfPage(flat, index) {
  for (let i = index; i > 0; i--) {
    if (flat[i - 1].page !== flat[index].page) return i;
  }
  return 0;
}

function findTitle(pages, fallback) {
  const firstPage = pages[0]?.lines ?? [];
  const candidate = firstPage.find(
    (l) => l.text.length > 2 && l.text.length < 70 && !/^\d+$/.test(l.text) && !SCENE_RE.test(l.text),
  );
  if (!candidate) return fallback;
  return titleCase(candidate.text.replace(/^["'“]|["'”]$/g, '').trim()) || fallback;
}

/* --------------------------------------------------------------- classify */

function classify(flat) {
  const rightMargin = quantile(flat.map((l) => l.right), 0.92);
  const out = [];
  let speaker = null;

  for (let i = 0; i < flat.length; i++) {
    const line = flat[i];
    const text = line.text.trim();
    if (!text) continue;

    if (SCENE_RE.test(text) && text.length < 80) {
      out.push(make('scene', null, text, line));
      speaker = null;
      continue;
    }

    if (isStageDirection(line, text)) {
      const entry = make('stage', null, stripWrappers(text), line);
      entry.open = bracketBalance(text);
      entry.wrapped = ranToMargin(line, rightMargin) && entry.open > 0;
      out.push(entry);
      continue;
    }

    // A stage direction that ran to the right margin continues on the next
    // line, and its tail must not be mistaken for a cue — "…then to MRS." /
    // "BUMBRAKE)" was landing in the cast list as a character called
    // "BUMBRAKE)".
    const above = out[out.length - 1];
    if (above && above.type === 'stage' && above.wrapped && above.page === line.page) {
      above.text = `${above.text} ${stripWrappers(text)}`.replace(/\s+/g, ' ');
      above.words = [...above.words, ...toWords(line)];
      above.open += bracketBalance(text);
      above.wrapped = ranToMargin(line, rightMargin) && above.open > 0;
      continue;
    }

    // "HAMLET. To be, or not to be" — cue and line sharing a row. Checked
    // only once the whole line has been ruled out as a cue in its own right,
    // or "MRS. BUMBRAKE" gets torn into a character called MRS saying the
    // word "BUMBRAKE".
    if (!isNameShaped(text)) {
      const inline = text.match(CUE_INLINE_RE);
      if (inline && isNameShaped(inline[1]) && inline[2].length > 2 && !isNameShaped(inline[2])) {
        speaker = cueName(inline[1], line.words);
        out.push(make('dialogue', speaker, inline[2].trim(), line));
        continue;
      }
    }

    if (looksLikeCue(line, flat, i)) {
      speaker = cueName(text, line.words);
      continue;
    }

    const prev = out[out.length - 1];
    // Only ever join a line to the one above it on the same page — a footer
    // and the next page's header must never fuse onto someone's speech.
    if (prev && prev.type === 'dialogue' && prev.speaker === speaker && prev.wrapped && prev.page === line.page) {
      // The previous line ran to the margin, so this is the rest of it.
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, ' ');
      prev.words = [...prev.words, ...toWords(line)];
      prev.wrapped = line.right >= rightMargin - 0.03;
      continue;
    }

    out.push(wrapAware(make(speaker ? 'dialogue' : 'stage', speaker, text, line), line, rightMargin));
  }

  foldScannedVariants(out);
  return out.map((l, i) => ({ ...l, id: i, wrapped: undefined, open: undefined }));
}

/** Did this line run to the right margin? If so, the next one continues it. */
function wrapAware(entry, line, rightMargin) {
  return { ...entry, wrapped: ranToMargin(line, rightMargin) };
}

function ranToMargin(line, rightMargin) {
  return line.right >= rightMargin - 0.03;
}

/**
 * Stage direction needs a stricter test than dialogue does, and the bracket is
 * the honest signal — not punctuation. "(…then to MRS." ends in a full stop
 * but is plainly unfinished, while "(…a military cadence.)" is closed and
 * must not reach down and swallow the cue on the next line.
 */
function bracketBalance(text) {
  const open = (text.match(/[([]/g) || []).length;
  const close = (text.match(/[)\]]/g) || []).length;
  return open - close;
}

function make(type, speaker, text, line) {
  const words = toWords(line);
  return {
    type,
    speaker,
    text,
    page: line.page,
    words,
    // Which words to underline in the look-over. On a clean text layer this is
    // always empty, which is exactly right — nothing to proofread.
    shaky: words.filter((w) => w.conf < LOW_CONFIDENCE).map((w) => w.text),
  };
}

function toWords(line) {
  return (line.words ?? []).map((w) => ({ text: w.text, conf: w.conf ?? 100 }));
}

/**
 * Stage direction, without leaning on font styling — a scan carries no italics
 * to read, so this goes on shape and punctuation instead.
 */
function isStageDirection(line, text) {
  if (/^[([].*[)\]]$/.test(text)) return true;
  if (/^[([]/.test(text)) return true;
  const centered = line.indent > 0.25 && line.right < 0.8 && Math.abs(line.indent - (1 - line.right)) < 0.09;
  if (centered && STAGE_VERBS.test(text) && !isNameShaped(text)) return true;
  if (/^(Enter|Exeunt|Exit|Re-enter)\b/.test(text) && text.length < 90) return true;
  return false;
}

/**
 * A character cue is a short, capitalised line that sits on its own and is
 * immediately followed by something dialogue-shaped. Each of those is weak on
 * its own; together they're reliable.
 */
function looksLikeCue(line, flat, index) {
  const text = line.text.trim().replace(/[.:]\s*$/, '');
  if (!isNameShaped(text)) return false;

  const next = flat[index + 1];
  if (!next) return false;
  const nextText = next.text.trim();
  if (!nextText || isNameShaped(nextText)) return false;
  // A cue's dialogue starts on the very next line of the page.
  if (next.page !== line.page && index + 1 < flat.length) return false;

  let score = 1;
  if (line.indent > 0.2) score++;                       // screenplay-style centring
  if (/^[A-Z0-9 .'’&#-]+$/.test(text)) score++;         // shouting the name
  if (!/[.!?,;]$/.test(line.text.trim())) score++;      // cues don't end a sentence
  if (next.indent <= line.indent) score++;              // dialogue sits left of the cue
  if (/^[([]/.test(nextText)) score--;                  // that's a parenthetical, not a line
  return score >= 3;
}

function isNameShaped(raw) {
  const text = raw.trim().replace(/\((?:[^)]*)\)/g, '').replace(/[.:]\s*$/, '').trim();
  if (!text || text.length > 34) return false;
  if (text.split(/\s+/).length > 4) return false;
  // Sung lyrics are set in capitals too, and a page of them will happily
  // masquerade as a cast list. A cue never trails off mid-clause.
  if (/[,;\u2013\u2014-]$/.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2) return false;
  const upper = text.replace(/[^A-Z]/g, '').length;
  return upper / letters.length >= 0.7;
}

/**
 * Tidy a cue into a character name.
 *
 * The margin seam on a photocopy prints a stray mark at both ends of the line,
 * so the cast list comes back holding PRENTISS, "3 PRENTISS", "= PRENTISS",
 * "ASTER i" and "MOLLY )" as separate people. A mark is only removed when OCR
 * itself was unsure of it, or when it isn't a character at all — a confident
 * "TENOR 2" keeps its 2.
 */
function cueName(raw, words = null) {
  let text = String(raw);

  if (words?.length > 1) {
    const tokens = [...words];
    while (tokens.length > 1 && isMargin(tokens[0])) tokens.shift();
    while (tokens.length > 1 && isMargin(tokens[tokens.length - 1])) tokens.pop();
    if (tokens.length !== words.length) text = tokens.map((w) => w.text).join(' ');
  }

  text = text
    .replace(/^[^A-Za-z(]+/, '')
    .replace(/^(?![AI]\s)[A-Za-z]\s+(?=[A-Z])/, '')
    .replace(/[.:]\s*$/, '')
    .replace(/\s+[^A-Za-z0-9)\s]+$/, '')
    .trim();
  return displayName(text || String(raw).trim());
}

/** A stray mark from the edge of the page rather than part of the name. */
function isMargin(word) {
  const text = word.text.trim();
  if (!text) return true;
  if (!/[A-Za-z0-9]/.test(text)) return true;
  if (/\d/.test(text)) return false;      // "TENOR 2" means it
  if (text.length > 2) return false;
  return (word.conf ?? 100) < 65;
}

function stripWrappers(text) {
  return text.replace(/^\s*[([]\s*/, '').replace(/\s*[)\]]\s*$/, '').trim();
}

/**
 * Fold the obvious scanner variants of a name back into it.
 *
 * On a 176-page photocopy the same character turns up as "MOLLY", "MOLLY i",
 * "MOLLY H" and "MOLLY )" — three ghosts holding a line each, cluttering the
 * cast list and, worse, each getting cast with a different voice.
 *
 * Only the unarguable cases are folded: a rare name that is an established
 * name plus a scrap of at most three letters. Anything with more to it than
 * that — "FIGHTING" beside "FIGHTING PRAWN" — is left for the look-over,
 * where a person can decide. Guessing there would be worse than asking.
 */
const ESTABLISHED_LINES = 5;
const RARE_LINES = 2;
const SCRAP_LETTERS = 3;

function foldScannedVariants(lines) {
  const counts = new Map();
  for (const line of lines) {
    if (line.type === 'dialogue' && line.speaker) {
      counts.set(line.speaker, (counts.get(line.speaker) ?? 0) + 1);
    }
  }

  const established = [...counts.entries()]
    .filter(([, n]) => n >= ESTABLISHED_LINES)
    .map(([name]) => name)
    .sort((a, b) => b.length - a.length); // prefer the longest match

  const folded = new Map();
  for (const [name, n] of counts) {
    if (n > RARE_LINES || established.includes(name)) continue;
    const parent = established.find((known) => isScrapOf(name, known));
    if (parent) folded.set(name, parent);
  }
  if (!folded.size) return;

  for (const line of lines) {
    const parent = folded.get(line.speaker);
    if (parent) line.speaker = parent;
  }
}

function isScrapOf(name, known) {
  if (name === known || !name.startsWith(known)) return false;
  const rest = name.slice(known.length);
  if (/\d/.test(rest)) return false; // "TENOR 2" is not a scrap of "TENOR"
  return rest.replace(/[^A-Za-z]/g, '').length <= SCRAP_LETTERS;
}

/* -------------------------------------------------------------- assembly */

export function collectCharacters(lines) {
  const order = [];
  const counts = new Map();
  for (const line of lines) {
    if (line.type !== 'dialogue' || !line.speaker) continue;
    if (!counts.has(line.speaker)) {
      counts.set(line.speaker, 0);
      order.push(line.speaker);
    }
    counts.set(line.speaker, counts.get(line.speaker) + 1);
  }
  return order.map((name) => ({ name, lineCount: counts.get(name) }));
}

/* ---------------------------------------------------------------- numbers */

function median(values) {
  return quantile(values, 0.5);
}
function quantile(values, q) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  return clean[Math.min(clean.length - 1, Math.floor(clean.length * q))];
}
function titleCase(text) {
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(A|An|The|And|Of|In|On|To|For|Or)\b/g, (w, _m, i) => (i === 0 ? w : w.toLowerCase()));
}
