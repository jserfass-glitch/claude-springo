// Springo sync. One endpoint. Marks are append-only facts, so the merge has no
// conflict to resolve and this stays about sixty lines of logic.
//
// Storage is Netlify Blobs. Needs @netlify/blobs (root package.json) and a
// linked Netlify site; until both exist the app probes this, gets a non-200,
// and runs local-only. See app/README.md.

import { getStore } from '@netlify/blobs';

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
const bad = (status, msg) => new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS });

const MAX_EVENTS = 500;      // a 24 square board for six players cannot exceed this
const MAX_BODY = 256 * 1024;

export default async (req) => {
  if (req.method === 'GET') return ok({ ping: 'springo', serverTime: Date.now() });
  if (req.method !== 'POST') return bad(405, 'POST only');

  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return bad(413, 'too large');
    body = JSON.parse(text);
  } catch { return bad(400, 'bad json'); }

  const store = getStore('springo');
  const now = Date.now();

  if (body.op === 'create') {
    const g = body.game;
    if (!g?.id || !g?.code) return bad(400, 'game needs id and code');
    // the code is the only thing a joiner types, so it is the index
    await store.setJSON('code:' + g.code, { gameId: g.id });
    await store.setJSON('game:' + g.id, {
      ...stripGame(g), events: [], cursor: 0, createdAt: now,
    });
    return ok({ ok: true, serverTime: now, anchor: 'a' + now });
  }

  if (body.op === 'join') {
    const ref = await store.get('code:' + String(body.code || ''), { type: 'json' });
    if (!ref) return bad(404, 'no such code');
    const rec = await store.get('game:' + ref.gameId, { type: 'json' });
    if (!rec) return bad(404, 'no such game');
    const { events, ...game } = rec;
    return ok({ game, serverTime: now, anchor: 'a' + now });
  }

  if (body.op === 'sync') {
    const key = 'game:' + body.gameId;
    const rec = await store.get(key, { type: 'json' });
    if (!rec) return bad(404, 'no such game');

    let dirty = false;
    for (const ev of (body.events || []).slice(0, MAX_EVENTS)) {
      if (ev.type === 'mark' && ev.mark?.id) {
        const i = rec.events.findIndex(e => e.type === 'mark' && e.mark.id === ev.mark.id);
        // clamp the client stamp into [created, now]; see docs/05-architecture.md
        const ts = Math.min(Math.max(Number(ev.mark.ts) || now, rec.createdAt), now);
        const mark = { ...ev.mark, effectiveTs: ts, clamped: ts !== ev.mark.ts };
        if (i === -1) rec.events.push({ type: 'mark', seq: ++rec.cursor, mark });
        else rec.events[i] = { ...rec.events[i], mark };   // an undo tombstone
        dirty = true;
      }
      if (ev.type === 'win' && ev.win) {
        rec.wins = rec.wins || [];
        if (!rec.wins.some(w => w.playerId === ev.win.playerId)) { rec.wins.push(ev.win); dirty = true; }
      }
      if (ev.type === 'player' && ev.player?.id) {
        rec.players = rec.players || [];
        if (!rec.players.some(p => p.id === ev.player.id)) { rec.players.push(ev.player); dirty = true; }
      }
    }
    if (rec.events.length > MAX_EVENTS * 4) rec.events = rec.events.slice(-MAX_EVENTS * 4);
    if (dirty) await store.setJSON(key, rec);

    const since = Number(body.since) || 0;
    const fresh = rec.events.filter(e => (e.seq || 0) > since);
    const { events, ...game } = rec;
    return ok({ events: fresh, cursor: rec.cursor, game, serverTime: now, anchor: 'a' + now });
  }

  return bad(400, 'unknown op');
};

/** Never store a photo here. Photos stay on the device that took them until
 *  there is real object storage behind this. */
function stripGame(g) {
  const { id, code, packId, accent, mode, varied, freeSpace, seed, hostId, players, createdAt } = g;
  return { id, code, packId, accent, mode, varied, freeSpace, seed, hostId, players, createdAt, wins: [] };
}

export const config = { path: '/api/springo' };
