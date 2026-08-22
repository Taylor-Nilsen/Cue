import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../src/lib/parse.js';
import { guessGender } from '../src/lib/names.js';

const W = 612;
const H = 792;

function line(text, x0, y, x1) {
  return {
    text,
    x0,
    x1: x1 ?? Math.min(520, x0 + text.length * 6.2),
    y,
    h: 12,
    words: text.split(' ').map((t) => ({ text: t, conf: 95 })),
  };
}

/** A play laid out the way a photocopied rehearsal script actually is. */
function fixture() {
  let y = 60;
  const n = () => (y += 22);
  const front = {
    number: 1,
    pageWidth: W,
    pageHeight: H,
    lines: [line('HAMLET', 250, n()), line('a tragedy in five acts', 220, n()), line('DRAMATIS PERSONAE', 210, n())],
  };
  y = 60;
  const body = {
    number: 2,
    pageWidth: W,
    pageHeight: H,
    lines: [
      line('Hamlet  •  2', 480, 30),
      line('ACT I, SCENE II', 230, n()),
      line('(A room of state in the castle.)', 150, n()),
      line('HAMLET', 250, n()),
      line('O, that this too too solid flesh would melt,', 90, n()),
      line('Thaw, and resolve itself into a dew!', 90, n()),
      line('OPHELIA', 250, n()),
      line('My lord, I have remembrances of yours', 90, n()),
      line('that I have longed long to re-deliver; I pray you, now receive them.', 90, n(), 530),
      line('They are as sweet as they once were.', 90, n()),
      line('HAMLET', 250, n()),
      line('No, not I; I never gave you aught.', 90, n()),
      line('Enter CLAUDIUS.', 200, n()),
      line('KING CLAUDIUS. How is it that the clouds still hang on you?', 90, n(), 540),
      line('Hamlet  •  3', 480, 770),
    ],
  };
  y = 60;
  const tail = {
    number: 3,
    pageWidth: W,
    pageHeight: H,
    lines: [
      line('Hamlet  •  3', 480, 30),
      line('GERTRUDE', 250, n()),
      line('Good Hamlet, cast thy nighted colour off.', 90, n()),
      line('Hamlet  •  4', 480, 770),
    ],
  };
  return [front, body, tail];
}

test('front matter is set aside', () => {
  const { lines } = parseScript(fixture());
  assert.equal(lines[0].type, 'scene');
  assert.equal(lines[0].text, 'ACT I, SCENE II');
  assert.ok(!lines.some((l) => l.text.includes('DRAMATIS PERSONAE')));
});

test('running heads and page numbers are stripped everywhere', () => {
  const { lines } = parseScript(fixture());
  assert.ok(!lines.some((l) => /Hamlet\s+•/.test(l.text)));
});

test('stage direction is recognised without any font styling to lean on', () => {
  const { lines } = parseScript(fixture());
  const stage = lines.filter((l) => l.type === 'stage').map((l) => l.text);
  assert.deepEqual(stage, ['A room of state in the castle.', 'Enter CLAUDIUS.']);
});

test('verse lines stay separate but wrapped prose is rejoined', () => {
  const { lines } = parseScript(fixture());
  const hamlet = lines.filter((l) => l.speaker === 'HAMLET').map((l) => l.text);
  assert.equal(hamlet.length, 3, 'two verse lines plus one later line, not merged');

  const ophelia = lines.filter((l) => l.speaker === 'OPHELIA');
  assert.equal(ophelia.length, 2);
  assert.match(ophelia[1].text, /re-deliver.*sweet as they once were/);
});

test('an inline cue splits into speaker and line', () => {
  const { lines, characters } = parseScript(fixture());
  const claudius = lines.find((l) => l.speaker === 'KING CLAUDIUS');
  assert.equal(claudius.text, 'How is it that the clouds still hang on you?');
  assert.ok(characters.some((c) => c.name === 'KING CLAUDIUS'));
});

test('characters come back in first-appearance order', () => {
  const { characters } = parseScript(fixture());
  assert.deepEqual(
    characters.map((c) => c.name),
    ['HAMLET', 'OPHELIA', 'KING CLAUDIUS', 'GERTRUDE'],
  );
});

test('nothing from one page fuses onto the next', () => {
  const { lines } = parseScript(fixture());
  for (const l of lines) assert.ok(!/Hamlet\s+•/.test(l.text));
});

test('gender guessing knows when to give up', () => {
  assert.equal(guessGender('OPHELIA'), 'female');
  assert.equal(guessGender('KING CLAUDIUS'), 'male');
  assert.equal(guessGender('MRS. PEACOCK'), 'female');
  assert.equal(guessGender('Hamlet (O.S.)'), 'male');
  assert.equal(guessGender('1ST GUARD'), 'unknown');
});
