/**
 * Which lines actually get spoken, and by whom.
 *
 * Pulled out of the component so the rules are testable on their own — the
 * reading loop is the one place a wrong answer wastes somebody's rehearsal.
 */
import { NARRATOR_VOICE } from './voices.js';
import { speakersOf } from './speakers.js';

/** Scene headings are signposts on the page, not something anyone says. */
export function isSpoken(line, settings) {
  if (line.type === 'scene') return false;
  if (line.type === 'stage') return settings.readStageDirections !== false;
  return true;
}

export function isYours(line, characters) {
  if (line.type !== 'dialogue') return false;
  // A line cued to you and two others is still your line to say.
  const speakers = speakersOf(line);
  return characters.some((c) => c.isYou && speakers.includes(c.name));
}

/** Which of your characters is up, when a line names several. */
export function yoursIn(line, characters) {
  const speakers = speakersOf(line);
  return characters.filter((c) => c.isYou && speakers.includes(c.name));
}

export function voiceFor(line, cast) {
  if (line.type !== 'dialogue') return { voice: NARRATOR_VOICE, speed: 1 };
  // Several voices at once would be noise, so a joint line is spoken by the
  // first character named — the tag still shows everyone it belongs to.
  const character = speakersOf(line).map((n) => cast.get(n)).find(Boolean);
  return { voice: character?.voice ?? NARRATOR_VOICE, speed: character?.speed ?? 1 };
}

/**
 * The next line the reader should land on. Scene headings are stepped over
 * when moving, but stay visible — you want to see "ACT II" go by, not stop on
 * it and press Go.
 */
export function nextIndex(lines, from, settings, direction = 1) {
  let i = from + direction;
  while (i >= 0 && i < lines.length) {
    if (isSpoken(lines[i], settings)) return i;
    i += direction;
  }
  return direction > 0 ? lines.length : -1;
}

/** The scene we're currently inside, for the header. */
export function sceneAt(lines, index) {
  for (let i = Math.min(index, lines.length - 1); i >= 0; i--) {
    if (lines[i]?.type === 'scene') return lines[i].text;
  }
  return '';
}

/** How far through the spoken part of the script we are, 0–1. */
export function positionOf(lines, index, settings) {
  const spoken = lines.filter((l) => isSpoken(l, settings));
  if (!spoken.length) return 0;
  const done = lines.slice(0, index + 1).filter((l) => isSpoken(l, settings)).length;
  return Math.min(1, done / spoken.length);
}
