// ============================================================
// skills.js — HỆ THỐNG SKILL 3D
// castSkill(hero, skillIndex, targetPos): đọc dữ liệu skill (heroes.js) và dựng
// hiệu ứng: projectile / AoE (circle-cone-line) / dash / buff / CC / tường / bẫy / thiên thạch...
// Mỗi hiệu ứng tạo mesh từ pool (fx.js), cập nhật trong game loop và tự xoá khi hết thời gian.
// ============================================================
import * as THREE from 'three';
import { G, after, clamp, rand, dist, emitEvent } from './state.js';
import { dealDamage, heal, slow, stun, root, knockup, forceMove, enemiesInRadius, alliesInRadius, skillLevel, breakStealth, cancelRecall, reviveAt, canSee, isTargetable } from './combat.js';
import { OBST, heightAt } from './map.js';
import { buildBull } from './heroes.js';
import { sfx } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const skillDamage = (h, sk, lv) => (sk.dmg || 0) * (1 + 0.28 * (lv - 1)) + h.stats.atk * (sk.adR || 0) + h.stats.ap * (sk.apR || 0);
const apVal = (h, sk, k = 'apR') => h.stats.ap * (sk[k] || 0);

function applyHit(h, u, sk, lv, o = {}) {
  if (!u.alive) return;
  const d = o.dmg !== undefined ? o.dmg : skillDamage(h, sk, lv) * (o.mul || 1);
  if (d > 0) dealDamage(h, u, d, sk.type || 'phys', { color: sk.color, big: true });
  if (!u.alive && u.kind !== 'hero') return;
  if (sk.slow) slow(u, sk.slow[0], sk.slow[1]); if (sk.stun) stun(u, sk.stun); if (sk.root) root(u, sk.root); if (sk.up) knockup(u, sk.up);
  if (sk.knock && u.alive && u.kind !== 'tower' && u.kind !== 'nexus' && u.kind !== 'monster') { const dx = u.pos.x - h.pos.x, dz = u.pos.z - h.pos.z; forceMove(u, o.pushDir ? o.pushDir.x : dx, o.pushDir ? o.pushDir.z : dz, sk.knock, 0.25, { face: false }); }
  if (u.markT > 0 && u.markBy === h) { u.markT = 0; dealDamage(h, u, u.markPop || 90, 'true', { big: true }); G.fx.burst(u.pos.x, u.pos.y + 1.6, u.pos.z, 0xff2020, 20, 5, 0.5, 0.5); }
  G.fx.burst(u.pos.x, u.pos.y + 1.2, u.pos.z, sk.color, 10, 4, 0.4, 0.5);
  if (u.kind === 'hero') h.lastAggro = G.time;
}
const clampAim = (h, aim, range) => { const dx = aim.x - h.pos.x, dz = aim.z - h.pos.z; const d = Math.hypot(dx, dz) || 1; const k = Math.min(1, range / d); return { x: h.pos.x + dx * k, z: h.pos.z + dz * k }; };
function angDiff(a, b) { return Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI); }

// ---------- các loại skill ----------
const KINDS = {
  // --- Projectile ---
  proj(c) {
    const { h, sk, lv, dir } = c; const from = V(h.pos.x + dir.x * 0.9, h.pos.y + 1.3, h.pos.z + dir.z * 0.9);
    const explode = (pos, p) => {
      if (p.exploded) return; p.exploded = true; const r = sk.explode;
      for (const u of enemiesInRadius(h, pos.x, pos.z, r)) applyHit(h, u, sk, lv);
      G.fx.ring(pos.x, pos.y, pos.z, r, sk.color, 0.45); G.fx.burst(pos.x, pos.y, pos.z, sk.color, 30, 6, 0.6, 0.6, { gravity: 2 }); G.fx.flash(pos, sk.color, 3, 0.35); G.cam.shake(0.15, 0.15); sfx('boom');
    };
    G.fx.projectile({
      from, dir, color: sk.color, core: 0xffffff, speed: sk.speed, range: sk.range, radius: sk.radius, size: sk.size || 0.5, stretch: sk.stretch || 1, owner: h, team: h.team, pierce: !!sk.pierce,
      onHit: (u, p) => { if (sk.explode) { explode(p.pos, p); return 'stop'; } applyHit(h, u, sk, lv); G.fx.flash(p.pos, sk.color, 1.5, 0.2); return 'stop'; },
      onEnd: (pos, p) => { if (sk.explode) explode(pos, p); },
    });
    sfx('whoosh'); return true;
  },
  // --- AoE: circle / cone / line ---
  area(c) {
    const { h, sk, lv, dir } = c; const shape = sk.shape; const y = h.pos.y; const delay = sk.delay || 0; const fx = G.fx;
    const origin = { x: h.pos.x, z: h.pos.z }; const at = sk.at === 'ground' ? clampAim(h, c.aim, sk.range) : origin; const ang0 = Math.atan2(dir.x, dir.z);
    const strike = () => {
      let list = [];
      if (shape === 'circle') {
        list = enemiesInRadius(h, at.x, at.z, sk.radius);
        fx.ring(at.x, y, at.z, sk.radius, sk.color, 0.55); fx.ring(at.x, y, at.z, sk.radius * 0.7, 0xffffff, 0.4, { opacity: 0.5 }); fx.burst(at.x, y + 0.3, at.z, sk.color, 36, sk.radius * 1.6, 0.6, 0.55, { flat: true, gravity: 0 }); fx.flash(V(at.x, y, at.z), sk.color, 3, 0.4);
        if (sk.healAlly) for (const a of alliesInRadius(h.team, at.x, at.z, sk.radius)) { heal(h, a, sk.healAlly + apVal(h, sk, 'apR')); a.hasteT = sk.speedAlly[1]; a.hastePct = sk.speedAlly[0]; fx.burst(a.pos.x, a.pos.y + 0.5, a.pos.z, 0x7dff9a, 14, 2, 1, 0.45, { up: 3 }); }
        if (sk.root && sk.at === 'ground') fx.burst(at.x, y + 0.2, at.z, sk.color, 24, 2, 0.8, 0.5, { up: 4 });
      } else if (shape === 'cone') {
        list = enemiesInRadius(h, origin.x, origin.z, sk.length, (u) => { const a = Math.atan2(u.pos.x - origin.x, u.pos.z - origin.z); return angDiff(a, ang0) <= sk.angle * Math.PI / 360 + 0.12; });
        if (!sk.sweep) for (let i = 0; i < 9; i++) { const a = ang0 + (i / 8 - 0.5) * sk.angle * Math.PI / 180; fx.beam(V(origin.x, y + 0.5, origin.z), V(origin.x + Math.sin(a) * sk.length, y + 0.5, origin.z + Math.cos(a) * sk.length), sk.color, 0.5, 0.3, { taper: true }); }
        fx.burst(origin.x + dir.x * sk.length * 0.5, y + 0.6, origin.z + dir.z * sk.length * 0.5, sk.color, 30, 6, 0.5, 0.6, { flat: true }); fx.flash(V(origin.x + dir.x * 3, y, origin.z + dir.z * 3), sk.color, 3, 0.3);
      } else if (shape === 'line') {
        const end = V(origin.x + dir.x * sk.length, y + 1.2, origin.z + dir.z * sk.length);
        list = enemiesInRadius(h, origin.x, origin.z, sk.length + 2, (u) => { const rx = u.pos.x - origin.x, rz = u.pos.z - origin.z; const along = rx * dir.x + rz * dir.z; if (along < 0 || along > sk.length + u.radius) return false; return Math.abs(rx * dir.z - rz * dir.x) <= sk.width / 2 + u.radius; });
        fx.beam(V(origin.x, y + 1.2, origin.z), end, sk.color, sk.width, 0.55); fx.beam(V(origin.x, y + 1.2, origin.z), end, 0xffffff, sk.width * 0.35, 0.45);
        for (let i = 0; i < 14; i++) { const t = i / 13; fx.burst(origin.x + dir.x * sk.length * t, y + 1.2, origin.z + dir.z * sk.length * t, sk.color, 3, 2, 0.5, 0.5); }
        fx.flash(V(origin.x + dir.x * 2, y, origin.z + dir.z * 2), sk.color, 3.5, 0.5);
      }
      for (const u of list) applyHit(h, u, sk, lv); G.cam.shake(0.2, 0.2); sfx('boom');
    };
    if (shape === 'cone' && sk.sweep) { // quét 90°: beam xoay
      for (let i = 0; i < 7; i++) after(i * 0.07, () => { if (!h.alive) return; const a = ang0 + (i / 6 - 0.5) * sk.angle * Math.PI / 180; fx.beam(V(h.pos.x, h.pos.y + 1.2, h.pos.z), V(h.pos.x + Math.sin(a) * sk.length, h.pos.y + 1.2, h.pos.z + Math.cos(a) * sk.length), sk.color, 0.9, 0.25); fx.burst(h.pos.x + Math.sin(a) * sk.length * 0.8, h.pos.y + 1, h.pos.z + Math.cos(a) * sk.length * 0.8, sk.color, 5, 3, 0.4, 0.5); });
    }
    if (delay > 0 && shape === 'circle') { fx.disc(at.x, y, at.z, sk.radius, sk.color, delay, { opacity: 0.4, fadeIn: true }); fx.ring(at.x, y, at.z, sk.radius, sk.color, delay, { noExpand: true, opacity: 0.9 }); }
    if (delay > 0 && shape === 'line') { const e = V(origin.x + dir.x * sk.length, y + 0.3, origin.z + dir.z * sk.length); fx.beam(V(origin.x, y + 0.3, origin.z), e, sk.color, 0.15, delay + 0.1); }
    if (delay > 0) after(delay, () => { if (h.alive || sk.at === 'ground') strike(); }); else strike();
    sfx('whoosh'); return true;
  },
  // --- Dash ---
  dash(c) {
    const { h, sk, lv, dir } = c; const d = sk.dir === 'back' ? V(-dir.x, 0, -dir.z) : dir; const dur = Math.max(0.16, sk.dist / 28); const hit = new Set(); let acc = 0; const fx = G.fx;
    fx.burst(h.pos.x, h.pos.y + 0.5, h.pos.z, sk.color, 14, 4, 0.5, 0.5); fx.ring(h.pos.x, h.pos.y, h.pos.z, 1.8, sk.color, 0.3);
    forceMove(h, d.x, d.z, sk.dist, dur, {
      face: sk.dir !== 'back',
      onStep: (u, dt) => {
        acc += dt; if (acc > 0.035) { acc = 0; if (sk.ghost) fx.ghost(u, sk.color); }
        fx.trail(u.pos.x, u.pos.y + 0.4 + Math.random() * 1.2, u.pos.z, sk.color, 0.7, 0.4);
        if (sk.dir !== 'back') for (const e of enemiesInRadius(h, u.pos.x, u.pos.z, 1.5)) { if (hit.has(e.id)) continue; hit.add(e.id); applyHit(h, e, sk, lv, { pushDir: d }); fx.flash(e.pos, sk.color, 2, 0.25); }
      },
      done: () => {
        if (sk.after === 'shot') { const t = nearestForShot(h, 14); if (t) fireShot(h, t, sk, lv); }
        if (sk.after === 'slowAoe') { for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, sk.afterR)) applyHit(h, e, sk, lv); fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.afterR, sk.color, 0.5); fx.burst(h.pos.x, h.pos.y + 0.5, h.pos.z, sk.color, 24, 5, 0.6, 0.5, { flat: true }); }
        if (sk.after === 'slam') { // Bình An Q: đập xuống đất, hất tung quanh điểm đáp
          const sk2 = Object.assign({}, sk, { up: sk.up, dmg: sk.slamDmg, adR: sk.adR2 });
          for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, sk.slamR)) applyHit(h, e, sk2, lv);
          fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.slamR, sk.color, 0.5);
          fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.slamR * 0.6, 0xffffff, 0.35, { opacity: 0.6 });
          fx.burst(h.pos.x, h.pos.y + 0.4, h.pos.z, sk.color, 40, sk.slamR * 1.4, 0.7, 0.6, { flat: true, gravity: 1 });
          fx.flash(V(h.pos.x, h.pos.y, h.pos.z), sk.color, 4, 0.4);
          G.cam.shake(0.4, 0.3); sfx('boom');
        }
      },
    });
    sfx('whoosh'); return true;
  },
  // --- Buff / heal / shield / immune (đồng minh) ---
  buff(c) {
    const { h, sk, lv } = c; const fx = G.fx; let targets;
    if (sk.target === 'lowAlly') {
      let best = null, bs = 9; for (const a of G.heroes) { if (a.team !== h.team || !a.alive) continue; if (Math.hypot(a.pos.x - h.pos.x, a.pos.z - h.pos.z) > sk.range) continue; const r = a.hp / a.maxHp; if (r < bs) { bs = r; best = a; } }
      targets = [best || h];
    } else if (sk.radius > 0) targets = sk.allies ? alliesInRadius(h.team, h.pos.x, h.pos.z, sk.radius) : [h]; else targets = [h];
    for (const t of targets) {
      if (sk.shield) { t.shieldAmt = sk.shield * (1 + 0.2 * (lv - 1)) + apVal(h, sk) + (sk.shieldHp ? t.maxHp * sk.shieldHp : 0); t.shieldT = sk.dur; fx.orb(t, sk.color, 1.9, sk.dur, 0.3); }
      if (sk.heal) { heal(h, t, sk.heal * (1 + 0.25 * (lv - 1)) + apVal(h, sk)); if (t !== h) fx.stream(h.pos, t.pos, sk.color, 16); fx.burst(t.pos.x, t.pos.y + 0.5, t.pos.z, sk.color, 18, 2.5, 1, 0.5, { up: 3 }); sfx('heal'); }
      if (sk.speed) { t.hastePct = sk.speed[0]; t.hasteT = sk.speed[1]; fx.ring(t.pos.x, t.pos.y, t.pos.z, 1.8, sk.color, 0.6); for (let i = 0; i < 14; i++) after(i * 0.2, () => t.alive && fx.burst(t.pos.x, t.pos.y + 0.1, t.pos.z, sk.color, 3, 1.5, 0.5, 0.45, { flat: true })); }
      if (sk.reduce) { t.reducePct = sk.reduce[0]; t.reduceT = sk.reduce[1]; fx.orb(t, sk.color, 1.8, sk.reduce[1], 0.22); }
      if (sk.immune) { t.immuneT = sk.immune; fx.orb(t, 0xdfe6ee, 2.2, sk.immune, 0.4); fx.burst(t.pos.x, t.pos.y + 1, t.pos.z, sk.color, 30, 5, 0.8, 0.6); }
    }
    if (sk.zone) { fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.radius, sk.color, 0.8); fx.disc(h.pos.x, h.pos.y, h.pos.z, sk.radius, sk.color, sk.dur, { opacity: 0.22, fadeIn: true }); fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.radius, sk.color, sk.dur, { noExpand: true, opacity: 0.8 }); fx.pillar(h.pos.x, h.pos.y, h.pos.z, sk.color, 0.9, 10, 1); }
    fx.flash(h.pos, sk.color, 3, 0.5); if (!sk.heal) sfx('buff'); return true;
  },
  // --- Đánh dấu ---
  mark(c) {
    const { h, sk, aim } = c; let best = null, bd = 1e9;
    for (const u of G.heroes) { if (u.team === h.team || !u.alive || !canSee(h.team, u)) continue; const dh = Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z); if (dh > sk.range) continue; const da = Math.hypot(u.pos.x - aim.x, u.pos.z - aim.z); if (da < bd) { bd = da; best = u; } }
    if (!best) return false; best.markT = sk.dur; best.markBy = h; best.markPop = sk.popDmg + h.stats.atk * 0.4;
    ensureMark(best); G.fx.burst(best.pos.x, best.pos.y + 1.5, best.pos.z, sk.color, 24, 4, 0.6, 0.5); G.fx.beam(V(h.pos.x, h.pos.y + 1.3, h.pos.z), V(best.pos.x, best.pos.y + 1.3, best.pos.z), sk.color, 0.15, 0.3); sfx('buff'); return true;
  },
  // --- Đâm (Lê Anh W) ---
  strike(c) {
    const { h, sk, lv, aim } = c; let best = null, bd = 1e9;
    for (const u of G.units) { if (!u.alive || u.team === h.team || !isTargetable(u) || !canSee(h.team, u)) continue; if (Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) - u.radius > sk.range) continue; const da = Math.hypot(u.pos.x - aim.x, u.pos.z - aim.z) + (u.kind === 'hero' ? -3 : 0); if (da < bd) { bd = da; best = u; } }
    if (!best) return false; const a = Math.atan2(best.pos.x - h.pos.x, best.pos.z - h.pos.z); const behind = angDiff(a, best.yaw) < 1.1; let mul = 1 + (behind ? sk.back : 0);
    const bonus = h.stealthBonus; if (bonus) { mul *= 1.4; h.stealthBonus = false; }
    const d = Math.max(0, Math.hypot(best.pos.x - h.pos.x, best.pos.z - h.pos.z) - 1.3); forceMove(h, best.pos.x - h.pos.x, best.pos.z - h.pos.z, d, 0.1);
    after(0.1, () => { applyHit(h, best, sk, lv, { mul }); G.fx.beam(V(best.pos.x - 1, best.pos.y + 1.8, best.pos.z), V(best.pos.x + 1, best.pos.y + 0.6, best.pos.z), sk.color, 0.25, 0.25); G.fx.burst(best.pos.x, best.pos.y + 1.2, best.pos.z, sk.color, 24, 6, 0.5, 0.5); if (behind) emitEvent('dmg', { x: best.pos.x, y: best.pos.y + 3, z: best.pos.z, text: 'SAU LƯNG!', color: '#d9a0ff' }); G.cam.shake(0.15, 0.15); });
    h.atkAnim = 0.3; sfx('whoosh'); return true;
  },
  // --- Dịch chuyển + kết liễu ---
  teleport(c) {
    const { h, sk, lv } = c; let best = null, bs = 1e9; const cand = G.heroes.filter((u) => u.team !== h.team && u.alive && canSee(h.team, u) && Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) <= sk.range);
    if (sk.pick === 'marked') best = cand.find((u) => u.markT > 0 && u.markBy === h) || null;
    if (!best) for (const u of cand) { const s = sk.pick === 'lowhp' ? u.hp / u.maxHp : Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z); if (s < bs) { bs = s; best = u; } }
    if (!best) return false; const fx = G.fx;
    fx.burst(h.pos.x, h.pos.y + 1, h.pos.z, sk.color, 40, 6, 0.7, 0.7); fx.flash(h.pos, sk.color, 4, 0.4); fx.ghost(h, sk.color);
    const ax = best.pos.x - h.pos.x, az = best.pos.z - h.pos.z; const l = Math.hypot(ax, az) || 1; h.pos.x = best.pos.x - (ax / l) * 1.6; h.pos.z = best.pos.z - (az / l) * 1.6; h.pos.y = heightAt(h.pos.x, h.pos.z); h.yaw = Math.atan2(ax, az); h.path = null; h.forced = null;
    if (h === G.player) G.camSnap = false;
    after(0.12, () => { const miss = (best.maxHp - best.hp) * sk.missing; applyHit(h, best, sk, lv, { dmg: skillDamage(h, sk, lv) + miss }); fx.burst(best.pos.x, best.pos.y + 1.3, best.pos.z, sk.color, 50, 8, 0.8, 0.7); fx.ring(best.pos.x, best.pos.y, best.pos.z, 3, sk.color, 0.5); fx.flash(best.pos, sk.color, 5, 0.5); fx.beam(V(best.pos.x - 1.5, best.pos.y + 2.5, best.pos.z - 1), V(best.pos.x + 1.5, best.pos.y + 0.3, best.pos.z + 1), 0xffffff, 0.35, 0.3); G.cam.shake(0.45, 0.3); stun(best, 0.3); });
    h.atkAnim = 0.3; sfx('boom'); return true;
  },
  // --- Tường ---
  wall(c) {
    const { h, sk, dir, aim } = c; const dd = Math.min(sk.range, Math.hypot(aim.x - h.pos.x, aim.z - h.pos.z)); const dist0 = sk.range <= 4.5 ? sk.range : Math.max(4, dd);
    const cx = h.pos.x + dir.x * dist0, cz = h.pos.z + dir.z * dist0; const alongX = Math.abs(dir.z) > Math.abs(dir.x); // tường vuông góc hướng bắn
    const w = alongX ? sk.w : sk.d, d = alongX ? sk.d : sk.w; const y = heightAt(cx, cz);
    const g = new THREE.Group(); g.position.set(cx, y, cz);
    const m = new THREE.MeshStandardMaterial(sk.stone ? { color: 0x8d8d8d, roughness: 1, flatShading: true } : { color: sk.color, emissive: 0x2a8fc0, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.2, flatShading: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, sk.h, d), m); box.position.y = sk.h / 2; box.castShadow = true; g.add(box);
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(sk.stone ? new THREE.DodecahedronGeometry(0.5, 0) : new THREE.ConeGeometry(0.35, 1.4, 5), m); sp.position.set((alongX ? (i / 5 - 0.5) * w : 0), sk.h + 0.1, (alongX ? 0 : (i / 5 - 0.5) * d)); sp.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3)); g.add(sp); }
    g.scale.y = 0.05; G.matchGroup.add(g);
    const col = { minx: cx - w / 2, maxx: cx + w / 2, minz: cz - d / 2, maxz: cz + d / 2 }; OBST.boxes.push(col); G.wallsDyn.push(col);
    const wl = { g, col, t: 0, dur: sk.dur, color: sk.color, cx, cz, y }; G.skillWalls.push(wl);
    G.fx.burst(cx, y + 0.5, cz, sk.color, 40, 6, 0.8, 0.7, { gravity: 3 }); G.fx.ring(cx, y, cz, Math.max(w, d) * 0.7, sk.color, 0.5); G.cam.shake(0.2, 0.2); sfx('boom');
    // đẩy đơn vị đang đứng trong vùng ra ngoài
    for (const u of G.units) if (u.alive && (u.kind === 'hero' || u.kind === 'minion') && u.pos.x > col.minx - 0.5 && u.pos.x < col.maxx + 0.5 && u.pos.z > col.minz - 0.5 && u.pos.z < col.maxz + 0.5) { const o = { x: u.pos.x, z: u.pos.z }; const dx = o.x - cx, dz = o.z - cz; forceMove(u, dx || 0.1, dz || 0.1, 1.5, 0.15, { face: false }); }
    return true;
  },
  // --- Bẫy ---
  trap(c) {
    const { h, sk, lv, aim } = c; const at = clampAim(h, aim, sk.range); const y = heightAt(at.x, at.z);
    const g = new THREE.Group(); g.position.set(at.x, y, at.z); const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: sk.color, emissiveIntensity: 1.8 })); core.position.y = 0.35; g.add(core);
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7, roughness: 0.4 })); const a = i / 6 * 6.28; sp.position.set(Math.cos(a) * 0.38, 0.35, Math.sin(a) * 0.38); sp.rotation.z = -Math.cos(a) * 1.57; sp.rotation.x = Math.sin(a) * 1.57; g.add(sp); }
    G.matchGroup.add(g); G.traps.push({ x: at.x, z: at.z, y, h, sk, lv, t: sk.dur, arm: 0.8, g, core });
    G.fx.ring(at.x, y, at.z, 1.4, sk.color, 0.5); G.fx.burst(at.x, y + 0.3, at.z, sk.color, 10, 2, 0.5, 0.4); return true;
  },
  // --- Mưa thiên thạch ---
  meteor(c) {
    const { h, sk, lv, aim } = c; const at = clampAim(h, aim, sk.range); const fx = G.fx; const y = heightAt(at.x, at.z);
    fx.ring(at.x, y, at.z, sk.spread, sk.color, sk.dur + 0.6, { noExpand: true, opacity: 0.5 }); fx.disc(at.x, y, at.z, sk.spread, sk.color, sk.dur + 0.6, { opacity: 0.12 });
    for (let i = 0; i < sk.count; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * sk.spread; const px = at.x + Math.cos(a) * r, pz = at.z + Math.sin(a) * r; const py = heightAt(px, pz);
      after(i * (sk.dur / sk.count), () => {
        fx.disc(px, py, pz, sk.radius, sk.color, 0.6, { opacity: 0.4, fadeIn: true }); fx.ring(px, py, pz, sk.radius, sk.color, 0.6, { noExpand: true });
        fx.beam(V(px - 6, py + 26, pz - 4), V(px, py, pz), sk.color, 1.3, 0.5, { taper: true });
        after(0.5, () => { for (const u of enemiesInRadius(h, px, pz, sk.radius)) applyHit(h, u, sk, lv); fx.ring(px, py, pz, sk.radius, sk.color, 0.4); fx.burst(px, py + 0.3, pz, sk.color, 26, 7, 0.6, 0.7, { gravity: 5 }); fx.burst(px, py + 0.3, pz, 0xffffff, 8, 4, 0.3, 0.8); fx.flash(V(px, py, pz), sk.color, 3.5, 0.4); G.cam.shake(0.18, 0.15); sfx('boom'); });
      });
    }
    return true;
  },
  // --- Kiếm Lưu Ngân (Khải Kiệt Q): đứng yên tung chuỗi chém, nhát cuối hất tung ---
  combo(c) {
    const { h, sk, lv } = c; const fx = G.fx;
    if (sk.reduce) { h.reducePct = sk.reduce[0]; h.reduceT = sk.reduce[1]; } // miễn khống/đỡ đòn khi tung
    root(h, sk.lockT); // đứng yên khi tung chiêu
    for (let i = 0; i < sk.hits; i++) after(i * sk.interval, () => {
      if (!h.alive || h.stunT > 0 || h.airT > 0) return;
      h.atkAnim = 0.2;
      const last = i === sk.hits - 1;
      for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, sk.radius)) {
        if (e.kind === 'tower' || e.kind === 'nexus') continue;
        applyHit(h, e, sk, lv, { mul: last ? sk.finalMul : 1 });
        if (last) knockup(e, sk.up);
      }
      const a = (i / sk.hits) * Math.PI * 2;
      fx.burst(h.pos.x + Math.sin(a) * 1.8, h.pos.y + 1.2, h.pos.z + Math.cos(a) * 1.8, sk.color, 10, 4, 0.3, 0.5);
      fx.ring(h.pos.x, h.pos.y + 0.8, h.pos.z, sk.radius, sk.color, 0.22, { noExpand: true, opacity: 0.55 });
      sfx('hit'); if (last) { G.cam.shake(0.35, 0.25); fx.flash(h.pos, sk.color, 3.5, 0.35); sfx('boom'); }
    });
    sfx('whoosh'); return true;
  },
  // --- Kiếm Tất Sát (Khải Kiệt R): biến mất, khóa tướng địch, đáp xuống gây sát thương chuẩn ---
  exec(c) {
    const { h, sk, lv } = c; let best = null, bd = 1e9;
    for (const u of G.heroes) { if (u.team === h.team || !u.alive || u.immuneT > 0 || u.stealthT > 0) continue; const d = Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z); if (d <= sk.range && d < bd) { bd = d; best = u; } }
    if (!best) { if (h === G.player) emitEvent('feed', { text: 'Không có tướng địch trong tầm!', team: 0 }); return false; }
    const fx = G.fx; const tx = best.pos.x, tz = best.pos.z;
    h.stealthT = sk.disappear; h.immuneT = sk.disappear; h.path = null; h.forced = null; // biến mất khỏi bản đồ
    fx.burst(h.pos.x, h.pos.y + 1, h.pos.z, sk.color, 40, 6, 0.7, 0.7); fx.ghost(h, sk.color); fx.ring(h.pos.x, h.pos.y, h.pos.z, 2.5, sk.color, 0.5);
    fx.beam(V(h.pos.x, h.pos.y + 1.3, h.pos.z), V(tx, best.pos.y + 1.3, tz), sk.color, 0.2, 0.4);
    emitEvent('feed', { text: `${h.name} biến mất — khóa ${best.name}!`, team: h.team });
    sfx('buff');
    after(sk.disappear, () => {
      if (!h.alive || G.over) return;
      const lx = best.alive ? best.pos.x : tx, lz = best.alive ? best.pos.z : tz;
      h.pos.x = lx; h.pos.z = lz; h.pos.y = heightAt(lx, lz); h.path = null; h.forced = null;
      h.stealthT = 0; h.immuneT = 0; breakStealth(h);
      if (h === G.player) G.camSnap = false;
      const dmg = skillDamage(h, sk, lv) + (best.alive ? (best.maxHp - best.hp) * sk.missing : 0);
      for (const e of enemiesInRadius(h, lx, lz, sk.radius)) if (e.alive) { dealDamage(h, e, e === best ? dmg : dmg * 0.6, 'true', { big: true, color: sk.color }); fx.burst(e.pos.x, e.pos.y + 1.3, e.pos.z, sk.color, 20, 5, 0.5, 0.6); }
      fx.ring(lx, h.pos.y, lz, sk.radius, sk.color, 0.5);
      fx.ring(lx, h.pos.y, lz, sk.radius * 0.55, 0xffffff, 0.35, { opacity: 0.6 });
      fx.burst(lx, h.pos.y + 0.4, lz, sk.color, 50, sk.radius * 1.5, 0.8, 0.7, { flat: true, gravity: 2 });
      fx.pillar(lx, h.pos.y, lz, sk.color, 1.1, 9, 0.5);
      fx.flash(V(lx, h.pos.y, lz), sk.color, 5, 0.5);
      G.cam.shake(0.5, 0.3); sfx('boom');
    });
    return true;
  },
  // --- Tàng hình ---
  stealth(c) {
    const { h, sk } = c; h.stealthT = sk.dur; h.hastePct = sk.speed[0]; h.hasteT = sk.speed[1]; h.stealthBonus = false;
    G.fx.burst(h.pos.x, h.pos.y + 1, h.pos.z, sk.color, 40, 5, 0.9, 0.9); G.fx.ring(h.pos.x, h.pos.y, h.pos.z, 2.5, sk.color, 0.5); sfx('buff'); return true;
  },
  // --- Drone ---
  drone(c) {
    const { h, sk, lv } = c; const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a40, metalness: 0.6, roughness: 0.4 })); g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: sk.color })); eye.position.z = 0.25; g.add(eye); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 5, 14), new THREE.MeshBasicMaterial({ color: sk.color })); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.position.set(h.pos.x, h.pos.y + 2, h.pos.z); G.matchGroup.add(g); G.drones.push({ h, sk, lv, g, t: sk.dur, cd: 0.3, a: 0 }); G.fx.burst(h.pos.x, h.pos.y + 2, h.pos.z, sk.color, 20, 3, 0.5, 0.5); sfx('buff'); return true;
  },
  // --- Đấm liên hoàn ---
  multihit(c) {
    const { h, sk, lv, dir } = c; const fx = G.fx;
    for (let i = 0; i < sk.hits; i++) after(i * sk.interval, () => {
      if (!h.alive || h.stunT > 0) return; h.atkAnim = 0.2; forceMove(h, dir.x, dir.z, sk.step, 0.1, { face: true });
      const cx = h.pos.x + dir.x * 1.8, cz = h.pos.z + dir.z * 1.8;
      for (const u of enemiesInRadius(h, cx, cz, sk.radius * 0.6)) applyHit(h, u, sk, lv, { mul: i === sk.hits - 1 ? 1.4 : 1 });
      fx.burst(cx, h.pos.y + 1.3, cz, sk.color, 14, 5, 0.35, 0.55); fx.ring(cx, h.pos.y + 0.8, cz, 1.6, sk.color, 0.25); fx.flash(V(cx, h.pos.y, cz), sk.color, 2.2, 0.2); G.cam.shake(0.1, 0.1); sfx('hit');
    });
    return true;
  },
  // --- Tóm & ném ---
  grab(c) {
    const { h, sk, lv, dir } = c; let best = null, bd = 1e9;
    for (const u of G.units) { if (!u.alive || u.team === h.team || (u.kind !== 'hero' && u.kind !== 'minion' && u.kind !== 'monster') || u.immuneT > 0 || (u.kind === 'monster' && (u.mtype === 'dragon' || u.mtype === 'baron'))) continue; const d = Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) - u.radius; if (d > sk.range) continue; const w = d + (u.kind === 'hero' ? -3 : 0); if (w < bd) { bd = w; best = u; } }
    if (!best) return false; const fx = G.fx; best.forced = null; knockup(best, 1.0); best.pos.x = h.pos.x + dir.x * 1.5; best.pos.z = h.pos.z + dir.z * 1.5; fx.burst(best.pos.x, best.pos.y + 1, best.pos.z, sk.color, 24, 4, 0.5, 0.6);
    after(0.35, () => { if (!best.alive) return; forceMove(best, dir.x, dir.z, sk.throwDist, 0.55, { face: false }); fx.burst(best.pos.x, best.pos.y + 1.5, best.pos.z, sk.color, 20, 3, 0.5, 0.6); });
    after(0.95, () => { if (!best.alive) return; applyHit(h, best, sk, lv); fx.ring(best.pos.x, best.pos.y, best.pos.z, 3.5, sk.color, 0.5); fx.burst(best.pos.x, best.pos.y + 0.3, best.pos.z, sk.color, 36, 7, 0.7, 0.7, { gravity: 4 }); fx.flash(best.pos, sk.color, 4, 0.4); G.cam.shake(0.4, 0.3); for (const u of enemiesInRadius(h, best.pos.x, best.pos.z, 2.8)) if (u !== best) applyHit(h, u, sk, lv, { mul: 0.4 }); sfx('boom'); });
    h.atkAnim = 0.3; return true;
  },
  // --- Vùng hồi máu ---
  zone(c) {
    const { h, sk, lv, aim } = c; const at = clampAim(h, aim, sk.range); const y = heightAt(at.x, at.z);
    G.zones.push({ x: at.x, z: at.z, y, r: sk.radius, t: sk.dur, tick: sk.tick, acc: 0, h, sk, lv });
    G.fx.disc(at.x, y, at.z, sk.radius, sk.color, sk.dur, { opacity: 0.25, fadeIn: true }); G.fx.ring(at.x, y, at.z, sk.radius, sk.color, sk.dur, { noExpand: true, opacity: 0.8 }); G.fx.pillar(at.x, y, at.z, sk.color, 0.6, 7, sk.dur, { pulse: true }); G.fx.burst(at.x, y + 0.3, at.z, sk.color, 30, 5, 0.8, 0.5, { flat: true }); sfx('heal'); return true;
  },
  // --- Vòng quay kiếm thần (Bình An W) ---
  spin(c) {
    const { h, sk, lv } = c; const fx = G.fx;
    // dựng 3 lưỡi kiếm quay quanh người
    const g = new THREE.Group();
    const bladeM = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, emissive: sk.color, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.7), bladeM);
      bl.position.set(Math.sin(a) * 0.9, 1.1, Math.cos(a) * 0.9);
      bl.rotation.y = a + Math.PI / 2; bl.rotation.z = 0.35;
      bl.castShadow = true; g.add(bl);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), bladeM);
      tip.position.set(Math.sin(a) * 1.85, 1.28, Math.cos(a) * 1.85);
      tip.rotation.y = a + Math.PI / 2; tip.rotation.x = Math.PI / 2; g.add(tip);
    }
    G.matchGroup.add(g);
    G.spins.push({ h, sk, lv, g, t: sk.dur, acc: 0, stunAcc: 0.6 });
    fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.radius, sk.color, 0.6); sfx('whoosh'); return true;
  },
  // --- Cưỡi Thần Ngưu (Bình An E) ---
  mount(c) {
    const { h, sk, lv } = c;
    if (h.mount) endMount(h);
    const bull = buildBull();
    bull.position.set(h.pos.x, h.pos.y, h.pos.z); bull.rotation.y = h.yaw;
    G.matchGroup.add(bull);
    h.mount = { g: bull, t: sk.dur, sk, lv, hitAcc: new Map(), lastX: h.pos.x, lastZ: h.pos.z, walkPh: 0 };
    h.mountT = sk.dur; h.mountSpd = sk.speedUp; h.mountY = 1.05;
    // đón đồng đội gần lên bò (tối đa 1 bạn cùng ngồi)
    G.fx.burst(h.pos.x, h.pos.y + 0.5, h.pos.z, sk.color, 30, 5, 0.8, 0.6, { gravity: 2 });
    G.fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.carryR, sk.color, 0.6);
    emitEvent('feed', { text: `${h.name} cưỡi Thần Ngưu!`, team: h.team });
    sfx('buff'); return true;
  },
  // --- Hồi sinh ---
  revive(c) {
    const { h, sk } = c; const fx = G.fx; const dead = G.heroes.filter((u) => u.team === h.team && !u.alive && u !== h && u.deathPos).sort((a, b) => dist(a.deathPos, h.pos) - dist(b.deathPos, h.pos))[0];
    if (dead) {
      const p = dead.deathPos.clone(); fx.pillar(p.x, p.y, p.z, sk.color, 1.6, 18, 1.4); fx.ring(p.x, p.y, p.z, 3.5, sk.color, 1.2); fx.beam(V(h.pos.x, h.pos.y + 1.5, h.pos.z), V(p.x, p.y + 1.5, p.z), sk.color, 0.25, 1.2);
      after(1.2, () => { if (!dead.alive && !G.over) { reviveAt(dead, p.x, p.z, 0.6); if (dead === G.player) { G.camSnap = true; emitEvent('banner', { text: 'BẠN ĐƯỢC HỒI SINH!', gold: true }); } } });
      emitEvent('feed', { text: `${h.name} hồi sinh ${dead.name}`, team: h.team });
    } else {
      for (const a of alliesInRadius(h.team, h.pos.x, h.pos.z, sk.radius)) { heal(h, a, sk.heal + apVal(h, sk)); fx.stream(h.pos, a.pos, sk.color, 14); fx.burst(a.pos.x, a.pos.y + 0.5, a.pos.z, sk.color, 18, 3, 1, 0.5, { up: 3 }); }
      fx.ring(h.pos.x, h.pos.y, h.pos.z, sk.radius, sk.color, 0.9); fx.pillar(h.pos.x, h.pos.y, h.pos.z, sk.color, 1.2, 12, 1);
    }
    sfx('heal'); return true;
  },
};

function nearestForShot(h, range) { let b = null, bd = 1e9; for (const u of G.units) { if (!u.alive || u.team === h.team || u.kind === 'tower' || u.kind === 'nexus' || !canSee(h.team, u)) continue; const d = Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z); if (d < range && d < bd) { bd = d; b = u; } } return b; }
function fireShot(h, t, sk, lv) {
  const dir = V(t.pos.x - h.pos.x, 0, t.pos.z - h.pos.z).normalize(); h.yaw = Math.atan2(dir.x, dir.z); h.atkAnim = 0.25;
  G.fx.projectile({ from: V(h.pos.x + dir.x * 0.8, h.pos.y + 1.3, h.pos.z + dir.z * 0.8), dir, color: sk.color, speed: 40, range: 16, radius: 0.7, size: 0.22, stretch: 4, owner: h, team: h.team, onHit: (u) => { applyHit(h, u, sk, lv); return 'stop'; } });
}

// Biểu tượng dấu đánh dấu trên đầu địch
function ensureMark(u) {
  if (!u.markMesh) { const g = new THREE.Group(); const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xff2020 })); o.scale.y = 1.4; const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 5, 18), new THREE.MeshBasicMaterial({ color: 0xff5555 })); r.rotation.x = Math.PI / 2; g.add(o, r); G.matchGroup.add(g); u.markMesh = g; }
  u.markMesh.visible = true;
}

// ============================================================
// castSkill(hero, skillIndex, targetPos) — điểm vào duy nhất của hệ thống skill
// ============================================================
export function castSkill(h, idx, target) {
  const sk = h.def.skills[idx]; if (!sk || !h.alive || G.over) return false;
  const lv = skillLevel(h, idx);
  if (lv <= 0) { if (h === G.player) emitEvent('feed', { text: 'Chiêu cuối mở khóa ở cấp 4', team: 0 }); return false; }
  if (h.stunT > 0 || h.airT > 0) return false;
  if (h.cd[idx] > 0) return false;
  if (h.mana < sk.mana) { if (h === G.player) emitEvent('feed', { text: 'Không đủ năng lượng!', team: 0 }); return false; }
  const aim = target || { x: h.pos.x + Math.sin(h.yaw) * 5, z: h.pos.z + Math.cos(h.yaw) * 5 };
  let dx = aim.x - h.pos.x, dz = aim.z - h.pos.z; let l = Math.hypot(dx, dz); if (l < 0.05) { dx = Math.sin(h.yaw); dz = Math.cos(h.yaw); l = 1; }
  const dir = V(dx / l, 0, dz / l);
  const ctx = { h, sk, lv, dir, aim };
  if (sk.kind !== 'stealth') breakStealth(h);
  const ok = KINDS[sk.kind](ctx);
  if (ok === false) return false;
  h.mana -= sk.mana; h.cd[idx] = sk.cd * (1 - h.stats.cdr); h.castT = 0.5; if (sk.kind !== 'dash' || sk.dir !== 'back') h.yaw = Math.atan2(dir.x, dir.z); cancelRecall(h);
  // hiệu ứng cast: glow quanh nhân vật
  G.fx.burst(h.pos.x, h.pos.y + 1.4, h.pos.z, sk.color, 14, 3, 0.45, 0.45); G.fx.ring(h.pos.x, h.pos.y, h.pos.z, 1.6, sk.color, 0.4); G.fx.flash(h.pos, sk.color, 2.5, 0.35);
  return true;
}

// ---------- cập nhật các hiệu ứng tồn tại theo thời gian ----------
export function resetSkills() { G.skillWalls = []; G.traps = []; G.zones = []; G.drones = []; G.spins = []; G.wallsDyn.length = 0; }
export function updateSkills(dt) {
  const fx = G.fx;
  // marks
  for (const u of G.units) if (u.markMesh && u.markMesh.visible) { const m = u.markMesh; if (u.markT <= 0 || !u.alive) { m.visible = false; continue; } m.visible = u.team === 0 || true; m.position.set(u.pos.x, u.pos.y + (u.def ? u.def.height : 1.8) + 0.9 + Math.sin(G.time * 4) * 0.1, u.pos.z); m.rotation.y += dt * 3; }
  // tường
  for (let i = G.skillWalls.length - 1; i >= 0; i--) {
    const w = G.skillWalls[i]; w.t += dt; w.g.scale.y = Math.min(1, w.g.scale.y + dt * 6);
    if (w.t > w.dur - 0.5) w.g.children.forEach((c) => { if (c.material && c.material.transparent) c.material.opacity = Math.max(0.1, (w.dur - w.t) * 1.6); });
    if (w.t >= w.dur) { fx.burst(w.cx, w.y + 1, w.cz, w.color, 30, 5, 0.7, 0.6, { gravity: 5 }); w.g.parent && w.g.parent.remove(w.g); const k = OBST.boxes.indexOf(w.col); if (k >= 0) OBST.boxes.splice(k, 1); const k2 = G.wallsDyn.indexOf(w.col); if (k2 >= 0) G.wallsDyn.splice(k2, 1); G.skillWalls.splice(i, 1); }
  }
  // bẫy
  for (let i = G.traps.length - 1; i >= 0; i--) {
    const t = G.traps[i]; t.t -= dt; t.arm -= dt; t.core.material.emissiveIntensity = 1.2 + Math.sin(G.time * 8) * 0.8; let boom = t.t <= 0;
    if (t.arm <= 0 && !boom) for (const u of G.units) { if (!u.alive || u.team === t.h.team || u.team === 2 || (u.kind !== 'hero' && u.kind !== 'minion')) continue; if (Math.hypot(u.pos.x - t.x, u.pos.z - t.z) < t.sk.trigger) { boom = true; break; } }
    if (boom) {
      if (t.t > 0 || true) { for (const u of enemiesInRadius(t.h, t.x, t.z, t.sk.radius)) applyHit(t.h, u, t.sk, t.lv); fx.ring(t.x, t.y, t.z, t.sk.radius, t.sk.color, 0.5); fx.burst(t.x, t.y + 0.5, t.z, t.sk.color, 40, 7, 0.7, 0.7, { gravity: 4 }); fx.flash(V(t.x, t.y, t.z), t.sk.color, 4, 0.4); G.cam.shake(0.25, 0.2); sfx('boom'); }
      t.g.parent && t.g.parent.remove(t.g); G.traps.splice(i, 1);
    }
  }
  // vùng hồi máu
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i]; z.t -= dt; z.acc += dt; if (Math.random() < dt * 14) fx.aura(z.x + rand(-z.r, z.r) * 0.8, z.y + 0.1, z.z + rand(-z.r, z.r) * 0.8, z.sk.color, 0.35, 1.8, 0.1, 1);
    if (z.acc >= z.tick) { z.acc = 0; for (const a of alliesInRadius(z.h.team, z.x, z.z, z.r)) { heal(z.h, a, z.sk.heal * (1 + 0.2 * (z.lv - 1)) + z.h.stats.ap * z.sk.apR, true); fx.burst(a.pos.x, a.pos.y + 0.3, a.pos.z, z.sk.color, 3, 1.5, 0.8, 0.4, { up: 2 }); } }
    if (z.t <= 0) G.zones.splice(i, 1);
  }
  // drone
  for (let i = G.drones.length - 1; i >= 0; i--) {
    const d = G.drones[i]; d.t -= dt; d.a += dt * 1.5; const h = d.h;
    if (d.t <= 0 || !h.alive) { fx.burst(d.g.position.x, d.g.position.y, d.g.position.z, d.sk.color, 20, 4, 0.5, 0.5); d.g.parent && d.g.parent.remove(d.g); G.drones.splice(i, 1); continue; }
    const tx = h.pos.x + Math.cos(d.a) * 1.6, tz = h.pos.z + Math.sin(d.a) * 1.6, ty = h.pos.y + 2.8 + Math.sin(d.a * 2) * 0.2; d.g.position.x += (tx - d.g.position.x) * Math.min(1, dt * 6); d.g.position.z += (tz - d.g.position.z) * Math.min(1, dt * 6); d.g.position.y += (ty - d.g.position.y) * Math.min(1, dt * 6); d.g.rotation.y += dt * 3;
    d.cd -= dt; if (d.cd <= 0) {
      const t = nearestForShot(h, 12); if (t) { d.cd = d.sk.interval; dealDamage(h, t, d.sk.dmg * (1 + 0.28 * (d.lv - 1)) + h.stats.atk * d.sk.adR, 'phys', { color: d.sk.color }); fx.beam(d.g.position, V(t.pos.x, t.pos.y + 1.2, t.pos.z), d.sk.color, 0.12, 0.15); fx.burst(t.pos.x, t.pos.y + 1.2, t.pos.z, d.sk.color, 5, 3, 0.3, 0.4); } else d.cd = 0.2;
    }
  }
  // vòng quay kiếm thần (Bình An W)
  for (let i = G.spins.length - 1; i >= 0; i--) {
    const s = G.spins[i]; const h = s.h; s.t -= dt;
    if (s.t <= 0 || !h.alive) { s.g.parent && s.g.parent.remove(s.g); G.spins.splice(i, 1); continue; }
    s.g.position.set(h.pos.x, h.pos.y, h.pos.z);
    s.g.rotation.y += dt * s.sk.spinSpeed;
    if (Math.random() < dt * 20) fx.aura(h.pos.x + rand(-1.5, 1.5), h.pos.y + 1.4 + Math.random(), h.pos.z + rand(-1.5, 1.5), s.sk.color, 0.25, 1.2, 0.15, 0.8);
    s.acc -= dt;
    if (s.acc <= 0) { // tick sát thương + làm chậm (mỗi 0.55s)
      s.acc = 0.55;
      for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, s.sk.radius)) { if (e.kind !== 'tower' && e.kind !== 'nexus') slow(e, s.sk.slow[0], s.sk.slow[1]); applyHit(h, e, s.sk, s.lv); }
    }
    s.stunAcc -= dt;
    if (s.stunAcc <= 0) { // choáng định kỳ (mỗi 1.1s)
      s.stunAcc = s.sk.stunEvery;
      let any = false;
      for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, s.sk.radius)) { if (e.kind === 'tower' || e.kind === 'nexus') continue; stun(e, s.sk.stunT); any = true; fx.ring(e.pos.x, e.pos.y + 0.2, e.pos.z, 1.4, 0xffe880, 0.4, { noExpand: true }); }
      if (any) { fx.flash(V(h.pos.x, h.pos.y + 1, h.pos.z), 0xffe880, 2.5, 0.25); sfx('hit'); }
    }
  }
  // cưỡi Thần Ngưu (Bình An E)
  for (const h of G.heroes) {
    if (!h.mount) continue; const m = h.mount;
    if (!h.alive || h.mountT <= 0) { endMount(h); continue; }
    h.mountT -= dt;
    // bò chạy theo chủ
    m.g.position.set(h.pos.x, h.pos.y, h.pos.z); m.g.rotation.y = h.yaw;
    const moved = Math.hypot(h.pos.x - m.lastX, h.pos.z - m.lastZ); m.lastX = h.pos.x; m.lastZ = h.pos.z;
    // tông vào tường/tảng đá: mất xe
    if (h.moving && h.moveSpeed > 0.5) {
      const expect = h.moveSpeed * dt;
      if (moved < expect * 0.3) { m.blockT = (m.blockT || 0) + dt; if (m.blockT > 0.15) { // đâm tường — bò gãy
        fx.burst(h.pos.x, h.pos.y + 1, h.pos.z, m.sk.color, 40, 7, 0.7, 0.6, { gravity: 3 });
        fx.ring(h.pos.x, h.pos.y, h.pos.z, 3, m.sk.color, 0.5);
        G.cam.shake(0.45, 0.3); sfx('boom');
        emitEvent('feed', { text: `${h.name} đâm tường — Thần Ngưu bỏ chạy!`, team: h.team });
        stun(h, 0.6); endMount(h); continue;
      } } else m.blockT = 0;
    }
    m.walkPh += moved * 4.5; // animation chân đi bộ theo quãng đường
    const ud = m.g.userData;
    for (const l of ud.legs) { l.hip.rotation.x = Math.sin(m.walkPh + (l.f > 0 ? 0 : Math.PI)) * 0.55; l.knee.rotation.x = Math.max(0, -Math.sin(m.walkPh + (l.f > 0 ? 0.9 : 2.1))) * 0.7; }
    ud.tail.rotation.x = Math.sin(G.time * 3) * 0.3;
    ud.body.rotation.z = Math.sin(m.walkPh * 2) * 0.03; // lắc nhẹ khi chạy
    if (Math.random() < dt * 12 && moved > 0.01) fx.aura(h.pos.x + rand(-0.4, 0.4), h.pos.y + 0.1, h.pos.z + rand(-0.4, 0.4), 0xcfa060, 0.3, 0.6, 0.2, 0.7); // bụi dưới chân
    // đón đồng đội (chạm vào bò là lên, tối đa 1 người)
    if (!m.rider) for (const a of G.heroes) { if (a !== h && a.team === h.team && a.alive && !a.mount && !a.carriedBy && Math.hypot(a.pos.x - h.pos.x, a.pos.z - h.pos.z) < m.sk.carryR) { m.rider = a; a.carriedBy = h; fx.burst(a.pos.x, a.pos.y + 1, a.pos.z, m.sk.color, 18, 3, 0.5, 0.5); emitEvent('feed', { text: `${a.name} lên bò cùng ${h.name}!`, team: h.team }); break; } }
    if (m.rider && (!m.rider.alive || m.rider.carriedBy !== h)) m.rider = null;
    if (m.rider) { // ngồi sau lưng bò
      const bx = -Math.sin(h.yaw) * 1.15, bz = -Math.cos(h.yaw) * 1.15;
      m.rider.forced = null; m.rider.pos.x = h.pos.x + bx; m.rider.pos.z = h.pos.z + bz; m.rider.pos.y = h.pos.y; m.rider.path = null; m.rider.dest = null; m.rider.mountY = 1.35; m.rider.yaw = h.yaw;
    }
    // tông trúng kẻ địch: sát thương lớn + hất văng
    for (const e of enemiesInRadius(h, h.pos.x, h.pos.z, m.sk.hitR)) {
      if (e.kind === 'tower' || e.kind === 'nexus') continue;
      const last = m.hitAcc.get(e.id) || -99; if (G.time - last < m.sk.hitCd) continue;
      m.hitAcc.set(e.id, G.time);
      applyHit(h, e, m.sk, m.lv);
      const dx = e.pos.x - h.pos.x, dz = e.pos.z - h.pos.z, l = Math.hypot(dx, dz) || 1;
      forceMove(e, dx / l, dz / l, 2.5, 0.25, { face: false });
      fx.burst(e.pos.x, e.pos.y + 1.2, e.pos.z, m.sk.color, 26, 5, 0.5, 0.6);
      fx.ring(e.pos.x, e.pos.y, e.pos.z, 2.2, m.sk.color, 0.4);
      G.cam.shake(0.35, 0.25); sfx('boom');
    }
  }
}

// kết thúc cưỡi bò: gỡ model, trả đồng đội xuống
export function endMount(h) {
  const m = h.mount; if (!m) return;
  h.mount = null; h.mountT = 0; h.mountSpd = 0; h.mountY = 0;
  G.fx.burst(h.pos.x, h.pos.y + 0.5, h.pos.z, m.sk.color, 26, 5, 0.6, 0.5, { gravity: 2 });
  if (m.g.parent) m.g.parent.remove(m.g);
  if (m.rider) { m.rider.carriedBy = null; m.rider.mountY = 0; m.rider = null; }
}
export { clamp };
