// node tools/test.mjs — checks the question bank and plays every unit through with computer players on a fake clock
import * as D from '../js/data.js';
import * as U from '../js/units.js';
let t = 1e12; Date.now = () => t;
const { H, newShow, tick, onAction } = await import('../js/host.js');
const bad = (m) => { console.log('BAD', m); process.exitCode = 1; };
const len = (s) => [...s].length;
console.log('idioms', D.IDIOMS.length, 'all', U.IDIOM.size);
for (const w of D.IDIOMS) if (len(w) !== 4) bad('idiom ' + w);
for (const [a, src] of D.SS) {
  const cs = [...a]; let ok = false;
  const perm = (arr, used = []) => { if (used.length === 4) { if (used.every((k, i) => [...src[k]].includes(cs[i]))) ok = true; return; } for (let k = 0; k < 4; k++) if (!used.includes(k)) perm(arr, [...used, k]); };
  perm(src); if (!ok) bad('SS ' + a);
  if (src.includes(a)) bad('SS answer among sources ' + a);
}
for (const [cl, a] of D.ZZ) if (len(cl) !== 4 || len(a) !== 1 || cl.includes(a)) bad('ZZ ' + cl);
for (const q of D.QW) if (len(q[0]) !== 1 || len(q[2]) !== 1) bad('QW ' + q);
for (const q of D.TJ) if (len(q[0]) !== 2) bad('TJ ' + q);
for (const [zy, w, a, alts] of D.TY) { if (!w.includes('＿') || len(a) !== 1 || alts.includes(a)) bad('TY ' + w); }
for (const [s, ok, b] of D.ZY) for (const c of ok) if (b.includes(c)) bad('ZY both ' + c);
for (const [p, a] of D.HZ) if (len(a) !== 4) bad('HZ ' + a);
for (const [s, r, alts] of D.ZW) { if (!/\[.\]/u.test(s)) bad('ZW ' + s); if (alts.includes(r)) bad('ZW alt ' + s); const w = s.match(/\[(.)\]/u)[1]; if (w === r) bad('ZW same ' + s); }
for (const [a, b] of D.JC_WRITE) if (a === b || len(a) !== len(b)) bad('JC ' + a);
const seen = new Set(); for (const x of D.CZ) { if (seen.has(x.ch)) bad('CZ dup ' + x.ch); seen.add(x.ch); }
console.log('cz', D.CZ.length, 'tz patterns', U.tzPatterns().length, U.tzPatterns().slice(0, 12).map((p) => p.mask + p.ans.length).join(' '));
for (const u of Object.keys(U.UNITS)) { const X = U.UNITS[u]; if (X.gen && X.kind !== 'sprint') { for (let i = 0; i < 20; i++) { const qs = X.gen(X.n || 1); for (const q of [].concat(qs)) if (q.ans && !U.check(q, q.ans)) bad('check ' + u + ' ' + q.ans); } } }
// play every unit with four computer players
const states = []; H.send = (m) => states.push(m.S.phase);
for (const u of U.ORDER) {
  const bots = [0, 1, 2, 2].map((lv, i) => ({ id: 'b' + i, n: 'b' + i, bot: true, lv }));
  newShow(bots, 'unit', u);
  let n = 0; while (H.S.phase !== 'end' && n < 200000) { t += 200; tick(); n++; }
  console.log(u.padEnd(3), H.S.phase, 'steps', n, 'champ', H.S.champ, H.S.players.map((p) => p.score).join('/'), H.S.round?.log?.slice(0, 2).join(' | ') || '');
  if (H.S.phase !== 'end') bad('stuck ' + u + ' ' + H.S.phase);
}
newShow([0, 1, 2].map((lv, i) => ({ id: 'b' + i, n: 'b' + i, bot: true, lv })), 'show');
let n = 0; while (H.S.phase !== 'end' && n < 400000) { t += 200; tick(); n++; }
console.log('show', H.S.plan.join(','), H.S.phase, H.S.champ);
console.log(process.exitCode ? 'FAILED' : 'all ok');
