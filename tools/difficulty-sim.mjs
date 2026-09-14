#!/usr/bin/env node
// Monte Carlo over Springo boards. Produces the difficulty table in
// docs/02-game-rules.md. Run: node tools/difficulty-sim.mjs [trials]
//
// Marks are drawn in uniformly random order, which models "you see things in
// whatever order nature offers them". Real play skews toward the common items
// first, so these numbers are a mild overestimate of time to bingo.

const N = Number(process.argv[2] || 400000);

const ROWS = [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c));
const COLS = [0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c));
const DIAGS = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
const STAMPS = [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]];

const allLines = withStamps => [
  ...ROWS.map(c => ['row', c]),
  ...COLS.map(c => ['col', c]),
  ...DIAGS.map(c => ['diag', c]),
  ...(withStamps ? STAMPS.map(c => ['stamp', c]) : []),
];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function run(freeSpace, withStamps, trials = N) {
  const lines = allLines(withStamps);
  const counts = [];
  const byKind = { row: 0, col: 0, diag: 0, stamp: 0 };
  let oneAwayLead = 0;

  for (let t = 0; t < trials; t++) {
    const cells = shuffle([...Array(25).keys()].filter(i => !(freeSpace && i === 12)));
    const marked = new Set(freeSpace ? [12] : []);
    let n = 0, firstOneAway = null;

    for (const c of cells) {
      marked.add(c); n++;
      let won = null, oneAway = false;
      for (const [kind, cellsOfLine] of lines) {
        let missing = 0;
        for (const x of cellsOfLine) if (!marked.has(x)) missing++;
        if (missing === 0) { won = kind; break; }
        if (missing === 1) oneAway = true;
      }
      if (oneAway && firstOneAway === null) firstOneAway = n;
      if (won) { byKind[won]++; oneAwayLead += n - (firstOneAway ?? n); break; }
    }
    counts.push(n);
  }

  counts.sort((a, b) => a - b);
  const q = p => counts[Math.floor(p * (counts.length - 1))];
  return {
    mean: +(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2),
    p10: q(0.10), median: q(0.5), p90: q(0.90),
    min: counts[0], max: counts.at(-1),
    oneAwayMarks: +(oneAwayLead / trials).toFixed(2),
    winShare: Object.fromEntries(
      Object.entries(byKind).map(([k, v]) => [k, +(100 * v / trials).toFixed(1)])),
  };
}

const cases = [
  ['free space + stamps (default)', true, true],
  ['free space, lines only', true, false],
  ['no free space + stamps', false, true],
  ['no free space, lines only', false, false],
];

console.log(`trials: ${N.toLocaleString()}\n`);
console.log('ruleset'.padEnd(32), 'mean'.padStart(6), 'p10'.padStart(4), 'med'.padStart(4), 'p90'.padStart(4), 'min'.padStart(4), 'max'.padStart(4));
for (const [name, f, s] of cases) {
  const r = run(f, s);
  console.log(name.padEnd(32), String(r.mean).padStart(6), String(r.p10).padStart(4),
    String(r.median).padStart(4), String(r.p90).padStart(4),
    String(r.min).padStart(4), String(r.max).padStart(4));
}
const d = run(true, true);
console.log('\ndefault ruleset detail');
console.log('  win pattern share:', d.winShare);
console.log('  marks spent one-away before winning:', d.oneAwayMarks);
