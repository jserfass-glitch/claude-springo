// Photo sync. Marks are small and go over /api/springo; photos are binary and
// go here, one at a time, so a slow upload never holds up a mark.
//
// THUMBNAILS ONLY, deliberately. The device that took a photo keeps the 2048px
// original; what crosses the wire is the 400px square the board already uses,
// around 30KB. A full board of 24 is then under a megabyte instead of ten, and
// the one place this app has to work is the place with one bar of signal.
//
// Access is by unguessable id, not by authorization: anyone holding a game id
// and a mark id can read that thumbnail. Both are random and never published,
// which is enough for a game you play with your spouse, and is not enough for
// strangers. Real authorization arrives with real accounts.

import { getStore } from '@netlify/blobs';

const MAX_BYTES = 400 * 1024;          // a 400px JPEG thumb is ~30KB; this is slack, not a target
const KEY = (g, m) => `photo:${g}:${m}`;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const bad = (status, msg) => new Response(JSON.stringify({ error: msg }),
  { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req) => {
  const url = new URL(req.url);
  const g = url.searchParams.get('g') || '';
  const m = url.searchParams.get('m') || '';
  if (!ID.test(g) || !ID.test(m)) return bad(400, 'bad id');

  const store = getStore('springo-photos');

  if (req.method === 'GET') {
    const buf = await store.get(KEY(g, m), { type: 'arrayBuffer' }).catch(() => null);
    if (!buf) return bad(404, 'no photo');
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        // keyed by mark id, so the bytes behind a URL never change
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return bad(413, 'too large');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return bad(400, 'empty');
    if (buf.byteLength > MAX_BYTES) return bad(413, 'too large');
    // a JPEG starts FF D8 FF; this is a sanity check, not a security boundary
    const head = new Uint8Array(buf.slice(0, 3));
    if (head[0] !== 0xFF || head[1] !== 0xD8 || head[2] !== 0xFF) return bad(415, 'jpeg only');

    await store.set(KEY(g, m), buf);
    return new Response(JSON.stringify({ ok: true, bytes: buf.byteLength }),
      { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  return bad(405, 'GET or POST');
};

export const config = { path: '/api/springo/photo' };
