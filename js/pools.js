// Builds every unit's pool of questions from the tables in data.js and data2.js. Some are written out one by one; the
// rest are made from the tables (the homophones, the words, the parts), each checked here so a made-up question
// always has exactly the answer it says.
import { IDIOMS, JC_WRITE, JC_READ, ZZ, SS, QW, TJ, TY, ZY, HZ, ZW, CZ, WZ } from './data.js';
import { MORE_IDIOMS, HOMO, WORDS, FAM, DEC, HZ2, WZ2 } from './data2.js';

const chars = (s) => [...s];
const rnd = (n) => Math.floor(Math.random() * n), pick = (a) => a[rnd(a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---- idioms
export const IDIOM = new Set([...IDIOMS, ...MORE_IDIOMS.split(/\s+/).filter((w) => chars(w).length === 4)]);
for (const q of SS) { IDIOM.add(q[0]); q[1].forEach((w) => IDIOM.add(w)); }
for (const q of [...HZ, ...HZ2]) IDIOM.add(q[1]);
export const ALL = [...IDIOM];

// ---- homophones: one idiom, one character swapped for a sound-alike
const SOUND = new Map(), GROUP = new Map();
for (const line of HOMO.trim().split('\n')) { const [zy, cs] = line.trim().split(/\s+/); for (const c of chars(cs)) { SOUND.set(c, zy); GROUP.set(c, chars(cs)); } }
const swaps = [];
for (const w of ALL) {
  const c = chars(w), spots = c.map((ch, i) => i).filter((i) => GROUP.has(c[i]) && c.indexOf(c[i]) === i);
  if (!spots.length) continue;
  const i = pick(spots), alts = GROUP.get(c[i]).filter((x) => x !== c[i] && !IDIOM.has(c.map((y, k) => (k === i ? x : y)).join('')));
  if (alts.length) swaps.push({ w, i, zy: SOUND.get(c[i]), alts });
}
const wrongOf = (s) => { const c = chars(s.w); c[s.i] = pick(s.alts); return c.join(''); };

// 將錯糾錯: the hand-written pairs, then one per idiom
export const JC_W = [...JC_WRITE, ...swaps.map((s) => [s.w, wrongOf(s)])];
export { JC_READ };
// 聽音寫國字 / 一字千金
export const TY_ALL = [...TY, ...swaps.map((s) => [s.zy, chars(s.w).map((c, k) => (k === s.i ? '＿' : c)).join(''), chars(s.w)[s.i], shuffle(s.alts).slice(0, 4).join('')])];
// 掌握先機: the hand-written sentences, then three idioms in a row with one character wrong
const zwMade = shuffle(swaps).slice(0, 400).map((s) => {
  const wrong = pick(s.alts), c = chars(s.w), others = shuffle(ALL.filter((x) => x !== s.w)).slice(0, 2);
  const bad = c.map((y, k) => (k === s.i ? `[${wrong}]` : y)).join(''), seq = shuffle([bad, ...others]);
  return [seq.join('，') + '。', c[s.i], s.alts.filter((x) => x !== wrong).slice(0, 3).join('')];
}).filter((q) => q[2].length);
export const ZW_ALL = [...ZW, ...zwMade];

// 字有發揮: every sound with enough characters
const BY = new Map();
for (const [c, zy] of SOUND) { const k = zy.replace(/[ˊˇˋ˙]/g, ''); if (!BY.has(k)) BY.set(k, []); BY.get(k).push(c); }
for (const [s, ok] of ZY) { if (!BY.has(s)) BY.set(s, []); for (const c of chars(ok)) if (!BY.get(s).includes(c)) BY.get(s).push(c); }
const INI = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ', ini = (s) => (INI.includes(s[0]) ? s[0] : ''), fin = (s) => s.slice(ini(s).length);
export const ZY_ALL = [...BY.entries()].filter(([, ok]) => ok.length >= 6).map(([s, ok]) => {
  const near = [...BY.entries()].filter(([t]) => t !== s && (ini(t) === ini(s) || fin(t) === fin(s))).flatMap(([, cs]) => cs);
  const hand = ZY.find((z) => z[0] === s);
  const bad = [...new Set([...(hand ? chars(hand[2]) : []), ...shuffle(near)])].filter((c) => !ok.includes(c)).slice(0, 14);
  return [s, ok.join(''), bad.join('')];
}).filter((z) => chars(z[2]).length >= 6);

// 字字珠璣: a key character and the characters it makes words with
const PARTNER = new Map();
for (const line of WORDS.trim().split('\n')) {
  const [k, ...ws] = line.trim().split(/\s+/), ps = [];
  for (const w of ws) { const c = chars(w); if (c.length !== 2 || c[0] === c[1]) continue; const p = c[0] === k ? c[1] : c[1] === k ? c[0] : null; if (p && !ps.includes(p)) ps.push(p); }
  PARTNER.set(k, [...new Set([...(PARTNER.get(k) || []), ...ps])]);
}
for (const [cl, a] of ZZ) PARTNER.set(a, [...new Set([...(PARTNER.get(a) || []), ...chars(cl)])]);
export const ZZ_ALL = [...PARTNER.entries()].filter(([k, ps]) => ps.length >= 4).map(([k, ps]) => ({ key: k, ps, fixed: ZZ.find((z) => z[1] === k)?.[0] }));
// another key that also fits all these clues (the wrong tiles must not)
export const zzFits = (clues) => [...PARTNER.entries()].filter(([, ps]) => clues.every((c) => ps.includes(c))).map(([k]) => k);

// 去無成字: three parts in writing order, and one too many
const famRows = [];
for (const line of FAM.trim().split('\n')) {
  const [, ab, ...rest] = line.trim().split(/\s+/), [a, b] = chars(ab);
  for (const r of rest) { const after = r[0] === '/', [p, ch] = chars(after ? r.slice(1) : r); famRows.push([ch, after ? a + b + p : p + a + b]); }
}
const PARTS = [...new Set([...famRows.flatMap((r) => chars(r[1])), ...QW.flatMap((q) => chars(q[1]))])];
const qwSeen = new Set(QW.map((q) => q[0]));
export const QW_ALL = [...QW, ...famRows.filter((r) => !qwSeen.has(r[0]) && qwSeen.add(r[0])).map(([ch, ps]) => [ch, ps, pick(PARTS.filter((x) => !ps.includes(x)))])];

// 團結一詞: two-character words whose characters both come apart
const SHOW = { 衣: '衤', 示: '礻', 食: '飠', 牛: '牜' };
const PARTS_OF = new Map();
for (const t of DEC.trim().split(/\s+/)) { const [ch, ...ps] = chars(t); PARTS_OF.set(ch, ps); }
for (const [ch, ps] of [...famRows, ...QW.map((q) => [q[0], q[1]])]) if (!PARTS_OF.has(ch)) PARTS_OF.set(ch, chars(ps));
for (const x of CZ) if (!PARTS_OF.has(x.ch)) PARTS_OF.set(x.ch, [SHOW[x.L] || x.L, x.R]);
const tjSeen = new Set(TJ.map((q) => q[0])), tjMade = [];
for (const [k, ps] of PARTNER) for (const p of ps) for (const w of [k + p, p + k]) {
  if (tjSeen.has(w) || !WORDS.includes(w)) continue;
  const [x, y] = chars(w); if (!PARTS_OF.has(x) || !PARTS_OF.has(y) || x === y) continue;
  const parts = [...PARTS_OF.get(x), ...PARTS_OF.get(y)];
  if (parts.length < 4 || parts.length > 6) continue;
  tjSeen.add(w); tjMade.push([w, parts.join('')]);
}
export const TJ_ALL = [...TJ, ...tjMade];

// 四說新語: one character from each of four other idioms
const WITH = new Map();
for (const w of ALL) for (const c of new Set(chars(w))) { if (!WITH.has(c)) WITH.set(c, []); WITH.get(c).push(w); }
const ssSeen = new Set(SS.map((q) => q[0])), ssMade = [];
for (const a of shuffle(ALL)) {
  if (ssSeen.has(a) || ssMade.length >= 400) continue;
  const used = new Set([a]), src = [];
  for (const c of chars(a)) { const s = shuffle(WITH.get(c) || []).find((w) => !used.has(w) && !chars(w).some((x) => chars(a).includes(x) && x !== c)); if (!s) break; used.add(s); src.push(s); }
  if (src.length === 4) { ssSeen.add(a); ssMade.push([a, src]); }
}
export const SS_ALL = [...SS, ...ssMade];

// 畫中有話, 文字五子棋
const hzSeen = new Set();
export const HZ_ALL = [...HZ, ...HZ2].filter((q) => !hzSeen.has(q[1]) && hzSeen.add(q[1]));
export const WZ_ALL = [...WZ, ...WZ2];
export const counts = () => ({ jc: JC_W.length + JC_READ.length, zz: ZZ_ALL.length, ss: SS_ALL.length, qw: QW_ALL.length, tj: TJ_ALL.length, ty: TY_ALL.length,
  hz: HZ_ALL.length, zw: ZW_ALL.length, dd: ALL.length, zf: ZY_ALL.length, wz: WZ_ALL.length, idioms: ALL.length });
