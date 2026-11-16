// ============================================================
// combat.js — LÕI TRẬN ĐẤU: chỉ số, sát thương, hiệu ứng trạng thái, di chuyển + va chạm,
// đánh thường, tầm nhìn (Fog of War + bụi cỏ), lính/trụ/quái, hồi sinh, cửa hàng
// ============================================================
import * as THREE from 'three';
import { G, makeUnit, dist, dist2, clamp, rand, angleLerp, after, emitEvent, TEAM_BLUE } from './state.js';
import { heightAt, resolveObstacles, bushAt, BASE_INFO, findPath, hasLOS, destroyTower, animateTower } from './map.js';
import { updateMonsterAnim, removeMonster } from './monsters.js';
import { buildHeroModel } from './heroes.js';

// ---------- Độ khó bot ----------
export const DIFF = [
  { name: 'Dễ', think: 0.75, dmg: 0.8, aim: 0.5, skill: 0.4, vision: 14 },
  { name: 'Trung bình', think: 0.45, dmg: 1.0, aim: 0.75, skill: 0.65, vision: 18 },
  { name: 'Khó', think: 0.28, dmg: 1.12, aim: 0.9, skill: 0.85, vision: 20 },
  { name: 'Ác mộng', think: 0.15, dmg: 1.3, aim: 1.0, skill: 1.0, vision: 22 },
];

// ---------- Trang bị / Ngọc / Phù hiệu ----------
export const ITEMS = [
  { id: 'sword', name: 'Kiếm Sắt', icon: '🗡️', cost: 600, atk: 28, desc: '+28 công vật lý' },
  { id: 'bow', name: 'Cung Gió', icon: '🏹', cost: 900, atk: 15, aspd: 0.35, desc: '+15 công, +35% tốc đánh' },
  { id: 'blade', name: 'Đại Đao', icon: '⚔️', cost: 1700, atk: 70, aspd: 0.1, desc: '+70 công, +10% tốc đánh' },
  { id: 'staff', name: 'Gậy Phép', icon: '🪄', cost: 650, ap: 45, desc: '+45 công phép' },
  { id: 'orbm', name: 'Cầu Ma Lực', icon: '🔮', cost: 1800, ap: 100, mana: 200, desc: '+100 phép, +200 mana' },
  { id: 'tome', name: 'Sách Thông Thái', icon: '📖', cost: 1200, ap: 35, cdr: 0.15, mana: 250, desc: '+35 phép, +15% hồi chiêu' },
  { id: 'armor', name: 'Giáp Da', icon: '🧥', cost: 550, armor: 32, desc: '+32 giáp' },
  { id: 'plate', name: 'Giáp Thép', icon: '🛡️', cost: 1600, armor: 75, hp: 300, desc: '+75 giáp, +300 máu' },
  { id: 'cloak', name: 'Áo Choàng Phép', icon: '🧣', cost: 550, mr: 40, desc: '+40 kháng phép' },
  { id: 'shell', name: 'Khiên Ma Pháp', icon: '🔰', cost: 1500, mr: 85, hp: 250, desc: '+85 kháng phép, +250 máu' },
  { id: 'ring', name: 'Nhẫn Sinh Mệnh', icon: '💍', cost: 700, hp: 420, regen: 4, desc: '+420 máu, hồi máu' },
  { id: 'heart', name: 'Trái Tim Cự Thú', icon: '❤️', cost: 2100, hp: 1000, armor: 25, desc: '+1000 máu, +25 giáp' },
  { id: 'boots', name: 'Giày Tốc Độ', icon: '👟', cost: 700, speed: 1.0, desc: '+1.0 tốc chạy' },
  { id: 'bootsc', name: 'Giày Tốc Biến', icon: '👢', cost: 1300, speed: 1.6, cdr: 0.1, desc: '+1.6 tốc chạy, +10% hồi chiêu' },
];
export const RUNES = [
  { name: 'Ngọc Đỏ — Sát Thương', atk: 16, ap: 22, aspd: 0.06 },
  { name: 'Ngọc Lục — Phòng Thủ', hp: 320, armor: 12, mr: 12 },
  { name: 'Ngọc Tím — Cơ Động', speed: 0.5, cdr: 0.06, hp: 120 },
];
export const BADGES = [
  { name: 'Phù Hiệu Tấn Công', atk: 12, ap: 14 },
  { name: 'Phù Hiệu Sinh Tồn', hp: 220, regen: 3 },
  { name: 'Phù Hiệu Cơ Động', speed: 0.35, cdr: 0.04 },
];
export const MAX_LEVEL = 15;
const expNeed = (lv) => 180 + lv * 70;

// ---------- Tính lại chỉ số tướng ----------
export function recalc(h, full = false) {
  const d = h.def, s = d.stats, lv = h.level - 1;
  let hp = s.hp + s.hpLv * lv, mana = s.mana + 22 * lv, atk = s.atk + s.atkLv * lv, ap = s.ap + s.apLv * lv, armor = s.armor + s.armorLv * lv, mr = s.mr + 1.6 * lv, speed = s.speed - 1.9, aspd = s.aspd + lv * 0.012, cdr = 0, regen = s.regen + lv * 0.5; // đi bộ chậm hơn: giày mới bù lại (+1.0/+1.6)
  const add = (o) => { if (!o) return; hp += o.hp || 0; mana += o.mana || 0; atk += o.atk || 0; ap += o.ap || 0; armor += o.armor || 0; mr += o.mr || 0; speed += o.speed || 0; aspd += o.aspd || 0; cdr += o.cdr || 0; regen += o.regen || 0; };
  add(RUNES[h.rune || 0]); add(BADGES[h.badge || 0]); for (const it of h.items) add(it);
  let dmgMul = 1;
  if (h.buffs.blue > 0) cdr += 0.2;
  if (h.buffs.red > 0) dmgMul += 0.15;
  const tb = G.teamBuff[h.team];
  if (tb.dragon > 0) dmgMul += 0.1;
  if (tb.baron > 0) { hp *= 1.2; h.baronRegen = true; } else h.baronRegen = false;
  const old = h.maxHp; h.maxHp = Math.round(hp); h.maxMana = Math.round(mana);
  Object.assign(h.stats, { atk, ap, armor, mr, speed, range: s.range, aspd, cdr: Math.min(0.4, cdr), regen });
  h.dmgMul = dmgMul;
  if (full) { h.hp = h.maxHp; h.mana = h.maxMana; } else if (h.maxHp !== old) h.hp = Math.min(h.maxHp, h.hp + Math.max(0, h.maxHp - old));
}

export function skillLevel(h, i) {
  if (i === 3) return h.level < 4 ? 0 : Math.min(3, 1 + Math.floor((h.level - 4) / 4));
  return Math.min(5, 1 + Math.floor((h.level - 1) / 3));
}

// ---------- Vàng / EXP ----------
export function addGold(h, n) { if (!h || h.kind !== 'hero') return; h.gold += n; h.goldTotal = (h.goldTotal || 0) + n; if (h === G.player && n >= 20) emitEvent('gold', { x: h.pos.x, y: h.pos.y + 2.8, z: h.pos.z, n }); }
export function addExp(h, n) {
  if (!h || h.kind !== 'hero' || h.level >= MAX_LEVEL) return; h.exp += n;
  while (h.level < MAX_LEVEL && h.exp >= expNeed(h.level)) {
    h.exp -= expNeed(h.level); h.level++; recalc(h); h.hp = Math.min(h.maxHp, h.hp + 120);
    G.fx.ring(h.pos.x, h.pos.y, h.pos.z, 3, 0xffe680, 0.7); G.fx.pillar(h.pos.x, h.pos.y, h.pos.z, 0xffe680, 0.9, 7, 0.9);
    if (h === G.player) emitEvent('banner', { text: `LÊN CẤP ${h.level}!` });
    if (h.level === 4 && h === G.player) emitEvent('feed', { text: 'Đã mở khóa chiêu cuối (R)!', team: 0 });
  }
  if (h.level >= MAX_LEVEL) h.exp = 0;
}
export const expToNext = (h) => expNeed(h.level);

// ---------- Truy vấn ----------
export const isEnemy = (a, b) => a.team !== b.team;
export function isTargetable(u) {
  if (!u.alive) return false;
  if (u.kind === 'tower') return !u.prev || !u.prev.alive;
  if (u.kind === 'nexus') return G.towers.some((t) => t.kind === 'tower' && t.team === u.team && t.order === 2 && !t.alive);
  return true;
}
export const canSee = (team, u) => u.team === team || u.seenBy[team];
export function enemiesInRadius(src, x, z, r, filter) {
  const out = []; const team = src.team;
  for (const u of G.units) {
    if (!u.alive || u.team === team) continue; if (u.kind === 'tower' && !isTargetable(u)) continue; if (u.kind === 'nexus' && !isTargetable(u)) continue;
    const rr = r + u.radius; const dx = u.pos.x - x, dz = u.pos.z - z; if (dx * dx + dz * dz <= rr * rr && (!filter || filter(u))) out.push(u);
  }
  return out;
}
export function alliesInRadius(team, x, z, r, kinds = ['hero']) {
  const out = []; for (const u of G.heroes) { if (u.team !== team || !u.alive) continue; const dx = u.pos.x - x, dz = u.pos.z - z; if (dx * dx + dz * dz <= r * r) out.push(u); } return out;
}
export function nearestEnemy(src, range, opts = {}) {
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (!u.alive || u.team === src.team) continue; if (opts.heroOnly && u.kind !== 'hero') continue; if (opts.noStruct && (u.kind === 'tower' || u.kind === 'nexus')) continue;
    if (!isTargetable(u) || !canSee(src.team, u)) continue;
    const d = Math.hypot(u.pos.x - src.pos.x, u.pos.z - src.pos.z) - u.radius; if (d > range) continue;
    const w = d + (opts.prefer && opts.prefer(u) ? -4 : 0); if (w < bd) { bd = w; best = u; }
  }
  return best;
}

// ---------- Sát thương ----------
export function dealDamage(src, tgt, amount, type = 'phys', o = {}) {
  if (!tgt.alive || amount <= 0 || !isTargetable(tgt)) return 0;
  if (tgt.immuneT > 0) { if (src === G.player || tgt === G.player) emitEvent('dmg', { x: tgt.pos.x, y: tgt.pos.y + 2.4, z: tgt.pos.z, text: 'MIỄN NHIỄM', color: '#cfd8e0' }); return 0; }
  let a = amount;
  if (src) { a *= src.dmgMul || 1; if (src.isBot) a *= DIFF[G.difficulty].dmg; }
  if (type !== 'true') a *= 100 / (100 + Math.max(0, type === 'phys' ? tgt.stats.armor : tgt.stats.mr));
  if (tgt.markT > 0) a *= 1.2;
  if (tgt.reduceT > 0) a *= 1 - tgt.reducePct;
  if (tgt.kind === 'tower' && src && src.kind === 'minion') a *= 0.6;
  if (tgt.shieldAmt > 0) { const ab = Math.min(tgt.shieldAmt, a); tgt.shieldAmt -= ab; a -= ab; }
  a = Math.round(a);
  tgt.hp -= a; tgt.flashT = 0.25; tgt.lastDmgT = G.time; if (src) { tgt.lastHitBy = src; if (src.kind === 'hero') tgt.dmgBy[src.id] = G.time; }
  if (tgt.recallT > 0) cancelRecall(tgt);
  if (tgt.kind === 'monster' && src && (src.kind === 'hero' || src.kind === 'minion') && !tgt.target) tgt.target = src;
  if (tgt.kind === 'hero' || tgt.kind === 'tower') { G.fx.burst(tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z, o.color || 0xffffff, 3, 3, 0.35, 0.35); }
  if (tgt.kind === 'tower' || tgt.kind === 'nexus') tgt.hitT = G.time;
  if (a > 0 && (src === G.player || tgt === G.player)) emitEvent('dmg', { x: tgt.pos.x + rand(-0.4, 0.4), y: tgt.pos.y + 2.4, z: tgt.pos.z, text: String(a), color: tgt === G.player ? '#ff6b6b' : (type === 'magic' ? '#c89bff' : type === 'true' ? '#ffffff' : '#ffd24a'), big: !!o.big });
  if (src && src.kind === 'hero') { breakStealth(src); if (tgt.kind === 'hero') src.lastAggro = G.time; }
  if (tgt.hp <= 0) kill(tgt, src);
  return a;
}
export function heal(src, tgt, amt, silent) {
  if (!tgt.alive) return; const a = Math.min(tgt.maxHp - tgt.hp, Math.round(amt)); tgt.hp += a;
  if (!silent && a > 0 && (tgt === G.player || src === G.player)) emitEvent('dmg', { x: tgt.pos.x, y: tgt.pos.y + 2.4, z: tgt.pos.z, text: '+' + a, color: '#6dff8a' });
}
export function breakStealth(u) { if (u.stealthT > 0) { u.stealthT = 0; u.stealthBonus = true; } }

// ---------- Hạ gục ----------
function killReward(unit, killer) {
  const enemyTeam = 1 - unit.team; const heroes = G.heroes.filter((h) => h.team === enemyTeam && h.alive);
  if (unit.kind === 'minion') {
    const near = heroes.filter((h) => dist(h.pos, unit.pos) < 26);
    if (killer && killer.kind === 'hero') { addGold(killer, unit.goldV); killer.cs++; } else if (near.length) near.forEach((h) => addGold(h, Math.round(unit.goldV * 0.4)));
    if (near.length) near.forEach((h) => addExp(h, Math.round(unit.expV / near.length * 1.15)));
  }
}
export function kill(unit, killer) {
  if (!unit.alive) return; unit.alive = false; unit.hp = 0; unit.target = null; unit.deadT = 0;
  const fx = G.fx; const p = unit.pos;
  if (unit.kind === 'hero') {
    unit.deaths++; unit.respawnT = 5 + unit.level * 2; unit.recallT = 0; unit.stunT = unit.rootT = unit.slowT = 0; unit.forced = null; unit.stealthT = 0; unit.lift = 0; unit.airT = 0; unit.deathPos = p.clone();
    let kh = killer && killer.kind === 'hero' ? killer : null;
    if (!kh && unit.lastHitBy && unit.lastHitBy.kind === 'hero' && G.time - unit.lastDmgT < 6) kh = unit.lastHitBy;
    const kteam = killer ? killer.team : 1 - unit.team; G.kills[kteam]++;
    const bounty = Math.round(200 + unit.level * 20 + Math.min(150, unit.kills * 30));
    if (kh) { kh.kills++; addGold(kh, bounty); addExp(kh, 100 + unit.level * 20); }
    for (const h of G.heroes) { if (h !== kh && h.team === 1 - unit.team && unit.dmgBy[h.id] !== undefined && G.time - unit.dmgBy[h.id] < 8) { h.assists++; addGold(h, 110); } }
    unit.dmgBy = {};
    emitEvent('feed', { text: `${kh ? kh.name : (killer && killer.kind === 'tower' ? 'Trụ' : 'Quân lính')} ⚔ ${unit.name}`, team: kteam, hero: true });
    if (unit === G.player) emitEvent('banner', { text: 'BẠN ĐÃ BỊ HẠ GỤC', red: true }); else if (kh === G.player) emitEvent('banner', { text: `ĐÃ HẠ GỤC ${unit.name}!`, gold: true });
    fx.burst(p.x, p.y + 1, p.z, unit.team === 0 ? 0x66aaff : 0xff6655, 40, 6, 0.9, 0.6, { gravity: 4 }); G.cam && G.cam.shake(0.25, 0.25);
  } else if (unit.kind === 'minion') {
    killReward(unit, killer); fx.burst(p.x, p.y + 0.8, p.z, unit.team === 0 ? 0x5599ff : 0xff6655, 10, 3, 0.5, 0.4, { gravity: 3 });
  } else if (unit.kind === 'monster') {
    const c = unit.camp; c.timer = c.respawn; const t = unit.mtype; const info = { gold: { blue_buff: 90, red_buff: 90, pig: 60, bird: 55, dragon: 250, baron: 350 }[t], exp: { blue_buff: 160, red_buff: 160, pig: 90, bird: 80, dragon: 400, baron: 700 }[t] };
    const kh = killer && killer.kind === 'hero' ? killer : (killer && killer.owner) || null;
    if (kh) {
      addGold(kh, info.gold); addExp(kh, info.exp);
      const team = kh.team;
      if (t === 'blue_buff') { kh.buffs.blue = 90; recalc(kh); emitEvent('feed', { text: `${kh.name} nhận Bùa Xanh (-20% hồi chiêu)`, team }); }
      if (t === 'red_buff') { kh.buffs.red = 90; recalc(kh); emitEvent('feed', { text: `${kh.name} nhận Bùa Đỏ (+15% sát thương)`, team }); }
      if (t === 'dragon') { G.teamBuff[team].dragon = 120; G.heroes.filter((h) => h.team === team).forEach((h) => { addGold(h, 120); recalc(h); }); emitEvent('banner', { text: team === 0 ? 'ĐỘI XANH HẠ RỒNG! +10% sát thương' : 'ĐỘI ĐỎ HẠ RỒNG!', gold: team === 0 }); }
      if (t === 'baron') { G.teamBuff[team].baron = 90; G.heroes.filter((h) => h.team === team).forEach((h) => { addGold(h, 200); recalc(h); }); emitEvent('banner', { text: team === 0 ? 'ĐỘI XANH HẠ TÀ THẦN! +20% HP, hồi 2%/s' : 'ĐỘI ĐỎ HẠ TÀ THẦN!', gold: team === 0 }); }
    }
    fx.burst(p.x, p.y + 1.5, p.z, 0xffd24a, 40, 6, 0.9, 0.6, { gravity: 3 });
  } else if (unit.kind === 'tower') {
    destroyTower(unit, fx); G.cam && G.cam.shake(0.5, 0.5);
    for (const h of G.heroes) if (h.team === 1 - unit.team) { addGold(h, 150); addExp(h, 60); }
    emitEvent('banner', { text: unit.team === 1 ? 'ĐÃ PHÁ HỦY TRỤ ĐỊCH!' : 'TRỤ CỦA TA ĐÃ BỊ PHÁ!', gold: unit.team === 1, red: unit.team === 0 });
    emitEvent('feed', { text: `Trụ ${unit.team === 0 ? 'Xanh' : 'Đỏ'} đã sụp đổ`, team: 1 - unit.team });
  } else if (unit.kind === 'nexus') {
    unit.model.group.visible = true; fx.burst(p.x, p.y + 4, p.z, unit.team === 0 ? 0x66aaff : 0xff6655, 150, 14, 1.8, 1.2, { gravity: 2 }); G.cam && G.cam.shake(1, 1.2);
    G.over = true; G.winner = 1 - unit.team; emitEvent('end', { winner: G.winner });
  }
}

// ---------- Trạng thái ----------
export function stun(u, t) { if (u.immuneT > 0 || u.kind === 'tower' || u.kind === 'nexus') return; u.stunT = Math.max(u.stunT, t * (u.kind === 'monster' && u.mtype ? 0.5 : 1)); if (u.recallT > 0) cancelRecall(u); }
export function slow(u, pct, t) { if (u.immuneT > 0) return; if (pct >= u.slowPct || u.slowT <= 0) { u.slowPct = pct; } u.slowT = Math.max(u.slowT, t); }
export function root(u, t) { if (u.immuneT > 0 || u.kind === 'monster' && (u.mtype === 'dragon' || u.mtype === 'baron')) return; u.rootT = Math.max(u.rootT, t); }
export function knockup(u, t) { if (u.immuneT > 0 || (u.kind === 'monster' && (u.mtype === 'dragon' || u.mtype === 'baron'))) return; u.airT = Math.max(u.airT, t); u.airDur = Math.max(u.airDur || 0.1, t); u.stunT = Math.max(u.stunT, t); u.airMax = t; }
export function forceMove(u, dx, dz, dist2d, dur, o = {}) {
  const l = Math.hypot(dx, dz) || 1; u.forced = { dx: dx / l, dz: dz / l, dist: dist2d, dur, t: 0, pass: o.pass !== false, done: o.done, onStep: o.onStep };
  if (o.face !== false) u.yaw = Math.atan2(dx, dz);
}
export function cancelRecall(u) { if (u.recallT > 0) { u.recallT = 0; if (u === G.player) emitEvent('feed', { text: 'Về nhà bị hủy', team: 0 }); } }

function updateStatus(u, dt) {
  const dec = (k) => { if (u[k] > 0) u[k] = Math.max(0, u[k] - dt); };
  dec('stunT'); dec('rootT'); dec('markT'); dec('immuneT'); dec('stealthT'); dec('stealthBonusT');
  if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slowPct = 0; }
  if (u.hasteT > 0) { u.hasteT -= dt; if (u.hasteT <= 0) u.hastePct = 0; }
  if (u.reduceT > 0) { u.reduceT -= dt; if (u.reduceT <= 0) u.reducePct = 0; }
  if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shieldAmt = 0; }
  if (u.airT > 0) { u.airT -= dt; const p = 1 - u.airT / (u.airMax || 1); u.lift = Math.sin(clamp(p, 0, 1) * Math.PI) * 1.7; if (u.airT <= 0) u.lift = 0; }
  if (u.markT <= 0 && u.markMesh) { u.markMesh.visible = false; }
  u.atkCd = Math.max(0, u.atkCd - dt); u.atkAnim = Math.max(0, u.atkAnim - dt); u.castT = Math.max(0, u.castT - dt); u.pathT -= dt; u.flashT = Math.max(0, u.flashT - dt);
  if (!u.alive) return;
  if (u.kind === 'hero') {
    for (const k of ['blue', 'red']) if (u.buffs[k] > 0) { u.buffs[k] -= dt; if (u.buffs[k] <= 0) recalc(u); }
    u.hp = Math.min(u.maxHp, u.hp + (u.stats.regen + (u.baronRegen ? u.maxHp * 0.02 : 0)) * dt); u.mana = Math.min(u.maxMana, u.mana + (4 + u.level * 0.4) * dt);
    for (let i = 0; i < 4; i++) if (u.cd[i] > 0) u.cd[i] = Math.max(0, u.cd[i] - dt);
    u.healCd = Math.max(0, u.healCd - dt);
    // passive gold
    addGoldPassive(u, dt);
    // hồi máu ở base
    const b = BASE_INFO[u.team]; if (b.x !== undefined && Math.hypot(u.pos.x - b.x, u.pos.z - b.z) < b.r + 1) { u.inBase = true; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12 * dt); u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.12 * dt); } else u.inBase = false;
    // về nhà
    if (u.recallT > 0) { if (u.moving || u.stunT > 0) cancelRecall(u); else { u.recallT -= dt; if (Math.random() < 0.5) G.fx.aura(u.pos.x, u.pos.y, u.pos.z, 0x66ccff, 0.35, 3, 1.0); if (u.recallT <= 0) doRecall(u); } }
  } else if (u.kind === 'minion') { /* không hồi */ }
  else if (u.kind === 'monster') { if (!u.target && !u.dest) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.15 * dt); }
}
function addGoldPassive(u, dt) { u.goldAcc = (u.goldAcc || 0) + dt * 2.4; if (u.goldAcc >= 1) { const n = Math.floor(u.goldAcc); u.goldAcc -= n; u.gold += n; u.goldTotal = (u.goldTotal || 0) + n; } }
export function startRecall(u) { if (!u.alive || u.inBase || u.recallT > 0) return; u.recallT = 4; u.path = null; u.target = null; }
function doRecall(u) {
  const b = BASE_INFO[u.team]; G.fx.burst(u.pos.x, u.pos.y + 1, u.pos.z, 0x66ccff, 30, 5, 0.7, 0.5); G.fx.pillar(u.pos.x, u.pos.y, u.pos.z, 0x66ccff, 1, 9, 0.6);
  u.pos.x = b.spawn.x + rand(-1.5, 1.5); u.pos.z = b.spawn.z + rand(-1.5, 1.5); u.path = null; u.target = null; u.forced = null;
  G.fx.burst(u.pos.x, u.pos.y + 1, u.pos.z, 0x66ccff, 30, 5, 0.7, 0.5); G.fx.pillar(u.pos.x, u.pos.y, u.pos.z, 0x66ccff, 1, 9, 0.6); if (u === G.player) { G.camSnap = true; }
}
export function useHealSpell(h) {
  if (!h.alive || h.healCd > 0) return false; h.healCd = 45;
  for (const a of alliesInRadius(h.team, h.pos.x, h.pos.z, 8)) heal(h, a, a.maxHp * (a === h ? 0.18 : 0.1)); G.fx.ring(h.pos.x, h.pos.y, h.pos.z, 8, 0x6dff8a, 0.7); G.fx.burst(h.pos.x, h.pos.y + 1, h.pos.z, 0x6dff8a, 24, 3, 1, 0.5, { up: 2 });
  return true;
}

// ---------- Di chuyển + va chạm ----------
export function goTo(u, x, z, force) {
  if (!force && u.goal && u.pathT > 0 && Math.hypot(u.goal.x - x, u.goal.z - z) < 3) return;
  u.goal = { x, z }; u.path = findPath(u.pos.x, u.pos.z, x, z); u.pathT = 0.6; u.dest = null;
}
export function steerTo(u, x, z) { if (!u.dest) u.dest = { x: 0, z: 0 }; u.dest.x = x; u.dest.z = z; u.path = null; }
export function stop(u) { u.path = null; u.dest = null; u.goal = null; }

function updateMovement(u, dt) {
  u.moving = false; if (!u.alive) return; const st = u.stats;
  if (u.forced) { // dash / bị đẩy: bỏ qua điều khiển thường
    const f = u.forced; const step = Math.min(dt, f.dur - f.t); f.t += step; const d = f.dist * step / f.dur;
    u.pos.x += f.dx * d; u.pos.z += f.dz * d; resolveObstacles(u.pos, u.radius * 0.8); if (f.onStep) f.onStep(u, dt);
    if (f.t >= f.dur - 1e-5) { const cb = f.done; u.forced = null; if (cb) cb(u); }
    u.pos.y = heightAt(u.pos.x, u.pos.z); return;
  }
  if (u.stunT > 0) return;
  let dx = 0, dz = 0, have = false;
  if (u.inputX || u.inputZ) { dx = u.inputX; dz = u.inputZ; have = true; u.path = null; u.dest = null; }
  else if (u.path && u.path.length) {
    const t = u.path[0]; dx = t.x - u.pos.x; dz = t.z - u.pos.z; const d = Math.hypot(dx, dz);
    if (d < 0.5) { u.path.shift(); if (!u.path.length) { u.path = null; u.goal = null; } } else have = true;
  } else if (u.dest) { dx = u.dest.x - u.pos.x; dz = u.dest.z - u.pos.z; if (Math.hypot(dx, dz) > 0.4) have = true; }
  if (!have || u.rootT > 0 || (u.castT > 0.25 && u.kind === 'hero' && u.castLock)) return;
  let sp = st.speed * (1 + (u.hasteT > 0 ? u.hastePct : 0)) * (1 - (u.slowT > 0 ? u.slowPct : 0));
  if (u.mountT > 0) sp *= 1 + (u.mountSpd || 0); // Thần Ngưu: tốc độ cao hơn hẳn
  if (u.kind === 'monster' && !u.target) sp *= 1.6;
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const step = Math.min(sp * dt, u.dest || u.path ? l : 999);
  u.pos.x += dx * step; u.pos.z += dz * step; u.moving = true; u.moveSpeed = sp;
  if (!u.faceLock) u.yaw = angleLerp(u.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 16));
  resolveObstacles(u.pos, u.radius * 0.8); u.pos.y = heightAt(u.pos.x, u.pos.z);
}
// Capsule-collision đơn giản giữa các đơn vị (đẩy nhau theo khối lượng)
function separate() {
  const arr = []; for (const u of G.units) if (u.alive && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster') && !u.forced) arr.push(u);
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i]; const ma = a.kind === 'monster' ? 4 : a.kind === 'hero' ? 1.2 : 0.5;
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const rr = (a.radius + b.radius) * 0.9; const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue; const d = Math.sqrt(d2), o = (rr - d); const mb = b.kind === 'monster' ? 4 : b.kind === 'hero' ? 1.2 : 0.5;
      const wa = mb / (ma + mb), wb = ma / (ma + mb); const nx = dx / d, nz = dz / d;
      if (a.team === b.team && a.kind === 'minion' && b.kind === 'minion') { a.pos.x -= nx * o * 0.35; a.pos.z -= nz * o * 0.35; b.pos.x += nx * o * 0.35; b.pos.z += nz * o * 0.35; }
      else { a.pos.x -= nx * o * wa; a.pos.z -= nz * o * wa; b.pos.x += nx * o * wb; b.pos.z += nz * o * wb; }
    }
  }
  for (const u of arr) { resolveObstacles(u.pos, u.radius * 0.8); u.pos.y = heightAt(u.pos.x, u.pos.z); }
}

// ---------- Đánh thường ----------
export function faceTo(u, x, z) { u.yaw = Math.atan2(x - u.pos.x, z - u.pos.z); }
export function inAttackRange(u, t) { return Math.hypot(t.pos.x - u.pos.x, t.pos.z - u.pos.z) - t.radius <= u.stats.range + 0.35; }
export function tryAttack(u, t) {
  if (u.atkCd > 0 || !u.alive || u.stunT > 0 || u.castT > 0.2 || !t.alive || !isTargetable(t)) return false;
  if (!inAttackRange(u, t)) return false;
  faceTo(u, t.pos.x, t.pos.z); const interval = 1 / (u.stats.aspd * (u.atkBuffT > 0 ? 1.3 : 1)); u.atkCd = interval; u.atkAnim = 0.3; u.atkAnimDur = 0.3;
  const ranged = u.stats.range > 3.2; const isHero = u.kind === 'hero';
  after(0.12, () => {
    if (!u.alive || !t.alive) return;
    const hit = (tg) => {
      if (!u.alive || !tg.alive) return;
      let dmg = u.stats.atk, type = 'phys', big = false;
      if (isHero && u.def.look.atk === 'cast') { dmg = u.stats.atk + u.stats.ap * 0.35; type = 'magic'; }
      if (isHero) {
        if (u.stealthBonus) { dmg *= 1.4; u.stealthBonus = false; big = true; }
        if (u.def.id === 'leanh') { const ang = Math.atan2(tg.pos.x - u.pos.x, tg.pos.z - u.pos.z); const tf = tg.yaw; let da = Math.abs(((ang - tf + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < 1.1) { dmg *= 1.5; big = true; } }
        if (tg.markT > 0 && tg.markBy === u) { tg.markT = 0; dealDamage(u, tg, tg.markPop || 90, 'true', { big: true }); G.fx.burst(tg.pos.x, tg.pos.y + 1.5, tg.pos.z, 0xff2020, 20, 5, 0.5, 0.5); }
        if (u.def.id === 'dat' || u.def.id === 'binhan' || u.def.id === 'tuan') G.fx.burst(tg.pos.x, tg.pos.y + 1, tg.pos.z, u.def.look.glow, 6, 3, 0.3, 0.4);
        if (u.def.id === 'khaikiet' && tg.kind === 'hero') { // Nội tại Kiếm Gầm
          u.aaStacks = ((u.aaStacks || 0) + 1) % 8;
          u.reducePct = Math.max(u.reducePct || 0, 0.15); u.reduceT = 1.5;
          if (u.aaStacks === 0) { heal(u, u, u.maxHp * 0.08); G.fx.burst(u.pos.x, u.pos.y + 1.4, u.pos.z, 0x7dff9a, 14, 3, 0.6, 0.5, { up: 2.5 }); }
        }
      }
      dealDamage(u, tg, dmg, type, { big, color: isHero ? u.def.look.glow : 0xffffff });
    };
    if (ranged) {
      const col = isHero ? u.def.look.glow : (u.team === 0 ? 0x66aaff : 0xff7755); const from = u.pos.clone(); from.y += 1.3;
      G.fx.projectile({ from, target: t, color: col, speed: isHero ? 26 : 18, size: isHero ? 0.2 : 0.15, owner: u, team: u.team, onHit: (tg) => hit(tg), stretch: isHero && (u.def.id === 'annie' || u.def.id === 'tung') ? 2.5 : 1 });
    } else hit(t);
  });
  breakStealthOnAttack(u);
  return true;
}
function breakStealthOnAttack(u) { if (u.stealthT > 0) { u.stealthT = 0; u.stealthBonus = true; } }
// Tháp: bắn đạn homing
function updateTower(t, dt) {
  if (!t.alive || t.kind !== 'tower') return; t.thinkT = (t.thinkT || 0) - dt;
  if (t.thinkT <= 0) {
    t.thinkT = 0.2; let best = null, bd = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === t.team || u.team === 2 || u.kind === 'tower' || u.kind === 'nexus') continue;
      const d = Math.hypot(u.pos.x - t.pos.x, u.pos.z - t.pos.z) - u.radius; if (d > t.stats.range) continue; if (u.stealthT > 0 && !u.seenBy[t.team]) continue;
      const w = d + (u.kind === 'hero' ? 6 : 0) + (u.kind === 'hero' && G.time - u.lastAggro < 3 ? -12 : 0); if (w < bd) { bd = w; best = u; }
    }
    t.target = best;
  }
  if (t.target && (!t.target.alive || Math.hypot(t.target.pos.x - t.pos.x, t.target.pos.z - t.pos.z) > t.stats.range + 2)) t.target = null;
  if (t.target && t.atkCd <= 0) {
    t.atkCd = 1 / t.stats.aspd; const tg = t.target; const from = new THREE.Vector3(t.pos.x, t.pos.y + t.towerY, t.pos.z); const col = t.team === 0 ? 0x4da0ff : 0xff5040;
    t.flashT = 0.2; const dmg = t.stats.atk + G.time / 60 * 8;
    G.fx.projectile({ from, target: tg, color: col, speed: 30, size: 0.38, owner: t, team: t.team, onHit: (u) => { dealDamage(t, u, u.kind === 'minion' ? dmg * 1.2 : dmg, 'phys', { color: col }); G.fx.burst(u.pos.x, u.pos.y + 1, u.pos.z, col, 10, 4, 0.4, 0.5); } });
  }
}

// ---------- AI Lính ----------
function updateMinion(m, dt) {
  if (!m.alive) return; m.thinkT = (m.thinkT || 0) - dt;
  if (m.thinkT <= 0) {
    m.thinkT = 0.25 + Math.random() * 0.1; let best = null, bs = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === m.team || u.team === 2) continue; if (!isTargetable(u)) continue; if (u.stealthT > 0 && !u.seenBy[m.team]) continue;
      const d = Math.hypot(u.pos.x - m.pos.x, u.pos.z - m.pos.z) - u.radius; const aggro = u.kind === 'tower' || u.kind === 'nexus' ? 7 : 9; if (d > aggro) continue;
      const s = d + (u.kind === 'hero' ? (G.time - u.lastAggro < 2.5 ? -3 : 4) : u.kind === 'tower' ? 2 : 0);
      if (s < bs) { bs = s; best = u; }
    }
    m.target = best;
  }
  const t = m.target;
  if (t && t.alive) {
    if (inAttackRange(m, t)) { m.dest = null; tryAttack(m, t); faceTo(m, t.pos.x, t.pos.z); } else steerTo(m, t.pos.x, t.pos.z);
  } else {
    const r = m.route[m.wp]; if (!r) return; if (Math.hypot(r.x - m.pos.x, r.z - m.pos.z) < 3.5 && m.wp < m.route.length - 1) m.wp++; steerTo(m, m.route[m.wp].x, m.route[m.wp].z);
  }
}
// ---------- AI Quái rừng ----------
function updateMonster(m, dt) {
  if (!m.alive) return;
  if (m.target && (!m.target.alive || dist(m.pos, m.spawn) > m.leash)) { m.target = null; m.dest = { x: m.spawn.x, z: m.spawn.z }; }
  if (m.target) {
    if (inAttackRange(m, m.target)) { m.dest = null; tryAttack(m, m.target); } else steerTo(m, m.target.pos.x, m.target.pos.z);
  } else if (m.dest) { if (Math.hypot(m.dest.x - m.pos.x, m.dest.z - m.pos.z) < 0.6) { m.dest = null; m.yaw = angleLerp(m.yaw, Math.atan2(-m.spawn.x, -m.spawn.z), 0.5); } }
}

// ---------- Tầm nhìn ----------
export const visionSources = [[], []];
export function updateVision() {
  for (const t of [0, 1]) {
    const s = visionSources[t]; s.length = 0;
    for (const u of G.units) {
      if (!u.alive || u.team !== t) continue;
      if (u.kind === 'hero') s.push({ x: u.pos.x, z: u.pos.z, r: t === 0 ? 20 : DIFF[G.difficulty].vision, hero: true });
      else if (u.kind === 'minion') s.push({ x: u.pos.x, z: u.pos.z, r: 11 });
      else if (u.kind === 'tower') s.push({ x: u.pos.x, z: u.pos.z, r: 18 });
      else if (u.kind === 'nexus') s.push({ x: u.pos.x, z: u.pos.z, r: 22 });
    }
  }
  for (const u of G.units) {
    if (!u.alive) { continue; }
    u.bush = (u.kind === 'tower' || u.kind === 'nexus') ? null : bushAt(u.pos.x, u.pos.z);
    for (const t of [0, 1]) {
      if (u.team === t || u.kind === 'tower' || u.kind === 'nexus') { u.seenBy[t] = true; continue; }
      let seen = false; const ss = visionSources[t];
      for (const s of ss) {
        const dx = s.x - u.pos.x, dz = s.z - u.pos.z; if (dx * dx + dz * dz > s.r * s.r) continue;
        if (u.stealthT > 0 || u.bush) { const close = dx * dx + dz * dz < (u.stealthT > 0 ? 5.5 : 6.5) ** 2; if (close || (!u.stealthT && u.bush && s.bushId === undefined && bushAt(s.x, s.z) === u.bush)) { seen = true; break; } continue; }
        seen = true; break;
      }
      u.seenBy[t] = seen;
    }
  }
}

// ---------- Tạo tướng ----------
export function createHero(def, team, o = {}) {
  const b = BASE_INFO[team]; const idx = o.slot || 0;
  const u = makeUnit('hero', team, b.spawn.x + (idx % 3 - 1) * 2.2, b.spawn.z + (Math.floor(idx / 3) - 0.5) * 2.2, { def, radius: 0.7, level: 1, exp: 0, gold: 500, goldTotal: 500, items: [], cd: [0, 0, 0, 0], kills: 0, deaths: 0, assists: 0, cs: 0, isBot: !!o.isBot, isPlayer: !!o.isPlayer, respawnT: 0, recallT: 0, buffs: { blue: 0, red: 0 }, name: o.name || def.name, rune: o.rune || 0, badge: o.badge || 0, role: o.role || 'mid', healCd: 0, lastAggro: -99, inBase: true, slot: idx });
  u.yaw = team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25;
  u.model = buildHeroModel(def); G.matchGroup.add(u.model.group); u.model.group.userData.unit = u;
  recalc(u, true); u.pos.y = heightAt(u.pos.x, u.pos.z); G.units.push(u); G.heroes.push(u); return u;
}
export function respawnHero(h) {
  const b = BASE_INFO[h.team]; h.alive = true; h.hp = h.maxHp; h.mana = h.maxMana; h.pos.set(b.spawn.x + rand(-2, 2), 0, b.spawn.z + rand(-2, 2)); h.pos.y = heightAt(h.pos.x, h.pos.z);
  h.animT = 0; h.target = null; h.path = null; h.dest = null; h.model.group.rotation.set(0, 0, 0); h.cd = [0, 0, 0, 0]; recalc(h); h.mountY = 0; h.carriedBy = null;
  G.fx.pillar(h.pos.x, h.pos.y, h.pos.z, h.team === 0 ? 0x66aaff : 0xff6655, 1.2, 10, 0.9); G.fx.ring(h.pos.x, h.pos.y, h.pos.z, 3, 0xffffff, 0.6);
  if (h === G.player) G.camSnap = true;
}
export function reviveAt(h, x, z, frac) {
  h.alive = true; h.hp = Math.max(1, h.maxHp * frac); h.mana = h.maxMana * 0.5; h.respawnT = 0; h.pos.set(x, 0, z); h.pos.y = heightAt(x, z); h.target = null; h.path = null; h.animT = 0; h.model.group.rotation.set(0, 0, 0);
  G.fx.pillar(x, h.pos.y, z, 0xfff0a0, 1.5, 14, 1.2); G.fx.burst(x, h.pos.y + 1, z, 0xfff0a0, 40, 5, 1, 0.6, { up: 3 });
}

// ---------- Cửa hàng ----------
export function canShop(h) { return h.alive && h.inBase; }
export function buyItem(h, id) {
  const it = ITEMS.find((i) => i.id === id); if (!it) return false; if (h.items.length >= 6 || h.gold < it.cost) return false;
  h.gold -= it.cost; h.items.push(it); recalc(h); return true;
}
export function sellItem(h, idx) { const it = h.items[idx]; if (!it) return; h.gold += Math.round(it.cost * 0.7); h.items.splice(idx, 1); recalc(h); }

// ---------- Cập nhật tổng ----------
export function updateUnits(dt) {
  const t = G.time;
  for (const u of G.units) {
    if (u.kind === 'tower') { updateStatus(u, dt); updateTower(u, dt); continue; }
    if (u.kind === 'nexus') { u.flashT = Math.max(0, u.flashT - dt); continue; }
    if (!u.alive) {
      if (u.kind === 'hero') { u.respawnT -= dt; if (u.respawnT <= 0 && !G.over) respawnHero(u); }
      u.deadT = (u.deadT || 0) + dt; continue;
    }
    updateStatus(u, dt);
    if (u.kind === 'minion') updateMinion(u, dt); else if (u.kind === 'monster') updateMonster(u, dt);
    updateMovement(u, dt);
  }
  separate();
  // cập nhật buff đội
  for (const tb of G.teamBuff) { for (const k of ['dragon', 'baron']) if (tb[k] > 0) { tb[k] -= dt; if (tb[k] <= 0) G.heroes.forEach(recalc); } }
  void t;
}

// ---------- Hình ảnh theo đơn vị ----------
export function updateVisuals(dt, camPos) {
  const t = G.time;
  for (const u of G.units) {
    if (u.kind === 'tower') { animateTower(u, t, dt); if (u.alive) u.model.group.visible = true; continue; }
    if (u.kind === 'nexus') {
      const m = u.mesh; if (u.alive) { const ud = m.userData; ud.orb.rotation.y += dt; ud.orb.position.y = 5.2 + Math.sin(t * 1.5) * 0.25; ud.ring.rotation.z += dt * 0.8; ud.ring2.rotation.z -= dt * 0.6; ud.mats[0].emissiveIntensity = 1.5 + Math.sin(t * 2.5) * 0.3 + u.flashT * 5; ud.beam.rotation.y += dt; }
      continue;
    }
    const g = u.model.group; const mine = u.team === 0 || u.team === 2 && false;
    const vis = u.alive || u.deadT < 1.4 ? (u.team === 0 ? true : u.seenBy[0]) : false;
    if (!u.alive && u.kind !== 'hero') {
      if (u.deadT > 0.5) { g.visible = false; u.remove = true; } else { g.scale.setScalar(Math.max(0.01, 1 - u.deadT / 0.5)); }
      continue;
    }
    g.visible = u.kind === 'hero' && !u.alive ? vis : (u.alive ? vis : false);
    if (!g.visible) continue;
    g.position.set(u.pos.x, u.pos.y + u.lift + (u.mountY || 0), u.pos.z); g.rotation.y = u.yaw;
    if (u.kind === 'hero') {
      let st = 'idle', p = 0;
      u.animT = (u.animT || 0) + dt;
      if (!u.alive) { st = 'death'; p = u.deadT; }
      else if (u.castT > 0) { st = 'cast'; p = 1 - u.castT / 0.5; } else if (u.atkAnim > 0) { st = 'attack'; p = 1 - u.atkAnim / 0.3; } else if (u.moving) st = 'run';
      u.model.update(st, p, t, dt, u.moving ? (u.moveSpeed || 8) / 8.5 : 1);
      const far = camPos ? (u.pos.x - camPos.x) ** 2 + (u.pos.z - camPos.z) ** 2 > 3600 : false; u.model.setDetail(!far);
      let op = 1; if (u.stealthT > 0) op = u.team === 0 ? 0.3 : (u.seenBy[0] ? 0.35 : 0); else if (u.bush && u.team === 0) op = 0.55;
      if (u._op !== op) { u.model.setOpacity(op); u._op = op; }
      // aura
      const au = u.def.look.aura; if (au && u.alive && Math.random() < dt * au.rate * G.quality) G.fx.aura(u.pos.x, u.pos.y + 0.1 + Math.random() * 1.2, u.pos.z, au.color, au.size, au.rise, u.def.look.smoke ? 0.5 : 0.7, u.def.look.smoke ? 1.4 : 1.1);
      if (u.alive && u.immuneT > 0 && Math.random() < 0.6) G.fx.aura(u.pos.x, u.pos.y + 0.2, u.pos.z, 0xc0c8d0, 0.5, 1.5, 1);
    } else if (u.kind === 'minion') { u.model.update(dt, t + u.id, u.moving, u.atkAnim > 0, 1 - u.atkAnim / 0.3); }
    else if (u.kind === 'monster') { updateMonsterAnim(u, dt, t, u.moving, u.atkAnim > 0); }
    if (u.kind !== 'hero' && u.flashT > 0) g.scale.setScalar(1.04); else if (u.kind !== 'hero' && g.scale.x !== 1 && u.alive) g.scale.setScalar(1);
  }
  // dọn đơn vị chết
  for (let i = G.units.length - 1; i >= 0; i--) { const u = G.units[i]; if (u.remove) { G.units.splice(i, 1); const arr = u.kind === 'minion' ? G.minions : G.monsters; const k = arr.indexOf(u); if (k >= 0) arr.splice(k, 1); if (u.kind === 'monster') removeMonster(u); else u.model.group.parent && u.model.group.parent.remove(u.model.group); } }
}
export { dist2 };
