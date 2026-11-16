// ============================================================
// state.js — TRẠNG THÁI DÙNG CHUNG + TIỆN ÍCH TOÁN HỌC
// Mọi module (ai, skills, combat, ui...) đọc/ghi qua đối tượng G
// để tránh phụ thuộc vòng (circular import).
// ============================================================
import * as THREE from 'three';

export const TEAM_BLUE = 0;
export const TEAM_RED = 1;
export const TEAM_NEUTRAL = 2;

export const G = {
  THREE,
  scene: null, camera: null, renderer: null, rig: null, fx: null,
  matchGroup: null,          // nhóm chứa mọi thứ động của 1 trận (xoá khi kết thúc)
  running: false, paused: false, over: false,
  time: 0,                   // giây trong trận
  units: [],                 // mọi đơn vị (tướng, lính, quái, trụ, nexus)
  heroes: [], minions: [], monsters: [], structures: [],
  towers: [],                // trụ + nexus
  nexus: [null, null],
  player: null,
  mode: '5v5',               // '5v5' | '1v1'
  difficulty: 1,             // 0 Dễ, 1 TB, 2 Khó, 3 Ác mộng
  timers: [],                // hàng đợi hành động trễ
  kills: [0, 0],
  debug: { hitbox: false, paths: false, wire: false },
  quality: 1,
  nextId: 1,
  teamBuff: [{ dragon: 0, baron: 0 }, { dragon: 0, baron: 0 }],
  events: [],                // thông điệp cho UI
  save: null,
};

// ---------- toán học ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };
export const dist = (a, b) => Math.sqrt(dist2(a, b));
export const angleLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};

// Bộ random có seed (để cây/đá/tường giống nhau mỗi lần)
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Hành động trễ (dùng cho skill: thiên thạch, bẫy, đấm liên hoàn...)
export function after(sec, fn) { G.timers.push({ t: sec, fn }); }
export function updateTimers(dt) {
  const list = G.timers;
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].t -= dt;
    if (list[i].t <= 0) { const f = list[i].fn; list.splice(i, 1); try { f(); } catch (e) { console.error(e); } }
  }
}

export function emitEvent(type, data) { G.events.push({ type, ...data }); }

// Tạo đơn vị cơ bản (khung dữ liệu chung cho tướng/lính/quái/trụ)
export function makeUnit(kind, team, x, z, o = {}) {
  return Object.assign({
    id: G.nextId++, kind, team, pos: new THREE.Vector3(x, 0, z), yaw: 0, radius: 0.8, alive: true,
    hp: 100, maxHp: 100, mana: 0, maxMana: 0,
    stats: { atk: 10, ap: 0, armor: 0, mr: 0, speed: 5, range: 2, aspd: 1, cdr: 0, regen: 0 },
    target: null, atkCd: 0, atkAnim: 0, castT: 0,
    stunT: 0, slowT: 0, slowPct: 0, rootT: 0, shieldAmt: 0, shieldT: 0, hasteT: 0, hastePct: 0,
    reduceT: 0, reducePct: 0, immuneT: 0, stealthT: 0, markT: 0, airT: 0, lift: 0, forced: null,
    path: null, pathT: 0, inputX: 0, inputZ: 0, flashT: 0, visible: true, seenBy: [false, false],
    lastHitBy: null, lastDmgT: -99, dmgBy: {}, bush: null, model: null, pending: null,
  }, o);
}

// ---------- lưu trữ (localStorage) ----------
const KEY = 'anh_hung_99_save_v1';
export const RANKS = ['Đồng', 'Bạc', 'Vàng', 'Bạch Kim', 'Kim Cương', 'Tinh Anh', 'Cao Thủ', 'Chiến Thần'];
export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* bỏ qua */ }
  if (!s) s = { name: 'Lữ Khách', level: 1, exp: 0, coins: 1500, stars: 0, unlocked: ['binhan', 'khaikiet', 'khoa', 'annie', 'truongan', 'tuan'], wins: 0, games: 0, lastDaily: '', lastHero: 'binhan', rune: 0, badge: 0, start: 0 };
  G.save = s;
  return s;
}
export function writeSave() { try { localStorage.setItem(KEY, JSON.stringify(G.save)); } catch (e) { /* bỏ qua */ } }
export const rankOf = (stars) => { const r = Math.min(RANKS.length - 1, Math.floor(stars / 5)); return { name: RANKS[r], star: stars % 5 }; };
