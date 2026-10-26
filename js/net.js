// Online rooms over Supabase Realtime (the same project as the site's saves), no game server.
//   rk:<room>  presence: who is here { n, since }   broadcast 'm': every game message { t: type, from, ... }
// The player who has been in the room longest is the host: they deal, check every move, play the computer seats and
// send the whole game to everyone after each change. If the host leaves, the next longest-staying player takes over
// from the last state everyone already has.
const SB_URL = 'https://usoavddhglpbdpwwxium.supabase.co';
const SB_KEY = 'sb_publishable_HbbsnjG0GTwzfRgKyx1Aqg__JUOb24B';   // publishable: safe in the browser
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
const ID_KEY = 'zizi.netid';
const myId = (() => { try { let v = localStorage.getItem(ID_KEY); if (!v) { v = Math.random().toString(36).slice(2, 10); localStorage.setItem(ID_KEY, v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
export const net = { room: null, status: 'off', roster: [], me: { id: myId, n: 'Player', since: Date.now() }, on: null, onRoster: null, onStatus: null };
let sb = null, ch = null, joins = 0;
const status = (s) => { net.status = s; if (net.onStatus) net.onStatus(s); };
export const isHost = () => net.roster.length > 0 && net.roster[0].id === net.me.id;
export async function join(room, name) {
  leave(); const ticket = ++joins;
  net.me.n = name || net.me.n; net.me.since = Date.now(); net.room = room; status('connecting');
  try { const { createClient } = await import(SB_LIB); if (!sb) sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); } catch (e) { status('error'); return; }
  if (ticket !== joins) return;
  const mine = sb.channel('zz:' + room, { config: { broadcast: { self: false }, presence: { key: net.me.id } } }); ch = mine;
  mine.on('presence', { event: 'sync' }, () => {
    if (ch !== mine) return;
    net.roster = Object.entries(mine.presenceState()).map(([id, m]) => ({ id, ...(m[m.length - 1] || {}) })).sort((a, b) => (a.since || 0) - (b.since || 0) || (a.id < b.id ? -1 : 1));
    if (net.onRoster) net.onRoster(net.roster);
  }).on('broadcast', { event: 'm' }, ({ payload }) => { if (ch === mine && payload && net.on) net.on(payload); })
    .subscribe((s) => { if (ch !== mine) return; if (s === 'SUBSCRIBED') { status('on'); mine.track({ n: net.me.n, since: net.me.since }).catch(() => {}); } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') status('error'); });
}
export function leave() { joins++; if (sb && ch) sb.removeChannel(ch); ch = null; net.room = null; net.roster = []; status('off'); }
// to everyone else; loop: true also hands it to this client, so every client handles it the same way
export function send(m, loop = true) { const msg = { ...m, from: net.me.id }; if (ch && net.status === 'on') ch.send({ type: 'broadcast', event: 'm', payload: msg }).catch(() => {}); if (loop && net.on) net.on(msg); }
export const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
