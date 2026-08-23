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

test('a name is not split in four by a mark at the end of the line', () => {
  const { characters } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('ASTER', 306),
        speech("There's my little Starcatcher.", 340),
        line('ASTER i', 690, 400, { confs: [95, 41] }),
        speech('Just an apprentice, really.', 434),
        line('ASTER H', 690, 494, { confs: [94, 38] }),
        speech('Off you go, then.', 528),
        line('ASTER )', 690, 588, { confs: [95, 30] }),
        speech('And mind the trunk.', 622),
      ]),
      filler(3),
    ),
  );

  const aster = characters.filter((c) => /^ASTER/.test(c.name));
  assert.equal(aster.length, 1, `ASTER came back as ${aster.map((c) => c.name).join(', ')}`);
  assert.equal(aster[0].lineCount, 4);
});

test('a mark the scanner was confident about is part of the name', () => {
  const { characters } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('TENOR 2', 306),
        speech('Dive and swim, and swim on.', 340),
        cue('TENOR 2', 400),
        speech('Against the tide, and on.', 434),
        cue('TENOR 2', 494),
        speech('And on, and on again.', 528),
      ]),
      filler(3),
    ),
  );

  assert.ok(characters.some((c) => c.name === 'TENOR 2'), 'a meaningful number was stripped off');
});

test('an established name swallows its scanner ghosts, but not a real variant', () => {
  const many = [];
  for (let i = 0; i < 6; i++) {
    many.push(cue('FIGHTING PRAWN', 300 + i * 90), speech(`Line number ${i} of the chief.`, 335 + i * 90));
  }
  const { characters } = parseScript(
    pages(
      filler(1),
      filler(2, many),
      filler(3, [
        line('FIGHTING PRAWN i', 690, 306, { confs: [95, 94, 40] }),
        speech('A ghost of the same chief.', 340),
        cue('FIGHTING', 400),
        speech('A different cue the scanner truncated.', 434),
      ]),
    ),
  );

  const names = characters.map((c) => c.name);
  assert.ok(!names.includes('FIGHTING PRAWN i'), 'a one-letter ghost was left in the cast');
  assert.ok(
    names.includes('FIGHTING'),
    'a genuinely different cue was folded away without asking — that belongs in the look-over',
  );
});

test('a vocal score bound in at the back is set aside', () => {
  // A page of staves: low confidence, and mostly one- and two-character
  // fragments where OCR tried to read notation and split syllables.
  const scorePage = () => {
    const lines = [];
    for (let i = 0; i < 10; i++) {
      lines.push(
        line('re = ud = i 5 TIT a', 120, 100 + i * 60, { conf: 55 }),
        line('nev - er be fish a - gain be - cause', 300, 130 + i * 60, { conf: 62 }),
      );
    }
    return lines;
  };

  const { notes, characters } = parseScript(
    pages(filler(1), filler(2), filler(3), scorePage(), scorePage(), scorePage()),
  );

  assert.equal(notes.scorePagesSetAside, 3);
  assert.ok(!characters.some((c) => /TIT|nev/.test(c.name)), 'notation was cast as a character');
});

test('one rough page in the middle is not mistaken for a score', () => {
  const rough = [line('re = ud = i 5 TIT a', 120, 100, { conf: 55 })];
  const { notes } = parseScript(pages(filler(1), rough, filler(2), filler(3)));
  assert.equal(notes.scorePagesSetAside, 0, 'a bad page mid-script is just a bad page');
});

test('a cast-list page does not name the play "Characters"', () => {
  const front = [line('CHARACTERS', 240, 60), line('MOLLY, a girl of thirteen', 220, 96)];
  const { title } = parseScript(
    pages(front, filler(1), filler(2), filler(3)),
    'Peter and the Starcatcher Script',
  );
  assert.equal(title, 'Peter and the Starcatcher Script');
});

test('a real cover page still wins over the filename', () => {
  const front = [line('PETER AND THE STARCATCHER', 240, 60), line('a play in two acts', 250, 96)];
  const { title } = parseScript(pages(front, filler(1), filler(2), filler(3)), 'scan001.pdf');
  assert.equal(title, 'Peter and the Starcatcher');
});

test('the play starts at the play, not at the contents page', () => {
  // Front matter that has fooled every line-by-line rule: a cast page whose
  // section headings sit over paragraphs, then a contents page which is
  // nothing but a column of scene headings.
  const castPage = [
    line('CHARACTERS', 240, 60),
    line('THE ORPHANS', 240, 96),
    line('Boy (Peter): A boy who does not miss much, nameless and homeless at the start.', 200, 130, 1180),
    line('Prentiss: Ambitious, hyper-articulate, logical; yearns to be a leader.', 200, 166, 1180),
    line('THE BRITISH SUBJECTS', 240, 200),
    line('Molly Aster: A girl of thirteen who is nobody to trifle with at all.', 200, 236, 1180),
  ];
  const contentsPage = [
    line('ACT ONE', 240, 60),
    line('4. BILGE DUNGEON ..................................... 22', 200, 96),
    line('#5) Grempkin Flashback ............................. 24', 200, 130),
    line('ACT TWO', 240, 166),
    line('1. MOUNTAINTOP, MOLLUSK ISLAND ....... 74', 200, 200),
    line('#19) Mermaid Playoff ................................ 74', 200, 236),
  ];
  const scene = (n) => {
    // Clear of the running-head band, and distinct per page, so this fixture
    // exercises front matter rather than the header stripper.
    const out = [line(n === 1 ? 'PROLOGUE: A Bare Stage' : `SCENE ${n}: On Deck`, 374, 200)];
    let y = 260;
    const speakers = ['BOY', 'PRENTISS', 'SCOTT', 'SMEE', 'MOLLY', 'ASTER'];
    for (const who of speakers) {
      out.push(cue(who, y), speech(`Line ${n} from ${who.toLowerCase()}, spoken plainly.`, y + 34));
      y += 74;
    }
    return out;
  };

  const { lines, characters } = parseScript(pages(castPage, contentsPage, scene(1), scene(2)));

  assert.equal(lines[0].type, 'scene');
  assert.equal(lines[0].text, 'PROLOGUE: A Bare Stage');
  assert.ok(!lines.some((l) => /BILGE DUNGEON|Mermaid Playoff/.test(l.text)), 'contents survived');
  assert.ok(!lines.some((l) => /hyper-articulate|nameless and homeless/.test(l.text)), 'cast page survived');
  assert.ok(!characters.some((c) => /CHARACTERS|THE ORPHANS|ACT ONE/.test(c.name)));
});

test('a shout under a cue is a line, not a second name', () => {
  const { lines } = parseScript(
    pages(
      filler(1),
      filler(2, [
        cue('BOXING ANNOUNCER', 306),
        speech('This is a one-round knockout match, no rules at all.', 340),
        line('ALL', 728, 400),
        line('WE LOVE IT!', 315, 434),
        cue('BOXING ANNOUNCER', 494),
        speech('Now shake hands and come out rhyming!', 528),
      ]),
      filler(3),
    ),
  );

  const shout = lines.find((l) => l.text === 'WE LOVE IT!');
  assert.equal(shout.speaker, 'ALL', 'the shout was not attributed to the company');
  assert.ok(!lines.some((l) => l.type === 'dialogue' && l.text.trim() === 'ALL'));
});

test('a cue read as speech is handed back to whoever was being cued', () => {
  const many = [];
  for (let i = 0; i < 4; i++) {
    many.push(cue('MOLLY', 300 + i * 80), speech(`Molly says something, number ${i}.`, 334 + i * 80));
    many.push(cue('TED', 340 + i * 80), speech(`Ted answers her, number ${i}.`, 374 + i * 80));
  }
  const { lines } = parseScript(
    pages(filler(1), filler(2, many), filler(3, [
      cue('MOLLY', 306),
      speech('Then help me get the trunk out of the cabin!', 340),
      speech('TED', 371, { x1: 1327, confs: [70] }),
      speech('Sorry, not our issue at all today.', 371),
    ])),
  );

  const sorry = lines.find((l) => /Sorry, not our issue/.test(l.text));
  assert.equal(sorry.speaker, 'TED', 'the line stayed with the wrong character');
  assert.ok(!lines.some((l) => l.type === 'dialogue' && l.text.trim() === 'TED'));
});

test('a one-letter misread of a name does not become a new character', () => {
  const many = [];
  for (let i = 0; i < 6; i++) {
    many.push(cue('ALL', 300 + i * 80), speech(`Everyone speaks together, line ${i}.`, 334 + i * 80));
  }
  const { characters } = parseScript(
    pages(filler(1), filler(2, many), filler(3, [
      line('ALE', 690, 306), speech('Ready when you are, every one of us.', 329, 340),
      line('ALT', 690, 400), speech('Set and steady, the lot of us.', 329, 434),
    ])),
  );

  const names = characters.map((c) => c.name);
  assert.ok(!names.includes('ALE') && !names.includes('ALT'), `scanner slips became parts: ${names}`);
  assert.ok(names.includes('ALL'));
});
