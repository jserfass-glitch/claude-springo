// Springo service worker. The whole point of this file is cold-start offline:
// opening the app in a hollow with no signal has to work, not just keeping it
// open while signal drops.
const VERSION = 'springo-v8';
const SHELL = [
  './', './index.html', './app.css', './app.js', './game.js', './store.js', './sync.js',
  './icons.js', './prompt.js', './refphoto.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './fonts/oswald-latin.woff2', './fonts/archivo-latin.woff2',
  './packs/ozark-fall.json', './packs/ozark-spring.json', './packs/road-trip.json',
  './packs/cozy-mystery.json', './packs/twenty-six.json',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // addAll fails the whole install if one entry 404s; take them one at a time.
    // reload skips the HTTP cache, which holds pack files for a week
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
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
        // fetch throws when a host sends no CORS; its opaque copy still caches
        // and renders. An error status must never be cached: an opaque 429
        // looks like a photo and would stay broken until the cache is cleared
        let r = await fetch(u).catch(() => null);
        if (!r) r = await fetch(u, { mode: 'no-cors' }).catch(() => null);
        if (!r || !(r.ok || r.type === 'opaque')) continue;
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

  // a generated pack's reference photos live on iNaturalist or Wikimedia. The
  // warm step already stored them; serve that copy, or the sheet goes blank
  // the first time a player opens a square with no signal
  if (request.destination === 'image' && url.origin !== location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(request.url);
      if (hit) return hit;
      try {
        const res = await fetch(request.url, { mode: 'cors' });
        if (res.ok) (await caches.open(VERSION)).put(request.url, res.clone());
        return res;
      } catch {
        return fetch(request).catch(() => new Response('', { status: 504 }));
      }
    })());
    return;
  }

  // a pack's list changes with a deploy: answer from cache so boot never waits,
  // and refresh the copy behind it so the next launch has the new one
  if (url.pathname.includes('/packs/') && url.pathname.endsWith('.json')) {
    e.respondWith((async () => {
      const hit = await caches.match(request);
      const fresh = fetch(request, { cache: 'no-cache' }).then(async res => {
        if (res.ok) await (await caches.open(VERSION)).put(request, res.clone());
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) || new Response('', { status: 504 });
    })());
    return;
  }

  // reference photos: cache first, a photo is fixed once a pack ships it
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
