import test from 'node:test';
import assert from 'node:assert/strict';
import { isSpoken, isYours, voiceFor, nextIndex, sceneAt, positionOf } from '../src/lib/reader.js';
import { NARRATOR_VOICE, MALE_VOICES } from '../src/lib/voices.js';

const lines = [
  { id: 0, type: 'scene', text: 'ACT I, SCENE II' },
  { id: 1, type: 'stage', text: 'A room of state.' },
  { id: 2, type: 'dialogue', speaker: 'HAMLET', text: 'O, that this too too solid flesh…' },
  { id: 3, type: 'dialogue', speaker: 'OPHELIA', text: 'My lord.' },
  { id: 4, type: 'scene', text: 'ACT I, SCENE III' },
  { id: 5, type: 'dialogue', speaker: 'HAMLET', text: 'Ay, madam.' },
];
const characters = [
  { name: 'HAMLET', voice: MALE_VOICES[0].id, speed: 1.2, isYou: true },
  { name: 'OPHELIA', voice: 'af_heart', speed: 1, isYou: false },
];
const on = { readStageDirections: true };
const off = { readStageDirections: false };

test('a scene heading is a signpost, never a spoken line', () => {
  assert.equal(isSpoken(lines[0], on), false);
  assert.equal(isSpoken(lines[0], off), false);
});

test('stage direction follows the setting', () => {
  assert.equal(isSpoken(lines[1], on), true);
  assert.equal(isSpoken(lines[1], off), false);
});

test('your lines are the ones Cue waits on', () => {
  assert.equal(isYours(lines[2], characters), true);
  assert.equal(isYours(lines[3], characters), false);
  assert.equal(isYours(lines[1], characters), false, 'stage direction is nobody’s line');
});

test('stage direction always gets the narrator, never a character voice', () => {
  const cast = new Map(characters.map((c) => [c.name, c]));
  assert.deepEqual(voiceFor(lines[1], cast), { voice: NARRATOR_VOICE, speed: 1 });
  assert.deepEqual(voiceFor(lines[2], cast), { voice: MALE_VOICES[0].id, speed: 1.2 });
});

test('an unknown speaker falls back rather than throwing mid-scene', () => {
  const cast = new Map();
  assert.equal(voiceFor(lines[2], cast).voice, NARRATOR_VOICE);
});

test('stepping forward walks over headings but stops on real lines', () => {
  assert.equal(nextIndex(lines, 0, on), 1);
  assert.equal(nextIndex(lines, 3, on), 5, 'ACT I, SCENE III is stepped over');
});

test('stepping forward skips stage direction when it is turned off', () => {
  assert.equal(nextIndex(lines, 0, off), 2);
});

test('stepping back works the same way', () => {
  assert.equal(nextIndex(lines, 5, on, -1), 3);
  assert.equal(nextIndex(lines, 2, off, -1), -1);
});

test('running off the end is a position, not a crash', () => {
  assert.equal(nextIndex(lines, 5, on), lines.length);
});

test('the header knows which scene we are inside', () => {
  assert.equal(sceneAt(lines, 2), 'ACT I, SCENE II');
  assert.equal(sceneAt(lines, 5), 'ACT I, SCENE III');
  assert.equal(sceneAt([{ type: 'dialogue', speaker: 'X', text: 'hi' }], 0), '');
});

test('progress counts spoken lines only', () => {
  assert.equal(positionOf(lines, 5, on), 1);
  assert.equal(positionOf(lines, 1, on), 0.25);
  assert.equal(positionOf(lines, 2, off), 1 / 3);
});
