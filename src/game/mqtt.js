// ============================================================
// mqtt.js — MQTT 3.1.1 client TỐI GIẢN (chỉ QoS0) chạy trên WebSocket
// Dùng cho "GHÉP TRẬN NHANH": các phòng đang mở công khai mã lên broker
// công cộng, người ghép đọc danh sách rồi vào. Không cần server riêng.
// ============================================================

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];

const encStr = (s) => { const b = new TextEncoder().encode(s); const a = new Uint8Array(2 + b.length); a[0] = (b.length >> 8) & 255; a[1] = b.length & 255; a.set(b, 2); return a; };
const encLen = (n) => { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; };
const concat = (chunks, total) => { const a = new Uint8Array(total); let o = 0; for (const c of chunks) { a.set(c, o); o += c.length; } return a; };

// fixed header = 1 byte type + 1..4 byte remaining length (không phải luôn 2 byte!)
const frame = (flag, body) => {
  const len = encLen(body.length);
  const head = new Uint8Array([flag, ...len]);
  return concat([head, body], head.length + body.length);
};
function connectPacket(id) {
  const proto = encStr('MQTT');
  const cid = encStr(id);
  const body = concat([proto, new Uint8Array([4, 2, 0, 60]), cid], proto.length + 4 + cid.length);
  return frame(0x10, body);
}
function subscribePacket(topic, pid) {
  const t = encStr(topic);
  const body = concat([new Uint8Array([(pid >> 8) & 255, pid & 255]), t, new Uint8Array([0])], 2 + t.length + 1);
  return frame(0x82, body);
}
function publishPacket(topic, payload, retain) {
  const t = encStr(topic);
  const p = new TextEncoder().encode(payload);
  const body = concat([t, p], t.length + p.length);
  return frame(retain ? 0x31 : 0x30, body);
}

// Tạo 1 phiên MQTT. Trả về { publish(topic, payload, retain), subscribe(topic), close() }
// onMsg(topic, payload) cho mọi packet PUBLISH nhận được.
export function mqttSession(onMsg, onReady, onFail) {
  let i = 0, ws = null, buf = new Uint8Array(0), alive = null, done = false, connTimer = null;
  const cleanup = () => { if (connTimer) clearTimeout(connTimer); connTimer = null; if (alive) clearInterval(alive); alive = null; try { ws && ws.close(); } catch (e) { /* */ } };
  const fail = () => {
    if (done) return;
    if (i + 1 < BROKERS.length) {
      if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; try { ws.close(); } catch (e) { /* */ } }
      buf = new Uint8Array(0); clearTimeout(connTimer);
      open(); // thử broker tiếp theo
    } else { done = true; cleanup(); onFail && onFail(); }
  };

  function open() {
    const url = BROKERS[i++];
    try { ws = new WebSocket(url, 'mqtt'); } catch (e) { fail(); return; }
    ws.binaryType = 'arraybuffer'; // ev.data phải là ArrayBuffer, không phải Blob
    connTimer = setTimeout(fail, 6000); // 6s không có CONNACK -> đổi broker
    ws.onopen = () => { try { ws.send(connectPacket('a10' + Math.random().toString(36).slice(2, 10))); } catch (e) { fail(); } };
    ws.onmessage = (ev) => feed(new Uint8Array(ev.data));
    ws.onerror = () => fail();
    ws.onclose = () => { if (!done) fail(); };
  }
  function feed(chunk) {
    const n = new Uint8Array(buf.length + chunk.length); n.set(buf); n.set(chunk, buf.length); buf = n;
    for (;;) {
      if (buf.length < 2) return;
      let mul = 1, len = 0, off = 1, digit;
      do { if (off >= buf.length) return; digit = buf[off++]; len += (digit & 127) * mul; mul *= 128; } while ((digit & 128) !== 0);
      const total = off + len;
      if (buf.length < total) return;
      const type = buf[0] >> 4;
      if (type === 2) { // CONNACK: payload = [flags, returnCode]
        if (buf[off + 1] === 0) { clearTimeout(connTimer); connTimer = null; buf = new Uint8Array(0); done = true; onReady && onReady(); } else fail();
      } else if (type === 3) { // PUBLISH qos0
        const tLen = (buf[off] << 8) | buf[off + 1];
        const topic = new TextDecoder().decode(buf.subarray(off + 2, off + 2 + tLen));
        const payload = new TextDecoder().decode(buf.subarray(off + 2 + tLen, total));
        onMsg && onMsg(topic, payload);
      }
      buf = buf.subarray(total);
    }
  }
  const api = {
    subscribe: (t) => { try { ws && ws.readyState === 1 && ws.send(subscribePacket(t, 1)); } catch (e) { /* */ } },
    publish: (t, payload, retain) => { try { ws && ws.readyState === 1 && ws.send(publishPacket(t, payload, !!retain)); } catch (e) { /* */ } },
    close: () => { done = true; cleanup(); },
    get ready() { return !!ws && ws.readyState === 1 && done; },
  };
  // ping giữ kết nối
  alive = setInterval(() => { try { ws && ws.readyState === 1 && ws.send(new Uint8Array([0xc0, 0])); } catch (e) { /* */ } }, 25000);
  open();
  return api;
}
