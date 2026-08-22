import test from 'node:test';
import assert from 'node:assert/strict';
import { speakable, splitForSynthesis, CHUNK_CHARS } from '../src/lib/speech-text.js';

test('bracketed markup never gets read aloud', () => {
  assert.equal(speakable('[stage] He turns away.'), 'He turns away.');
  assert.equal(speakable('To be --- or not to be'), 'To be — or not to be');
});

test('a short line is one chunk', () => {
  const line = 'No, not I; I never gave you aught.';
  assert.deepEqual(splitForSynthesis(line), [line]);
});

test('a monologue is split at sentence boundaries, not mid-thought', () => {
  const sentence = 'The lady doth protest too much, methinks, and I have said so plainly. ';
  const speech = sentence.repeat(8).trim();
  const chunks = splitForSynthesis(speech);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= CHUNK_CHARS + 40, chunk.length);
  for (const chunk of chunks) assert.match(chunk, /[.!?]$/);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), speech.replace(/\s+/g, ' '));
});

test('one impossibly long sentence falls back to breaking at commas', () => {
  const speech = `${'and then she said, '.repeat(40)}finally.`;
  const chunks = splitForSynthesis(speech);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), speech.replace(/\s+/g, ' ').trim());
});
