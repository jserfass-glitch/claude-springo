#!/usr/bin/env node
// Springo ships as a normal web app (app/index.html). A published Artifact is
// wrapped in its own document skeleton, so a hosted try-it build needs the same
// page with the document wrapper removed. One source of truth, one transform.
//
// Usage: node tools/build-artifact-entry.mjs <outfile>

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'app', 'index.html'), 'utf8');
const out = process.argv[2];
if (!out) { console.error('usage: build-artifact-entry.mjs <outfile>'); process.exit(1); }

const pick = (tag, html) => {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
};
const head = pick('head', src);
const body = pick('body', src);
if (!head || !body) { console.error('could not find head/body in app/index.html'); process.exit(1); }

// keep only what the wrapper does not already supply
// inline head scripts come too: the theme pre-apply has to run before paint
const keep = (head.match(
  /<(?:title|link)\b[^>]*>(?:[\s\S]*?<\/title>)?|<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [])
  .filter(t => !/rel=["']manifest["']/i.test(t))
  .filter(t => !/rel=["'](?:apple-touch-)?icon["']/i.test(t));

writeFileSync(out,
`${keep.join('\n')}
<!-- Built from app/index.html by tools/build-artifact-entry.mjs. Edit that file. -->
${body.trim()}
`);
console.log(`wrote ${out}`);
console.log('kept from head:', keep.map(t => t.slice(0, 58).replace(/\s+/g, ' ')).join('\n                ') || '(nothing)');
