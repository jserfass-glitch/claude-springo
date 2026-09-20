// Springo service worker. The whole point of this file is cold-start offline:
// opening the app in a hollow with no signal has to work, not just keeping it
// open while signal drops.
const VERSION = 'springo-v6';
const SHELL = [
  './', './index.html', './app.css', './app.js', './game.js', './store.js', './sync.js',
  './icons.js', './prompt.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './packs/ozark-fall.json', './packs/ozark-spring.json', './packs/road-trip.json',
  './packs/cozy-mystery.json',
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

// Warm a pack's reference photos on request. Without this, the detail sheet
// only has a reference for squares you already opened while online, which is
// backwards: the moment you want to check what a Hen of the Woods looks like
// is the moment you are standing in front of one with no bars.
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    let stored = 0, already = 0;
    for (const u of d.urls.slice(0, 200)) {
      try {
        if (await c.match(u)) { already++; continue; }
        let r = await fetch(u).catch(() => null);
        // generated packs point at iNaturalist, which may not send CORS on the
        // image host; an opaque response still caches and still renders
        if (!r || !r.ok) r = await fetch(u, { mode: 'no-cors' }).catch(() => null);
        if (!r) continue;
        await c.put(u, r);
        stored++;
      } catch { /* one missing photo is not worth failing the batch */ }
    }
    for (const client of await self.clients.matchAll()) {
      client.postMessage({ type: 'warmed', stored, already, total: d.urls.length });
    }
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // a synced photo is immutable by mark id, so it is worth keeping; everything
  // else under /api/ is live state and a stale board is worse than no board
  if (url.pathname === '/api/springo/photo') {
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
