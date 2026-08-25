import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSpeakers, speakersOf } from '../src/lib/speakers.js';
import { isYours, yoursIn, voiceFor } from '../src/lib/reader.js';
import { serialize, parse } from '../src/lib/cuefile.js';
import { MALE_VOICES, FEMALE_VOICES, NARRATOR_VOICE } from '../src/lib/voices.js';

const cast = new Set(['TED', 'PRENTISS', 'BOY', 'MOLLY', 'ALL', 'MRS. BUMBRAKE']);

test('a cue naming several characters comes back as several', () => {
  assert.deepEqual(splitSpeakers('TED, PRENTISS', cast), ['TED', 'PRENTISS']);
  assert.deepEqual(splitSpeakers('PRENTISS & TED', cast), ['PRENTISS', 'TED']);
  assert.deepEqual(splitSpeakers('TED AND PRENTISS', cast), ['TED', 'PRENTISS']);
  assert.deepEqual(splitSpeakers('PETER, PRENTISS, TED', new Set([...cast, 'PETER'])), [
    'PETER', 'PRENTISS', 'TED',
  ]);
});

test('a cue that only looks like a list is left alone', () => {
  // Nobody in the cast is called "except MOLLY".
  assert.deepEqual(splitSpeakers('ALL (except MOLLY)', cast), ['ALL (except MOLLY)']);
  // A real character whose own name carries a comma stays whole.
  assert.deepEqual(splitSpeakers('MRS. BUMBRAKE', cast), ['MRS. BUMBRAKE']);
  // One unknown part means we don't understand the cue, so we don't guess.
  assert.deepEqual(splitSpeakers('NARRATORS SCOTT, SMEE', cast), ['NARRATORS SCOTT, SMEE']);
});

test('a joint line is your line if you are one of the names', () => {
  const characters = [
    { name: 'TED', isYou: true, voice: MALE_VOICES[0].id, speed: 1 },
    { name: 'PRENTISS', isYou: false, voice: MALE_VOICES[1].id, speed: 1.2 },
  ];
  const joint = { type: 'dialogue', speaker: 'PRENTISS, TED', speakers: ['PRENTISS', 'TED'], text: 'Like what?' };

  assert.equal(isYours(joint, characters), true);
  assert.deepEqual(yoursIn(joint, characters).map((c) => c.name), ['TED']);
});

test('a joint line is spoken by the first name, not all at once', () => {
  const cast2 = new Map([
    ['PRENTISS', { voice: MALE_VOICES[1].id, speed: 1.2 }],
    ['TED', { voice: MALE_VOICES[0].id, speed: 1 }],
  ]);
  const joint = { type: 'dialogue', speaker: 'PRENTISS, TED', speakers: ['PRENTISS', 'TED'], text: 'Like what?' };
  assert.deepEqual(voiceFor(joint, cast2), { voice: MALE_VOICES[1].id, speed: 1.2 });
});

test('an unknown name in a joint line still finds a voice', () => {
  const cast2 = new Map([['TED', { voice: MALE_VOICES[0].id, speed: 1 }]]);
  const joint = { type: 'dialogue', speaker: 'GHOST, TED', speakers: ['GHOST', 'TED'], text: 'Boo.' };
  assert.equal(voiceFor(joint, cast2).voice, MALE_VOICES[0].id);
  assert.notEqual(voiceFor(joint, cast2).voice, NARRATOR_VOICE);
});

test('a joint line survives being saved and reopened', () => {
  const session = {
    title: 'Peter',
    settings: { lineDelayMs: 600, readStageDirections: true },
    characters: [
      { name: 'TED', voice: MALE_VOICES[0].id, color: '#E85D8C', isYou: true, speed: 1 },
      { name: 'PRENTISS', voice: MALE_VOICES[1].id, color: null, isYou: false, speed: 1 },
      { name: 'MOLLY', voice: FEMALE_VOICES[0].id, color: null, isYou: false, speed: 1 },
    ],
    lines: [
      { type: 'dialogue', speaker: 'MOLLY', speakers: ['MOLLY'], text: 'Like what?' },
      { type: 'dialogue', speaker: 'TED, PRENTISS', speakers: ['TED', 'PRENTISS'], text: 'Like helping Molly.' },
    ],
  };

  const text = serialize(session);
  assert.match(text, /\[TED, PRENTISS\] Like helping Molly\./);

  const back = parse(text);
  assert.deepEqual(back.lines[1].speakers, ['TED', 'PRENTISS']);
  assert.equal(back.lines[1].speaker, 'TED, PRENTISS');
  assert.equal(isYours(back.lines[1], session.characters), true);
});

test('speakersOf copes with a line that only ever had one', () => {
  assert.deepEqual(speakersOf({ speaker: 'MOLLY' }), ['MOLLY']);
  assert.deepEqual(speakersOf({ type: 'stage', speaker: null }), []);
});
