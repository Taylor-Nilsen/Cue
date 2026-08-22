import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/karla/400.css';
import '@fontsource/karla/500.css';
import '@fontsource/karla/700.css';
import '@fontsource/karla/400-italic.css';
import '@fontsource/caveat/700.css';
import './styles/global.css';

import App from './App.svelte';
import { startAutosave } from './lib/persist.js';

startAutosave();

// Registered in production only — a service worker caching a dev server is a
// morning wasted wondering why an edit didn't take.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.warn('[cue] offline support unavailable', err);
    });
  });
}

export default new App({ target: document.getElementById('app') });
