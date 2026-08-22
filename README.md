# Cue

Upload a script, cast it with real-sounding voices, and run your lines out
loud — right in the browser. No app store, no install, no account.

Cue reads your script, works out who says what, gives every character their
own voice, and reads all of their lines aloud — then stops and waits when it's
your turn. You read your part, in the room, out loud, the way you would with a
real scene partner.

## What it does

- **Reads a real script.** Most rehearsal scripts are a photocopy of a
  photocopy that someone scanned crooked. Cue straightens, cleans, and reads
  each page on-device, then sorts it into scene headings, character cues,
  dialogue, and stage direction.
- **Casts it automatically.** Women get the women's voices in first-appearance
  order, men get the men's, and stage direction always gets its own narrator.
  Press ▶ next to anyone to hear one of their own lines before you commit.
- **Waits for you.** Someone else's line gets spoken and the reader moves on.
  Your line stops it until you press Go, tap the script, or hit space.
- **Remembers everything.** Save the whole rehearsal as one small text file.
  Drop it back in next time and you're straight into the reading screen.
- **Works offline.** After the first visit it runs with no signal at all —
  backstage, in a basement, in the car.

Nothing leaves your device. There is no server, no account, and no upload.

## Running it

```bash
npm install
npm run dev
```

`npm install` also vendors the OCR runtime into `public/tess/` (the worker,
the wasm core, and the English language data — about 21 MB, gitignored). It
needs a network connection the first time; after that it's cached.

```bash
npm test     # the parser, the save format, and the reading rules
npm run build
```

`npm run build` produces a static `dist/` with a relative base, so it drops
onto GitHub Pages, Netlify, Cloudflare Pages, or a subfolder with no
per-host configuration.

## How it's put together

Everything runs client-side. There is no backend to deploy and nothing to pay
for per user.

| Piece | What does it |
| --- | --- |
| Page images | `pdf.js` rasterizes, then deskew / contrast / despeckle |
| Reading the page | Tesseract (wasm), on-device, with per-word confidence |
| Voices | Kokoro via ONNX Runtime Web — WebGPU where available, wasm otherwise |
| UI | Svelte, built by Vite |
| Storage | IndexedDB autosave, plus the `.cue.md` file you download |

A few things worth knowing:

- **A clean PDF skips OCR.** The spec treats every upload as a scan, and most
  are. But a digital export already knows its own words, so Cue probes three
  pages up front and takes the text layer when it's real — faster and more
  accurate, and a script never ends up read two different ways.
- **Voice weights come from the Hugging Face CDN** by default, not from this
  origin. Set `VITE_KOKORO_MODEL` at build time to point at a self-hosted
  copy. Either way the browser caches them after the first visit.
- **Wrapped prose is rejoined; verse isn't.** If a line ran to the right
  margin it wrapped, so the next line is the rest of it. If it stopped short,
  the break was deliberate. That's the difference between hearing a whole
  thought and hearing it chopped in half.

## The saved file

`.cue.md` is plain text, and it's meant to be opened and nudged by hand:

```markdown
---
title: "Hamlet"
settings:
  line_delay_ms: 600        # pause between lines
  read_stage_directions: true
characters:
  - name: "HAMLET"
    voice: male_1
    color: "#E85D8C"
    is_you: true
    speed: 1.0
---

## ACT I, SCENE II

[stage] A room of state in the castle.

[HAMLET] O, that this too too solid flesh would melt,
[HAMLET] Thaw, and resolve itself into a dew!
```

Cue tells this apart from a fresh PDF by itself, so you never have to say
which kind of upload it is.
