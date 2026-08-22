import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../src/lib/parse.js';

/**
 * Every line in here is real OCR output from a 176-page scan of "Peter and
 * the Starcatcher" — a photocopy with a seam down the left margin, a running
 * head the scanner read differently on every page, and sung lyrics set in
 * capitals. Each block below is a bug that script actually caused.
 *
 * Page geometry matches the scan: 1347x1743, cues around x=650-720, dialogue
 * at x=329, stage direction at x=355.
 */

const W = 1347;
const H = 1743;

function line(text, x0, y, { x1, conf = 92, confs = null } = {}) {
  const words = text.split(' ').map((t, i) => ({ text: t, conf: confs?.[i] ?? conf }));
  return { text, x0, x1: x1 ?? Math.min(1180, x0 + text.length * 11), y, h: 26, words };
}

const cue = (name, y) => line(name, 690, y);
const speech = (text, y, opts) => line(text, 329, y, opts);
const direction = (text, y, opts) => line(text, 355, y, opts);

function pages(...specs) {
  return specs.map((lines, i) => ({ number: i + 1, pageWidth: W, pageHeight: H, lines }));
}

/** Enough pages of ordinary script that the running-head detector has a quorum. */
function filler(n, extra = []) {
  return [
    line(`PETER AND THE STARCATCHER ${'-'.repeat(n % 3)} ${n}`, 574, 45),
    line('SCENE ONE: The Neverland - On Deck', 374, 115),
    cue('SLANK', 226),
    speech(`Stow that trunk in my cabin, number ${n}.`, 261),
    ...extra,
  ];
}

test('a running head the scanner mangled differently on every page is still stripped', () => {
  const { characters, lines } = parseScript(
    pages(
      [line('PETER AND THE STARCATCHER -7 =', 574, 45), cue('SLANK', 226), speech('Stow that trunk.', 261)],
      [line('PETER AND THE STARCATCHER Ld', 573, 50), cue('MOLLY', 226), speech('Oh dear, not again.', 261)],
      [line('16 —- PFTFR AND THE STARCATCHER', 570, 48), cue('ALF', 226), speech('Been thinking about it.', 261)],
      [line('PETER AND THE STARCATCHER - 25 —', 575, 47), cue('TED', 226), speech('Why should we, though?', 261)],
    ),
  );

  assert.ok(
    !characters.some((c) => /STARCATCHER|PFTFR/i.test(c.name)),
    `the title got cast as a character: ${characters.map((c) => c.name).join(', ')}`,
  );
  assert.ok(!lines.some((l) => /PFTFR/i.test(l.text)), 'a mangled header leaked into the script');
});

test('"MRS. BUMBRAKE" is one character, not MRS saying the word BUMBRAKE', () => {
  const { characters, lines } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('MRS. BUMBRAKE', 649),
        speech("First Class ain't what it used to be.", 297),
        cue('MOLLY', 720),
        speech('Round is a shape.', 340),
      ]),
      filler(3),
    ),
  );

  assert.ok(characters.some((c) => c.name === 'MRS. BUMBRAKE'));
  assert.ok(!characters.some((c) => c.name === 'MRS'), 'the honorific was torn off into its own part');
  assert.ok(!lines.some((l) => l.text === 'BUMBRAKE'), 'a surname was left to be read aloud as dialogue');
});

test('sung lyrics in capitals do not join the cast list', () => {
  const { characters } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('SAILORS', 306),
        direction('(singing)', 343),
        speech("THE BOYS'LL BE SOLD,", 388),
        speech('OH, FOR THE WINGS,', 421),
        speech('FAR AWAY, FAR AWAY,', 456),
        // The verse ends and ordinary dialogue resumes; without this the last
        // lyric is followed by another lyric and the cue test bails early for
        // the wrong reason, which would make this test pass by accident.
        speech('And that was the end of the song.', 490),
      ]),
      filler(3),
    ),
  );

  const names = characters.map((c) => c.name);
  for (const lyric of ["THE BOYS'LL BE SOLD,", 'OH, FOR THE WINGS,', 'FAR AWAY, FAR AWAY,']) {
    assert.ok(!names.includes(lyric), `a lyric was cast as a character: ${lyric}`);
  }
});

test('the seam down a photocopy does not split one character into four', () => {
  const { characters } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('PRENTISS', 306),
        speech('But I call him Tubby.', 340),
        line('3 PRENTISS', 690, 400),
        speech('Hide beans in your blanket?', 434),
        line('= PRENTISS', 690, 494),
        speech('Faint at the merest whisper of —', 528),
        line('i PRENTISS', 690, 588, { confs: [38, 94] }),
        speech('To pass the time—', 622),
      ]),
      filler(3),
    ),
  );

  const prentiss = characters.filter((c) => /PRENTISS/.test(c.name));
  assert.equal(prentiss.length, 1, `PRENTISS came back as ${prentiss.length} people`);
  assert.equal(prentiss[0].name, 'PRENTISS');
  assert.equal(prentiss[0].lineCount, 4);
});

test('a coffee-ring line the scanner guessed at is not read aloud', () => {
  const { lines } = parseScript(
    pages(
      filler(1),
      [
        line('CER e_—_—,ee—e,e ee em', 113, 0, { confs: [19, 12, 20, 15, 22, 18] }),
        line('rasa', 228, 16, { conf: 30 }),
        ...filler(2),
      ],
      filler(3),
    ),
  );

  assert.ok(!lines.some((l) => /e_—_—/.test(l.text)), 'scanner litter survived into the script');
  assert.ok(!lines.some((l) => l.text === ':'), 'a stray colon survived into the script');
});

test('an unfinished parenthetical picks up its own tail, not a new character', () => {
  const { characters, lines } = parseScript(
    pages(
      filler(1),
      filler(2, [
        direction('(waves cordially as the SEAMEN march ASTER away to the Wasp, then to MRS.', 306, { x1: 1180 }),
        line('BUMBRAKE)', 355, 340),
        cue('SLANK', 400),
        speech("Comfy, are we? That's nice.", 434),
      ]),
      filler(3),
    ),
  );

  assert.ok(!characters.some((c) => c.name === 'BUMBRAKE)'), 'the tail of a stage direction was cast');
  const joined = lines.find((l) => /waves cordially/.test(l.text));
  assert.equal(joined.type, 'stage');
  assert.match(joined.text, /then to MRS\. BUMBRAKE/, 'the wrapped tail was not rejoined');
});

test('a parenthetical that already closed does not swallow the cue below it', () => {
  const { characters, lines } = parseScript(
    pages(
      filler(1),
      filler(2, [
        direction('(Trimly uniformed BRITISH SEAMEN march on, accompanied by a military cadence.)', 355, {
          x1: 1180,
        }),
        cue('SEAMEN', 690),
        speech('CALL ALL HANDS TO MAN THE CAPSTAN', 340),
      ]),
      filler(3),
    ),
  );

  assert.ok(characters.some((c) => c.name === 'SEAMEN'), 'a whole part was eaten by the line above it');
  const stage = lines.find((l) => /Trimly uniformed/.test(l.text));
  assert.ok(!/SEAMEN march on.*SEAMEN/.test(stage.text), 'the cue was absorbed into the stage direction');
});
