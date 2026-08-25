import { voiceSlug, voiceFromSlug, NARRATOR_VOICE } from './voices.js';
import { splitSpeakers, joinSpeakers } from './speakers.js';

/**
 * The little file that remembers everything.
 *
 * One plain-text file holds the cleaned-up script, the casting, the colours,
 * and the settings. Upload it next time and Cue skips straight to the reading
 * screen. It's deliberately readable — front matter for the setup, then the
 * script with a bracketed speaker on each line — so you can open it in any
 * text editor and nudge a line without special software.
 */

export const FILE_EXTENSION = '.cue.md';
const FENCE = '---';

/* ------------------------------------------------------------------ write */

export function serialize({ title, characters, settings, lines }) {
  const out = [FENCE];
  out.push(`title: ${quote(title || 'Untitled script')}`);
  out.push('settings:');
  out.push(`  line_delay_ms: ${Math.round(settings.lineDelayMs ?? 600)}        # pause between lines`);
  out.push(`  read_stage_directions: ${settings.readStageDirections !== false}`);
  out.push('characters:');
  for (const c of characters) {
    out.push(`  - name: ${quote(c.name)}`);
    out.push(`    voice: ${voiceSlug(c.voice)}`);
    if (c.color) out.push(`    color: ${quote(c.color)}`);
    out.push(`    is_you: ${!!c.isYou}`);
    out.push(`    speed: ${Number(c.speed ?? 1).toFixed(1)}`);
  }
  out.push(FENCE, '');

  let lastType = null;
  for (const line of lines) {
    if (line.type === 'scene') {
      out.push('', `## ${line.text}`, '');
    } else if (line.type === 'stage') {
      if (lastType === 'dialogue') out.push('');
      out.push(`[stage] ${line.text}`);
      out.push('');
    } else {
      out.push(`[${line.speakers?.length ? joinSpeakers(line.speakers) : line.speaker}] ${line.text}`);
    }
    lastType = line.type;
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/* ------------------------------------------------------------------- read */

/** Cheap enough to run on every upload, so nobody has to say which kind it is. */
export function looksLikeCueFile(text) {
  const head = text.slice(0, 400);
  return head.startsWith(FENCE) && /\btitle:/.test(head) && /\bcharacters:/.test(head);
}

export function parse(text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const end = normalized.indexOf(`\n${FENCE}`, FENCE.length);
  if (!normalized.startsWith(FENCE) || end < 0) {
    throw new Error("That doesn't look like a Cue file — the header is missing.");
  }

  const head = normalized.slice(FENCE.length, end);
  const body = normalized.slice(end + FENCE.length + 1);
  const meta = parseFrontMatter(head);

  const characters = (meta.characters ?? []).map((c) => ({
    name: String(c.name ?? '').trim(),
    voice: voiceFromSlug(c.voice) ?? NARRATOR_VOICE,
    color: c.color || null,
    isYou: c.is_you === true,
    speed: clamp(Number(c.speed) || 1, 0.5, 2),
  })).filter((c) => c.name);

  const known = new Set(characters.map((c) => c.name));
  return {
    title: meta.title || 'Untitled script',
    settings: {
      lineDelayMs: clamp(Number(meta.settings?.line_delay_ms) || 600, 0, 3000),
      readStageDirections: meta.settings?.read_stage_directions !== false,
    },
    characters,
    lines: parseBody(body, known),
  };
}

function parseBody(body, known = new Set()) {
  const lines = [];
  for (const raw of body.split('\n')) {
    const text = raw.trim();
    if (!text) continue;

    if (text.startsWith('##')) {
      lines.push({ id: lines.length, type: 'scene', speaker: null, text: text.replace(/^#+\s*/, '') });
      continue;
    }
    const match = /^\[([^\]]+)\]\s*(.*)$/.exec(text);
    if (!match) {
      // A hand-edited file may have a bare line; treat it as narration rather
      // than dropping something a person deliberately typed.
      lines.push({ id: lines.length, type: 'stage', speaker: null, text });
      continue;
    }
    const [, tag, content] = match;
    if (tag.toLowerCase() === 'stage') {
      lines.push({ id: lines.length, type: 'stage', speaker: null, text: content.trim() });
    } else {
      // "[TED, PRENTISS]" is two people, and it has to come back as two — the
      // cast in the front matter is what settles it.
      const speakers = splitSpeakers(tag.trim(), known);
      lines.push({
        id: lines.length,
        type: 'dialogue',
        speaker: joinSpeakers(speakers),
        speakers,
        text: content.trim(),
      });
    }
  }
  return lines;
}

/* ------------------------------------------------------------------- yaml */

/**
 * The front matter has one fixed shape, so it gets a parser that understands
 * exactly that shape. Pulling in a full YAML library to read six keys would
 * cost more than it's worth — and this way a hand-edited file fails with a
 * sentence a person can act on.
 */
function parseFrontMatter(head) {
  const meta = { settings: {}, characters: [] };
  let section = null;
  let character = null;

  for (const raw of head.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = stripComment(raw.trim());
    if (!line) continue;

    if (indent === 0) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (key === 'settings') section = 'settings';
      else if (key === 'characters') section = 'characters';
      else {
        section = null;
        meta[key.trim()] = unquote(value);
      }
      continue;
    }

    if (section === 'settings') {
      const [key, ...rest] = line.split(':');
      meta.settings[key.trim()] = coerce(rest.join(':').trim());
      continue;
    }

    if (section === 'characters') {
      if (line.startsWith('- ')) {
        character = {};
        meta.characters.push(character);
      }
      if (!character) continue;
      const [key, ...rest] = line.replace(/^- /, '').split(':');
      character[key.trim()] = coerce(rest.join(':').trim());
    }
  }
  return meta;
}

function stripComment(line) {
  // Only strip a comment that isn't inside quotes — colours start with '#'.
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    if (c === '#' && !inQuote && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trim();
  }
  return line;
}

function coerce(value) {
  const v = unquote(value);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function unquote(value) {
  const v = String(value ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/* ------------------------------------------------------------- file names */

export function suggestedFilename(title) {
  const slug = String(title || 'script')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${slug || 'script'}${FILE_EXTENSION}`;
}
