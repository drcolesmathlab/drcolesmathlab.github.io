/* Service worker: precaches every asset so Tiger Trail runs fully offline once
   loaded, and so it keeps working if this page is opened with no connection.

   The cache name below is GENERATED from a hash of everything in this folder by
   tools/apply-site-chrome.js. Do not hand-edit it and do not replace it with a
   literal — deriving it is what makes it impossible to ship a payload change that
   leaves previous visitors stuck on a stale cached build.

   Scope note: a worker's maximum scope is its own directory, so this one can only
   ever control /apps/tiger-trail/. It cannot cache or shadow the rest of the site. */
/* CACHE NAME:START */
const CACHE = 'tiger-trail-a7fdf238de';
/* CACHE NAME:END */

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './lib/three.min.js',
  './src/storage.js',
  './src/audio.js',
  './src/mathgen.js',
  './src/tiger.js',
  './src/world.js',
  './src/game.js',
  './src/ui.js',
  './src/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // cache same-origin GETs as they're fetched (defensive; ASSETS covers the core)
      if (res.ok && new URL(e.request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
