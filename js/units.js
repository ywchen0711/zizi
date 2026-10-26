// The units of the show. Each makes its questions (on the host), checks an answer, and for the turn-by-turn duels
// keeps the board. Everything here is plain data in, plain data out, so the host can send it to every player.
import { CZ, COMMON } from './data.js';
import { IDIOM, ALL, JC_W, JC_READ, TY_ALL as TY, ZW_ALL as ZW, ZY_ALL as ZY, ZZ_ALL, zzFits, QW_ALL as QW, TJ_ALL as TJ, SS_ALL as SS, HZ_ALL as HZ, WZ_ALL as WZ } from './pools.js';
export { IDIOM };

export const rnd = (n) => Math.floor(Math.random() * n);
export const pick = (a) => a[rnd(a.length)];
export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const take = (a, n) => shuffle(a).slice(0, n);
const chars = (s) => [...s];
// some characters, none of them in `not`
function fillers(n, not, pool = COMMON) { const no = new Set(chars(not)); return take(chars(pool).filter((c, i, a) => !no.has(c) && a.indexOf(c) === i), n); }

// ---------------------------------------------------------------- the units
// kind: quiz (everyone answers the same questions, faster scores more), sprint (one long puzzle, find as many as you
// can), duel (two players take turns), race (the first right answer wins the point).
export const UNITS = {
  jc: { name: '將錯糾錯', kind: 'quiz', time: 8, n: 10, icon: '⚖️',
    rule: '每題兩個選項，一個是常見的錯誤，一個才是正確的。看準了再按，越快答對分數越高！',
    gen(n) {
      const w = take(JC_W, Math.ceil(n * 0.75)).map(([a, b]) => ({ ui: 'choice', p: '<div class="ask">哪一個寫法正確？</div>', opts: shuffle([a, b]), ans: a, big: true }));
      const r = take(JC_READ, n - w.length).map(([word, i, a, b]) => ({ ui: 'choice', p: `<div class="ask">「${chars(word).map((c, k) => k === i ? `<em>${c}</em>` : c).join('')}」的「${chars(word)[i]}」怎麼念？</div>`, opts: shuffle([a, b]), ans: a, zy: true }));
      return shuffle([...w, ...r]);
    } },
  zz: { name: '字字珠璣', kind: 'quiz', time: 20, n: 8, icon: '💎',
    rule: '畫面上有幾個字，請找出一個「關鍵字」，能和每一個字都組成詞語。例如：流、水、床、岸 → 河。',
    gen(n) {
      return take(ZZ_ALL, n).map((z) => {
        const a = z.key, cl = (z.fixed && Math.random() < 0.5 ? z.fixed : take(z.ps, 4).join('')), also = zzFits(chars(cl));
        return { ui: 'build', slots: 1, type: true, p: `<div class="clues">${chars(cl).map((c) => `<b>${c}</b>`).join('')}</div><div class="ask">哪一個字能跟它們都組成詞？</div>`, tiles: shuffle([a, ...fillers(9, cl + also.join(''))]), ans: a, alt: also.filter((x) => x !== a) };
      });
    } },
  ss: { name: '四說新語', kind: 'quiz', time: 30, n: 6, icon: '🀄',
    rule: '畫面上有四句成語。從每一句裡各挑一個字，組成一句新的成語。',
    gen(n) {
      return take(SS, n).map(([a, src]) => {
        const groups = shuffle(src);
        return { ui: 'build', slots: 4, type: true, oneper: true, p: '<div class="ask">每句各取一字，組成一句新成語</div>', groups: groups.map((w) => chars(w)), ans: a, anyGroups: true };
      });
    } },
  qw: { name: '去無成字', kind: 'quiz', time: 15, n: 8, icon: '🧩',
    rule: '四個部件裡有一個是多餘的。挑出三個，照「寫字的先後順序」點，組成一個字。',
    gen(n) { return take(QW, n).map(([ch, parts, extra]) => ({ ui: 'build', slots: 3, order: true, p: '<div class="ask">去掉一個多餘的部件，照筆順組成一個字</div>', tiles: shuffle([...chars(parts), extra]), ans: parts, show: ch })); } },
  tj: { name: '團結一詞', kind: 'quiz', time: 25, n: 6, icon: '🤝',
    rule: '每個部件都要用到、而且只能用一次，組成一個兩個字的詞語。',
    gen(n) {
      const pool = chars(TJ.map((q) => q[0]).join('')) ;
      return take(TJ, n).map(([w, parts]) => ({ ui: 'build', slots: 2, type: true, p: `<div class="parts">${shuffle(chars(parts)).map((c) => `<b>${c}</b>`).join('')}</div><div class="ask">用上所有部件，組成一個詞</div>`, tiles: shuffle([...chars(w), ...fillers(6, w, pool.join(''))]), ans: w }));
    } },
  ty: { name: '聽音寫國字', kind: 'quiz', time: 12, n: 8, icon: '👂',
    rule: '看注音和提示，選出正確的國字。同音字很多，要看清楚是哪一個詞！',
    gen(n) { return take(TY, n).map(tyQ); } },
  hz: { name: '畫中有話', kind: 'quiz', time: 25, n: 6, icon: '🖼️',
    rule: '看圖猜成語：圖畫裡藏著一句成語，照順序點出四個字。',
    gen(n) { return take(HZ, n).map(([pic, a]) => ({ ui: 'build', slots: 4, type: true, p: `<div class="pic">${pic}</div><div class="ask">這是哪一句成語？</div>`, tiles: shuffle([...chars(a), ...fillers(8, a)]), ans: a })); } },
  zw: { name: '掌握先機', kind: 'quiz', time: 25, n: 6, icon: '🔍',
    rule: '每個句子裡藏著一個錯別字。先點出錯的字，再選出正確的字來訂正。',
    gen(n) {
      return take(ZW, n).map(([s, right, alts]) => {
        const i = s.indexOf('['), wrong = chars(s.slice(i + 1, s.indexOf(']')))[0];
        const sent = chars(s.replace(/\[|\]/g, ''));
        const wi = chars(s.slice(0, i)).length;
        return { ui: 'fix', sent, ans: `${wi}:${right}`, tiles: shuffle([right, ...chars(alts), wrong]).filter((c, k, a) => a.indexOf(c) === k), p: '<div class="ask">找出錯別字，再訂正它</div>' };
      });
    } },
  dd: { name: '成語對對碰', kind: 'quiz', time: 25, n: 6, icon: '👀',
    rule: '十六個字裡藏著一句成語，照順序把它點出來。眼明手快！',
    gen(n) {
      return take(ALL, n).map((a) => ({ ui: 'build', slots: 4, grid: true, p: '<div class="ask">找出藏在裡面的成語</div>', tiles: shuffle([...chars(a), ...fillers(12, a, chars(take(ALL, 12).join('')).join(''))]), ans: a, any: true }));
    } },
  zf: { name: '字有發揮', kind: 'sprint', time: 45, icon: '🎯',
    rule: '畫面給一個讀音（不分聲調）。點出所有念這個音的字！點對加分，點錯扣分。',
    gen() {
      const [s, ok, bad] = pick(ZY), good = take(chars(ok), Math.min(14, chars(ok).length));
      const wrong = take(chars(bad), Math.min(24 - good.length, chars(bad).length));
      return { s, tiles: shuffle([...good, ...wrong]), ok: good.join('') };
    } },
  tz: { name: '同中求異', kind: 'sprint', time: 90, icon: '♊',
    rule: '題目給兩個字和它們的位置，請在時間內說出（打出）所有符合的四字成語，越多越好！',
    gen() { return pick(tzPatterns()); } },
  zp: { name: '隻字片語', kind: 'duel', time: 30, icon: '🔠',
    rule: '在 12×8 的方格上接成語：你寫的成語必須用到格子上已經有的一個字，橫的或直的放進去。輪流接，接不出來的就輸了！' },
  cz: { name: '拆字接龍', kind: 'duel', time: 15, icon: '🔗',
    rule: '從上一個字只換掉一邊的偏旁，變成另一個字。例如「河」換右邊成「流」，下一個就要換左邊（例如「硫」）。不能連續保留同一邊！接不上或接錯就失分，先失三分的輸。' },
  wz: { name: '文字五子棋', kind: 'duel', time: 20, icon: '⚫',
    rule: '每一回合先選一個符合題目的字（例如題目是「顏色」就選「紅」），選對了才能把它下在棋盤上。先連成五子的贏！' },
  yq: { name: '一字千金', kind: 'race', time: 15, n: 15, target: 7, icon: '💰',
    rule: '搶答！看注音和提示，第一個選對國字的人得一分，答錯的這題就不能再答。最先得到七分的就是冠軍！',
    gen(n) { return take(TY, n).map(tyQ); } },
};
function tyQ([zy, word, a, alts]) { return { ui: 'build', slots: 1, type: true, p: `<div class="zy">${zy}</div><div class="word">${word.replace('＿', '<u>＿</u>')}</div>`, tiles: shuffle([a, ...chars(alts), ...fillers(2, a + alts)]), ans: a }; }
export const QUIZ_UNITS = ['jc', 'zz', 'ss', 'qw', 'tj', 'ty', 'hz', 'zw', 'dd', 'zf', 'tz'];
export const FINAL_UNITS = ['zp', 'cz', 'wz', 'yq'];
export const ORDER = ['jc', 'zz', 'ss', 'qw', 'tj', 'ty', 'hz', 'zw', 'dd', 'zf', 'tz', 'zp', 'cz', 'wz', 'yq'];

// is this pick right?
export function check(q, p) {
  if (p == null) return false;
  p = String(p).trim();
  if (q.ui === 'fix') return p === q.ans;
  if (p === q.ans || q.alt?.includes(p)) return true;
  if (q.anyGroups && chars(p).length === 4 && IDIOM.has(p)) { // any idiom with one character from each of the four
    const c = chars(p), fit = (k, used) => k === 4 || q.groups.some((g, gi) => !used.includes(gi) && g.includes(c[k]) && fit(k + 1, [...used, gi]));
    return fit(0, []);
  }
  if (q.any && chars(p).length === 4 && IDIOM.has(p)) { // any idiom found in the grid counts
    const left = [...q.tiles]; for (const c of chars(p)) { const k = left.indexOf(c); if (k < 0) return false; left.splice(k, 1); } return true;
  }
  return false;
}

// ---------------------------------------------------------------- 同中求異: patterns that fit many idioms
let PATS = null;
export function tzPatterns() {
  if (PATS) return PATS;
  const m = new Map();
  for (const w of ALL) {
    const c = chars(w);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const k = `${i}${j}${c[i]}${c[j]}`; if (!m.has(k)) m.set(k, []); m.get(k).push(w); }
  }
  PATS = [...m.entries()].filter(([k, ws]) => ws.length >= 4).map(([k, ws]) => {
    const [i, j, a, b] = chars(k), mask = ['○', '○', '○', '○']; mask[+i] = a; mask[+j] = b;
    return { mask: mask.join(''), i: +i, j: +j, a, b, ans: ws };
  });
  return PATS;
}
export const tzFits = (pz, w) => { const c = chars(w); return c.length === 4 && c[pz.i] === pz.a && c[pz.j] === pz.b && IDIOM.has(w); };

// ---------------------------------------------------------------- 隻字片語: the 12 x 8 grid
export const ZP_W = 12, ZP_H = 8;
export function zpInit() {
  const g = Array(ZP_W * ZP_H).fill('');
  g[3 * ZP_W + 5] = pick(chars('一不人心大天水風花山日月手口無自有千三十'));
  return { grid: g, used: [] };
}
// where can this idiom go? every placement that crosses a character already there and fits the empty squares
export function zpPlaces(grid, w) {
  const c = chars(w), out = [];
  if (c.length !== 4) return out;
  for (let cell = 0; cell < grid.length; cell++) {
    if (!grid[cell]) continue;
    for (let k = 0; k < 4; k++) {
      if (c[k] !== grid[cell]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const x0 = (cell % ZP_W) - dx * k, y0 = Math.floor(cell / ZP_W) - dy * k;
        if (x0 < 0 || y0 < 0 || x0 + dx * 3 >= ZP_W || y0 + dy * 3 >= ZP_H) continue;
        let ok = true, fresh = 0; const cells = [];
        for (let t = 0; t < 4; t++) { const i = (y0 + dy * t) * ZP_W + x0 + dx * t; cells.push(i); if (grid[i] && grid[i] !== c[t]) { ok = false; break; } if (!grid[i]) fresh++; }
        if (ok && fresh > 0) out.push(cells);
      }
    }
  }
  return out;
}
export function zpTry(st, w) {
  w = String(w || '').trim();
  if (chars(w).length !== 4) return { err: '請寫一句四個字的成語' };
  if (!IDIOM.has(w)) return { err: `「${w}」不在成語題庫裡` };
  if (st.used.includes(w)) return { err: '這句成語已經用過了' };
  const pl = zpPlaces(st.grid, w);
  if (!pl.length) return { err: '這句成語接不上格子裡的字（或放不下）' };
  return { cells: pick(pl) };
}
export function zpApply(st, w, cells) { const c = chars(w); cells.forEach((i, t) => { st.grid[i] = c[t]; }); st.used.push(w); }
// every idiom that fits right now (for the computer and for hints)
export function zpOptions(st) {
  const have = new Set(st.grid.filter(Boolean));
  return ALL.filter((w) => !st.used.includes(w) && chars(w).some((c) => have.has(c)) && zpPlaces(st.grid, w).length);
}

// ---------------------------------------------------------------- 拆字接龍
const CZM = new Map(CZ.map((x) => [x.ch, x]));
export const czInfo = (ch) => CZM.get(ch);
export function czValid(cur, keep, used, ch) {
  const a = CZM.get(cur), b = CZM.get(ch);
  if (!a || !b || ch === cur || used.includes(ch)) return false;
  const keepL = b.L === a.L && b.R !== a.R, keepR = b.R === a.R && b.L !== a.L;
  return keep === 'L' ? keepL : keep === 'R' ? keepR : keepL || keepR;
}
export const czMoves = (cur, keep, used) => CZ.filter((x) => czValid(cur, keep, used, x.ch)).map((x) => x.ch);
// a fresh start: a character with a few ways to go on
export function czStart() {
  for (let t = 0; t < 200; t++) { const x = pick(CZ); if (czMoves(x.ch, null, []).length >= 4) return x.ch; }
  return '清';
}
// what the player chooses from: some right moves and some that look right but are not
export function czTiles(cur, keep, used) {
  const ok = take(czMoves(cur, keep, used), 3), a = CZM.get(cur);
  const near = CZ.filter((x) => !ok.includes(x.ch) && x.ch !== cur && !czValid(cur, keep, used, x.ch) && (x.L === a.L || x.R === a.R)).map((x) => x.ch);
  const far = CZ.filter((x) => !ok.includes(x.ch) && !near.includes(x.ch) && x.ch !== cur && !czValid(cur, keep, used, x.ch)).map((x) => x.ch);
  const wrong = [...take(near, 3), ...take(far, 8)].slice(0, 8 - ok.length);
  return shuffle([...ok, ...wrong]);
}
// which side is kept after a move from a to b (the next move must keep the other)
export function czNextKeep(a, b) { const x = CZM.get(a), y = CZM.get(b); return x.L === y.L ? 'R' : 'L'; }

// ---------------------------------------------------------------- 文字五子棋
export const WZ_N = 9;
export function wzInit() { const [cat, cs] = pick(WZ); return { cat, set: cs, board: Array(WZ_N * WZ_N).fill(null), usedCh: [] }; }
export function wzTiles(st) {
  const ok = take(chars(st.set).filter((c) => !st.usedCh.includes(c)), 3);
  const others = chars(WZ.filter((x) => x[0] !== st.cat).map((x) => x[1]).join('')).filter((c) => !chars(st.set).includes(c));
  return shuffle([...ok, ...take([...new Set(others)], 8 - ok.length)]);
}
export const wzFits = (st, c) => chars(st.set).includes(c) && !st.usedCh.includes(c);
export function wzLine(board, i) {
  const p = board[i]?.p; if (p == null) return null;
  const x = i % WZ_N, y = Math.floor(i / WZ_N);
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [i];
    for (const s of [1, -1]) for (let t = 1; t < 5; t++) { const nx = x + dx * t * s, ny = y + dy * t * s; if (nx < 0 || ny < 0 || nx >= WZ_N || ny >= WZ_N || board[ny * WZ_N + nx]?.p !== p) break; line.push(ny * WZ_N + nx); }
    if (line.length >= 5) return line;
  }
  return null;
}
// the computer's stone: make its own lines longer, or cut the other player's
export function wzBest(board, me) {
  let best = -1, bs = -1;
  const run = (i, p) => {
    const x = i % WZ_N, y = Math.floor(i / WZ_N); let s = 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let n = 0, open = 0;
      for (const d of [1, -1]) { let t = 1; for (; t < 5; t++) { const nx = x + dx * t * d, ny = y + dy * t * d; if (nx < 0 || ny < 0 || nx >= WZ_N || ny >= WZ_N) break; const c = board[ny * WZ_N + nx]; if (c?.p === p) n++; else { if (!c) open++; break; } } }
      s += [0, 10, 100, 1000, 100000][Math.min(4, n)] * (open || 0.3);
    }
    return s;
  };
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const s = run(i, me) * 1.1 + run(i, 1 - me) + Math.random() * 3 + (4 - Math.abs((i % WZ_N) - 4)) + (4 - Math.abs(Math.floor(i / WZ_N) - 4));
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}
