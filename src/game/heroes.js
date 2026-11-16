// ============================================================
// heroes.js — DỮ LIỆU 10 TƯỚNG + MODEL 3D LOW-POLY (ghép primitive) + ANIMATION
// Mỗi tướng: look (ngoại hình), stats, 4 skill (Q,W,E,R) mô tả bằng dữ liệu —
// skills.js đọc `kind` để dựng hiệu ứng 3D tương ứng.
// ============================================================
import * as THREE from 'three';

// ---------- DỮ LIỆU TƯỚNG ----------
// kind skill: proj | area | dash | buff | mark | strike | teleport | wall | trap | meteor | stealth | drone | multihit | grab | zone | revive
export const HEROES = [
  {
    id: 'binhan', name: 'BÌNH AN', role: 'Đấu sĩ / Đỡ đòn', diff: 1, height: 1.9, cost: 0, palette: ['#d4a017', '#8b6914', '#c0c0c0', '#e0e0e0', '#5a3a14'],
    blurb: 'Hộ vệ giáp vàng-đồng, khiên tròn che chở đồng đội.',
    stats: { hp: 1750, hpLv: 150, mana: 350, atk: 62, atkLv: 6, ap: 0, apLv: 0, armor: 38, armorLv: 3, mr: 30, speed: 8.0, range: 2.4, aspd: 1.0, regen: 6 },
    look: { skin: 0xe0b48a, hair: 0x5a3a1a, shirt: 0xd4a017, pants: 0x6b4a1a, armor: 0xd4a017, boots: 0x8b6914, accent: 0xc0c0c0, glow: 0xffd24a, hairStyle: 'short', build: 'broad', pads: true, helmet: 'crest', weaponR: 'sword', weaponL: 'shield', pose: 'melee', atk: 'slash', footRing: 0xffd24a, aura: { color: 0xffd24a, rate: 8, size: 0.35, rise: 0.9 } },
    skills: [
      { key: 'Q', name: 'Lao Vồ Đập', icon: '🔨', kind: 'dash', cd: 9, mana: 50, range: 7, dist: 7, dmg: 105, adR: 0.5, type: 'phys', after: 'slam', slamR: 3.2, up: 0.9, slamDmg: 130, adR2: 0.7, color: 0xffd24a, ai: 'atk', desc: 'Lao thẳng tới 7 unit rồi đập xuống đất: hất tung + sát thương lớn quanh điểm đáp.' },
      { key: 'W', name: 'Vòng Kiếm Thần', icon: '🌀', kind: 'spin', cd: 12, mana: 65, dur: 3.2, radius: 3.2, dmg: 55, adR: 0.4, type: 'phys', slow: [0.45, 1.0], stunEvery: 1.1, stunT: 0.45, spinSpeed: 10, color: 0xffd24a, ai: 'self', desc: 'Thần kiếm quay liên tục 3.2s: gây sát thương + làm chậm, mỗi 1.1s choáng kẻ địch gần.' },
      { key: 'E', name: 'Cưỡi Thần Ngưu', icon: '🐂', kind: 'mount', cd: 16, mana: 70, dur: 6, speedUp: 1.2, dmg: 190, adR: 0.85, type: 'phys', hitR: 1.8, hitCd: 1.2, carryR: 2.4, color: 0xffd24a, ai: 'self', desc: 'Cưỡi bò thần 6s (+120% tốc độ): tự lái, chở theo đồng đội, tông trúng địch gây sát thương lớn + hất văng.' },
      { key: 'R', name: 'Vòng Thánh Quang', icon: '☀️', kind: 'buff', cd: 55, mana: 100, range: 0, radius: 8, allies: true, reduce: [0.3, 3], dur: 3, zone: true, color: 0xfff0a0, ai: 'ult', desc: 'Vòng sáng bán kính 8: đồng đội giảm 30% sát thương 3s.' },
    ],
  },
  {
    id: 'khaikiet', name: 'KHẢI KIỆT', role: 'Sát thủ cận chiến', diff: 3, height: 1.85, cost: 0, palette: ['#1a1a1a', '#cc0000', '#e0e0e0', '#ff2020', '#3a0a0a'],
    blurb: 'Cuồng Bạo Song Kiếm — chuỗi chém liên hoàn, lướt kiếm và kết liễu bằng sát thương chuẩn.',
    stats: { hp: 1450, hpLv: 125, mana: 300, atk: 88, atkLv: 8, ap: 0, apLv: 0, armor: 28, armorLv: 2.6, mr: 28, speed: 8.8, range: 2.2, aspd: 1.15, regen: 5 },
    look: { skin: 0xd8b090, hair: 0xe0e0e0, shirt: 0x1a1a1a, pants: 0x151515, armor: 0x222222, boots: 0x111111, accent: 0xcc0000, glow: 0xff2020, glowEyes: 0xff2020, hairStyle: 'ponytail', build: 'slim', cape: 0x1a1a1a, capeTrim: 0xcc0000, weaponR: 'katar', weaponL: 'katar', pose: 'melee', atk: 'stab', aura: { color: 0x551111, rate: 14, size: 0.7, rise: 0.5 }, smoke: true },
    skills: [
      { key: 'Q', name: 'Kiếm Lưu Ngân', icon: '⚔️', kind: 'combo', cd: 10, mana: 60, range: 0, radius: 2.7, hits: 9, interval: 0.16, lockT: 1.5, finalMul: 1.5, up: 0.8, dmg: 55, adR: 0.25, type: 'phys', color: 0xff2020, reduce: [0.3, 1.6], ai: 'atk', desc: 'Tung 9 nhát chém quanh người, nhát cuối hất tung. Đứng yên khi tung, giảm 30% sát thương nhận vào.' },
      { key: 'W', name: 'Kiếm Toả Mệnh', icon: '🗡️', kind: 'dash', cd: 8, mana: 45, range: 7, dist: 7, dmg: 110, adR: 0.7, type: 'phys', slow: [0.45, 2], root: 0.7, ghost: true, color: 0xcc1010, ai: 'atk', desc: 'Vung kiếm lướt 7 unit, chém địch trên đường: làm chậm 45% và trói chân 0.7s.' },
      { key: 'E', name: 'Kiếm Chú', icon: '🩸', kind: 'buff', cd: 13, mana: 50, range: 0, heal: 150, reduce: [0.25, 3], color: 0xff5040, ai: 'self', desc: 'Hút máu nội tại: hồi 150 máu và giảm 25% sát thương nhận vào trong 3s.' },
      { key: 'R', name: 'Kiếm Tất Sát', icon: '💀', kind: 'exec', cd: 55, mana: 90, range: 8, disappear: 1.5, radius: 3.2, dmg: 280, adR: 1.0, missing: 0.15, type: 'true', color: 0xff1010, ai: 'ult', desc: 'Biến mất khỏi bản đồ, khóa 1 tướng địch gần nhất. Sau 1.5s phóng xuống gây sát thương chuẩn diện rộng.' },
    ],
  },
  {
    id: 'khoa', name: 'KHOA', role: 'Pháp sư khống chế', diff: 2, height: 1.8, cost: 0, palette: ['#4b0082', '#6a5acd', '#9400d3', '#111122', '#c8b6ff'],
    blurb: 'Đạo sĩ băng-tím với gậy pha lê và những cuốn sách bay.',
    stats: { hp: 1300, hpLv: 115, mana: 520, atk: 52, atkLv: 4, ap: 45, apLv: 11, armor: 22, armorLv: 2.2, mr: 26, speed: 8.0, range: 9.5, aspd: 0.9, regen: 5 },
    look: { skin: 0xe6c3a0, hair: 0x15101c, shirt: 0x4b0082, pants: 0x2a0a50, armor: 0x6a5acd, boots: 0x1a1030, accent: 0x9400d3, glow: 0x9400d3, hairStyle: 'long', build: 'normal', robe: true, hood: true, weaponR: 'crystalStaff', pose: 'caster', atk: 'cast', orbit: 'books', aura: { color: 0xa070ff, rate: 7, size: 0.3, rise: 0.8 } },
    skills: [
      { key: 'Q', name: 'Cầu Băng', icon: '🔮', kind: 'proj', cd: 6, mana: 55, range: 16, speed: 22, radius: 0.9, dmg: 110, apR: 0.75, type: 'magic', slow: [0.4, 1.8], explode: 3, color: 0x7fd8ff, ai: 'atk', desc: 'Cầu băng bay thẳng, nổ làm chậm.' },
      { key: 'W', name: 'Phong Ấn', icon: '⛓️', kind: 'area', shape: 'circle', at: 'ground', cd: 10, mana: 70, range: 14, radius: 3.5, delay: 0.55, dmg: 80, apR: 0.5, type: 'magic', root: 1.8, color: 0xa040ff, ai: 'atk', desc: 'Vòng tròn trói tím: giữ chân kẻ địch.' },
      { key: 'E', name: 'Tường Băng', icon: '🧊', kind: 'wall', cd: 14, mana: 80, range: 10, w: 6, d: 1.2, h: 3, dur: 4, color: 0x8fe0ff, ai: 'escape', desc: 'Dựng tường băng chắn đường 4s.' },
      { key: 'R', name: 'Mưa Thiên Thạch', icon: '☄️', kind: 'meteor', cd: 60, mana: 130, range: 16, count: 10, spread: 7, radius: 2.6, dur: 2.2, dmg: 95, apR: 0.45, type: 'magic', color: 0xb060ff, ai: 'ult', desc: '10 thiên thạch tím rơi xuống vùng chỉ định.' },
    ],
  },
  {
    id: 'annie', name: 'ANNIE', role: 'Xạ thủ tầm xa', diff: 2, height: 1.7, cost: 0, palette: ['#ffd700', '#8b4513', '#a0a0a0', '#f5deb3', '#ffa500'],
    blurb: 'Nữ thợ săn tóc xoăn vàng với nỏ cơ khí, bẫy nổ và tia xuyên.',
    stats: { hp: 1250, hpLv: 105, mana: 400, atk: 100, atkLv: 8.5, ap: 0, apLv: 0, armor: 22, armorLv: 2.2, mr: 22, speed: 8.0, range: 11.5, aspd: 1.2, regen: 4.5 },
    look: { skin: 0xf0c8a0, hair: 0xffd700, shirt: 0x8b4513, pants: 0x4a2c12, armor: 0x6b3a14, boots: 0x3a2410, accent: 0xa0a0a0, glow: 0xffb020, hairStyle: 'curly', build: 'slim', female: true, hat: 'fur', weaponR: 'crossbow', pose: 'ranged', atk: 'shoot', scarf: 0xcc7a2a },
    skills: [
      { key: 'Q', name: 'Bắn Tỉa', icon: '🎯', kind: 'proj', cd: 6, mana: 50, range: 22, speed: 42, radius: 0.6, dmg: 150, adR: 1.0, type: 'phys', size: 0.22, stretch: 4, color: 0xffd23d, ai: 'atk', desc: 'Mũi tên xuyên nhanh, vệt vàng.' },
      { key: 'W', name: 'Bẫy Nổ', icon: '💣', kind: 'trap', cd: 11, mana: 55, range: 10, radius: 3.5, trigger: 2.6, dur: 20, dmg: 130, adR: 0.6, type: 'phys', root: 1, color: 0xffa020, ai: 'atk', desc: 'Đặt bẫy, nổ khi địch tới gần.' },
      { key: 'E', name: 'Lùi & Bắn', icon: '💨', kind: 'dash', dir: 'back', cd: 9, mana: 40, range: 8, dist: 5, dmg: 80, adR: 0.5, type: 'phys', after: 'shot', color: 0xffd23d, ai: 'escape', desc: 'Lùi về sau 5 unit rồi bắn phát đạn.' },
      { key: 'R', name: 'Xuyên Phá', icon: '☄️', kind: 'area', shape: 'line', at: 'self', cd: 50, mana: 100, range: 30, length: 30, width: 2.4, delay: 0.25, dmg: 280, adR: 1.3, type: 'phys', color: 0xff9a1a, ai: 'ult', desc: 'Tia laser vàng-cam xuyên mọi mục tiêu.' },
    ],
  },
  {
    id: 'truongan', name: 'TRƯỜNG AN', role: 'Trợ thủ', diff: 2, height: 1.75, cost: 0, palette: ['#fffacd', '#ffd700', '#f0f0f0', '#fff8dc', '#8aff9a'],
    blurb: 'Thiên thần nhỏ chữa lành, tăng tốc và hồi sinh đồng đội.',
    stats: { hp: 1350, hpLv: 115, mana: 520, atk: 48, atkLv: 4, ap: 50, apLv: 10, armor: 24, armorLv: 2.3, mr: 28, speed: 8.2, range: 8.5, aspd: 0.9, regen: 6 },
    look: { skin: 0xf5d2b0, hair: 0xf0f0f0, shirt: 0xfffacd, pants: 0xf0e0a0, armor: 0xffd700, boots: 0xffe9a0, accent: 0xffd700, glow: 0xfff8dc, hairStyle: 'long', build: 'slim', female: true, robe: true, wings: 0xffffff, weaponR: 'scepter', pose: 'caster', atk: 'cast', orbit: 'orbs', aura: { color: 0x8aff9a, rate: 9, size: 0.3, rise: 0.8 } },
    skills: [
      { key: 'Q', name: 'Ánh Sáng Chữa Lành', icon: '💚', kind: 'buff', target: 'lowAlly', cd: 5, mana: 60, range: 13, radius: 0, heal: 130, apR: 0.7, color: 0x6dff8a, ai: 'ally', desc: 'Hồi máu đồng đội yếu nhất trong tầm.' },
      { key: 'W', name: 'Gió Thần', icon: '🍃', kind: 'buff', cd: 12, mana: 60, range: 0, radius: 9, allies: true, speed: [0.35, 3], dur: 3, color: 0x7dffb0, ai: 'self', desc: 'Tăng tốc đồng đội quanh bạn 35% trong 3s.' },
      { key: 'E', name: 'Màn Chắn', icon: '🫧', kind: 'buff', target: 'lowAlly', cd: 10, mana: 55, range: 11, radius: 0, shield: 150, apR: 0.6, dur: 3, color: 0xc8f4ff, ai: 'ally', desc: 'Bọc đồng đội bằng cầu khiên trong suốt.' },
      { key: 'R', name: 'Hồi Sinh', icon: '👼', kind: 'revive', cd: 90, mana: 140, range: 0, radius: 12, heal: 220, apR: 0.8, color: 0xfff0a0, ai: 'ult', desc: 'Hồi sinh đồng đội đã ngã (gần nhất) bằng cột sáng. Nếu không có: hồi máu diện rộng.' },
    ],
  },
  {
    id: 'dat', name: 'ĐẠT', role: 'Đấu sĩ đa năng', diff: 2, height: 1.85, cost: 600, palette: ['#daa520', '#8b4513', '#4a4a4a', '#ff4500', '#1a1008'],
    blurb: 'Võ sĩ giáp da hổ, nắm đấm lửa, tung cú quăng định mệnh.',
    stats: { hp: 1650, hpLv: 140, mana: 320, atk: 80, atkLv: 7, ap: 0, apLv: 0, armor: 34, armorLv: 3, mr: 30, speed: 8.3, range: 2.3, aspd: 1.05, regen: 6 },
    look: { skin: 0xd9a073, hair: 0x15100a, shirt: 0xdaa520, pants: 0x5a3010, armor: 0xdaa520, boots: 0x3a2410, accent: 0x4a4a4a, glow: 0xff4500, hairStyle: 'messy', build: 'broad', stripes: 0x2a1608, shirtless: true, weaponR: 'fist', weaponL: 'fist', pose: 'fist', atk: 'punch', aura: { color: 0xff4500, rate: 6, size: 0.3, rise: 0.8 } },
    skills: [
      { key: 'Q', name: 'Phi Thân Đấm', icon: '👊', kind: 'dash', cd: 8, mana: 45, range: 6, dist: 6, dmg: 110, adR: 0.7, type: 'phys', up: 0.8, color: 0xff6a20, ai: 'atk', desc: 'Lao tới đấm hất tung.' },
      { key: 'W', name: 'Liên Hoàn Quyền', icon: '🥊', kind: 'multihit', cd: 7, mana: 50, range: 3, hits: 3, interval: 0.2, radius: 3.4, step: 0.8, dmg: 60, adR: 0.4, type: 'phys', color: 0xff6a20, ai: 'self', desc: '3 cú đấm nhanh phía trước.' },
      { key: 'E', name: 'Cước Xoay', icon: '🌪️', kind: 'area', shape: 'circle', at: 'self', cd: 9, mana: 55, range: 0, radius: 4.6, dmg: 130, adR: 0.6, type: 'phys', slow: [0.3, 1.5], color: 0xff6a20, ai: 'self', desc: 'Đá xoay vòng, làm chậm.' },
      { key: 'R', name: 'Quăng Thần', icon: '🤼', kind: 'grab', cd: 55, mana: 100, range: 6, throwDist: 8, dmg: 280, adR: 1.0, type: 'phys', stun: 1, color: 0xff4500, ai: 'ult', desc: 'Tóm đối thủ gần nhất, nhấc lên rồi ném.' },
    ],
  },
  {
    id: 'leanh', name: 'LÊ ANH', role: 'Sát thủ rừng', diff: 3, height: 1.75, cost: 800, palette: ['#006400', '#0a1a10', '#8a2be2', '#222222', '#b080ff'],
    blurb: 'Bóng ma rừng xanh, tàng hình, ám sát sau lưng.',
    stats: { hp: 1400, hpLv: 120, mana: 300, atk: 86, atkLv: 8, ap: 0, apLv: 0, armor: 26, armorLv: 2.5, mr: 26, speed: 9.0, range: 2.1, aspd: 1.25, regen: 5 },
    look: { skin: 0xe4be9a, hair: 0x101015, shirt: 0x0c2a1a, pants: 0x0a1a10, armor: 0x006400, boots: 0x111111, accent: 0x8a2be2, glow: 0x8a2be2, hairStyle: 'ponytail', build: 'slim', female: true, mask: true, scarf: 0x006400, weaponR: 'dagger', weaponL: 'dagger', pose: 'melee', atk: 'stab', aura: { color: 0x8a2be2, rate: 12, size: 0.6, rise: 0.4 }, smoke: true },
    skills: [
      { key: 'Q', name: 'Ẩn Thân', icon: '👻', kind: 'stealth', cd: 12, mana: 40, range: 0, dur: 4, speed: [0.15, 4], color: 0x8a2be2, ai: 'escape', desc: 'Tàng hình 4s (mờ 30%), chạy nhanh hơn; đòn đầu mạnh hơn.' },
      { key: 'W', name: 'Ám Sát Sau Lưng', icon: '🗡️', kind: 'strike', cd: 6, mana: 40, range: 4.5, dmg: 130, adR: 0.8, back: 0.5, type: 'phys', color: 0x8a2be2, ai: 'atk', desc: 'Đâm mục tiêu gần; +50% sát thương nếu đánh từ sau lưng.' },
      { key: 'E', name: 'Lướt', icon: '💫', kind: 'dash', cd: 7, mana: 35, range: 5, dist: 5, dmg: 60, adR: 0.4, type: 'phys', slow: [0.3, 1.2], color: 0xa050ff, ghost: true, ai: 'atk', desc: 'Lướt ngắn, để lại vệt tím.' },
      { key: 'R', name: 'Tuyệt Sát', icon: '⚡', kind: 'teleport', cd: 50, mana: 90, range: 16, dmg: 240, adR: 1.0, missing: 0.35, type: 'phys', pick: 'lowhp', color: 0xb060ff, ai: 'ult', desc: 'Dịch chuyển tới kẻ địch yếu nhất và kết liễu.' },
    ],
  },
  {
    id: 'tung', name: 'TÙNG', role: 'Xạ thủ / Pháp sư lai', diff: 2, height: 1.8, cost: 900, palette: ['#32cd32', '#1a5a2a', '#9aff9a', '#222a30', '#00ffaa'],
    blurb: 'Kỹ sư công nghệ với súng năng lượng và drone chi viện.',
    stats: { hp: 1300, hpLv: 110, mana: 450, atk: 90, atkLv: 8, ap: 20, apLv: 6, armor: 22, armorLv: 2.2, mr: 24, speed: 8.2, range: 10, aspd: 1.15, regen: 4.5 },
    look: { skin: 0xe6c09c, hair: 0x32cd32, shirt: 0x32cd32, pants: 0x222a30, armor: 0x2a3a40, boots: 0x1a1a1a, accent: 0x00ffaa, glow: 0x00ffaa, hairStyle: 'spiky', build: 'normal', hood: true, goggles: true, weaponR: 'gun', pose: 'ranged', atk: 'shoot', orbit: 'drone', aura: { color: 0x00ffaa, rate: 8, size: 0.25, rise: 0.8 } },
    skills: [
      { key: 'Q', name: 'Tia Năng Lượng', icon: '⚡', kind: 'proj', cd: 5, mana: 45, range: 17, speed: 34, radius: 0.6, dmg: 120, adR: 0.8, apR: 0.3, type: 'phys', size: 0.28, stretch: 2.5, color: 0x3dff9a, ai: 'atk', desc: 'Tia xanh tốc độ cao.' },
      { key: 'W', name: 'Drone Chi Viện', icon: '🛸', kind: 'drone', cd: 14, mana: 60, range: 0, dur: 8, interval: 0.6, dmg: 40, adR: 0.25, type: 'phys', color: 0x00ffaa, ai: 'self', desc: 'Drone bay theo, tự bắn kẻ địch gần 8s.' },
      { key: 'E', name: 'Lướt Điện', icon: '🌩️', kind: 'dash', cd: 9, mana: 45, range: 5, dist: 5, dmg: 70, adR: 0.4, type: 'magic', after: 'slowAoe', afterR: 3.6, slow: [0.5, 1.6], color: 0x00ffaa, ghost: true, ai: 'escape', desc: 'Lướt tới, làm chậm 50% kẻ địch quanh điểm đến.' },
      { key: 'R', name: 'Laser Quét', icon: '🔆', kind: 'area', shape: 'cone', at: 'self', sweep: true, cd: 55, mana: 110, range: 14, length: 15, angle: 90, delay: 0.1, dmg: 270, adR: 0.9, apR: 0.5, type: 'phys', color: 0x30ff80, ai: 'ult', desc: 'Quét tia laser xanh 90° phía trước.' },
    ],
  },
  {
    id: 'tuan', name: 'TUẤN', role: 'Đỡ đòn thuần', diff: 1, height: 2.0, cost: 0, palette: ['#696969', '#2f4f4f', '#a9a9a9', '#808080', '#3a3a3a'],
    blurb: 'Gã khổng lồ giáp sắt, khiên tháp và búa chiến.',
    stats: { hp: 2100, hpLv: 170, mana: 300, atk: 62, atkLv: 5, ap: 0, apLv: 0, armor: 50, armorLv: 4, mr: 40, speed: 7.8, range: 2.4, aspd: 0.85, regen: 8 },
    look: { skin: 0xc99a72, hair: 0x000000, shirt: 0x2f4f4f, pants: 0x3a3a3a, armor: 0x696969, boots: 0x2f2f2f, accent: 0xa9a9a9, glow: 0xb0c4de, hairStyle: 'bald', build: 'huge', pads: true, beard: 0x2a1a10, helmet: 'none', weaponR: 'hammer', weaponL: 'towerShield', pose: 'melee', atk: 'slash', footRing: 0x808080, aura: { color: 0x909090, rate: 14, size: 0.7, rise: 0.4 } },
    skills: [
      { key: 'Q', name: 'Húc Tường', icon: '🏹', kind: 'dash', cd: 9, mana: 50, range: 7, dist: 7, dmg: 100, adR: 0.5, type: 'phys', knock: 4, stun: 0.4, color: 0xb0b0b0, ai: 'atk', desc: 'Lao dài, đẩy lùi địch.' },
      { key: 'W', name: 'Tường Đá', icon: '🧱', kind: 'wall', cd: 14, mana: 60, range: 4, w: 5.5, d: 1.4, h: 2.8, dur: 5, color: 0x8d8d8d, stone: true, ai: 'escape', desc: 'Dựng tường đá chắn đường 5s.' },
      { key: 'E', name: 'Búa Giáng', icon: '🔨', kind: 'area', shape: 'cone', at: 'self', cd: 8, mana: 55, range: 0, length: 6.5, angle: 120, delay: 0.15, dmg: 160, adR: 0.7, type: 'phys', stun: 0.6, color: 0xc0c0c0, ai: 'self', desc: 'Đập búa vào vùng quạt phía trước, gây choáng.' },
      { key: 'R', name: 'Pháo Đài Bất Diệt', icon: '🏰', kind: 'buff', cd: 70, mana: 100, range: 0, radius: 0, immune: 3, dur: 3, color: 0xc0c8d0, ai: 'ult', desc: 'Miễn nhiễm sát thương 3s, phát sáng xám.' },
    ],
  },
  {
    id: 'thaonhi', name: 'THẢO NHI', role: 'Trợ thủ / Đạo sĩ rừng', diff: 2, height: 1.7, cost: 700, palette: ['#3fae5a', '#f4a6c8', '#2a6b3a', '#fff0c8', '#ff7ab0'],
    blurb: 'Thiếu nữ rừng xanh điều khiển dây leo và suối sinh mệnh.',
    stats: { hp: 1300, hpLv: 112, mana: 520, atk: 46, atkLv: 4, ap: 55, apLv: 10, armor: 22, armorLv: 2.2, mr: 28, speed: 8.2, range: 8.5, aspd: 0.9, regen: 6 },
    look: { skin: 0xf2cfa8, hair: 0x2f9a4a, shirt: 0x3fae5a, pants: 0x2a6b3a, armor: 0xf4a6c8, boots: 0x6a4a2a, accent: 0xff7ab0, glow: 0xff7ab0, hairStyle: 'long', build: 'slim', female: true, hat: 'leaf', weaponR: 'flowerStaff', pose: 'caster', atk: 'cast', orbit: 'petals', aura: { color: 0xff9acb, rate: 9, size: 0.3, rise: 0.7 } },
    skills: [
      { key: 'Q', name: 'Gai Độc', icon: '🌹', kind: 'proj', cd: 5, mana: 50, range: 15, speed: 26, radius: 0.8, dmg: 90, apR: 0.6, type: 'magic', slow: [0.3, 1.8], size: 0.3, stretch: 2, color: 0xff7ab0, ai: 'atk', desc: 'Gai nhọn bay thẳng, làm chậm.' },
      { key: 'W', name: 'Suối Sinh Mệnh', icon: '⛲', kind: 'zone', cd: 14, mana: 70, range: 12, radius: 4.5, dur: 4, tick: 0.5, heal: 28, apR: 0.15, ally: true, color: 0x7dff9a, ai: 'ally', desc: 'Vùng hồi máu đồng đội đứng trong suốt 4s.' },
      { key: 'E', name: 'Dây Leo Trói', icon: '🌿', kind: 'area', shape: 'circle', at: 'ground', cd: 10, mana: 65, range: 13, radius: 3.2, delay: 0.4, dmg: 70, apR: 0.5, type: 'magic', root: 1.5, color: 0x4fd060, ai: 'atk', desc: 'Dây leo trồi lên giữ chân kẻ địch.' },
      { key: 'R', name: 'Rừng Thiêng', icon: '🌳', kind: 'area', shape: 'circle', at: 'self', cd: 60, mana: 130, range: 0, radius: 11, dmg: 120, apR: 0.5, type: 'magic', slow: [0.3, 2], healAlly: 220, speedAlly: [0.25, 3], color: 0x66ff88, ai: 'ult', desc: 'Hồi máu + tăng tốc đồng đội, làm chậm & gây sát thương địch.' },
    ],
  },
];
export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

// ============================================================
// MODEL 3D — dựng bằng primitive (box/cylinder/sphere/cone), kích thước chuẩn hoá 1.8 unit rồi scale theo height
// ============================================================
export function buildHeroModel(def) {
  const L = def.look; const root = new THREE.Group(); const allMats = []; const cache = new Map();
  const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!cache.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0, flatShading: true, ...o }); cache.set(k, m); allMats.push(m); } return cache.get(k); };
  const glowM = (c, i = 1.6) => mat(c, { emissive: c, emissiveIntensity: i, roughness: 0.3 });
  const metal = (c) => mat(c, { metalness: 0.7, roughness: 0.35 });
  const glowMats = [];
  const part = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, shadow = true) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = shadow; parent.add(me); return me; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s), S = (r, s = 10) => new THREE.SphereGeometry(r, s, Math.max(6, s - 3)), K = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

  const body = new THREE.Group(); root.add(body);
  const detail = new THREE.Group(); body.add(detail); // chi tiết nhỏ — ẩn khi LOD xa
  const sw = { slim: 0.52, normal: 0.62, broad: 0.78, huge: 0.9 }[L.build || 'normal']; const fem = !!L.female;
  const skinM = mat(L.skin), shirtM = mat(L.shirt), pantsM = mat(L.pants), armorM = metal(L.armor), bootM = mat(L.boots), accM = L.accent === L.glow ? glowM(L.accent, 1.2) : mat(L.accent, { metalness: 0.4 });

  // --- chân ---
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * (0.12 + (sw - 0.6) * 0.1), 0.82, 0); body.add(hip);
    const lw = 0.1 * (sw / 0.62) ** 0.4;
    part(hip, C(lw, lw * 0.9, 0.42, 7), pantsM, 0, -0.2, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.41, 0); hip.add(knee);
    part(knee, S(lw * 0.95, 7), pantsM, 0, 0, 0); part(knee, C(lw * 0.85, lw * 0.7, 0.38, 7), pantsM, 0, -0.19, 0);
    part(knee, B(0.17, 0.14, 0.31), bootM, 0, -0.38, 0.05); part(knee, C(lw * 0.95, lw * 0.95, 0.16, 7), bootM, 0, -0.28, 0);
    if (L.armor && sw > 0.7) part(knee, B(0.15, 0.2, 0.06), armorM, 0, -0.04, 0.1);
    legs.push({ hip, knee });
  }
  // --- chậu + váy ---
  part(body, B(sw * 0.78, 0.2, 0.34), pantsM, 0, 0.86, 0);
  if (fem || L.robe) { const sk = part(body, C(0.3, L.robe ? 0.52 : 0.42, L.robe ? 0.75 : 0.34, 10), L.robe ? shirtM : mat(L.armor), 0, L.robe ? 0.52 : 0.7, 0); sk.scale.z = 0.9; if (L.robe) part(detail, C(0.53, 0.53, 0.05, 10), accM, 0, 0.17, 0); }
  // --- thân trên ---
  const torso = new THREE.Group(); torso.position.y = 0.82; body.add(torso);
  const chest = part(torso, C(sw * 0.5, sw * (fem ? 0.28 : 0.34), 0.58, 8), shirtM, 0, 0.3, 0); chest.scale.z = 0.58;
  if (L.shirtless) { part(torso, B(sw * 0.65, 0.32, 0.06), skinM, 0, 0.36, 0.17); part(torso, B(0.03, 0.3, 0.08), mat(0xc08050), 0, 0.36, 0.18); for (const [x, y] of [[-0.13, 0.42], [0.13, 0.42], [-0.12, 0.3], [0.12, 0.3]]) part(detail, B(0.2, 0.09, 0.04), mat(0xc78f60), x, y, 0.2); }
  else if (L.armor && !L.robe) { part(torso, B(sw * 0.82, 0.38, 0.1), armorM, 0, 0.36, 0.16); part(detail, B(sw * 0.1, 0.3, 0.12), accM, 0, 0.36, 0.17); part(detail, S(0.06, 6), glowM(L.glow, 1.4), 0, 0.42, 0.24); part(torso, B(sw * 0.76, 0.14, 0.3), armorM, 0, 0.12, 0).scale.z = 0.9; }
  if (L.robe) { part(torso, B(sw * 0.8, 0.5, 0.06), mat(L.armor), 0, 0.3, 0.17); part(detail, B(0.08, 0.6, 0.07), accM, 0, 0.3, 0.2); part(torso, C(sw * 0.3, sw * 0.42, 0.22, 8), mat(L.armor), 0, 0.57, 0).scale.z = 0.7; }
  if (L.stripes) { for (let i = 0; i < 4; i++) { part(detail, B(0.05, 0.14, 0.04), mat(L.stripes), -0.2 + i * 0.13, 0.1, 0.0).visible = false; } part(torso, B(sw * 0.7, 0.22, 0.34), mat(L.shirt), 0, 0.1, 0).scale.z = 0.95; for (let i = 0; i < 5; i++) part(detail, B(0.06, 0.18, 0.02), mat(L.stripes), -0.22 + i * 0.11, 0.1, 0.18, 0, 0, 0.2); part(torso, B(0.34, 0.1, 0.34), mat(0xffd77a), 0.18, 0.5, 0).visible = false; }
  const belt = part(torso, C(sw * 0.34, sw * 0.34, 0.07, 10), accM, 0, 0.02, 0); belt.scale.z = 0.6; part(detail, B(0.1, 0.09, 0.05), glowM(L.glow, 1), 0, 0.02, 0.2);
  if (L.pads) for (const s of [-1, 1]) { const p = part(torso, S(0.2 * (sw / 0.7), 8), armorM, s * (sw / 2 + 0.03), 0.5, 0); p.scale.set(1.1, 0.7, 1); part(detail, K(0.06, 0.2, 5), armorM, s * (sw / 2 + 0.13), 0.6, 0, 0, 0, -s * 0.5); }
  if (L.scarf) { part(torso, C(0.2, 0.22, 0.1, 8), mat(L.scarf), 0, 0.64, 0.02); const t = part(torso, B(0.1, 0.4, 0.04), mat(L.scarf), 0.12, 0.45, -0.18); t.rotation.x = 0.3; }
  // --- đầu ---
  const head = new THREE.Group(); head.position.set(0, 0.69, 0); torso.add(head);
  part(head, C(0.07, 0.08, 0.1, 6), skinM, 0, -0.03, 0);
  const hd = part(head, S(0.185, 12), skinM, 0, 0.14, 0); hd.scale.set(0.95, 1.08, 1);
  part(head, B(0.1, 0.14, 0.04), skinM, 0, 0.08, 0.18).scale.set(0.35, 0.5, 0.8); // mũi
  const eyeM = L.glowEyes ? glowM(L.glowEyes, 2.6) : mat(0x1a1a22);
  for (const s of [-1, 1]) {
    part(detail, B(0.06, 0.035, 0.03), eyeM, s * 0.07, 0.16, 0.17); part(detail, B(0.08, 0.018, 0.03), mat(L.hair), s * 0.07, 0.2, 0.17, 0, 0, -s * 0.15);
    part(detail, S(0.03, 5), skinM, s * 0.18, 0.13, 0);
  }
  if (!L.mask && !L.beard) part(detail, B(0.06, 0.012, 0.02), mat(0x9a4a4a), 0, 0.06, 0.18);
  if (L.mask) { const mk = part(head, new THREE.SphereGeometry(0.195, 10, 6, 0, 6.3, 1.55, 1.1), mat(0x151515), 0, 0.14, 0.0); mk.scale.set(0.97, 1.08, 1.05); part(detail, B(0.2, 0.012, 0.02), glowM(L.glow, 1.5), 0, 0.13, 0.19); }
  if (L.beard) { const bd = part(head, S(0.17, 8), mat(L.beard), 0, 0.03, 0.06); bd.scale.set(1, 0.8, 0.9); part(detail, B(0.2, 0.05, 0.05), mat(L.beard), 0, 0.1, 0.17); }
  if (L.goggles) { part(head, C(0.2, 0.2, 0.06, 10), mat(0x1a1a1a), 0, 0.26, 0.04, Math.PI / 2 - 0.3, 0, 0).scale.set(1, 1, 0.6); for (const s of [-1, 1]) part(detail, C(0.055, 0.055, 0.04, 8), glowM(L.glow, 2), s * 0.07, 0.3, 0.15, Math.PI / 2 - 0.3); }
  // tóc
  const hairM = mat(L.hair); const hs = L.hairStyle;
  if (hs !== 'bald') { const cap = part(head, new THREE.SphereGeometry(0.2, 12, 8, 0, 6.3, 0, hs === 'curly' ? 1.4 : 1.65), hairM, 0, 0.15, -0.015); cap.scale.set(1, 1.05, 1.04); }
  if (hs === 'long') { part(head, B(0.36, 0.8, 0.1), hairM, 0, -0.18, -0.15).scale.set(1, 1, 1); part(head, B(0.08, 0.5, 0.14), hairM, -0.18, -0.02, -0.04); part(head, B(0.08, 0.5, 0.14), hairM, 0.18, -0.02, -0.04); part(head, B(0.2, 0.06, 0.06), hairM, 0, 0.27, 0.15); }
  if (hs === 'ponytail') { let px = 0, py = 0.16, pz = -0.2; for (let i = 0; i < 5; i++) { const sp = part(head, S(0.07 - i * 0.008, 6), hairM, px, py, pz); px += 0; py -= 0.07 + i * 0.01; pz -= 0.05; sp.scale.set(1, 1.3, 1); } part(head, B(0.1, 0.02, 0.1), glowM(L.glow, 1), 0, 0.17, -0.19); part(head, B(0.4, 0.07, 0.06), hairM, 0, 0.27, 0.13); }
  if (hs === 'curly') for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, r = 0.2; part(head, S(0.08 + (i % 3) * 0.01, 6), hairM, Math.cos(a) * r, 0.16 + (i % 2) * 0.1 - 0.02, Math.sin(a) * r - 0.04); }
  if (hs === 'spiky') for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const k = part(head, K(0.06, 0.26, 5), hairM, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12); k.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); }
  if (hs === 'messy') for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const k = part(head, B(0.05, 0.2, 0.05), hairM, Math.cos(a) * 0.14, 0.31, Math.sin(a) * 0.14); k.rotation.set(Math.sin(a) * 0.9, i, -Math.cos(a) * 0.9); }
  if (hs === 'short') part(head, B(0.28, 0.08, 0.06), hairM, 0, 0.27, 0.15);
  if (L.helmet === 'crest') { const h = part(head, new THREE.SphereGeometry(0.21, 12, 8, 0, 6.3, 0, 1.5), armorM, 0, 0.15, 0); h.scale.set(1, 1.05, 1.05); part(head, B(0.04, 0.12, 0.34), glowM(0xffd24a, 0.8), 0, 0.37, 0); part(head, B(0.4, 0.04, 0.04), armorM, 0, 0.23, 0.18); for (const s of [-1, 1]) part(detail, B(0.04, 0.2, 0.1), armorM, s * 0.2, 0.08, 0.05); }
  if (L.hat === 'fur') { const h = part(head, S(0.24, 10), mat(0x7a4a28), 0, 0.28, -0.01); h.scale.set(1, 0.65, 1); part(head, C(0.25, 0.26, 0.07, 10), mat(0xe8d8b8), 0, 0.2, 0); for (const s of [-1, 1]) { part(head, B(0.1, 0.22, 0.05), mat(0x7a4a28), s * 0.22, 0.08, 0.02, 0, 0, s * 0.15); } part(head, S(0.06, 6), mat(0xe8d8b8), 0, 0.42, 0); }
  if (L.hat === 'leaf') { for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; const l = part(head, K(0.05, 0.22, 4), mat(0x3fae5a), Math.cos(a) * 0.19, 0.29, Math.sin(a) * 0.19); l.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); } part(head, S(0.06, 6), glowM(0xff7ab0, 1.5), 0.15, 0.32, 0.14); for (let i = 0; i < 5; i++) part(detail, K(0.04, 0.08, 4), glowM(0xff7ab0, 1.2), 0.15 + Math.cos(i * 1.25) * 0.06, 0.32, 0.14 + Math.sin(i * 1.25) * 0.06).rotation.x = Math.PI / 2; }
  if (L.hood) { const h = part(head, new THREE.SphereGeometry(0.24, 12, 8, 0, 6.3, 0, 2.2), mat(L.armor === 0x6a5acd ? L.shirt : L.shirt), 0, 0.12, -0.08); h.scale.set(1, 1, 1.05); h.rotation.x = -0.1; part(head, K(0.1, 0.3, 4), mat(L.shirt), 0, 0.2, -0.28).rotation.x = -2.1; }

  // --- tay ---
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (sw / 2 + 0.07), 0.5, 0); torso.add(sh);
    const sleeve = L.shirtless ? skinM : shirtM; const aw = 0.075 * (sw / 0.62) ** 0.4;
    part(sh, S(aw * 1.25, 8), L.pads ? armorM : sleeve, 0, 0, 0); part(sh, C(aw, aw * 0.9, 0.3, 7), sleeve, 0, -0.15, 0);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    part(el, S(aw * 0.92, 7), sleeve, 0, 0, 0); part(el, C(aw * 0.9, aw * 0.7, 0.27, 7), L.shirtless ? skinM : (L.armor ? armorM : skinM), 0, -0.14, 0);
    if (L.armor || L.shirtless) part(detail, C(aw * 1.1, aw * 1.1, 0.08, 7), accM, 0, -0.1, 0);
    part(el, S(aw * 0.95, 8), (L.weaponR === 'fist') ? armorM : (L.mask || L.pose === 'melee' && L.armor ? mat(L.boots) : skinM), 0, -0.3, 0);
    const hand = new THREE.Group(); hand.position.set(0, -0.3, 0); el.add(hand);
    arms.push({ sh, el, hand, s });
  }
  const armR = arms[1], armL = arms[0]; // s=+1 là tay phải của nhân vật (x dương nhìn từ sau); dùng cho vũ khí chính
  // --- vũ khí ---
  const glowParts = [];
  const WEAP = {
    sword(h) { part(h, C(0.03, 0.03, 0.16, 6), mat(0x3a2a1a), 0, -0.02, 0); part(h, B(0.26, 0.04, 0.07), metal(0xd4a017), 0, -0.12, 0); const bl = part(h, B(0.08, 0.55, 0.02), metal(0xe8e8e8), 0, -0.42, 0); part(h, K(0.04, 0.12, 4), metal(0xe8e8e8), 0, -0.74, 0, Math.PI, Math.PI / 4, 0).scale.set(1, 1, 0.3); const fu = part(h, B(0.02, 0.4, 0.025), glowM(0xffd24a, 1.2), 0, -0.4, 0.001); glowParts.push(fu); part(h, S(0.05, 6), metal(0xd4a017), 0, 0.07, 0); return bl; },
    shield(h) { const g = new THREE.Group(); g.position.set(-0.09, -0.04, 0.03); h.add(g); const d = part(g, C(0.4, 0.4, 0.06, 20), metal(0xc0c0c0), 0, 0, 0); d.rotation.z = Math.PI / 2; const rim = part(g, new THREE.TorusGeometry(0.4, 0.035, 6, 24), metal(0xd4a017), 0, 0, 0); rim.rotation.y = Math.PI / 2; const bs = part(g, S(0.1, 8), metal(0xd4a017), -0.05, 0, 0); bs.scale.set(0.6, 1, 1); const em = part(g, K(0.15, 0.3, 5), glowM(0xffd24a, 1.5), -0.07, 0, 0, 0, 0, Math.PI / 2); em.scale.set(0.3, 1, 1); glowParts.push(em); for (let i = 0; i < 6; i++) { const a = i * 1.047; part(g, S(0.025, 4), metal(0xd4a017), -0.04, Math.cos(a) * 0.3, Math.sin(a) * 0.3); } },
    katar(h) { // song đao cong: các đoạn box xếp theo cung, phát sáng đỏ
      part(h, C(0.025, 0.025, 0.2, 6), mat(0x222222), 0, 0, 0); const base = new THREE.Group(); h.add(base); base.position.set(0, -0.1, 0); base.rotation.x = -0.4;
      for (let i = 0; i < 6; i++) { const a = i * 0.17; const seg = part(base, B(0.03, 0.14, 0.035 - i * 0.003), glowM(L.glow, 1.8), 0, -0.1 * Math.cos(a) - i * 0.0, 0.0 + 0.5 * (1 - Math.cos(a)) * 0.22 + i * 0.015, 0, 0, 0); seg.position.set(0, -0.08 - i * 0.1 * Math.cos(a * 0.6), i * i * 0.012); seg.rotation.x = -a * 0.9; glowParts.push(seg); }
      part(base, B(0.07, 0.03, 0.07), metal(0x888888), 0, 0.02, 0); },
    dagger(h) { part(h, C(0.025, 0.025, 0.16, 6), mat(0x1a1a1a), 0, 0, 0); part(h, B(0.14, 0.03, 0.05), metal(0x444444), 0, -0.09, 0); const b = part(h, B(0.06, 0.34, 0.015), glowM(L.glow, 1.6), 0, -0.28, 0); glowParts.push(b); part(h, K(0.03, 0.09, 4), glowM(L.glow, 1.6), 0, -0.49, 0, Math.PI, 0, 0).scale.set(1, 1, 0.3); },
    crystalStaff(h) { const g = new THREE.Group(); h.add(g); g.rotation.x = 1.15; part(g, C(0.03, 0.035, 1.9, 6), mat(0x3a2410), 0, 0.25, 0); for (const y of [-0.3, 0.5, 1.0]) part(g, C(0.05, 0.05, 0.05, 6), metal(0xc8b6ff), 0, y, 0); const cr = part(g, new THREE.OctahedronGeometry(0.16, 0), glowM(0x9400d3, 2), 0, 1.4, 0); cr.scale.y = 1.6; glowParts.push(cr); for (const s of [-1, 1]) part(g, K(0.04, 0.3, 4), metal(0xc8b6ff), s * 0.1, 1.25, 0, 0, 0, s * 0.4); const sh = []; for (let i = 0; i < 3; i++) { const o = part(g, new THREE.OctahedronGeometry(0.04, 0), glowM(0xc890ff, 2), 0, 1.4, 0, 0, 0, 0, false); sh.push(o); } rig.shards = sh; rig.staffTop = g; },
    scepter(h) { const g = new THREE.Group(); h.add(g); g.rotation.x = 1.15; part(g, C(0.025, 0.03, 1.6, 6), metal(0xffd700), 0, 0.2, 0); part(g, new THREE.TorusGeometry(0.14, 0.025, 6, 16), metal(0xffd700), 0, 1.15, 0); const o = part(g, S(0.1, 10), glowM(0xfff8dc, 2.2), 0, 1.15, 0); glowParts.push(o); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(g, B(0.03, 0.22 - i * 0.04, 0.012), mat(0xffffff, { emissive: 0xfff8dc, emissiveIntensity: 0.5 }), s * (0.12 + i * 0.05), 1.0 + i * 0.08, 0, 0, 0, s * (-0.9 - i * 0.2)); part(g, K(0.04, 0.2, 5), metal(0xffd700), 0, 1.32, 0); part(g, S(0.05, 6), metal(0xffd700), 0, -0.55, 0); rig.staffTop = g; },
    flowerStaff(h) { const g = new THREE.Group(); h.add(g); g.rotation.x = 1.15; part(g, C(0.03, 0.04, 1.7, 6), mat(0x6a4a2a), 0, 0.25, 0); for (let i = 0; i < 4; i++) part(g, new THREE.TorusGeometry(0.045, 0.012, 4, 8), mat(0x3fae5a), 0, 0.2 + i * 0.28, 0, Math.PI / 2, 0, 0); const c = part(g, S(0.09, 8), glowM(0xffd23d, 2), 0, 1.2, 0); glowParts.push(c); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; const p = part(g, S(0.09, 6), glowM(0xff7ab0, 1.0), Math.cos(a) * 0.15, 1.2, Math.sin(a) * 0.15); p.scale.set(1, 0.4, 1); glowParts.push(p); } for (const s of [-1, 1]) part(g, K(0.06, 0.25, 4), mat(0x3fae5a), s * 0.08, 0.8, 0, 0, 0, s * 0.9); rig.staffTop = g; },
    crossbow(h) { const g = new THREE.Group(); h.add(g); g.rotation.x = 0; part(g, B(0.09, 0.8, 0.12), mat(0x5a3a1a), 0, -0.3, 0.05); part(g, B(0.07, 0.2, 0.2), metal(0xa0a0a0), 0, -0.08, 0.07); for (const s of [-1, 1]) { const l = part(g, B(0.5, 0.05, 0.06), metal(0xa0a0a0), s * 0.25, -0.62, 0.05); l.rotation.z = s * 0.35; part(g, B(0.05, 0.05, 0.12), metal(0xa0a0a0), s * 0.46, -0.52, 0.05); } part(g, B(0.9, 0.01, 0.01), mat(0xffffff), 0, -0.5, 0.05); const sc = part(g, C(0.04, 0.04, 0.3, 8), metal(0x555555), 0, -0.25, 0.17); const bolt = part(g, K(0.025, 0.5, 4), glowM(0xffb020, 1.6), 0, -0.55, 0.12, Math.PI, 0, 0); glowParts.push(bolt); part(g, S(0.05, 6), glowM(0xffb020, 2), 0, -0.06, 0.2); part(g, C(0.06, 0.06, 0.18, 8), metal(0x777777), 0.07, -0.12, 0.05, 0, 0, Math.PI / 2); sc.rotation.x = 0; },
    gun(h) { const g = new THREE.Group(); h.add(g); part(g, B(0.1, 0.22, 0.16), metal(0x2a3a40), 0, -0.05, 0.03); part(g, B(0.07, 0.2, 0.08), mat(0x1a1a1a), 0, 0.08, -0.04, 0.3, 0, 0); part(g, C(0.045, 0.055, 0.6, 8), metal(0x3a4a50), 0, -0.4, 0.04); const cl = part(g, C(0.07, 0.07, 0.16, 8), glowM(L.glow, 2), 0, -0.2, 0.12, 0, 0, 0); glowParts.push(cl); for (let i = 0; i < 3; i++) part(g, C(0.065, 0.065, 0.03, 8), metal(0x555555), 0, -0.3 - i * 0.1, 0.04); const mz = part(g, S(0.05, 6), glowM(L.glow, 2.5), 0, -0.72, 0.04); glowParts.push(mz); part(g, B(0.03, 0.12, 0.05), glowM(L.glow, 1.5), 0.06, -0.1, 0.03); },
    hammer(h) { const g = new THREE.Group(); h.add(g); g.position.y = 0.3; part(g, C(0.045, 0.05, 1.4, 6), mat(0x4a3220), 0, -0.4, 0); const hd = part(g, B(0.5, 0.32, 0.32), metal(0x8a8a8a), 0, -1.1, 0); part(g, B(0.52, 0.06, 0.34), metal(0x4a4a4a), 0, -0.98, 0); part(g, B(0.52, 0.06, 0.34), metal(0x4a4a4a), 0, -1.22, 0); for (const s of [-1, 1]) part(g, K(0.07, 0.12, 4), metal(0x4a4a4a), s * 0.31, -1.1, 0, 0, 0, -s * Math.PI / 2); const rn = part(g, B(0.02, 0.12, 0.34), glowM(0xb0c4de, 1.5), 0, -1.1, 0); rn.position.x = 0.0; glowParts.push(rn); part(g, S(0.06, 6), metal(0x4a4a4a), 0, 0.3, 0); return hd; },
    towerShield(h) { const g = new THREE.Group(); g.position.set(-0.17, -0.1, 0.05); h.add(g); part(g, B(0.1, 0.95, 0.62), metal(0xa9a9a9), 0, 0, 0); part(g, B(0.12, 0.08, 0.66), metal(0x555555), 0, 0.46, 0); part(g, B(0.12, 0.08, 0.66), metal(0x555555), 0, -0.46, 0); part(g, B(0.12, 0.9, 0.06), metal(0x555555), 0, 0, 0.0); const em = part(g, new THREE.OctahedronGeometry(0.12, 0), glowM(0xb0c4de, 1.5), -0.08, 0.1, 0); glowParts.push(em); for (let i = 0; i < 6; i++) part(g, S(0.03, 4), metal(0x333333), -0.06, (i % 3 - 1) * 0.32, (i < 3 ? -0.25 : 0.25)); },
    fist(h) { const g = part(h, B(0.17, 0.16, 0.2), metal(0x444444), 0, -0.04, 0.0); for (let i = 0; i < 4; i++) part(h, B(0.03, 0.05, 0.03), metal(0x888888), -0.06 + i * 0.04, -0.1, 0.1); const gl = part(h, B(0.18, 0.03, 0.21), glowM(0xff4500, 2), 0, 0.03, 0); glowParts.push(gl); part(h, B(0.2, 0.08, 0.22), metal(0x555555), 0, 0.08, 0); const f = part(h, S(0.1, 6), glowM(0xff4500, 1.2), 0, -0.1, 0.0); f.visible = false; return g; },
  };
  const rig = {};
  if (L.weaponR && WEAP[L.weaponR]) WEAP[L.weaponR](armR.hand);
  if (L.weaponL && WEAP[L.weaponL]) WEAP[L.weaponL](armL.hand);
  // --- áo choàng ---
  let cape = null;
  if (L.cape) { cape = new THREE.Group(); cape.position.set(0, 1.28, -0.16); body.add(cape); const cm = mat(L.cape, { side: THREE.DoubleSide }); const c1 = part(cape, B(0.62, 0.85, 0.03), cm, 0, -0.42, 0); for (const x of [-0.31, 0.31]) part(cape, B(0.03, 0.85, 0.04), mat(L.capeTrim, { emissive: L.capeTrim, emissiveIntensity: 0.5 }), x, -0.42, 0); part(cape, B(0.62, 0.04, 0.05), mat(L.capeTrim, { emissive: L.capeTrim, emissiveIntensity: 0.5 }), 0, -0.85, 0); part(cape, C(0.26, 0.3, 0.12, 8), cm, 0, 0.02, 0.1); c1.scale.set(1, 1, 1); }
  // --- cánh ---
  const wings = [];
  if (L.wings) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.08, 1.2, -0.2); body.add(w); const wm = mat(L.wings, { emissive: 0xfff8dc, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) { const f = part(w, B(0.07, 0.7 - i * 0.08, 0.015), wm, s * (0.18 + i * 0.1), 0.25 - i * 0.08, 0, 0, 0, s * (-0.5 - i * 0.2)); f.position.x = s * (0.15 + i * 0.1); f.position.y = 0.22 - i * 0.06; }
    part(w, B(0.2, 0.09, 0.02), wm, s * 0.1, 0.0, 0, 0, 0, s * -0.2);
    w.rotation.y = s * 0.35; wings.push({ g: w, s });
  }
  // --- quỹ đạo (sách/drone/orb/cánh hoa) ---
  let orbit = null; const orbitItems = [];
  if (L.orbit) {
    orbit = new THREE.Group(); orbit.position.y = 1.25; root.add(orbit);
    if (L.orbit === 'books') for (let i = 0; i < 3; i++) { const g = new THREE.Group(); const a = i / 3 * 6.283; g.position.set(Math.cos(a) * 0.95, 0.1 * i, Math.sin(a) * 0.95); part(g, B(0.3, 0.05, 0.4), mat(0x3a1a7a), 0, 0, 0); part(g, B(0.28, 0.04, 0.38), mat(0xf4ecd0), 0.01, 0.045, 0); part(g, B(0.3, 0.06, 0.04), mat(0x9400d3, { emissive: 0x9400d3, emissiveIntensity: 1.2 }), 0, 0.01, -0.2); part(g, B(0.1, 0.01, 0.1), glowM(0xc890ff, 2), 0, 0.075, 0); orbit.add(g); orbitItems.push(g); }
    if (L.orbit === 'drone') { const g = new THREE.Group(); part(g, S(0.14, 8), metal(0x2a3a40), 0, 0, 0); part(g, new THREE.TorusGeometry(0.19, 0.02, 4, 12), glowM(L.glow, 2), 0, 0, 0, Math.PI / 2, 0, 0); part(g, S(0.06, 6), glowM(L.glow, 3), 0, 0, 0.12); for (const s of [-1, 1]) { const r = part(g, C(0.12, 0.12, 0.012, 10), mat(0xdddddd, { transparent: true, opacity: 0.5 }), s * 0.22, 0.07, 0); r.userData.spin = true; part(g, C(0.015, 0.015, 0.08, 4), mat(0x555555), s * 0.22, 0.03, 0); } g.position.set(0.8, 0.3, 0.2); orbit.add(g); orbitItems.push(g); rig.droneMesh = g; }
    if (L.orbit === 'orbs') for (let i = 0; i < 3; i++) { const o = part(orbit, S(0.09, 8), glowM(0xfff8dc, 2.4), Math.cos(i * 2.09) * 0.8, Math.sin(i * 1.7) * 0.15, Math.sin(i * 2.09) * 0.8, 0, 0, 0, false); orbitItems.push(o); }
    if (L.orbit === 'petals') for (let i = 0; i < 6; i++) { const o = part(orbit, S(0.07, 6), glowM(i % 2 ? 0xff7ab0 : 0xffd0e4, 1.6), Math.cos(i * 1.05) * 0.85, Math.sin(i) * 0.25, Math.sin(i * 1.05) * 0.85, 0, 0, 0, false); o.scale.set(1, 0.35, 1); orbitItems.push(o); }
  }
  // --- vòng sáng dưới chân ---
  let foot = null;
  if (L.footRing) { foot = part(root, new THREE.RingGeometry(0.75, 0.95, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: L.footRing, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.05, 0, 0, 0, 0, false); }
  root.scale.setScalar(def.height / 1.8);

  Object.assign(rig, { body, torso, head, legs, arms, cape, wings, orbit, orbitItems, foot, detail, glowParts, root });
  const j = (o, ax, target, k) => { o.rotation[ax] += (target - o.rotation[ax]) * k; };
  const poses = { melee: { r: [-0.35, -0.95], l: [-0.1, -0.3] }, ranged: { r: [-1.25, -0.2], l: [-1.1, -0.55] }, caster: { r: [-0.2, -0.75], l: [0.15, -0.25] }, fist: { r: [-0.5, -1.25], l: [-0.5, -1.25] } };
  const pose = poses[L.pose || 'melee']; let castPulse = 0;

  // ---------- ANIMATION (procedural) ----------
  // state: 'idle' | 'run' | 'attack' | 'cast' | 'death'; p = tiến độ 0..1 của state; t = thời gian toàn cục
  function update(state, p, t, dt, speedK = 1) {
    const k = 1 - Math.exp(-dt * 18); const ph = t * Math.PI * 2 / 0.6 * Math.min(1.3, speedK);
    let lean = 0, bob = 0, twist = 0;
    let rS = pose.r[0], rE = pose.r[1], lS = pose.l[0], lE = pose.l[1], hipA = 0, kneeA = 0, hipB = 0, kneeB = 0, bodyRot = 0, byOff = 0;
    if (state === 'idle') { // 2s: lắc nhẹ thân, tay đung đưa
      const w = Math.sin(t * Math.PI); bob = w * 0.012; twist = Math.sin(t * Math.PI * 0.5) * 0.04; lS += Math.sin(t * Math.PI + 1) * 0.05; rS += Math.sin(t * Math.PI) * 0.04;
    } else if (state === 'run') { // 0.6s: chân bước, tay vung
      const s = Math.sin(ph); hipA = s * 0.95; hipB = -s * 0.95; kneeA = Math.max(0, -Math.sin(ph + 0.9)) * 1.1; kneeB = Math.max(0, Math.sin(ph + 0.9)) * 1.1;
      lean = 0.16; bob = Math.abs(Math.cos(ph)) * 0.06; twist = s * 0.12;
      if (L.pose === 'melee' || L.pose === 'fist') { lS = -s * 0.9; rS = s * 0.9 - (L.weaponR === 'hammer' ? 0.3 : 0); rE = -0.5; lE = -0.5; }
      else if (L.pose === 'caster') { lS = -s * 0.8; rS = -0.35; rE = -0.9; }
      else { rS = -0.9; lS = -0.9; }
    } else if (state === 'attack') { // 0.3s
      const e = Math.min(1, p); const sw2 = e < 0.45 ? e / 0.45 : 1; const back = e >= 0.45 ? (e - 0.45) / 0.55 : 0; const A = L.atk;
      if (A === 'slash') { rS = -2.7 + (2.9 * sw2) * (1 - back * 0.4); rE = -0.3; twist = 0.7 - sw2 * 1.2; lS = -0.6; lE = -0.9; lean = 0.2 * sw2; }
      else if (A === 'stab') { const alt = (Math.floor(t * 4) % 2) ? 1 : -1; rS = -1.0 - 0.9 * Math.sin(e * Math.PI) * (alt > 0 ? 1 : 0.3); lS = -1.0 - 0.9 * Math.sin(e * Math.PI) * (alt < 0 ? 1 : 0.3); rE = -0.2; lE = -0.2; twist = Math.sin(e * Math.PI) * 0.5 * alt; lean = 0.3 * Math.sin(e * Math.PI); }
      else if (A === 'punch') { const alt = (Math.floor(t * 4) % 2) ? 1 : -1; rS = -0.5 - 1.1 * Math.sin(e * Math.PI) * (alt > 0 ? 1 : 0.2); lS = -0.5 - 1.1 * Math.sin(e * Math.PI) * (alt < 0 ? 1 : 0.2); rE = -0.4; lE = -0.4; twist = -Math.sin(e * Math.PI) * 0.5 * alt; lean = 0.2; }
      else if (A === 'shoot') { const rc = Math.sin(e * Math.PI); rS = pose.r[0] - 0.25 * rc; lS = pose.l[0]; lean = -0.08 * rc; twist = 0.12; }
      else { rS = -1.5 - 0.9 * Math.sin(e * Math.PI); rE = -0.3; lS = 0.2; twist = 0.3 * Math.sin(e * Math.PI); }
    } else if (state === 'cast') { // 0.5s: giơ tay + glow
      const e = Math.sin(Math.min(1, p) * Math.PI * 0.9 + 0.2); rS = -2.5 * e - 0.2 * (1 - e); lS = -2.5 * e; rE = -0.35; lE = -0.3; lean = -0.1 * e; bob = 0.03 * e; castPulse = e;
    } else if (state === 'death') { // 1s
      const e = 1 - Math.pow(1 - Math.min(1, p), 3); bodyRot = -Math.PI / 2 * e; byOff = 0.12 * e; rS = -0.4 - e * 1.4; lS = 0.6; rE = -0.2; lE = -0.2; hipA = 0.3 * e; hipB = -0.2 * e; kneeA = 0.4 * e;
    }
    if (state !== 'cast') castPulse *= 0.9;
    // áp dụng (lerp mượt)
    j(rig.torso, 'rotation' in {} ? 'x' : 'x', lean, k); j(rig.torso, 'y', twist, k);
    rig.torso.position.y += (0.82 + bob - rig.torso.position.y) * k; rig.body.position.y += (byOff - rig.body.position.y) * k; j(rig.body, 'x', bodyRot, state === 'death' ? 0.25 : k);
    j(legs[0].hip, 'x', hipA, k); j(legs[0].knee, 'x', kneeA, k); j(legs[1].hip, 'x', hipB, k); j(legs[1].knee, 'x', kneeB, k);
    j(armR.sh, 'x', rS, k); j(armR.el, 'x', rE, k); j(armL.sh, 'x', lS, k); j(armL.el, 'x', lE, k);
    armL.sh.rotation.z += (0.1 - armL.sh.rotation.z) * k; armR.sh.rotation.z += (-0.1 - armR.sh.rotation.z) * k;
    if (cape) { j(cape, 'x', state === 'run' ? 0.5 + Math.sin(t * 14) * 0.08 : 0.08 + Math.sin(t * 2) * 0.03, k * 0.5); }
    for (const w of wings) w.g.rotation.y = w.s * (0.35 + Math.sin(t * 3 + (state === 'run' ? 3 : 0)) * 0.15);
    if (orbit) { orbit.rotation.y = t * 1.2; orbit.position.y = 1.25 + Math.sin(t * 2) * 0.06; if (L.orbit === 'drone') { const d = rig.droneMesh; d.position.y = 0.3 + Math.sin(t * 3) * 0.1; d.rotation.y = -t * 1.2 + 0.5; d.children.forEach((c) => { if (c.userData.spin) c.rotation.y = t * 40; }); } else orbitItems.forEach((o, i) => { if (L.orbit === 'books') o.rotation.y = t * 2 + i; else o.position.y = Math.sin(t * 2 + i * 2) * 0.2; }); }
    if (rig.shards) rig.shards.forEach((s, i) => { s.position.set(Math.cos(t * 2.5 + i * 2.1) * 0.22, 1.4 + Math.sin(t * 3 + i) * 0.1, Math.sin(t * 2.5 + i * 2.1) * 0.22); s.rotation.y = t * 3; });
    if (foot) { foot.rotation.y = t * 0.8; foot.material.opacity = 0.5 + Math.sin(t * 3) * 0.15; }
    const gi = 1.4 + castPulse * 3 + Math.sin(t * 5) * 0.3; for (const g of glowParts) { if (g.material.emissiveIntensity !== undefined) g.material.emissiveIntensity = gi; }
  }
  function setOpacity(o) { const tr = o < 0.99; for (const m of allMats) { m.transparent = tr; m.opacity = o; m.depthWrite = !tr; } }
  function setGlowColor(c) { for (const g of glowParts) g.material.emissive.set(c); }
  function setDetail(v) { if (detail.visible !== v) detail.visible = v; }
  return { group: root, rig, update, setOpacity, setGlowColor, setDetail, mats: allMats };
}

// ============================================================
// Thần Ngưu (mount của Bình An) — model low-poly có animation đi bộ
// ============================================================
export function buildBull() {
  const root = new THREE.Group();
  const allMats = [];
  const mat = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true, ...o }); allMats.push(m); return m; };
  const metal = (c) => mat(c, { metalness: 0.6, roughness: 0.35 });
  const bodyM = mat(0x6b4423), bellyM = mat(0x8a5a30), darkM = mat(0x3a2414), hornM = metal(0xffd24a), saddleM = metal(0xd4a017);
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), S = (r, s = 10) => new THREE.SphereGeometry(r, s, Math.max(6, s - 3)), C = (a, b, h, s = 8) => new THREE.CylinderGeometry(a, b, h, s);
  const part = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); me.castShadow = true; parent.add(me); return me; };
  // thân (nhô về +z là hướng nhìn trước)
  const body = new THREE.Group(); body.position.y = 0.95; root.add(body);
  const trunk = part(body, B(0.85, 0.75, 1.7), bodyM, 0, 0, 0); trunk.scale.set(1, 0.95, 1);
  part(body, B(0.7, 0.3, 1.2), bellyM, 0, -0.38, 0.1);
  // mông + đuôi
  part(body, S(0.48, 8), bodyM, 0, 0.02, -0.85);
  const tail = new THREE.Group(); tail.position.set(0, 0.35, -0.95); body.add(tail);
  part(tail, C(0.045, 0.03, 0.55, 5), darkM, 0, -0.26, 0); part(tail, S(0.09, 6), darkM, 0, -0.58, 0);
  // cổ + đầu + sừng
  const neck = new THREE.Group(); neck.position.set(0, 0.28, 0.75); neck.rotation.x = -0.25; body.add(neck);
  part(neck, B(0.55, 0.55, 0.6), bodyM, 0, 0.1, 0.15);
  const head = new THREE.Group(); head.position.set(0, 0.28, 0.55); neck.add(head);
  part(head, B(0.5, 0.5, 0.55), bodyM, 0, 0, 0);
  part(head, B(0.36, 0.28, 0.3), bellyM, 0, -0.14, 0.32); // mõm
  part(head, S(0.06, 6), darkM, -0.12, -0.02, 0.47); part(head, S(0.06, 6), darkM, 0.12, -0.02, 0.47); // mũi
  for (const s of [-1, 1]) {
    part(head, S(0.05, 6), darkM, s * 0.14, 0.12, 0.28); // mắt
    const horn = part(head, C(0.045, 0.02, 0.42, 6), hornM, s * 0.26, 0.3, -0.05); horn.rotation.z = s * -0.9; horn.rotation.x = 0.5;
    part(head, B(0.09, 0.22, 0.12), bellyM, s * 0.16, -0.28, 0.02); // tai
  }
  // yên cương vàng (phong cách Bình An)
  const saddle = new THREE.Group(); saddle.position.set(0, 0.42, -0.15); body.add(saddle);
  part(saddle, B(0.75, 0.1, 0.9), saddleM, 0, 0, 0);
  for (const s of [-1, 1]) { part(saddle, B(0.07, 0.35, 0.9), saddleM, s * 0.4, 0.16, 0); }
  part(saddle, B(0.66, 0.08, 0.1), saddleM, 0, 0.34, 0.4);
  // 4 chân (groups để animation đi bộ) — f: trước/sau, s: trái/phải
  const legs = [];
  for (const [f, s] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.32, -0.15, f * 0.62); body.add(hip);
    part(hip, C(0.13, 0.11, 0.5, 6), bodyM, 0, -0.25, 0);
    const knee = new THREE.Group(); knee.position.set(0, -0.5, 0); hip.add(knee);
    part(knee, C(0.09, 0.08, 0.4, 6), darkM, 0, -0.2, 0);
    part(knee, B(0.2, 0.12, 0.28), darkM, 0, -0.42, 0.03);
    legs.push({ hip, knee, f, s });
  }
  root.userData = { legs, tail, body, mats: allMats };
  return root;
}

// ============================================================
// HeroPreview — canvas WebGL riêng: model xoay 360° (Lobby + Chọn tướng)
// ============================================================
export class HeroPreview {
  constructor(container) {
    this.canvas = document.createElement('canvas'); this.canvas.className = 'preview-canvas'; container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true }); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50); this.camera.position.set(0, 1.5, 5.2); this.camera.lookAt(0, 1.0, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8)); const key = new THREE.DirectionalLight(0xfff0e0, 1.8); key.position.set(3, 5, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6a9aff, 1.0); rim.position.set(-4, 2, -3); this.scene.add(rim);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.12, 36), new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.5, roughness: 0.4 })); pl.position.y = -0.06; this.scene.add(pl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: 0x66aaff })); ring.rotation.x = Math.PI / 2; this.scene.add(ring);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot); this.model = null; this.t = 0; this.running = true; this.dragging = false; this.manual = 0; this.state = 'idle'; this.stT = 0;
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.lx = e.clientX; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) { this.manual += (e.clientX - this.lx) * 0.012; this.lx = e.clientX; } });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.addEventListener('dblclick', () => { this.state = this.state === 'idle' ? 'cast' : 'idle'; this.stT = 0; });
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(container);
    this.last = performance.now(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  setHero(def) { if (this.model) { this.pivot.remove(this.model.group); } this.def = def; this.model = buildHeroModel(def); this.pivot.add(this.model.group); this.manual = 0; this.stT = 0; this.state = 'idle'; this.loopWin = false; }
  resize() { const r = this.canvas.parentElement.getBoundingClientRect(); const w = Math.max(10, r.width), h = Math.max(10, r.height); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  loop(now) {
    requestAnimationFrame(this.loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.running || !this.canvas.isConnected || !this.canvas.offsetParent) return;
    this.t += dt; this.stT += dt;
    if (this.model) {
      if (!this.dragging) this.manual += dt * 0.6; this.pivot.rotation.y = this.manual;
      let st = this.state, p = 0; if (st === 'cast') { p = this.stT / 0.9; if (p > 1) { if (this.loopWin) { this.stT = 0; p = 0; } else { this.state = 'idle'; st = 'idle'; } } } else if (st === 'death') { p = Math.min(1, this.stT / 1.0); }
      this.model.update(st, p, this.t, dt, 1);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
