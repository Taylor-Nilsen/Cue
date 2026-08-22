<script>
  import { session, updateCharacter, recast, YOU_COLORS } from '../lib/session.js';
  import { stage } from '../lib/stage.js';
  import { NARRATOR_VOICE, voiceLabel } from '../lib/voices.js';
  import { sampleLine } from '../lib/sample.js';
  import { speak, stop, voiceEngine, unlockAudio } from '../lib/tts.js';
  import VoicePicker from './VoicePicker.svelte';

  let playing = null;

  $: characters = $session.characters;
  $: unresolved = characters.filter((c) => c.gender === 'unknown');
  $: youCount = characters.filter((c) => c.isYou).length;

  async function listen(character) {
    unlockAudio();
    if (playing === character.name) {
      stop();
      playing = null;
      return;
    }
    const line = sampleLine(character.name, $session.lines) || `Hello. I'll be reading ${character.name}.`;
    playing = character.name;
    await speak(line, character.voice, character.speed ?? 1);
    if (playing === character.name) playing = null;
  }

  async function listenNarrator() {
    unlockAudio();
    const line =
      $session.lines.find((l) => l.type === 'stage')?.text ?? 'The lights come up on an empty stage.';
    playing = '__stage';
    await speak(line, NARRATOR_VOICE, 1);
    if (playing === '__stage') playing = null;
  }

  function answerGender(character, gender) {
    updateCharacter(character.name, { gender });
    // Recast from scratch so the voice order still reads first-appearance,
    // rather than leaving this one character holding a voice from the wrong pool.
    recast();
  }
</script>

<section class="casting">
  <span class="kicker">who sounds like who</span>
  <h2>Casting the room</h2>
  <p class="muted intro">
    Everyone already has a voice. Give them a listen, swap anyone you'd like, and tick whoever
    you're reading.
  </p>

  {#if $voiceEngine.status === 'loading'}
    <div class="callout">
      <span class="kicker">one-time download</span>
      <p>{$voiceEngine.message} Once it's here it stays here, and Cue works with no signal at all.</p>
    </div>
  {:else if $voiceEngine.status === 'fallback'}
    <div class="callout warn">
      <span class="kicker">heads up</span>
      <p>{$voiceEngine.message}</p>
    </div>
  {/if}

  {#if unresolved.length}
    <div class="callout ask">
      <span class="kicker">one quick thing</span>
      <p>Cue can't tell which voice these should get. Rather than guess:</p>
      {#each unresolved as c (c.name)}
        <div class="ask-row">
          <strong>{c.name}</strong>
          <div class="ask-buttons">
            <button class="btn ghost small" on:click={() => answerGender(c, 'female')}>a woman's voice</button>
            <button class="btn ghost small" on:click={() => answerGender(c, 'male')}>a man's voice</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="rows">
    {#each characters as c, i (c.name)}
      <div class="row" class:you={c.isYou} style:--mine={c.color}>
        <span class="order">{i + 1}</span>

        <div class="who">
          <span class="name">{c.name}</span>
          <span class="lines muted">{c.lineCount} {c.lineCount === 1 ? 'line' : 'lines'}</span>
        </div>

        <div class="voice">
          <button
            class="listen"
            class:on={playing === c.name}
            on:click={() => listen(c)}
            aria-label="Listen to {c.name}"
          >
            {playing === c.name ? '■' : '▶'}
          </button>
          <VoicePicker
            value={c.voice}
            label="Voice for {c.name}"
            onChange={(v) => updateCharacter(c.name, { voice: v })}
          />
        </div>

        <label class="mine">
          <input type="checkbox" checked={c.isYou} on:change={(e) => updateCharacter(c.name, { isYou: e.currentTarget.checked })} />
          <span>this one's me</span>
        </label>

        {#if c.isYou}
          <div class="swatches" role="group" aria-label="Colour for {c.name}">
            {#each YOU_COLORS as colour}
              <button
                class="swatch"
                class:picked={c.color === colour}
                style:background={colour}
                aria-label="Use this colour"
                aria-pressed={c.color === colour}
                on:click={() => updateCharacter(c.name, { color: colour })}
              ></button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <div class="row narrator">
      <span class="order">✦</span>
      <div class="who">
        <span class="name">Stage direction</span>
        <span class="lines muted">its own voice, never a character's</span>
      </div>
      <div class="voice">
        <button class="listen" class:on={playing === '__stage'} on:click={listenNarrator} aria-label="Listen to the narrator">
          {playing === '__stage' ? '■' : '▶'}
        </button>
        <span class="fixed muted">{voiceLabel(NARRATOR_VOICE)}</span>
      </div>
    </div>
  </div>

  <div class="next">
    <button class="btn ghost" on:click={() => stage.set('review')}>← back to the look-over</button>
    <button class="btn" disabled={!youCount} on:click={() => stage.set('reader')}>
      {youCount ? 'Run my lines →' : 'Tick who you are first'}
    </button>
  </div>
</section>

<style>
  .casting { margin-top: 26px; }
  h2 { font-size: 1.9rem; }
  .intro { margin-top: 0; }
  .warn { border-color: var(--coral); background: color-mix(in srgb, var(--coral) 12%, var(--paper-raised)); }
  .warn .kicker { color: var(--coral); }

  .ask-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 8px; }
  .ask-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

  .rows { display: flex; flex-direction: column; gap: 10px; margin: 20px 0; }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 8px 14px;
    align-items: center;
    background: var(--paper-raised);
    border: 2px solid var(--line);
    border-radius: 16px;
    padding: 12px 16px;
  }
  .row.you { border-color: var(--mine); }
  .order {
    font-family: 'Fredoka', sans-serif;
    color: #fff;
    background: var(--sky);
    width: 30px; height: 30px;
    border-radius: 50%;
    display: grid; place-items: center;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .row.you .order { background: var(--mine); }
  .narrator .order { background: var(--grass); }

  .who { display: flex; flex-direction: column; min-width: 0; }
  .name { font-weight: 700; overflow-wrap: anywhere; }
  .lines { font-size: 0.8rem; }

  .voice { display: flex; align-items: center; gap: 8px; }
  .listen {
    width: 34px; height: 34px;
    border-radius: 50%;
    border: 2px solid var(--sky);
    background: transparent;
    color: var(--sky);
    cursor: pointer;
    font-size: 0.8rem;
    line-height: 1;
    flex: none;
  }
  .listen.on { background: var(--sky); color: #fff; }
  .fixed { font-size: 0.85rem; }

  .mine { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; white-space: nowrap; cursor: pointer; }
  .mine input { accent-color: var(--mine, var(--pink)); width: 18px; height: 18px; }

  .swatches { grid-column: 1 / -1; display: flex; gap: 8px; }
  .swatch {
    width: 26px; height: 26px;
    border-radius: 50%;
    border: 3px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .swatch.picked { border-color: var(--ink); }

  .next { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-top: 28px; }

  @media (max-width: 620px) {
    .row { grid-template-columns: auto 1fr; }
    .voice, .mine { grid-column: 1 / -1; }
  }
</style>
