// ============================================================
// net.js — CHẾ ĐỘ ONLINE cho A10 ARENA (KHÔNG CẦN SERVER RIÊNG)
// Dùng broker MQTT công cộng làm "trạm relay": host tạo phòng, bạn bè
// vào bằng mã — mọi tin nhắn đi qua topic a10/room/<CODE>/... .
// - Không WebRTC / NAT: mọi mạng đều vào được, kể cả 4G/CGNAT.
// - Host là người tạo phòng: chạy mô phỏng, gửi snapshot, relay input.
// - GHÉP TRẬN NHANH: phòng công bố mã qua retained message, người ghép
//   đọc danh sách rồi vào phòng đang mở; không có thì tự tạo phòng.
// ============================================================
import { G } from './state.js';
import { mqttSession } from './mqtt.js';

const enc = (o) => JSON.stringify(o);
const parse = (raw) => { try { return JSON.parse(raw); } catch (e) { return null; } };
const inTopic = (code, gid) => `a10/room/${code}/in/${gid}`;
const outTopic = (code) => `a10/room/${code}/out`;
const announceTopic = (code) => `a10/room/${code}`;
const rid = () => 'g' + Math.random().toString(36).slice(2, 10);
const makeCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

export const NET = {
  session: null, gid: null, code: null, owner: null, players: [],
  isHost: false, active: false, started: false, sentOver: false,
  status: 'Chưa kết nối',
  inputs: [], snap: null, snapT: 0, overMsg: null,  // dùng bởi main.js
  myName: '', myHero: 'binhan', cbs: [],
  diag: [], _joinFail: null,
};
export function onNet(cb) { NET.cbs.push(cb); }
const emit = (type, data = {}) => { for (const cb of NET.cbs) { try { cb({ type, ...data }); } catch (e) { console.error(e); } } };
const trace = (s) => { NET.diag.push(Date.now() % 100000 + ' ' + s); if (NET.diag.length > 60) NET.diag.shift(); };
function setStatus(s) { NET.status = s; emit('status'); }
const roster = () => NET.players.map((p) => ({ id: p.id, name: p.name, hero: p.hero, ready: p.ready }));
const pub = (topic, o) => { try { if (NET.session && NET.session.ready) NET.session.publish(topic, enc(o)); } catch (e) { trace('pub ERR ' + e.message); } };
const sendOut = (o) => pub(outTopic(NET.code), o);

// ---------- quảng bá phòng (cho GHÉP TRẬN NHANH) ----------
let annTimer = null;
function publishAnn() {
  if (!NET.isHost || !NET.code) return;
  const joinable = !NET.started && NET.players.length < 5;
  try { if (NET.session && NET.session.ready) NET.session.publish(announceTopic(NET.code), joinable ? String(NET.players.length) : '', true); } catch (e) { /* */ }
}
function announceOff() {
  if (annTimer) clearInterval(annTimer); annTimer = null;
  if (NET.code) { try { if (NET.session && NET.session.ready) NET.session.publish(announceTopic(NET.code), '', true); } catch (e) { /* */ } }
}
function startAnnounce() {
  publishAnn();
  annTimer = setInterval(publishAnn, 8000);
}

// ---------- dọn / mất kết nối ----------
function resetState(closeSession = true) {
  announceOff();
  if (closeSession && NET.session) { try { NET.session.close(); } catch (e) { /* */ } }
  NET.session = null;
  NET.code = NET.gid = NET.owner = null; NET.players = [];
  NET.isHost = NET.active = NET.started = NET.sentOver = false;
  NET.inputs = []; NET.snap = null; NET.overMsg = null; NET._joinFail = null;
}
function onGone() {
  if (!NET.active && !NET.session) return;
  const was = NET.active;
  resetState();
  NET.status = 'Mất kết nối'; emit('status');
  if (was) emit('closed');
}

// ---------- HOST ----------
function hostOnMsg(topic, payload) {
  const m = /^a10\/room\/([A-Z0-9]{4})\/in\/([A-Za-z0-9]+)$/.exec(topic);
  if (!m || m[1] !== NET.code) return;
  const gid = m[2];
  const msg = parse(payload); if (!msg) return;
  const me = NET.players.find((p) => p.id === gid);
  switch (msg.t) {
    case 'join': {
      if (NET.started) { sendOut({ t: 'err', to: gid, msg: 'Trận trong phòng này đang diễn ra.' }); return; }
      if (NET.players.length >= 5) { sendOut({ t: 'err', to: gid, msg: 'Phòng đã đầy (tối đa 5 người).' }); return; }
      NET.players.push({ id: gid, name: String(msg.name || '').slice(0, 16) || 'Người chơi', hero: String(msg.hero || 'binhan').slice(0, 20), ready: false });
      broadcastRoom();
      break;
    }
    case 'ready': if (me) { me.ready = !me.ready; broadcastRoom(); } break;
    case 'name': if (me) { me.name = String(msg.v || '').slice(0, 16) || me.name; broadcastRoom(); } break;
    case 'hero': if (me) { me.hero = String(msg.v || 'binhan').slice(0, 20); broadcastRoom(); } break;
    case 'chat': {
      const text = String(msg.text || '').slice(0, 120);
      const name = me ? me.name : 'Người chơi';
      sendOut({ t: 'chat', id: gid, name, text });
      emit('chat', { id: gid, name, text }); // host tự thấy
      break;
    }
    case 'in':
      NET.dbgRecv = (NET.dbgRecv || 0) + 1;
      NET.inputs.push({ id: gid, m: msg.m });
      sendOut({ t: 'in', id: gid, m: msg.m });    // các khách khác thấy người này di chuyển
      break;
    case 'leave': removeGuest(gid); break;
  }
}
function removeGuest(id) {
  const i = NET.players.findIndex((p) => p.id === id);
  if (i >= 0 && id !== NET.id) {
    NET.players.splice(i, 1);
    sendOut({ t: 'left', id });
    broadcastRoom();
  }
}
function broadcastRoom() {
  sendOut({ t: 'room', code: NET.code, owner: NET.owner, players: roster() });
  emit('room'); // host tự cập nhật giao diện
  publishAnn();
}

// ---------- KHÁCH ----------
function guestMsg(msg) {
  switch (msg.t) {
    case 'room':
      NET.code = msg.code; NET.owner = msg.owner; NET.players = msg.players;
      emit('room');
      break;
    case 'err': emit('err', { msg: msg.msg }); break;
    case 'chat': emit('chat', { id: msg.id, name: msg.name, text: msg.text }); break;
    case 'start':
      NET.players = msg.players; NET.started = true; NET.sentOver = false;
      emit('start', { players: msg.players, diff: msg.diff, mode: msg.mode || '5v5' });
      break;
    case 'in': if (msg.id !== NET.id) { NET.dbgRecv = (NET.dbgRecv || 0) + 1; NET.inputs.push({ id: msg.id, m: msg.m }); } break;
    case 'st': NET.snap = msg.s; break;
    case 'over': NET.overMsg = msg.w; break;
    case 'left': emit('left', { id: msg.id }); break;
    case 'closed': emit('closed'); break;
  }
}

// ---------- vào phòng (dùng cho VÀO PHÒNG và GHÉP NHANH) ----------
function joinInternal(code, timeoutMs, onFail) {
  NET.code = code; NET.owner = null; NET.isHost = false; NET.active = true; NET.gid = rid();
  let gotRoom = false, timer = null;
  const out = outTopic(code);
  NET.session = mqttSession(
    (topic, payload) => {
      if (topic !== out) return;
      const msg = parse(payload); if (!msg) return;
      if (msg.to && msg.to !== NET.gid) return;
      if (msg.t === 'room' && !gotRoom) { gotRoom = true; clearTimeout(timer); setStatus('Đã kết nối ✓'); }
      if (msg.t === 'err' && !gotRoom) { clearTimeout(timer); onFail(msg.msg); return; }
      guestMsg(msg);
    },
    () => {
      NET.session.subscribe(out);
      NET.session.publish(inTopic(code, NET.gid), enc({ t: 'join', name: NET.myName, hero: NET.myHero }));
      timer = setTimeout(() => { if (!gotRoom) onFail('Không tìm thấy phòng hoặc phòng đã đầy!'); }, timeoutMs);
    },
    () => onFail('Không kết nối được mạng — thử lại!'),
  );
}

// ---------- HÀNH ĐỘNG CÔNG KHAI ----------
export function createRoom() {
  resetState(); emit('room');
  setStatus('Đang tạo phòng...');
  const code = makeCode();
  NET.code = code; NET.owner = 'H'; NET.gid = 'H'; NET.isHost = true; NET.active = true;
  NET.players = [{ id: 'H', name: NET.myName || 'Người chơi', hero: NET.myHero, ready: false }];
  NET.session = mqttSession(
    (topic, payload) => { if (topic.startsWith(`a10/room/${code}/in/`)) hostOnMsg(topic, payload); },
    () => {
      NET.session.subscribe(`a10/room/${code}/in/+`);
      startAnnounce();
      setStatus('Đã kết nối ✓'); emit('room');
    },
    () => { setStatus('Không kết nối được mạng — thử lại!'); emit('err', { msg: 'Không kết nối được mạng!' }); },
  );
}

export function joinRoom(code) {
  resetState(); emit('room');
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) { setStatus('Mã phòng gồm 4 ký tự!'); emit('err', { msg: 'Mã phòng gồm 4 ký tự!' }); return; }
  setStatus('Đang vào phòng ' + code + '...');
  joinInternal(code, 6000, (msg) => { setStatus(msg); emit('err', { msg }); leaveRoom(); });
}

export function quickMatch() {
  resetState(); emit('room');
  setStatus('Đang tìm phòng đang mở...');
  const found = new Set();
  const s = mqttSession(
    (topic) => { const m = topic.match(/^a10\/room\/([A-Z0-9]{4})$/); if (m) found.add(m[1]); },
    () => {
      s.subscribe('a10/room/+');
      setTimeout(() => {
        s.close();
        const codes = [...found];
        if (!codes.length) { setStatus('Chưa có phòng trống — tạo phòng mới...'); createRoom(); return; }
        const tryAt = (i) => {
          if (i >= codes.length) { setStatus('Chưa vào được phòng nào — tạo phòng mới...'); createRoom(); return; }
          setStatus('Đang thử vào phòng ' + codes[i] + '...');
          joinInternal(codes[i], 3000, () => { tryAt(i + 1); });
        };
        tryAt(0);
      }, 1700);
    },
    () => { setStatus('Chưa có phòng trống — tạo phòng mới...'); createRoom(); },
  );
}

export function leaveRoom() {
  if (NET.session && !NET.isHost) pub(inTopic(NET.code, NET.gid), { t: 'leave' });
  if (NET.isHost) sendOut({ t: 'closed' }); // báo khách biết host rời phòng
  const st = NET.status;
  resetState();
  NET.status = st; emit('room'); emit('status');
}

export const setReady = () => {
  if (NET.isHost) { const me = NET.players.find((p) => p.id === NET.id); if (me) { me.ready = !me.ready; broadcastRoom(); } }
  else pub(inTopic(NET.code, NET.gid), { t: 'ready' });
};
export const setName = (n) => {
  NET.myName = n;
  if (NET.isHost) { const me = NET.players.find((p) => p.id === NET.id); if (me) { me.name = n; broadcastRoom(); } }
  else pub(inTopic(NET.code, NET.gid), { t: 'name', v: n });
};
export const setHero = (id) => {
  NET.myHero = id;
  if (NET.isHost) { const me = NET.players.find((p) => p.id === NET.id); if (me) { me.hero = id; broadcastRoom(); } }
  else pub(inTopic(NET.code, NET.gid), { t: 'hero', v: id });
};
export const startGame = (diff, mode) => {
  if (!NET.isHost) return;
  NET.started = true; NET.sentOver = false;
  const players = roster();
  const md = mode || '5v5';
  sendOut({ t: 'start', players, diff: diff | 0, mode: md });
  publishAnn(); // ngừng quảng bá phòng
  emit('start', { players, diff: diff | 0, mode: md });
};
export const sendChat = (text) => {
  const t = String(text || '').slice(0, 120); if (!t) return;
  if (NET.isHost) {
    const name = (NET.players.find((p) => p.id === NET.id) || {}).name || 'Bạn';
    sendOut({ t: 'chat', id: NET.id, name, text: t });
    emit('chat', { id: NET.id, name, text: t });
  } else pub(inTopic(NET.code, NET.gid), { t: 'chat', text: t });
};
export const sendInput = (m) => {
  if (!NET.active) return;
  if (NET.isHost) sendOut({ t: 'in', id: NET.id, m });
  else pub(inTopic(NET.code, NET.gid), { t: 'in', m });
};
export const sendSnap = (s) => { if (NET.isHost) sendOut({ t: 'st', s }); };
export const sendOver = (w) => { if (NET.isHost) sendOut({ t: 'over', w }); };
export function prepNetIdentity(save) {
  NET.myName = (save && save.name) || 'Người chơi';
  NET.myHero = (save && save.lastHero) || 'binhan';
}
export const netSend = () => { /* legacy */ };
