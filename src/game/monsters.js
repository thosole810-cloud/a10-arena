// ============================================================
// monsters.js — MODEL 3D lính / quái rừng / Rồng / Tà Thần + hàm sinh
// ============================================================
import * as THREE from 'three';
import { G, makeUnit, rand, pick } from './state.js';

const matCache = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...o }));
  return matCache.get(key);
}
const glowMat = (c, i = 1.6) => M(c, { emissive: c, emissiveIntensity: i, roughness: 0.3 });
function add(g, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; }
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sphG = (r, s = 10) => new THREE.SphereGeometry(r, s, Math.max(6, s - 2));
const cylG = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
const coneG = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

// ---------------- LÍNH ----------------
const MGEO = { body: boxG(0.55, 0.6, 0.35), head: sphG(0.2, 8), helm: new THREE.SphereGeometry(0.23, 8, 6, 0, 6.3, 0, 1.7), leg: boxG(0.18, 0.5, 0.2), arm: boxG(0.14, 0.5, 0.14), sword: boxG(0.07, 0.07, 0.8), shield: cylG(0.3, 0.3, 0.06, 10), staff: cylG(0.04, 0.04, 1.6, 5), orb: sphG(0.15, 8) };
export function buildMinionModel(team, type) {
  const g = new THREE.Group(); const tc = team === 0 ? 0x2f7bff : 0xe8392f; const tm = M(tc); const skin = M(0xe0b088); const dark = M(0x333344);
  const rig = {};
  if (type === 'siege') {
    add(g, boxG(1.3, 0.5, 1.9), M(0x6b4a2a), 0, 0.7, 0); add(g, boxG(1.0, 0.4, 0.5), tm, 0, 1.05, -0.5);
    const c = add(g, cylG(0.28, 0.36, 1.5, 10), M(0x444a55, { metalness: 0.6, roughness: 0.4 }), 0, 1.25, 0.4); c.rotation.x = Math.PI / 2 - 0.3; add(g, sphG(0.2, 8), glowMat(0xffa030, 1), 0, 1.5, 1.1);
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.6, 0.6]) { const w = add(g, cylG(0.4, 0.4, 0.16, 12), M(0x4a3320), sx, 0.4, sz); w.rotation.z = Math.PI / 2; }
    g.scale.setScalar(1.15); rig.legs = [];
  } else {
    const body = add(g, MGEO.body, type === 'ranged' ? M(0x7a4cc0) : tm, 0, 0.95, 0);
    add(g, MGEO.head, skin, 0, 1.45, 0);
    rig.legs = [add(g, MGEO.leg, dark, -0.15, 0.45, 0), add(g, MGEO.leg, dark, 0.15, 0.45, 0)];
    rig.armR = add(g, MGEO.arm, skin, 0.38, 1.1, 0); rig.armR.geometry = MGEO.arm.clone().translate(0, -0.2, 0);
    rig.armL = add(g, MGEO.arm, skin, -0.38, 1.1, 0); rig.armL.geometry = MGEO.arm.clone().translate(0, -0.2, 0);
    if (type === 'melee') {
      add(g, MGEO.helm, tm, 0, 1.5, 0).scale.set(1, 1, 1); add(g, coneG(0.06, 0.25, 4), M(0xe8e8e8), 0, 1.8, 0);
      const sw = add(rig.armR, MGEO.sword, M(0xdcdcdc, { metalness: 0.7, roughness: 0.3 }), 0, -0.4, 0.4); sw.castShadow = false;
      const sh = add(rig.armL, MGEO.shield, M(0xc9a23a, { metalness: 0.5 }), -0.1, -0.3, 0.1); sh.rotation.z = Math.PI / 2;
    } else {
      add(g, coneG(0.27, 0.45, 8), M(0x5a2f98), 0, 1.7, 0); add(g, cylG(0.34, 0.34, 0.04, 10), M(0x5a2f98), 0, 1.5, 0);
      const st = add(rig.armR, MGEO.staff, M(0x7a5a2a), 0, -0.25, 0.1); st.castShadow = false; const o = add(rig.armR, MGEO.orb, glowMat(tc, 2), 0, 0.55, 0.1); o.castShadow = false;
    }
    body.castShadow = true;
  }
  g.userData.rig = rig;
  return {
    group: g, rig,
    update(dt, t, moving, attacking, atkP) {
      const ph = t * 9; const l = rig.legs;
      if (l && l.length) { l[0].rotation.x = moving ? Math.sin(ph) * 0.7 : 0; l[1].rotation.x = moving ? -Math.sin(ph) * 0.7 : 0; }
      if (rig.armR) { rig.armR.rotation.x = attacking ? -2.2 + atkP * 2.6 : (moving ? Math.sin(ph) * 0.6 : 0); rig.armL.rotation.x = moving ? -Math.sin(ph) * 0.6 : 0; }
      g.position.y = moving ? Math.abs(Math.sin(ph)) * 0.05 : 0;
    },
    setOpacity() {},
  };
}

// ---------------- QUÁI RỪNG ----------------
function golem(color) {
  const g = new THREE.Group(); const stone = M(0x6e6a64); const gl = glowMat(color, 1.8); const rig = {};
  add(g, new THREE.DodecahedronGeometry(1.15, 0), stone, 0, 1.9, 0, 1.15, 1.3, 1);
  add(g, new THREE.DodecahedronGeometry(0.55, 0), stone, 0, 3.3, 0.15);
  add(g, boxG(0.9, 0.12, 0.1), gl, 0, 3.3, 0.62); add(g, sphG(0.1, 6), gl, -0.22, 3.4, 0.62); add(g, sphG(0.1, 6), gl, 0.22, 3.4, 0.62);
  add(g, boxG(1.4, 0.14, 0.14), gl, 0, 2.2, 0.98).rotation.z = 0.2; add(g, boxG(1.0, 0.14, 0.14), gl, 0, 1.6, 1.0).rotation.z = -0.15;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 1.5, 2.6, 0); add(arm, boxG(0.7, 1.6, 0.7), stone, 0, -0.7, 0); add(arm, new THREE.DodecahedronGeometry(0.62, 0), stone, 0, -1.6, 0); add(arm, boxG(0.5, 0.1, 0.5), gl, 0, -1.0, 0); g.add(arm); rig[s < 0 ? 'armL' : 'armR'] = arm;
    add(g, boxG(0.8, 1.0, 0.8), stone, s * 0.6, 0.5, 0);
    add(g, new THREE.DodecahedronGeometry(0.5, 0), stone, s * 1.0, 3.2, 0, 1, 0.8, 1);
  }
  rig.orbit = new THREE.Group(); rig.orbit.position.y = 2.2; for (let i = 0; i < 3; i++) { const o = add(rig.orbit, new THREE.OctahedronGeometry(0.28, 0), gl, Math.cos(i * 2.1) * 2.1, 0.9, Math.sin(i * 2.1) * 2.1); o.castShadow = false; } g.add(rig.orbit);
  g.userData.rig = rig; return g;
}
function boar() {
  const g = new THREE.Group(); const fur = M(0x8a5a30), dk = M(0x4a2e18), tusk = M(0xf1e8cf); const rig = {};
  add(g, boxG(1.3, 1.0, 2.0), fur, 0, 1.1, 0); add(g, sphG(0.7, 8), fur, 0, 1.15, 0.7, 1.1, 1, 1);
  const head = new THREE.Group(); head.position.set(0, 1.2, 1.2); add(head, boxG(0.9, 0.8, 0.8), fur, 0, 0, 0.1); add(head, cylG(0.3, 0.34, 0.4, 8), M(0xd49a8a), 0, -0.1, 0.6).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const t = add(head, coneG(0.07, 0.5, 5), tusk, s * 0.28, -0.2, 0.62); t.rotation.set(-0.5, 0, s * -0.4); add(head, coneG(0.18, 0.35, 4), dk, s * 0.35, 0.5, 0); add(head, sphG(0.07, 6), glowMat(0xff3030, 1.5), s * 0.25, 0.15, 0.5); } g.add(head);
  for (let i = 0; i < 6; i++) add(g, coneG(0.13, 0.5, 4), dk, 0, 1.75, -0.8 + i * 0.35);
  rig.legs = []; for (const sx of [-0.45, 0.45]) for (const sz of [-0.7, 0.7]) { const l = new THREE.Group(); l.position.set(sx, 0.7, sz); add(l, boxG(0.3, 0.8, 0.3), dk, 0, -0.35, 0); g.add(l); rig.legs.push(l); }
  g.scale.setScalar(1.2); g.userData.rig = rig; return g;
}
function bird() {
  const g = new THREE.Group(); const c1 = M(0xf2c14e), c2 = M(0xd9532b), rig = {};
  const body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  add(body, sphG(0.7, 10), c1, 0, 0, 0, 0.9, 0.9, 1.3); add(body, sphG(0.4, 8), c1, 0, 0.5, 0.8); add(body, coneG(0.14, 0.5, 5), M(0xff9a1a), 0, 0.45, 1.3).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(body, sphG(0.07, 6), glowMat(0xff2020, 1.2), s * 0.18, 0.6, 1.05);
  for (let i = 0; i < 3; i++) add(body, coneG(0.12, 0.55, 4), c2, 0, 0.85 + i * 0.05, 0.6 - i * 0.2).rotation.x = -0.4;
  for (let i = -1; i <= 1; i++) { const f = add(body, boxG(0.15, 0.05, 1.0), c2, i * 0.18, 0, -1.3); f.rotation.y = i * 0.3; }
  rig.wings = []; for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.6, 0.2, 0); for (let i = 0; i < 4; i++) { const f = add(w, boxG(1.2 - i * 0.12, 0.05, 0.38), i % 2 ? c2 : c1, s * (0.7 - i * 0.04), 0, -0.3 + i * 0.28); f.rotation.y = s * (0.1 + i * 0.12); } body.add(w); rig.wings.push(w); }
  rig.body = body; g.scale.setScalar(1.15); g.userData.rig = rig; return g;
}
function wingGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(3.2, 1.6); s.lineTo(5.4, 0.6); s.lineTo(4.4, 0); s.lineTo(5.2, -1.2); s.lineTo(3.6, -0.8); s.lineTo(2.6, -2); s.lineTo(1.4, -1); s.lineTo(0, -0.6); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
}
function dragon() {
  const g = new THREE.Group(); const sc = M(0xc7381f), bl = M(0xf0b36a), dk = M(0x6b1d10), rig = {};
  const body = new THREE.Group(); body.position.y = 2.6; g.add(body); rig.body = body;
  add(body, sphG(1.7, 12), sc, 0, 0, 0, 1, 0.85, 1.5); add(body, sphG(1.5, 10), bl, 0, -0.3, 0.1, 0.9, 0.7, 1.45);
  for (let i = 0; i < 7; i++) add(body, coneG(0.25 - i * 0.015, 0.8, 4), dk, 0, 1.3 - Math.abs(i - 3) * 0.1, -1.8 + i * 0.6);
  const neck = new THREE.Group(); neck.position.set(0, 0.5, 2.1); body.add(neck); rig.neck = neck;
  for (let i = 0; i < 4; i++) add(neck, sphG(0.62 - i * 0.04, 8), sc, 0, 0.35 * i, 0.4 * i);
  const head = new THREE.Group(); head.position.set(0, 1.55, 1.8); neck.add(head); rig.head = head;
  add(head, boxG(1.0, 0.8, 1.2), sc, 0, 0, 0.2); add(head, boxG(0.8, 0.45, 0.9), sc, 0, -0.1, 1.0); add(head, boxG(0.7, 0.2, 0.8), M(0xf5f0e0), 0, -0.4, 0.95);
  for (const s of [-1, 1]) { const h = add(head, coneG(0.16, 1.1, 5), M(0xf1e0b0), s * 0.4, 0.55, -0.2); h.rotation.x = -0.9; add(head, sphG(0.12, 6), glowMat(0xffe040, 2.5), s * 0.5, 0.2, 0.4); }
  rig.fire = add(head, sphG(0.35, 8), glowMat(0xff7a10, 3), 0, -0.2, 1.5); rig.fire.visible = false;
  rig.wings = []; for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 1.0, 0.9, 0.2); const m = new THREE.Mesh(wingGeo(), M(0xa02a16, { side: THREE.DoubleSide })); m.castShadow = true; m.rotation.set(Math.PI / 2, s < 0 ? Math.PI : 0, 0); m.rotation.order = 'YXZ'; m.rotation.set(Math.PI / 2, 0, 0); if (s < 0) m.scale.x = -1; w.add(m); body.add(w); rig.wings.push(w); }
  let prev = new THREE.Group(); prev.position.set(0, -0.2, -2.2); body.add(prev); rig.tail = [prev];
  for (let i = 0; i < 5; i++) { add(prev, sphG(0.9 - i * 0.15, 8), sc, 0, 0, -0.5); const n = new THREE.Group(); n.position.set(0, 0, -1.0); prev.add(n); rig.tail.push(n); prev = n; }
  add(prev, coneG(0.35, 1.0, 4), dk, 0, 0, -0.8).rotation.x = -Math.PI / 2;
  rig.legs = []; for (const sx of [-1.1, 1.1]) for (const sz of [-1.0, 1.1]) { const l = new THREE.Group(); l.position.set(sx, 1.9, sz); add(l, boxG(0.7, 1.7, 0.8), sc, 0, -0.8, 0); add(l, boxG(0.9, 0.3, 1.1), dk, 0, -1.7, 0.2); g.add(l); rig.legs.push(l); }
  g.scale.setScalar(1.25); g.userData.rig = rig; return g;
}
function baron() {
  const g = new THREE.Group(); const sk = M(0x4a2a78), dk = M(0x1d1030), gl = glowMat(0xff40ff, 2.5), bone = M(0xe8ddc8); const rig = {};
  const body = new THREE.Group(); body.position.y = 3.2; g.add(body); rig.body = body;
  add(body, sphG(2.4, 12), sk, 0, 0, 0, 1.1, 1.25, 1); add(body, sphG(1.7, 10), M(0x6a3fa8), 0, -0.3, 0.9, 1, 1, 0.7);
  for (let i = 0; i < 5; i++) add(body, coneG(0.35, 1.3, 5), bone, 0, 2.4 - i * 0.1, -0.6 - i * 0.35).rotation.x = -0.6;
  const head = new THREE.Group(); head.position.set(0, 3.0, 0.7); body.add(head); rig.head = head;
  add(head, sphG(1.1, 10), sk, 0, 0, 0, 1.1, 0.95, 1); add(head, boxG(1.3, 0.5, 0.9), dk, 0, -0.5, 0.65);
  for (const s of [-1, 1]) { const h = add(head, coneG(0.28, 2.2, 6), bone, s * 0.9, 0.8, -0.1); h.rotation.z = -s * 0.9; const h2 = add(head, coneG(0.18, 1.2, 5), bone, s * 1.3, 1.7, -0.1); h2.rotation.z = -s * 0.3; add(head, sphG(0.2, 6), gl, s * 0.45, 0.15, 0.95); for (let i = 0; i < 3; i++) add(head, coneG(0.07, 0.35, 4), bone, s * (0.2 + i * 0.2), -0.7, 1.0).rotation.x = Math.PI; }
  add(head, sphG(0.17, 6), gl, 0, 0.55, 1.0);
  rig.arms = []; for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 2.7, 1.2, 0.2); add(a, sphG(0.9, 8), sk, 0, 0, 0); add(a, boxG(0.9, 2.8, 0.9), sk, 0, -1.5, 0); add(a, sphG(0.85, 8), dk, 0, -3.0, 0.1); for (let i = 0; i < 3; i++) add(a, coneG(0.14, 0.9, 4), bone, (i - 1) * 0.35, -3.6, 0.35).rotation.x = Math.PI * 0.8; add(a, coneG(0.35, 1.6, 5), bone, s * 0.4, 0.8, 0).rotation.z = -s * 0.3; body.add(a); rig.arms.push(a); }
  rig.tent = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; let p = new THREE.Group(); p.position.set(Math.cos(a) * 1.3, -2.4, Math.sin(a) * 1.3 - 0.3); body.add(p); const chain = [p]; for (let i = 0; i < 4; i++) { add(p, sphG(0.55 - i * 0.1, 7), i % 2 ? sk : dk, 0, -0.5, 0); const n = new THREE.Group(); n.position.set(0, -0.8, 0); p.add(n); chain.push(n); p = n; } rig.tent.push(chain); }
  rig.orbit = new THREE.Group(); rig.orbit.position.y = 3.2; g.add(rig.orbit); for (let i = 0; i < 5; i++) { const o = add(rig.orbit, new THREE.OctahedronGeometry(0.45, 0), gl, Math.cos(i * 1.256) * 4.6, rand(-1, 2), Math.sin(i * 1.256) * 4.6); o.castShadow = false; }
  g.userData.rig = rig; return g;
}

const MON = {
  blue_buff: { name: 'Bùa Xanh', hp: 2400, atk: 75, armor: 25, range: 2.8, speed: 4.2, radius: 1.6, exp: 160, gold: 90, buff: 'blue', build: () => golem(0x3aa0ff) },
  red_buff: { name: 'Bùa Đỏ', hp: 2400, atk: 80, armor: 25, range: 2.8, speed: 4.2, radius: 1.6, exp: 160, gold: 90, buff: 'red', build: () => golem(0xff4a3a) },
  pig: { name: 'Heo Rừng', hp: 1400, atk: 55, armor: 10, range: 2.2, speed: 4.8, radius: 1.3, exp: 90, gold: 60, build: boar },
  bird: { name: 'Chim Lửa', hp: 1100, atk: 48, armor: 5, range: 7, speed: 4.5, radius: 1.2, exp: 80, gold: 55, build: bird },
  dragon: { name: 'Rồng', hp: 6500, atk: 150, armor: 45, range: 5, speed: 4.5, radius: 3.0, exp: 400, gold: 250, buff: 'dragon', build: dragon },
  baron: { name: 'Tà Thần', hp: 10000, atk: 230, armor: 60, range: 5.5, speed: 4.2, radius: 3.6, exp: 700, gold: 350, buff: 'baron', build: baron },
};
export const MONSTER_TYPES = MON;

// Hoạt hoạ quái (procedural)
function animMonster(u, dt, t, moving, attacking) {
  const rig = u.model.rig; const type = u.mtype; const ph = t * 6 + u.id;
  if (type === 'bird') { rig.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 9 + u.id) * 0.7 * (i ? -1 : 1); }); rig.body.position.y = 1.6 + Math.sin(t * 3 + u.id) * 0.2; }
  else if (type === 'pig') { rig.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0)) * 0.6 : 0; }); }
  else if (type === 'blue_buff' || type === 'red_buff') {
    rig.orbit.rotation.y = t * 1.5; rig.armL.rotation.x = attacking ? -1.8 + Math.sin(t * 20) * 0.5 : Math.sin(ph * 0.5) * 0.1; rig.armR.rotation.x = attacking ? -1.8 - Math.sin(t * 20) * 0.5 : -Math.sin(ph * 0.5) * 0.1;
  } else if (type === 'dragon') {
    rig.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 2.2) * 0.35; }); rig.tail.forEach((n, i) => { n.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.25; });
    rig.neck.rotation.x = attacking ? 0.5 + Math.sin(t * 14) * 0.2 : Math.sin(t) * 0.05; rig.fire.visible = attacking; rig.body.position.y = 2.6 + Math.sin(t * 1.5) * 0.08;
    rig.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 6 + (i % 2) * Math.PI) * 0.5 : 0; });
  } else if (type === 'baron') {
    rig.orbit.rotation.y = t * 0.8; rig.tent.forEach((ch, k) => ch.forEach((n, i) => { n.rotation.x = Math.sin(t * 2 + k + i * 0.7) * 0.35; n.rotation.z = Math.cos(t * 1.6 + k * 1.3 + i * 0.5) * 0.3; }));
    rig.arms.forEach((a, i) => { a.rotation.x = attacking ? -1.7 + Math.sin(t * 12) * 0.5 : Math.sin(t * 1.2 + i * 3) * 0.12; }); rig.body.position.y = 3.2 + Math.sin(t * 1.2) * 0.12; rig.head.rotation.y = Math.sin(t * 0.7) * 0.2;
  }
}

// ---------------- SINH QUÁI / LÍNH ----------------
export function spawnCamp(camp, group) {
  camp.group = group;
  if (camp.spawnT > 0) { camp.timer = camp.spawnT; return; } // dragon/baron: chờ tới giờ spawn
  createMonster(camp);
}
export function createMonster(camp) {
  const t = MON[camp.type]; const model = t.build(); const big = camp.type === 'dragon' || camp.type === 'baron';
  const u = makeUnit('monster', 2, camp.x, camp.z, { radius: t.radius, hp: t.hp, mtype: camp.type, camp, name: t.name, spawn: { x: camp.x, z: camp.z }, leash: big ? 18 : 14,
    stats: { atk: t.atk, ap: 0, armor: t.armor, mr: t.armor, speed: t.speed, range: t.range, aspd: big ? 0.75 : 0.9, cdr: 0, regen: 0 } });
  u.maxHp = t.hp; u.model = { group: model, rig: model.userData.rig, update() {}, setOpacity() {} };
  u.pos.y = 0; model.position.copy(u.pos); camp.group.add(model); camp.monster = u; camp.timer = 0;
  G.units.push(u); G.monsters.push(u); u.visible = false; model.visible = false; camp.rune.material.opacity = 0.55;
  return u;
}
export function updateMonsterAnim(u, dt, t, moving, attacking) { animMonster(u, dt, t, moving, attacking); }
export function removeMonster(u) { u.model.group.parent && u.model.group.parent.remove(u.model.group); }
// Cập nhật hồi sinh quái
export function updateCamps(camps, dt) {
  for (const c of camps) {
    if (c.monster && c.monster.alive) continue;
    if (c.timer > 0) { c.timer -= dt; if (c.timer <= 0) { createMonster(c); G.events.push({ type: 'camp', camp: c }); } }
    c.rune.material.opacity = c.timer > 0 ? 0.12 : 0.55;
  }
}

export function spawnMinion(team, lane, type, laneIdx) {
  const wp = lane.waypoints.map(([x, z]) => ({ x, z })); const route = team === 0 ? wp : wp.slice().reverse();
  const minutes = G.time / 60;
  const base = { melee: { hp: 480, atk: 32, range: 2.1, speed: 5.2, armor: 8, gold: 38, exp: 60, aspd: 0.9 }, ranged: { hp: 340, atk: 46, range: 7.5, speed: 5.2, armor: 4, gold: 30, exp: 45, aspd: 0.8 }, siege: { hp: 950, atk: 62, range: 8.5, speed: 4.6, armor: 25, gold: 50, exp: 80, aspd: 0.6 } }[type];
  const o = pick([0, 1]) ? rand(-1.2, 1.2) : rand(-0.8, 0.8);
  const start = route[0];
  const u = makeUnit('minion', team, start.x + (team === 0 ? 3 : -3) + o, start.z + (team === 0 ? -3 : 3) + o, { radius: type === 'siege' ? 0.9 : 0.55, hp: base.hp + minutes * 22, mtype: type, lane: lane.type, laneIdx, route, wp: 1, goldV: base.gold, expV: base.exp,
    stats: { atk: base.atk + minutes * 1.6, ap: 0, armor: base.armor + minutes * 0.8, mr: base.armor, speed: base.speed, range: base.range, aspd: base.aspd, cdr: 0, regen: 0 } });
  u.maxHp = u.hp; u.model = buildMinionModel(team, type); u.model.group.position.copy(u.pos); G.matchGroup.add(u.model.group);
  u.visible = team === 0; G.units.push(u); G.minions.push(u); return u;
}
