<script>
  export let playing = false;
  export let waiting = false;
  export let onPlay = () => {};
  export let onBack = () => {};
  export let onForward = () => {};
  export let onExit = () => {};
</script>

<!-- Big enough to hit with a thumb while you're holding the script in the other hand. -->
<nav class="controls" aria-label="Playback">
  <button class="icon-btn" on:click={onExit} aria-label="Back to casting">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 5 8 12l7 7" />
    </svg>
  </button>

  <button class="icon-btn" on:click={onBack} aria-label="Previous line">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 6 9 12l9 6zM7 6h2v12H7z" /></svg>
  </button>

  <button class="play" class:waiting on:click={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
    {#if playing || waiting}
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z" /></svg>
    {/if}
  </button>

  <button class="icon-btn" on:click={onForward} aria-label="Next line">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l9 6-9 6zM15 6h2v12h-2z" /></svg>
  </button>

  <span class="hint muted">space to go</span>
</nav>

<style>
  .controls {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--paper) 88%, transparent);
    backdrop-filter: blur(10px);
    border-top: 2px solid var(--line);
  }
  .play {
    width: 62px; height: 62px;
    border-radius: 50%;
    border: none;
    background: var(--coral);
    color: #fff;
    display: grid; place-items: center;
    cursor: pointer;
    box-shadow: var(--shadow);
    -webkit-tap-highlight-color: transparent;
  }
  .play svg { width: 28px; height: 28px; }
  .play.waiting { background: var(--sunny); }
  .icon-btn svg { width: 22px; height: 22px; }
  .hint { font-size: 0.72rem; position: absolute; right: 18px; }
  @media (max-width: 620px) { .hint { display: none; } }
</style>
