/**
 * Lines spoken by more than one character.
 *
 * Scripts cue two or three people onto the same line all the time — "TED,
 * PRENTISS", "PRENTISS & TED", "PETER, PRENTISS, TED". Treated as a single
 * oddly-named character, each combination gets its own voice, none of them
 * count as you, and the reader sails past a line you were supposed to say.
 */

const JOINERS = /\s*(?:,|&|\+|\band\b)\s*/i;

/**
 * Split a cue into the characters it names — but only when every part is
 * somebody we've actually met. "ALL (except MOLLY)" is one cue, not two, and
 * a name that merely contains a comma shouldn't be torn in half.
 *
 * @param {string} cue
 * @param {Set<string>|Map<string, unknown>} known
 * @returns {string[]}
 */
export function splitSpeakers(cue, known) {
  const name = String(cue ?? '').trim();
  if (!name) return [];

  const has = (n) => (known instanceof Map ? known.has(n) : known?.has?.(n));
  if (has(name)) return [name]; // a real character called exactly this
  if (/[()[\]]/.test(name)) return [name]; // "ALL (except MOLLY)" is its own cue

  const parts = name.split(JOINERS).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [name];
  if (!parts.every(has)) return [name];
  // Guard against a name that is genuinely just repetition.
  return [...new Set(parts)];
}

/** How a line's speakers read on screen and in a saved file. */
export function joinSpeakers(speakers) {
  return speakers.join(', ');
}

/** Everyone this line belongs to, whether it names one person or three. */
export function speakersOf(line) {
  if (line?.speakers?.length) return line.speakers;
  return line?.speaker ? [line.speaker] : [];
}
