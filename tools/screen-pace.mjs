#!/usr/bin/env node
// Reproduces the pacing and tie tables in docs/09-screen-mode.md.
// Run: node tools/screen-pace.mjs
// Does bingo actually land inside one episode?
// Outdoor Springo takes ~13 of 24 marks. Over a season that is weeks. Over a
// 45-minute episode it has to be ~13 triggers, and they have to arrive at a
// rate that lands a win late but not never.
//
// Model: each item fires as a Poisson process over the runtime. A square is
// marked the first time its trope occurs, so
//   P(marked by t) = 1 - exp(-rate * t / RUNTIME)

const ROWS=[],COLS=[];
for(let r=0;r<5;r++){ROWS.push([0,1,2,3,4].map(c=>r*5+c));COLS.push([0,1,2,3,4].map(rr=>rr*5+r));}
const LINES=[...ROWS,...COLS,[0,6,12,18,24],[4,8,12,16,20],
  [0,1,5,6],[3,4,8,9],[15,16,20,21],[18,19,23,24]].map(l=>new Set(l));

// expected occurrences per episode, by rarity tier
const RATE = { 1: 5.0, 2: 2.5, 3: 1.2, 4: 0.5, 5: 0.15 };

function board(mix, rand){
  const tiers=[];
  for(const [tier,n] of Object.entries(mix)) for(let i=0;i<n;i++) tiers.push(+tier);
  for(let i=tiers.length-1;i>0;i--){const j=(rand()*(i+1))|0;[tiers[i],tiers[j]]=[tiers[j],tiers[i]];}
  return tiers;
}

function run(mix, runtime=45, trials=200000){
  const times=[], marksAtWin=[]; let never=0;
  for(let t=0;t<trials;t++){
    const tiers = board(mix, Math.random);
    // first-occurrence time for each square, Infinity if it never happens
    const firsts=[]; let k=0;
    for(let i=0;i<25;i++){
      if(i===12){firsts.push(0);continue;}          // free space
      const rate=RATE[tiers[k++]];
      const u=Math.random();
      const tt = -Math.log(1-u)/rate*runtime;        // exponential
      firsts.push(tt<=runtime?tt:Infinity);
    }
    // earliest time any line is complete = min over lines of (max first in line)
    let best=Infinity, bestMarks=0;
    for(const L of LINES){
      let mx=0; for(const c of L) mx=Math.max(mx,firsts[c]);
      if(mx<best) best=mx;
    }
    if(best===Infinity){never++;continue;}
    for(let i=0;i<25;i++) if(firsts[i]<=best) bestMarks++;
    times.push(best); marksAtWin.push(bestMarks);
  }
  times.sort((a,b)=>a-b);
  const q=p=>times.length?times[Math.floor(p*(times.length-1))]:NaN;
  return { neverPct:+(100*never/trials).toFixed(1),
    p10:+q(.10).toFixed(1), median:+q(.5).toFixed(1), p90:+q(.90).toFixed(1),
    meanMarks:+(marksAtWin.reduce((a,b)=>a+b,0)/marksAtWin.length).toFixed(1) };
}

const MIXES = {
  'outdoor spread 6/12/6 (r1,2 / r3 / r4,5)': {1:3,2:3,3:12,4:3,5:3},
  'all common (r1 x24)':                      {1:24},
  'common heavy 12/8/4':                      {1:6,2:6,3:8,4:3,5:1},
  'balanced 8/8/8':                           {1:4,2:4,3:8,4:4,5:4},
  'rare heavy':                               {1:2,2:4,3:6,4:8,5:4},
};
console.log('45-minute episode, 200k trials\n');
console.log('mix'.padEnd(44),'never%'.padStart(7),'p10'.padStart(6),'med'.padStart(6),'p90'.padStart(6),'marks'.padStart(6));
for(const [name,mix] of Object.entries(MIXES)){
  const r=run(mix);
  console.log(name.padEnd(44), String(r.neverPct).padStart(7), String(r.p10).padStart(6),
    String(r.median).padStart(6), String(r.p90).padStart(6), String(r.meanMarks).padStart(6));
}
console.log('\nsame mixes over a 100-minute film (balanced 8/8/8):', JSON.stringify(run(MIXES['balanced 8/8/8'],100)));
console.log('22-minute sitcom (common heavy):          ', JSON.stringify(run(MIXES['common heavy 12/8/4'],22)));


/* ---------- same items versus varied items, the tie question ---------- */
(function tieStudy(){
const ROWS=[],COLS=[];
for(let r=0;r<5;r++){ROWS.push([0,1,2,3,4].map(c=>r*5+c));COLS.push([0,1,2,3,4].map(rr=>rr*5+r));}
const LINES=[...ROWS,...COLS,[0,6,12,18,24],[4,8,12,16,20],
  [0,1,5,6],[3,4,8,9],[15,16,20,21],[18,19,23,24]];
const RATE={1:5.0,2:2.5,3:1.2,4:0.5,5:0.15};
const MIX={1:6,2:6,3:8,4:3,5:1};                 // the common-heavy mix that paces well
const RUNTIME=45, TRIALS=200000;

function tierList(rand){
  const t=[]; for(const [k,n] of Object.entries(MIX)) for(let i=0;i<n;i++) t.push(+k);
  for(let i=t.length-1;i>0;i--){const j=(rand()*(i+1))|0;[t[i],t[j]]=[t[j],t[i]];}
  return t;
}
const firstTime = tier => { const u=Math.random(); const t=-Math.log(1-u)/RATE[tier]*RUNTIME; return t<=RUNTIME?t:Infinity; };
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];} return a; }

function winTime(firstsByCell){
  let best=Infinity;
  for(const L of LINES){ let mx=0; for(const c of L) mx=Math.max(mx,firstsByCell[c]); if(mx<best) best=mx; }
  return best;
}
function layout(itemFirsts){                      // place 24 item-times into 25 cells
  const s=shuffle(itemFirsts.slice()); const cells=[];
  for(let i=0,k=0;i<25;i++) cells.push(i===12?0:s[k++]);
  return cells;
}

let sameTie=0, sameBoth=0, variedTie=0, variedBoth=0, sameNo=0, variedNo=0;
for(let t=0;t<TRIALS;t++){
  // SAME ITEMS: one set of trope times, two layouts
  const tiers=tierList(Math.random);
  const shared=tiers.map(firstTime);
  const a=winTime(layout(shared)), b=winTime(layout(shared));
  if(a===Infinity&&b===Infinity) sameNo++; else { sameBoth++; if(a===b) sameTie++; }

  // VARIED ITEMS: each player has their own items, so their own trope times
  const av=winTime(layout(tierList(Math.random).map(firstTime)));
  const bv=winTime(layout(tierList(Math.random).map(firstTime)));
  if(av===Infinity&&bv===Infinity) variedNo++; else { variedBoth++; if(av===bv) variedTie++; }
}
const pct=(n,d)=>(100*n/d).toFixed(1)+'%';
console.log('two players, 45-minute episode, 200k trials\n');
console.log('SAME items (shuffled layout)  exact-tie:', pct(sameTie,sameBoth),
            ' no winner:', pct(sameNo,TRIALS));
console.log('VARIED items (own list)       exact-tie:', pct(variedTie,variedBoth),
            ' no winner:', pct(variedNo,TRIALS));
})();
