# ANH HÙNG LIÊN QUÂN 99 — MOBA 3D Top-Down (Three.js)

Game MOBA 5v5 offline (4 bot đồng đội + 5 bot địch) lấy cảm hứng về **cơ chế** từ các MOBA mobile; toàn bộ model/âm thanh/tên/IP đều tự tạo.
(Tên các tướng do người dùng cung cấp — nên kiểm tra trùng IP trước khi phát hành, ví dụ "ANNIE" trùng tên tướng ở game khác.)

## 1. GDD tóm tắt
- **Thể loại**: MOBA 3D top-down, camera nghiêng ~56° (FOV 50, mặc định (0,18,12) so với tướng), follow mượt (damping 0.1), zoom 10–30, xoay quanh trục Y.
- **Mục tiêu**: phá Nexus địch. 3 đường × 3 trụ/phe, 2 hang boss (Rồng 2:00, Tà Thần 8:00), 8 bãi quái buff.
- **Tiến trình**: Lv tối đa 15 (R mở ở Lv4), vàng khởi đầu 500, 6 ô trang bị (14 món), ngọc + phù hiệu, hồi sinh 5s + 2s×cấp, thời lượng trận ~15–20 phút.
- **Thu nhập**: lính 30–50, quái 55–90 (Rồng 250, Tà Thần 350), hạ gục 200–500 (+assist), trụ 150/đội.
- **Buff**: Bùa Xanh −20% hồi chiêu (90s) · Bùa Đỏ +15% sát thương (90s) · Rồng +10% sát thương cả đội (120s) · Tà Thần +20% HP & hồi 2%/s (90s).
- **Tầm nhìn**: Fog of War bằng texture 256² cập nhật 0.4s, đọc trong shader (địa hình/cây/tường); tướng trong **bụi cỏ** bị ẩn với địch (trừ khi địch ở gần ≤6.5 hoặc cùng bụi); tàng hình chỉ lộ khi địch ≤5.5.
- **Lưu trữ**: `localStorage` (cấp, EXP, rank/sao, xu, tướng mở khóa, lựa chọn gần nhất).
- **Rank**: Đồng → Bạc → Vàng → Bạch Kim → Kim Cương → Tinh Anh → Cao Thủ → Chiến Thần (5 sao/hạng).

## 2. Bảng 10 tướng
| # | Tướng | Vai trò | Cao | Palette | Vũ khí / đặc trưng model | Q | W | E | R |
|---|---|---|---|---|---|---|---|---|---|
| 1 | BÌNH AN | Đấu sĩ/Đỡ đòn | 1.9 | #d4a017 #8b6914 #c0c0c0 | Giáp vàng-đồng, vai rộng, khiên tròn + kiếm ngắn, vòng sáng vàng dưới chân | Cầu khiên vàng (khiên đồng đội) | Húc 5u + choáng | Địa chấn (ring) | Vòng Thánh Quang r=8, −30% dmg 3s |
| 2 | KHẢI KIỆT | Sát thủ | 1.85 | #1a1a1a #cc0000 #e0e0e0 | Áo choàng đen viền đỏ, tóc bạc đuôi ngựa, mắt đỏ phát sáng, song đao cong, khói đỏ | Lướt bóng 5u + ghost | Đánh dấu (icon đỏ, +20% dmg) | Chém 360° | Dịch chuyển + chém chí mạng |
| 3 | KHOA | Pháp sư khống chế | 1.8 | #4b0082 #6a5acd #9400d3 | Áo pháp sư tím, tóc đen dài, gậy pha lê tím, 3 cuốn sách bay | Cầu băng + làm chậm | Vòng trói (root) | Tường băng 4s | Mưa 10 thiên thạch |
| 4 | ANNIE | Xạ thủ | 1.7 | #ffd700 #8b4513 #a0a0a0 | Tóc vàng xoăn, áo da, mũ lông, nỏ cơ khí | Bắn tỉa (vệt vàng) | Bẫy nổ | Lùi 5u + bắn | Laser xuyên r=30 |
| 5 | TRƯỜNG AN | Trợ thủ | 1.75 | #fffacd #ffd700 #f0f0f0 | Tóc trắng, áo trắng-vàng, cánh thiên thần, quyền trượng, 3 quả cầu sáng | Hồi máu (hạt xanh bay tới) | Tăng tốc cả đội | Khiên cầu trong suốt | Hồi sinh đồng đội (cột sáng) |
| 6 | ĐẠT | Đấu sĩ đa năng | 1.85 | #daa520 #8b4513 #ff4500 | Giáp da hổ, găng sắt phát sáng cam, tóc rối | Lao + hất tung | Đấm 3 hit | Đá xoay | Tóm & ném |
| 7 | LÊ ANH | Sát thủ rừng | 1.75 | #006400 #8a2be2 #0a1a10 | Đồ bó đen-xanh, mặt nạ, dao găm đôi tím, khói tím | Tàng hình (mờ 30%) | Đâm sau lưng +50% | Lướt + vệt tím | Dịch chuyển + kết liễu |
| 8 | TÙNG | Xạ thủ/Pháp sư lai | 1.8 | #32cd32 #00ffaa #222a30 | Hoodie xanh, tóc xanh, kính, súng năng lượng, drone bay quanh | Tia xanh nhanh | Drone chi viện 8s | Lướt điện + làm chậm | Laser quét 90° |
| 9 | TUẤN | Đỡ đòn thuần | 2.0 | #696969 #2f4f4f #a9a9a9 | Đầu trọc, râu, giáp sắt nặng, khiên tháp, búa chiến | Húc dài + đẩy lùi | Tường đá 5s | Búa giáng (quạt 120°) | Miễn nhiễm 3s |
| 10 | THẢO NHI | Trợ thủ/Đạo sĩ | 1.7 | #3fae5a #f4a6c8 #ff7ab0 | Tóc xanh lá dài, vương miện lá, gậy hoa, cánh hoa bay quanh | Gai độc + chậm | Suối sinh mệnh (vùng hồi máu) | Dây leo trói | Rừng Thiêng (hồi + tăng tốc ta, hại địch) |

Animation (procedural, `heroes.js`): Idle 2s (lắc thân, tay đung đưa) · Run 0.6s (chân bước, tay vung) · Attack 0.3s (kiểu theo vũ khí: chém/đâm/đấm/bắn/phép) · Cast 0.5s (giơ tay + glow) · Death 1s (ngã, không lặp).

## 3. Sơ đồ bản đồ 200×200
```
 (-100,-100)  ┌───────────────── TOP ──────────────────┐ BASE ĐỎ (78,-78)
              │  Tà Thần(-30,-30)   MID chéo          │
              │      rừng xanh/đỏ     ╲   Rồng(30,30)  │
 BASE XANH    └─────── BOT (cạnh dưới + phải) ─────────┘ (100,100)
 (-78,78)
```
Dữ liệu nằm ở `MAP_3D` (src/game/map.js): `lanes[{type,waypoints,towers}]`, `jungle[]`, `bushes[]`, `walls[]`, `nexus`. Các hàm: `buildTerrain`, `buildTowers`, `buildJungle`, `buildBushes`, `buildWalls` (+ `buildEnvironment`, `buildBases`, `buildWater`). Pathfinding A* trên lưới 100×100 (`findPath`), độ cao tra từ heightfield (`heightAt` — tương đương raycast xuống địa hình).

## 4. Cấu trúc code (React + Vite chỉ làm vỏ, game là JS thuần)
```
src/App.tsx          gắn #game-root rồi import("./game/main.js")
src/game/state.js    G (trạng thái chung), toán học, localStorage, makeUnit
src/game/scene.js    renderer, scene, đèn (ambient 0.6, sun 1.2 shadow 2048, hemi 0.4, PointLight pool), CameraRig, Fog of War
src/game/map.js      MAP_3D, terrain/noise, môi trường (InstancedMesh), bụi/tường, trụ, base, nav-grid A*
src/game/monsters.js model lính/quái/Rồng/Tà Thần + sinh lính/quái
src/game/heroes.js   data 10 tướng + model + animation + HeroPreview (xoay 360°)
src/game/skills.js   castSkill(hero, skillIndex, targetPos) — 17 loại skill 3D
src/game/fx.js       particle (1 draw call), ring/disc/beam/pillar/orb/ghost, projectile — object pooling
src/game/combat.js   chỉ số, sát thương, trạng thái CC, di chuyển, va chạm, đánh thường, tầm nhìn, trụ/lính/quái AI, shop
src/game/ai.js       updateBot(bot, G, dt): IDLE/FARM/ATTACK/RETREAT/RECALL/DEFEND (+JUNGLE, OBJECTIVE), 4 độ khó
src/game/ui.js       Loading / Lobby / Chọn tướng / HUD / Shop / Kết thúc, minimap, joystick, overlay thanh máu
src/game/audio.js    SFX WebAudio tổng hợp
src/game/style.css   CSS responsive
public/assets/       mô tả asset cần thay
```
Mỗi file là một module ES (thay cho "single-file"); build ra một `dist/index.html` duy nhất nhờ vite-plugin-singlefile (Three.js đã được bundle, chạy offline).

## 5. Điều khiển
**PC**: chuột phải = đi / đánh mục tiêu · chuột trái = chọn mục tiêu (click lên địch = đánh thường, tự đuổi) · WASD = di chuyển · **Q, E, R** = kỹ năng, **kỹ năng W = phím `2` hoặc `V`** (vì W là đi lên) · phím **T** đổi sang chế độ MOBA (QWER là skill, di chuyển bằng phím mũi tên, xoay cam Z/C) · Space = đánh thường · F = hồi máu · B = về nhà · P = cửa hàng (ở base) · Tab = bảng điểm · ←/→ hoặc chuột giữa kéo = xoay camera · cuộn = zoom · Esc = tạm dừng. Đứng yên cạnh địch sẽ tự đánh.
**Mobile**: joystick ảo bên trái, 4 nút skill bên phải (chạm = ngắm tự động, **kéo = ngắm hướng**), nút ⚔ đánh thường, nút hồi máu/về nhà/shop; chạm màn hình = đi/chọn mục tiêu; **2 ngón: pinch zoom + xoay camera**.
**Debug**: F1 hitbox · F2 +1000 vàng · F3 đường đi bot · F4 wireframe.

## 6. Chạy & test
```
npm install
npm run dev        # phát triển
npm run build      # tạo dist/index.html (mở trực tiếp bằng trình duyệt, không cần server)
```
Test nhanh: mở game → BẮT ĐẦU → CHƠI (chọn 5v5 hoặc 1v1, độ khó) → chọn tướng → XÁC NHẬN. Kiểm tra: đi bằng WASD/chuột phải, skill, bấm F2 rồi về base (B) → P mua đồ, đứng trong bụi cỏ (tướng mờ), F3/F1 xem debug. Mobile: thu cửa sổ < 768px hoặc dùng thiết bị cảm ứng.

## 7. Lộ trình
- **Phase 1 (MVP)**: 1 map 3D, 3 tướng, 1v1 bot, UI PC+mobile — ✅ có sẵn (chế độ 1v1 giữa đường).
- **Phase 2**: 10 tướng, 5v5 bot, trang bị, ngọc — ✅ đã làm.
- **Phase 3**: hiệu ứng đẹp, âm thanh, rank, shop — ✅ bản đầu (SFX tổng hợp, rank sao, shop mở khóa tướng); còn: nhạc nền, GLTF thật, hiệu ứng post-processing, kỹ năng nội tại, tướng mới, sự kiện.
- **Phase 4**: multiplayer online (Node.js + WebSocket/Colyseus): server authoritative cho `combat.js`/`skills.js` (đã tách khỏi render), client chỉ gửi input + nội suy; matchmaking, bảng xếp hạng, bang hội.

## 8. Lưu ý bản quyền
Không dùng tên/hình/âm thanh gốc của bất kỳ game thương mại nào; model tự dựng từ primitive; âm thanh tự tổng hợp; chỉ giữ cơ chế MOBA chung.
