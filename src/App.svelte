<script>
  import { stage } from './lib/stage.js';
  import { clearPending } from './lib/pending.js';
  import Curtain from './components/Curtain.svelte';
  import Upload from './components/Upload.svelte';
  import Working from './components/Working.svelte';
  import PageRange from './components/PageRange.svelte';
  import Review from './components/Review.svelte';
  import Casting from './components/Casting.svelte';
  import Reader from './components/Reader.svelte';
</script>

<main class="wrap">
  <!-- The reading screen gives the script the whole page; a logo helps nobody
       who is mid-scene. -->
  {#if $stage !== 'reader'}
    <Curtain compact={$stage !== 'upload'} />
  {/if}

  {#if $stage === 'upload'}
    <Upload />
  {:else if $stage === 'range'}
    <PageRange onCancel={() => { clearPending(); stage.set('upload'); }} />
  {:else if $stage === 'processing'}
    <Working />
  {:else if $stage === 'review'}
    <Review />
  {:else if $stage === 'casting'}
    <Casting />
  {:else if $stage === 'reader'}
    <Reader />
  {/if}
</main>
