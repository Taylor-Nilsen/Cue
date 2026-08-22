/**
 * A crash, a phone call, or an accidental refresh shouldn't cost you the
 * ten minutes it took to read a scanned script. The whole session is written
 * to IndexedDB as the same .cue.md text the download produces — one format,
 * one code path, nothing extra to keep in sync.
 */

const DB_NAME = 'cue';
const STORE = 'session';
const KEY = 'latest';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    // Private browsing, a full disk, storage switched off — autosave is a
    // convenience, and losing it must never take the rehearsal down with it.
    console.warn('[cue] autosave unavailable', err);
    return null;
  }
}

export function saveDraft(text, title) {
  return withStore('readwrite', (store) =>
    store.put({ text, title, savedAt: Date.now() }, KEY),
  );
}

export function loadDraft() {
  return withStore('readonly', (store) => store.get(KEY));
}

export function clearDraft() {
  return withStore('readwrite', (store) => store.delete(KEY));
}
