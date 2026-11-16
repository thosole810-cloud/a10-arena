// ============================================================
// net.js — KẾT NỐI ONLINE (WebSocket) cho A10 ARENA
// Client gửi: tạo phòng / vào mã / ghép nhanh / ready / hero / chat / input / snapshot
// Server (server.js) phát lại cho cả phòng.
// ============================================================
import { G } from './state.js';

export const NET = {
  ws: null, id: null, code: null, owner: null, players: [],
  active: false, started: false, sentOver: false,
  url: '', status: 'Chưa kết nối',
  inputs: [],        // input từ người chơi khác (chờ áp dụng)
  snap: null,        // snapshot mới nhất từ host
  snapT: 0,          // đếm ngược gửi snapshot (host)
  overMsg: null,     // host báo trận kết thúc
  myName: '', myHero: 'binhan',
  cbs: [],
};

// Địa chỉ mặc định: dev là localhost; trang https (GitHub Pages) thì phải nhập tay
export function defaultNetUrl() {
  if (location.protocol === 'http:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return `ws://${location.hostname || 'localhost'}:8787`;
  }
  return '';
}

export function onNet(cb) { NET.cbs.push(cb); }
const emit = (type, data = {}) => { for (const cb of NET.cbs) { try { cb({ type, ...data }); } catch (e) { console.error(e); } } };

function reset() {
  NET.ws = null; NET.active = false; NET.id = null; NET.code = null; NET.owner = null;
  NET.players = []; NET.started = false; NET.sentOver = false;
  NET.inputs = []; NET.snap = null; NET.overMsg = null;
}

export function netConnect(url, action) {
  if (NET.ws && NET.ws.readyState === 1 && NET.url === url) { action && action(); return; }
  if (NET.ws) { try { NET.ws.close(); } catch (e) { /* bỏ qua */ } reset(); }
  NET.url = url; NET.status = 'Đang kết nối...'; emit('status');
  let ws;
  try { ws = new WebSocket(url); } catch (e) { NET.status = 'Sai địa chỉ máy chủ!'; emit('status'); return; }
  NET.ws = ws;
  ws.onopen = () => { NET.active = true; NET.status = 'Đã kết nối ✓'; emit('status'); action && action(); };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } msg(m); };
  ws.onclose = () => { const was = NET.active; const st = NET.status; reset(); NET.status = st === 'Đã kết nối ✓' ? 'Mất kết nối' : st; emit('status'); if (was) emit('closed'); };
  ws.onerror = () => { NET.status = 'Không kết nối được máy chủ!'; emit('status'); };
}

export function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }

export function leaveRoom() {
  if (NET.active) netSend({ t: 'leave' });
  const st = NET.status; reset(); NET.status = st; emit('room'); emit('status');
}

export const createRoom = () => netSend({ t: 'create', name: NET.myName, hero: NET.myHero });
export const joinRoom = (code) => netSend({ t: 'join', code });
export const quickMatch = () => netSend({ t: 'quick', name: NET.myName, hero: NET.myHero });
export const setReady = () => netSend({ t: 'ready' });
export const setHero = (id) => { NET.myHero = id; netSend({ t: 'hero', v: id }); };
export const setName = (n) => { NET.myName = n; netSend({ t: 'name', v: n }); };
export const startGame = (diff) => netSend({ t: 'start', diff });
export const sendChat = (text) => netSend({ t: 'chat', text });
export const sendInput = (m) => { if (NET.active) netSend({ t: 'in', m }); };
export const sendSnap = (s) => { if (NET.active) netSend({ t: 'st', s }); };
export const sendOver = (w) => { if (NET.active) netSend({ t: 'over', w }); };

function msg(m) {
  switch (m.t) {
    case 'hi': NET.id = m.id; break;
    case 'joined': NET.code = m.code; NET.id = m.you; NET.owner = m.owner; break;
    case 'room': NET.code = m.code; NET.owner = m.owner; NET.players = m.players; emit('room'); break;
    case 'start': NET.players = m.players; NET.started = true; NET.sentOver = false; emit('start', { players: m.players, diff: m.diff }); break;
    case 'chat': emit('chat', { id: m.id, name: m.name, text: m.text }); break;
    case 'err': NET.status = m.msg; emit('status'); emit('err', { msg: m.msg }); break;
    case 'left': emit('left', { id: m.id }); break;
    case 'in': if (m.id !== NET.id) { NET.dbgRecv = (NET.dbgRecv || 0) + 1; NET.inputs.push({ id: m.id, m: m.m }); } break;
    case 'st': NET.snap = m.s; break;
    case 'over': NET.overMsg = m.w; break;
  }
}

// Lấy tên/tướng đã lưu vào state cho lần kết nối sau
export function prepNetIdentity(save) {
  NET.myName = (save && save.name) || 'Người chơi';
  NET.myHero = (save && save.lastHero) || 'binhan';
}
void G;
