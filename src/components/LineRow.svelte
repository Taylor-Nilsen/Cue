<script>
  import { updateLine, deleteLine, splitLine } from '../lib/session.js';

  export let line;
  export let characters = [];
  export let editing = false;

  let box;

  // Underline only the words OCR wasn't sure about. On a clean text layer this
  // list is empty, which is exactly right — nothing to proofread.
  $: shaky = new Set((line.shaky ?? []).map((w) => w.toLowerCase()));
  $: pieces = line.text.split(/(\s+)/);

  function commit(event) {
    updateLine(line.id, { text: event.currentTarget.value, shaky: [] });
  }
  function splitHere() {
    const at = box?.selectionStart ?? 0;
    splitLine(line.id, at);
    editing = false;
  }
</script>

<div class="line" class:editing class:is-scene={line.type === 'scene'}>
  <button class="body" on:click={() => (editing = !editing)} aria-expanded={editing}>
    <span class="tag" class:stage={line.type === 'stage'} class:scene={line.type === 'scene'}>
      {line.type === 'dialogue' ? line.speaker : line.type}
    </span>
    <span class="text" class:italic={line.type === 'stage'}>
      {#each pieces as piece}
        {#if piece.trim() && shaky.has(piece.replace(/[^\w'’-]/g, '').toLowerCase())}
          <mark>{piece}</mark>
        {:else}{piece}{/if}
      {/each}
    </span>
  </button>

  {#if editing}
    <div class="editor">
      <textarea bind:this={box} value={line.text} on:change={commit} rows="2"></textarea>
      <div class="controls">
        <label>
          <span class="sr-only">Line type</span>
          <select value={line.type} on:change={(e) => updateLine(line.id, { type: e.currentTarget.value })}>
            <option value="dialogue">dialogue</option>
            <option value="stage">stage direction</option>
            <option value="scene">scene heading</option>
          </select>
        </label>
        {#if line.type === 'dialogue'}
          <label>
            <span class="sr-only">Who says it</span>
            <select value={line.speaker} on:change={(e) => updateLine(line.id, { speaker: e.currentTarget.value })}>
              {#each characters as c}
                <option value={c.name}>{c.name}</option>
              {/each}
            </select>
          </label>
        {/if}
        <button class="btn ghost small" on:click={splitHere} title="Split the line where the cursor is">
          Split here
        </button>
        <button class="btn ghost small danger" on:click={() => deleteLine(line.id)}>Remove</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .line { border-bottom: 1px solid var(--line); }
  .line.editing { background: color-mix(in srgb, var(--sunny) 10%, transparent); }
  .body {
    display: grid;
    grid-template-columns: 116px 1fr;
    gap: 12px;
    align-items: start;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 9px 10px;
    cursor: pointer;
    font: inherit;
  }
  .body:hover { background: color-mix(in srgb, var(--sky) 7%, transparent); }
  .tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding-top: 4px;
    overflow-wrap: anywhere;
  }
  .tag.stage { color: var(--grass); }
  .tag.scene { color: var(--coral); }
  .text { font-size: 0.95rem; }
  .text.italic { font-style: italic; color: var(--muted); }
  .is-scene .text { font-family: 'Fredoka', sans-serif; }

  mark {
    background: none;
    color: inherit;
    text-decoration: underline wavy color-mix(in srgb, var(--coral) 75%, transparent);
    text-underline-offset: 3px;
  }

  .editor { padding: 0 10px 12px 10px; }
  textarea {
    width: 100%;
    font: inherit;
    font-size: 0.95rem;
    color: var(--ink);
    background: var(--paper);
    border: 2px solid var(--line);
    border-radius: 12px;
    padding: 8px 10px;
    resize: vertical;
  }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; align-items: center; }
  .danger { color: var(--coral); }
  @media (max-width: 560px) {
    .body { grid-template-columns: 1fr; gap: 2px; }
    .tag { padding-top: 0; }
  }
</style>
