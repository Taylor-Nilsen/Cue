import { get } from 'svelte/store';
import { session } from './session.js';
import { serialize } from './cuefile.js';
import { saveDraft } from './autosave.js';

/**
 * Keep the session on disk as you work. A phone call, a locked screen, or a
 * fat-fingered refresh should never cost you the ten minutes it took to read a
 * scanned script.
 *
 * The draft is written in the same .cue.md format as the download — one
 * format, one code path, nothing extra to keep in sync.
 */
const DEBOUNCE_MS = 1500;

export function startAutosave() {
  let timer = null;

  const unsubscribe = session.subscribe((s) => {
    if (!s.lines.length) return;
    clearTimeout(timer);
    timer = setTimeout(write, DEBOUNCE_MS);
  });

  // A page being closed doesn't wait for a debounce; flush on the way out.
  const flush = () => {
    clearTimeout(timer);
    write();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return () => {
    clearTimeout(timer);
    window.removeEventListener('pagehide', flush);
    unsubscribe();
  };
}

function write() {
  const s = get(session);
  if (!s.lines.length) return;
  try {
    saveDraft(serialize(s), s.title);
  } catch (err) {
    console.warn('[cue] could not autosave', err);
  }
}
