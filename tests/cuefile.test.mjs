import test from 'node:test';
import assert from 'node:assert/strict';
import { serialize, parse, looksLikeCueFile, suggestedFilename } from '../src/lib/cuefile.js';
import { FEMALE_VOICES, MALE_VOICES, NARRATOR_VOICE } from '../src/lib/voices.js';

const session = {
  title: 'Hamlet',
  settings: { lineDelayMs: 600, readStageDirections: true },
  characters: [
    { name: 'HAMLET', voice: MALE_VOICES[0].id, color: '#E85D8C', isYou: true, speed: 1 },
    { name: 'OPHELIA', voice: FEMALE_VOICES[0].id, color: null, isYou: false, speed: 1.1 },
  ],
  lines: [
    { type: 'scene', speaker: null, text: 'ACT I, SCENE II' },
    { type: 'stage', speaker: null, text: 'A room of state in the castle.' },
    { type: 'dialogue', speaker: 'HAMLET', text: 'O, that this too too solid flesh would melt,' },
    { type: 'dialogue', speaker: 'HAMLET', text: 'Thaw, and resolve itself into a dew!' },
    { type: 'stage', speaker: null, text: '(Enter OPHELIA.)' },
    { type: 'dialogue', speaker: 'OPHELIA', text: 'My lord, I have remembrances of yours.' },
  ],
};

test('the file it writes is the file the spec describes', () => {
  const text = serialize(session);
  assert.match(text, /^---\ntitle: "Hamlet"/);
  assert.match(text, /line_delay_ms: 600/);
  assert.match(text, /voice: male_1/);
  assert.match(text, /voice: female_1/);
  assert.match(text, /## ACT I, SCENE II/);
  assert.match(text, /\[stage\] A room of state in the castle\./);
  assert.match(text, /\[HAMLET\] O, that this too too solid flesh would melt,/);
});

test('a saved session round-trips unchanged', () => {
  const back = parse(serialize(session));
  assert.equal(back.title, 'Hamlet');
  assert.deepEqual(back.settings, { lineDelayMs: 600, readStageDirections: true });
  assert.equal(back.characters[0].voice, MALE_VOICES[0].id);
  assert.equal(back.characters[0].isYou, true);
  assert.equal(back.characters[0].color, '#E85D8C');
  assert.equal(back.characters[1].speed, 1.1);
  assert.deepEqual(
    back.lines.map((l) => [l.type, l.speaker, l.text]),
    session.lines.map((l) => [l.type, l.speaker, l.text]),
  );
});

test("a colour is not mistaken for a comment", () => {
  const back = parse(serialize(session));
  assert.equal(back.characters[0].color, '#E85D8C');
});

test('a trailing comment on a setting is ignored', () => {
  const back = parse(serialize(session));
  assert.equal(back.settings.lineDelayMs, 600);
});

test('an upload identifies itself without being asked', () => {
  assert.ok(looksLikeCueFile(serialize(session)));
  assert.ok(!looksLikeCueFile('%PDF-1.7\n%âãÏÓ'));
  assert.ok(!looksLikeCueFile('# Just some notes\n\nnothing to see'));
});

test('a hand-edited file still opens', () => {
  const text = [
    '---',
    'title: my scene',
    'settings:',
    '  line_delay_ms: 250',
    '  read_stage_directions: false',
    'characters:',
    '  - name: ROMEO',
    '    voice: male_3',
    '    is_you: true',
    '---',
    '',
    '## SCENE I',
    '[ROMEO] But soft, what light through yonder window breaks?',
    'she turns away',
  ].join('\n');

  const back = parse(text);
  assert.equal(back.title, 'my scene');
  assert.equal(back.settings.readStageDirections, false);
  assert.equal(back.settings.lineDelayMs, 250);
  assert.equal(back.characters[0].voice, MALE_VOICES[2].id);
  assert.equal(back.characters[0].speed, 1, 'a missing speed defaults to normal');
  assert.equal(back.lines.at(-1).type, 'stage', 'a bare line is kept as narration, not dropped');
});

test('an unknown voice slug falls back to the narrator rather than exploding', () => {
  const text = serialize({ ...session, characters: [{ name: 'GHOST', voice: 'nonsense_9', isYou: false, speed: 1 }] });
  assert.equal(parse(text).characters[0].voice, NARRATOR_VOICE);
});

test('a file with no header fails with something a person can act on', () => {
  assert.throws(() => parse('just a text file'), /Cue file/);
});

test('the download gets a sensible name', () => {
  assert.equal(suggestedFilename('A Midsummer Night’s Dream'), 'a-midsummer-night-s-dream.cue.md');
  assert.equal(suggestedFilename(''), 'script.cue.md');
});
