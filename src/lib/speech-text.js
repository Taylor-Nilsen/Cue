/** The model has a token ceiling; a monologue has to be fed to it in pieces. */
export const CHUNK_CHARS = 280;

/** Strip what shouldn't be read aloud, and tidy what would be misread. */
export function speakable(text) {
  return String(text ?? '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[_*]/g, '')
    .replace(/--+/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Break a long speech at sentence boundaries so it can be synthesized in
 * pieces and stitched back together. Without this a monologue comes back
 * truncated mid-thought.
 */
export function splitForSynthesis(text) {
  if (text.length <= CHUNK_CHARS) return [text];
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks = [];
  let buf = '';

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = '';
  };

  for (const sentence of sentences) {
    if (buf && buf.length + sentence.length > CHUNK_CHARS) flush();
    if (sentence.length > CHUNK_CHARS) {
      // One sentence longer than the ceiling: break it at a comma instead.
      for (const piece of sentence.split(/(?<=,)\s+/)) {
        if (buf && buf.length + piece.length > CHUNK_CHARS) flush();
        buf += `${piece} `;
      }
      continue;
    }
    buf += sentence;
  }
  flush();
  return chunks.filter(Boolean);
}
