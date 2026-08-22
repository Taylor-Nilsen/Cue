<script>
  import { stage } from './lib/stage.js';
  import Curtain from './components/Curtain.svelte';
  import Upload from './components/Upload.svelte';
  import Working from './components/Working.svelte';
  import Review from './components/Review.svelte';
  import Casting from './components/Casting.svelte';
</script>

<main class="wrap">
  <Curtain compact={$stage !== 'upload'} />

  {#if $stage === 'upload'}
    <Upload />
  {:else if $stage === 'processing'}
    <Working />
  {:else if $stage === 'review'}
    <Review />
  {:else if $stage === 'casting'}
    <Casting />
  {/if}
</main>
