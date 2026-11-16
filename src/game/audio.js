// ============================================================
// audio.js — âm thanh tổng hợp bằng WebAudio (không dùng file/âm thanh gốc có bản quyền)
// whoosh (lướt/đạn) · boom (nổ) · heal (chữa lành) · hit · win
// Thay bằng file .ogg trong /assets khi có tài nguyên thật.
// ============================================================
let ctx = null, muted = false, last = {};
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
export function setMuted(m) { muted = m; }
export const isMuted = () => muted;
function tone(type, f0, f1, dur, vol = 0.12, delay = 0) {
  const c = ac(); if (!c || muted) return; const t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.1, freq = 1200) {
  const c = ac(); if (!c || muted) return; const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(c.destination); s.start();
}
export function sfx(name) {
  const now = performance.now(); if (last[name] && now - last[name] < 60) return; last[name] = now;
  switch (name) {
    case 'whoosh': noise(0.25, 0.1, 1800); tone('sawtooth', 400, 120, 0.2, 0.04); break;
    case 'boom': noise(0.5, 0.2, 200); tone('sine', 120, 35, 0.45, 0.25); break;
    case 'heal': tone('sine', 520, 880, 0.3, 0.1); tone('sine', 660, 1100, 0.3, 0.06, 0.08); break;
    case 'buff': tone('triangle', 300, 600, 0.3, 0.08); break;
    case 'hit': tone('square', 220, 90, 0.08, 0.05); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.3, 0.12, i * 0.14)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.35, 0.08, i * 0.18)); break;
    case 'click': tone('square', 700, 500, 0.05, 0.04); break;
    default: break;
  }
}
