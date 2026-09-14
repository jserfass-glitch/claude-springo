// Springo game rules. Pure functions, no DOM, no network.
// Mirrors docs/02-game-rules.md and docs/06-data-model.md; the same file is
// meant to run unchanged on a server when win arbitration moves there.

export const FREE_IDX = 12;

const ROWS   = [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c));
const COLS   = [0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c));
const DIAGS  = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
const STAMPS = [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]];

export const LINES = [
  ...ROWS.map((cells, i) => ({ kind: 'row', label: `row ${i + 1}`, cells })),
  ...COLS.map((cells, i) => ({ kind: 'col', label: `column ${i + 1}`, cells })),
  ...DIAGS.map((cells, i) => ({ kind: 'diag', label: i ? 'anti-diagonal' : 'diagonal', cells })),
  ...STAMPS.map((cells, i) => ({
    kind: 'stamp',
    label: ['top-left', 'top-right', 'bottom-left', 'bottom-right'][i] + ' stamp',
    cells,
  })),
];

/** xmur3 + mulberry32: small, seedable, and identical on every device, which
 *  is what lets a board be regenerated from (seed, playerId) instead of synced. */
export function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the 24 items a whole game plays with, keeping a rarity spread so a
 *  board is not all-easy (over in an afternoon) or all-hard (never ends). */
export function drawPool(items, seed) {
  const real = items.filter(i => i.key);
  if (real.length <= 24) return real.slice(0, 24);
  const rand = rng(seed + ':pool');
  const byRarity = { easy: [], mid: [], hard: [] };
  for (const i of real) {
    (i.rarity <= 2 ? byRarity.easy : i.rarity >= 4 ? byRarity.hard : byRarity.mid).push(i);
  }
  const take = (bucket, n) => shuffled(bucket, rand).slice(0, n);
  let out = [...take(byRarity.easy, 6), ...take(byRarity.mid, 12), ...take(byRarity.hard, 6)];
  if (out.length < 24) {
    const have = new Set(out.map(i => i.key));
    out = out.concat(shuffled(real.filter(i => !have.has(i.key)), rand).slice(0, 24 - out.length));
  }
  return out.slice(0, 24);
}

/** A player's 25 cells. Deterministic: same inputs, same board, any device,
 *  no network. `varied` gives each player different items from a larger pool. */
export function boardFor(game, playerId, pack) {
  const pool = game.varied
    ? drawPool(pack.items, game.seed + ':' + playerId)
    : drawPool(pack.items, game.seed);
  const cells = shuffled(pool, rng(game.seed + ':' + playerId));
  if (!game.freeSpace) return cells.slice(0, 25);
  return [...cells.slice(0, 12), { key: null, label: 'FREE', emoji: '★', free: true }, ...cells.slice(12, 24)];
}

/** Completed lines and the squares that are one away, for the breathe state.
 *  `patterns` is the subset of kinds this game counts. */
export function evaluate(marked, patterns, freeSpace) {
  const filled = freeSpace ? new Set([...marked, FREE_IDX]) : new Set(marked);
  const complete = [];
  const oneAway = new Set();
  for (const line of LINES) {
    if (!patterns.includes(line.kind)) continue;
    const missing = line.cells.filter(c => !filled.has(c));
    if (missing.length === 0) complete.push(line);
    else if (missing.length === 1) oneAway.add(missing[0]);
  }
  return { complete, oneAway: [...oneAway], won: complete.length > 0 };
}

/** Bounded client time. The device uptime counter cannot be set backwards, so
 *  a mark made offline carries a timestamp the server can bound without
 *  trusting the wall clock. See docs/05-architecture.md. */
export function stampFrom(anchor) {
  if (!anchor) return { ts: Date.now(), bounded: false };
  const elapsed = performance.now() - anchor.perfAtSync;
  return { ts: anchor.serverTime + elapsed, bounded: true, anchor: anchor.id };
}

/** Near-ties are ties. In a game about looking at flowers with your spouse a
 *  tie is a fine outcome and a dispute is not. */
export const TIE_WINDOW_MS = 5 * 60 * 1000;

export function decideWinners(wins) {
  if (!wins.length) return [];
  const sorted = wins.slice().sort((a, b) => a.ts - b.ts);
  const first = sorted[0];
  return sorted
    .filter(w => w.ts - first.ts <= TIE_WINDOW_MS || !w.bounded || !first.bounded)
    .map(w => w.playerId);
}

export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY3479'; // no O/0, I/1, S/5, B/8
export function gameCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}
