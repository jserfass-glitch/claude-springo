// Springo. Local-first: every screen reads IndexedDB, the network only fills
// it and drains the outbox. Nothing here awaits a fetch on a render path.

import { boardFor, evaluate, gameCode, stampFrom, decideWinners,
         TIE_WINDOW_MS, SCREEN_TIE_WINDOW_MS, FREE_IDX } from './game.js';
import { meta, games, marks, photos, packs, outbox, uid, me, setName } from './store.js';
import * as sync from './sync.js';
import { SYSTEM, JSON_SHAPE, userMessage } from './prompt.js';
import { injectSprite, icon, ICON_NAMES } from './icons.js';
import { findRefPhoto } from './refphoto.js';

const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PATTERNS = ['row', 'col', 'diag', 'stamp'];

/* Each accent carries a light set and a dark set, because `deep` is a text
   colour. A single dark `deep` such as #8A5A00 lands at 2.75:1 on the dark
   surface, which is what the selected tab label and the live pill are drawn
   in. Every pair below is measured: ink on fill and deep on surface clear
   4.5:1, and fill clears 1.9:1 against its own ground so a marked square
   still reads as a shape. Read them through accentOf(), never directly. */
const ACCENTS = {
  trout:    { fill: '#E89C1C', ink: '#1F1C17', deep: '#7A4A00', soft: '#FFC96B',
              dark: { fill: '#F0B040', ink: '#1F1C17', deep: '#FFC259', soft: '#FFE0A3' } },
  beauty:   { fill: '#E05A8B', ink: '#1F1C17', deep: '#A02755', soft: '#F7A8C3',
              dark: { fill: '#F08CB0', ink: '#1F1C17', deep: '#F7A6C2', soft: '#FBCBDC' } },
  mayapple: { fill: '#3E9D57', ink: '#1F1C17', deep: '#1F5E31', soft: '#7FC793',
              dark: { fill: '#6FC488', ink: '#1F1C17', deep: '#88D39E', soft: '#B4E5C3' } },
  hepatica: { fill: '#4FA7C6', ink: '#1F1C17', deep: '#145E7C', soft: '#9AD0E3',
              dark: { fill: '#7FC4DC', ink: '#1F1C17', deep: '#95D3E8', soft: '#C1E6F2' } },
  bluebell: { fill: '#4B5CC4', ink: '#FFFFFF', deep: '#3A46A2', soft: '#8E9AE4',
              dark: { fill: '#93A0E8', ink: '#1F1C17', deep: '#A9B4F0', soft: '#CBD2F7' } },
  redbud:   { fill: '#9243B0', ink: '#FFFFFF', deep: '#6E2F87', soft: '#C08AD6',
              dark: { fill: '#C48ADA', ink: '#1F1C17', deep: '#D4A2E6', soft: '#E6CBF2' } },
  trillium: { fill: '#BC3C34', ink: '#FFFFFF', deep: '#932A26', soft: '#DE7C76',
              dark: { fill: '#E08A85', ink: '#1F1C17', deep: '#E8A19D', soft: '#F2C8C6' } },
};
const ACCENT_KEYS = Object.keys(ACCENTS);
const PACK_IDS = ['ozark-fall', 'ozark-spring', 'road-trip', 'cozy-mystery', 'twenty-six'];

/** A screen pack plays against a TV, a film or a live event instead of the
 *  outdoors, and nearly every default flips. See docs/09-screen-mode.md. */
// news plays like a screen: nothing to photograph, and a headline reaches everyone at once
const isScreen = p => p?.kind === 'screen' || p?.kind === 'news';
function setScreenTitle(t) { const h = $('#screenTitle'); h.textContent = t; h.hidden = !t; }
// photoDir is '' on a generated pack, whose items carry absolute URLs, and
// null on a pack with no photos at all, so test for null, not truthiness
const refSrc = (p, it) => (it?.photo && p && p.photoDir != null ? p.photoDir + it.photo : null);
const cssUrl = u => `url(${JSON.stringify(u)})`;

const S = {
  me: null, games: [], marks: [], packs: {}, photos: new Map(),
  gi: 0, view: 'board', viewingPlayer: null, sheetIdx: null,
  setup: { packId: null, mode: 'honor', varied: false }, review: null, stream: null,
  queued: 0, quickCapture: false, sheetOpenedAt: 0,
};

const game = () => S.games[S.gi] || null;
const pack = g => S.packs[g && g.packId];
const myMarks = g => S.marks.filter(m => m.gameId === g.id && m.playerId === S.me.id && !m.undoneAt);
const marksOf = (g, pid) => S.marks.filter(m => m.gameId === g.id && m.playerId === pid && !m.undoneAt);

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB';

/* ------------------------------------------------------------------ packs */
/** A built-in pack gains photos or rewording with a deploy. The stored copy
 *  opens the game at once and this swaps in the new one behind it, but only
 *  when the draw is unchanged: boards are drawn from item order and rarity, so
 *  a different list would reshuffle every game already in progress. */
const drawShape = p => p.items.map(i => `${i.key}:${i.rarity}`).join('|');
async function refreshPack(id) {
  if (!PACK_IDS.includes(id)) return;          // a generated pack lives only here
  try {
    const r = await fetch(`packs/${id}.json`, { cache: 'no-cache' });
    if (!r.ok) return;
    const p = await r.json(), old = S.packs[id];
    if (!old || JSON.stringify(p) === JSON.stringify(old)) return;
    if (drawShape(p) !== drawShape(old)) { console.warn('pack', id, 'changed its draw; keeping the stored copy'); return; }
    await packs.put(p);
    S.packs[id] = p;
    if (S.games.some(g => g.packId === id)) warmPackPhotos(p);
  } catch { /* offline: the stored copy is the pack */ }
}

async function loadPack(id) {
  if (S.packs[id]) return S.packs[id];
  const cached = await packs.get(id);
  if (cached) { S.packs[id] = cached; refreshPack(id); return cached; }
  const p = await (await fetch(`packs/${id}.json`)).json();
  await packs.put(p);            // cached so a game opens with no network, ever
  S.packs[id] = p;
  return p;
}

/* ------------------------------------------------------------- accent/CSS */
const prefersDark = matchMedia('(prefers-color-scheme: dark)');
/** True when the app is painting dark right now, whether that came from the
 *  Appearance setting or from the phone. */
function isDarkNow() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (!t && prefersDark.matches);
}
/** The accent as it should look in the theme on screen. Takes a game, an
 *  accent key, or nothing, and always returns a usable accent. */
function accentOf(x) {
  const key = typeof x === 'string' ? x : x?.accent;
  const a = ACCENTS[key] || ACCENTS.trout;
  return isDarkNow() ? { ...a, ...a.dark } : a;
}
function applyAccent(key) {
  const a = accentOf(key), r = document.documentElement.style;
  r.setProperty('--acc', a.fill); r.setProperty('--acc-ink', a.ink);
  r.setProperty('--acc-deep', a.deep); r.setProperty('--acc-soft', a.soft);
}
// an accent applied under one theme is wrong under the other, so follow the
// phone too, not only the Appearance buttons
prefersDark.addEventListener('change', () => { const g = game(); if (g) applyAccent(g.accent); });

/* ------------------------------------------------------------------ views */
function setView(v) {
  S.view = v;
  $('#viewBoard').classList.toggle('on', v === 'board');
  for (const [id, name] of [['#viewNew', 'new'], ['#viewLife', 'life'], ['#viewYou', 'you'],
                            ['#viewSetup', 'setup'], ['#viewInvite', 'invite'], ['#viewReview', 'review']]) {
    $(id).classList.toggle('on', v === name);
  }
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.view === v
            || (['setup', 'invite', 'review'].includes(v) && t.dataset.view === 'new');
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $('#chips').style.display = v === 'board' ? '' : 'none';
  // the brand line above already says Springo, so a screen with no title of its own shows none
  const titles = { board: game() ? pack(game())?.title || '' : '',
                   new: '', setup: 'New game', invite: 'Invite',
                   review: 'Review the list', life: 'Life List', you: 'You' };
  setScreenTitle(titles[v] || '');
  if (v === 'life') renderLife();
  if (v === 'you') renderYou();
  if (v === 'new') renderPackList();
  if (v === 'board') {
    const g = game();
    if (g) { applyAccent(g.accent); renderScore(); renderBoard(); }
  }
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ chips */
function renderChips() {
  const el = $('#chips'); el.textContent = '';
  S.games.forEach((g, i) => {
    const p = pack(g); if (!p) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === S.gi ? 'true' : 'false');
    const d = document.createElement('span'); d.className = 'dot';
    d.style.background = accentOf(g).fill;
    const t = document.createElement('span'); t.textContent = p.title;
    b.append(d, t);
    if (g.unseen) { const n = document.createElement('span'); n.className = 'badge'; n.textContent = g.unseen; b.append(n); }
    b.addEventListener('click', () => { S.gi = i; S.viewingPlayer = null; g.unseen = 0; games.put(g); renderAll(); });
    el.append(b);
  });
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'chip add'; add.textContent = '+ New';
  add.addEventListener('click', () => setView('new'));
  el.append(add);
}

/* ------------------------------------------------------------------ score */
function renderScore() {
  const el = $('#scorerow'); el.textContent = ''; const g = game(); if (!g) return;
  const a = accentOf(g);
  const viewing = S.viewingPlayer || S.me.id;
  for (const pl of g.players) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'player';
    b.setAttribute('aria-pressed', pl.id === viewing ? 'true' : 'false');
    const av = document.createElement('span'); av.className = 'av';
    const isMe = pl.id === S.me.id;
    av.style.background = isMe ? a.fill : 'var(--surface-2)';
    av.style.color = isMe ? a.ink : 'var(--ink-muted)';
    av.textContent = (pl.name || '?')[0].toUpperCase();
    const w = document.createElement('span'); w.style.minWidth = '0';
    const n = document.createElement('span'); n.className = 'nm'; n.textContent = isMe ? 'You' : pl.name;
    const c = document.createElement('span'); c.className = 'ct';
    const count = marksOf(g, pl.id).length;
    c.textContent = count + (count === 1 ? ' mark' : ' marks');
    w.append(n, document.createElement('br'), c);
    b.append(av, w);
    b.addEventListener('click', () => {
      S.viewingPlayer = isMe ? null : pl.id;
      closeSheet(); renderScore(); renderBoard();
    });
    el.append(b);
  }
}

/** The thumbnail for a square, whoever took it. Your own comes from the local
 *  blob; another player's comes from the sync endpoint, keyed by mark id so it
 *  caches forever. Returns null when there is nothing to show yet. */
function photoSrcFor(g, viewing, idx, markOf) {
  const local = S.photos.get(`${g.id}:${viewing}:${idx}`);
  if (local) return { src: local.thumbUrl, remote: false };
  const m = markOf(idx);
  if (g.shared && m?.hasPhoto && m.playerId !== S.me.id) {
    return { src: sync.photoUrl(g.id, m.id), remote: true };
  }
  return null;
}

/* ------------------------------------------------------------------ board */
function renderBoard() {
  const el = $('#board'); el.textContent = ''; const g = game();
  if (!g) { setView('new'); return; }
  const p = pack(g);
  const viewing = S.viewingPlayer || S.me.id;
  const isMine = viewing === S.me.id;
  const cells = boardFor(g, viewing, p);
  const theirMarks = marksOf(g, viewing);
  const byIdx = new Map(theirMarks.map(m => [m.idx, m]));
  const markOf = i => byIdx.get(i);
  const set = new Set(theirMarks.map(m => m.idx));
  const ev = evaluate(set, PATTERNS, g.freeSpace);
  const away = isMine && !g.winners?.length ? new Set(ev.oneAway) : new Set();

  $('#boardwrap').classList.toggle('theirs', !isMine);
  const v = $('#viewing');
  if (!isMine) {
    const other = g.players.find(x => x.id === viewing);
    v.textContent = (other?.name || 'Their') + "'s board";
    const a = accentOf(g);
    v.style.background = a.fill; v.style.color = a.ink;
  }

  cells.forEach((it, idx) => {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'cell'; c.dataset.idx = idx;
    const free = it.free || idx === FREE_IDX && g.freeSpace;
    if (free) c.classList.add('free');
    const marked = set.has(idx) || free;
    if (marked) c.classList.add('marked');
    if (away.has(idx)) c.classList.add('oneaway');
    c.setAttribute('aria-label',
      `${it.label}, ${marked ? 'marked' : 'not marked'}, row ${Math.floor(idx / 5) + 1} column ${idx % 5 + 1}`);

    const shot = marked && !free ? photoSrcFor(g, viewing, idx, markOf) : null;
    if (shot) {
      const ph = document.createElement('span'); ph.className = 'ph';
      if (shot.remote) {
        // it may not be uploaded yet, so only claim a photo once it decodes
        const probe = new Image();
        probe.onload = () => { ph.style.backgroundImage = `url(${shot.src})`; c.classList.add('hasphoto'); };
        probe.src = shot.src;
      } else {
        ph.style.backgroundImage = `url(${shot.src})`; c.classList.add('hasphoto');
      }
      c.append(ph);
    }
    const ico = icon(free ? 'star' : it.icon, { key: free ? null : it.key });
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = it.label;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tick'); svg.setAttribute('viewBox', '0 0 16 16');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 8.6 L6.4 12 L13 4.4'); svg.append(path);
    c.append(ico, lbl, svg);
    c.addEventListener('pointerdown', onCellDown);
    c.addEventListener('pointerup', onCellUp);
    c.addEventListener('pointermove', onCellMove);
    c.addEventListener('pointercancel', clearPress);
    c.addEventListener('pointerleave', clearPress);
    c.addEventListener('contextmenu', ev => ev.preventDefault());
    el.append(c);
  });
  renderSyncbar();
}

function renderSyncbar() {
  const el = $('#syncbar'); el.textContent = ''; const g = game(); if (!g) return;
  const add = (t, live, dot) => {
    const s = document.createElement('span'); s.className = 'pill' + (live ? ' live' : '');
    if (dot) s.append(document.createElement('i'));
    s.append(document.createTextNode(t)); el.append(s);
  };
  add(g.mode === 'photo' ? 'PHOTO' : 'HONOR', g.mode === 'photo', true);
  if (g.shared) add('CODE ' + g.code); else add('SOLO');
  if (S.queued) add(S.queued + ' QUEUED', true);
  else if (sync.cloudState() === false) add('LOCAL ONLY');
  else if (!navigator.onLine) add('OFFLINE', true);
  if (g.winners?.length) {
    const names = g.winners.map(id => id === S.me.id ? 'You' : (g.players.find(p => p.id === id)?.name || '?'));
    add((names.length > 1 ? 'TIE: ' : 'WON: ') + names.join(' + '));
  }
}

/* ---------------------------------------------------------------- marking */
/* Tap to look, hold to act.
 *
 * A tap always opens the square, in both modes, because the reference photo is
 * the reason to open a square you have NOT marked: you want it while deciding,
 * not after. Holding is the fast path back for people who already know what
 * they are looking at. Honor mode marks; photo mode goes straight to the
 * camera, skipping the sheet entirely. */
const HOLD_MS = 460;
let press = null;

function clearPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press.cell.classList.remove('holding', 'armed');
  press = null;
}

function canQuickAct(idx) {
  const g = game();
  if (!g || g.winners?.length) return false;
  if ((S.viewingPlayer || S.me.id) !== S.me.id) return false;      // their board
  return !myMarks(g).some(m => m.idx === idx);                     // already mine
}

function onCellDown(e) {
  const cell = e.currentTarget, idx = +cell.dataset.idx;
  const g = game(), p = pack(g);
  if (!g) return;
  if (boardFor(g, S.viewingPlayer || S.me.id, p)[idx].free) {
    press = { idx, cell, x: e.clientX, y: e.clientY, fired: true, timer: 0 };
    toast('Free space. Always yours.');
    return;
  }
  press = { idx, cell, x: e.clientX, y: e.clientY, fired: false, timer: 0 };
  if (!canQuickAct(idx)) return;
  cell.classList.add('holding');
  press.timer = setTimeout(() => {
    if (!press) return;
    press.fired = true;
    cell.classList.remove('holding');
    if (navigator.vibrate) { try { navigator.vibrate([12, 40, 18]); } catch {} }
    if (isScreen(pack(g))) { press.act = 'sheet'; openSheet(idx); }
    else if (g.mode === 'photo') {
      // opening the camera is a file-input click, and browsers only honour that
      // inside a real user gesture. A timer is not one, so arm here and fire on
      // release, which is.
      press.act = 'camera';
      cell.classList.add('armed');
    } else { press.act = 'mark'; quickAct(idx, cell); }
  }, HOLD_MS);
}

function onCellUp(e) {
  if (!press) return;
  const { idx, fired, cell, act } = press;
  clearPress();
  if (fired) {
    if (act === 'camera') openCamera(idx);  // this handler IS the user gesture
    return;
  }
  // Outdoors a tap opens the square, because the reference photo is the reason
  // to open one you have not marked. On a screen there is no reference photo
  // and the player is trying to watch television, so a tap marks.
  if (isScreen(pack(game())) && canQuickAct(idx)) quickAct(idx, cell);
  else openSheet(idx);
}

function onCellMove(e) {
  // a drag is a scroll, not a hold
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) clearPress();
}

function openCamera(idx) {
  S.sheetIdx = idx;
  S.quickCapture = true;
  $('#fileIn').click();                    // on a phone this is the camera, full screen
}

function quickAct(idx, cell) {
  const r = cell.getBoundingClientRect();
  doMark(idx, r.width / 2, r.height / 2);
}

async function doMark(idx, x, y, photo) {
  const g = game();
  const cell = $(`.cell[data-idx="${idx}"]`);
  if (cell && (x == null || y == null)) {
    const r = cell.getBoundingClientRect();
    x = r.width / 2; y = r.height / 2;
  }
  const stamp = stampFrom(sync.getAnchor());
  const mark = {
    id: uid(), gameId: g.id, playerId: S.me.id, idx,
    ts: stamp.ts, bounded: stamp.bounded, anchor: stamp.anchor || null,
    createdAt: Date.now(), undoneAt: null, hasPhoto: !!photo,
  };
  S.marks.push(mark);
  await marks.put(mark);
  if (g.shared) { await outbox.add({ id: mark.id, gameId: g.id, event: { type: 'mark', mark } }); S.queued++; }

  if (photo) {
    const key = `${g.id}:${S.me.id}:${idx}`;
    const rec = { id: key, gameId: g.id, idx, markId: mark.id, ...photo };
    await photos.put(rec);
    S.photos.set(key, { ...rec, thumbUrl: URL.createObjectURL(rec.thumb) });
    // the thumbnail is what crosses the wire; the full original stays here
    if (g.shared) {
      await outbox.add({ id: 'photo-' + mark.id, gameId: g.id,
                         photo: { markId: mark.id, blob: rec.thumb } });
      S.queuedPhotos = (S.queuedPhotos || 0) + 1;
    }
  }

  if (cell) {
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} }
    if (!reduce) {
      cell.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(.2,.75,.3,1)' });
      const b = document.createElement('span'); b.className = 'bloom';
      b.style.left = x + 'px'; b.style.top = y + 'px'; cell.append(b);
      b.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
        { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      setTimeout(() => b.remove(), 320);
    }
    const shot = S.photos.get(`${g.id}:${S.me.id}:${idx}`);
    if (shot) {
      cell.classList.add('hasphoto');
      const ph = document.createElement('span'); ph.className = 'ph';
      ph.style.backgroundImage = `url(${shot.thumbUrl})`; cell.prepend(ph);
    }
    setTimeout(() => cell.classList.add('marked'), reduce ? 0 : 170);
  }

  setTimeout(async () => {
    renderScore(); renderSyncbar(); renderChips();
    const set = new Set(myMarks(g).map(m => m.idx));
    const ev = evaluate(set, PATTERNS, g.freeSpace);
    const away = new Set(ev.won ? [] : ev.oneAway);
    document.querySelectorAll('.cell').forEach(c => c.classList.toggle('oneaway', away.has(+c.dataset.idx)));
    if (ev.won && !g.winners?.length) await declareWin(ev.complete[0], idx, mark);
    sync.syncGame(g.id).then(n => { S.queued = 0; renderSyncbar(); if (n) refresh(); });
  }, reduce ? 10 : 460);
}

async function declareWin(line, closingIdx, mark) {
  const g = game(), p = pack(g);
  g.wins = g.wins || [];
  g.wins.push({ playerId: S.me.id, ts: mark.ts, bounded: mark.bounded, line: line.label });
  g.winners = decideWinners(g.wins,
    isScreen(p) ? SCREEN_TIE_WINDOW_MS : TIE_WINDOW_MS);
  g.finishedAt = Date.now();
  await games.put(g);
  if (g.shared) await outbox.add({ id: 'win-' + g.id + '-' + S.me.id, gameId: g.id, event: { type: 'win', gameId: g.id, win: g.wins.at(-1) } });

  const cells = [...document.querySelectorAll('.cell')];
  const step = reduce ? 0 : 60;
  line.cells.forEach((ci, k) => setTimeout(() => {
    const c = cells[ci]; if (!c) return;
    c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
    setTimeout(() => c.classList.remove('flash'), 420);
  }, k * step));
  if (!reduce) {
    setTimeout(() => $('#board').classList.add('tilt'), step * 5);
    setTimeout(() => petals(), step * 5 + 60);
    setTimeout(() => $('#board').classList.remove('tilt'), 2600);
  }
  const item = boardFor(g, S.me.id, p)[closingIdx];
  setTimeout(() => toast(`Bingo on ${item.label}. ${line.label}, ${myMarks(g).length} marks.`, 5200), reduce ? 100 : 700);
  renderSyncbar();
}

function petals() {
  const cv = $('#petals'), a = accentOf(game());
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 46 }, () => ({
    x: w / 2 + (Math.random() - .5) * w * .6, y: h * .45 + (Math.random() - .5) * 80,
    vx: (Math.random() - .5) * 3.6, vy: -3.4 - Math.random() * 5,
    r: 3.4 + Math.random() * 5, ang: Math.random() * 6.28, va: (Math.random() - .5) * .28,
    c: Math.random() < .45 ? a.soft : a.fill, life: 0, max: 72 + Math.random() * 44,
  }));
  (function frame() {
    ctx.clearRect(0, 0, w, h); let alive = false;
    for (const p of parts) {
      if (++p.life > p.max) continue; alive = true;
      p.vy += .14; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.ang += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(0, -p.r);
      ctx.quadraticCurveTo(p.r * .95, -p.r * .28, 0, p.r);
      ctx.quadraticCurveTo(-p.r * .95, -p.r * .28, 0, -p.r);
      ctx.fill(); ctx.restore();
    }
    if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
  })();
}

/* ------------------------------------------------------------------ sheet */
function stopCamera() {
  if (S.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
  $('#finder').classList.remove('on');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
    });
    const v = $('#vid'); v.srcObject = S.stream; await v.play();
    $('#finder').classList.add('on');
    return true;
  } catch { return false; }
}

/** The pipeline from docs/05-architecture.md. The canvas re-encode is what
 *  drops EXIF, GPS included, so the resize and the scrub are one step. */
async function processCapture(src, w, h, originalBytes) {
  const MAX = 2048, TH = 400;
  const scale = Math.min(1, MAX / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(src, 0, 0, cw, ch);
  const full = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.75));
  const sq = Math.min(w, h);
  const t = document.createElement('canvas'); t.width = t.height = TH;
  t.getContext('2d').drawImage(src, (w - sq) / 2, (h - sq) / 2, sq, sq, 0, 0, TH, TH);
  const thumb = await new Promise(r => t.toBlob(r, 'image/jpeg', 0.72));
  return { full, thumb, bytes: full.size, thumbBytes: thumb.size, w: cw, h: ch, srcW: w, srcH: h, originalBytes, takenAt: Date.now() };
}

function showPipe(s) {
  const el = $('#pipe'); el.hidden = false;
  el.textContent =
    `captured   ${s.srcW} x ${s.srcH}${s.originalBytes ? '  ' + kb(s.originalBytes) : ''}\n` +
    `resized    ${s.w} x ${s.h}  long edge 2048\n` +
    `jpeg q.75  ${kb(s.bytes)}\n` +
    `thumbnail  400 x 400  ${kb(s.thumbBytes)}\n` +
    `exif       dropped by the re-encode, GPS included`;
}

async function applyCapture(shot) {
  const idx = S.sheetIdx, g = game();
  const key = `${g.id}:${S.me.id}:${idx}`;
  const already = myMarks(g).some(m => m.idx === idx);
  showPipe(shot);
  const url = URL.createObjectURL(shot.thumb);
  $('#myFrame').textContent = '';
  const im = new Image(); im.src = url; im.alt = 'Your photo'; $('#myFrame').append(im);
  $('#myCredit').textContent = 'just now · ' + kb(shot.bytes) + ' after compression';
  stopCamera();

  if (S.quickCapture && !already) {
    S.quickCapture = false;
    closeSheet();
    await doMark(idx, null, null, shot);
    return;
  }
  S.quickCapture = false;
  if (already) {
    const prev = S.photos.get(key);
    const rec = { id: key, gameId: g.id, idx, markId: prev?.markId || null, ...shot };
    await photos.put(rec);
    S.photos.set(key, { ...rec, thumbUrl: url });
    if (g.shared && rec.markId) {
      await outbox.add({ id: 'photo-' + rec.markId, gameId: g.id,
                         photo: { markId: rec.markId, blob: rec.thumb } });
    }
    renderBoard(); renderSheetButtons();
    toast('Photo replaced. The mark did not move.');
  } else {
    setTimeout(async () => { closeSheet(); await doMark(idx, 0, 0, shot); }, 850);
  }
}

function fromVideo() {
  const v = $('#vid'); if (!v.videoWidth) return;
  processCapture(v, v.videoWidth, v.videoHeight, 0).then(applyCapture);
}

function renderSheetButtons() {
  const row = $('#shRow'); row.textContent = '';
  const g = game(), idx = S.sheetIdx;
  const viewing = S.viewingPlayer || S.me.id;
  const add = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label;
    b.addEventListener('click', fn); row.append(b); return b;
  };
  if (viewing !== S.me.id) { add('Close', 'ghost', closeSheet); return; }
  const marked = myMarks(g).some(m => m.idx === idx);
  const done = !!g.winners?.length;

  if (!marked && !done) {
    if (g.mode === 'photo') {
      add(S.stream ? 'Take photo' : 'Open camera', '', () => S.stream ? fromVideo() : $('#fileIn').click());
      add('Choose a file', 'ghost', () => {
        const f = $('#fileIn'); f.removeAttribute('capture'); f.click();
        setTimeout(() => f.setAttribute('capture', 'environment'), 500);
      });
    } else {
      add('I saw it', '', () => { closeSheet(); doMark(idx); });
      add('Close', 'ghost', closeSheet);
    }
  } else {
    if (g.mode === 'photo') add(S.photos.has(`${g.id}:${S.me.id}:${idx}`) ? 'Retake' : 'Add a photo', '', () => $('#fileIn').click());
    if (marked) add('Unmark', 'danger', async e => {
      const b = e.currentTarget;
      if (!b.dataset.armed) {
        b.dataset.armed = '1';
        b.classList.add('confirm');
        b.textContent = 'Tap again to unmark';
        return;
      }
      const m = myMarks(g).find(x => x.idx === idx);
      m.undoneAt = Date.now();
      await marks.put(m);
      if (g.shared) await outbox.add({ id: 'undo-' + m.id, gameId: g.id, event: { type: 'mark', mark: m } });
      const key = `${g.id}:${S.me.id}:${idx}`;
      if (S.photos.has(key)) { await photos.remove(key); S.photos.delete(key); }
      if (g.winners?.length) { g.winners = []; g.wins = []; g.finishedAt = null; await games.put(g); }
      closeSheet(); renderAll();
      toast('Unmarked. A tombstone, not a deleted row.');
    });
    add('Close', 'ghost', closeSheet);
  }
}

function openSheet(idx) {
  S.sheetIdx = idx;
  const g = game(), p = pack(g);
  const viewing = S.viewingPlayer || S.me.id;
  const it = boardFor(g, viewing, p)[idx];
  const theirs = viewing !== S.me.id;
  const set = new Set(marksOf(g, viewing).map(m => m.idx));

  const screenPack = isScreen(p);

  $('#shName').textContent = it.label;
  $('#shSci').textContent = it.sci || '';
  $('#shHint').textContent = it.hint || 'No identification hint on this pack item.';

  const rf = $('#refFrame'), rc = $('#refCredit'); rf.textContent = ''; rc.textContent = '';
  const pair = $('#sheetPair');
  const src = screenPack ? null : refSrc(p, it);
  const solo = !screenPack && g.mode !== 'photo';
  // no reference photo means no reference pane, never an empty box; in honor
  // mode that leaves nothing to show, so the whole pair goes
  const noRef = () => { pair.classList.add('noref'); rc.textContent = ''; if (solo) pair.hidden = true; };
  pair.classList.remove('noref');
  pair.classList.toggle('solo', solo);
  pair.hidden = screenPack;
  if (src) {
    const im = new Image(); im.alt = 'Reference photo of ' + it.label;
    im.onerror = noRef;          // offline and never downloaded
    im.src = src;
    rf.append(im);
    const cr = p.credits?.[it.key];
    if (cr) rc.textContent = cr[2] ? `${cr[2]} · ${cr[0]} · ${cr[1]}`
                                   : `iNaturalist · ${cr[0]} · ${String(cr[1]).toUpperCase()}`;
  } else if (!screenPack) noRef();

  const mf = $('#myFrame'), mc = $('#myCredit'); mf.textContent = ''; mc.textContent = '';
  $('#myCap').textContent = theirs ? (g.players.find(x => x.id === viewing)?.name || 'Their') + "'s photo" : 'Your photo';
  const local = S.photos.get(`${g.id}:${viewing}:${idx}`);
  const mk = marksOf(g, viewing).find(m => m.idx === idx);
  if (local) {
    const im = new Image(); im.src = local.thumbUrl; im.alt = 'Photo'; mf.append(im);
    mc.textContent = new Date(local.takenAt || Date.now()).toLocaleDateString() + ' · ' + kb(local.bytes || 0);
  } else if (g.shared && theirs && mk?.hasPhoto) {
    mf.innerHTML = '<span class="empty">Loading their photo</span>';
    const im = new Image(); im.alt = 'Their photo';
    im.onload = () => { mf.textContent = ''; mf.append(im);
      mc.textContent = new Date(mk.ts).toLocaleDateString() + ' · synced thumbnail'; };
    im.onerror = () => { mf.innerHTML = '<span class="empty">Photo not uploaded yet</span>'; mc.textContent = ''; };
    im.src = sync.photoUrl(g.id, mk.id);
  } else {
    mf.innerHTML = `<span class="empty">${set.has(idx) ? 'Marked, no photo' : 'Not marked yet'}</span>`;
  }

  $('#pipe').hidden = true;
  renderSheetButtons();
  S.sheetOpenedAt = performance.now();
  $('#scrim').classList.add('on'); $('#sheet').classList.add('up');
  meta.get('heldHint').then(seen => {
    if (seen || theirs) return;
    meta.set('heldHint', 1);
    setTimeout(() => toast(isScreen(pack(g))
      ? 'Tip: tap a square to mark it. Hold one to read what counts.'
      : g.mode === 'photo'
        ? 'Tip: hold a square to go straight to the camera.'
        : 'Tip: hold a square to mark it without opening this.', 4200), 900);
  });
  if (!theirs && !set.has(idx) && g.mode === 'photo' && !g.winners?.length) {
    startCamera().then(ok => {
      if (S.sheetIdx === idx) { renderSheetButtons(); if (!ok) toast('Camera unavailable here. Use Open camera.'); }
    });
  }
}

function closeSheet() {
  stopCamera(); $('#scrim').classList.remove('on'); $('#sheet').classList.remove('up'); S.sheetIdx = null;
}

/** A tap that opens the sheet also dispatches a synthesized click about 4ms
 *  later. With a mouse that click targets the cell, but a finger hit-tests at
 *  the touch point and lands on the scrim that just appeared, closing the sheet
 *  instantly. Two guards: the scrim dismisses on pointerdown, which the opening
 *  gesture already spent on the cell, and anything arriving in the first
 *  moments after opening is ignored. */
const SHEET_GUARD_MS = 350;
function dismissSheet() {
  if (performance.now() - (S.sheetOpenedAt || 0) < SHEET_GUARD_MS) return;
  closeSheet();
}

/* ------------------------------------------------------------ new / setup */
function renderSetupNote() {
  const p = S.packs[S.setup.packId]; if (!p) return;
  const real = p.items.filter(i => i.key).length;
  const withPhoto = p.items.filter(i => i.photo).length;
  if (p.kind === 'news') {
    $('#setupNote').textContent =
      `${real} items. ${p.note || ''}\n` +
      'Tap a square when it makes the news. Hold one to read what counts.\n' +
      (S.setup.varied
        ? `Varied boards: everyone gets their own 24 from these ${real}.`
        : 'Same items: a headline lands for everyone at once, so the winner is whoever taps first.');
    return;
  }
  if (isScreen(p)) {
    const mins = p.runtime || 45;
    $('#setupNote').textContent =
      `${real} items. Runtime about ${mins} minutes.\n` +
      `A win usually lands around the ${Math.round(mins * 0.38)} minute mark, ` +
      `and nearly always lands before the credits.\n` +
      (S.setup.varied
        ? 'Varied boards: everyone watches for their own list, and nobody ties.'
        : 'Same items: the trope fires once for the whole room, so you both mark ' +
          'the same square in the same second. Arranging the grids differently does ' +
          'not fix that. It only changes how many marks each of you needs, and about ' +
          'one game in nine still ends level. Here the winner is whoever taps first.');
    return;
  }
  $('#setupNote').textContent =
    `${real} items, ${withPhoto} with a reference photo.\n` +
    `Typical bingo: 13 marks, usually 11 to 16.\n` +
    (real <= 24 ? 'This pack is exactly 24 items, so varied boards fall back to same items.'
                : `Varied boards can draw different items for each player from these ${real}.`);
}

function renderPackList() {
  const el = $('#packList'); el.textContent = '';
  // a reviewed list is a real pack, so it is replayable like any other
  const customs = Object.values(S.packs).filter(p => p.custom).sort((a, b) => b.createdAt - a.createdAt);
  for (const p of [...PACK_IDS.map(id => S.packs[id]), ...customs]) {
    if (!p) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card';
    const em = document.createElement('span'); em.className = 'em';
    const lead = p.items.find(i => i.key);
    em.append(icon(lead?.icon, { key: lead?.key }));
    const w = document.createElement('span'); w.style.minWidth = '0';
    const t = document.createElement('span'); t.className = 't'; t.textContent = p.title;
    const s = document.createElement('span'); s.className = 's'; s.textContent = p.subtitle;
    w.append(t, document.createElement('br'), s);
    const go = document.createElement('span'); go.className = 'go'; go.append(icon('chevron'));
    b.append(em, w, go);
    b.addEventListener('click', () => { S.setup = { packId: p.id, mode: 'honor', varied: isScreen(p) }; openSetup(); });
    el.append(b);
  }
}

function openSetup() {
  const p = S.packs[S.setup.packId];
  if (!p) { setView('new'); return; }
  const screenPack = isScreen(p);
  if (screenPack) S.setup.mode = 'honor';   // photographing a television proves nothing
  $('#setupTitle').textContent = p.title;
  // photographing a television proves nothing, so photo mode is not offered
  $('#modeRow').hidden = screenPack;
  $('#modeLabel').hidden = screenPack;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === S.setup.mode));
  document.querySelectorAll('[data-varied]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.varied === '1') === S.setup.varied));
  const real = p.items.filter(i => i.key).length;
  const withPhoto = p.items.filter(i => i.photo).length;
  renderSetupNote();
  setView('setup');
}

async function createGame() {
  const p = S.packs[S.setup.packId];
  const used = new Set(S.games.map(g => g.accent));
  const accent = ACCENT_KEYS.find(k => !used.has(k)) || p.accent || 'trout';
  const g = {
    id: uid(), code: gameCode(), packId: p.id, accent,
    mode: S.setup.mode, varied: S.setup.varied, freeSpace: true,
    seed: uid().toUpperCase(), hostId: S.me.id,
    players: [{ id: S.me.id, name: S.me.name || 'You' }],
    createdAt: Date.now(), shared: false, unseen: 0, wins: [], winners: [],
  };
  await games.put(g);
  S.games.unshift(g); S.gi = 0;
  const ok = await sync.pushGame(g);
  if (ok) { g.shared = true; await games.put(g); }
  warmPackPhotos(p);
  $('#inviteCode').textContent = g.code;
  $('#inviteNote').textContent = ok
    ? 'Anyone with this code joins and sees your board. Marks sync whenever either of you has signal.'
    : 'No sync server is deployed, so this game is on this device only. The board, the camera and the Life List all still work. See README.md to switch sharing on.';
  renderChips();
  setView('invite');
}

async function joinByCode(code) {
  try {
    const r = await sync.joinGame(code);
    const g = { ...r.game, unseen: 0, shared: true };
    const me = { id: S.me.id, name: S.me.name || 'Player' };
    if (!g.players.some(p => p.id === me.id)) g.players.push(me);
    await games.put(g);
    // syncGame replaces the roster with the server's, so announce yourself
    // first or the next pull deletes you from your own game
    await outbox.add({ id: 'player-' + g.id + '-' + me.id, gameId: g.id,
                       event: { type: 'player', player: me } });
    const jp = await loadPack(g.packId);
    warmPackPhotos(jp);
    S.games.unshift(g); S.gi = 0;
    await sync.syncGame(g.id);
    await refresh();
    setView('board');
    toast('Joined ' + (pack(g)?.title || 'the game'));
  } catch (e) {
    toast(e.message === 'offline' ? 'No sync server, so codes cannot be joined yet.' : 'No game with that code.');
  }
}

/* ------------------------------------------------------- life list / you */
function lifeList() {
  const seen = new Map();
  for (const m of S.marks) {
    if (m.undoneAt || m.playerId !== S.me.id) continue;
    const g = S.games.find(x => x.id === m.gameId); if (!g) continue;
    const p = pack(g); if (!p || isScreen(p)) continue;   // see docs/09-screen-mode.md
    const it = boardFor(g, S.me.id, p)[m.idx];
    if (!it?.key) continue;
    const prev = seen.get(it.key);
    if (prev) { prev.n++; prev.first = Math.min(prev.first, m.ts); }
    else seen.set(it.key, { item: it, pack: p, n: 1, first: m.ts, gameId: g.id, idx: m.idx });
  }
  return [...seen.values()].sort((a, b) => b.first - a.first);
}

function renderLife() {
  const list = lifeList();
  $('#lifeNum').textContent = list.length;
  $('#lifeSub').textContent = list.length === 1 ? 'thing found' : 'things found';
  $('#lifeEmpty').hidden = list.length > 0;
  const el = $('#lifeGrid'); el.textContent = '';
  for (const e of list) {
    const w = document.createElement('div'); w.className = 'lifeitem';
    const im = document.createElement('div'); im.className = 'im';
    const mine = S.photos.get(`${e.gameId}:${S.me.id}:${e.idx}`);
    if (mine) im.style.backgroundImage = cssUrl(mine.thumbUrl);
    else if (refSrc(e.pack, e.item)) im.style.backgroundImage = cssUrl(refSrc(e.pack, e.item));
    else im.append(icon(e.item.icon, { key: e.item.key }));
    const tx = document.createElement('div'); tx.className = 'tx';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = e.item.label;
    const dt = document.createElement('div'); dt.className = 'dt';
    dt.textContent = new Date(e.first).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (e.n > 1 ? ` ×${e.n}` : '');
    tx.append(nm, dt); w.append(im, tx); el.append(w);
  }
}

/* Light is the base palette; dark arrives through prefers-color-scheme and
   through [data-theme="dark"]. 'auto' means no attribute at all, so the media
   query decides. The <head> script has already applied this before paint. */
const THEME_KEY = 'springo.theme';
const GROUND = { light: '#F2EBDC', dark: '#13110E' };

function themeChoice() {
  try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; }
  catch { return 'auto'; }
}

function applyTheme(choice) {
  if (choice === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    if (choice === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch { /* private mode: the theme still applies for this session */ }

  // the two theme-color tags are media-scoped, so forcing a theme means
  // pointing both at the same ground or the browser chrome disagrees
  const light = $('#tcLight'), dark = $('#tcDark');
  if (light && dark) {
    light.content = choice === 'dark' ? GROUND.dark : GROUND.light;
    dark.content = choice === 'light' ? GROUND.light : GROUND.dark;
  }
  for (const b of document.querySelectorAll('#themeOpts .opt'))
    b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice));
  const g = game(); if (g) applyAccent(g.accent);
}

function renderYou() {
  $('#nameIn').value = S.me.name || '';
  applyTheme(themeChoice());
  const mine = S.marks.filter(m => m.playerId === S.me.id && !m.undoneAt);
  const wonGames = S.games.filter(g => g.winners?.includes(S.me.id));
  const rows = [
    ['Games', S.games.length], ['Won', wonGames.length],
    ['Squares marked', mine.length], ['On the Life List', lifeList().length],
    ['Photos taken', S.photos.size],
  ];
  $('#stats').innerHTML = rows.map(([k, v]) =>
    `<div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1.5px solid var(--hairline)">
      <span style="color:var(--ink-muted);font-size:13.5px">${k}</span>
      <span style="font:600 17px var(--display);font-variant-numeric:tabular-nums">${v}</span></div>`).join('');
  $('#aboutNote').textContent =
    `Springo, prototype build.\n` +
    `Sync: ${sync.cloudState() === true ? 'on' : sync.cloudState() === false ? 'not deployed, local only' : 'checking'}\n` +
    `Reference photos: iNaturalist and Wikimedia Commons, open licences only, credited per square.\n` +
    `Boards and full-size photos stay on this device. In a shared game your marks\n` +
    `and a thumbnail of each photo go to the server so other players can see them.`;
}

/* ------------------------------------------------- generate + review list */
/** Resolve a few at a time so the review screen fills in rather than stalling. */
async function resolvePhotos(items, onEach) {
  const queue = items.filter(i => !i.photoTried);
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const it = queue.shift();
      it.photoTried = true;
      const got = await findRefPhoto(it);
      if (got) { it.photo = got.url; it.credit = got.credit; }
      onEach(it);
    }
  });
  await Promise.all(workers);
}

/** Where the page is hosted with no function behind it but Claude reachable
 *  directly, generation still works: same rules, asked from the browser. Inert
 *  anywhere window.claude is absent, which is every normal deployment. */
async function generateViaClaude(theme, region) {
  if (typeof window.claude?.use !== 'function') return null;
  const sample = await window.claude.use('sample');
  if (!sample) return null;
  const data = await sample.json(
    `${SYSTEM}\n\n${JSON_SHAPE}\n\n${userMessage({ theme, region })}`,
    { modelTier: 'default' },
  );
  if (!data || !Array.isArray(data.items)) return null;
  // the server normalises keys; do the same here so both paths agree
  const seen = new Set();
  const screen = data.kind === 'screen';
  data.items = data.items.map(it => {
    let key = String(it.label || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
    while (seen.has(key)) key += '-x';
    seen.add(key);
    const rarity = Math.min(5, Math.max(1, Math.round(Number(it.rarity) || 3)));
    return { key, label: it.label, sci: screen ? undefined : (it.sci || undefined),
             hint: it.hint, icon: ICON_NAMES.includes(it.icon) ? it.icon : 'mark', rarity };
  });
  if (screen) data.runtime = data.runtime || 45;
  return data;
}

async function generateList() {
  const theme = $('#themeIn').value.trim();
  const region = $('#regionIn').value.trim();
  if (theme.length < 3) { toast('Give it a few more words.'); return; }
  const note = $('#genNote'), btn = $('#genBtn');
  note.hidden = false;
  note.innerHTML = '<span class="spin"></span> ';
  note.append(`Building a list for "${theme}". This can take up to a minute.`);
  btn.disabled = true;
  try {
    let data = null;
    const res = await fetch('/api/springo/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme, region }),
    }).catch(() => null);

    if (res && res.ok) {
      data = await res.json();
    } else if (!res || res.status === 404 || res.status === 503) {
      // no function behind this deployment; ask Claude from the page instead
      note.innerHTML = '<span class="spin"></span> Asking Claude for a list. '
        + 'This takes up to a minute the first time.';
      try {
        data = await generateViaClaude(theme, region);
      } catch (e) {
        if (e && e.code === 'not_granted') throw new Error('Generation needs your permission to ask Claude. Reload and allow it, or use a ready-made pack below.');
        if (e && e.code === 'rate_limited') throw new Error('Too many requests just now. Give it a minute.');
        throw new Error('Claude could not build that list. The ready-made packs still work.');
      }
      if (!data) throw new Error('Theme generation is not switched on here. The ready-made packs below work with no server at all.');
    } else if (res.status === 429) {
      throw new Error((await res.json()).error || 'Too many new themes today.');
    } else {
      // Netlify's own crash page is HTML, so only a JSON body carries a message
      const msg = (await res.json().catch(() => null))?.error;
      throw new Error(msg && res.status === 504 ? msg : 'Generation failed. The ready-made packs still work.');
    }
    if (!data.usable) throw new Error(data.reason || 'That theme will not make a findable board.');
    if (!data.items?.length) throw new Error('Nothing usable came back.');
    note.hidden = true;
    S.review = {
      theme, region, title: data.title || theme, subtitle: data.subtitle || '',
      kind: data.kind === 'screen' ? 'screen' : 'outdoor', runtime: data.runtime || null,
      items: data.items.map(i => ({ ...i, keep: true })),
    };
    renderReview();
    setView('review');
    // nothing on a screen board has a reference photo to find
    if (S.review.kind !== 'screen') resolvePhotos(S.review.items, () => renderReview());
  } catch (e) {
    note.hidden = false;
    note.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

function renderReview() {
  const R = S.review; if (!R) return;
  $('#revTitle').textContent = R.title;
  $('#revSub').textContent = R.subtitle;
  const kept = R.items.filter(i => i.keep).length;
  const screenPack = R.kind === 'screen';
  const pending = screenPack ? 0 : R.items.filter(i => i.sci && !i.photoTried).length;
  $('#revCount').textContent =
    `${kept} kept of ${R.items.length}. A board uses 24, drawn with a rarity spread.\n` +
    (kept < 24 ? `Keep ${24 - kept} more before you can start.\n` : '') +
    (screenPack
      ? `Watched on a screen, about ${R.runtime || 45} minutes. No reference photos: there is nothing to photograph, so the hint is what settles an argument.`
      : pending ? `Looking up ${pending} more reference photos.` : '');
  $('#revNext').textContent = kept < 24 ? `Keep ${24 - kept} more` : `Use these ${kept}`;
  $('#revNext').disabled = kept < 24;

  const el = $('#revGrid'); el.textContent = '';
  for (const it of R.items) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'revitem';
    b.setAttribute('aria-pressed', it.keep ? 'true' : 'false');
    b.setAttribute('aria-label', `${it.label}, ${it.keep ? 'kept' : 'dropped'}`);
    const im = document.createElement('span'); im.className = 'im';
    if (it.photo) im.style.backgroundImage = cssUrl(it.photo);
    else im.append(icon(it.icon, { key: it.key }));
    if (screenPack) im.classList.add('noimg');
    const bd = document.createElement('span'); bd.className = 'bd';
    const t = document.createElement('span'); t.className = 't'; t.textContent = it.label;
    bd.append(t);
    if (it.sci) { const sc = document.createElement('span'); sc.className = 'sci'; sc.textContent = it.sci; bd.append(document.createElement('br'), sc); }
    const h = document.createElement('span'); h.className = 'h'; h.textContent = it.hint || '';
    bd.append(document.createElement('br'), h);
    const r = document.createElement('span'); r.className = 'r'; r.textContent = 'r' + it.rarity;
    b.append(im, bd, r);
    b.addEventListener('click', () => { it.keep = !it.keep; renderReview(); });
    el.append(b);
  }
}

/** The reviewed list becomes a real pack, stored locally, so the game it makes
 *  opens offline like any other. */
async function packFromReview() {
  const R = S.review;
  const items = R.items.filter(i => i.keep).map(i => ({
    key: i.key, label: i.label, sci: i.sci, hint: i.hint,
    rarity: i.rarity, icon: i.icon, photo: i.photo,
  }));
  const credits = {};
  for (const i of R.items) if (i.keep && i.credit) credits[i.key] = i.credit;
  const screenPack = R.kind === 'screen';
  const p = {
    id: 'custom-' + uid(), title: R.title, subtitle: R.subtitle,
    region: R.region || null, season: null, accent: 'beauty',
    kind: screenPack ? 'screen' : undefined,
    runtime: screenPack ? (R.runtime || 45) : undefined,
    // outdoor items carry absolute iNaturalist or Commons URLs; a screen board has none
    photoDir: screenPack ? null : '',
    credits: screenPack ? {} : credits,
    items, custom: true, theme: R.theme, createdAt: Date.now(),
  };
  await packs.put(p);
  S.packs[p.id] = p;
  return p;
}

/** Ask the service worker to download a pack's reference photos now, so they
 *  are there when there is no signal. Best effort and silent on failure. */
async function warmPackPhotos(p) {
  if (!p || !('serviceWorker' in navigator)) return;
  const urls = p.items.map(i => refSrc(p, i)).filter(Boolean)
    .map(u => new URL(u, location.href).href);
  if (!urls.length) return;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(r => setTimeout(() => r(null), 3000)),
    ]);
    if (!reg) return;                 // no service worker here; nothing to warm
    (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'warm', urls });
  } catch { /* the sheet's empty state is honest */ }
}

navigator.serviceWorker?.addEventListener('message', e => {
  const d = e.data;
  if (d?.type === 'warmed' && d.stored) {
    toast(`${d.stored} reference photo${d.stored === 1 ? '' : 's'} saved for offline.`);
  }
});

/* ------------------------------------------------------------------ boot */
async function refresh() {
  S.games = (await games.all()).sort((a, b) => b.createdAt - a.createdAt);
  S.marks = await marks.all();
  for (const g of S.games) await loadPack(g.packId).catch(() => {});
  S.queued = await outbox.count();
  renderAll();
}

function renderAll() {
  const g = game();
  if (g) applyAccent(g.accent);
  renderChips();
  if (g) { renderScore(); renderBoard(); setScreenTitle(pack(g)?.title || ''); }
  if (S.view === 'board' && !g) setView('new');
}

async function boot() {
  S.me = await me();
  for (const id of PACK_IDS) await loadPack(id).catch(e => console.warn('pack', id, e));
  for (const p of await packs.all()) if (p.custom) S.packs[p.id] = p;

  // restore photos for boards we can paint
  const all = await games.all();
  for (const g of all) {
    for (let i = 0; i < 25; i++) {
      const rec = await photos.get(`${g.id}:${S.me.id}:${i}`);
      if (rec) S.photos.set(rec.id, { ...rec, thumbUrl: URL.createObjectURL(rec.thumb) });
    }
  }
  await refresh();

  if (!S.me.name) { setView('you'); toast('Pick a name so other players know who you are.'); }
  else if (!S.games.length) setView('new');
  else setView('board');

  sync.probe().then(() => { renderSyncbar(); sync.syncAll().then(n => { if (n) refresh(); }); });

  const join = new URLSearchParams(location.search).get('join');
  if (join) { $('#joinCode').value = join.toUpperCase(); setView('new'); joinByCode(join); }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // a cache can be cleared under a game; top it back up while there is signal
    for (const id of new Set(S.games.map(g => g.packId))) warmPackPhotos(S.packs[id]);
  }
}

/* ----------------------------------------------------------------- events */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  closeSheet();
  const v = t.dataset.view;
  if (v === 'board' && !game()) { setView('new'); return; }
  setView(v);
}));
$('#scrim').addEventListener('pointerdown', dismissSheet);
$('#shutter').addEventListener('click', fromVideo);
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files?.[0]; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = async () => { URL.revokeObjectURL(url); applyCapture(await processCapture(im, im.naturalWidth, im.naturalHeight, f.size)); };
  im.onerror = () => { URL.revokeObjectURL(url); toast('That file could not be read as an image.'); };
  im.src = url; e.target.value = '';
});
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  S.setup.mode = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
}));
document.querySelectorAll('[data-varied]').forEach(b => b.addEventListener('click', () => {
  S.setup.varied = b.dataset.varied === '1';
  document.querySelectorAll('[data-varied]').forEach(x => x.setAttribute('aria-pressed', x === b));
  renderSetupNote();
}));
$('#createBtn').addEventListener('click', createGame);
$('#genBtn').addEventListener('click', generateList);
$('#themeIn')?.addEventListener('keydown', e => { if (e.key === 'Enter') generateList(); });
$('#revBack').addEventListener('click', () => { S.review = null; setView('new'); });
$('#revNext').addEventListener('click', async () => {
  const p = await packFromReview();
  S.setup = { packId: p.id, mode: 'honor', varied: isScreen(p) };
  openSetup();
});
$('#addItem').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const label = e.target.value.trim();
  if (!label || !S.review) return;
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
            || 'item-' + S.review.items.length;
  S.review.items.push({ key, label, sci: null, hint: 'Added by you.', icon: 'mark', rarity: 3, keep: true });
  e.target.value = '';
  renderReview();
});
$('#cancelSetup').addEventListener('click', () => setView('new'));
$('#toBoardBtn').addEventListener('click', () => setView('board'));
$('#shareBtn').addEventListener('click', async () => {
  const g = game(); if (!g) return;
  const url = location.origin + location.pathname + '?join=' + g.code;
  const data = { title: 'Springo', text: `Play ${pack(g)?.title} with me. Code ${g.code}.`, url };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(url); toast('Link copied.'); }
  } catch {}
});
$('#joinBtn').addEventListener('click', () => {
  const c = $('#joinCode').value.trim().toUpperCase();
  if (c.length === 6) joinByCode(c); else toast('A code is six characters.');
});
$('#themeOpts').addEventListener('click', e => {
  const b = e.target.closest('[data-theme-choice]');
  if (b) applyTheme(b.dataset.themeChoice);
});
$('#saveName').addEventListener('click', async () => {
  const n = $('#nameIn').value.trim();
  if (!n) { toast('Names help when two boards look alike.'); return; }
  S.me = await setName(n);
  for (const g of S.games) {
    const p = g.players.find(x => x.id === S.me.id);
    if (p && p.name !== S.me.name) {
      p.name = S.me.name;
      await games.put(g);
      if (g.shared) await outbox.add({ id: 'player-' + g.id + '-' + S.me.id, gameId: g.id,
                                       event: { type: 'player', player: { id: S.me.id, name: S.me.name } } });
    }
  }
  toast('Saved.');
  renderAll();
  if (!S.games.length) setView('new');
});
$('#syncBtn').addEventListener('click', async () => {
  const n = await sync.syncAll();
  S.queued = await outbox.count();
  if (n) { await refresh(); toast(n + ' new mark' + (n === 1 ? '' : 's')); }
  else toast(sync.cloudState() === false ? 'No sync server deployed.' : 'Up to date.');
});
addEventListener('online', () => sync.syncAll().then(n => { if (n) refresh(); else renderSyncbar(); }));
addEventListener('visibilitychange', () => { if (!document.hidden) sync.syncAll().then(n => { if (n) refresh(); }); });

injectSprite();
boot();
