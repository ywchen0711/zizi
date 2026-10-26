// 字字千金: the screens. The state comes from the host (this browser alone, or the room's host online); this file only
// draws it and sends the player's answers back.
import { net, join, leave, send, isHost, newCode, cleanCode } from './net.js';
import { H, hostAdopt, newShow, toLobby, onAction, tick, skip, BOT_NAMES, timeOf } from './host.js';
import { UNITS, ORDER, check, tzFits, IDIOM, zpTry, zpOptions, ZP_W, czInfo, WZ_N, shuffle, pick } from './units.js';
import { sfx, setMute, muted } from './sfx.js';

const $ = (s, el = document) => el.querySelector(s), app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
const cfg = Object.assign({ name: '玩家' + Math.floor(Math.random() * 900 + 100), bots: 3, lv: 1 }, ls.get('zizi.cfg', {}));
const saveCfg = () => ls.set('zizi.cfg', cfg);
const LV = ['簡單', '普通', '困難'];
// the time and number of questions: 0 is each unit's own
const SEC = [0, 3, 5, 8, 10, 12, 15, 20, 25, 30, 45, 60, 90], SPRINT = [0, 30, 45, 60, 90, 120, 180, 300], NQ = [0, 3, 5, 8, 10, 15, 20];
const optOf = (o) => ({ sec: o.sec || 0, sprint: o.sprint || 0, n: o.n || 0 });
function optRows(o) {
  const sel = (k, list, f) => `<select data-opt="${k}">${list.map((v) => `<option value="${v}" ${(o[k] || 0) === v ? 'selected' : ''}>${v ? f(v) : '標準（依單元）'}</option>`).join('')}</select>`;
  return `<label class="row">答題秒數 ${sel('sec', SEC, (v) => `每題 ${v} 秒`)}</label>
    <label class="row">限時單元 ${sel('sprint', SPRINT, (v) => `共 ${v} 秒`)}</label>
    <label class="row">題數 ${sel('n', NQ, (v) => `${v} 題`)}</label>
    <p class="hint">答題秒數也是對戰時每一回合的秒數；限時單元是「字有發揮」和「同中求異」。</p>`;
}
const optText = (o) => [o.sec ? `每題 ${o.sec} 秒` : '', o.sprint ? `限時單元 ${o.sprint} 秒` : '', o.n ? `每關 ${o.n} 題` : ''].filter(Boolean).join('・') || '標準時間與題數';

let online = false, S = null, end = 0, total = 1, screen = 'home', view = { key: '' }, last = null;
const me = () => net.me.id;
const amHost = () => !online || isHost();
const P = (id) => S?.players.find((p) => p.id === id);

// ---------------------------------------------------------------- wiring: alone, or a room online
H.isOn = (id) => { const p = H.S?.players.find((x) => x.id === id); return !online || !p || p.bot || net.roster.some((r) => r.id === id); };
function useLocal() { online = false; H.send = (m) => applyState(structuredClone(m.S)); }
function toHost(m) {
  if (!online) { onAction(me(), m); tick(); return; }
  send(m);
}
net.on = (m) => {
  if (m.t === 'st') { if (!isHost() || m.from === me()) applyState(m.from === me() ? structuredClone(m.S) : m.S); }
  else if (isHost() && m.from) { onAction(m.from, m); }
};
let wasHost = false;
net.onRoster = () => {
  if (!online) return;
  const host = isHost();
  if (host && !wasHost) hostAdopt(S ? structuredClone(S) : null, end); // this browser now runs the room
  wasHost = host;
  if (host) {
    if (!H.S) toLobby([]);
    const S2 = H.S, humans = net.roster.map((r) => ({ id: r.id, n: r.n || '玩家' }));
    for (const h of humans) { const p = S2.players.find((x) => x.id === h.id); if (!p) S2.players.push({ id: h.id, n: h.n, bot: false, lv: 0, score: 0 }); else p.n = h.n; }
    if (S2.phase === 'lobby') S2.players = S2.players.filter((p) => p.bot || humans.some((h) => h.id === p.id));
    H.dirty = true; tick();
  }
  render();
};
net.onStatus = () => render();
setInterval(() => { if (H.S && amHost() && screen === 'game') tick(); }, 120);

function applyState(s) {
  const prev = S; S = s; end = Date.now() + (s.left || 0);
  if (s.phase === 'play' || s.phase === 'intro' || s.phase === 'unitEnd') screen = 'game';
  soundFor(prev, s);
  render();
}
function soundFor(a, b) {
  if (!a) return;
  const r = b.round, q = r && (r.kind === 'quiz' || r.kind === 'race');
  if (a.phase !== b.phase && b.phase === 'intro') sfx('intro');
  if (q && a.round?.sub === 'q' && r.sub === 'rev') { const mine = r.ans?.[me()]; if (b.who.includes(me())) sfx(mine?.ok ? 'ok' : 'bad'); }
  if (b.phase === 'end' && a.phase !== 'end') sfx(b.champ === me() ? 'win' : 'end');
  if (r?.kind === 'duel' && a.round?.turn !== r.turn && r.turn === me() && !r.over) sfx('turn');
  if (r?.kind === 'duel' && r.over && !a.round?.over) sfx(r.winner === me() ? 'win' : 'bad');
}

// ---------------------------------------------------------------- the frame around every screen
function frame(inner, opts = {}) {
  return `<header class="top"><button class="home" data-act="home">🏠</button><div class="logo">字字<b>千金</b></div>
    ${online && net.room ? `<div class="room">房間 <b>${net.room}</b><i class="dot ${net.status}"></i></div>` : ''}
    <button class="mute" data-act="mute">${muted() ? '🔇' : '🔊'}</button></header>${opts.board ? board() : ''}<main>${inner}</main>`;
}
function board() {
  if (!S) return '';
  const r = S.round, rev = r && r.sub === 'rev';
  return `<div class="scores">${S.players.map((p) => {
    const part = S.who?.includes(p.id), a = r?.ans?.[p.id], lock = r?.lock?.includes(p.id);
    const mark = S.phase !== 'play' ? '' : r?.kind === 'race' ? (r.pts?.[p.id] ? `<i class="rp">${r.pts[p.id]}</i>` : '') : '';
    const st = S.phase !== 'play' || !part ? '' : r?.kind === 'quiz' ? (rev ? (a?.ok ? `<s class="ok">+${a.pts}</s>` : '<s class="no">✗</s>') : a ? '<s>✓</s>' : '<s class="wait">…</s>')
      : r?.kind === 'race' ? (r.first === p.id ? '<s class="ok">搶到！</s>' : lock ? '<s class="no">✗</s>' : '')
      : r?.kind === 'sprint' ? `<s>${r.prog?.[p.id]?.pts ?? 0}</s>` : r?.kind === 'duel' && r.turn === p.id && !r.over ? '<s class="turn">輪到</s>' : '';
    return `<div class="sc ${p.id === me() ? 'me' : ''} ${part ? '' : 'out'}"><span class="nm">${p.bot ? '🤖' : '🙂'}${esc(p.n)}</span><b>${p.score}</b>${mark}${st}</div>`;
  }).join('')}</div>`;
}
function timer() { return '<div class="timer"><i></i><span></span></div>'; }
(function loop() {
  const t = $('.timer'); if (t && S) {
    const left = Math.max(0, end - Date.now()), k = Math.min(1, left / total);
    t.firstChild.style.width = k * 100 + '%'; t.classList.toggle('low', left < 5000 && left > 0 && S.phase === 'play');
    t.lastChild.textContent = Math.ceil(left / 1000);
    const s = Math.ceil(left / 1000); if (S.phase === 'play' && left > 0 && s <= 3 && s !== loop.s && (S.round?.sub === 'q' || S.round?.kind === 'sprint' || (S.round?.kind === 'duel' && S.round.turn === me()))) sfx('tick'); loop.s = s;
  }
  requestAnimationFrame(loop);
})();

// ---------------------------------------------------------------- render
function render() {
  if (screen === 'home') return homeScreen();
  if (screen === 'units') return unitsScreen();
  if (screen === 'online') return onlineScreen();
  if (!S) { app.innerHTML = frame('<div class="card center"><p>連線中…</p></div>'); return; }
  const r = S.round;
  const key = [S.phase, S.step, S.unit, r?.qi, r?.sub].join('|');
  if (key !== view.key) { view = { key, local: {} }; total = Math.max(1000, end - Date.now()); build(); }
  else if (view.upd) { const b = $('.scores'); if (b) b.outerHTML = board(); view.upd(); }
}
function build() {
  const ph = S.phase;
  if (ph === 'lobby') return lobbyScreen();
  if (ph === 'intro') return introScreen();
  if (ph === 'unitEnd') return unitEndScreen();
  if (ph === 'end') return endScreen();
  const k = S.round.kind;
  if (k === 'quiz' || k === 'race') return quizScreen();
  if (k === 'sprint') return S.unit === 'zf' ? zfScreen() : tzScreen();
  if (S.unit === 'zp') return zpScreen();
  if (S.unit === 'cz') return czScreen();
  if (S.unit === 'wz') return wzScreen();
}
const host = (s) => `<div class="host"><span class="mc">🎤</span><p>${esc(s || '')}</p></div>`;
const setHost = () => { const h = $('.host p'); if (h) h.textContent = S.say || ''; };

// ---------------------------------------------------------------- home
function homeScreen() {
  view = { key: '' };
  app.innerHTML = `<div class="home-wrap"><div class="title"><div class="big">字字<b>千金</b></div><p>國字・成語・注音　十五種闖關單元</p></div>
    <div class="card"><label class="row">我的名字 <input id="nm" maxlength="10" value="${esc(cfg.name)}"></label>
    <label class="row">電腦對手 <select id="bots">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${cfg.bots === n ? 'selected' : ''}>${n} 位</option>`).join('')}</select>
    難度 <select id="lv">${LV.map((s, i) => `<option value="${i}" ${cfg.lv === i ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <details class="more" ${cfg.sec || cfg.sprint || cfg.n ? 'open' : ''}><summary>時間與題數</summary>${optRows(cfg)}</details></div>
    <div class="menu">
      <button class="btn gold" data-act="show">🎬 節目模式<small>三關初賽＋冠軍決賽</small></button>
      <button class="btn" data-act="units">📚 單元練習<small>十五個單元任你挑</small></button>
      <button class="btn blue" data-act="online">🌐 連線對戰<small>開房間跟朋友比</small></button>
    </div>
    <p class="foot">玩法仿照公視益智節目《一字千金》的各個單元。答案依教育部標準字體與《重編國語辭典修訂本》。</p></div>`;
  const keep = () => { cfg.name = $('#nm').value.trim().slice(0, 10) || cfg.name; cfg.bots = +$('#bots').value; cfg.lv = +$('#lv').value; app.querySelectorAll('[data-opt]').forEach((e) => { cfg[e.dataset.opt] = +e.value; }); saveCfg(); };
  app.querySelectorAll('input,select').forEach((e) => e.addEventListener('change', keep));
}
function unitsScreen() {
  app.innerHTML = frame(`<h2>單元練習</h2><div class="units">${ORDER.map((u) => { const U = UNITS[u]; return `<button class="unit" data-unit="${u}"><span class="ic">${U.icon}</span><b>${U.name}</b><small>${({ quiz: '答題', sprint: '限時', duel: '對戰', race: '搶答' })[U.kind]}</small><p>${esc(U.rule)}</p></button>`; }).join('')}</div>`);
}
function botsFor(n, lv) { return shuffle(BOT_NAMES).slice(0, n).map((nm, i) => ({ id: 'bot' + i, n: nm, bot: true, lv })); }
function startLocal(mode, unit) {
  useLocal(); leave();
  const duel = unit && (UNITS[unit].kind === 'duel');
  const n = duel ? 1 : mode === 'show' ? Math.max(1, cfg.bots) : cfg.bots;
  last = { mode, unit };
  newShow([{ id: me(), n: cfg.name, bot: false, lv: 0 }, ...botsFor(n, cfg.lv)], mode, unit, optOf(cfg));
  screen = 'game';
}

// ---------------------------------------------------------------- online: make or join a room
function onlineScreen() {
  app.innerHTML = frame(`<div class="card"><h2>連線對戰</h2><label class="row">我的名字 <input id="nm" maxlength="10" value="${esc(cfg.name)}"></label>
    <button class="btn gold" data-act="mkroom">建立新房間</button>
    <div class="row join"><input id="code" maxlength="4" placeholder="房間代碼" autocapitalize="characters"><button class="btn blue" data-act="joinroom">加入</button></div>
    <p class="hint">建立房間後，把四個字母的代碼告訴朋友，大家輸入同一個代碼就能一起玩。房主可以加入電腦對手。</p></div>`);
}
function enterRoom(code) {
  cfg.name = ($('#nm')?.value.trim() || cfg.name).slice(0, 10); saveCfg();
  online = true; S = null; H.S = null; wasHost = false; view = { key: '' };
  H.send = (m) => send(m);
  screen = 'game'; join(code, cfg.name); render();
}
function lobbyScreen() {
  const hst = isHost(), mode = S.lobbyMode || 'show';
  app.innerHTML = frame(`<div class="card"><h2>房間 <span class="code">${net.room}</span></h2><p class="hint">把代碼告訴朋友，輸入同一個代碼就能加入；或分享連結：<br><input class="link" readonly value="${esc(location.origin + location.pathname + '#' + net.room)}" onclick="this.select()"></p>
    <ul class="plist">${S.players.map((p) => `<li>${p.bot ? '🤖' : '🙂'} ${esc(p.n)} ${p.bot ? `<small>${LV[p.lv]}</small>` : ''} ${p.id === net.roster[0]?.id ? '<small class="tag">房主</small>' : ''} ${hst && p.bot ? `<button class="mini" data-kick="${p.id}">移除</button>` : ''}</li>`).join('')}</ul>
    ${hst ? `<div class="row">加電腦 ${LV.map((s, i) => `<button class="mini" data-addbot="${i}">${s}</button>`).join('')}</div>
      <label class="row">玩什麼 <select id="mode"><option value="show" ${mode === 'show' ? 'selected' : ''}>🎬 節目模式（三關＋決賽）</option>${ORDER.map((u) => `<option value="${u}" ${mode === u ? 'selected' : ''}>${UNITS[u].icon} ${UNITS[u].name}</option>`).join('')}</select></label>
      <details class="more" ${S.opt?.sec || S.opt?.sprint || S.opt?.n ? 'open' : ''}><summary>時間與題數</summary>${optRows(S.opt || {})}</details>
      <button class="btn gold" data-act="startroom" ${S.players.length < 2 ? 'disabled' : ''}>開始！</button>${S.players.length < 2 ? '<p class="hint">至少要兩位玩家（可以加電腦）。</p>' : ''}`
    : `<p class="hint">房主選的是：${mode === 'show' ? '節目模式' : esc(UNITS[mode]?.name)}・${optText(S.opt || {})}</p><p class="hint">等房主開始遊戲…</p>`}</div>`, { board: false });
  $('#mode')?.addEventListener('change', (e) => { H.S.lobbyMode = e.target.value; H.dirty = true; tick(); });
  if (hst) app.querySelectorAll('[data-opt]').forEach((e) => e.addEventListener('change', () => { H.S.opt = { ...(H.S.opt || {}), [e.dataset.opt]: +e.value }; H.dirty = true; tick(); }));
  view.upd = lobbyScreen;
}

// ---------------------------------------------------------------- unit title card, results, the end
function introScreen() {
  const U = UNITS[S.unit];
  app.innerHTML = frame(`<div class="card intro"><div class="step">${S.mode === 'show' ? (S.final ? '冠軍決賽' : `第 ${S.step + 1} 關`) : '單元練習'}</div>
    <div class="uic">${U.icon}</div><h1>${U.name}</h1><p class="rule">${esc(U.rule)}</p>
    <p class="limit">⏱ ${U.kind === 'sprint' ? `限時 ${timeOf(S, S.unit)} 秒` : U.kind === 'duel' ? `每回合 ${timeOf(S, S.unit)} 秒` : `每題 ${timeOf(S, S.unit)} 秒${U.kind === 'quiz' ? `・共 ${S.opt?.n || U.n} 題` : ''}`}</p>
    ${S.who.length < S.players.length ? `<p class="who">出賽：${S.who.map((id) => esc(P(id)?.n)).join(' 對 ')}</p>` : ''}
    ${timer()}${amHost() ? '<button class="btn" data-act="skip">我準備好了！</button>' : ''}</div>${host(S.say)}`, { board: true });
  view.upd = setHost;
}
function unitEndScreen() {
  const U = UNITS[S.unit], r = S.round, list = [...S.players].sort((a, b) => b.score - a.score);
  let extra = '';
  if (r?.kind === 'sprint' && S.unit === 'tz') extra = `<div class="answers"><b>「${r.pz.mask}」的成語：</b>${r.pz.ans.map((w) => `<span>${w}</span>`).join('')}</div>`;
  if (r?.kind === 'sprint' && S.unit === 'zf') extra = `<div class="answers"><b>念「${r.pz.s}」的字：</b>${[...r.pz.ok].map((w) => `<span>${w}</span>`).join('')}</div>`;
  const champ = (S.final || S.mode === 'unit') && S.champ ? `<div class="champ">🏆 ${esc(P(S.champ)?.n)}</div>` : '';
  app.innerHTML = frame(`<div class="card"><h2>${U.icon} ${U.name} 結束</h2>${champ}<table class="res">${list.map((p, i) => `<tr class="${p.id === me() ? 'me' : ''}"><td>${i + 1}</td><td>${esc(p.n)}</td><td class="g">${S.gain?.[p.id] != null ? '+' + S.gain[p.id] : ''}</td><td><b>${p.score}</b></td></tr>`).join('')}</table>${extra}
    ${S.mode === 'show' && !S.final ? `<p class="hint">${S.step + 1 === S.plan.length - 1 ? '下一關是冠軍決賽，總分前兩名出賽！' : `下一關：${UNITS[S.plan[S.step + 1]].name}`}</p>` : ''}
    ${timer()}${amHost() ? '<button class="btn" data-act="skip">繼續</button>' : ''}</div>${host(S.say)}`);
  view.upd = setHost;
}
function endScreen() {
  const list = [...S.players].sort((a, b) => (b.id === S.champ) - (a.id === S.champ) || b.score - a.score);
  app.innerHTML = frame(`<div class="card end"><div class="trophy">🏆</div><h1>${esc(P(S.champ)?.n)}</h1><p>今日冠軍</p>
    <table class="res">${list.map((p, i) => `<tr class="${p.id === me() ? 'me' : ''}"><td>${i + 1}</td><td>${esc(p.n)}</td><td><b>${p.score}</b></td></tr>`).join('')}</table>
    ${online ? (isHost() ? '<button class="btn gold" data-act="again">回房間再玩一場</button>' : '<p class="hint">等房主開下一場…</p>') : '<button class="btn gold" data-act="again">再玩一次</button>'}
    <button class="btn" data-act="home">回首頁</button></div>${host(S.say)}`);
  view.upd = setHost;
}

// ---------------------------------------------------------------- quiz and race questions
function quizScreen() {
  const r = S.round, q = r.qs[r.qi], U = UNITS[S.unit], L = view.local, mine = S.who.includes(me());
  L.t0 = Date.now(); L.picks = []; L.sel = -1;
  app.innerHTML = frame(`<div class="card quiz"><div class="qhead"><span>${U.icon} ${U.name}</span><span>${r.kind === 'race' ? `搶答 第 ${r.qi + 1} 題・先得 ${U.target} 分獲勝` : `第 ${r.qi + 1} / ${r.qs.length} 題`}</span></div>${timer()}
    <div class="prompt">${q.p}</div><div class="answer"></div><div class="status"></div></div>${host(S.say)}`, { board: true });
  const box = $('.answer'), status = $('.status');
  const submit = (p) => { if (L.sent || r.sub !== 'q' || !mine) return; L.sent = true; L.pick = p; sfx('tap'); toHost({ t: 'ans', qi: r.qi, pick: p, ms: Date.now() - L.t0 }); paint(); };
  function paint() {
    const R = S.round, rev = R.sub === 'rev', mineA = R.ans?.[me()], locked = R.lock?.includes(me()) || (L.sent && R.kind !== 'race');
    const off = !mine || rev || locked || L.sent;
    if (q.ui === 'choice') {
      box.innerHTML = `<div class="choices ${q.zy ? 'zy' : ''}">${q.opts.map((o) => `<button class="opt ${rev && o === q.ans ? 'right' : ''} ${rev && L.pick === o && o !== q.ans ? 'wrong' : ''} ${L.pick === o ? 'picked' : ''}" data-o="${esc(o)}" ${off ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>`;
      box.querySelectorAll('.opt').forEach((b) => b.onclick = () => submit(b.dataset.o));
    } else if (q.ui === 'build') buildUI(q, box, off, rev, submit);
    else if (q.ui === 'fix') fixUI(q, box, off, rev, submit);
    status.className = 'status';
    if (rev) {
      const ok = mineA?.ok;
      status.innerHTML = `${mine ? (ok ? '<b class="ok">答對了！</b>' : '<b class="no">答錯了</b>') : ''} 答案：<b class="ans">${esc(ansText(q))}</b>`;
    } else if (!mine) status.textContent = '觀戰中';
    else if (R.kind === 'race' && R.lock?.includes(me())) status.innerHTML = '<b class="no">答錯了，這題不能再搶答</b>';
    else if (L.sent) status.textContent = '已作答，等其他人…';
  }
  view.paint = paint; paint();
  view.upd = () => { setHost(); if (S.round.sub === 'rev' || S.round.lock?.includes(me())) paint(); };
}
function ansText(q) {
  if (q.ui === 'fix') { const [i, c] = q.ans.split(':'); return `「${q.sent[+i]}」→「${c}」`; }
  if (q.show) return `${[...q.ans].join(' ＋ ')} ＝ ${q.show}`;
  return q.ans;
}
// tap tiles into the boxes (or type the answer); tap a box to take a tile back
function buildUI(q, box, off, rev, submit) {
  const L = view.local; L.picks = L.picks || [];
  const tiles = q.groups ? q.groups.flatMap((g, gi) => g.map((c) => ({ c, g: gi }))) : q.tiles.map((c) => ({ c }));
  const shown = rev ? [...q.ans] : L.sent && typeof L.pick === 'string' && !L.picks.length ? [...L.pick] : L.picks.map((k) => tiles[k].c);
  const usedG = new Set(L.picks.map((k) => tiles[k].g));
  let html = `<div class="slots">${Array.from({ length: q.slots }, (_, i) => `<button class="slot ${shown[i] ? 'full' : ''} ${rev ? 'right' : ''}" data-s="${i}" ${off ? 'disabled' : ''}>${esc(shown[i] || '')}</button>`).join('')}</div>`;
  const tile = (t, k) => `<button class="tile ${L.picks.includes(k) ? 'used' : ''}" data-k="${k}" ${off || L.picks.includes(k) || (q.oneper && usedG.has(t.g)) ? 'disabled' : ''}>${esc(t.c)}</button>`;
  if (q.groups) html += `<div class="groups">${q.groups.map((g, gi) => `<div class="grp ${usedG.has(gi) ? 'done' : ''}">${tiles.map((t, k) => t.g === gi ? tile(t, k) : '').join('')}</div>`).join('')}</div>`;
  else html += `<div class="tiles ${q.grid ? 'grid4' : ''}">${tiles.map(tile).join('')}</div>`;
  if (!off) html += `<div class="row ctl">${q.type ? `<input class="type" placeholder="或直接打字" maxlength="${q.slots}" value="${esc(L.typed || '')}">` : ''}${q.slots > 1 ? '<button class="btn small go">送出</button>' : ''}<button class="btn small clr">清除</button></div>`;
  box.innerHTML = html;
  const again = () => buildUI(q, box, off, rev, submit);
  box.querySelectorAll('.tile').forEach((b) => b.onclick = () => {
    if (L.picks.length >= q.slots) return; L.picks.push(+b.dataset.k); sfx('tap');
    if (L.picks.length === q.slots && q.slots === 1) return submit(L.picks.map((k) => tiles[k].c).join(''));
    if (L.picks.length === q.slots && q.order) return submit(L.picks.map((k) => tiles[k].c).join(''));
    again();
  });
  box.querySelectorAll('.slot').forEach((b) => b.onclick = () => { const i = +b.dataset.s; if (i < L.picks.length) { L.picks.splice(i, 1); again(); } });
  const inp = $('.type', box);
  if (inp) { inp.oninput = () => { L.typed = inp.value; }; inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) go(); }; }
  const go = () => { const t = (inp?.value || '').trim(); if (t) return submit(t); if (L.picks.length === q.slots) submit(L.picks.map((k) => tiles[k].c).join('')); };
  $('.go', box)?.addEventListener('click', go);
  $('.clr', box)?.addEventListener('click', () => { L.picks = []; L.typed = ''; again(); });
}
// 掌握先機: tap the wrong character, then the right one
function fixUI(q, box, off, rev, submit) {
  const L = view.local, [ai, ac] = q.ans.split(':');
  box.innerHTML = `<div class="sent">${q.sent.map((c, i) => `<button class="sc1 ${L.sel === i ? 'sel' : ''} ${rev && i === +ai ? 'wrong' : ''}" data-i="${i}" ${off || /[，。、！？「」]/.test(c) ? 'disabled' : ''}>${esc(rev && i === +ai ? ac : c)}</button>`).join('')}</div>
    ${L.sel >= 0 && !off ? `<p class="hint">「${esc(q.sent[L.sel])}」應該改成：</p><div class="tiles">${q.tiles.map((c) => `<button class="tile" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : !off ? '<p class="hint">先點出寫錯的那個字</p>' : ''}`;
  box.querySelectorAll('.sc1').forEach((b) => b.onclick = () => { L.sel = +b.dataset.i; sfx('tap'); fixUI(q, box, off, rev, submit); });
  box.querySelectorAll('.tile').forEach((b) => b.onclick = () => submit(`${L.sel}:${b.dataset.c}`));
}

// ---------------------------------------------------------------- sprints
function zfScreen() {
  const r = S.round, pz = r.pz, L = view.local, mine = S.who.includes(me());
  L.hit = {}; L.pts = 0; L.n = 0;
  app.innerHTML = frame(`<div class="card quiz"><div class="qhead"><span>${UNITS.zf.icon} 字有發揮</span><span>點出所有念這個音的字</span></div>${timer()}
    <div class="prompt"><div class="zy huge">${pz.s}</div><div class="ask">不分聲調：點對 +50，點錯 −30</div></div>
    <div class="tiles grid6">${pz.tiles.map((c, i) => `<button class="tile" data-i="${i}" ${mine ? '' : 'disabled'}>${c}</button>`).join('')}</div><div class="status">我的分數：<b class="mypts">0</b></div></div>${host(S.say)}`, { board: true });
  app.querySelectorAll('.tiles .tile').forEach((b) => b.onclick = () => {
    const i = +b.dataset.i, c = pz.tiles[i]; if (L.hit[i] || L.done) return; L.hit[i] = 1;
    const ok = pz.ok.includes(c); b.classList.add(ok ? 'right' : 'wrong'); b.disabled = true; sfx(ok ? 'ok' : 'bad');
    if (ok) { L.pts += 50; L.n++; } else L.pts -= 30;
    L.done = L.n >= [...pz.ok].length; $('.mypts').textContent = L.pts;
    toHost({ t: 'sp', pts: L.pts, n: L.n, done: L.done });
  });
  view.upd = setHost;
}
function tzScreen() {
  const r = S.round, pz = r.pz, L = view.local, mine = S.who.includes(me());
  L.found = []; L.pts = 0; L.hints = 3;
  app.innerHTML = frame(`<div class="card quiz"><div class="qhead"><span>${UNITS.tz.icon} 同中求異</span><span>共有 ${pz.ans.length} 句</span></div>${timer()}
    <div class="prompt"><div class="mask">${[...pz.mask].map((c) => `<b class="${c === '○' ? 'blank' : ''}">${c === '○' ? '' : c}</b>`).join('')}</div><div class="ask">打出符合這個樣子的四字成語</div></div>
    ${mine ? `<div class="row ctl"><input class="type wide" placeholder="輸入成語" maxlength="4"><button class="btn small go">送出</button><button class="btn small hint1">提示（3）</button></div>` : '<p class="hint">觀戰中</p>'}
    <div class="status"></div><div class="found"></div></div>${host(S.say)}`, { board: true });
  const inp = $('.type'), status = $('.status');
  const paint = () => { $('.found').innerHTML = L.found.map((w) => `<span>${w}</span>`).join(''); };
  const go = () => {
    const w = inp.value.trim(); if (!w) return; inp.value = '';
    if (L.found.includes(w)) { status.innerHTML = '<b class="no">已經寫過了</b>'; return sfx('bad'); }
    if (!tzFits(pz, w)) { status.innerHTML = `<b class="no">「${esc(w)}」${[...w].length !== 4 ? '要四個字' : !IDIOM.has(w) ? '不在成語題庫裡' : '不符合題目'}</b>`; return sfx('bad'); }
    L.found.push(w); L.pts += 100; sfx('ok'); status.innerHTML = `<b class="ok">+100　${esc(w)}</b>`; paint();
    toHost({ t: 'sp', pts: L.pts, n: L.found.length, done: L.found.length >= pz.ans.length });
  };
  if (inp) { inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) go(); }; $('.go').onclick = go; inp.focus(); }
  $('.hint1')?.addEventListener('click', (e) => {
    const left = pz.ans.filter((w) => !L.found.includes(w)); if (!L.hints || !left.length) return;
    L.hints--; e.target.textContent = `提示（${L.hints}）`; const w = pick(left), k = [0, 1, 2, 3].filter((t) => t !== pz.i && t !== pz.j);
    const hide = pick(k); status.innerHTML = `提示：<b>${[...w].map((c, t) => t === hide ? '○' : c).join('')}</b>`;
  });
  view.upd = setHost;
}

// ---------------------------------------------------------------- duels
function duelHead(extra = '') {
  const r = S.round, side = (id) => `<div class="duelist ${r.turn === id && !r.over ? 'on' : ''} ${r.winner === id ? 'win' : ''}"><b>${esc(P(id)?.n)}</b>${extra(id)}</div>`;
  return `<div class="duel">${side(r.a)}<span class="vs">VS</span>${side(r.b)}</div>`;
}
function zpScreen() {
  const L = view.local; L.hints = 2;
  app.innerHTML = frame(`<div class="card duelc"><div class="qhead"><span>${UNITS.zp.icon} 隻字片語</span><span>用格子上的字接成語</span></div><div class="dh"></div>${timer()}
    <div class="zp" style="--w:${ZP_W}"></div><div class="ctlbox"></div><div class="status"></div><div class="log"></div></div>${host(S.say)}`, { board: true });
  const paint = () => {
    const r = S.round, my = r.turn === me() && !r.over;
    $('.dh').innerHTML = duelHead(() => '');
    $('.zp').innerHTML = r.grid.map((c, i) => `<i class="${c ? 'f' : ''} ${r.last?.includes(i) ? 'new' : ''}">${c}</i>`).join('');
    const box = $('.ctlbox');
    if (my && !box.querySelector('input')) {
      box.innerHTML = `<div class="row ctl"><input class="type wide" placeholder="輸入成語" maxlength="4"><button class="btn small go">送出</button><button class="btn small hint1">提示（${L.hints}）</button></div>`;
      const inp = $('input', box), go = () => { const w = inp.value.trim(); if (!w) return; const t = zpTry(S.round, w); if (t.err) { $('.status').innerHTML = `<b class="no">${esc(t.err)}</b>`; sfx('bad'); return; } inp.value = ''; toHost({ t: 'mv', w }); };
      inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) go(); }; $('.go', box).onclick = go; inp.focus();
      $('.hint1', box).onclick = (e) => { if (!L.hints) return; const o = zpOptions(S.round); if (!o.length) { $('.status').textContent = '好像沒有可以接的成語了…'; return; } L.hints--; e.target.textContent = `提示（${L.hints}）`; inp.value = pick(o); inp.focus(); };
    } else if (!my) box.innerHTML = r.over ? '' : `<p class="hint">${r.turn === me() ? '' : `等 ${esc(P(r.turn)?.n)} 接…`}</p>`;
    $('.status').innerHTML = r.err && r.err.id === me() ? `<b class="no">${esc(r.err.msg)}</b>` : '';
    $('.log').innerHTML = r.log.slice(0, 8).map((s) => `<span>${esc(s)}</span>`).join('');
  };
  paint(); view.upd = () => { setHost(); paint(); };
}
function czScreen() {
  app.innerHTML = frame(`<div class="card duelc"><div class="qhead"><span>${UNITS.cz.icon} 拆字接龍</span><span>換一邊偏旁，接成新字</span></div><div class="dh"></div>${timer()}
    <div class="czcur"></div><div class="ctlbox"></div><div class="log chain"></div></div>${host(S.say)}`, { board: true });
  const paint = () => {
    const r = S.round, my = r.turn === me() && !r.over;
    $('.dh').innerHTML = duelHead((id) => `<span class="miss">${'❌'.repeat(r.miss[id])}${'⚪'.repeat(Math.max(0, 3 - r.miss[id]))}</span>`);
    $('.czcur').innerHTML = `<b>${r.cur}</b><p>${r.keep === 'L' ? '保留<em>左邊</em>，換掉右邊' : r.keep === 'R' ? '保留<em>右邊</em>，換掉左邊' : '換掉左邊或右邊都可以'}</p>`;
    $('.ctlbox').innerHTML = r.over ? '' : my ? `<div class="tiles">${r.tiles.map((c) => `<button class="tile" data-c="${c}">${c}</button>`).join('')}</div>` : `<p class="hint">等 ${esc(P(r.turn)?.n)} 接…</p>`;
    $('.ctlbox').querySelectorAll('.tile').forEach((b) => b.onclick = () => { sfx('tap'); toHost({ t: 'mv', c: b.dataset.c }); $('.ctlbox').innerHTML = ''; });
    $('.log').innerHTML = r.log.slice(0, 8).map((s) => `<span>${esc(s)}</span>`).join('');
  };
  paint(); view.upd = () => { setHost(); paint(); };
}
function wzScreen() {
  app.innerHTML = frame(`<div class="card duelc"><div class="qhead"><span>${UNITS.wz.icon} 文字五子棋</span><span class="cat"></span></div><div class="dh"></div>${timer()}
    <div class="ctlbox"></div><div class="wz" style="--n:${WZ_N}"></div><div class="log"></div></div>${host(S.say)}`, { board: true });
  const paint = () => {
    const r = S.round, my = r.turn === me() && !r.over;
    $('.cat').innerHTML = `題目：<b>${r.cat}</b>`;
    $('.dh').innerHTML = duelHead((id) => `<span class="stone s${id === r.a ? 0 : 1}"></span>`);
    $('.ctlbox').innerHTML = r.over ? '' : my && r.sub === 'pick' ? `<p class="hint">選一個屬於「${r.cat}」的字：</p><div class="tiles">${r.tiles.map((c) => `<button class="tile" data-c="${c}">${c}</button>`).join('')}</div>`
      : my ? `<p class="hint">把「<b>${r.ch}</b>」下在棋盤上</p>` : `<p class="hint">等 ${esc(P(r.turn)?.n)}…</p>`;
    $('.ctlbox').querySelectorAll('.tile').forEach((b) => b.onclick = () => { sfx('tap'); toHost({ t: 'mv', c: b.dataset.c }); $('.ctlbox').innerHTML = ''; });
    $('.wz').innerHTML = r.board.map((c, i) => `<button class="${c ? 'st s' + c.p : ''} ${r.last === i ? 'new' : ''} ${r.line?.includes(i) ? 'line' : ''}" data-i="${i}" ${my && r.sub === 'place' && !c ? '' : 'disabled'}>${c ? c.c : ''}</button>`).join('');
    $('.wz').querySelectorAll('button:not([disabled])').forEach((b) => b.onclick = () => { sfx('tap'); toHost({ t: 'mv', cell: +b.dataset.i }); });
    $('.log').innerHTML = r.log.slice(0, 6).map((s) => `<span>${esc(s)}</span>`).join('');
  };
  paint(); view.upd = () => { setHost(); paint(); };
}

// ---------------------------------------------------------------- clicks
app.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'home') { if (online) leave(); online = false; S = null; H.S = null; screen = 'home'; render(); }
  else if (a === 'mute') { setMute(!muted()); b.textContent = muted() ? '🔇' : '🔊'; }
  else if (a === 'show') startLocal('show');
  else if (a === 'units') { screen = 'units'; render(); }
  else if (a === 'online') { screen = 'online'; render(); }
  else if (a === 'mkroom') enterRoom(newCode());
  else if (a === 'joinroom') { const c = cleanCode($('#code').value); if (c.length === 4) enterRoom(c); else $('#code').focus(); }
  else if (a === 'skip') { if (online) { if (isHost()) skip(); } else skip(); }
  else if (a === 'startroom') { const m = H.S.lobbyMode || 'show'; newShow(H.S.players.map((p) => ({ ...p, score: 0 })), m === 'show' ? 'show' : 'unit', m === 'show' ? null : m, optOf(H.S.opt || {})); }
  else if (a === 'again') { if (online) toLobby(H.S.players.map((p) => ({ ...p, score: 0 }))); else startLocal(last.mode, last.unit); }
  else if (b.dataset.unit) startLocal('unit', b.dataset.unit);
  else if (b.dataset.addbot) { const lv = +b.dataset.addbot, used = H.S.players.map((p) => p.n), nm = BOT_NAMES.find((n) => !used.includes(n)) || '電腦'; H.S.players.push({ id: 'bot' + Math.random().toString(36).slice(2, 7), n: nm, bot: true, lv, score: 0 }); H.dirty = true; tick(); }
  else if (b.dataset.kick) { H.S.players = H.S.players.filter((p) => p.id !== b.dataset.kick); H.dirty = true; tick(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.activeElement?.tagName === 'INPUT') document.activeElement.blur(); });

// a room code in the address (#ABCD) joins it straight away
const hashCode = cleanCode(location.hash.slice(1));
if (hashCode.length === 4) { screen = 'game'; enterRoom(hashCode); } else render();
window.ZZ = { get S() { return S; }, H, startLocal, check };
