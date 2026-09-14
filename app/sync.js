// Sync. One endpoint, called on foreground, on reconnect, and on pull.
// Marks are append-only, so the merge has no conflict to resolve: two devices
// recording the same mark is the same fact twice.
//
// The app is fully playable with no server. When /api/springo is not deployed
// the driver degrades to local-only and the UI says so, rather than failing.

import { marks, outbox, meta, games } from './store.js';

const ENDPOINT = '/api/springo';
let available = null;          // null = unknown, true/false once probed
let anchor = null;             // bounded-client-time anchor, see game.js

export function getAnchor() { return anchor; }
export function isOnline() { return navigator.onLine && available !== false; }
export function cloudState() { return available; }

async function post(body) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('sync ' + res.status);
  return res.json();
}

/** Probe once. A 404 means the function is not deployed, which is a normal
 *  state for a local checkout, not an error worth showing twice. */
export async function probe() {
  if (available !== null) return available;
  if (!navigator.onLine) return false;
  try {
    const r = await fetch(ENDPOINT + '?ping=1', { method: 'GET' });
    available = r.ok;
  } catch { available = false; }
  return available;
}

export async function pushGame(game) {
  if (!(await probe())) return false;
  try {
    const r = await post({ op: 'create', game });
    if (r.serverTime) anchor = { id: r.anchor || 'a', serverTime: r.serverTime, perfAtSync: performance.now() };
    return true;
  } catch { return false; }
}

export async function joinGame(code) {
  if (!(await probe())) throw new Error('offline');
  const r = await post({ op: 'join', code: code.toUpperCase() });
  if (!r.game) throw new Error('not found');
  return r;
}

/** Drain the outbox and pull anything the other players wrote.
 *  Returns the number of new remote marks applied. */
export async function syncGame(gameId) {
  if (!(await probe())) return 0;
  const pending = (await outbox.all()).filter(e => e.gameId === gameId);
  const since = (await meta.get('cursor:' + gameId)) || 0;
  let r;
  try {
    r = await post({ op: 'sync', gameId, since, events: pending.map(e => e.event) });
  } catch { return 0; }

  if (r.serverTime) anchor = { id: r.anchor || 'a', serverTime: r.serverTime, perfAtSync: performance.now() };
  for (const e of pending) await outbox.remove(e.id);

  const incoming = (r.events || []).filter(e => e.type === 'mark');
  if (incoming.length) await marks.putMany(incoming.map(e => e.mark));
  if (r.game) {
    const local = await games.get(gameId);
    if (local) await games.put({ ...local, players: r.game.players || local.players, winners: r.game.winners || local.winners });
  }
  if (r.cursor != null) await meta.set('cursor:' + gameId, r.cursor);
  return incoming.length;
}

export async function syncAll() {
  const all = await games.all();
  let n = 0;
  for (const g of all) if (g.shared) n += await syncGame(g.id);
  return n;
}
