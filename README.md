# 🎮 A10 ARENA — MOBA 3D Top-Down (Three.js)

Game MOBA **5v5** góc nhìn top-down chạy trên trình duyệt: 10 tướng tự tạo, 3 đường, trụ, lính, quái rừng, Rồng/Tà Thần, fog of war, trang bị – ngọc – rank.

**▶ Chơi ngay (GitHub Pages):** https://thosole810-cloud.github.io/a10-arena/

## 1. Chế độ chơi

| Chế độ | Mô tả |
|---|---|
| ⚔️ Đấu nhanh | 5v5 với bot (4 bot đồng đội + 5 bot địch), 4 mức độ khó |
| 🌐 **Online (mới)** | **Tạo phòng / vào bằng mã 4 ký tự / ghép trận nhanh** — chơi cùng bạn bè, cùng một đội; thiếu người sẽ **tự thêm bot** để đủ 5v5 |

### Chơi online cùng bạn bè

```bash
npm install
npm run server     # máy chủ online (cổng 8787)
npm run dev        # game tại http://localhost:5173
```

1. Mở game → **🌐 Online** → **TẠO PHÒNG** (hoặc ⚡ GHÉP TRẬN NHANH).
2. Gửi **mã phòng 4 ký tự** cho bạn bè → họ nhập mã → **Vào phòng**.
3. Mọi người chọn tướng, bấm **SẴN SÀNG** → chủ phòng bấm **🚀 BẮT ĐẦU TRẬN**.
4. Thiếu người vẫn chơi được — slot còn lại do bot lấp đầy (cùng đội, đánh Nexus địch).

- Bạn bè cùng máy mạng: nhập `ws://<IP máy chủ>:8787` (mặc định `ws://localhost:8787`).
- Kỹ thuật: server WebSocket (`server.js`) điều khiển phòng + chat; **máy chủ phòng relay input** của mọi người và phát **snapshot** trạng thái tướng 8 lần/giây — các client đều mô phỏng cục bộ nên trận chạy mượt dù mạng lag.
- Trang Pages (static) không kèm máy chủ — muốn chơi online hãy chạy `npm run server`.

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

## 3. Cài & chạy

```bash
npm install
npm run dev       # dev server
npm run build     # build 1 file dist/index.html (~1.2 MB)
npm run preview   # xem bản build
npm run server    # máy chủ online (cổng 8787)
```

## 4. Cấu trúc

```
server.js            máy chủ online (WebSocket, phòng, chat, relay)
src/game/
  main.js            vòng lặp, input, khởi tạo trận, đồng bộ online
  net.js             client kết nối online
  heroes.js          10 tướng + kỹ năng (procedural 3D)
  skills.js          hệ thống chiêu (combo/exec/spin/mount...)
  combat.js          sát thương, hồi máu, vàng/EXP, trang bị
  ai.js              bot
  map.js             bản đồ 200×200, A*, địa hình
  scene.js fow.js    render + fog of war
  ui.js style.css    giao diện DOM (lobby, HUD, chọn tướng, online)
  audio.js fx.js     âm thanh & hiệu ứng
```

Chi tiết GDD: [README_GAME.md](README_GAME.md).
