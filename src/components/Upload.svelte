<script>
  import { onMount } from 'svelte';
  import { stage, setProgress, clearProgress } from '../lib/stage.js';
  import { startFromScript, startFromCueFile } from '../lib/session.js';
  import { looksLikeCueFile, parse as parseCueFile } from '../lib/cuefile.js';
  import { loadDraft, clearDraft } from '../lib/autosave.js';
  import { unlockAudio } from '../lib/tts.js';

  let dragging = false;
  let error = '';
  let draft = null;

  onMount(async () => {
    draft = await loadDraft();
  });

  async function handle(file) {
    if (!file) return;
    error = '';
    // First touch of the session — get the audio context alive while a finger
    // is definitely on the glass, long before anyone presses play.
    unlockAudio();

    try {
      // Cue tells a saved file from a fresh script itself. Nobody should have
      // to answer "which kind of upload is this?".
      const head = await file.slice(0, 4096).text().catch(() => '');
      if (looksLikeCueFile(head)) {
        startFromCueFile(parseCueFile(await file.text()));
        stage.set('reader');
        return;
      }

      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        error = 'Cue reads PDFs, or a .cue.md file you saved here before.';
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
        error = "Cue couldn't find any dialogue in that one. If it's a scan, a straighter or sharper copy usually does it.";
        return;
      }

      startFromScript(parsed, { scanned });
      clearProgress();
      stage.set('review');
    } catch (err) {
      console.error(err);
      clearProgress();
      stage.set('upload');
      error = err?.message?.includes('Cue file')
        ? err.message
        : "Something went wrong reading that file. If it's a scan, try a sharper copy.";
    }
  }

  function onDrop(event) {
    dragging = false;
    handle(event.dataTransfer?.files?.[0]);
  }

  async function resume() {
    startFromCueFile(parseCueFile(draft.text));
    stage.set('reader');
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

<div
  class="drop"
  class:dragging
  role="button"
  tabindex="0"
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave={() => (dragging = false)}
  on:drop|preventDefault={onDrop}
  on:click={() => document.getElementById('cue-file').click()}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && document.getElementById('cue-file').click()}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--sky)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
  <h3>Drop your script here</h3>
  <p class="muted">A PDF — even a crooked photocopy — or a <code>.cue.md</code> file you saved before.</p>
  <span class="btn sky">Choose a file</span>
  <input id="cue-file" type="file" accept=".pdf,.md,.txt,application/pdf,text/markdown" on:change={(e) => handle(e.currentTarget.files[0])} />
</div>

{#if error}
  <p class="error" role="alert">{error}</p>
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
  .drop:hover, .drop:focus-visible { border-color: var(--sky); }
  .drop.dragging { border-color: var(--coral); transform: scale(1.01); }
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
  input[type='file'] { display: none; }

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
