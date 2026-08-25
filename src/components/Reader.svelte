<script>
  import { onMount, onDestroy } from 'svelte';
  import { session, cast, updateSettings } from '../lib/session.js';
  import { stage } from '../lib/stage.js';
  import { speak, stop, prefetch, unlockAudio, voiceEngine } from '../lib/tts.js';
  import { isSpoken, isYours, yoursIn, voiceFor, nextIndex, sceneAt, positionOf } from '../lib/reader.js';
  import { speakersOf } from '../lib/speakers.js';
  import { keepAwake, releaseWake } from '../lib/wakelock.js';
  import ReaderControls from './ReaderControls.svelte';
  import SettingsSheet from './SettingsSheet.svelte';

  let index = 0;
  let playing = false;
  let waiting = false;
  let showSettings = false;
  // Bumped on every jump so a line that finishes speaking after you've moved
  // on can't drag the reader back to where it was.
  let run = 0;

  $: lines = $session.lines;
  $: settings = $session.settings;
  $: characters = $session.characters;
  $: current = lines[index];
  $: previous = lines[nextIndex(lines, index, settings, -1)];
  $: following = lines[nextIndex(lines, index, settings, 1)];
  $: scene = sceneAt(lines, index);
  $: yoursNow = current ? isYours(current, characters) : false;
  $: mine = current ? yoursIn(current, characters)[0] : null;
  $: atEnd = index >= lines.length;
  $: position = positionOf(lines, index, settings);

  onMount(() => {
    // Land on the first line worth showing rather than a scene heading.
    if (lines[0] && !isSpoken(lines[0], settings)) index = nextIndex(lines, 0, settings);
    keepAwake();
  });
  onDestroy(() => {
    stop();
    releaseWake();
  });

  async function loop() {
    const token = ++run;
    while (playing && index < lines.length) {
      const line = lines[index];

      if (!isSpoken(line, settings)) {
        index = nextIndex(lines, index, settings);
        continue;
      }
      if (isYours(line, characters)) {
        waiting = true;
        return;
      }

      const { voice, speed } = voiceFor(line, $cast);
      // Get the next line rendering while this one plays, so the gap between
      // speakers is the pause you set, not the model thinking.
      const upcoming = lines[nextIndex(lines, index, settings)];
      if (upcoming && !isYours(upcoming, characters)) {
        const next = voiceFor(upcoming, $cast);
        prefetch(upcoming.text, next.voice, next.speed);
      }

      await speak(line.text, voice, speed);
      if (token !== run || !playing) return;

      if (settings.lineDelayMs > 0) {
        await new Promise((r) => setTimeout(r, settings.lineDelayMs));
        if (token !== run || !playing) return;
      }
      index = nextIndex(lines, index, settings);
    }
    playing = false;
  }

  function play() {
    unlockAudio();
    if (atEnd) index = 0;
    playing = true;
    waiting = false;
    loop();
  }

  function pause() {
    playing = false;
    waiting = false;
    run++;
    stop();
  }

  function toggle() {
    playing || waiting ? pause() : play();
  }

  /** You've read your line. Move on. */
  function go() {
    if (!waiting) return;
    waiting = false;
    index = nextIndex(lines, index, settings);
    playing = true;
    loop();
  }

  function step(direction) {
    run++;
    stop();
    waiting = false;
    const target = nextIndex(lines, index, settings, direction);
    index = Math.max(0, Math.min(lines.length - 1, target));
    if (playing) loop();
  }

  function onStageTap(event) {
    // Tapping the script itself is the same as pressing Go — one big target.
    if (waiting && !event.target.closest('button, select, input, a')) go();
  }

  function onKey(event) {
    if (event.target.matches('input, select, textarea')) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      waiting ? go() : toggle();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    }
  }

  function colourOf(line) {
    if (!line) return null;
    return characters.find((c) => c.isYou && speakersOf(line).includes(c.name))?.color ?? null;
  }
</script>

<svelte:window on:keydown={onKey} />

<section class="reader">
  <div class="top">
    <span class="scene">{scene || $session.title}</span>
    <button class="settings-btn" on:click={() => (showSettings = true)} aria-label="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M4 7h10M18 7h2M4 17h2M8 17h12" /><circle cx="16" cy="7" r="2.4" /><circle cx="6" cy="17" r="2.4" />
      </svg>
    </button>
  </div>

  <div class="progress"><div class="fill" style:width="{position * 100}%"></div></div>

  {#if $voiceEngine.status === 'loading'}
    <p class="loading muted">{$voiceEngine.message}</p>
  {:else if $voiceEngine.status === 'fallback'}
    <p class="loading warn">{$voiceEngine.message}</p>
  {/if}

  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div class="script" on:click={onStageTap}>
    {#if atEnd}
      <div class="done">
        <span class="scribble">that's the end of it ✂︎</span>
        <p class="muted">Run it again, or go back and change anything you'd like.</p>
      </div>
    {:else}
      {#if previous}
        <div class="mline faded" class:stagedir={previous.type === 'stage'}>
          <span class="tag" style:background={colourOf(previous) ?? (previous.type === 'stage' ? 'var(--grass)' : 'var(--sky)')}>
            {previous.type === 'dialogue' ? previous.speaker : previous.type}
          </span>
          <p>{previous.text}</p>
        </div>
      {/if}

      {#if current}
        <div class="mline now" class:stagedir={current.type === 'stage'} class:yours={yoursNow}
             style:--mine={mine?.color ?? 'var(--pink)'}>
          <span class="tag" style:background={yoursNow ? 'var(--mine)' : current.type === 'stage' ? 'var(--grass)' : 'var(--sky)'}>
            {current.type === 'dialogue' ? current.speaker : current.type}
          </span>
          <p>{current.text}</p>
        </div>
      {/if}

      {#if waiting}
        <div class="go-row" style:--mine={mine?.color ?? 'var(--pink)'}>
          <button class="go-btn" on:click={go}>Go</button>
          <span>
            waiting for you to read
            {#if speakersOf(current).length > 1}
              <strong>{mine?.name ?? current.speaker}</strong> — with {speakersOf(current).filter((n) => n !== mine?.name).join(', ')}
            {:else if characters.filter((c) => c.isYou).length > 1}
              <strong>{current.speaker}</strong>
            {:else}this line{/if}
          </span>
        </div>
      {/if}

      {#if following}
        <div class="mline faded" class:stagedir={following.type === 'stage'}>
          <span class="tag" style:background={colourOf(following) ?? (following.type === 'stage' ? 'var(--grass)' : 'var(--sky)')}>
            {following.type === 'dialogue' ? following.speaker : following.type}
          </span>
          <p>{following.text}</p>
        </div>
      {/if}
    {/if}
  </div>
</section>

<ReaderControls
  {playing}
  {waiting}
  onPlay={toggle}
  onBack={() => step(-1)}
  onForward={() => step(1)}
  onExit={() => { pause(); stage.set('casting'); }}
/>

{#if showSettings}
  <SettingsSheet on:close={() => (showSettings = false)} onChange={(patch) => updateSettings(patch)} />
{/if}

<style>
  .reader { margin-top: 22px; padding-bottom: 90px; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .scene {
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .settings-btn {
    background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px;
  }
  .settings-btn svg { width: 22px; height: 22px; }

  .progress { height: 5px; border-radius: 999px; background: var(--line); margin: 8px 0 4px; overflow: hidden; }
  .progress .fill { height: 100%; background: var(--sky); transition: width 0.3s ease; }

  .loading { font-size: 0.82rem; margin: 8px 0 0; }
  .warn { color: var(--coral); font-weight: 700; }

  .script {
    background: var(--paper-raised);
    border: 2px solid var(--line);
    border-radius: 22px;
    box-shadow: var(--shadow);
    padding: 18px 16px;
    margin-top: 12px;
    min-height: 46vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .mline { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 14px; }
  .mline p { margin: 2px 0 0; font-size: 1.05rem; }
  .mline.faded { opacity: 0.45; }
  .mline.faded p { font-size: 0.95rem; }
  .mline.now { background: color-mix(in srgb, var(--sunny) 14%, transparent); }
  .mline.now p { font-size: 1.25rem; }
  .mline.now.yours p { color: var(--mine); font-weight: 700; }
  .mline.stagedir p { font-style: italic; color: var(--muted); }
  .tag {
    font-weight: 700;
    font-size: 0.7rem;
    padding: 3px 10px;
    border-radius: 999px;
    color: #fff;
    flex: none;
    margin-top: 4px;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .go-row { display: flex; align-items: center; gap: 12px; margin: 4px 0 6px 12px; flex-wrap: wrap; }
  .go-btn {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    background: var(--mine);
    color: #fff;
    border: none;
    padding: 9px 30px;
    border-radius: 999px;
    font-size: 1rem;
    cursor: pointer;
  }
  .go-row span { font-size: 0.85rem; color: var(--muted); }

  .done { text-align: center; padding: 30px 10px; }
  .done .scribble { font-size: 1.5rem; display: block; margin-bottom: 6px; }
  .done p { margin: 0 auto; }
</style>
