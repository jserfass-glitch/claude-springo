// Theme generation. You type "Arkansas spring ephemerals", this proposes a pool
// of items, and the app shows them to you for review before any board exists.
//
// The review screen is the point. Generation alone fails three ways at once:
// wrong facts, impossible difficulty, and abusive input. See
// docs/05-architecture.md and docs/03-ux.md.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getStore } from '@netlify/blobs';
import { SYSTEM, userMessage, POOL } from '../../app/prompt.js';

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const ok = b => new Response(JSON.stringify(b), { status: 200, headers: HEADERS });
const bad = (s, m) => new Response(JSON.stringify({ error: m }), { status: s, headers: HEADERS });

const DAILY_LIMIT = 12;        // generation is the one cost that scales with abuse

const Item = z.object({
  label: z.string().describe('Short name a player reads on a square, 1 to 4 words'),
  sci: z.string().nullable()
    .describe('Scientific name if this is a real living species. Null for everything else, and ALWAYS null on a screen board'),
  hint: z.string().describe('One line telling a non-expert what counts, so two players agree'),
  emoji: z.string().describe('A single emoji'),
  rarity: z.number().int().min(1).max(5)
    .describe('Outdoor: 1 you will see it today, 5 a good year. Screen: 1 several times an episode, 5 once in a season'),
});
const Result = z.object({
  usable: z.boolean().describe('False if the theme cannot be turned into a safe, playable board'),
  reason: z.string().nullable().describe('If not usable, one sentence a player would understand'),
  kind: z.enum(['outdoor', 'screen'])
    .describe('outdoor = found by going outside. screen = watched on a TV, film or live event'),
  runtime: z.number().int().nullable()
    .describe('Screen boards only: minutes in one sitting, e.g. 22, 45, 100. Null for outdoor'),
  title: z.string().describe('A short name for this pack, 2 to 4 words'),
  subtitle: z.string().describe('One short line: what and where and when'),
  items: z.array(Item),
});


const norm = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 120);

export default async (req) => {
  if (req.method === 'GET') return ok({ ping: 'springo-generate', enabled: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return bad(405, 'POST only');
  if (!process.env.ANTHROPIC_API_KEY) return bad(503, 'generation not configured');

  let body;
  try { body = await req.json(); } catch { return bad(400, 'bad json'); }
  const theme = norm(body.theme);
  if (theme.length < 3) return bad(400, 'theme too short');
  const region = norm(body.region);
  const season = norm(body.season);

  const store = getStore('springo');
  const cacheKey = 'gen:' + [theme, region, season].filter(Boolean).join('|');

  const hit = await store.get(cacheKey, { type: 'json' }).catch(() => null);
  if (hit) return ok({ ...hit, cached: true });

  // one bucket per client per day; cheap, and it is the only thing here that
  // costs real money per call
  const who = req.headers.get('x-nf-client-connection-ip') || 'anon';
  const day = new Date().toISOString().slice(0, 10);
  const rlKey = `rl:${day}:${who}`;
  const used = (await store.get(rlKey, { type: 'json' }).catch(() => null))?.n || 0;
  if (used >= DAILY_LIMIT) return bad(429, `that is ${DAILY_LIMIT} new themes today. Existing packs are unlimited.`);

  const client = new Anthropic();
  let parsed;
  try {
    const res = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      // medium rather than the default: the task is list generation, and this
      // call sits in front of a person waiting on the Create screen. Drop to
      // "low" if your function timeout is tight.
      output_config: { effort: 'medium', format: zodOutputFormat(Result) },
      messages: [{
        role: 'user',
        content: userMessage({ theme: body.theme, region: body.region, season: body.season }),
      }],
    });
    if (res.stop_reason === 'refusal') {
      return ok({ usable: false, reason: 'That theme was declined.', items: [] });
    }
    parsed = res.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return bad(429, 'busy, try again in a minute');
    console.error('generate failed', e);
    return bad(502, 'generation failed');
  }
  if (!parsed) return bad(502, 'generation returned nothing usable');

  // keys are what the Life List joins on, so normalise them here, once
  const seen = new Set();
  const items = (parsed.items || []).map(it => {
    let key = String(it.label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    while (seen.has(key)) key += '-x';
    seen.add(key);
    return { key, label: it.label, sci: it.sci || undefined, hint: it.hint, emoji: it.emoji, rarity: it.rarity };
  });

  const screen = parsed.kind === 'screen';
  const payload = {
    usable: parsed.usable, reason: parsed.reason,
    kind: parsed.kind, runtime: screen ? (parsed.runtime || 45) : null,
    title: parsed.title, subtitle: parsed.subtitle,
    // a screen item has nothing to look up, so never let a stray name through
    items: screen ? items.map(({ sci, ...rest }) => rest) : items,
  };
  if (parsed.usable && items.length >= 24) {
    await store.setJSON(cacheKey, payload).catch(() => {});
  }
  await store.setJSON(rlKey, { n: used + 1 }).catch(() => {});
  return ok({ ...payload, cached: false });
};

export const config = { path: '/api/springo/generate' };
