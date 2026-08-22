/**
 * Nothing is worse than your phone dozing off mid-scene. Held for as long as
 * the reading screen is up, and re-taken when you come back from another app —
 * the browser drops the lock on its own when the page is hidden.
 */
let lock = null;

export async function keepAwake() {
  if (!('wakeLock' in navigator)) return false;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
    document.addEventListener('visibilitychange', reacquire);
    return true;
  } catch {
    // Denied, or the battery is too low for the browser's liking. Not fatal.
    return false;
  }
}

async function reacquire() {
  if (document.visibilityState === 'visible' && !lock) await keepAwake();
}

export function releaseWake() {
  document.removeEventListener('visibilitychange', reacquire);
  lock?.release().catch(() => {});
  lock = null;
}
