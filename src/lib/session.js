import { writable, derived, get } from 'svelte/store';
import { autoCast } from './voices.js';
import { guessGender } from './names.js';

/**
 * Everything about the rehearsal in front of you: the script, the cast, and
 * the settings. One store, because Cue is one linear thing.
 */

export const DEFAULT_SETTINGS = {
  lineDelayMs: 600,
  readStageDirections: true,
};

/** Colours offered for "this line is yours". Chosen to stay legible on both papers. */
export const YOU_COLORS = ['#E85D8C', '#2AA9C7', '#379E71', '#F5A623', '#8B6BE8', '#FF6F59'];

const EMPTY = {
  title: '',
  lines: [],
  characters: [],
  settings: { ...DEFAULT_SETTINGS },
  source: null, // 'pdf' | 'cue'
  scanned: false,
};

export const session = writable({ ...EMPTY });

export const cast = derived(session, ($s) => new Map($s.characters.map((c) => [c.name, c])));

export const youCharacters = derived(session, ($s) => $s.characters.filter((c) => c.isYou));

/** Characters whose gender we couldn't call — the app asks rather than guessing. */
export const unresolvedGender = derived(session, ($s) =>
  $s.characters.filter((c) => c.gender === 'unknown'),
);

export function resetSession() {
  session.set({ ...EMPTY, settings: { ...DEFAULT_SETTINGS } });
}

/**
 * Take a freshly parsed PDF and cast it. Everyone gets a voice immediately —
 * casting is something you adjust, never something you have to do from
 * scratch before you can hear anything.
 */
export function startFromScript({ title, lines, characters }, { scanned = false } = {}) {
  const withGender = characters.map((c) => ({ ...c, gender: guessGender(c.name) }));
  // An unknown gender still needs *a* voice so the screen isn't half-empty
  // while you answer; men's voices are the arbitrary default, and the moment
  // you say otherwise it recasts.
  const voices = autoCast(withGender);

  session.set({
    title,
    lines,
    scanned,
    source: 'pdf',
    settings: { ...DEFAULT_SETTINGS },
    characters: withGender.map((c, i) => ({
      name: c.name,
      lineCount: c.lineCount ?? 0,
      gender: c.gender,
      voice: voices[c.name],
      color: YOU_COLORS[i % YOU_COLORS.length],
      isYou: false,
      speed: 1,
    })),
  });
}

/** Reopen a saved rehearsal — nothing to redo, straight to the reading screen. */
export function startFromCueFile(parsed) {
  session.set({
    title: parsed.title,
    lines: parsed.lines,
    scanned: false,
    source: 'cue',
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    characters: parsed.characters.map((c, i) => ({
      name: c.name,
      lineCount: parsed.lines.filter((l) => l.speaker === c.name).length,
      gender: guessGender(c.name),
      voice: c.voice,
      color: c.color || YOU_COLORS[i % YOU_COLORS.length],
      isYou: c.isYou,
      speed: c.speed ?? 1,
    })),
  });
}

/* ---------------------------------------------------------------- editing */

export function updateCharacter(name, patch) {
  session.update((s) => ({
    ...s,
    characters: s.characters.map((c) => (c.name === name ? { ...c, ...patch } : c)),
  }));
}

/** Recast everyone from scratch — used after a gender answer changes the pools. */
export function recast() {
  session.update((s) => {
    const voices = autoCast(s.characters);
    return { ...s, characters: s.characters.map((c) => ({ ...c, voice: voices[c.name] })) };
  });
}

export function updateSettings(patch) {
  session.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function updateLine(id, patch) {
  session.update((s) => ({
    ...s,
    lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }));
}

/**
 * Break one line into two at the caret. OCR mashes a cue and its dialogue
 * together often enough that this needs to be one tap, not a re-upload.
 */
export function splitLine(id, at) {
  session.update((s) => {
    const index = s.lines.findIndex((l) => l.id === id);
    if (index < 0) return s;
    const line = s.lines[index];
    const head = line.text.slice(0, at).trim();
    const tail = line.text.slice(at).trim();
    if (!head || !tail) return s;

    const lines = [...s.lines];
    lines.splice(index, 1,
      { ...line, text: head, shaky: [] },
      { ...line, id: nextId(s.lines), text: tail, shaky: [] },
    );
    return { ...s, lines };
  });
}

function nextId(lines) {
  return lines.reduce((max, l) => Math.max(max, l.id ?? 0), 0) + 1;
}

export function deleteLine(id) {
  session.update((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id) }));
}

/**
 * Fold one character into another — "HAMLET" and "Hamlet (O.S.)" are one
 * person, and they should share a voice, a colour, and a turn to speak.
 */
export function mergeCharacters(fromName, intoName) {
  if (fromName === intoName) return;
  session.update((s) => ({
    ...s,
    lines: s.lines.map((l) => (l.speaker === fromName ? { ...l, speaker: intoName } : l)),
    characters: s.characters
      .filter((c) => c.name !== fromName)
      .map((c) =>
        c.name === intoName
          ? {
              ...c,
              lineCount:
                c.lineCount + (s.characters.find((x) => x.name === fromName)?.lineCount ?? 0),
            }
          : c,
      ),
  }));
}

/** Rename a character everywhere at once, cues and cast list together. */
export function renameCharacter(fromName, toName) {
  const clean = toName.trim();
  if (!clean || clean === fromName) return;
  const existing = get(session).characters.find((c) => c.name === clean);
  if (existing) return mergeCharacters(fromName, clean);

  session.update((s) => ({
    ...s,
    lines: s.lines.map((l) => (l.speaker === fromName ? { ...l, speaker: clean } : l)),
    characters: s.characters.map((c) =>
      c.name === fromName ? { ...c, name: clean, gender: guessGender(clean) } : c,
    ),
  }));
}

/* ----------------------------------------------------------------- counts */

export function scriptStats(s) {
  const spoken = s.lines.filter((l) => l.type === 'dialogue').length;
  const yours = s.lines.filter(
    (l) => l.type === 'dialogue' && s.characters.some((c) => c.isYou && c.name === l.speaker),
  ).length;
  const shaky = s.lines.reduce((n, l) => n + (l.shaky?.length ?? 0), 0);
  return { spoken, yours, shaky, scenes: s.lines.filter((l) => l.type === 'scene').length };
}
