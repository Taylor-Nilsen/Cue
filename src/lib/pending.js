import { writable } from 'svelte/store';

/**
 * The PDF that's been opened but not yet read.
 *
 * Between dropping a file and reading it there's a question to answer — which
 * pages are actually the script — so the opened document has to live
 * somewhere while it's asked. Opening it twice would mean parsing a 12 MB
 * scan twice for no reason.
 *
 * @type {import('svelte/store').Writable<{file: File, pdf: any, pages: number}|null>}
 */
export const pending = writable(null);

export async function clearPending() {
  let current;
  pending.subscribe((v) => (current = v))();
  pending.set(null);
  await current?.pdf?.destroy?.().catch?.(() => {});
}
