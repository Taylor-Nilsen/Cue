<script>
  import { progress } from '../lib/stage.js';
  $: pct = $progress.total ? Math.round(($progress.current / $progress.total) * 100) : null;
</script>

<div class="working card">
  <div class="spinner" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
  <h3>{$progress.message || 'Working…'}</h3>
  {#if pct !== null}
    <div class="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
      <div class="fill" style:width="{pct}%"></div>
    </div>
    <p class="muted note">A rough scan takes real work to get through — this only happens once.</p>
  {/if}
</div>

<style>
  .working { text-align: center; margin-top: 28px; }
  h3 { margin: 12px 0 14px; font-size: 1.15rem; }
  .bar {
    height: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sky) 18%, var(--paper));
    overflow: hidden;
  }
  .fill { height: 100%; background: var(--sky); border-radius: 999px; transition: width 0.25s ease; }
  .note { font-size: 0.85rem; margin: 10px auto 0; }
  .spinner { display: flex; gap: 6px; justify-content: center; }
  .spinner span {
    width: 12px; height: 12px; border-radius: 50%; background: var(--coral);
    animation: bounce 0.9s infinite ease-in-out;
  }
  .spinner span:nth-child(2) { background: var(--sunny); animation-delay: 0.15s; }
  .spinner span:nth-child(3) { background: var(--sky); animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
    40% { transform: translateY(-8px); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner span { animation: none; }
  }
</style>
