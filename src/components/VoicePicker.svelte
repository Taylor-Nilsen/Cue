<script>
  import { FEMALE_VOICES, MALE_VOICES, voiceNote } from '../lib/voices.js';

  export let value;
  export let label = 'Voice';
  export let onChange = () => {};
</script>

<label class="picker">
  <span class="sr-only">{label}</span>
  <select {value} on:change={(e) => onChange(e.currentTarget.value)}>
    <optgroup label="Women's voices">
      {#each FEMALE_VOICES as v}
        <option value={v.id}>{v.label} — {v.note}</option>
      {/each}
    </optgroup>
    <optgroup label="Men's voices">
      {#each MALE_VOICES as v}
        <option value={v.id}>{v.label} — {v.note}</option>
      {/each}
    </optgroup>
  </select>
</label>
{#if voiceNote(value)}<span class="sr-only">{voiceNote(value)}</span>{/if}

<style>
  .picker select { max-width: 100%; }
</style>
