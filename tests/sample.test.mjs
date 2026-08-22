import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleLine } from '../src/lib/sample.js';

const d = (speaker, text) => ({ type: 'dialogue', speaker, text });

test('plays their first line that is actually worth hearing', () => {
  const lines = [
    d('HAMLET', 'Ay, madam.'),
    d('HAMLET', 'O, that this too too solid flesh would melt.'),
  ];
  assert.equal(sampleLine('HAMLET', lines), 'O, that this too too solid flesh would melt.');
});

test('a long line is trimmed to ten words with an ellipsis', () => {
  const lines = [d('HAMLET', 'To be, or not to be, that is the question, whether tis nobler')];
  assert.equal(sampleLine('HAMLET', lines), 'To be, or not to be, that is the question…');
});

test('when every line is short, the longest one stands in', () => {
  const lines = [d('GUARD', 'My lord.'), d('GUARD', 'Aye, sir, at once.'), d('GUARD', 'Here.')];
  assert.equal(sampleLine('GUARD', lines), 'Aye, sir, at once.');
});

test('stage direction is never mistaken for a line of theirs', () => {
  const lines = [
    { type: 'stage', speaker: null, text: 'HAMLET crosses to the window and waits a while.' },
    d('HAMLET', 'Ay, madam, it is common.'),
  ];
  assert.equal(sampleLine('HAMLET', lines), 'Ay, madam, it is common.');
});

test('a character with nothing to say gets no sample rather than a crash', () => {
  assert.equal(sampleLine('GHOST', [d('HAMLET', 'Angels and ministers of grace defend us!')]), '');
});
