import { speakable } from './speech-text.js';

/**
 * Which line to play when you press ▶ next to a voice.
 *
 * It plays one of *their* lines, not a generic sample, because "does this
 * sound like my Ophelia" is a different question from "is this voice nice".
 *
 * Their first line longer than five words; trimmed to ten with an ellipsis if
 * it runs long. If everything they say is five words or shorter, their single
 * longest line instead, trimmed the same way.
 */
export function sampleLine(name, lines) {
  const spoken = lines
    .filter((l) => l.type === 'dialogue' && l.speaker === name)
    .map((l) => speakable(l.text))
    .filter(Boolean);
  if (!spoken.length) return '';

  const pick =
    spoken.find((text) => wordCount(text) > 5) ??
    spoken.reduce((best, text) => (wordCount(text) > wordCount(best) ? text : best), spoken[0]);

  return trimToWords(pick, 10);
}

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

export function trimToWords(text, limit) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return `${words.slice(0, limit).join(' ').replace(/[,;:]$/, '')}…`;
}
