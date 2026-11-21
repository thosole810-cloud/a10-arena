# 🎮 A10 ARENA — MOBA 3D Top-Down (Three.js)

Game MOBA góc nhìn top-down chạy trên trình duyệt: 10 tướng tự tạo, 3 đường, trụ, lính, quái rừng, Rồng/Tà Thần, fog of war, trang bị – ngọc – rank.

**▶ Chơi ngay (link chính thức):** https://thosole810-cloud.github.io/a10-arena/

## 1. Chế độ chơi

| Chế độ | Mô tả |
|---|---|
| ⚔️ Đấu nhanh | 5v5 hoặc 1v1 (solo giữa đường) với bot, 4 mức độ khó |
| 🌐 **Online** | **Tạo phòng / vào bằng mã 4 ký tự / ghép trận nhanh** — chơi cùng bạn bè qua Internet, **không cần server riêng**; thiếu người tự thêm bot |

### Chơi online cùng bạn bè

1. Mở https://thosole810-cloud.github.io/a10-arena/ → **🌐 Online** → **TẠO PHÒNG** (hoặc ⚡ **GHÉP TRẬN NHANH**).
2. Gửi **mã phòng 4 ký tự** cho bạn bè → họ nhập mã → **Vào phòng** (trên chính link web, không cần cài gì).
3. Chọn chế độ **5vs5** hoặc **1vs1 Solo**, chọn tướng, bấm **SẴN SÀNG** → chủ phòng bấm **🚀 BẮT ĐẦU TRẬN**.
4. Thiếu người vẫn chơi được — slot còn lại do bot lấp đầy (cùng đội, đánh Nexus địch).

**Kỹ thuật:** dùng broker MQTT công cộng làm trạm relay (`src/game/mqtt.js`), chủ phòng điều khiển mô phỏng, relay input của mọi người và phát snapshot trạng thất 8 lần/giây; client tự mô phỏng cục bộ nên trận vẫn mượt khi lag. Không dùng WebRTC, nên mọi mạng (kể cả 4G/CGNAT) đều vào được. Phòng đang mở được quảng bá bằng retained message để nút "Ghép trận nhanh" tìm thấy nhau; nếu không có phòng nào, hệ thống tự tạo phòng mới. Chủ phòng cần giữ tab mở trong trận.

## 2. Điều khiển (PC)

| Phím | Hành động |
|---|---|
| **Chuột trái** | Di chuyển / tấn công mục tiêu |
| **Space** | Đánh thường gần nhất |
| **Q W E R** | Dùng chiêu |
| **← →** hoặc **Z C** | Xoay camera |
| **F** · **B** · **P** | Hồi phục (hộp) · Về nhà · Cửa hàng |
| **Tab** · **Esc** | Bảng điểm · Tạm dừng |
| **B+phím số** | Chat nhanh |

Mobile: joystick ảo + nút chiêu (chỉ hiện trên thiết bị cảm ứng).

## 3. Cài & chạy locally

```bash
npm install
npm run dev       # dev server http://localhost:5173
npm run build     # build 1 file dist/index.html (~1.2 MB)
npm run preview   # xem bản build
```

Web tĩnh: sau khi build, copy `dist/index.html` → `docs/index.html` rồi push để GitHub Pages cập nhật.

## 4. Cấu trúc

```
src/game/
  main.js            vòng lặp, input, khởi tạo trận, đồng bộ online
  net.js             phòng online, relay input/snapshot qua MQTT
  mqtt.js            MQTT 3.1.1 tối giản trên WebSocket (broker công cộng)
  heroes.js          10 tướng + kỹ năng (procedural 3D)
  skills.js          hệ thống chiêu (combo/exec/spin/mount...)
  combat.js          sát thương, hồi máu, vàng/EXP, trang bị
  ai.js              bot
  map.js             bản đồ 200×200, A*, địa hình
  scene.js fow.js    render + fog of war
  ui.js style.css    giao diện DOM (lobby, HUD, chọn tướng, online)
  audio.js fx.js     âm thanh & hiệu ứng
docs/index.html      bản build phục vụ trên GitHub Pages
```

Chi tiết GDD: [README_GAME.md](README_GAME.md).
