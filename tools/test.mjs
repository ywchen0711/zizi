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
// the made-up pools
const PL = await import('../js/pools.js'), D2 = await import('../js/data2.js');
console.log('pools', JSON.stringify(PL.counts()), 'tz', U.tzPatterns().length);
for (const [k, n] of Object.entries(PL.counts())) if (['jc', 'zz', 'ss', 'qw', 'tj', 'ty', 'hz', 'zw', 'dd'].includes(k) && n < 200) bad('pool too small ' + k + ' ' + n);
const hs = new Map(); for (const line of D2.HOMO.trim().split(String.fromCharCode(10))) for (const c of line.trim().split(/\s+/)[1]) { if (hs.has(c)) bad('HOMO twice ' + c); hs.set(c, 1); }
for (const [a, b] of PL.JC_W) if (a === b || PL.IDIOM.has(b) && a !== b && !D.JC_WRITE.some((x) => x[1] === b)) bad('JC ' + a + b);
for (const [zy, w, a, alts] of PL.TY_ALL) if (alts.includes(a) || !w.includes('＿')) bad('TY ' + w);
for (const [ch, ps, ex] of PL.QW_ALL) if (len(ps) !== 3 || ps.includes(ex) || len(ch) !== 1) bad('QW ' + ch + ps + ex);
for (const [w, ps] of PL.TJ_ALL) if (len(w) !== 2 || len(ps) < 3 || len(ps) > 6) bad('TJ ' + w + ps);
for (const [s, ok, b] of PL.ZY_ALL) for (const c of ok) if (b.includes(c)) bad('ZY ' + s + c);
for (const [s, r, alts] of PL.ZW_ALL) { const m = s.match(/\[(.)\]/u); if (!m || m[1] === r || alts.includes(r)) bad('ZW ' + s); }
for (const [a, src] of PL.SS_ALL) if (src.length !== 4 || src.includes(a)) bad('SS ' + a);
for (let i = 0; i < 300; i++) { const q = U.UNITS.zz.gen(1)[0], clues = [...q.p.matchAll(/<b>(.)<\/b>/gu)].map((m) => m[1]); for (const t of q.tiles) if (t !== q.ans && PL.zzFits(clues).includes(t)) bad('zz tile fits ' + t); }
console.log('samples');
for (const u of ['jc', 'zz', 'ss', 'qw', 'tj', 'ty', 'zw']) { const q = U.UNITS[u].gen(1)[0]; console.log(' ', u, q.p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50), '|', (q.opts || q.tiles || q.groups || q.sent || []).join('').slice(0, 30), '=>', q.ans); }
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
// a set time and number of questions
for (const [u, opt] of [['jc', { sec: 3, n: 4 }], ['zp', { sec: 5 }], ['zf', { sprint: 20 }], ['cz', { sec: 60 }]]) {
  newShow([0, 2].map((lv, i) => ({ id: 'b' + i, n: 'b' + i, bot: true, lv })), 'unit', u, opt);
  const t0 = t; let n = 0, qs = 0, firstLeft = null;
  while (H.S.phase !== 'end' && n < 200000) { t += 200; tick(); n++; if (H.S.phase === 'play' && firstLeft == null) firstLeft = H.deadline - t; if (H.S.round?.qs) qs = H.S.round.qs.length; }
  const want = (opt.sec || opt.sprint) * 1000;
  console.log('opt', u, JSON.stringify(opt), 'questions', qs, 'first clock', firstLeft, 'game', Math.round((t - t0) / 1000) + 's');
  if (Math.abs(firstLeft - want) > 400) bad('time ' + u);
  if (opt.n && qs !== opt.n) bad('n ' + u);
}
console.log(process.exitCode ? 'FAILED' : 'all ok');
