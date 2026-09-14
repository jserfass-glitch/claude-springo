// Local-first storage. Every screen reads from here; the network only fills
// this and drains the outbox. See docs/05-architecture.md.

const DB_NAME = 'springo';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('marks')) {
        const s = db.createObjectStore('marks', { keyPath: 'id' });
        s.createIndex('gameId', 'gameId');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const meta = {
  async get(k, fallback = null) {
    const db = await open();
    const r = await wrap(db.transaction('meta').objectStore('meta').get(k));
    return r ? r.v : fallback;
  },
  set(k, v) { return tx('meta', 'readwrite', s => s.put({ k, v })); },
};

export const games = {
  async all() { const db = await open(); return wrap(db.transaction('games').objectStore('games').getAll()); },
  async get(id) { const db = await open(); return wrap(db.transaction('games').objectStore('games').get(id)); },
  put(g) { return tx('games', 'readwrite', s => s.put(g)); },
  remove(id) { return tx('games', 'readwrite', s => s.delete(id)); },
};

export const marks = {
  async forGame(gameId) {
    const db = await open();
    return wrap(db.transaction('marks').objectStore('marks').index('gameId').getAll(gameId));
  },
  async all() { const db = await open(); return wrap(db.transaction('marks').objectStore('marks').getAll()); },
  put(m) { return tx('marks', 'readwrite', s => s.put(m)); },
  async putMany(list) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('marks', 'readwrite');
      const s = t.objectStore('marks');
      for (const m of list) s.put(m);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  },
};

export const photos = {
  async get(id) { const db = await open(); return wrap(db.transaction('photos').objectStore('photos').get(id)); },
  put(p) { return tx('photos', 'readwrite', s => s.put(p)); },
  remove(id) { return tx('photos', 'readwrite', s => s.delete(id)); },
};

export const packs = {
  async get(id) { const db = await open(); return wrap(db.transaction('packs').objectStore('packs').get(id)); },
  async all() { const db = await open(); return wrap(db.transaction('packs').objectStore('packs').getAll()); },
  put(p) { return tx('packs', 'readwrite', s => s.put(p)); },
};

/** The outbox is the only thing the network layer drains. Entries are
 *  append-only facts, so a replay is harmless and order does not matter. */
export const outbox = {
  async all() { const db = await open(); return wrap(db.transaction('outbox').objectStore('outbox').getAll()); },
  add(entry) { return tx('outbox', 'readwrite', s => s.put(entry)); },
  remove(id) { return tx('outbox', 'readwrite', s => s.delete(id)); },
  async count() { const db = await open(); return wrap(db.transaction('outbox').objectStore('outbox').count()); },
};

export function uid() {
  // time-ordered so marks sort naturally and ids never collide across devices
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Identity without an account system: a name you pick, kept on the device.
 *  Enough for a game played by people who already know each other. */
export async function me() {
  let m = await meta.get('me');
  if (!m) { m = { id: uid(), name: '' }; await meta.set('me', m); }
  return m;
}
export async function setName(name) {
  const m = await me();
  m.name = name.trim().slice(0, 24);
  await meta.set('me', m);
  return m;
}
