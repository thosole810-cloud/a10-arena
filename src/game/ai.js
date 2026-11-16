// ============================================================
// ai.js — LOGIC BOT
// State machine: IDLE → FARM → ATTACK → RETREAT → RECALL → DEFEND (+ JUNGLE, OBJECTIVE)
//  - Đồng đội: đi đường, đánh lính, hỗ trợ (support đi theo xạ thủ)
//  - Địch: đẩy trụ, truy đuổi tướng thấp máu
//  - Rừng: dọn quái, gank, tụ họp đánh Rồng/Tà Thần
// Độ khó: Dễ / Trung bình / Khó / Ác mộng (xem DIFF trong combat.js)
// function updateBot(bot, gameState, delta)
// ============================================================
import { dist, rand, pick } from './state.js';
import { MAP_3D, BASE_INFO, hasLOS, laneProgress } from './map.js';
import { DIFF, goTo, steerTo, stop, tryAttack, inAttackRange, canSee, enemiesInRadius, ITEMS, buyItem, startRecall, useHealSpell, skillLevel, isTargetable, faceTo, cancelRecall } from './combat.js';
import { castSkill } from './skills.js';

const LANE_IDX = { top: 0, mid: 1, bot: 2 };
const BUILDS = {
  atk: ['boots', 'sword', 'bow', 'armor', 'blade', 'plate'],
  mage: ['boots', 'staff', 'tome', 'cloak', 'orbm', 'ring'],
  tank: ['boots', 'armor', 'ring', 'plate', 'shell', 'heart'],
};
const BUILD_OF = { binhan: 'tank', tuan: 'tank', khoa: 'mage', truongan: 'mage', thaonhi: 'mage', annie: 'atk', khaikiet: 'atk', leanh: 'atk', tung: 'atk', dat: 'atk' };

export function initBot(bot, role) { bot.ai = { state: 'IDLE', t: Math.random() * 0.5, castT: 0, role, goal: null, target: null, jg: 0, stuckT: 0, lastPos: bot.pos.clone() }; }

const D = () => DIFF[window.__G ? window.__G.difficulty : 1];

function laneOf(bot) { return MAP_3D.lanes[LANE_IDX[bot.ai.role] ?? 1]; }
function fwd(bot, p) { return bot.team === 0 ? p : 1 - p; } // tiến độ "về phía địch"

// Điểm đứng trong đường: theo lính đồng đội xa nhất, hoặc trụ còn sống
function laneAnchor(bot, G) {
  const lane = laneOf(bot); const idx = LANE_IDX[bot.ai.role] ?? 1; let best = null, bp = -1;
  for (const m of G.minions) { if (!m.alive || m.team !== bot.team || m.laneIdx !== idx) continue; const p = fwd(bot, laneProgress(m.pos.x, m.pos.z, lane.waypoints)); if (p > bp) { bp = p; best = m; } }
  if (best) return { x: best.pos.x, z: best.pos.z, hasMinions: true, prog: bp };
  // không có lính: đứng sau trụ ngoài cùng còn sống
  let tw = null; for (const t of G.towers) if (t.kind === 'tower' && t.alive && t.team === bot.team && t.lane === lane.type && (!tw || t.order < tw.order)) tw = t;
  if (tw) { const b = BASE_INFO[bot.team]; const dx = b.x - tw.pos.x, dz = b.z - tw.pos.z, l = Math.hypot(dx, dz) || 1; return { x: tw.pos.x + dx / l * 4, z: tw.pos.z + dz / l * 4, hasMinions: false }; }
  const b = BASE_INFO[bot.team]; return { x: b.spawn.x, z: b.spawn.z, hasMinions: false };
}
function enemyTowerThreat(bot, G, pos) {
  for (const t of G.towers) { if (t.kind !== 'tower' || !t.alive || t.team === bot.team) continue; if (Math.hypot(t.pos.x - pos.x, t.pos.z - pos.z) < t.stats.range + 1.5) return t; }
  return null;
}
function moveToward(bot, x, z) { if (hasLOS(bot.pos.x, bot.pos.z, x, z)) { steerTo(bot, x, z); } else goTo(bot, x, z); }
function shop(bot) {
  const kind = BUILD_OF[bot.def.id] || 'atk'; const list = BUILDS[kind];
  for (let n = 0; n < 4; n++) { let bought = false; for (const id of list) { const it = ITEMS.find((i) => i.id === id); if (bot.items.some((x) => x.id === id) || bot.items.length >= 6) continue; if (bot.gold >= it.cost) { buyItem(bot, id); bought = true; } break; } if (!bought) break; }
}
function nextItemCost(bot) { const list = BUILDS[BUILD_OF[bot.def.id] || 'atk']; for (const id of list) if (!bot.items.some((x) => x.id === id)) return ITEMS.find((i) => i.id === id).cost; return 99999; }

// ----- Nhiệm vụ đội: Rồng / Tà Thần -----
export function updateTeamObjectives(G) {
  G.objective = G.objective || [null, null];
  for (const team of [0, 1]) {
    const mates = G.heroes.filter((h) => h.team === team && h.alive); G.objective[team] = null;
    if (mates.length < 3) continue; const avg = mates.reduce((s, h) => s + h.level, 0) / mates.length;
    const cand = G.camps.filter((c) => c.monster && c.monster.alive && (c.type === 'dragon' || c.type === 'baron') && (c.type === 'dragon' ? avg >= 6 : avg >= 9));
    if (cand.length) G.objective[team] = cand.sort((a, b) => (a.type === 'baron' ? -1 : 1))[0];
  }
}

// ============================================================
// updateBot(bot, G, dt)
// ============================================================
export function updateBot(bot, G, dt) {
  if (!bot.alive) { if (bot.ai) { bot.ai.state = 'IDLE'; bot.ai.target = null; } return; }
  const ai = bot.ai; const diff = DIFF[G.difficulty]; ai.t -= dt; ai.castT -= dt;
  if (ai.t <= 0) { ai.t = diff.think * (0.8 + Math.random() * 0.4); think(bot, G, diff); }
  act(bot, G, diff, dt);
  // chống kẹt: nếu muốn di chuyển mà không nhúc nhích >1.5s thì tính lại đường
  if (bot.moving) { ai.stuckT = Math.hypot(bot.pos.x - ai.lastPos.x, bot.pos.z - ai.lastPos.z) < 0.02 ? ai.stuckT + dt : 0; } ai.lastPos.copy(bot.pos);
  if (ai.stuckT > 1.5) { ai.stuckT = 0; bot.pathT = 0; bot.goal = null; if (ai.goal) goTo(bot, ai.goal.x, ai.goal.z, true); }
}

function think(bot, G, diff) {
  const ai = bot.ai; const hpR = bot.hp / bot.maxHp; const role = ai.role; const team = bot.team;
  // mua đồ khi ở nhà
  if (bot.inBase) shop(bot);
  const visHeroes = G.heroes.filter((h) => h.team !== team && h.alive && canSee(team, h) && dist(h.pos, bot.pos) < diff.vision);
  const nearE = visHeroes.filter((h) => dist(h.pos, bot.pos) < 15).sort((a, b) => dist(a.pos, bot.pos) - dist(b.pos, bot.pos));
  const allies = G.heroes.filter((h) => h !== bot && h.team === team && h.alive && dist(h.pos, bot.pos) < 18);
  const danger = nearE.length > allies.length + 1 || (nearE.length && hpR < 0.4);
  const now = G.time;
  // trạng thái sau khi về nhà: nghỉ cho đến khi đầy máu
  if (ai.state === 'RECALL') {
    if (bot.inBase) { ai.state = 'IDLE'; }
    else if (nearE.length || now - bot.lastDmgT < 1.2) { ai.state = 'RETREAT'; cancelRecall(bot); }
    return;
  }
  if (ai.state === 'IDLE' && bot.inBase && (hpR < 0.92 || bot.mana < bot.maxMana * 0.7)) { ai.target = null; ai.goal = null; stop(bot); return; }
  // RETREAT
  if (hpR < 0.28 || (hpR < 0.45 && nearE.length) || danger) {
    if (ai.state !== 'RETREAT') ai.state = 'RETREAT'; ai.target = null;
    const b = BASE_INFO[team]; ai.goal = { x: b.spawn.x, z: b.spawn.z };
    // nếu có trụ đồng đội gần: lùi về sau trụ
    let tw = null, bd = 1e9; for (const t of G.towers) if (t.kind === 'tower' && t.alive && t.team === team) { const d = dist(t.pos, bot.pos); const toBase = dist(t.pos, b); if (toBase < dist(bot.pos, b) && d < bd) { bd = d; tw = t; } }
    if (tw && hpR > 0.3) { const dx = b.x - tw.pos.x, dz = b.z - tw.pos.z, l = Math.hypot(dx, dz) || 1; ai.goal = { x: tw.pos.x + dx / l * 3, z: tw.pos.z + dz / l * 3 }; }
    if (!nearE.length && now - bot.lastDmgT > 2 && hpR < 0.55 && !bot.inBase) { ai.state = 'RECALL'; stop(bot); startRecall(bot); }
    return;
  }
  if (ai.state === 'RETREAT') { if (hpR > 0.6 || bot.inBase) ai.state = 'FARM'; else { return; } }
  // quay về mua đồ khi đủ tiền
  if (!bot.inBase && bot.gold >= nextItemCost(bot) + 300 && bot.items.length < 6 && !nearE.length && now - bot.lastDmgT > 3 && hpR < 0.9 || (!bot.inBase && bot.gold > 2600 && bot.items.length < 6 && !nearE.length)) { ai.state = 'RECALL'; stop(bot); startRecall(bot); return; }
  // DEFEND: trụ/nexus nhà bị đánh
  let defendT = null;
  for (const t of G.towers) { if (!t.alive || t.team !== team) continue; if (now - (t.hitT || -99) < 3 && dist(t.pos, bot.pos) < (role === 'jungle' ? 90 : 55)) { defendT = t; break; } }
  if (defendT) {
    const foe = G.units.filter((u) => u.alive && u.team !== team && u.team !== 2 && dist(u.pos, defendT.pos) < 20 && canSee(team, u)).sort((a, b) => (a.kind === 'hero' ? -1 : 0) - (b.kind === 'hero' ? -1 : 0) || dist(a.pos, bot.pos) - dist(b.pos, bot.pos))[0];
    if (foe && (hpR > 0.4)) { ai.state = 'DEFEND'; ai.target = foe; ai.goal = { x: foe.pos.x, z: foe.pos.z }; return; }
  }
  // ATTACK: kẻ địch gần
  const engage = 9 + diff.skill * 4;
  const prey = nearE.find((h) => dist(h.pos, bot.pos) < engage && (!enemyTowerThreat(bot, G, h.pos) || h.hp / h.maxHp < 0.3 || G.time > 600));
  if (prey && hpR > 0.4) { ai.state = 'ATTACK'; ai.target = prey; ai.goal = { x: prey.pos.x, z: prey.pos.z }; return; }
  if (ai.state === 'ATTACK' || ai.state === 'DEFEND') { ai.state = 'FARM'; ai.target = null; }
  // Mục tiêu đội
  const obj = G.objective && G.objective[team];
  if (obj && obj.monster && obj.monster.alive && hpR > 0.55) { ai.state = 'OBJECTIVE'; ai.goal = { x: obj.x - (team === 0 ? 3 : -3), z: obj.z }; ai.target = dist(bot.pos, obj.monster.pos) < 12 ? obj.monster : null; return; }
  // JUNGLE
  if (role === 'jungle' && (G.time < 420 || bot.level < 8)) {
    ai.state = 'JUNGLE'; const camps = G.camps.filter((c) => c.team === team && c.monster && c.monster.alive);
    camps.sort((a, b) => dist(a, bot.pos) - dist(b, bot.pos)); const c = camps[0];
    if (c) { ai.goal = { x: c.x - (team === 0 ? 2 : -2), z: c.z }; ai.target = dist(bot.pos, c.monster.pos) < 11 ? c.monster : null; return; }
    // đã dọn xong: gank đường có địch hoặc về đường giữa
    const gank = visHeroes.find((h) => h.hp / h.maxHp < 0.7);
    if (gank && hpR > 0.65) { ai.state = 'ATTACK'; ai.target = gank; ai.goal = { x: gank.pos.x, z: gank.pos.z }; return; }
    ai.goal = { x: bot.team === 0 ? -35 : 35, z: bot.team === 0 ? 35 : -35 }; ai.target = null; return;
  }
  // FARM
  ai.state = 'FARM';
  const r = role === 'jungle' ? 'mid' : role; ai.role2 = r; const saveRole = ai.role; ai.role = r === 'jungle' ? 'mid' : r; const anc = laneAnchor(bot, G); ai.role = saveRole;
  // support: đi theo xạ thủ
  if ((bot.def.id === 'truongan' || bot.def.id === 'thaonhi') && role === 'bot') {
    const adc = G.heroes.find((h) => h !== bot && h.team === team && h.alive && h.ai && h.ai.role === 'bot' && !(h.def.id === 'truongan' || h.def.id === 'thaonhi'));
    if (adc && dist(adc.pos, bot.pos) > 3.5) { ai.goal = { x: adc.pos.x - (team === 0 ? 2 : -2), z: adc.pos.z + (team === 0 ? 2 : -2) }; }
  } else ai.goal = { x: anc.x, z: anc.z };
  // chọn mục tiêu farm: lính/quái/trụ trong tầm
  const reach = bot.stats.range + 3.5; let best = null, bs = 1e9;
  for (const u of G.units) {
    if (!u.alive || u.team === team || !isTargetable(u) || !canSee(team, u)) continue; if (u.kind === 'hero') continue;
    if (u.kind === 'monster' && role !== 'jungle') continue;
    if ((u.kind === 'tower' || u.kind === 'nexus') && !(anc.hasMinions && G.minions.some((m) => m.alive && m.team === team && dist(m.pos, u.pos) < 9) || G.time > 700)) continue;
    const d = dist(u.pos, bot.pos) - u.radius; if (d > reach) continue; const s = d + (u.hp / u.maxHp) * 4 - (u.hp < bot.stats.atk * 1.2 ? 6 : 0) + (u.kind === 'tower' ? 3 : 0); if (s < bs) { bs = s; best = u; }
  }
  ai.target = best;
  // đẩy nexus khi các trụ nhà đã sập
  if (!best && G.time > 480) { const nx = G.nexus[1 - team]; if (nx && isTargetable(nx) && anc.hasMinions) { ai.goal = { x: nx.pos.x, z: nx.pos.z }; ai.target = dist(nx.pos, bot.pos) < reach + 4 ? nx : null; } }
}

function act(bot, G, diff, dt) {
  const ai = bot.ai; const st = ai.state;
  if (st === 'RECALL') { stop(bot); if (bot.recallT <= 0 && !bot.inBase) startRecall(bot); return; }
  if (st === 'IDLE') { return; }
  if (st === 'RETREAT') {
    if (ai.goal) moveToward(bot, ai.goal.x, ai.goal.z);
    if (bot.hp / bot.maxHp < 0.35 && bot.healCd <= 0 && Math.random() < dt * 2) useHealSpell(bot);
    aiCast(bot, G, diff, null, true); return;
  }
  const t = ai.target;
  if (t && (!t.alive || !canSee(bot.team, t) && t.kind === 'hero' && dist(t.pos, bot.pos) > 8)) { ai.target = null; }
  const tg = ai.target;
  if (tg && tg.alive) {
    if (inAttackRange(bot, tg)) { stop(bot); faceTo(bot, tg.pos.x, tg.pos.z); tryAttack(bot, tg); }
    else moveToward(bot, tg.pos.x, tg.pos.z);
    if (tg.kind === 'hero' || tg.kind === 'monster' && (tg.mtype === 'dragon' || tg.mtype === 'baron')) aiCast(bot, G, diff, tg, false);
    else if (st === 'FARM' || st === 'JUNGLE') aiCast(bot, G, diff, null, false, tg);
  } else if (ai.goal) {
    if (dist(bot.pos, ai.goal) > 2.5) moveToward(bot, ai.goal.x, ai.goal.z); else { stop(bot); }
    // đánh tướng địch trong tầm khi đi đường (poke)
    const poke = G.heroes.find((h) => h.team !== bot.team && h.alive && canSee(bot.team, h) && inAttackRange(bot, h));
    if (poke && (bot.stats.range > 4 || st === 'FARM')) { tryAttack(bot, poke); aiCast(bot, G, diff, poke, false); }
  }
  // dùng hồi máu khi thấp
  if (bot.hp / bot.maxHp < 0.4 && bot.healCd <= 0 && G.heroes.some((h) => h.team !== bot.team && h.alive && dist(h.pos, bot.pos) < 14)) useHealSpell(bot);
}

// Dùng skill theo thẻ `ai` của từng skill
function aiCast(bot, G, diff, target, escaping, farmTarget) {
  const ai = bot.ai; if (ai.castT > 0 || bot.stunT > 0) return;
  const team = bot.team; const noise = (1 - diff.aim) * 3.5;
  const enemiesH = G.heroes.filter((h) => h.team !== team && h.alive && canSee(team, h) && dist(h.pos, bot.pos) < 22);
  const nearest = enemiesH.sort((a, b) => dist(a.pos, bot.pos) - dist(b.pos, bot.pos))[0];
  for (const i of [3, 2, 1, 0]) {
    const sk = bot.def.skills[i]; if (skillLevel(bot, i) <= 0 || bot.cd[i] > 0 || bot.mana < sk.mana) continue;
    if (Math.random() > diff.skill) continue;
    let aim = null; const tg = target && target.alive ? target : null;
    switch (sk.ai) {
      case 'atk': {
        const tt = tg || (farmTarget && sk.kind === 'proj' && farmTarget.hp > bot.stats.atk * 3 ? null : null); if (!tt) break;
        const d = dist(tt.pos, bot.pos); const reach = sk.kind === 'dash' ? sk.range + 2 : sk.kind === 'proj' ? sk.range * 0.92 : (sk.range || 4);
        if (d > reach) break; if (sk.kind === 'dash' && (d < 3.2 || sk.dir === 'back')) break;
        if ((sk.kind === 'mark' || sk.kind === 'strike' || sk.kind === 'teleport') && tt.kind !== 'hero' && sk.kind !== 'strike') break;
        aim = { x: tt.pos.x + (Math.random() - 0.5) * noise, z: tt.pos.z + (Math.random() - 0.5) * noise }; break;
      }
      case 'self': {
        const r = (sk.radius || 5) + 1.5; const near = G.units.filter((u) => u.alive && u.team !== team && (u.kind !== 'tower' && u.kind !== 'nexus') && dist(u.pos, bot.pos) < r && canSee(team, u));
        const heroNear = near.some((u) => u.kind === 'hero'); if (!heroNear && near.length < 3) break;
        const e = near.find((u) => u.kind === 'hero') || near[0]; aim = { x: e.pos.x, z: e.pos.z }; break;
      }
      case 'ally': {
        const need = G.heroes.filter((h) => h.team === team && h.alive && h.hp / h.maxHp < 0.7 && dist(h.pos, bot.pos) < (sk.range || 10)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const poke = tg && sk.kind !== 'buff' && dist(tg.pos, bot.pos) < sk.range;
        if (need) aim = { x: need.pos.x, z: need.pos.z }; else if (poke) aim = { x: tg.pos.x, z: tg.pos.z }; break;
      }
      case 'escape': {
        if (!escaping || !nearest || dist(nearest.pos, bot.pos) > 10) break;
        if (sk.kind === 'wall') aim = { x: nearest.pos.x, z: nearest.pos.z }; else aim = { x: bot.pos.x * 2 - nearest.pos.x, z: bot.pos.z * 2 - nearest.pos.z }; break;
      }
      case 'ult': {
        if (!tg) { if (sk.kind === 'revive') { if (G.heroes.some((h) => h.team === team && !h.alive && h !== bot && h.deathPos) || G.heroes.filter((h) => h.team === team && h.alive && h.hp / h.maxHp < 0.5 && dist(h.pos, bot.pos) < 12).length >= 2) aim = { x: bot.pos.x, z: bot.pos.z }; break; } if (sk.kind === 'buff' && nearest && dist(nearest.pos, bot.pos) < 11 && bot.hp / bot.maxHp < 0.55) aim = { x: nearest.pos.x, z: nearest.pos.z }; break; }
        const d = dist(tg.pos, bot.pos); const reach = sk.kind === 'teleport' ? sk.range : (sk.range || sk.radius || 6) * 0.92;
        const cluster = enemiesH.filter((h) => dist(h.pos, bot.pos) < reach).length;
        const finish = tg.hp / tg.maxHp < 0.55 || cluster >= 2 || tg.kind === 'monster'; if (!finish || d > Math.max(reach, sk.radius || 0) + 1) break;
        if (sk.kind === 'buff' && sk.radius > 0 && cluster < 2) break;
        aim = { x: tg.pos.x, z: tg.pos.z }; break;
      }
      default: break;
    }
    if (aim && castSkill(bot, i, aim)) { ai.castT = 0.25 + Math.random() * 0.35; return; }
  }
}

export function debugPick() { return pick; }
export { rand, enemiesInRadius };
