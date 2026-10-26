// The host runs the show: it deals the questions, keeps the clock, checks every answer, plays the computer contestants
// and sends the whole state to everyone after each change. Alone, this browser is the host; online, the player who has
// been in the room longest is, and if they leave the next one carries on from the last state everybody has.
import { UNITS, QUIZ_UNITS, FINAL_UNITS, check, shuffle, pick, rnd, tzFits, zpInit, zpTry, zpApply, zpOptions,
  czStart, czTiles, czValid, czNextKeep, czMoves, wzInit, wzTiles, wzFits, wzLine, wzBest, WZ_N } from './units.js';

export const BOT_NAMES = ['書蟲小文', '成語達人阿明', '字典王小華', '國文小老師', '筆神阿寶', '機智小美'];
const ACC = [0.5, 0.7, 0.88], SPEED = [0.8, 0.6, 0.42];
export const H = { S: null, deadline: 0, plan: [], botAt: 0, sprintNext: {}, send: null, isOn: () => true, last: 0, dirty: false };
const now = () => Date.now();

export function hostAdopt(S, end) { H.S = S; H.deadline = end || now() + 3000; H.plan = []; H.botAt = 0; H.sprintNext = {}; if (S?.round?.kind === 'quiz' && S.round.sub === 'q') planBots(); }
function pub(force) { H.dirty = true; if (force || now() - H.last > 150) flush(); }
export function flush() { if (!H.dirty || !H.S) return; H.dirty = false; H.last = now(); H.S.v = (H.S.v || 0) + 1; H.S.left = Math.max(0, H.deadline - now()); H.send({ t: 'st', S: H.S }); }
const P = (id) => H.S.players.find((p) => p.id === id);
const say = (s) => { H.S.say = s; };
const bots = () => H.S.players.filter((p) => p.bot);

// ---------------------------------------------------------------- setting up
export function newShow(players, mode, unit) {
  const plan = mode === 'show' ? [...shuffle(QUIZ_UNITS).slice(0, 3), pick(FINAL_UNITS)] : [unit];
  H.S = { v: 0, phase: 'intro', mode, plan, step: 0, players: players.map((p) => ({ ...p, score: 0 })), round: null, say: '', code: H.S?.code };
  startStep(); pub(true);
}
export function toLobby(players) { H.S = { v: 0, phase: 'lobby', mode: H.S?.lobbyMode || 'show', players, round: null, say: '' }; pub(true); }
function startStep() {
  const S = H.S, u = S.plan[S.step], U = UNITS[u], fin = S.mode === 'show' && S.step === S.plan.length - 1;
  let who = S.players.map((p) => p.id);
  if (U.kind === 'duel' || fin) {
    const order = fin ? [...S.players].sort((a, b) => b.score - a.score) : [...S.players].sort((a, b) => (a.bot - b.bot));
    who = order.filter((p) => H.isOn(p.id)).slice(0, 2).map((p) => p.id);
  }
  S.phase = 'intro'; S.unit = u; S.final = fin; S.who = who; S.round = null;
  say(fin ? `決賽來了！由 ${who.map((id) => P(id)?.n).join(' 和 ')} 爭奪冠軍，比的是「${U.name}」！` : `${S.mode === 'show' ? `第 ${S.step + 1} 關` : '這一關'}：「${U.name}」！`);
  H.deadline = now() + 6000;
}
function begin() {
  const S = H.S, u = S.unit, U = UNITS[u];
  S.phase = 'play'; S.gain = {}; S.who.forEach((id) => { S.gain[id] = 0; });
  if (U.kind === 'quiz' || U.kind === 'race') { S.round = { kind: U.kind, qs: U.gen(U.n), qi: -1, pts: {} }; nextQ(); }
  else if (U.kind === 'sprint') {
    S.round = { kind: 'sprint', pz: U.gen(), prog: {} }; S.who.forEach((id) => { S.round.prog[id] = { pts: 0, n: 0 }; });
    H.deadline = now() + U.time * 1000; H.sprintNext = {}; say(u === 'zf' ? `讀音是「${S.round.pz.s}」，開始！` : '開始！能想到幾句就打幾句！');
  } else {
    const [a, b] = S.who, r = S.round = { kind: 'duel', a, b, turn: a, over: false, log: [], err: null, turns: 0 };
    if (u === 'zp') Object.assign(r, zpInit());
    if (u === 'cz') { Object.assign(r, { cur: czStart(), keep: null, used: [], miss: { [a]: 0, [b]: 0 } }); r.tiles = czTiles(r.cur, null, []); }
    if (u === 'wz') { Object.assign(r, wzInit(), { sub: 'pick' }); r.tiles = wzTiles(r); }
    H.deadline = now() + U.time * 1000; H.botAt = 0;
    say(`${P(a).n} 先開始！`);
  }
}

// ---------------------------------------------------------------- quiz and race
function nextQ() {
  const S = H.S, r = S.round, U = UNITS[S.unit];
  r.qi++;
  const done = r.qi >= r.qs.length || (r.kind === 'race' && Object.values(r.pts).some((n) => n >= U.target));
  if (done) return endUnit();
  r.sub = 'q'; r.ans = {}; r.lock = []; r.first = null;
  H.deadline = now() + U.time * 1000; planBots();
  say(r.kind === 'race' ? `第 ${r.qi + 1} 題，搶答！` : `第 ${r.qi + 1} 題`);
}
function planBots() {
  const r = H.S.round, U = UNITS[H.S.unit];
  H.plan = bots().filter((b) => H.S.who.includes(b.id)).map((b) => ({ id: b.id, at: now() + U.time * 1000 * (SPEED[b.lv] + Math.random() * 0.35) * (r.kind === 'race' ? 0.75 : 1), ok: Math.random() < ACC[b.lv] }));
}
function wrongOf(q) { if (q.ui === 'choice') return q.opts.find((o) => o !== q.ans); return '✗'; }
function answer(id, m) {
  const S = H.S, r = S.round, U = UNITS[S.unit];
  if (!r || r.sub !== 'q' || m.qi !== r.qi || !S.who.includes(id) || r.ans[id] || r.lock.includes(id)) return;
  const q = r.qs[r.qi], ok = check(q, m.pick), ms = Math.max(0, Math.min(U.time * 1000, m.ms || 0));
  if (r.kind === 'race') {
    if (!ok) { r.lock.push(id); r.ans[id] = { pick: m.pick, ok: false }; if (S.who.every((w) => r.lock.includes(w) || !H.isOn(w))) reveal(); else pub(); return; }
    r.ans[id] = { pick: m.pick, ok: true }; r.first = id; r.pts[id] = (r.pts[id] || 0) + 1; S.gain[id] += 100; P(id).score += 100;
    say(`${P(id).n} 搶答成功！`); return reveal();
  }
  const pts = ok ? 100 + Math.round(100 * (1 - ms / (U.time * 1000))) : 0;
  r.ans[id] = { pick: m.pick, ok, pts };
  if (S.who.every((w) => r.ans[w] || !H.isOn(w))) reveal(); else pub();
}
function reveal() {
  const S = H.S, r = S.round;
  if (r.kind === 'quiz') {
    for (const [id, a] of Object.entries(r.ans)) if (a.pts) { P(id).score += a.pts; S.gain[id] += a.pts; }
    const right = Object.entries(r.ans).filter(([, a]) => a.ok).map(([id]) => P(id)?.n);
    say(right.length ? `答對的有：${right.join('、')}` : '這題沒有人答對！');
  } else if (!r.first) say('沒有人答對這題！');
  r.sub = 'rev'; H.deadline = now() + 3200; pub(true);
}

// ---------------------------------------------------------------- sprint
function sprintProg(id, m) {
  const S = H.S, r = S.round; if (!r || r.kind !== 'sprint' || !r.prog[id]) return;
  r.prog[id] = { pts: m.pts | 0, n: m.n | 0, done: !!m.done };
  // everyone (but the computer players, who never hold things up) has found all there is: no need to wait out the clock
  if (S.who.every((w) => r.prog[w]?.done || !H.isOn(w) || P(w)?.bot)) return endSprint();
  pub();
}
function endSprint() {
  const S = H.S, r = S.round;
  for (const [id, g] of Object.entries(r.prog)) { P(id).score += g.pts; S.gain[id] += g.pts; }
  endUnit();
}
function sprintBots() {
  const S = H.S, r = S.round, pz = r.pz;
  for (const b of bots()) {
    if (!S.who.includes(b.id)) continue;
    const g = r.prog[b.id];
    if (!H.sprintNext[b.id]) H.sprintNext[b.id] = now() + 1500 + Math.random() * 2000;
    if (now() < H.sprintNext[b.id]) continue;
    if (S.unit === 'zf') {
      H.sprintNext[b.id] = now() + (2600 - b.lv * 600) * (0.6 + Math.random() * 0.8);
      const max = [...pz.ok].length;
      if (g.n < max && Math.random() < ACC[b.lv]) { g.n++; g.pts += 50; } else if (Math.random() < 0.5) g.pts -= 30;
      if (g.n >= max) g.done = true;
    } else {
      H.sprintNext[b.id] = now() + (12000 - b.lv * 3200) * (0.6 + Math.random() * 0.8);
      if (g.n < pz.ans.length && Math.random() < ACC[b.lv]) { g.n++; g.pts += 100; }
    }
    pub();
  }
}

// ---------------------------------------------------------------- duels
function duelMove(id, m) {
  const S = H.S, r = S.round, U = UNITS[S.unit];
  if (!r || r.kind !== 'duel' || r.over || id !== r.turn) return;
  const other = id === r.a ? r.b : r.a, name = P(id).n;
  if (S.unit === 'zp') {
    const t = zpTry(r, m.w);
    if (t.err) { r.err = { id, msg: t.err, k: (r.err?.k || 0) + 1 }; return pub(true); }
    zpApply(r, m.w, t.cells); r.last = t.cells; r.err = null; r.log.unshift(`${name}：${m.w}`); r.turns++;
    say(`${name} 接上了「${m.w}」！`); passTurn(other, U.time);
  } else if (S.unit === 'cz') {
    if (!czValid(r.cur, r.keep, r.used, m.c)) return czMiss(id, `「${m.c}」接不上「${r.cur}」！`);
    r.log.unshift(`${name}：${r.cur} → ${m.c}`); r.keep = czNextKeep(r.cur, m.c); r.used.push(r.cur); r.cur = m.c; r.turns++;
    if (!czMoves(r.cur, r.keep, r.used).length) { say(`${name} 出了絕招「${m.c}」，對手沒有字可以接！`); return czMiss(other, null); }
    r.tiles = czTiles(r.cur, r.keep, r.used); say(`${name} 接「${m.c}」，換${r.keep === 'L' ? '右' : '左'}邊！`); passTurn(other, U.time);
  } else if (S.unit === 'wz') {
    if (r.sub === 'pick') {
      if (!wzFits(r, m.c)) { r.log.unshift(`${name}：「${m.c}」不是${r.cat}`); say(`「${m.c}」不屬於「${r.cat}」喔！換對手。`); r.tiles = wzTiles(r); return passTurn(other, U.time); }
      r.usedCh.push(m.c); r.ch = m.c; r.sub = 'place'; say(`${name} 寫了「${m.c}」，下在哪裡呢？`); H.botAt = 0; return pub(true);
    }
    const cell = m.cell | 0;
    if (r.sub !== 'place' || cell < 0 || cell >= r.board.length || r.board[cell]) return;
    r.board[cell] = { c: r.ch, p: id === r.a ? 0 : 1 }; r.last = cell; r.log.unshift(`${name}：${r.ch}`); r.turns++;
    const line = wzLine(r.board, cell);
    if (line) { r.line = line; return duelOver(id, `${name} 連成五子！`); }
    if (r.board.every(Boolean)) return duelOver(P(r.a).score >= P(r.b).score ? r.a : r.b, '棋盤下滿了！');
    r.sub = 'pick'; r.ch = null;
    if (r.usedCh.length >= [...r.set].length - 2) Object.assign(r, (() => { const n = wzInit(); return { cat: n.cat, set: n.set, usedCh: [] }; })());
    r.tiles = wzTiles(r); passTurn(other, U.time);
  }
}
function passTurn(id, sec) { const r = H.S.round; r.turn = id; H.deadline = now() + sec * 1000; H.botAt = 0; pub(true); }
function czMiss(id, why) {
  const S = H.S, r = S.round; r.miss[id]++;
  if (why) say(why);
  r.log.unshift(`${P(id).n} 失一分`);
  const other = id === r.a ? r.b : r.a;
  if (r.miss[id] >= 3) return duelOver(other, `${P(id).n} 已經失三分！`);
  r.cur = czStart(); r.keep = null; r.used = []; r.tiles = czTiles(r.cur, null, []);
  passTurn(id, UNITS.cz.time);
}
function duelTimeout() {
  const S = H.S, r = S.round, id = r.turn, other = id === r.a ? r.b : r.a;
  if (S.unit === 'zp') return duelOver(other, `${P(id).n} 時間到，接不出來！`);
  if (S.unit === 'cz') return czMiss(id, `${P(id).n} 時間到！`);
  if (S.unit === 'wz') { say(`${P(id).n} 時間到，換人！`); if (r.sub === 'place') { r.usedCh.pop(); r.sub = 'pick'; } r.tiles = wzTiles(r); return passTurn(other, UNITS.wz.time); }
}
function duelOver(win, why) {
  const S = H.S, r = S.round; r.over = true; r.winner = win;
  P(win).score += 500; S.gain[win] = (S.gain[win] || 0) + 500;
  say(`${why} ${P(win).n} 獲勝！`); H.deadline = now() + 5000; pub(true);
}
function duelBot() {
  const S = H.S, r = S.round, b = P(r.turn);
  if (!b?.bot || r.over) return;
  if (!H.botAt) { H.botAt = now() + (S.unit === 'zp' ? 4000 + Math.random() * 6000 : 1800 + Math.random() * 3500) * (1.2 - b.lv * 0.2); return; }
  if (now() < H.botAt) return;
  H.botAt = 0;
  if (S.unit === 'zp') {
    const opts = zpOptions(r), luck = ACC[b.lv] + 0.08 - r.turns * 0.012;
    if (opts.length && Math.random() < luck) return duelMove(b.id, { w: pick(opts) });
    H.botAt = H.deadline + 99999; // thinks until the time runs out
  } else if (S.unit === 'cz') {
    const ok = r.tiles.filter((c) => czValid(r.cur, r.keep, r.used, c));
    duelMove(b.id, { c: ok.length && Math.random() < ACC[b.lv] + 0.05 ? pick(ok) : pick(r.tiles.filter((c) => !ok.includes(c))) || r.tiles[0] });
  } else if (S.unit === 'wz') {
    if (r.sub === 'pick') { const ok = r.tiles.filter((c) => wzFits(r, c)); duelMove(b.id, { c: ok.length && Math.random() < ACC[b.lv] + 0.06 ? pick(ok) : pick(r.tiles.filter((c) => !ok.includes(c))) }); }
    else duelMove(b.id, { cell: b.lv === 0 && Math.random() < 0.4 ? pick(r.board.map((c, i) => c ? -1 : i).filter((i) => i >= 0)) : wzBest(r.board, r.turn === r.a ? 0 : 1) });
  }
}

// ---------------------------------------------------------------- between units
function endUnit() {
  const S = H.S, U = UNITS[S.unit];
  S.phase = 'unitEnd';
  if (S.final || S.mode === 'unit') {
    const r = S.round;
    S.champ = r?.kind === 'duel' ? r.winner : r?.kind === 'race' ? (Object.entries(r.pts).sort((a, b) => b[1] - a[1])[0]?.[0] || topOf(S.who)) : topOf(S.who);
  }
  say(`「${U.name}」結束！`);
  H.deadline = now() + 6500; pub(true);
}
const topOf = (ids) => [...ids].sort((a, b) => P(b).score - P(a).score)[0];
function afterUnit() {
  const S = H.S;
  S.step++;
  if (S.step < S.plan.length) { startStep(); return pub(true); }
  S.phase = 'end'; S.champ = S.champ || topOf(S.players.map((p) => p.id));
  say(`恭喜 ${P(S.champ).n} 成為今天的「字字千金」冠軍！`); pub(true);
}
export function skip() { if (H.S && (H.S.phase === 'intro' || H.S.phase === 'unitEnd')) { H.deadline = 0; tick(); } }

// ---------------------------------------------------------------- messages and the clock
export function onAction(id, m) {
  if (!H.S) return;
  if (m.t === 'ans') answer(id, m);
  else if (m.t === 'sp') sprintProg(id, m);
  else if (m.t === 'mv') duelMove(id, m);
  else if (m.t === 'skip') skip();
}
export function tick() {
  const S = H.S; if (!S) return;
  const t = now(), late = t >= H.deadline;
  if (S.phase === 'intro') { if (late) { begin(); pub(true); } }
  else if (S.phase === 'unitEnd') { if (late) afterUnit(); }
  else if (S.phase === 'play') {
    const r = S.round;
    if (r.kind === 'quiz' || r.kind === 'race') {
      if (r.sub === 'q') {
        for (const b of H.plan) if (!b.done && t >= b.at) { b.done = true; answer(b.id, { t: 'ans', qi: r.qi, pick: b.ok ? r.qs[r.qi].ans : wrongOf(r.qs[r.qi]), ms: b.at - (H.deadline - UNITS[S.unit].time * 1000) }); if (r.sub !== 'q') break; }
        if (r.sub === 'q' && (late || S.who.every((w) => r.ans[w] || r.lock.includes(w) || !H.isOn(w)))) reveal();
      } else if (late) { nextQ(); pub(true); }
    } else if (r.kind === 'sprint') { sprintBots(); if (late) endSprint(); }
    else if (r.kind === 'duel') {
      if (r.over) { if (late) endUnit(); }
      else if (!H.isOn(r.turn)) duelOver(r.turn === r.a ? r.b : r.a, `${P(r.turn)?.n || '對手'} 離開了。`);
      else if (late) duelTimeout();
      else duelBot();
    }
  }
  flush();
}
