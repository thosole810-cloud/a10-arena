// ============================================================
// main.js — KHỞI TẠO THREE.JS, VÒNG LẶP GAME, INPUT (PC + MOBILE), QUẢN LÝ TRẬN ĐẤU
// Thứ tự: loading (dựng thế giới tĩnh) → lobby → chọn tướng → startMatch() → loop → finishMatch()
// ============================================================
import * as THREE from 'three';
import { G, loadSave, writeSave, rankOf, updateTimers, rand, pick, clamp, after, RANKS } from './state.js';
import { createRenderer, createScene, CameraRig, initFow, updateFow, clearFow, updateLights } from './scene.js';
import { MAP_3D, heightAt, buildTerrain, buildWater, updateWater, buildEnvironment, buildBushes, buildWalls, buildBases, buildTowers, buildJungle, buildNav, OBST, BASE_INFO, findPath, hasLOS } from './map.js';
import { spawnMinion, updateCamps } from './monsters.js';
import { HEROES, HERO_BY_ID } from './heroes.js';
import { FX } from './fx.js';
import { createHero, updateUnits, updateVisuals, updateVision, visionSources, goTo, steerTo, stop, tryAttack, inAttackRange, faceTo, canSee, nearestEnemy, startRecall, useHealSpell, buyItem, sellItem, ITEMS, DIFF, recalc, cancelRecall, isTargetable, kill } from './combat.js';
import { castSkill, updateSkills, resetSkills } from './skills.js';import { initBot, updateBot, updateTeamObjectives } from './ai.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';
import { NET, netSend, sendSnap, sendOver, sendInput, leaveRoom, prepNetIdentity } from './net.js';

G.keyMode = 'click'; // PC: click để đi, QWER là chiêu. Mobile: joystick (giữ nguyên)
let renderer, scene, camera, rig, sun, lights, env;
const keys = {}; const mouse = { x: 0, y: 0, ground: new THREE.Vector3(), has: false };
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
let staticBoxes = 0, targetRing, clickMark, waveT = 0, waveN = 0, visT = 0, fowT = 0, mapT = 0, objT = 0, fountT = 0, endT = 0, last = 0;
const dbg = { circles: [], lines: [] };

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ============================================================
// KHỞI TẠO
// ============================================================
export async function initGame(root) {
  loadSave(); prepNetIdentity(G.save);
  UI.buildDOM(root, { startMatch, cast: castFromUI, attack: attackNearest, heal: () => { useHealSpell(G.player); sendInput({ k: 'heal' }); }, recall: toggleRecall, buy: (id) => { buyItem(G.player, id); sendInput({ k: 'buy', id }); }, sell: (i) => sellItem(G.player, i), quit: () => finishMatch(false) });
  UI.setProgress(0.05, 'Tạo renderer WebGL (PCFSoft shadow)...'); await nextFrame();
  renderer = createRenderer(UI.el.canvas);
  const s = createScene(); scene = s.scene; sun = s.sun; lights = s.skillLights; G.quality = s.mobile ? 0.5 : 1; G.mobile = s.mobile;
  if (s.mobile) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000); camera.position.set(0, 18, 12);
  rig = new CameraRig(camera); G.scene = scene; G.camera = camera; G.renderer = renderer; G.cam = rig; G.rig = rig;
  initFow(); G.fx = new FX(scene, lights); G.fx.setScale(renderer.domElement.height);
  UI.setProgress(0.2, 'Dựng địa hình 3D (128x128, noise)...'); await nextFrame();
  buildTerrain(scene); buildWater(scene);
  UI.setProgress(0.4, 'Trồng cây, đá, cỏ (InstancedMesh)...'); await nextFrame();
  buildEnvironment(scene);
  UI.setProgress(0.6, 'Dựng bụi cỏ, tường đá...'); await nextFrame();
  buildBushes(scene, MAP_3D); buildWalls(scene, MAP_3D); staticBoxes = OBST.boxes.length;
  UI.setProgress(0.8, 'Dựng căn cứ, cổng, cửa hàng NPC...'); await nextFrame();
  buildBases(scene); buildNav();
  // vòng chọn mục tiêu + dấu click
  targetRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); targetRing.visible = false; targetRing.renderOrder = 6; scene.add(targetRing);
  G.matchGroup = new THREE.Group(); scene.add(G.matchGroup);
  bindInput(); window.addEventListener('resize', onResize); window.__G = G; window.__dbg = { initBot, castSkill }; window.__NET = NET;
  UI.setProgress(1, 'Sẵn sàng! Nhấn BẮT ĐẦU');
  last = performance.now(); requestAnimationFrame(frame);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); G.fx.setScale(renderer.domElement.height); UI.resizeOverlay();
  if (UI.preview) UI.preview.resize();
}

// ============================================================
// BẮT ĐẦU / KẾT THÚC TRẬN
// ============================================================
function cleanupMatch() {
  if (G.matchGroup) scene.remove(G.matchGroup);
  G.matchGroup = new THREE.Group(); scene.add(G.matchGroup);
  OBST.boxes.length = staticBoxes; G.units = []; G.heroes = []; G.minions = []; G.monsters = []; G.towers = []; G.timers = []; G.events = []; G.kills = [0, 0]; G.teamBuff = [{ dragon: 0, baron: 0 }, { dragon: 0, baron: 0 }]; G.objective = [null, null];
  G.fx.clear(); resetSkills(); G.over = false; G.winner = null; G.time = 0; G.paused = false; G.player = null; targetRing.visible = false;
}
function startMatch(cfg) {
  cleanupMatch(); G.mode = cfg.mode; G.difficulty = cfg.diff; waveT = 6; waveN = 0; visT = fowT = mapT = objT = endT = 0;
  NET.inputs = []; NET.snap = null; NET.sentOver = false; NET.snapT = 0;
  G.netMatch = !!(cfg.netPlayers && cfg.netPlayers.length);
  G.towers = buildTowers(G.matchGroup, MAP_3D); G.units.push(...G.towers);
  G.camps = buildJungle(G.matchGroup, MAP_3D);
  const save = G.save; const netPlayers = cfg.netPlayers || null;
  const myNp = netPlayers ? netPlayers.find((p) => p.id === NET.id) : null;
  const pdef = HERO_BY_ID[(myNp && myNp.hero) || cfg.heroId] || HERO_BY_ID.binhan;
  const player = createHero(pdef, 0, { isPlayer: true, name: (myNp && myNp.name) || save.name, rune: cfg.rune, badge: cfg.badge, role: 'mid', slot: 0 });
  if (myNp) player.netId = myNp.id;
  G.player = player;
  const startItem = ITEMS.find((i) => i.id === ['sword', 'staff', 'armor', 'boots'][cfg.start || 0]); if (startItem && player.gold >= startItem.cost) buyItem(player, startItem.id);
  // chọn tướng cho bot (không trùng nhau, trừ tướng người chơi online)
  let pool = HEROES.filter((h) => h.id !== pdef.id && !(netPlayers && netPlayers.some((np) => np.hero === h.id))); const prefs = { jungle: ['leanh', 'khaikiet', 'dat'], top: ['tuan', 'binhan', 'dat'], mid: ['khoa', 'tung', 'khaikiet'], bot: ['annie', 'tung', 'truongan', 'thaonhi'] };
  const take = (role) => { const id = (prefs[role] || []).find((x) => pool.some((h) => h.id === x)); const h = id ? pool.find((p) => p.id === id) : pick(pool); pool = pool.filter((p) => p !== h); return h; };
  const slots = cfg.mode === '1v1' ? [[], ['mid']] : [['top', 'bot', 'bot', 'jungle'], ['top', 'mid', 'bot', 'bot', 'jungle']];
  const redOrder = slots[1].slice(); // hạ priority support: bot đầu tiên là xạ thủ
  prefs.support = ['truongan', 'thaonhi'];
  // bạn bè cùng đội (online): tạo tướng người cho họ
  const remotes = netPlayers ? netPlayers.filter((p) => p.id !== NET.id) : [];
  remotes.forEach((np, i) => {
    const def = HERO_BY_ID[np.hero] || pdef;
    const h = createHero(def, 0, { name: np.name, role: slots[0][i] || 'mid', slot: i + 1, rune: 0, badge: 0 });
    h.netId = np.id;
  });
  // bot lấp đầy nốt (đội ta tổng 5 người)
  let nb = 0;
  slots[0].forEach((role, i) => {
    if (i < remotes.length) return; // slot này đã có bạn bè online
    const def = take(role === 'bot' ? (nb++ === 1 ? 'support' : 'bot') : role); mkBot(def, 0, role, i + 1);
  });
  nb = 0;
  redOrder.forEach((role, i) => { const def = take(role === 'bot' ? (nb++ === 1 ? 'support' : 'bot') : role); mkBot(def, 1, role, i); });
  // thế giới
  G.heroes.forEach((h) => { h.pos.y = heightAt(h.pos.x, h.pos.z); });
  clearFow(); updateVision(); rig.snap(player.pos); G.camSnap = false; rig.yaw = 0; rig.dist = 21.6;
  updateFow(visionSources[0]); UI.show('hud'); UI.initHUD(); UI.pause(false); G.running = true;
  UI.banner('TRẬN ĐẤU BẮT ĐẦU!', { gold: true }); UI.feedMsg(cfg.mode === '1v1' ? '1v1 giữa đường — hạ Nexus địch!' : '5v5 — phá Nexus địch, bảo vệ Nexus ta!', 0);
  sfx('buff');
}
function mkBot(def, team, role, slot) {
  const b = createHero(def, team, { isBot: true, name: def.name, role, slot, rune: Math.floor(Math.random() * 3), badge: Math.floor(Math.random() * 3) }); initBot(b, role); return b;
}
function finishMatch(win) {
  if (!G.running) return; G.running = false; const s = G.save; const p = G.player;
  if (NET.active) leaveRoom(); // online: rời phòng khi trận xong
  const coins = win ? 150 + p.kills * 8 : 50 + p.kills * 4; const exp = win ? 90 : 35; const before = rankOf(s.stars).name;
  s.coins += coins; s.exp += exp; s.games++; let levelUp = false; while (s.exp >= 100 + s.level * 60) { s.exp -= 100 + s.level * 60; s.level++; levelUp = true; }
  let delta = 0; if (win) { s.wins++; delta = 1; } else if (s.stars > 0) delta = -1; s.stars = Math.max(0, s.stars + delta); writeSave();
  UI.showEnd({ win, coins, exp, levelUp, starDelta: delta, rank: rankOf(s.stars).name + (before !== rankOf(s.stars).name ? ' (đổi hạng!)' : '') });
}

// ============================================================
// INPUT
// ============================================================
function pickGroundNDC(nx, ny) {
  ndc.set(nx, ny); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction; if (d.y > -0.001) return null;
  let h = 0, x = 0, z = 0; for (let i = 0; i < 3; i++) { const t = (h - o.y) / d.y; x = o.x + d.x * t; z = o.z + d.z * t; h = heightAt(x, z); }
  return new THREE.Vector3(x, h, z);
}
function pickGround(cx, cy) { return pickGroundNDC((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1); }
const sph = new THREE.Sphere(), hitP = new THREE.Vector3();
function pickEnemy(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const me = G.player; let best = null, bd = 1e9;
  for (const u of G.units) {
    if (!u.alive || u.team === 0 || !isTargetable(u)) continue; if (!u.seenBy[0] && u.kind !== 'tower' && u.kind !== 'nexus') continue;
    const yy = u.kind === 'tower' ? 3 : u.kind === 'nexus' ? 4 : u.kind === 'monster' ? u.radius : 1; sph.center.set(u.pos.x, u.pos.y + yy, u.pos.z); sph.radius = Math.max(u.radius * 1.5, u.kind === 'minion' ? 0.9 : 1.1) * (G.mobile ? 1.4 : 1);
    if (ray.ray.intersectSphere(sph, hitP)) { const d = hitP.distanceTo(ray.ray.origin) - (u.kind === 'hero' ? 3 : 0); if (d < bd) { bd = d; best = u; } }
  }
  void me; return best;
}
function clickAt(cx, cy, right) {
  const p = G.player; if (!G.running || G.paused || !p || !p.alive) return; if (G.over) return;
  const e = pickEnemy(cx, cy);
  if (e) { p.target = e; p.path = null; p.dest = null; cancelRecall(p); sfx('click'); sendInput({ k: 'atk', id: e.id }); return; }
  const g = pickGround(cx, cy); if (!g) return; void right;
  p.target = null; goTo(p, g.x, g.z, true); cancelRecall(p); G.fx.ring(g.x, g.y, g.z, 1.2, 0x66ff99, 0.45, { r0: 0.3 });
  sendInput({ k: 'mv', x: +g.x.toFixed(2), z: +g.z.toFixed(2) });
}
function aimPoint() { const p = G.player; if (mouse.has) return mouse.ground; return { x: p.pos.x + Math.sin(p.yaw) * 5, z: p.pos.z + Math.cos(p.yaw) * 5 }; }
function castKey(i) { const p = G.player; if (!G.running || G.paused || !p) return; const aim = aimPoint(); const ok = castSkill(p, i, aim); if (ok) { p.path = null; p.dest = null; sendInput({ k: 'cast', i, x: +aim.x.toFixed(2), z: +aim.z.toFixed(2) }); } }
// Gọi từ nút skill mobile: drag = {x,y} px màn hình hoặc null (ngắm tự động)
function castFromUI(i, drag) {
  const p = G.player; if (!G.running || G.paused || !p || !p.alive) return; const sk = p.def.skills[i]; const range = sk.range || sk.radius || 6; let aim;
  const f = { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) }, r = { x: Math.cos(rig.yaw), z: -Math.sin(rig.yaw) };
  if (drag) { let dx = r.x * drag.x + f.x * -drag.y, dz = r.z * drag.x + f.z * -drag.y; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const k = Math.max(5, range * 0.85); aim = { x: p.pos.x + dx * k, z: p.pos.z + dz * k }; }
  else {
    const t = nearestEnemy(p, Math.max(range + 3, 9), { heroOnly: false, noStruct: sk.kind === 'proj' || sk.kind === 'mark', prefer: (u) => u.kind === 'hero' }) || nearestEnemy(p, 14);
    aim = t ? { x: t.pos.x, z: t.pos.z } : { x: p.pos.x + Math.sin(p.yaw) * 6, z: p.pos.z + Math.cos(p.yaw) * 6 };
  }
  castSkill(p, i, aim);
  if (p.cd[i] > 0) sendInput({ k: 'cast', i, x: +aim.x.toFixed(2), z: +aim.z.toFixed(2) });
}
function attackNearest() {
  const p = G.player; if (!G.running || !p || !p.alive) return;
  const t = nearestEnemy(p, p.stats.range + 3.5, { prefer: (u) => u.kind === 'hero' }) || nearestEnemy(p, 16, { prefer: (u) => u.kind === 'hero' });
  if (t) { p.target = t; p.path = null; p.dest = null; cancelRecall(p); sendInput({ k: 'aa' }); }
}
function toggleRecall() { const p = G.player; if (!p || !p.alive) return; if (p.recallT > 0) { cancelRecall(p); sendInput({ k: 'recall' }); } else { stop(p); startRecall(p); sendInput({ k: 'recall' }); } }

function bindInput() {
  const cv = UI.el.canvas; const wrap = document.documentElement;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  let mid = null;
  cv.addEventListener('mousedown', (e) => { if (e.button === 1) { mid = e.clientX; e.preventDefault(); return; } clickAt(e.clientX, e.clientY, e.button === 2); });
  window.addEventListener('mouseup', (e) => { if (e.button === 1) mid = null; });
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; if (mid !== null) { rig.rotate(-(e.clientX - mid) * 0.006); mid = e.clientX; } });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); rig.zoom(e.deltaY * 0.012); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; keys[e.code] = true; if (!G.running) return;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'F1', 'F2', 'F3', 'F4', 'Tab'].includes(e.code)) e.preventDefault();
    // Chế độ phím PC: click chuột = đi/đánh mục tiêu, Q/W/E/R = kỹ năng, Space = đánh thường.
    // Mobile giữ nguyên: joystick ảo + nút skill.
    if (e.code === 'KeyQ') castKey(0);
    if (e.code === 'KeyE') castKey(2); if (e.code === 'KeyR') castKey(3);
    if (e.code === 'KeyW') castKey(1);
    if (e.code === 'Space') attackNearest(); if (e.code === 'KeyF') { useHealSpell(G.player); sendInput({ k: 'heal' }); } if (e.code === 'KeyB') toggleRecall();
    if (e.code === 'F1') { G.debug.hitbox = !G.debug.hitbox; UI.feedMsg('F1 Hitbox: ' + (G.debug.hitbox ? 'BẬT' : 'TẮT'), 0); }
    if (e.code === 'F2') { G.player.gold += 1000; G.player.goldTotal += 1000; UI.feedMsg('F2: +1000 vàng', 0); }
    if (e.code === 'F3') { G.debug.paths = !G.debug.paths; UI.feedMsg('F3 Đường bot: ' + (G.debug.paths ? 'BẬT' : 'TẮT'), 0); }
    if (e.code === 'F4') { G.debug.wire = !G.debug.wire; scene.overrideMaterial = G.debug.wire ? new THREE.MeshBasicMaterial({ color: 0x33ff99, wireframe: true }) : null; }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // ----- cảm ứng: chạm = click, 2 ngón = zoom + xoay camera Y -----
  let t0 = null, pinch = null;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, t: performance.now() }; }
    else if (e.touches.length === 2) { t0 = null; pinch = tpinch(e); }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) { const n = tpinch(e); rig.zoom(-(n.d - pinch.d) * 0.04); let da = n.a - pinch.a; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; rig.rotate(-da); pinch = n; }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', (e) => {
    if (t0 && e.changedTouches.length === 1) { const t = e.changedTouches[0]; if (performance.now() - t0.t < 350 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) < 14) clickAt(t.clientX, t.clientY, false); }
    if (e.touches.length < 2) pinch = null; t0 = null; e.preventDefault();
  }, { passive: false });
  void wrap;
}
const tpinch = (e) => { const a = e.touches[0], b = e.touches[1]; return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), a: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) }; };

// ============================================================
// ĐIỀU KHIỂN NGƯỜI CHƠI mỗi frame
// ============================================================
function controlPlayer() {
  const p = G.player; if (!p || p.isBot) return;
  if (!p.alive) { p.inputX = p.inputZ = 0; return; }
  // Cưỡi Thần Ngưu: luôn lao theo con chuột, không được dừng lại
  if (p.mountT > 0 && !G.mobile) {
    const g = mouse.ground; const dx = g.x - p.pos.x, dz = g.z - p.pos.z; const l = Math.hypot(dx, dz);
    if (l > 0.25) { p.inputX = dx / l; p.inputZ = dz / l; } else { p.inputX = Math.sin(p.yaw); p.inputZ = Math.cos(p.yaw); }
    p.target = null; p.path = null; p.dest = null;
    return;
  }
  // Di chuyển: mobile = joystick ảo; PC = click chuột (không dùng bàn phím để đi)
  let sx = 0, sy = 0;
  sx += UI.joy.x; sy += -UI.joy.y; const mag = Math.hypot(sx, sy);
  if (mag > 0.15) {
    const f = { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) }, r = { x: Math.cos(rig.yaw), z: -Math.sin(rig.yaw) };
    p.inputX = f.x * sy + r.x * sx; p.inputZ = f.z * sy + r.z * sx; p.target = null; p.path = null; p.dest = null; cancelRecall(p);
  } else { p.inputX = p.inputZ = 0; }
  controlHero(p);
}

// Logic tấn công/di chuyển theo mục tiêu — dùng cho tướng do người chơi điều khiển
// (người chơi local + tướng online của bạn bè trên máy chủ)
function controlHero(p) {
  if (!p.alive || p.stunT > 0 || p.airT > 0) return;
  const moving = p.inputX || p.inputZ;
  if (!moving && p.target) {
    const t = p.target; if (!t.alive || (!canSee(p.team, t) && t.kind !== 'tower' && t.kind !== 'nexus') || !isTargetable(t)) p.target = null;
    else if (inAttackRange(p, t)) { stop(p); faceTo(p, t.pos.x, t.pos.z); tryAttack(p, t); }
    else if (hasLOS(p.pos.x, p.pos.z, t.pos.x, t.pos.z)) steerTo(p, t.pos.x, t.pos.z); else goTo(p, t.pos.x, t.pos.z);
  } else if (!moving && !p.path && !p.dest && p.recallT <= 0) {
    // tự động đánh khi đứng yên (auto-attack)
    const t = nearestEnemy(p, p.stats.range + 0.2, { prefer: (u) => u.kind === 'hero' }); if (t) { faceTo(p, t.pos.x, t.pos.z); tryAttack(p, t); }
  }
}

// ============================================================
// SINH LÍNH
// ============================================================
function spawnWave() {
  waveN++; const lanes = G.mode === '1v1' ? [1] : [0, 1, 2];
  for (const li of lanes) for (const team of [0, 1]) {
    const lane = MAP_3D.lanes[li]; const seq = ['melee', 'melee', 'melee', 'ranged']; if (waveN % 3 === 0 && waveN > 2) seq.push('siege');
    seq.forEach((type, i) => after(i * 0.9, () => { if (!G.over) spawnMinion(team, lane, type, li); }));
  }
}

// ============================================================
// ONLINE — đồng bộ input + snapshot giữa các người chơi
// ============================================================
function applyNetInput(h, m) {
  if (!h || !m) { window.__NET && (window.__NET.dbgNoHero = (window.__NET.dbgNoHero || 0) + 1); return; }
  if (m.k === 'cast') { if (!h.alive) return; const ok = castSkill(h, m.i, { x: m.x, z: m.z }); window.__NET && (window.__NET.dbgCast = (window.__NET.dbgCast || 0) + (ok ? 1 : 100)); if (ok) { h.path = null; h.dest = null; } return; }
  if (m.k === 'mv') { if (!h.alive) return; h.target = null; goTo(h, m.x, m.z, true); cancelRecall(h); }
  else if (m.k === 'atk') { if (!h.alive) return; const t = G.units.find((u) => u.id === m.id); if (t && t.alive) { h.target = t; h.path = null; h.dest = null; cancelRecall(h); } }
  else if (m.k === 'cast') { if (!h.alive) return; if (castSkill(h, m.i, { x: m.x, z: m.z })) { h.path = null; h.dest = null; } }
  else if (m.k === 'aa') { if (!h.alive) return; const t = nearestEnemy(h, h.stats.range + 3.5, { prefer: (u) => u.kind === 'hero' }) || nearestEnemy(h, 16, { prefer: (u) => u.kind === 'hero' }); if (t) { h.target = t; h.path = null; h.dest = null; cancelRecall(h); } }
  else if (m.k === 'buy') buyItem(h, m.id);
  else if (m.k === 'heal') useHealSpell(h);
  else if (m.k === 'recall') { if (!h.alive) return; if (h.recallT > 0) cancelRecall(h); else { stop(h); startRecall(h); } }
}
function buildSnap() {
  return { players: G.heroes.filter((h) => h.netId).map((h) => ({
    id: h.netId, x: +h.pos.x.toFixed(2), y: +h.pos.y.toFixed(2), z: +h.pos.z.toFixed(2), yaw: +h.yaw.toFixed(2),
    hp: Math.round(h.hp), mp: Math.round(h.mana), lv: h.level, exp: h.exp | 0, gold: Math.round(h.gold),
    alive: h.alive ? 1 : 0, rt: Math.ceil(h.respawnT), cds: h.cd.map((v) => +(v || 0).toFixed(1)),
    k: h.kills, d: h.deaths, a: h.assists, cs: h.cs,
  })) };
}
function applySnap(s) {
  if (!s || !s.players) return;
  for (const ps of s.players) {
    const h = G.heroes.find((x) => x.netId === ps.id); if (!h) continue;
    if (!ps.alive && h.alive) kill(h, null);
    else if (ps.alive && !h.alive) h.respawnT = 0.05; // host đã hồi sinh -> hồi theo
    else if (!ps.alive && !h.alive) h.respawnT = ps.rt;
    if (h.level !== ps.lv) { h.level = ps.lv; recalc(h, true); }
    h.hp = Math.min(ps.hp, h.maxHp); h.mana = ps.mp; h.exp = ps.exp; h.gold = ps.gold;
    for (let i = 0; i < 4; i++) h.cd[i] = ps.cds[i] || 0;
    h.kills = ps.k; h.deaths = ps.d; h.assists = ps.a; h.cs = ps.cs;
    const far = Math.hypot(h.pos.x - ps.x, h.pos.z - ps.z);
    if (h !== G.player ? far > 2.2 : far > 4) { h.pos.set(ps.x, ps.y, ps.z); h.yaw = ps.yaw; }
  }
}
function netSync(dt) {
  if (!NET.active || !G.running) return;
  while (NET.inputs.length) {
    const it = NET.inputs.shift();
    const h = G.heroes.find((x) => x.netId === it.id);
    if (h) applyNetInput(h, it.m);
  }
  if (NET.owner === NET.id) { // HOST: phát trạng thái cho cả phòng
    NET.snapT -= dt;
    if (NET.snapT <= 0) { NET.snapT = 0.12; sendSnap(buildSnap()); }
    if (G.over && !NET.sentOver) { NET.sentOver = true; sendOver(G.winner); }
  } else {                    // KHÁCH: nhận snapshot + lệnh kết thúc từ host
    if (NET.snap) { applySnap(NET.snap); NET.snap = null; }
    if (NET.overMsg !== null && NET.overMsg !== undefined) { if (!G.over) { G.over = true; G.winner = NET.overMsg; } NET.overMsg = null; }
  }
}

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  G.time += dt; updateTimers(dt);
  controlPlayer();
  for (const h of G.heroes) { if (h.isBot) updateBot(h, G, dt); else if (h.netId && h !== G.player) controlHero(h); }
  netSync(dt);
  waveT -= dt; if (waveT <= 0 && !G.over) { waveT = 30; spawnWave(); }
  updateCamps(G.camps, dt);
  for (const ev of G.events) if (ev.type === 'camp') { const c = ev.camp; if (c.type === 'dragon') { UI.banner('RỒNG ĐÃ XUẤT HIỆN!', { gold: true }); } if (c.type === 'baron') UI.banner('TÀ THẦN ĐÃ XUẤT HIỆN!', { red: true }); }
  G.events = G.events.filter((e) => e.type !== 'camp'); // 'camp' chỉ để banner
  objT -= dt; if (objT <= 0) { objT = 5; updateTeamObjectives(G); }
  updateUnits(dt); updateSkills(dt); G.fx.update(dt); updateLights(lights, dt);
  visT -= dt; if (visT <= 0) { visT = 0.15; updateVision(); }
  fowT -= dt; if (fowT <= 0) { fowT = 0.4; updateFow(visionSources[0]); }
  fountT -= dt; if (fountT <= 0) { fountT = 0.12; for (const b of BASE_INFO) if (b.fountain) G.fx.aura(b.fountain.x + rand(-1.5, 1.5), heightAt(b.fountain.x, b.fountain.z) + 0.8, b.fountain.z + rand(-1.5, 1.5), 0x7fe6ff, 0.35, 2.6, 0.2, 1.2); }
  if (G.over && !G.endFlag) { G.endFlag = true; endT = 2.6; }
  if (G.endFlag && G.over) { endT -= dt; if (endT <= 0) { G.endFlag = false; finishMatch(G.winner === 0); } }
  if (!G.over) G.endFlag = false;
}

function debugDraw() {
  const mk = () => { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 33 }, (_, i) => new THREE.Vector3(Math.cos(i / 32 * 6.2832), 0, Math.sin(i / 32 * 6.2832)))); return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff00ff })); };
  let ci = 0;
  if (G.debug.hitbox) for (const u of G.units) { if (!u.alive) continue; let c = dbg.circles[ci]; if (!c) { c = mk(); scene.add(c); dbg.circles[ci] = c; } c.visible = true; c.position.set(u.pos.x, u.pos.y + 0.2, u.pos.z); c.scale.set(u.radius, 1, u.radius); ci++; }
  for (let i = ci; i < dbg.circles.length; i++) dbg.circles[i].visible = false;
  let li = 0;
  if (G.debug.paths) for (const h of G.heroes) {
    if (!h.isBot || !h.alive) continue; let l = dbg.lines[li]; if (!l) { l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 20), 3)), new THREE.LineBasicMaterial({ color: h.team ? 0xff5555 : 0x55aaff })); l.frustumCulled = false; scene.add(l); dbg.lines[li] = l; }
    const pts = [h.pos, ...(h.path || (h.dest ? [h.dest] : []))].slice(0, 20); const a = l.geometry.attributes.position; for (let k = 0; k < 20; k++) { const q = pts[Math.min(k, pts.length - 1)]; a.setXYZ(k, q.x, (q.y !== undefined ? q.y : heightAt(q.x, q.z)) + 0.5, q.z); } a.needsUpdate = true; l.visible = true; li++;
  }
  for (let i = li; i < dbg.lines.length; i++) dbg.lines[i].visible = false;
}

// ============================================================
// VÒNG LẶP CHÍNH: requestAnimationFrame + delta time
// ============================================================
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000; updateWater(t); for (const b of BASE_INFO) if (b.anim) b.anim(t);
  if (G.running && !G.paused) {
    for (let i = 0, n = G.sim || 1; i < n; i++) update(dt); // G.sim > 1: tua nhanh để test
    const p = G.player; if (G.camSnap) { rig.snap(p.pos); G.camSnap = false; }
    // xoay camera bằng phím: ←/→ hoặc Z/C (một hành vi cho mọi chế độ)
    const rl = keys.ArrowLeft || keys.KeyZ, rr = keys.ArrowRight || keys.KeyC; if (rl) rig.rotate(dt * 1.8); if (rr) rig.rotate(-dt * 1.8);
    rig.update(dt, p.pos, heightAt);
    sun.position.set(rig.focus.x + 40, 70, rig.focus.z + 25); sun.target.position.copy(rig.focus); sun.target.updateMatrixWorld();
    updateVisuals(dt, camera.position);
    // vòng chọn mục tiêu
    const tg = p.target; if (tg && tg.alive) { targetRing.visible = true; targetRing.position.set(tg.pos.x, tg.pos.y + 0.15, tg.pos.z); const s = tg.radius * 1.5 + 0.4; targetRing.scale.set(s, 1, s); targetRing.rotation.y = t * 2; } else targetRing.visible = false;
    // chuột → vị trí ngắm trên địa hình
    const g = pickGround(mouse.x, mouse.y); if (g) { mouse.ground.copy(g); mouse.has = true; }
    UI.updateHUD(dt); UI.drawOverlay(camera, dt);
    mapT -= dt; if (mapT <= 0) { mapT = 0.1; UI.drawMinimap(camera, pickGroundNDC); }
    debugDraw();
  } else if (!G.running) {
    // lobby / kết thúc: camera tham quan nhẹ
    rig.yaw += dt * 0.05; const f = rig.focus; f.set(-60, 0, 60); rig.update(dt, f, heightAt);
  }
  renderer.render(scene, camera);
}
export { DIFF, recalc, RANKS, clamp };
