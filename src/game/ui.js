// ============================================================
// ui.js — GIAO DIỆN DOM đè lên canvas 3D
// Loading → Lobby → Chọn tướng → HUD in-game → Kết thúc
// + overlay 2D (thanh máu/số sát thương), minimap, joystick ảo, nút skill kéo-để-ngắm
// ============================================================
import * as THREE from 'three';
import { G, rankOf, writeSave, clamp } from './state.js';
import { HEROES, HERO_BY_ID, HeroPreview } from './heroes.js';
import { ITEMS, RUNES, BADGES, DIFF, expToNext, skillLevel } from './combat.js';
import { MAP_3D, TERRAIN_CANVAS, BASE_INFO } from './map.js';
import { sfx, setMuted, isMuted } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ICON = { binhan: '🛡️', khaikiet: '🗡️', khoa: '🔮', annie: '🏹', truongan: '👼', dat: '🥊', leanh: '🥷', tung: '🔫', tuan: '🔨', thaonhi: '🌿' };
const grad = (d) => `linear-gradient(135deg, ${d.palette[0]}, ${d.palette[1]} 60%, ${d.palette[4]})`;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export const UI = {
  joy: { x: 0, y: 0, active: false }, handlers: null, preview: null, sel: { hero: 'binhan', rune: 0, badge: 0, start: 0 }, cfg: { mode: '5v5', diff: 1 }, el: {},

  buildDOM(root, handlers) {
    this.handlers = handlers; this.root = root;
    root.innerHTML = `
    <canvas id="game-canvas"></canvas><canvas id="fx-overlay"></canvas>
    <div id="screen-loading" class="screen show">
      <div class="logo"><div class="logo-sub">★ ★ ★</div><h1>A10</h1><h2>ARENA</h2><div class="logo-sub">MOBA 3D TOP-DOWN</div></div>
      <div class="loadbar"><div id="loadfill"></div></div><div id="loadtxt">Đang khởi tạo Three.js...</div>
      <button id="btn-start" class="btn-big hidden">BẮT ĐẦU</button>
    </div>
    <div id="screen-lobby" class="screen">
      <div class="lobby-top">
        <div class="profile"><div class="avatar" id="lb-avatar">🧙</div><div class="pinfo"><div id="lb-name" class="pname"></div><div class="lvl">Cấp <b id="lb-level"></b><div class="xpbar"><i id="lb-xp"></i></div></div><div id="lb-rank" class="rank"></div></div></div>
        <div class="currency"><span>🪙 <b id="lb-coins"></b></span><span id="lb-record"></span></div>
      </div>
      <div class="lobby-menu">
        <button data-menu="hero">🦸 Tướng</button><button data-menu="items">🎒 Trang bị</button><button data-menu="shop">🛒 Shop</button><button data-menu="event">🎁 Sự kiện</button><button data-menu="guild">🏯 Bang hội</button>
      </div>
      <div class="lobby-stage"><div id="lb-preview" class="preview-box"></div><div class="stage-info"><div id="lb-hname" class="hname"></div><div id="lb-hrole" class="hrole"></div><div class="tip">Kéo chuột để xoay 360° • Nhấp đúp để tạo dáng</div></div></div>
      <div class="lobby-play">
        <div class="seg" id="seg-mode"><button data-v="5v5" class="on">5 vs 5</button><button data-v="1v1">1 vs 1 (Giữa)</button></div>
        <div class="seg" id="seg-diff"></div>
        <button id="btn-play" class="btn-big">⚔ CHƠI</button>
      </div>
    </div>
    <div id="screen-select" class="screen">
      <div class="sel-head"><h3>CHỌN TƯỚNG</h3><div class="countdown">⏱ <b id="sel-count">30</b>s</div><button id="sel-back" class="btn-sm">← Sảnh</button></div>
      <div class="sel-body">
        <div class="sel-grid" id="sel-grid"></div>
        <div class="sel-center"><div id="sel-preview" class="preview-box"></div><div id="sel-hname" class="hname"></div></div>
        <div class="sel-info" id="sel-info"></div>
      </div>
      <div class="sel-foot"><button id="sel-ok" class="btn-big">XÁC NHẬN</button></div>
    </div>
    <div id="hud" class="screen">
      <div id="hud-top"><div class="score"><span class="sb">0</span><div class="time" id="h-time">00:00</div><span class="sr">0</span></div><div class="kda" id="h-kda"></div></div>
      <canvas id="minimap" width="170" height="170"></canvas>
      <div id="hud-tr"><button id="b-menu">☰</button><button id="b-mute">🔊</button><button id="b-chat">💬</button><div id="feed"></div></div>
      <div id="chat-menu" class="hidden"></div>
      <div id="buffs"></div>
      <div id="banner"></div>
      <div id="hud-bars">
        <div class="lvcircle" id="h-lv">1</div>
        <div class="barcol"><div class="bar hp"><i id="h-hp"></i><span id="h-hptxt"></span></div><div class="bar mp"><i id="h-mp"></i></div><div class="bar xp"><i id="h-xp"></i></div></div>
        <div class="gold">🪙 <b id="h-gold">500</b></div>
      </div>
      <div id="hud-items"></div>
      <div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div>
      <div id="hint"><b>Chuột trái/phải</b> click để đi / đánh mục tiêu • Skill <b>Q</b> <b>W</b> <b>E</b> <b>R</b> • <b>Space</b> đánh thường • <b>F</b> hồi máu • <b>B</b> về nhà • <b>←/→</b> hoặc <b>Z/C</b> xoay cam • <b>Cuộn</b> zoom • <b>P</b> shop • <b>Tab</b> bảng điểm • <b>F1-F4</b> debug</div>
      <div id="hud-skills">
        <div class="skill-btn r" data-i="3"></div><div class="skill-btn e" data-i="2"></div><div class="skill-btn w" data-i="1"></div><div class="skill-btn q" data-i="0"></div>
        <button id="b-atk" class="atk-btn">⚔</button>
        <button id="b-heal" class="mini-btn heal">💚<small>F</small><i></i></button><button id="b-recall" class="mini-btn recall">🏠<small>B</small></button><button id="b-shop" class="mini-btn shopb hidden">🛒<small>P</small></button>
      </div>
      <div id="aim-ring" class="hidden"></div>
      <div id="scoreboard" class="hidden"></div>
      <div id="shop-panel" class="hidden"></div>
      <div id="pause" class="hidden"><div class="box"><h3>TẠM DỪNG</h3><button id="p-resume" class="btn-big">TIẾP TỤC</button><button id="p-quit" class="btn-sm">Thoát về sảnh (tính thua)</button></div></div>
    </div>
    <div id="screen-end" class="screen"><div class="end-wrap"><div id="end-title"></div><div id="end-preview" class="preview-box end"></div><div id="end-reward"></div><div id="end-table"></div><div class="end-btns"><button id="end-again" class="btn-big">CHƠI LẠI</button><button id="end-lobby" class="btn-sm">Về sảnh</button></div></div></div>
    <div id="modal" class="hidden"><div class="modal-box"><button class="modal-x" id="modal-x">✕</button><div id="modal-body"></div></div></div>`;
    this.cache(); this.bind();
  },
  cache() {
    const q = (s) => $(s, this.root); const e = this.el;
    Object.assign(e, { canvas: q('#game-canvas'), overlay: q('#fx-overlay'), loadfill: q('#loadfill'), loadtxt: q('#loadtxt'), btnStart: q('#btn-start'), minimap: q('#minimap'), feed: q('#feed'), banner: q('#banner'), time: q('#h-time'), kda: q('#h-kda'), hp: q('#h-hp'), hptxt: q('#h-hptxt'), mp: q('#h-mp'), xp: q('#h-xp'), lv: q('#h-lv'), gold: q('#h-gold'), items: q('#hud-items'), skills: $$('.skill-btn', this.root), buffs: q('#buffs'), shop: q('#shop-panel'), board: q('#scoreboard'), shopBtn: q('#b-shop'), healBtn: q('#b-heal'), aim: q('#aim-ring'), modal: q('#modal'), modalBody: q('#modal-body') });
    this.octx = e.overlay.getContext('2d'); this.mctx = e.minimap.getContext('2d');
    this.score = { b: q('.score .sb'), r: q('.score .sr') };
  },
  bind() {
    const q = (s) => $(s, this.root); const H = this.handlers;
    const tap = (el, fn) => el.addEventListener('click', (e) => { sfx('click'); fn(e); });
    tap(q('#btn-start'), () => { this.show('lobby'); this.initPreview(); this.refreshLobby(); });
    $$('.lobby-menu button', this.root).forEach((b) => tap(b, () => this.menu(b.dataset.menu)));
    $$('#seg-mode button', this.root).forEach((b) => tap(b, () => { this.cfg.mode = b.dataset.v; $$('#seg-mode button', this.root).forEach((x) => x.classList.toggle('on', x === b)); }));
    q('#seg-diff').innerHTML = DIFF.map((d, i) => `<button data-v="${i}" class="${i === 1 ? 'on' : ''}">${d.name}</button>`).join('');
    $$('#seg-diff button', this.root).forEach((b) => tap(b, () => { this.cfg.diff = +b.dataset.v; $$('#seg-diff button', this.root).forEach((x) => x.classList.toggle('on', x === b)); }));
    tap(q('#btn-play'), () => this.openSelect());
    tap(q('#sel-back'), () => { clearInterval(this.cdTimer); this.show('lobby'); this.attachPreview('lb-preview'); this.refreshLobby(); });
    tap(q('#sel-ok'), () => this.confirmSelect());
    tap(q('#modal-x'), () => this.el.modal.classList.add('hidden'));
    tap(q('#b-menu'), () => this.pause(true)); tap(q('#p-resume'), () => this.pause(false)); tap(q('#p-quit'), () => { this.pause(false); H.quit(); });
    tap(q('#b-mute'), () => { setMuted(!isMuted()); q('#b-mute').textContent = isMuted() ? '🔇' : '🔊'; });
    tap(q('#b-chat'), () => q('#chat-menu').classList.toggle('hidden'));
    const phrases = ['Tập trung đánh Rồng!', 'Cẩn thận, có địch!', 'Rút lui về trụ!', 'Theo tôi, tiến công!', 'Giỏi lắm!'];
    q('#chat-menu').innerHTML = phrases.map((p) => `<button>${p}</button>`).join(''); $$('#chat-menu button', this.root).forEach((b) => tap(b, () => { this.feedMsg(`${G.player ? G.player.name : 'Bạn'}: ${b.textContent}`, 0); q('#chat-menu').classList.add('hidden'); }));
    tap(q('#b-atk'), () => H.attack()); tap(q('#b-heal'), () => H.heal()); tap(q('#b-recall'), () => H.recall()); tap(q('#b-shop'), () => this.toggleShop());
    tap(q('#end-again'), () => { this.show('lobby'); this.attachPreview('lb-preview'); this.refreshLobby(); this.openSelect(); });
    tap(q('#end-lobby'), () => { this.show('lobby'); this.attachPreview('lb-preview'); this.refreshLobby(); });
    this.bindJoystick(); this.bindSkillButtons();
    window.addEventListener('keydown', (e) => { if (e.code === 'Tab' && G.running) { e.preventDefault(); this.el.board.classList.remove('hidden'); this.buildBoard(); } if (e.code === 'KeyP' && G.running) this.toggleShop(); if (e.code === 'Escape' && G.running) this.pause(!G.paused); });
    window.addEventListener('keyup', (e) => { if (e.code === 'Tab') this.el.board.classList.add('hidden'); });
  },
  show(name) { $$('.screen', this.root).forEach((s) => s.classList.remove('show')); $('#' + (name === 'hud' ? 'hud' : 'screen-' + name), this.root).classList.add('show'); this.current = name; if (this.preview) this.preview.running = name === 'lobby' || name === 'select' || name === 'end'; if (name === 'hud') this.el.overlay.style.display = 'block'; else this.el.overlay.style.display = 'none'; },
  setProgress(p, msg) { this.el.loadfill.style.width = Math.round(p * 100) + '%'; if (msg) this.el.loadtxt.textContent = msg; if (p >= 1) { this.el.btnStart.classList.remove('hidden'); } },
  pause(v) { G.paused = v; $('#pause', this.root).classList.toggle('hidden', !v); },

  // ---------- PREVIEW 3D ----------
  initPreview() { if (!this.preview) { this.preview = new HeroPreview($('#lb-preview', this.root)); } this.attachPreview('lb-preview'); this.preview.setHero(HERO_BY_ID[G.save.lastHero] || HEROES[0]); },
  attachPreview(id) { const box = $('#' + id, this.root); if (this.preview && this.preview.canvas.parentElement !== box) box.appendChild(this.preview.canvas); requestAnimationFrame(() => this.preview && this.preview.resize()); if (this.preview) { this.preview.running = true; this.preview.setHero(this.preview.def || HEROES[0]); } },

  // ---------- LOBBY ----------
  refreshLobby() {
    const s = G.save; const r = rankOf(s.stars); const q = (x) => $(x, this.root);
    q('#lb-name').textContent = s.name; q('#lb-level').textContent = s.level; q('#lb-xp').style.width = clamp(s.exp / (100 + s.level * 60) * 100, 0, 100) + '%';
    q('#lb-rank').innerHTML = `🏅 ${r.name} ${'★'.repeat(r.star)}${'☆'.repeat(4 - r.star)}`; q('#lb-coins').textContent = s.coins; q('#lb-record').textContent = `Thắng ${s.wins}/${s.games} trận`;
    const d = HERO_BY_ID[s.lastHero] || HEROES[0]; q('#lb-hname').textContent = d.name; q('#lb-hrole').textContent = d.role; q('#lb-avatar').textContent = ICON[d.id];
    if (this.preview && this.preview.def !== d) this.preview.setHero(d);
  },
  menu(k) {
    const s = G.save; const m = this.el.modal; const body = this.el.modalBody; m.classList.remove('hidden');
    if (k === 'hero') { m.classList.add('hidden'); this.openSelect(); return; }
    if (k === 'items') body.innerHTML = `<h3>🎒 Trang bị</h3><div class="item-grid">${ITEMS.map((i) => `<div class="item-card"><span class="ic">${i.icon}</span><b>${i.name}</b><small>${i.desc}</small><em>🪙 ${i.cost}</em></div>`).join('')}</div><h3>Ngọc & Phù hiệu</h3><div class="item-grid">${[...RUNES, ...BADGES].map((r) => `<div class="item-card"><span class="ic">💎</span><b>${r.name}</b></div>`).join('')}</div><p class="muted">Mua trang bị tại cửa hàng NPC trong căn cứ khi chơi (phím P).</p>`;
    if (k === 'shop') {
      body.innerHTML = `<h3>🛒 Cửa hàng tướng — 🪙 <b id="shop-coins">${s.coins}</b></h3><div class="item-grid">${HEROES.map((h) => { const own = s.unlocked.includes(h.id); return `<div class="item-card"><span class="ic" style="background:${grad(h)}">${ICON[h.id]}</span><b>${h.name}</b><small>${h.role}</small>${own ? '<em class="own">Đã sở hữu</em>' : `<button class="btn-sm" data-unlock="${h.id}">Mở khóa 🪙${h.cost}</button>`}</div>`; }).join('')}</div>`;
      $$('[data-unlock]', body).forEach((b) => b.addEventListener('click', () => { const h = HERO_BY_ID[b.dataset.unlock]; if (s.coins >= h.cost) { s.coins -= h.cost; s.unlocked.push(h.id); writeSave(); sfx('buff'); this.menu('shop'); this.refreshLobby(); } else b.textContent = 'Không đủ xu!'; }));
    }
    if (k === 'event') {
      const today = new Date().toDateString(); const can = s.lastDaily !== today;
      body.innerHTML = `<h3>🎁 Sự kiện</h3><div class="item-card wide"><b>Điểm danh hằng ngày</b><small>Nhận 200 xu mỗi ngày</small><button class="btn-sm" id="daily" ${can ? '' : 'disabled'}>${can ? 'Nhận 🪙200' : 'Đã nhận hôm nay'}</button></div><div class="item-card wide"><b>Thử thách: Hạ Tà Thần</b><small>Hạ Tà Thần trong 1 trận để nhận vinh quang (sắp có thưởng)</small></div>`;
      const d = $('#daily', body); d && d.addEventListener('click', () => { s.coins += 200; s.lastDaily = today; writeSave(); this.refreshLobby(); this.menu('event'); });
    }
    if (k === 'guild') body.innerHTML = `<h3>🏯 Bang hội</h3><p class="muted">Tính năng Bang hội sẽ có ở Phase 4 (multiplayer online qua WebSocket/Colyseus).</p><div class="item-card wide"><b>Bang: Chưa tham gia</b><small>Offline chỉ hỗ trợ chơi với bot.</small></div>`;
  },

  // ---------- CHỌN TƯỚNG ----------
  openSelect() {
    this.show('select'); this.attachPreview('sel-preview'); const s = G.save; this.sel.hero = s.unlocked.includes(s.lastHero) ? s.lastHero : 'binhan'; this.sel.rune = s.rune || 0; this.sel.badge = s.badge || 0; this.sel.start = s.start || 0;
    this.renderSelect(); let t = 30; $('#sel-count', this.root).textContent = t; clearInterval(this.cdTimer);
    this.cdTimer = setInterval(() => { if (this.current !== 'select') { clearInterval(this.cdTimer); return; } t--; $('#sel-count', this.root).textContent = t; if (t <= 0) { clearInterval(this.cdTimer); this.confirmSelect(); } }, 1000);
  },
  renderSelect() {
    const s = G.save; const grid = $('#sel-grid', this.root);
    grid.innerHTML = HEROES.map((h) => { const own = s.unlocked.includes(h.id); return `<div class="hcard ${this.sel.hero === h.id ? 'on' : ''} ${own ? '' : 'locked'}" data-id="${h.id}"><div class="hico" style="background:${grad(h)}">${ICON[h.id]}</div><b>${h.name}</b><small>${h.role}</small>${own ? '' : `<div class="lock">🔒 ${h.cost}🪙</div>`}</div>`; }).join('');
    $$('.hcard', grid).forEach((c) => c.addEventListener('click', () => { sfx('click'); this.sel.hero = c.dataset.id; this.renderSelect(); }));
    const h = HERO_BY_ID[this.sel.hero]; if (this.preview && this.preview.def !== h) this.preview.setHero(h); $('#sel-hname', this.root).textContent = h.name;
    const st = h.stats; const bar = (l, v, mx) => `<div class="stat"><span>${l}</span><div><i style="width:${Math.min(100, v / mx * 100)}%"></i></div><b>${Math.round(v)}</b></div>`;
    $('#sel-info', this.root).innerHTML = `<div class="ih"><b>${h.name}</b> <span>${h.role}</span> <em>Độ khó ${stars(h.diff)}</em></div><p class="blurb">${h.blurb}</p>
      ${bar('Máu', st.hp, 2200)}${bar('Công', st.atk, 110)}${bar('Phép', st.ap, 70)}${bar('Giáp', st.armor, 55)}${bar('Tốc chạy', st.speed * 10, 95)}${bar('Tầm đánh', st.range * 10, 120)}
      <div class="skl">${h.skills.map((k) => `<div class="sk"><span class="ic">${k.icon}</span><div><b>${k.key} • ${k.name}</b><small>${k.desc}</small></div></div>`).join('')}</div>
      <div class="opt"><label>💎 Ngọc</label><div class="seg sm" id="o-rune">${RUNES.map((r, i) => `<button data-v="${i}" class="${this.sel.rune === i ? 'on' : ''}" title="${r.name}">${['🔴', '🟢', '🟣'][i]}</button>`).join('')}</div>
      <label>🎖️ Phù hiệu</label><div class="seg sm" id="o-badge">${BADGES.map((r, i) => `<button data-v="${i}" class="${this.sel.badge === i ? 'on' : ''}" title="${r.name}">${['⚔️', '❤️', '💨'][i]}</button>`).join('')}</div>
      <label>🎒 Đồ khởi đầu</label><div class="seg sm" id="o-start">${['sword', 'staff', 'armor', 'boots'].map((id, i) => { const it = ITEMS.find((x) => x.id === id); return `<button data-v="${i}" class="${this.sel.start === i ? 'on' : ''}" title="${it.name} (${it.cost})">${it.icon}</button>`; }).join('')}</div></div>
      <div class="muted sm">${RUNES[this.sel.rune].name} • ${BADGES[this.sel.badge].name}</div>`;
    for (const [id, key] of [['o-rune', 'rune'], ['o-badge', 'badge'], ['o-start', 'start']]) $$('#' + id + ' button', this.root).forEach((b) => b.addEventListener('click', () => { sfx('click'); this.sel[key] = +b.dataset.v; this.renderSelect(); }));
    const own = s.unlocked.includes(h.id); const ok = $('#sel-ok', this.root); ok.textContent = own ? 'XÁC NHẬN' : `MỞ KHÓA 🪙${h.cost}`; ok.classList.toggle('dim', !own && s.coins < h.cost);
  },
  confirmSelect() {
    const s = G.save; const h = HERO_BY_ID[this.sel.hero];
    if (!s.unlocked.includes(h.id)) { if (s.coins >= h.cost) { s.coins -= h.cost; s.unlocked.push(h.id); writeSave(); sfx('buff'); this.renderSelect(); } return; }
    clearInterval(this.cdTimer); s.lastHero = h.id; s.rune = this.sel.rune; s.badge = this.sel.badge; s.start = this.sel.start; writeSave();
    this.handlers.startMatch({ heroId: h.id, mode: this.cfg.mode, diff: this.cfg.diff, rune: this.sel.rune, badge: this.sel.badge, start: this.sel.start });
  },

  // ---------- JOYSTICK ẢO ----------
  bindJoystick() {
    const zone = $('#joy-zone', this.root), base = $('#joy-base', this.root), knob = $('#joy-knob', this.root); let id = null, cx = 0, cy = 0; const R = 56;
    zone.addEventListener('pointerdown', (e) => { id = e.pointerId; zone.setPointerCapture(id); const r = zone.getBoundingClientRect(); cx = e.clientX; cy = e.clientY; base.style.left = (cx - r.left - 60) + 'px'; base.style.top = (cy - r.top - 60) + 'px'; this.joy.active = true; knob.style.transform = 'translate(0,0)'; e.preventDefault(); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx = dx / l * R; dy = dy / l * R; } knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / R; this.joy.y = dy / R; });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.joy.x = this.joy.y = 0; this.joy.active = false; knob.style.transform = 'translate(0,0)'; };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  },
  // ---------- NÚT SKILL (chạm = ngắm tự động, kéo = ngắm hướng) ----------
  bindSkillButtons() {
    const H = this.handlers;
    this.el.skills.forEach((btn) => {
      const i = +btn.dataset.i; let drag = null;
      btn.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false }; btn.setPointerCapture(e.pointerId); btn.classList.add('press'); e.preventDefault(); });
      btn.addEventListener('pointermove', (e) => { if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; if (Math.hypot(drag.dx, drag.dy) > 16) { drag.moved = true; const a = this.el.aim; a.classList.remove('hidden'); const l = Math.min(70, Math.hypot(drag.dx, drag.dy)); const ang = Math.atan2(drag.dy, drag.dx); a.style.left = (window.innerWidth / 2) + 'px'; a.style.top = (window.innerHeight / 2) + 'px'; a.style.transform = `rotate(${ang}rad) scaleX(${l / 70 + 0.4})`; } });
      const up = (e) => { if (!drag) return; btn.classList.remove('press'); this.el.aim.classList.add('hidden'); const d = drag; drag = null; if (e.type === 'pointercancel') return; H.cast(i, d.moved ? { x: d.dx, y: d.dy } : null); };
      btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    });
  },

  // ---------- HUD ----------
  initHUD() {
    const h = G.player; this.hudHero = h; this.el.skills.forEach((b, i) => { const sk = h.def.skills[i]; b.innerHTML = `<span class="ic">${sk.icon}</span><span class="key">${sk.key}</span><div class="cdo"></div><span class="cdt"></span><span class="lk"></span>`; b.title = `${sk.name}: ${sk.desc}`; });
    this.el.feed.innerHTML = ''; this.floaters = []; this.buildItems(); this.el.shop.classList.add('hidden'); this.el.board.classList.add('hidden'); this.resizeOverlay();
    this.miniBg = null; this.hudT = 0;
  },
  resizeOverlay() { const dpr = Math.min(window.devicePixelRatio || 1, 2); this.el.overlay.width = window.innerWidth * dpr; this.el.overlay.height = window.innerHeight * dpr; this.odpr = dpr; },
  buildItems() { const h = G.player; this.el.items.innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="islot" data-i="${i}">${h.items[i] ? h.items[i].icon : ''}</div>`).join(''); $$('.islot', this.el.items).forEach((s) => s.addEventListener('click', () => { const i = +s.dataset.i; if (G.player.items[i] && G.player.inBase) { this.handlers.sell(i); this.buildItems(); this.buildShop(); } })); },
  updateHUD(dt) {
    const h = G.player; if (!h) return; this.hudT -= dt;
    const e = this.el; e.hp.style.width = (h.hp / h.maxHp * 100) + '%'; e.mp.style.width = (h.mana / h.maxMana * 100) + '%'; e.xp.style.width = (h.level >= 15 ? 100 : h.exp / expToNext(h) * 100) + '%';
    e.hptxt.textContent = `${Math.ceil(h.hp)} / ${h.maxHp}` + (h.shieldAmt > 0 ? ` (+${Math.ceil(h.shieldAmt)})` : '');
    e.skills.forEach((b, i) => { const sk = h.def.skills[i]; const cd = h.cd[i]; const lv = skillLevel(h, i); const total = sk.cd * (1 - h.stats.cdr); b.classList.toggle('off', lv <= 0 || h.mana < sk.mana); b.classList.toggle('ready', cd <= 0 && lv > 0 && h.mana >= sk.mana); $('.cdo', b).style.height = cd > 0 ? (cd / total * 100) + '%' : '0'; $('.cdt', b).textContent = cd > 0 ? Math.ceil(cd) : ''; $('.lk', b).textContent = lv <= 0 ? 'Lv4' : ''; });
    const hb = e.healBtn; const hc = h.healCd; hb.classList.toggle('cd', hc > 0); $('i', hb).textContent = hc > 0 ? Math.ceil(hc) : '';
    if (this.hudT > 0) return; this.hudT = 0.12;
    e.lv.textContent = h.level; e.gold.textContent = Math.floor(h.gold); const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60); e.time.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.score.b.textContent = G.kills[0]; this.score.r.textContent = G.kills[1]; e.kda.textContent = `${h.kills}/${h.deaths}/${h.assists}  •  CS ${h.cs}  •  ${DIFF[G.difficulty].name}`;
    e.shopBtn.classList.toggle('hidden', !h.inBase); if (!h.inBase && !e.shop.classList.contains('hidden')) e.shop.classList.add('hidden');
    const bf = []; if (h.buffs.blue > 0) bf.push(`<span class="bf b" title="Bùa Xanh">🔵 ${Math.ceil(h.buffs.blue)}</span>`); if (h.buffs.red > 0) bf.push(`<span class="bf r" title="Bùa Đỏ">🔴 ${Math.ceil(h.buffs.red)}</span>`); const tb = G.teamBuff[h.team]; if (tb.dragon > 0) bf.push(`<span class="bf d">🐉 ${Math.ceil(tb.dragon)}</span>`); if (tb.baron > 0) bf.push(`<span class="bf n">👹 ${Math.ceil(tb.baron)}</span>`); if (h.recallT > 0) bf.push(`<span class="bf">🏠 ${h.recallT.toFixed(1)}</span>`);
    e.buffs.innerHTML = bf.join('');
    $$('.islot', e.items).forEach((s, i) => { const t = h.items[i] ? h.items[i].icon : ''; if (s.textContent !== t) s.textContent = t; });
    while (G.events.length) this.handleEvent(G.events.shift());
  },
  handleEvent(ev) {
    if (ev.type === 'feed') this.feedMsg(ev.text, ev.team);
    else if (ev.type === 'banner') this.banner(ev.text, ev);
    else if (ev.type === 'dmg') this.floaters.push({ x: ev.x, y: ev.y, z: ev.z, text: ev.text, color: ev.color, t: 0, big: ev.big });
    else if (ev.type === 'gold') this.floaters.push({ x: ev.x, y: ev.y, z: ev.z, text: '+' + ev.n + '🪙', color: '#ffd24a', t: 0 });
  },
  feedMsg(text, team) { const d = document.createElement('div'); d.className = 'fi t' + team; d.textContent = text; this.el.feed.prepend(d); while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove(); setTimeout(() => d.remove(), 6000); },
  banner(text, o = {}) { const b = this.el.banner; b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show ' + (o.red ? 'red' : o.gold ? 'gold' : ''); },

  // ---------- SHOP ----------
  toggleShop() { const p = this.el.shop; if (p.classList.contains('hidden')) { if (!G.player.inBase) { this.feedMsg('Chỉ mua đồ được ở căn cứ!', 0); return; } this.buildShop(); p.classList.remove('hidden'); } else p.classList.add('hidden'); },
  buildShop() {
    const h = G.player; const p = this.el.shop;
    p.innerHTML = `<div class="shop-head"><b>🛒 CỬA HÀNG</b><span>🪙 ${Math.floor(h.gold)}</span><button class="modal-x" id="shop-x">✕</button></div><div class="item-grid">${ITEMS.map((i) => `<button class="item-card buy ${h.gold >= i.cost && h.items.length < 6 ? '' : 'dim'}" data-id="${i.id}"><span class="ic">${i.icon}</span><b>${i.name}</b><small>${i.desc}</small><em>🪙 ${i.cost}</em></button>`).join('')}</div><div class="muted sm">Bấm ô trang bị ở dưới HUD để bán lại (70%). Tối đa 6 ô.</div>`;
    $$('.buy', p).forEach((b) => b.addEventListener('click', () => { if (this.handlers.buy(b.dataset.id)) { sfx('buff'); this.buildShop(); this.buildItems(); } }));
    $('#shop-x', p).addEventListener('click', () => p.classList.add('hidden'));
  },
  buildBoard() {
    const row = (h) => `<tr class="${h === G.player ? 'me' : ''}"><td>${ICON[h.def.id]} ${h.name}</td><td>Lv${h.level}</td><td>${h.kills}/${h.deaths}/${h.assists}</td><td>${h.cs}</td><td>${Math.floor(h.goldTotal || 0)}</td></tr>`;
    const tbl = (team, title) => `<div class="bt t${team}"><h4>${title}</h4><table><tr><th>Tướng</th><th>Cấp</th><th>K/D/A</th><th>CS</th><th>Vàng</th></tr>${G.heroes.filter((h) => h.team === team).map(row).join('')}</table></div>`;
    this.el.board.innerHTML = tbl(0, '🔵 ĐỘI XANH') + tbl(1, '🔴 ĐỘI ĐỎ');
  },

  // ---------- OVERLAY 2D: thanh máu, tên, số sát thương ----------
  drawOverlay(camera, dt) {
    const c = this.octx, W = this.el.overlay.width, Hh = this.el.overlay.height, dpr = this.odpr; c.clearRect(0, 0, W, Hh); c.save(); c.scale(dpr, dpr);
    const w = W / dpr, h = Hh / dpr; const v = this._v || (this._v = new THREE.Vector3());
    const proj = (x, y, z) => { v.set(x, y, z).project(camera); if (v.z > 1) return null; return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h }; };
    c.textAlign = 'center'; c.font = '600 11px system-ui,sans-serif';
    const me = G.player;
    for (const u of G.units) {
      if (!u.alive) continue; if (u.team !== 0 && !u.seenBy[0] && u.kind !== 'tower' && u.kind !== 'nexus') continue; if (u.kind === 'hero' && u.team !== 0 && u.stealthT > 0 && !u.seenBy[0]) continue;
      const off = u.kind === 'hero' ? u.def.height + 0.7 : u.kind === 'tower' ? u.towerY + 1.8 : u.kind === 'nexus' ? 9 : u.kind === 'monster' ? u.radius * 2 + 1.2 : 2.3;
      const p = proj(u.pos.x, u.pos.y + off + u.lift, u.pos.z); if (!p || p.x < -80 || p.x > w + 80 || p.y < -50 || p.y > h + 50) continue;
      const ally = u.team === 0; const col = u.team === 2 ? '#e6c84a' : ally ? (u === me ? '#4dff88' : '#4da6ff') : '#ff4d4d';
      const bw = u.kind === 'hero' ? 62 : u.kind === 'tower' ? 84 : u.kind === 'nexus' ? 130 : u.kind === 'monster' ? 70 : 28; const bh = u.kind === 'hero' ? 7 : u.kind === 'minion' ? 4 : 8;
      if (u.kind === 'minion' && u.hp >= u.maxHp && !(u === (me && me.target))) { /* lính đầy máu: vẫn vẽ mảnh */ }
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(p.x - bw / 2 - 1, p.y - 1, bw + 2, bh + 2);
      c.fillStyle = col; c.fillRect(p.x - bw / 2, p.y, bw * Math.max(0, u.hp / u.maxHp), bh);
      if (u.shieldAmt > 0) { c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(p.x - bw / 2, p.y - 2, bw * Math.min(1, u.shieldAmt / u.maxHp), 2); }
      if (u.kind === 'hero') { c.fillStyle = 'rgba(40,120,255,.9)'; c.fillRect(p.x - bw / 2, p.y + bh + 1, bw * Math.max(0, u.mana / u.maxMana), 2); c.fillStyle = '#fff'; c.shadowColor = '#000'; c.shadowBlur = 3; c.fillText(`Lv${u.level} ${u.name}`, p.x, p.y - 4); c.shadowBlur = 0;
        if (u.stunT > 0) { c.fillStyle = '#ffe14d'; c.fillText('💫', p.x, p.y - 16); } if (u.recallT > 0) { c.fillStyle = '#6cf'; c.fillText('🏠 ' + u.recallT.toFixed(1), p.x, p.y - 16); } }
      else if (u.kind === 'monster') { c.fillStyle = '#fff'; c.fillText(u.name, p.x, p.y - 4); }
    }
    // số nổi
    c.font = '800 18px system-ui,sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)';
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.t += dt; if (f.t > 1.1) { this.floaters.splice(i, 1); continue; } const p = proj(f.x, f.y + f.t * 1.4, f.z); if (!p) continue; c.globalAlpha = 1 - f.t / 1.1; c.font = `800 ${f.big ? 22 : 17}px system-ui,sans-serif`; c.strokeText(f.text, p.x, p.y); c.fillStyle = f.color; c.fillText(f.text, p.x, p.y); }
    c.globalAlpha = 1; c.restore();
  },

  // ---------- MINIMAP ----------
  drawMinimap(camera, groundPick) {
    const c = this.mctx, S = this.el.minimap.width, k = S / 200; const P = (v) => (v + 100) * k;
    if (!this.miniBg && TERRAIN_CANVAS) { const bg = document.createElement('canvas'); bg.width = bg.height = S; const x = bg.getContext('2d'); x.drawImage(TERRAIN_CANVAS, 0, 0, S, S); x.fillStyle = 'rgba(8,16,30,.35)'; x.fillRect(0, 0, S, S); this.miniBg = bg; }
    c.clearRect(0, 0, S, S); if (this.miniBg) c.drawImage(this.miniBg, 0, 0);
    const col = (t) => t === 0 ? '#4da6ff' : t === 1 ? '#ff5050' : '#e6c84a';
    for (const cp of G.camps || []) if (cp.monster && cp.monster.alive && (cp.type === 'dragon' || cp.type === 'baron')) { c.fillStyle = cp.type === 'dragon' ? '#ff8a1a' : '#c050ff'; c.beginPath(); c.arc(P(cp.x), P(cp.z), 5, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); } else if (cp.monster && cp.monster.alive && cp.monster.seenBy[0]) { c.fillStyle = '#e6c84a'; c.fillRect(P(cp.x) - 2, P(cp.z) - 2, 4, 4); }
    for (const u of G.units) {
      if (!u.alive) continue;
      if (u.kind === 'tower') { c.fillStyle = col(u.team); c.fillRect(P(u.pos.x) - 3, P(u.pos.z) - 3, 6, 6); c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(P(u.pos.x) - 3, P(u.pos.z) - 3, 6, 6); }
      else if (u.kind === 'nexus') { c.fillStyle = col(u.team); c.beginPath(); c.arc(P(u.pos.x), P(u.pos.z), 7, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.stroke(); }
      else if (u.kind === 'minion') { if (u.team !== 0 && !u.seenBy[0]) continue; c.fillStyle = col(u.team); c.fillRect(P(u.pos.x) - 1, P(u.pos.z) - 1, 2.4, 2.4); }
      else if (u.kind === 'hero') { if (u.team !== 0 && !u.seenBy[0]) continue; c.fillStyle = col(u.team); c.beginPath(); c.arc(P(u.pos.x), P(u.pos.z), u === G.player ? 5.5 : 4.5, 0, 6.3); c.fill(); c.strokeStyle = u === G.player ? '#4dff88' : '#fff'; c.lineWidth = u === G.player ? 2 : 1; c.stroke(); }
    }
    // khung nhìn camera
    if (groundPick) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.beginPath(); [[-1, 1], [1, 1], [1, -1], [-1, -1]].forEach(([sx, sy], i) => { const p = groundPick(sx, sy); if (!p) return; i ? c.lineTo(P(p.x), P(p.z)) : c.moveTo(P(p.x), P(p.z)); }); c.closePath(); c.stroke(); }
  },

  // ---------- KẾT THÚC ----------
  showEnd(data) {
    this.show('end'); this.attachPreview('end-preview'); const win = data.win; const q = (x) => $(x, this.root);
    q('#end-title').className = win ? 'win' : 'lose'; q('#end-title').innerHTML = win ? '<span>🏆</span>CHIẾN THẮNG' : '<span>💀</span>THẤT BẠI';
    const def = G.player.def; this.preview.setHero(def); clearInterval(this.endAnim); this.preview.state = win ? 'cast' : 'death'; this.preview.stT = 0; this.preview.loopWin = win;
    q('#end-reward').innerHTML = `<div>+<b>${data.coins}</b> 🪙 xu</div><div>+<b>${data.exp}</b> EXP tài khoản${data.levelUp ? ' • <em>LÊN CẤP!</em>' : ''}</div><div>${data.starDelta >= 0 ? '+' : ''}${data.starDelta} ⭐ Rank → <b>${data.rank}</b></div>`;
    const row = (h) => `<tr class="${h === G.player ? 'me' : ''}"><td>${ICON[h.def.id]} ${h.name}</td><td>${h.level}</td><td>${h.kills}/${h.deaths}/${h.assists}</td><td>${h.cs}</td><td>${Math.floor(h.goldTotal || 0)}</td></tr>`;
    const tbl = (t, title) => `<div class="bt t${t}"><h4>${title} — ${G.kills[t]} hạ gục</h4><table><tr><th>Tướng</th><th>Cấp</th><th>K/D/A</th><th>CS</th><th>Vàng</th></tr>${G.heroes.filter((h) => h.team === t).map(row).join('')}</table></div>`;
    q('#end-table').innerHTML = tbl(0, '🔵 ĐỘI XANH') + tbl(1, '🔴 ĐỘI ĐỎ'); sfx(win ? 'win' : 'lose');
  },
};
export { MAP_3D, BASE_INFO };
