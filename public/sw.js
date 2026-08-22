/**
 * Offline is not a nice-to-have here. Rehearsal rooms are basements, backstage
 * has no bars, and the car on the way to the theatre drops signal halfway.
 * After one visit, Cue works with nothing at all.
 *
 * The app shell is precached on install because it's small. The heavy things —
 * the OCR language data and the voice pack — are cached the first time they're
 * actually used, so someone who only ever reopens saved files never pays for
 * an OCR engine they don't need.
 */

const SHELL = 'cue-shell-v1';
const RUNTIME = 'cue-runtime-v1';

const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './icons/cue.svg'];

// Model weights and language data are content-addressed and never change under
// the same URL, so once they're cached they're done.
const IMMUTABLE = [/huggingface\.co/, /hf\.co/, /cdn-lfs/, /\/tess\//, /\.wasm$/, /\.onnx$/, /traineddata/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // A navigation should show the app even with no signal at all.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true })),
    );
    return;
  }

  if (IMMUTABLE.some((re) => re.test(url.href))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Range requests and opaque errors aren't worth storing; a partial voice
  // pack that looks cached is worse than no cache at all.
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit ?? network;
}
