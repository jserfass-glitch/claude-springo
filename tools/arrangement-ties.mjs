#!/usr/bin/env node
// Reproduces the arrangement tables in docs/09-screen-mode.md.
// Run: node tools/arrangement-ties.mjs
// Does arranging the boards differently prevent ties on a shared screen?
//
// Setup: same 24 items for both players, one shared arrival order (the trope
// fires once for the room). Only the ARRANGEMENT differs. A player wins at the
// arrival index where some line of theirs first completes.

const ROWS=[],COLS=[];
for(let r=0;r<5;r++){ROWS.push([0,1,2,3,4].map(c=>r*5+c));COLS.push([0,1,2,3,4].map(rr=>rr*5+r));}
const LINES=[...ROWS,...COLS,[0,6,12,18,24],[4,8,12,16,20],
  [0,1,5,6],[3,4,8,9],[15,16,20,21],[18,19,23,24]];

const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};

/** layout = array of 25 cells holding each item's arrival index (free = 0).
 *  Win index = min over lines of (max arrival index in that line). */
const winIndex = cells => {
  let best=Infinity;
  for(const L of LINES){ let mx=0; for(const c of L) mx=Math.max(mx,cells[c]); if(mx<best) best=mx; }
  return best;
};
const place = order => { const s=shuffle(order.slice()); const c=[]; for(let i=0,k=0;i<25;i++) c.push(i===12?0:s[k++]); return c; };

// transforms of a board that people reach for when told "arrange it differently"
const idx=(r,c)=>r*5+c;
const rot90  = b => { const o=new Array(25); for(let r=0;r<5;r++)for(let c=0;c<5;c++) o[idx(c,4-r)]=b[idx(r,c)]; return o; };
const mirror = b => { const o=new Array(25); for(let r=0;r<5;r++)for(let c=0;c<5;c++) o[idx(r,4-c)]=b[idx(r,c)]; return o; };
const rot180 = b => rot90(rot90(b));

const TRIALS=300000;
const order=[...Array(24).keys()].map(i=>i+1);   // arrival indices 1..24, shared

let tiesRandom=0, tiesRot90=0, tiesRot180=0, tiesMirror=0;
const dist=new Map();
for(let t=0;t<TRIALS;t++){
  const A=place(order);
  const wa=winIndex(A);
  dist.set(wa,(dist.get(wa)||0)+1);
  if(winIndex(place(order))===wa) tiesRandom++;
  if(winIndex(rot90(A))===wa)  tiesRot90++;
  if(winIndex(rot180(A))===wa) tiesRot180++;
  if(winIndex(mirror(A))===wa) tiesMirror++;
}
const pct=n=>(100*n/TRIALS).toFixed(1)+'%';
console.log('ties between two players, same items, 300k trials\n');
console.log('  independent random arrangements :', pct(tiesRandom));
console.log('  B is A rotated 90 degrees       :', pct(tiesRot90));
console.log('  B is A rotated 180 degrees      :', pct(tiesRot180));
console.log('  B is A mirrored                 :', pct(tiesMirror));

// why: the win index is a narrow distribution, so two draws collide often
const keys=[...dist.keys()].sort((a,b)=>a-b);
let collision=0;
for(const k of keys){ const p=dist.get(k)/TRIALS; collision+=p*p; }
console.log('\nmarks needed to win (same board geometry, any arrangement):');
console.log('  ' + keys.filter(k=>dist.get(k)/TRIALS>0.01)
  .map(k=>`${k}:${(100*dist.get(k)/TRIALS).toFixed(0)}%`).join('  '));
console.log('\n  predicted collision rate (sum of p^2) :', (100*collision).toFixed(1)+'%');
console.log('  observed random-arrangement tie rate  :', pct(tiesRandom));


/* ---------- more players, and the outdoor contrast ---------- */
(function(){
const ROWS=[],COLS=[];
for(let r=0;r<5;r++){ROWS.push([0,1,2,3,4].map(c=>r*5+c));COLS.push([0,1,2,3,4].map(rr=>rr*5+r));}
const LINES=[...ROWS,...COLS,[0,6,12,18,24],[4,8,12,16,20],
  [0,1,5,6],[3,4,8,9],[15,16,20,21],[18,19,23,24]];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const winIndex=cells=>{let b=Infinity;for(const L of LINES){let m=0;for(const c of L)m=Math.max(m,cells[c]);if(m<b)b=m;}return b;};
const place=order=>{const s=shuffle(order.slice());const c=[];for(let i=0,k=0;i<25;i++)c.push(i===12?0:s[k++]);return c;};
const ORDER=[...Array(24).keys()].map(i=>i+1);
const T=200000;

console.log('SHARED SCREEN, same items, different arrangements');
console.log('players   at least two tie for the win');
for(const n of [2,3,4,5,6]){
  let tied=0;
  for(let t=0;t<T;t++){
    const w=[]; for(let i=0;i<n;i++) w.push(winIndex(place(ORDER)));
    const best=Math.min(...w);
    if(w.filter(x=>x===best).length>1) tied++;
  }
  console.log('  '+n+'       '+(100*tied/T).toFixed(1)+'%');
}

// OUTDOORS the arrival order is NOT shared: each player sees things in their own
// order, because they are looking at different ground at different times.
console.log('\nOUTDOORS, same items, each player their own arrival order');
console.log('players   at least two tie for the win');
for(const n of [2,3,4]){
  let tied=0;
  for(let t=0;t<T;t++){
    const w=[];
    for(let i=0;i<n;i++) w.push(winIndex(place(shuffle(ORDER.slice()))));
    // an outdoor "tie" needs the same COUNT and would still be separated by the
    // clock; this is the most generous reading of a tie
    const best=Math.min(...w);
    if(w.filter(x=>x===best).length>1) tied++;
  }
  console.log('  '+n+'       '+(100*tied/T).toFixed(1)+'%  (and real time separates these further)');
}
})();
