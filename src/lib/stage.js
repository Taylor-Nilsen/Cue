import { writable } from 'svelte/store';

/**
 * Which screen we're on. Cue is linear by design — upload, then a look-over,
 * then casting, then the reading screen — so a single store beats a router.
 * @type {import('svelte/store').Writable<'upload'|'processing'|'review'|'casting'|'reader'>}
 */
export const stage = writable('upload');

/** Progress for the long jobs (OCR, voice pack download). */
export const progress = writable({ active: false, message: '', current: 0, total: 0 });

export function setProgress(message, current = 0, total = 0) {
  progress.set({ active: true, message, current, total });
}
export function clearProgress() {
  progress.set({ active: false, message: '', current: 0, total: 0 });
}
