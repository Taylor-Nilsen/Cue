<script>
  import { stage } from './lib/stage.js';
  import Curtain from './components/Curtain.svelte';
</script>

<main class="wrap">
  {#if $stage === 'upload'}
    <Curtain />
  {/if}
</main>
