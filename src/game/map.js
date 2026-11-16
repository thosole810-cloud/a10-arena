// ============================================================
// map.js — DỮ LIỆU BẢN ĐỒ 3D (MAP_3D) + XÂY DỰNG ĐỊA HÌNH / MÔI TRƯỜNG / TRỤ / BASE
// Thế giới 200x200 unit, gốc (0,0) ở giữa; x: trái→phải, z: trên→dưới (màn hình)
// Base XANH góc dưới-trái (-78,78), base ĐỎ góc trên-phải (78,-78)
//
//   (-100,-100)  ┌─────── TOP (cong theo cạnh trái+trên) ──────┐ base ĐỎ
//                │ ░ Rừng xanh/Tà Thần(-30,-30)   ╲ MID        │
//                │            ╲                  ╱ Rồng(30,30)│
//   base XANH    └────────╱──────── BOT (cạnh dưới+phải) ──────┘ (100,100)
// ============================================================
import * as THREE from 'three';
import { applyFow } from './scene.js';
import { G, makeRng, smoothstep, clamp, lerp, makeUnit } from './state.js';
import { spawnCamp } from './monsters.js';

const mirror = (a) => a.map(([x, z, w, d]) => [-x, -z, w, d]);

// ---- Đường đi (waypoints) từ base XANH → base ĐỎ ----
const TOP = [[-78, 78], [-81, 30], [-81, -55], [-70, -72], [-55, -81], [30, -81], [78, -78]];
const BOT = TOP.map(([x, z]) => [-x, -z]).reverse();
const MID = [[-78, 78], [0, 0], [78, -78]];

export function laneLength(w) { let L = 0; for (let i = 1; i < w.length; i++) L += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]); return L; }
// Điểm cách đầu đường f (0..1) theo chiều dài
export function pointAt(w, f) {
  let target = laneLength(w) * f;
  for (let i = 1; i < w.length; i++) {
    const seg = Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]);
    if (target <= seg) { const t = target / seg; return { x: lerp(w[i - 1][0], w[i][0], t), z: lerp(w[i - 1][1], w[i][1], t) }; }
    target -= seg;
  }
  return { x: w[w.length - 1][0], z: w[w.length - 1][1] };
}
export function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function distToPolyline(px, pz, w) { let m = 1e9; for (let i = 1; i < w.length; i++) m = Math.min(m, distToSeg(px, pz, w[i - 1][0], w[i - 1][1], w[i][0], w[i][1])); return m; }
// Tiến độ (0..1) của điểm gần nhất trên đường
export function laneProgress(px, pz, w) {
  let best = 1e9, bp = 0, acc = 0; const L = laneLength(w);
  for (let i = 1; i < w.length; i++) {
    const ax = w[i - 1][0], az = w[i - 1][1], bx = w[i][0], bz = w[i][1]; const seg = Math.hypot(bx - ax, bz - az);
    const dx = bx - ax, dz = bz - az; let t = clamp(((px - ax) * dx + (pz - az) * dz) / (seg * seg), 0, 1);
    const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
    if (d < best) { best = d; bp = (acc + seg * t) / L; }
    acc += seg;
  }
  return bp;
}

// Vị trí trụ: 3 trụ/đường/phe — order 0 = ngoài cùng, 2 = trụ nhà
const TOWER_F = [0.39, 0.26, 0.12]; // tiến độ tính từ base mình
function laneTowers(w) {
  const out = [];
  for (let team = 0; team < 2; team++) for (let i = 0; i < 3; i++) {
    const f = team === 0 ? TOWER_F[i] : 1 - TOWER_F[i];
    const p = pointAt(w, f); out.push({ x: p.x, z: p.z, team, order: i });
  }
  return out;
}

export const MAP_3D = {
  size: 200,
  water: { level: -0.7, limit: 91 },
  nexus: { blue: { x: -82, z: 82 }, red: { x: 82, z: -82 } },
  bases: [{ team: 0, x: -78, z: 78, r: 13 }, { team: 1, x: 78, z: -78, r: 13 }],
  lanes: [
    { type: 'top', waypoints: TOP, towers: laneTowers(TOP) },
    { type: 'mid', waypoints: MID, towers: laneTowers(MID) },
    { type: 'bot', waypoints: BOT, towers: laneTowers(BOT) },
  ],
  // Bãi quái — rừng xanh (nửa gần base xanh) & rừng đỏ (đối xứng)
  jungle: [
    { type: 'blue_buff', x: -60, z: -22, respawn: 90, team: 0 }, { type: 'pig', x: -35, z: -12, respawn: 60, team: 0 },
    { type: 'red_buff', x: -22, z: 60, respawn: 90, team: 0 }, { type: 'bird', x: -12, z: 35, respawn: 60, team: 0 },
    { type: 'blue_buff', x: 60, z: 22, respawn: 90, team: 1 }, { type: 'pig', x: 35, z: 12, respawn: 60, team: 1 },
    { type: 'red_buff', x: 22, z: -60, respawn: 90, team: 1 }, { type: 'bird', x: 12, z: -35, respawn: 60, team: 1 },
    { type: 'dragon', x: 30, z: 30, respawn: 180, first: 120, team: 2 },   // Hang Rồng (giữa, lệch dưới) — spawn 2 phút
    { type: 'baron', x: -30, z: -30, respawn: 300, first: 480, team: 2 },  // Hang Tà Thần (giữa, lệch trên) — spawn 8 phút
  ],
  bushes: [], walls: [],
};
// [x, z, w, d] — định nghĩa nửa XANH rồi lấy đối xứng sang nửa ĐỎ
const BUSH_HALF = [[-76, -20, 5, 10], [-36, -60, 8, 5], [-20, -20, 6, 6], [-12, -12, 5, 5], [-62, -6, 5, 8], [-52, 32, 6, 6], [-20, 70, 10, 5], [-6, 30, 5, 7], [-60, -75, 10, 4]];
const WALL_HALF = [[-70, -40, 3, 16], [-52, -44, 3, 10], [-48, -28, 14, 3], [-28, -22, 3, 12], [-40, 38, 3, 14], [-24, 46, 12, 3], [-8, 50, 3, 10], [-46, 58, 14, 3], [-44, -30, 3, 9], [-30, -44, 9, 3], [-16, -40, 3, 6]];
MAP_3D.bushes = [...BUSH_HALF, ...mirror(BUSH_HALF)].map(([x, z, w, d]) => ({ x, z, w, d }));
MAP_3D.walls = [...WALL_HALF, ...mirror(WALL_HALF)].map(([x, z, w, d]) => ({ x, z, w, d, h: 2 }));

// ---------- NOISE + ĐỘ CAO ----------
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;

function rawHeight(x, z) {
  let dl = 1e9; for (const l of MAP_3D.lanes) dl = Math.min(dl, distToPolyline(x, z, l.waypoints));
  let flat = smoothstep(6, 17, dl);                              // đường đi phẳng
  for (const b of MAP_3D.bases) flat = Math.min(flat, smoothstep(b.r, b.r + 11, Math.hypot(x - b.x, z - b.z)));
  for (const c of MAP_3D.jungle) flat = Math.min(flat, smoothstep(5, 11, Math.hypot(x - c.x, z - c.z)));
  const hill = (fbm(x * 0.035 + 7, z * 0.035 + 3) - 0.42) * 6.5;
  const e = Math.max(Math.abs(x), Math.abs(z));
  return hill * flat - smoothstep(87, 98, e) * 4.8;               // rìa bản đồ chìm xuống nước
}
// Lưới độ cao 257x257 — tra bilinear O(1) (tương đương raycast thẳng xuống địa hình nhưng nhanh hơn rất nhiều)
const HN = 256; let HGRID = null;
function buildHeightGrid() {
  HGRID = new Float32Array((HN + 1) * (HN + 1));
  for (let j = 0; j <= HN; j++) for (let i = 0; i <= HN; i++) HGRID[j * (HN + 1) + i] = rawHeight(-100 + i * 200 / HN, -100 + j * 200 / HN);
}
export function heightAt(x, z) {
  if (!HGRID) return rawHeight(x, z);
  const fx = clamp((x + 100) / 200 * HN, 0, HN - 0.001), fz = clamp((z + 100) / 200 * HN, 0, HN - 0.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, W = HN + 1;
  const a = HGRID[j * W + i], b = HGRID[j * W + i + 1], c = HGRID[(j + 1) * W + i], d = HGRID[(j + 1) * W + i + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

// ---------- VA CHẠM TĨNH ----------
export const OBST = { boxes: [], circles: [] };
// Đẩy đơn vị ra khỏi tường/trụ (box + circle). Trả về true nếu có va chạm.
export function resolveObstacles(p, r) {
  let hit = false;
  for (const b of OBST.boxes) {
    if (b.dead) continue;
    const cx = clamp(p.x, b.minx, b.maxx), cz = clamp(p.z, b.minz, b.maxz);
    let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // tâm nằm trong box: đẩy ra cạnh gần nhất
        const l = p.x - b.minx, rr = b.maxx - p.x, t = p.z - b.minz, bt = b.maxz - p.z, m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.minx - r; else if (m === rr) p.x = b.maxx + r; else if (m === t) p.z = b.minz - r; else p.z = b.maxz + r;
      }
    }
  }
  for (const c of OBST.circles) {
    if (c.ref && !c.ref.alive) continue;
    const dx = p.x - c.x, dz = p.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { hit = true; const d = Math.sqrt(d2) || 0.001, k = (rr - d) / d; p.x += dx * k; p.z += dz * k; }
  }
  const L = MAP_3D.water.limit; p.x = clamp(p.x, -L, L); p.z = clamp(p.z, -L, L);
  return hit;
}

// ---------- LƯỚI ĐIỀU HƯỚNG 100x100 + A* ----------
const NAV_N = 100, NAV_C = 2;
const nav = new Uint8Array(NAV_N * NAV_N);
export function buildNav() {
  nav.fill(0);
  for (let j = 0; j < NAV_N; j++) for (let i = 0; i < NAV_N; i++) {
    const x = -100 + (i + 0.5) * NAV_C, z = -100 + (j + 0.5) * NAV_C; let bl = 0;
    if (Math.abs(x) > 91 || Math.abs(z) > 91) bl = 1;
    for (const w of MAP_3D.walls) if (Math.abs(x - w.x) < w.w / 2 + 1.1 && Math.abs(z - w.z) < w.d / 2 + 1.1) { bl = 1; break; }
    if (!bl) for (const l of MAP_3D.lanes) for (const t of l.towers) if (Math.hypot(x - t.x, z - t.z) < 3.4) { bl = 1; break; }
    if (!bl) for (const n of [MAP_3D.nexus.blue, MAP_3D.nexus.red]) if (Math.hypot(x - n.x, z - n.z) < 5.5) { bl = 1; break; }
    nav[j * NAV_N + i] = bl;
  }
}
const cellOf = (x, z) => [clamp(Math.floor((x + 100) / NAV_C), 0, NAV_N - 1), clamp(Math.floor((z + 100) / NAV_C), 0, NAV_N - 1)];
export const isBlocked = (x, z) => { const [i, j] = cellOf(x, z); return nav[j * NAV_N + i] === 1; };
export function hasLOS(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 1.2);
  for (let k = 1; k < n; k++) { const t = k / n; if (isBlocked(lerp(ax, bx, t), lerp(az, bz, t))) return false; }
  return true;
}
function nearestFree(i, j) {
  if (!nav[j * NAV_N + i]) return [i, j];
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NAV_N || b >= NAV_N) continue;
    if (!nav[b * NAV_N + a]) return [a, b];
  }
  return [i, j];
}
const gS = new Float32Array(NAV_N * NAV_N), came = new Int32Array(NAV_N * NAV_N), stamp = new Int32Array(NAV_N * NAV_N), closed = new Int32Array(NAV_N * NAV_N);
let stampId = 0;
// A* 8 hướng, heap nhị phân, không cắt góc. Trả về mảng {x,z}
export function findPath(sx, sz, ex, ez) {
  if (hasLOS(sx, sz, ex, ez)) return [{ x: ex, z: ez }];
  let [si, sj] = cellOf(sx, sz); [si, sj] = nearestFree(si, sj);
  let [ei, ej] = cellOf(ex, ez); [ei, ej] = nearestFree(ei, ej);
  const S = sj * NAV_N + si, E = ej * NAV_N + ei; stampId++;
  const heap = []; const fS = new Map();
  const h = (i, j) => { const dx = Math.abs(i - ei), dz = Math.abs(j - ej); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
  const push = (n, f) => { heap.push([f, n]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = c * 2 + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top[1]; };
  gS[S] = 0; stamp[S] = stampId; came[S] = -1; push(S, h(si, sj)); let it = 0, found = false;
  while (heap.length && it++ < 5000) {
    const cur = pop(); if (closed[cur] === stampId) continue; closed[cur] = stampId;
    if (cur === E) { found = true; break; }
    const ci = cur % NAV_N, cj = (cur / NAV_N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= NAV_N || b >= NAV_N) continue;
      const n = b * NAV_N + a; if (nav[n] || closed[n] === stampId) continue;
      if (di && dj && (nav[cj * NAV_N + a] || nav[b * NAV_N + ci])) continue;
      const g = gS[cur] + (di && dj ? 1.414 : 1);
      if (stamp[n] !== stampId || g < gS[n]) { stamp[n] = stampId; gS[n] = g; came[n] = cur; push(n, g + h(a, b)); }
    }
  }
  if (!found) return [{ x: ex, z: ez }];
  const pts = []; let c = E; while (c !== -1) { pts.push({ x: -100 + ((c % NAV_N) + 0.5) * NAV_C, z: -100 + (((c / NAV_N) | 0) + 0.5) * NAV_C }); c = came[c]; }
  pts.reverse();
  // làm mượt đường (string-pulling bằng LOS)
  const out = []; let ax = sx, az = sz, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1; while (j > i && !hasLOS(ax, az, pts[j].x, pts[j].z)) j--;
    out.push(pts[j]); ax = pts[j].x; az = pts[j].z; i = j + 1;
  }
  if (isBlocked(ex, ez)) return out; out.push({ x: ex, z: ez }); return out;
}

// ---------- BUSH ----------
export function bushAt(x, z) {
  for (const b of MAP_3D.bushes) if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return b;
  return null;
}

// ---------- TEXTURE ĐỊA HÌNH (vẽ bằng canvas, 2048px) ----------
export let TERRAIN_CANVAS = null;
function paintTerrain() {
  const S = 2048, k = S / 200; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const rng = makeRng(77); const P = (v) => (v + 100) * k;
  x.fillStyle = '#4c8a3a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${rng() < 0.5 ? '30,90,30' : '120,170,70'},${0.05 + rng() * 0.07})`; x.beginPath(); x.arc(rng() * S, rng() * S, 20 + rng() * 90, 0, 6.3); x.fill(); }
  // rừng: vùng tối hơn quanh bãi quái
  for (const j of MAP_3D.jungle) { const g = x.createRadialGradient(P(j.x), P(j.z), 5, P(j.x), P(j.z), 12 * k); g.addColorStop(0, 'rgba(120,95,60,.85)'); g.addColorStop(0.55, 'rgba(90,80,50,.45)'); g.addColorStop(1, 'rgba(60,100,40,0)'); x.fillStyle = g; x.beginPath(); x.arc(P(j.x), P(j.z), 12 * k, 0, 6.3); x.fill(); }
  // đường đi
  x.lineCap = 'round'; x.lineJoin = 'round';
  for (const l of MAP_3D.lanes) {
    const stroke = (w, col) => { x.strokeStyle = col; x.lineWidth = w * k; x.beginPath(); l.waypoints.forEach(([a, b], i) => i ? x.lineTo(P(a), P(b)) : x.moveTo(P(a), P(b))); x.stroke(); };
    x.filter = 'blur(10px)'; stroke(14, 'rgba(110,84,50,.55)'); x.filter = 'none'; stroke(9.5, '#a98258'); stroke(7, '#c0996a');
    for (let i = 0; i < 1800; i++) { const t = rng(); const p = pointAt(l.waypoints, t); const ox = (rng() - 0.5) * 8, oz = (rng() - 0.5) * 8; x.fillStyle = rng() < 0.5 ? 'rgba(90,70,45,.5)' : 'rgba(220,200,160,.4)'; x.fillRect(P(p.x + ox), P(p.z + oz), 3 + rng() * 5, 3 + rng() * 4); }
  }
  // base
  for (const b of MAP_3D.bases) {
    const col = b.team === 0 ? '60,130,255' : '255,70,60';
    const g = x.createRadialGradient(P(b.x), P(b.z), 2, P(b.x), P(b.z), (b.r + 3) * k); g.addColorStop(0, `rgba(${col},.35)`); g.addColorStop(0.7, 'rgba(120,120,125,1)'); g.addColorStop(1, 'rgba(120,120,125,0)');
    x.fillStyle = g; x.beginPath(); x.arc(P(b.x), P(b.z), (b.r + 3) * k, 0, 6.3); x.fill();
    x.strokeStyle = `rgba(${col},.9)`; x.lineWidth = 0.5 * k; for (const r of [5, 9, b.r - 0.5]) { x.beginPath(); x.arc(P(b.x), P(b.z), r * k, 0, 6.3); x.stroke(); }
  }
  // bãi cát ven nước
  x.filter = 'blur(14px)'; x.strokeStyle = '#d8c690'; x.lineWidth = 9 * k; x.strokeRect(P(-97), P(-97), 194 * k, 194 * k); x.filter = 'none';
  for (let i = 0; i < 70000; i++) { x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; x.fillRect(rng() * S, rng() * S, 2, 2); }
  TERRAIN_CANVAS = c; return c;
}

// ============================================================
// buildTerrain(scene) — PlaneGeometry 200x200, 128x128 segments + noise
// ============================================================
export function buildTerrain(scene) {
  buildHeightGrid();
  const geo = new THREE.PlaneGeometry(200, 200, 128, 128); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, rawHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(paintTerrain()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = applyFow(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }));
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; scene.add(mesh);
  return mesh;
}

// Nước: plane trong suốt + vertex shader sóng
let waterMat = null;
export function buildWater(scene) {
  waterMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying float vW; varying vec2 vP;
      void main(){ vec3 p=position; float w=sin(p.x*0.35+uTime*1.3)*0.1+cos(p.y*0.3+uTime*1.1)*0.1; p.z+=w; vW=w; vP=p.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uTime; varying float vW; varying vec2 vP;
      void main(){ float s=sin(vP.x*0.8+uTime*2.0)*sin(vP.y*0.8-uTime*1.6); vec3 c=mix(vec3(0.05,0.28,0.5),vec3(0.2,0.6,0.85),0.5+vW*2.2+s*0.12); gl_FragColor=vec4(c,0.82); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 80, 80).rotateX(-Math.PI / 2), waterMat);
  m.position.y = MAP_3D.water.level; scene.add(m);
  // PlaneGeometry xoay -90° => dùng thuộc tính position.y của shader là z gốc; sửa bằng cách xoay trong shader không cần: dùng mesh.rotation thay thế
  m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(320, 320, 80, 80); m.rotation.x = -Math.PI / 2;
  return m;
}
export function updateWater(t) { if (waterMat) waterMat.uniforms.uTime.value = t; }

// ---------- Môi trường: cây / đá / cỏ (InstancedMesh) ----------
export function buildEnvironment(scene) {
  const rng = makeRng(2024);
  const free = (x, z, minLane, extra = 0) => {
    for (const l of MAP_3D.lanes) if (distToPolyline(x, z, l.waypoints) < minLane) return false;
    for (const b of MAP_3D.bases) if (Math.hypot(x - b.x, z - b.z) < b.r + 4 + extra) return false;
    for (const c of MAP_3D.jungle) if (Math.hypot(x - c.x, z - c.z) < 9 + extra) return false;
    for (const w of MAP_3D.walls) if (Math.abs(x - w.x) < w.w / 2 + 2 && Math.abs(z - w.z) < w.d / 2 + 2) return false;
    for (const b of MAP_3D.bushes) if (Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2) return false;
    return true;
  };
  const spots = (n, minLane, maxE = 93) => { const a = []; let guard = 0; while (a.length < n && guard++ < n * 40) { const x = (rng() - 0.5) * 2 * maxE, z = (rng() - 0.5) * 2 * maxE; if (free(x, z, minLane)) a.push([x, z]); } return a; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();

  // CÂY — thân + 2 tầng tán (3 InstancedMesh)
  const trees = spots(300, 10.5);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 1.6, 6), applyFow(new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1, flatShading: true })), trees.length);
  const fol1 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 2.6, 7), applyFow(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })), trees.length);
  const fol2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.05, 2.1, 7), applyFow(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true })), trees.length);
  trees.forEach(([x, z], i) => {
    const s = 0.8 + rng() * 0.9, y = heightAt(x, z); e.set(0, rng() * 6, 0); q.setFromEuler(e); sc.set(s, s, s);
    p.set(x, y + 0.8 * s, z); trunk.setMatrixAt(i, m4.compose(p, q, sc));
    p.set(x, y + 2.5 * s, z); fol1.setMatrixAt(i, m4.compose(p, q, sc));
    p.set(x, y + 3.9 * s, z); fol2.setMatrixAt(i, m4.compose(p, q, sc));
    col.setHSL(0.27 + rng() * 0.08, 0.5 + rng() * 0.2, 0.2 + rng() * 0.1); fol1.setColorAt(i, col); col.offsetHSL(0, 0, 0.04); fol2.setColorAt(i, col);
  });
  for (const m of [trunk, fol1, fol2]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // ĐÁ — icosahedron scale ngẫu nhiên
  const rocks = spots(80, 8);
  const rock = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), applyFow(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })), rocks.length);
  rocks.forEach(([x, z], i) => {
    const s = 0.5 + rng() * 1.8; e.set(rng() * 3, rng() * 6, rng() * 3); q.setFromEuler(e); sc.set(s * (0.8 + rng() * 0.6), s * 0.65, s * (0.8 + rng() * 0.6));
    p.set(x, heightAt(x, z) + s * 0.3, z); rock.setMatrixAt(i, m4.compose(p, q, sc)); col.setHSL(0.08, 0.06, 0.34 + rng() * 0.18); rock.setColorAt(i, col);
  });
  rock.castShadow = rock.receiveShadow = true; scene.add(rock);

  // CỎ — tuft nhỏ (cone 4 cạnh)
  const tufts = spots(1100, 6.5);
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.7, 4), applyFow(new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true })), tufts.length * 3);
  let gi = 0;
  tufts.forEach(([x, z]) => { for (let k = 0; k < 3; k++) { const s = 0.7 + rng() * 0.8; e.set((rng() - 0.5) * 0.5, rng() * 6, (rng() - 0.5) * 0.5); q.setFromEuler(e); sc.set(s, s, s); p.set(x + (rng() - 0.5) * 0.7, heightAt(x, z) + 0.3 * s, z + (rng() - 0.5) * 0.7); grass.setMatrixAt(gi, m4.compose(p, q, sc)); col.setHSL(0.24 + rng() * 0.1, 0.6, 0.28 + rng() * 0.14); grass.setColorAt(gi++, col); } });
  scene.add(grass);
}

// ============================================================
// buildBushes(scene, mapData) — hộp xanh trong suốt 0.7 + tán lá viền quanh
// ============================================================
export function buildBushes(scene, mapData) {
  const rng = makeRng(5);
  const boxMat = applyFow(new THREE.MeshStandardMaterial({ color: 0x2f9a45, transparent: true, opacity: 0.7, depthWrite: false, roughness: 1 }), 0.4);
  const blobGeo = new THREE.IcosahedronGeometry(0.85, 1);
  const blobMats = [0x2e8b3f, 0x3aa84f, 0x278238].map((c) => applyFow(new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })));
  for (const b of mapData.bushes) {
    const y = heightAt(b.x, b.z);
    const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.5, b.d), boxMat); box.position.set(b.x, y + 0.75, b.z); box.renderOrder = 2; scene.add(box);
    const n = Math.round((b.w + b.d) * 1.1);
    for (let i = 0; i < n; i++) {
      const t = i / n, per = 2 * (b.w + b.d); let d = t * per, px, pz;
      if (d < b.w) { px = -b.w / 2 + d; pz = -b.d / 2; } else if ((d -= b.w) < b.d) { px = b.w / 2; pz = -b.d / 2 + d; } else if ((d -= b.d) < b.w) { px = b.w / 2 - d; pz = b.d / 2; } else { d -= b.w; px = -b.w / 2; pz = b.d / 2 - d; }
      const m = new THREE.Mesh(blobGeo, blobMats[i % 3]); const s = 0.8 + rng() * 0.6; m.scale.set(s, s * 0.9, s);
      m.position.set(b.x + px + (rng() - 0.5) * 0.4, y + 0.55 * s, b.z + pz + (rng() - 0.5) * 0.4); m.castShadow = true; scene.add(m);
    }
  }
}

// ============================================================
// buildWalls(scene, mapData) — tường đá cao 2 unit, chặn di chuyển
// ============================================================
export function buildWalls(scene, mapData) {
  const rng = makeRng(31);
  const mat = applyFow(new THREE.MeshStandardMaterial({ color: 0x7a746a, roughness: 1, flatShading: true }));
  const mat2 = applyFow(new THREE.MeshStandardMaterial({ color: 0x8d867a, roughness: 1, flatShading: true }));
  for (const w of mapData.walls) {
    const y = heightAt(w.x, w.z); const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat); base.position.y = w.h / 2; g.add(base);
    const n = Math.ceil(Math.max(w.w, w.d) / 2.2);
    for (let i = 0; i < n; i++) { // đá nhô lô nhô trên đỉnh tường
      const hx = w.w > w.d, t = n > 1 ? i / (n - 1) - 0.5 : 0;
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 + rng() * 0.5, 0), mat2); rk.position.set(hx ? t * w.w : (rng() - 0.5) * 0.5, w.h + 0.1, hx ? (rng() - 0.5) * 0.5 : t * w.d);
      rk.scale.y = 0.6; rk.rotation.set(rng() * 3, rng() * 3, rng() * 3); rk.castShadow = true; g.add(rk);
    }
    base.castShadow = base.receiveShadow = true; g.position.set(w.x, y - 0.2, w.z); scene.add(g);
    OBST.boxes.push({ minx: w.x - w.w / 2, maxx: w.x + w.w / 2, minz: w.z - w.d / 2, maxz: w.z + w.d / 2 });
  }
}

// ============================================================
// BASE: platform tròn + cổng + suối hồi máu + NPC cửa hàng 3D
// ============================================================
export const BASE_INFO = [{}, {}];
export function buildBases(scene) {
  const out = [];
  MAP_3D.bases.forEach((b) => {
    const tc = b.team === 0 ? 0x3d8bff : 0xff4b3e; const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8f8f98, roughness: 0.8, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 1.2 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r + 0.6, 0.5, 40), stone); plat.position.y = 0.05; plat.receiveShadow = plat.castShadow = true; g.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r, 0.18, 6, 60), trim); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; g.add(ring);
    // suối hồi máu
    const fount = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.5, 20), stone); fount.position.set(b.team === 0 ? 7 : -7, 0.4, b.team === 0 ? -7 : 7); g.add(fount);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x4fd0ff, emissive: 0x2aa0ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })); water.position.set(fount.position.x, 0.7, fount.position.z); g.add(water);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0xbff3ff, emissive: 0x6fe0ff, emissiveIntensity: 1.5 })); orb.position.set(fount.position.x, 2.2, fount.position.z); g.add(orb);
    // cổng (2 trụ + xà + cổng sáng) hướng ra giữa bản đồ
    const dir = b.team === 0 ? 1 : -1; const gate = new THREE.Group(); gate.position.set(dir * 9, 0, dir * -9); gate.rotation.y = b.team === 0 ? Math.PI / 4 : -Math.PI * 3 / 4; 
    for (const sx of [-3.2, 3.2]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), stone); pil.position.set(sx, 2.7, 0); pil.castShadow = true; gate.add(pil); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 4), trim); cap.position.set(sx, 5.7, 0); cap.rotation.y = Math.PI / 4; gate.add(cap); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.9, 1.2), stone); lintel.position.y = 5.4; lintel.castShadow = true; gate.add(lintel);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.6), new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); portal.position.y = 2.9; gate.add(portal);
    g.add(gate);
    // NPC cửa hàng: quầy hàng + thương nhân
    const shop = new THREE.Group(); shop.position.set(b.team === 0 ? -7 : 7, 0, b.team === 0 ? -8.5 : 8.5);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4b25, roughness: 1, flatShading: true });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 1, flatShading: true });
    const stall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.4), wood); stall.position.y = 0.55; stall.castShadow = true; shop.add(stall);
    for (const sx of [-1.5, 1.5]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), wood); po.position.set(sx, 1.5, 0.6); shop.add(po); }
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 2.2), cloth); awn.position.set(0, 3, 0.2); awn.rotation.x = -0.2; awn.castShadow = true; shop.add(awn);
    const npc = new THREE.Group(); npc.position.set(0, 0, -1.2);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x6a3da8, flatShading: true })); robe.position.y = 0.75; npc.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8b98a, flatShading: true })); head.position.y = 1.7; npc.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x3d2368, flatShading: true })); hat.position.y = 2.15; npc.add(hat);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb98a4a, flatShading: true })); bag.position.set(0.5, 0.6, -0.3); npc.add(bag);
    npc.rotation.y = Math.PI; shop.add(npc);
    for (let i = 0; i < 3; i++) { const cr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), wood); cr.position.set(-2.4 + i * 0.5, 0.3 + (i === 1 ? 0.6 : 0), 0.9); cr.rotation.y = i; cr.castShadow = true; shop.add(cr); }
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0xffd23d, emissive: 0xffa800, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 })); coin.rotation.x = Math.PI / 2; coin.position.y = 3.9; shop.add(coin);
    shop.rotation.y = b.team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25;
    g.add(shop);
    g.position.y = heightAt(b.x, b.z); scene.add(g);
    BASE_INFO[b.team] = { x: b.x, z: b.z, r: b.r, fountain: { x: b.x + fount.position.x, z: b.z + fount.position.z }, spawn: { x: b.x + (b.team === 0 ? 4 : -4), z: b.z + (b.team === 0 ? -4 : 4) }, anim: (t) => { orb.position.y = 2.2 + Math.sin(t * 2) * 0.2; orb.rotation.y = t; coin.rotation.z = t * 2; portal.material.opacity = 0.18 + Math.sin(t * 3) * 0.06; } };
    out.push(BASE_INFO[b.team]);
  });
  return out;
}

// ============================================================
// buildTowers(scene, mapData) — trụ 3D: cylinder đế + box thân + sphere phát sáng
// ============================================================
function makeTowerMesh(team, big) {
  const tc = team === 0 ? 0x3d8bff : 0xff4b3e; const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a9aa4, roughness: 0.85, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x55555f, roughness: 0.9, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 1.2, roughness: 0.3 });
  const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  mk(new THREE.CylinderGeometry(2.2, 2.5, 0.6, 8), dark, 0.3);
  mk(new THREE.CylinderGeometry(1.7, 1.9, 0.5, 8), stone, 0.85);
  const body = mk(new THREE.BoxGeometry(1.7, 3.6, 1.7), stone, 3.0); body.rotation.y = Math.PI / 4;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const p = mk(new THREE.CylinderGeometry(0.2, 0.26, 3.8, 6), dark, 3.1); p.position.x = Math.cos(a) * 1.25; p.position.z = Math.sin(a) * 1.25; }
  const band = mk(new THREE.CylinderGeometry(1.4, 1.4, 0.18, 8), glow, 2.2); band.scale.set(1.1, 1, 1.1);
  const band2 = mk(new THREE.CylinderGeometry(1.35, 1.35, 0.14, 8), glow, 3.8);
  mk(new THREE.CylinderGeometry(1.5, 1.2, 0.5, 8), dark, 5.1);
  const orb = mk(new THREE.SphereGeometry(0.75, 14, 10), glow, 6.2);
  const ring = mk(new THREE.TorusGeometry(1.1, 0.07, 6, 24), glow, 6.2);
  g.userData = { orb, ring, mats: [glow], base: 1.2 };
  if (big) g.scale.setScalar(1.18);
  return g;
}
function makeNexusMesh(team) {
  const tc = team === 0 ? 0x3d8bff : 0xff4b3e; const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xa7a7b2, roughness: 0.8, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5b5b66, roughness: 0.9, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true });
  const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  mk(new THREE.CylinderGeometry(4.6, 5.2, 0.8, 10), dark, 0.4); mk(new THREE.CylinderGeometry(3.6, 4, 0.8, 10), stone, 1.1);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const p = mk(new THREE.BoxGeometry(0.9, 4, 0.9), stone, 3); p.position.x = Math.cos(a) * 3.1; p.position.z = Math.sin(a) * 3.1; p.rotation.y = a; const t = mk(new THREE.ConeGeometry(0.7, 1, 4), glow, 5.4); t.position.x = p.position.x; t.position.z = p.position.z; }
  const crystal = mk(new THREE.OctahedronGeometry(2.1, 0), glow, 5.2); crystal.scale.y = 1.5;
  const ring = mk(new THREE.TorusGeometry(2.8, 0.12, 6, 36), glow, 4.2); ring.rotation.x = Math.PI / 2.4;
  const ring2 = mk(new THREE.TorusGeometry(3.4, 0.1, 6, 36), glow, 4.8); ring2.rotation.x = Math.PI / 1.7;
  const beam = mk(new THREE.CylinderGeometry(0.5, 1.2, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: tc, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), 10);
  g.userData = { orb: crystal, ring, ring2, beam, mats: [glow], base: 1.6 };
  return g;
}

export function buildTowers(group, mapData) {
  const list = []; OBST.circles.length = 0;
  const T = {};
  for (const lane of mapData.lanes) for (const t of lane.towers) {
    const e = makeUnit('tower', t.team, t.x, t.z, { radius: 2.2, hp: 2800 + t.order * 500, lane: lane.type, order: t.order, stats: { atk: 150 + t.order * 25, ap: 0, armor: 40, mr: 40, speed: 0, range: 14, aspd: 0.9, cdr: 0, regen: 0 } });
    e.maxHp = e.hp; e.pos.y = heightAt(t.x, t.z);
    const m = makeTowerMesh(t.team, t.order === 2); m.position.copy(e.pos); group.add(m); e.model = { group: m }; e.mesh = m; e.towerY = 6.2 * (t.order === 2 ? 1.18 : 1);
    e.rot = Math.atan2(t.x, t.z); T[`${lane.type}${t.team}${t.order}`] = e; list.push(e);
    OBST.circles.push({ x: t.x, z: t.z, r: 2, ref: e });
  }
  for (const e of list) { e.prev = e.order > 0 ? T[`${e.lane}${e.team}${e.order - 1}`] : null; }
  for (const team of [0, 1]) {
    const n = team === 0 ? mapData.nexus.blue : mapData.nexus.red;
    const e = makeUnit('nexus', team, n.x, n.z, { radius: 4, hp: 6000, stats: { atk: 0, ap: 0, armor: 60, mr: 60, speed: 0, range: 0, aspd: 1, cdr: 0, regen: 0 } });
    e.maxHp = e.hp; e.pos.y = heightAt(n.x, n.z); const m = makeNexusMesh(team); m.position.copy(e.pos); group.add(m); e.model = { group: m }; e.mesh = m; e.towerY = 5.5;
    list.push(e); OBST.circles.push({ x: n.x, z: n.z, r: 3.8, ref: e }); G.nexus[team] = e;
  }
  return list;
}
// Hoạt hoạ trụ: orb nhấp nháy + phát sáng mạnh khi bị đánh
export function animateTower(e, t, dt) {
  const u = e.mesh.userData; if (!u) return;
  if (!e.alive) return;
  e.flashT = Math.max(0, e.flashT - dt);
  const k = u.base + Math.sin(t * 3 + e.id) * 0.3 + e.flashT * 6;
  for (const m of u.mats) m.emissiveIntensity = k;
  u.orb.position.y += Math.sin(t * 2 + e.id) * 0.003; u.orb.rotation.y += dt * 1.2; u.ring.rotation.z += dt * 1.5;
  if (u.ring2) u.ring2.rotation.z -= dt;
}
export function destroyTower(e, fx) {
  e.alive = false; const m = e.mesh;
  m.traverse((o) => { if (o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.set(0x000000); } if (o.isMesh) { o.rotation.z += (Math.random() - 0.5) * 0.4; } });
  m.scale.y *= 0.35; m.userData.orb.visible = false; if (m.userData.beam) m.userData.beam.visible = false;
  fx.burst(e.pos.x, e.pos.y + 3, e.pos.z, 0x888888, 60, 8, 1.4, 1.4, { gravity: 6 });
}

// ============================================================
// buildJungle(scene, mapData) — trang trí bãi quái + sinh quái
// ============================================================
export function buildJungle(group, mapData) {
  const camps = []; const rock = new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 1, flatShading: true });
  const rng = makeRng(9);
  for (const c of mapData.jungle) {
    const big = c.type === 'dragon' || c.type === 'baron'; const R = big ? 8 : 5.2;
    const col = { blue_buff: 0x3aa0ff, red_buff: 0xff4a3a, pig: 0xc89a5a, bird: 0xe0d070, dragon: 0xff7a1a, baron: 0xb040ff }[c.type];
    const g = new THREE.Group(); g.position.set(c.x, heightAt(c.x, c.z), c.z);
    const n = big ? 16 : 9;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; if (i % 4 === 3) continue; const s = 0.6 + rng() * 0.7; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock); r.position.set(Math.cos(a) * R, s * 0.4, Math.sin(a) * R); r.scale.y = 0.8; r.rotation.set(rng() * 3, rng() * 3, 0); r.castShadow = true; g.add(r); }
    const rune = new THREE.Mesh(new THREE.RingGeometry(R * 0.45, R * 0.5, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.06; g.add(rune);
    if (big) { const rune2 = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 0.72, 40), rune.material); rune2.rotation.x = -Math.PI / 2; rune2.position.y = 0.07; g.add(rune2); }
    group.add(g);
    const camp = { ...c, rune, spawnT: c.first !== undefined ? c.first : 0, monster: null };
    camps.push(camp);
  }
  for (const camp of camps) spawnCamp(camp, group, false);
  return camps;
}
