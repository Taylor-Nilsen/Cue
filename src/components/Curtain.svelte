<!-- The front-of-house screen: the first thing you see when you open Cue. -->
<script>
  export let compact = false;
</script>

<header class="hero" class:compact>
  <div class="hero-inner">
    <h1>Cue</h1>
    {#if !compact}
      <p class="tagline">
        Upload a script, cast it with real-sounding voices, and run your lines out loud —
        right in the browser, no app store, no install.
      </p>
    {/if}

    <svg class="stage" viewBox="0 0 560 220" role="img"
         aria-label="A little stage with curtains, a spotlight, and two character masks">
      <ellipse cx="280" cy="150" rx="220" ry="26" fill="rgba(0,0,0,0.12)" />
      <polygon points="280,10 200,150 360,150" fill="#FFE9A8" opacity="0.55" />
      <circle cx="280" cy="18" r="22" fill="#FFE9A8" />
      <rect x="30" y="20" width="60" height="150" rx="26" fill="#E5503C" />
      <rect x="470" y="20" width="60" height="150" rx="26" fill="#E5503C" />
      <g fill="#C43F2E">
        <circle cx="45" cy="30" r="16" /><circle cx="60" cy="26" r="16" /><circle cx="75" cy="30" r="16" />
        <circle cx="485" cy="30" r="16" /><circle cx="500" cy="26" r="16" /><circle cx="515" cy="30" r="16" />
      </g>
      <rect x="60" y="150" width="440" height="18" rx="9" fill="#2AA9C7" />
      <g>
        <circle cx="235" cy="118" r="34" fill="#FFC94A" />
        <circle cx="223" cy="112" r="5" fill="#2B2140" /><circle cx="247" cy="112" r="5" fill="#2B2140" />
        <path d="M220 130 Q235 140 250 130" stroke="#2B2140" stroke-width="4" fill="none" stroke-linecap="round" />
        <circle cx="325" cy="118" r="34" fill="#E85D8C" />
        <circle cx="313" cy="112" r="5" fill="#2B2140" /><circle cx="337" cy="112" r="5" fill="#2B2140" />
        <path d="M312 133 Q325 124 338 133" stroke="#2B2140" stroke-width="4" fill="none" stroke-linecap="round" />
      </g>
      <g fill="#fff" opacity="0.85">
        <path d="M405 55 l4 10 10 4 -10 4 -4 10 -4-10 -10-4 10-4z" />
        <path d="M130 70 l3 7 7 3 -7 3 -3 7 -3-7 -7-3 7-3z" />
      </g>
    </svg>

    {#if !compact}
      <div class="pill-row">
        <span class="pill">works on your phone &amp; your laptop</span>
        <span class="pill">no accounts, no server</span>
        <span class="pill">real human-sounding voices</span>
      </div>
    {/if}
  </div>
</header>

<style>
  .hero {
    background: var(--coral);
    border-radius: 32px;
    padding: 10px;
    margin-top: 10px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .hero-inner {
    border-radius: 26px;
    padding: 34px 30px 26px;
    background: radial-gradient(120% 140% at 15% 0%, rgba(255, 255, 255, 0.16), transparent 60%);
    color: #fff;
    text-align: center;
  }
  .hero-inner h1 {
    font-size: clamp(3rem, 9vw, 4.6rem);
    margin-bottom: 0.05em;
    color: #fff;
  }
  .compact .hero-inner { padding: 14px 20px 8px; }
  .compact .hero-inner h1 { font-size: 2rem; margin-bottom: 0; }
  .compact .stage { max-width: 180px; margin: 2px auto 0; }
  .tagline {
    font-size: 1.15rem;
    max-width: 44ch;
    margin: 0 auto 6px;
    color: #fff3ea;
  }
  .stage { display: block; margin: 14px auto 4px; max-width: 520px; width: 100%; height: auto; }
  .pill-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
  .pill {
    font-weight: 700;
    font-size: 0.78rem;
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.35);
  }
</style>
