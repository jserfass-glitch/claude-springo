// Springo service worker. The whole point of this file is cold-start offline:
// opening the app in a hollow with no signal has to work, not just keeping it
// open while signal drops.
const VERSION = 'springo-v1';
const SHELL = [
  './', './index.html', './app.css', './app.js', './game.js', './store.js', './sync.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './packs/ozark-fall.json', './packs/ozark-spring.json', './packs/road-trip.json',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // addAll fails the whole install if one entry 404s; take them one at a time
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // never cache sync; a stale board is worse than no board
  if (url.pathname.startsWith('/api/')) return;

  // reference photos and packs: cache first, they are immutable by filename
  if (url.pathname.includes('/packs/')) {
    e.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
        return res;
      } catch { return new Response('', { status: 504 }); }
    })());
    return;
  }

  // shell: network first so a deploy is visible, cache as the offline floor
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
        return res;
      } catch {
        const hit = await caches.match(request) || await caches.match('./index.html');
        return hit || new Response('Offline', { status: 503 });
      }
    })());
  }
});
