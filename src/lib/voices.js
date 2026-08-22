// The voice roster. Every character voice is one of the Kokoro neural voices
// that ship with the app — the stage-direction narrator is deliberately kept
// out of the character pools so it never collides with a cast member.

export const NARRATOR_VOICE = 'af_aoede';

export const FEMALE_VOICES = [
  { id: 'af_heart', label: 'Female Voice 1', note: 'warm, grounded' },
  { id: 'af_bella', label: 'Female Voice 2', note: 'bright, playful' },
  { id: 'bf_emma', label: 'Female Voice 3', note: 'British, steady' },
  { id: 'af_nicole', label: 'Female Voice 4', note: 'soft, close-mic' },
  { id: 'af_sarah', label: 'Female Voice 5', note: 'clear, even' },
  { id: 'af_kore', label: 'Female Voice 6', note: 'cool, precise' },
  { id: 'bf_isabella', label: 'Female Voice 7', note: 'British, poised' },
  { id: 'af_nova', label: 'Female Voice 8', note: 'youthful' },
  { id: 'af_sky', label: 'Female Voice 9', note: 'light, airy' },
  { id: 'bf_alice', label: 'Female Voice 10', note: 'British, crisp' },
  { id: 'af_jessica', label: 'Female Voice 11', note: 'conversational' },
  { id: 'bf_lily', label: 'Female Voice 12', note: 'British, gentle' },
  { id: 'af_river', label: 'Female Voice 13', note: 'low, calm' },
  { id: 'af_alloy', label: 'Female Voice 14', note: 'neutral' },
];

export const MALE_VOICES = [
  { id: 'am_michael', label: 'Male Voice 1', note: 'warm, easy' },
  { id: 'am_fenrir', label: 'Male Voice 2', note: 'deep, weighty' },
  { id: 'bm_george', label: 'Male Voice 3', note: 'British, classical' },
  { id: 'am_puck', label: 'Male Voice 4', note: 'quick, mischievous' },
  { id: 'am_adam', label: 'Male Voice 5', note: 'plain, direct' },
  { id: 'am_eric', label: 'Male Voice 6', note: 'bright, young' },
  { id: 'bm_lewis', label: 'Male Voice 7', note: 'British, gruff' },
  { id: 'am_liam', label: 'Male Voice 8', note: 'easy, mid' },
  { id: 'am_onyx', label: 'Male Voice 9', note: 'rich, low' },
  { id: 'bm_daniel', label: 'Male Voice 10', note: 'British, dry' },
  { id: 'bm_fable', label: 'Male Voice 11', note: 'British, storyteller' },
  { id: 'am_echo', label: 'Male Voice 12', note: 'measured' },
  { id: 'am_santa', label: 'Male Voice 13', note: 'older, jolly' },
];

export const ALL_VOICES = [
  ...FEMALE_VOICES,
  ...MALE_VOICES,
  { id: NARRATOR_VOICE, label: 'Narrator Voice', note: 'even, unobtrusive' },
];

const BY_ID = new Map(ALL_VOICES.map((v) => [v.id, v]));

export function voiceLabel(id) {
  return BY_ID.get(id)?.label ?? id;
}
export function voiceNote(id) {
  return BY_ID.get(id)?.note ?? '';
}
export function voiceGender(id) {
  if (id === NARRATOR_VOICE) return 'narrator';
  return FEMALE_VOICES.some((v) => v.id === id) ? 'female' : 'male';
}

/**
 * Saved files refer to voices by a friendly slug — female_1, male_2, narrator —
 * rather than by the model's own ids. The slug is what someone sees if they
 * open a .cue.md in a text editor, and it survives us swapping the underlying
 * voice model later.
 */
export function voiceSlug(id) {
  if (id === NARRATOR_VOICE) return 'narrator';
  const f = FEMALE_VOICES.findIndex((v) => v.id === id);
  if (f >= 0) return `female_${f + 1}`;
  const m = MALE_VOICES.findIndex((v) => v.id === id);
  if (m >= 0) return `male_${m + 1}`;
  return id;
}

export function voiceFromSlug(slug) {
  if (!slug) return null;
  if (slug === 'narrator') return NARRATOR_VOICE;
  const match = /^(female|male)_(\d+)$/.exec(String(slug).trim());
  if (match) {
    const pool = match[1] === 'female' ? FEMALE_VOICES : MALE_VOICES;
    return pool[(Number(match[2]) - 1) % pool.length]?.id ?? pool[0].id;
  }
  // Someone may have hand-edited in a raw model id; honour it if we know it.
  return BY_ID.has(slug) ? slug : null;
}

/**
 * Hand out voices in first-appearance order: women get the women's voices in
 * order, men get the men's the same way. Pools wrap around rather than running
 * out, so a 30-character crowd scene still casts.
 */
export function autoCast(characters) {
  let f = 0;
  let m = 0;
  const out = {};
  for (const c of characters) {
    const pool = c.gender === 'female' ? FEMALE_VOICES : MALE_VOICES;
    const i = c.gender === 'female' ? f++ : m++;
    out[c.name] = pool[i % pool.length].id;
  }
  return out;
}
