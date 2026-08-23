<script>
  import { onMount } from 'svelte';
  import { stage, setProgress, clearProgress, uploadError } from '../lib/stage.js';
  import { get } from 'svelte/store';
  import { session, startFromScript, startFromCueFile } from '../lib/session.js';
  import { looksLikeCueFile, parse as parseCueFile } from '../lib/cuefile.js';
  import { loadDraft, clearDraft } from '../lib/autosave.js';
  import { unlockAudio } from '../lib/tts.js';

  let draft = null;

  // dragenter/dragleave fire for every child element the pointer crosses, so
  // a plain boolean flickers. Counting them doesn't.
  let dragDepth = 0;
  let overBox = false;
  // "A file is somewhere over the window" and "a file is over the box" are
  // different things to say, now that the box is the only place that takes one.
  $: armed = dragDepth > 0;

  onMount(async () => {
    draft = await loadDraft();
  });

  async function handle(file) {
    if (!file) return;
    uploadError.set('');
    // First touch of the session — get the audio context alive while a finger
    // is definitely on the glass, long before anyone presses play.
    unlockAudio();

    try {
      // Cue tells a saved file from a fresh script itself. Nobody should have
      // to answer "which kind of upload is this?".
      const head = await file.slice(0, 4096).text().catch(() => '');
      if (looksLikeCueFile(head)) {
        startFromCueFile(parseCueFile(await file.text()));
        stage.set(resumeStage());
        return;
      }

      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        uploadError.set('Cue reads PDFs, or a .cue.md file you saved here before.');
        return;
      }

      stage.set('processing');
      const { ingestPdf } = await import('../lib/ingest.js');
      const { parseScript } = await import('../lib/parse.js');

      const { pages, scanned } = await ingestPdf(file, (u) =>
        setProgress(u.message, u.current, u.total),
      );
      setProgress('Working out who says what…');
      const parsed = parseScript(pages, file.name.replace(/\.pdf$/i, ''));

      if (!parsed.characters.length) {
        clearProgress();
        stage.set('upload');
        uploadError.set(
          "Cue couldn't find any dialogue in that one. If it's a scan, a straighter or sharper copy usually does it.",
        );
        return;
      }

      startFromScript(parsed, { scanned });
      clearProgress();
      stage.set('review');
    } catch (err) {
      console.error('[cue] ingest failed', err);
      clearProgress();
      stage.set('upload');
      uploadError.set(describe(err));
    }
  }

  function onDrop(event) {
    event.preventDefault();
    dragDepth = 0;
    overBox = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) handle(file);
  }

  function onDragEnter(event) {
    if (event.dataTransfer?.types?.includes('Files')) dragDepth++;
  }

  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
  }

  /**
   * The box is the only thing that accepts a script — but a file dropped just
   * outside it must not make the browser navigate away to the PDF, which looks
   * exactly like the app reloading and losing everything. Swallow the stray
   * drop and point at the box instead.
   */
  function onStrayDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }

  function onStrayDrop(event) {
    event.preventDefault();
    dragDepth = 0;
    overBox = false;
    if (event.dataTransfer?.files?.length) {
      uploadError.set('Nearly — drop it inside the dashed box.');
    }
  }

  /**
   * Say what went wrong in words. A worker that fails to start throws an
   * ErrorEvent rather than an Error, so `err.message` is undefined and the
   * naive version of this produced no message at all.
   */
  function describe(err) {
    const detail = err?.message ?? err?.error?.message ?? String(err?.type ?? err ?? '');
    if (detail.includes('Cue file')) return detail;
    if (/importScripts|Worker|wasm/i.test(detail)) {
      return "Cue couldn't start its reader. A hard refresh usually sorts it — and if it doesn't, the browser may be blocking WebAssembly.";
    }
    return "Something went wrong reading that file. If it's a scan, try a sharper copy.";
  }

  async function resume() {
    startFromCueFile(parseCueFile(draft.text));
    stage.set(resumeStage());
  }

  /**
   * Straight to the reading screen — unless nobody's been ticked as "you"
   * yet, in which case the reader would never pause and the whole thing would
   * just play at you.
   */
  function resumeStage() {
    return get(session).characters.some((c) => c.isYou) ? 'reader' : 'casting';
  }

  async function dismissDraft() {
    await clearDraft();
    draft = null;
  }
</script>

{#if draft}
  <div class="callout resume">
    <span class="kicker">still open from last time</span>
    <p><strong>{draft.title || 'Your last script'}</strong> is right where you left it.</p>
    <div class="resume-actions">
      <button class="btn small" on:click={resume}>Pick it back up</button>
      <button class="btn ghost small" on:click={dismissDraft}>Start fresh</button>
    </div>
  </div>
{/if}

<!-- The window only ever swallows a stray drop; the box below is what
     actually takes a script. -->
<svelte:window
  on:dragenter={onDragEnter}
  on:dragleave={onDragLeave}
  on:dragover={onStrayDragOver}
  on:drop={onStrayDrop}
/>

<!-- A label, not a div with a click handler: the file picker opens natively,
     the keyboard works for free, and the input's own click can't bubble back
     out and re-open the dialog. -->
<label
  class="drop"
  class:armed
  class:over={overBox}
  for="cue-file"
  on:dragover|preventDefault|stopPropagation={(e) => {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    overBox = true;
  }}
  on:dragleave={() => (overBox = false)}
  on:drop|stopPropagation={onDrop}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--sky)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
  <h3>{overBox ? 'Let go' : 'Drop your script here'}</h3>
  <p class="muted">A PDF — even a crooked photocopy — or a <code>.cue.md</code> file you saved before.</p>
  <span class="btn sky">Choose a file</span>
  <input
    id="cue-file"
    type="file"
    accept=".pdf,.md,.txt,application/pdf,text/markdown"
    on:change={(e) => handle(e.currentTarget.files[0])}
  />
</label>

{#if $uploadError}
  <p class="error" role="alert">{$uploadError}</p>
{/if}

<div class="two-ways">
  <div class="card">
    <h4>📄 First time with this script</h4>
    <p class="muted">Cue reads it, cleans it up, and walks you through casting. A couple of minutes, once.</p>
  </div>
  <div class="card">
    <h4>💾 You've been here before</h4>
    <p class="muted">Drop the file you saved last time and you're straight into the reading screen.</p>
  </div>
</div>

<p class="privacy muted">
  Your script never leaves this device. There's no account, no upload, and no server — the
  reading, the voices, and the saving all happen right here in the page.
</p>

<style>
  .drop {
    margin-top: 26px;
    border: 3px dashed var(--line);
    border-radius: 26px;
    background: var(--paper-raised);
    padding: 38px 24px 32px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .drop { display: block; }
  .drop:hover, .drop:focus-within { border-color: var(--sky); }
  /* A file is over the window somewhere: show where it has to land. */
  .drop.armed {
    border-color: var(--sky);
    background: color-mix(in srgb, var(--sky) 7%, var(--paper-raised));
  }
  /* It's over the box: let go. */
  .drop.over {
    border-color: var(--coral);
    background: color-mix(in srgb, var(--coral) 9%, var(--paper-raised));
    transform: scale(1.01);
  }
  .drop svg { width: 42px; height: 42px; }
  .drop h3 { margin: 10px 0 4px; font-size: 1.35rem; }
  .drop p { margin: 0 auto 18px; max-width: 42ch; font-size: 0.95rem; }
  .drop code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85em;
    background: color-mix(in srgb, var(--sky) 12%, transparent);
    padding: 1px 5px;
    border-radius: 5px;
  }
  /* Hidden but still focusable, so tabbing to the drop zone works. */
  input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .error {
    margin: 16px auto 0;
    text-align: center;
    color: var(--coral);
    font-weight: 700;
    font-size: 0.95rem;
    max-width: 52ch;
  }

  .resume { margin-top: 24px; }
  .resume p { margin: 2px 0 12px; }
  .resume-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .two-ways { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 26px 0 0; }
  .two-ways h4 { margin: 0 0 4px; font-size: 1rem; }
  .two-ways p { margin: 0; font-size: 0.92rem; }
  @media (max-width: 640px) { .two-ways { grid-template-columns: 1fr; } }

  .privacy { text-align: center; font-size: 0.88rem; margin: 26px auto 0; max-width: 56ch; }
</style>
