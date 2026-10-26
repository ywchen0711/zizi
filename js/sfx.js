// Little synthesized sounds: no files to load.
let ac = null, mute = (() => { try { return localStorage.getItem('zizi.mute') === '1'; } catch (e) { return false; } })();
export const muted = () => mute;
export function setMute(m) { mute = m; try { localStorage.setItem('zizi.mute', m ? '1' : '0'); } catch (e) { /* ignore */ } }
function tone(f, t0, d, type = 'sine', v = 0.18, f2) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
}
const SOUNDS = {
  tap: () => tone(660, 0, 0.06, 'triangle', 0.1),
  tick: () => tone(1200, 0, 0.05, 'square', 0.05),
  ok: () => { tone(784, 0, 0.12, 'triangle'); tone(1175, 0.09, 0.22, 'triangle'); },
  bad: () => { tone(220, 0, 0.25, 'sawtooth', 0.08, 140); },
  turn: () => { tone(523, 0, 0.1, 'triangle', 0.12); tone(659, 0.08, 0.14, 'triangle', 0.12); },
  intro: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.13)); },
  win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.14)); },
  end: () => { [784, 659, 523].forEach((f, i) => tone(f, i * 0.14, 0.3, 'triangle', 0.12)); },
};
export function sfx(name) {
  if (mute) return;
  try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); SOUNDS[name]?.(); } catch (e) { /* no sound */ }
}
