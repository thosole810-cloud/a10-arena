// ============================================================
// scene.js — RENDERER, CAMERA RIG, ÁNH SÁNG, FOG OF WAR
// ============================================================
import * as THREE from 'three';
import { clamp, lerp, G } from './state.js';

// ---------- RENDERER ----------
export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // giới hạn pixelRatio ≤ 2
  r.setSize(window.innerWidth, window.innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap; // r18x: PCFSoftShadowMap đã bị gỡ — PCF hiện đã lọc mềm (soft)
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

// ---------- FOG OF WAR (texture 256x256 phủ toàn bản đồ) ----------
// Canvas đen, "khoét" các vòng tròn quanh đồng đội. Texture được cập nhật mỗi ~0.4s
// rồi đọc trong shader (applyFow) của địa hình/cây/tường -> vùng chưa thấy bị tối đi.
const FOW_N = 256;
export const FOW = { canvas: null, ctx: null, tex: null, uniform: null };
export function initFow() {
  const c = document.createElement('canvas'); c.width = c.height = FOW_N;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, FOW_N, FOW_N);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  FOW.canvas = c; FOW.ctx = ctx; FOW.tex = tex; FOW.uniform = { value: tex };
}
// sources: [{x,z,r}] — vùng nhìn thấy của đồng đội
export function updateFow(sources) {
  const ctx = FOW.ctx; const k = FOW_N / 200;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FOW_N, FOW_N);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sources) {
    const x = (s.x + 100) * k, y = (s.z + 100) * k, r = s.r * k;
    const g = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  FOW.tex.needsUpdate = true;
}
export function clearFow() { if (FOW.ctx) { FOW.ctx.globalCompositeOperation = 'source-over'; FOW.ctx.fillStyle = '#fff'; FOW.ctx.fillRect(0, 0, FOW_N, FOW_N); FOW.tex.needsUpdate = true; } }

// Chèn đoạn shader vào MeshStandardMaterial: nhân màu với mặt nạ sương mù chiến tranh
export function applyFow(mat, minLight = 0.28) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.fowMap = FOW.uniform;
    sh.uniforms.fowMin = { value: minLight };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFowPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vFowPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vFowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFowPos;\nuniform sampler2D fowMap;\nuniform float fowMin;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fowV = texture2D(fowMap, (vFowPos.xz + 100.0) / 200.0).r;
        diffuseColor.rgb *= mix(fowMin, 1.0, fowV);`);
  };
  mat.customProgramCacheKey = () => 'fow';
  return mat;
}

// ---------- SCENE + ÁNH SÁNG ----------
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1626);
  // Sương mù khí quyển nhẹ (FogExp2) — làm xa mờ dần, bổ sung cho Fog of War shader
  scene.fog = new THREE.FogExp2(0x0b1626, 0.0065);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.4);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
  sun.position.set(40, 70, 25);
  sun.castShadow = true;
  const mob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const sz = mob ? 1024 : 2048;
  sun.shadow.mapSize.set(sz, sz);
  // Bóng đổ bao phủ khu vực quanh tướng (ảnh hưởng độ nét) — di chuyển theo camera
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(ambient, hemi, sun, sun.target);

  // Pool PointLight cho skill (màu & cường độ động) — luôn có đủ số đèn để không compile lại shader
  const skillLights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 16, 2); l.userData = { life: 0, max: 1, peak: 0 }; scene.add(l); skillLights.push(l); }
  return { scene, ambient, hemi, sun, skillLights, mobile: mob };
}

// ---------- CAMERA RIG: top-down nghiêng ~56°, follow mượt, zoom, xoay trục Y ----------
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.dist = 21.6;          // mặc định tương đương (0,18,12)
    this.yaw = 0;
    this.pitch = Math.atan2(18, 12); // ~56°
    this.shakeT = 0; this.shakeAmp = 0;
    this.minD = 10; this.maxD = 30;
  }
  zoom(delta) { this.dist = clamp(this.dist + delta, this.minD, this.maxD); }
  rotate(d) { this.yaw += d; }
  shake(amp = 0.3, t = 0.25) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, t); }
  snap(p) { this.focus.copy(p); }
  update(dt, p, heightAt) {
    // follow mượt, damping ~0.1 (không phụ thuộc fps)
    const k = 1 - Math.pow(1 - 0.1, dt * 60);
    this.focus.lerp(p, k);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.dist);
    this.camera.position.copy(this.focus).add(off);
    // Clamp: không cho camera chui xuống địa hình
    const gh = heightAt(this.camera.position.x, this.camera.position.z);
    this.camera.position.y = Math.max(this.camera.position.y, gh + 3);
    if (this.shakeT > 0) {
      this.shakeT -= dt; const a = this.shakeAmp * clamp(this.shakeT * 4, 0, 1);
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    this.camera.lookAt(this.focus.x, this.focus.y + 0.5, this.focus.z);
  }
}

// Cập nhật đèn skill (PointLight pool)
export function flashLight(lights, pos, color, peak = 3, life = 0.4) {
  let best = lights[0];
  for (const l of lights) { if (l.userData.life <= 0) { best = l; break; } if (l.userData.life < best.userData.life) best = l; }
  best.position.copy(pos); best.position.y += 1.2; best.color.set(color);
  best.userData.life = life; best.userData.max = life; best.userData.peak = peak; best.intensity = peak;
}
export function updateLights(lights, dt) {
  for (const l of lights) {
    const u = l.userData; if (u.life > 0) { u.life -= dt; l.intensity = Math.max(0, u.peak * (u.life / u.max)); } else l.intensity = 0;
  }
}
export { lerp };
export const _G = G;
