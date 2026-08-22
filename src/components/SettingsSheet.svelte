<script>
  import { createEventDispatcher } from 'svelte';
  import { session, updateCharacter } from '../lib/session.js';
  import { serialize, suggestedFilename } from '../lib/cuefile.js';
  import { voiceLabel } from '../lib/voices.js';

  export let onChange = () => {};
  const dispatch = createEventDispatcher();

  $: settings = $session.settings;

  function download() {
    const text = serialize($session);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename($session.title);
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="scrim" on:click={() => dispatch('close')}></div>

<aside class="sheet" role="dialog" aria-label="Settings">
  <div class="handle" aria-hidden="true"></div>
  <h3>Dialing it in</h3>

  <label class="field">
    <span>Pause between lines</span>
    <input
      type="range" min="0" max="3000" step="100" value={settings.lineDelayMs}
      on:input={(e) => onChange({ lineDelayMs: +e.currentTarget.value })}
    />
    <output>{(settings.lineDelayMs / 1000).toFixed(1)}s</output>
  </label>

  <label class="toggle">
    <input
      type="checkbox" checked={settings.readStageDirections}
      on:change={(e) => onChange({ readStageDirections: e.currentTarget.checked })}
    />
    <span>Read stage direction aloud</span>
  </label>

  <h4>Speaking speed</h4>
  <p class="muted note">Maybe the villain talks fast. Maybe your scene partner needs a beat longer.</p>
  <div class="speeds">
    {#each $session.characters as c (c.name)}
      <label class="field">
        <span class="who">{c.name}<em>{voiceLabel(c.voice)}</em></span>
        <input
          type="range" min="0.5" max="2" step="0.1" value={c.speed}
          on:input={(e) => updateCharacter(c.name, { speed: +e.currentTarget.value })}
        />
        <output>{Number(c.speed).toFixed(1)}×</output>
      </label>
    {/each}
  </div>

  <div class="save">
    <button class="btn sky" on:click={download}>Save this rehearsal</button>
    <p class="muted note">
      One small text file with the script, the cast, the colours, and everything above. Drop it
      back in next time and you're straight into the reading screen.
    </p>
  </div>

  <button class="btn ghost close" on:click={() => dispatch('close')}>Done</button>
</aside>

<style>
  .scrim {
    position: fixed; inset: 0;
    background: rgba(20, 12, 34, 0.45);
    z-index: 10;
  }
  .sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    max-height: 86vh;
    overflow-y: auto;
    z-index: 11;
    background: var(--paper-raised);
    border-radius: 26px 26px 0 0;
    border-top: 2px solid var(--line);
    padding: 10px 20px calc(24px + env(safe-area-inset-bottom));
    box-shadow: var(--shadow);
  }
  @media (min-width: 720px) {
    .sheet { left: 50%; transform: translateX(-50%); width: 560px; border-radius: 26px 26px 0 0; }
  }
  .handle { width: 42px; height: 5px; border-radius: 999px; background: var(--line); margin: 2px auto 14px; }
  h3 { font-size: 1.35rem; margin-bottom: 14px; }
  h4 { font-size: 1rem; margin: 22px 0 2px; }
  .note { font-size: 0.85rem; margin: 0 0 10px; }

  .field { display: grid; grid-template-columns: 1fr 140px auto; gap: 12px; align-items: center; margin: 12px 0; }
  .field span { font-size: 0.92rem; }
  .field output { font-variant-numeric: tabular-nums; font-size: 0.88rem; color: var(--muted); min-width: 3ch; }
  .who { display: flex; flex-direction: column; font-weight: 700; }
  .who em { font-style: normal; font-weight: 400; font-size: 0.78rem; color: var(--muted); }

  .toggle { display: flex; align-items: center; gap: 10px; margin: 14px 0; cursor: pointer; }
  .toggle input { width: 20px; height: 20px; accent-color: var(--sky); }

  .save { border-top: 1px solid var(--line); margin-top: 22px; padding-top: 18px; }
  .close { display: block; width: 100%; margin-top: 18px; }

  @media (max-width: 520px) {
    .field { grid-template-columns: 1fr auto; }
    .field input[type='range'] { grid-column: 1 / -1; }
  }
</style>
