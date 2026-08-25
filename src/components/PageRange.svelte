<script>
  import { onMount } from 'svelte';
  import { pending } from '../lib/pending.js';
  import { stage, setProgress, clearProgress, uploadError } from '../lib/stage.js';
  import { startFromScript } from '../lib/session.js';
  import { renderThumbnail } from '../lib/pdf.js';

  export let onCancel = () => {};

  let first = 1;
  let last = 1;
  let thumbs = { first: null, last: null };
  let busy = false;
  let total = 0;

  $: total = $pending?.pages ?? 0;
  $: pageCount = Math.max(0, last - first + 1);

  onMount(() => {
    last = $pending?.pages ?? 1;
    preview();
  });

  let previewToken = 0;
  async function preview() {
    const token = ++previewToken;
    const pdf = $pending?.pdf;
    if (!pdf) return;
    for (const [key, number] of [['first', first], ['last', last]]) {
      if (number < 1 || number > total) continue;
      const page = await pdf.getPage(number);
      const url = await renderThumbnail(page);
      page.cleanup();
      if (token !== previewToken) return;
      thumbs = { ...thumbs, [key]: url };
    }
  }

  function clampFirst(value) {
    first = Math.min(Math.max(1, Math.round(value) || 1), total);
    if (last < first) last = first;
    preview();
  }
  function clampLast(value) {
    last = Math.min(Math.max(first, Math.round(value) || first), total);
    preview();
  }

  async function read() {
    if (busy) return;
    busy = true;
    const { file, pdf } = $pending;
    stage.set('processing');

    try {
      const { ingestPdf } = await import('../lib/ingest.js');
      const { parseScript } = await import('../lib/parse.js');

      const { pages, scanned } = await ingestPdf(
        pdf,
        { from: first, to: last },
        (u) => setProgress(u.message, u.current, u.total),
      );
      setProgress('Working out who says what…');
      const parsed = parseScript(pages, file.name.replace(/\.pdf$/i, ''));

      if (!parsed.characters.length) {
        clearProgress();
        stage.set('range');
        busy = false;
        uploadError.set(
          "Cue couldn't find any dialogue in those pages. Check the page numbers — the first one should be where the dialogue starts.",
        );
        return;
      }

      startFromScript(parsed, { scanned });
      clearProgress();
      stage.set('review');
    } catch (err) {
      console.error('[cue] ingest failed', err);
      clearProgress();
      stage.set('range');
      busy = false;
      uploadError.set("Something went wrong reading those pages. If it's a scan, try a sharper copy.");
    }
  }
</script>

<section class="range">
  <span class="kicker">before Cue starts reading</span>
  <h2>Which pages are the script?</h2>
  <p class="muted intro">
    Published scripts come wrapped in things nobody needs read aloud — a cast list, a casting
    note, a table of contents, and a vocal score at the back. Point Cue at the dialogue and it
    skips all of it, and finishes sooner.
  </p>

  <div class="pickers">
    <label class="picker">
      <span class="label">First page of dialogue</span>
      <div class="control">
        <button class="step" on:click={() => clampFirst(first - 1)} aria-label="Previous page">−</button>
        <input
          type="number" min="1" max={total} value={first}
          on:change={(e) => clampFirst(+e.currentTarget.value)}
        />
        <button class="step" on:click={() => clampFirst(first + 1)} aria-label="Next page">+</button>
      </div>
      {#if thumbs.first}
        <img src={thumbs.first} alt="Page {first}" />
      {:else}
        <div class="placeholder"></div>
      {/if}
    </label>

    <label class="picker">
      <span class="label">Last page of dialogue</span>
      <div class="control">
        <button class="step" on:click={() => clampLast(last - 1)} aria-label="Previous page">−</button>
        <input
          type="number" min={first} max={total} value={last}
          on:change={(e) => clampLast(+e.currentTarget.value)}
        />
        <button class="step" on:click={() => clampLast(last + 1)} aria-label="Next page">+</button>
      </div>
      {#if thumbs.last}
        <img src={thumbs.last} alt="Page {last}" />
      {:else}
        <div class="placeholder"></div>
      {/if}
    </label>
  </div>

  <p class="tally muted">
    {pageCount} of {total} pages — about {Math.max(1, Math.round((pageCount * 1.9) / 60))} min to read.
  </p>

  <div class="actions">
    <button class="btn ghost" on:click={onCancel}>← different file</button>
    <button class="btn" on:click={read} disabled={busy}>Read pages {first}–{last} →</button>
  </div>
</section>

<style>
  .range { margin-top: 26px; }
  h2 { font-size: 1.9rem; }
  .intro { margin-top: 0; }

  .pickers { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0 6px; }
  @media (max-width: 620px) { .pickers { grid-template-columns: 1fr; } }

  .picker {
    background: var(--paper-raised);
    border: 2px solid var(--line);
    border-radius: 20px;
    padding: 16px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .label { font-weight: 700; font-size: 0.9rem; }
  .control { display: flex; align-items: center; gap: 8px; }
  .control input {
    width: 5.5ch;
    text-align: center;
    font-family: 'Fredoka', sans-serif;
    font-size: 1.05rem;
    padding: 6px 4px;
  }
  .step {
    width: 32px; height: 32px;
    border-radius: 50%;
    border: 2px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  }
  .step:hover { border-color: var(--sky); }

  .picker img, .placeholder {
    width: 100%;
    max-width: 240px;
    aspect-ratio: 8.5 / 11;
    object-fit: contain;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
  }
  .placeholder { background: color-mix(in srgb, var(--line) 40%, transparent); }

  .tally { text-align: center; font-size: 0.88rem; margin: 10px auto 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-top: 24px; }
</style>
