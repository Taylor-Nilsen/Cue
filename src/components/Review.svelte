<script>
  import { session, scriptStats } from '../lib/session.js';
  import { stage } from '../lib/stage.js';
  import LineRow from './LineRow.svelte';
  import CastEditor from './CastEditor.svelte';

  const PAGE = 200;

  let filter = 'shaky';
  let shown = PAGE;

  $: stats = scriptStats($session);
  $: shakyLines = $session.lines.filter((l) => (l.shaky?.length ?? 0) > 0);
  // A clean text layer has nothing to proofread, so don't open on an empty tab.
  $: if (filter === 'shaky' && !shakyLines.length && $session.lines.length) filter = 'all';
  $: visible = (filter === 'shaky' ? shakyLines : $session.lines).slice(0, shown);
  $: remaining = (filter === 'shaky' ? shakyLines : $session.lines).length - visible.length;
</script>

<section class="review">
  <span class="kicker">a quick look-over</span>
  <h2>Anything Cue misread?</h2>

  <label class="title-field">
    <span class="sr-only">Script title</span>
    <input
      type="text"
      value={$session.title}
      on:change={(e) => session.update((s) => ({ ...s, title: e.currentTarget.value }))}
    />
  </label>

  <div class="stats">
    <span><strong>{stats.scenes}</strong> {stats.scenes === 1 ? 'scene' : 'scenes'}</span>
    <span><strong>{stats.spoken}</strong> spoken {stats.spoken === 1 ? 'line' : 'lines'}</span>
    <span><strong>{$session.characters.length}</strong>
      {$session.characters.length === 1 ? 'character' : 'characters'}</span>
    {#if $session.scanned}
      <span class="shaky-count"><strong>{stats.shaky}</strong>
        {stats.shaky === 1 ? 'word' : 'words'} to glance at</span>
    {/if}
  </div>

  {#if $session.notes?.scorePagesSetAside}
    <div class="callout">
      <span class="kicker">set aside</span>
      <p>
        The last {$session.notes.scorePagesSetAside} pages looked like sheet music rather than
        script — staves and syllables split across barlines, which nothing can read aloud
        sensibly. They've been left out. If that's wrong, the script is still whole in your PDF.
      </p>
    </div>
  {/if}

  {#if $session.scanned && stats.shaky > 0}
    <div class="callout">
      <span class="kicker">the underlined bits</span>
      <p>
        A rough scan always misreads a word or two. Anything Cue wasn't confident about is
        underlined — tap a line to fix it, the way you'd fix a spell-check squiggle. Everything
        else is fine to leave alone.
      </p>
    </div>
  {/if}

  <CastEditor />

  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={filter === 'shaky'} class:on={filter === 'shaky'}
            on:click={() => { filter = 'shaky'; shown = PAGE; }}>
      Needs a look ({shakyLines.length})
    </button>
    <button role="tab" aria-selected={filter === 'all'} class:on={filter === 'all'}
            on:click={() => { filter = 'all'; shown = PAGE; }}>
      Whole script ({$session.lines.length})
    </button>
  </div>

  <div class="script card">
    {#if !visible.length}
      <p class="empty muted">Nothing needs a second look — Cue read this one cleanly.</p>
    {:else}
      {#each visible as line (line.id)}
        <LineRow {line} characters={$session.characters} />
      {/each}
    {/if}
  </div>

  {#if remaining > 0}
    <button class="btn ghost more" on:click={() => (shown += PAGE)}>
      Show {Math.min(remaining, PAGE)} more
    </button>
  {/if}

  <div class="next">
    <button class="btn" on:click={() => stage.set('casting')}>Looks right — cast it →</button>
  </div>
</section>

<style>
  .review { margin-top: 26px; }
  h2 { font-size: 1.9rem; }
  .title-field input {
    width: 100%;
    font-family: 'Fredoka', sans-serif;
    font-size: 1.15rem;
    padding: 9px 12px;
  }
  .stats { display: flex; flex-wrap: wrap; gap: 16px; margin: 14px 0 4px; font-size: 0.9rem; color: var(--muted); }
  .stats strong { color: var(--ink); font-family: 'Fredoka', sans-serif; }
  .shaky-count strong { color: var(--coral); }

  .tabs { display: flex; gap: 8px; margin: 22px 0 12px; }
  .tabs button {
    background: var(--paper-raised);
    border: 2px solid var(--line);
    border-radius: 999px;
    padding: 7px 16px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .tabs button.on { border-color: var(--sky); color: var(--sky); }

  .script { padding: 4px 2px; }
  .script :global(.line:last-child) { border-bottom: none; }
  .empty { text-align: center; padding: 26px 16px; margin: 0 auto; }

  .more { display: block; margin: 14px auto 0; }
  .next { display: flex; justify-content: center; margin-top: 28px; }
</style>
