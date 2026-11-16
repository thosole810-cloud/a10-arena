# /assets — Mô tả tài nguyên 3D cần thay thế (hiện tại tất cả được sinh bằng code)

Game hiện **không cần file ngoài**: model dựng từ primitive Three.js, texture địa hình vẽ bằng canvas, âm thanh tổng hợp bằng WebAudio.
Khi có tài nguyên thật (CC0/MIT hoặc tự làm), thay theo bảng:

| Loại | Hiện tại | Thay bằng | Ghi chú |
|---|---|---|---|
| Model tướng (10) | `buildHeroModel()` trong `src/game/heroes.js` | `heroes/<id>.glb` (GLTF, ≤ 5k tris, rig: hips, spine, head, arm.L/R, leg.L/R) | Clip: `idle`(2s) `run`(0.6s) `attack`(0.3s) `cast`(0.5s) `death`(1s, không loop) |
| Lính / quái | `src/game/monsters.js` | `minion_melee.glb`, `minion_ranged.glb`, `minion_siege.glb`, `golem.glb`, `boar.glb`, `bird.glb`, `dragon.glb`, `baron.glb` | Dragon/Baron ≤ 12k tris |
| Trụ / Nexus / Base | `makeTowerMesh`, `makeNexusMesh`, `buildBases` (map.js) | `tower.glb`, `nexus.glb`, `base_gate.glb`, `shop_npc.glb` | Giữ node `orb` để phát sáng |
| Cây / đá / cỏ | InstancedMesh | `tree_lowpoly.glb`, `rock.glb`, `grass_tuft.glb` | Dùng `InstancedMesh` giữ hiệu năng |
| Texture địa hình | `paintTerrain()` (canvas 2048) | `terrain_albedo.jpg` 2048², `terrain_normal.jpg`, tileable `grass.jpg`, `dirt.jpg`, `water_normal.jpg` | Dùng texture atlas / splat map |
| Âm thanh | `src/game/audio.js` | `sfx/whoosh.ogg`, `boom.ogg`, `heal.ogg`, `hit.ogg`, `win.ogg`, `lose.ogg`, `bgm_lobby.ogg`, `bgm_battle.ogg` | Dùng `THREE.AudioListener` hoặc `<audio>` |
| Icon skill | Emoji | `icons/<hero>_<Q|W|E|R>.png` 128² | |

Nếu dùng GLTF: tải bằng `GLTFLoader` (three/examples/jsm/loaders/GLTFLoader.js), clone bằng `SkeletonUtils.clone`, và đổi `buildHeroModel()` trả về cùng interface `{ group, update(state,p,t,dt,speed), setOpacity, setDetail }`.
