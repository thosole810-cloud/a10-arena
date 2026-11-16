// ============================================================
// server.js — MÁY CHỦ ONLINE cho A10 ARENA
// Tạo phòng / vào bằng mã / ghép trận nhanh / chat / relay input + snapshot
// Chạy:  npm run server     (mặc định cổng 8787)
// Bạn bè kết nối bằng: ws://<IP máy bạn>:8787
// ============================================================
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map(); // mã phòng -> room
let seq = 1;

const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const toRoom = (room, o, except) => { for (const p of room.players.values()) if (p.ws !== except) send(p.ws, o); };
const roster = (room) => [...room.players.values()].map((p) => ({ id: p.id, name: p.name, hero: p.hero, ready: p.ready }));
const pushRoom = (room) => toRoom(room, { t: 'room', code: room.code, owner: room.owner, players: roster(room) });

function mkCode() {
  let c;
  do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c));
  return c;
}
function newRoom() {
  const room = { code: mkCode(), owner: null, started: false, players: new Map() };
  rooms.set(room.code, room);
  return room;
}
function joinRoom(ws, room) {
  if (room.players.size >= 5) { send(ws, { t: 'err', msg: 'Phòng đã đầy (tối đa 5 người).' }); return; }
  ws.room = room;
  room.players.set(ws.uid, { id: ws.uid, name: ws.name, hero: ws.hero, ready: false, ws });
  if (!room.owner) room.owner = ws.uid;
  send(ws, { t: 'joined', code: room.code, you: ws.uid, owner: room.owner });
  pushRoom(room);
  console.log(`[${room.code}] ${ws.name} vào phòng (${room.players.size} người)`);
}
function leave(ws) {
  const room = ws.room; if (!room) return;
  ws.room = null;
  room.players.delete(ws.uid);
  console.log(`[${room.code}] ${ws.name} rời phòng`);
  if (!room.players.size) { rooms.delete(room.code); return; }
  if (room.owner === ws.uid) room.owner = [...room.players.keys()][0];
  toRoom(room, { t: 'left', id: ws.uid });
  pushRoom(room);
}

wss.on('connection', (ws) => {
  ws.uid = 'p' + seq++;
  ws.name = 'Người chơi ' + ws.uid.slice(1);
  ws.hero = 'binhan';
  ws.room = null;
  send(ws, { t: 'hi', id: ws.uid });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    try { handle(ws, m); } catch (e) { console.error(e); }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});

function handle(ws, m) {
  const room = ws.room;
  if (m.t !== 'in' && m.t !== 'st') console.log(new Date().toISOString().slice(11, 19), ws.uid, '->', m.t, m.code || m.diff || '');
  switch (m.t) {
    case 'name':
      ws.name = String(m.v || '').slice(0, 16) || ws.name;
      if (room) { const p = room.players.get(ws.uid); if (p) p.name = ws.name; pushRoom(room); }
      break;
    case 'hero':
      ws.hero = String(m.v || 'binhan').slice(0, 20);
      if (room) { const p = room.players.get(ws.uid); if (p) p.hero = ws.hero; pushRoom(room); }
      break;
    case 'create':
      if (room) leave(ws);
      joinRoom(ws, newRoom());
      break;
    case 'join': {
      const r = rooms.get(String(m.code || '').trim().toUpperCase());
      if (!r) { send(ws, { t: 'err', msg: 'Không tìm thấy phòng!' }); return; }
      if (r.started) { send(ws, { t: 'err', msg: 'Trận trong phòng này đang diễn ra.' }); return; }
      if (room) leave(ws);
      joinRoom(ws, r);
      break;
    }
    case 'quick': {
      if (room) leave(ws);
      let found = null;
      for (const r of rooms.values()) if (!r.started && r.players.size < 5) { found = r; break; }
      joinRoom(ws, found || newRoom());
      break;
    }
    case 'ready': {
      if (!room) return;
      const p = room.players.get(ws.uid); if (p) p.ready = !p.ready;
      pushRoom(room);
      break;
    }
    case 'start':
      if (!room || room.owner !== ws.uid) return;
      room.started = true;
      for (const p of room.players.values()) p.ready = false;
      toRoom(room, { t: 'start', players: roster(room), diff: m.diff | 0 });
      console.log(`[${room.code}] TRẬN BẮT ĐẦU (${room.players.size} người)`);
      break;
    case 'chat':
      if (!room) return;
      toRoom(room, { t: 'chat', id: ws.uid, name: ws.name, text: String(m.text || '').slice(0, 120) });
      break;
    case 'in': // input của người chơi -> những người còn lại
      if (room) toRoom(room, { t: 'in', id: ws.uid, m: m.m }, ws);
      break;
    case 'st': // snapshot của host -> khách
      if (room) toRoom(room, { t: 'st', id: ws.uid, s: m.s }, ws);
      break;
    case 'over':
      if (room) toRoom(room, { t: 'over', w: m.w }, ws);
      break;
    case 'leave':
      leave(ws);
      break;
  }
}

console.log(`[A10 ARENA] Máy chủ online chạy tại ws://0.0.0.0:${PORT} — phòng đang mở: 0`);
