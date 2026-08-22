<script>
  import { session, renameCharacter, mergeCharacters } from '../lib/session.js';

  $: characters = $session.characters;

  let mergeFrom = '';
  let mergeInto = '';

  function doMerge() {
    if (!mergeFrom || !mergeInto || mergeFrom === mergeInto) return;
    mergeCharacters(mergeFrom, mergeInto);
    mergeFrom = '';
    mergeInto = '';
  }
</script>

<div class="cast card">
  <span class="kicker">who Cue found</span>
  <h3>{characters.length} {characters.length === 1 ? 'character' : 'characters'}</h3>

  <ul>
    {#each characters as c (c.name)}
      <li>
        <input
          type="text"
          value={c.name}
          aria-label="Character name"
          on:change={(e) => renameCharacter(c.name, e.currentTarget.value)}
        />
        <span class="count muted">{c.lineCount} {c.lineCount === 1 ? 'line' : 'lines'}</span>
      </li>
    {/each}
  </ul>

  <details>
    <summary>Same person under two names?</summary>
    <p class="muted">
      A scan will happily give you both <em>HAMLET</em> and <em>Hamlet (O.S.)</em>. Fold one into
      the other and every line follows.
    </p>
    <div class="merge">
      <select bind:value={mergeFrom} aria-label="Character to fold in">
        <option value="">Fold this one…</option>
        {#each characters as c}<option value={c.name}>{c.name}</option>{/each}
      </select>
      <span class="muted">into</span>
      <select bind:value={mergeInto} aria-label="Character to keep">
        <option value="">…this one</option>
        {#each characters as c}<option value={c.name}>{c.name}</option>{/each}
      </select>
      <button class="btn small" disabled={!mergeFrom || !mergeInto || mergeFrom === mergeInto} on:click={doMerge}>
        Merge
      </button>
    </div>
  </details>
</div>

<style>
  .cast { margin: 18px 0; }
  h3 { margin: 0 0 12px; font-size: 1.2rem; }
  ul { list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 8px; }
  li { display: flex; align-items: center; gap: 10px; }
  li input { flex: 1; min-width: 0; font-weight: 700; }
  .count { font-size: 0.82rem; white-space: nowrap; }
  details { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 12px; }
  summary { cursor: pointer; font-weight: 700; font-size: 0.9rem; color: var(--muted); }
  details p { font-size: 0.9rem; margin: 8px 0 10px; }
  .merge { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
