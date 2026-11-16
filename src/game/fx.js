// ============================================================
// fx.js — HIỆU ỨNG 3D: particle (Points + shader), ring, disc, beam, pillar,
// cầu bảo vệ, bóng mờ (afterimage), projectile — tất cả dùng OBJECT POOLING
// ============================================================
import * as THREE from 'three';
import { G, clamp } from './state.js';
import { flashLight } from './scene.js';

const NP = 3200;
const tmpC = new THREE.Color();
const ease = (t) => 1 - Math.pow(1 - t, 3);

export class FX {
  constructor(scene, lights) {
    this.scene = scene; this.lights = lights;
    // ----- hệ hạt: 1 draw call duy nhất -----
    this.n = 0;
    this.pos = new Float32Array(NP * 3); this.col = new Float32Array(NP * 3); this.siz = new Float32Array(NP); this.alp = new Float32Array(NP);
    this.vel = new Float32Array(NP * 3); this.life = new Float32Array(NP); this.max = new Float32Array(NP); this.grav = new Float32Array(NP); this.s0 = new Float32Array(NP); this.drag = new Float32Array(NP);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alp, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; uniform float uScale; varying float vA; varying vec3 vC;
        void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.05,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC*(1.0+a*0.4),a); }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 10; scene.add(this.points);
    this.geo = g;

    // ----- pools mesh -----
    const mk = (geo, n, extra = {}) => { const a = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, ...extra })); m.visible = false; m.renderOrder = 5; scene.add(m); a.push({ mesh: m, active: false }); } return a; };
    this.ringPool = mk(new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2), 48);
    this.discPool = mk(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), 32);
    this.beamPool = mk(new THREE.BoxGeometry(1, 1, 1), 24);
    this.pillarPool = mk(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), 16);
    this.spherePool = mk(new THREE.SphereGeometry(1, 18, 12), 16);
    this.ghostPool = mk(new THREE.CapsuleGeometry(0.35, 1.0, 4, 8), 14);
    this.effects = []; // hiệu ứng đang chạy {pool item, t, dur, update(p)}
    // ----- projectile pool -----
    this.projFree = []; this.projs = [];
    const orbGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 70; i++) {
      const g2 = new THREE.Group(); const core = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const glow = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.2); g2.add(core, glow); g2.visible = false; scene.add(g2); this.projFree.push({ g: g2, core, glow });
    }
  }
  setScale(h) { this.uniforms.uScale.value = h * 0.5 / Math.tan(THREE.MathUtils.degToRad(25)); }

  // ---------- PARTICLE ----------
  emit(x, y, z, vx, vy, vz, color, size, life, gravity = 0, drag = 0) {
    if (this.n >= NP) return; const i = this.n++; tmpC.set(color);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = tmpC.r; this.col[i * 3 + 1] = tmpC.g; this.col[i * 3 + 2] = tmpC.b; this.s0[i] = size; this.siz[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = gravity; this.drag[i] = drag; this.alp[i] = 1;
  }
  // Nổ hạt: count hạt bay đều mọi hướng. opts: gravity, up (thiên lệch lên), flat (chỉ ngang), drag
  burst(x, y, z, color, count, speed = 4, life = 0.7, size = 0.5, o = {}) {
    count = Math.ceil(count * G.quality);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * 6.283, e = o.flat ? 0 : (Math.random() - 0.3) * 2; const s = speed * (0.35 + Math.random() * 0.65); const h = Math.sqrt(Math.max(0, 1 - Math.min(1, e * e)));
      this.emit(x, y, z, Math.cos(a) * h * s, (o.flat ? 0.2 : e) * s + (o.up || 0), Math.sin(a) * h * s, color, size * (0.6 + Math.random() * 0.7), life * (0.6 + Math.random() * 0.6), o.gravity || 0, o.drag === undefined ? 1.5 : o.drag);
    }
  }
  // Hạt lơ lửng/bay lên (aura)
  aura(x, y, z, color, size = 0.3, rise = 1.2, spread = 0.7, life = 1.1) {
    const a = Math.random() * 6.283, r = Math.random() * spread;
    this.emit(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, rise * (0.5 + Math.random()), 0, color, size, life * (0.6 + Math.random() * 0.5), 0, 0.2);
  }
  trail(x, y, z, color, size = 0.4, life = 0.35) { this.emit(x + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.2, z + (Math.random() - 0.5) * 0.2, 0, 0, 0, color, size, life, 0, 0); }
  // Dòng hạt bay từ A đến B (hồi máu, truyền năng lượng)
  stream(a, b, color, count = 14, life = 0.6) {
    for (let i = 0; i < count; i++) { const t = Math.random(); this.emit(a.x, a.y + 1, a.z, (b.x - a.x) / life + (Math.random() - 0.5) * 2, (b.y - a.y) / life + 2 + Math.random() * 2, (b.z - a.z) / life + (Math.random() - 0.5) * 2, color, 0.4, life * (0.7 + t * 0.4), -4, 0); }
  }

  _acquire(pool) { for (const p of pool) if (!p.active) { p.active = true; p.mesh.visible = true; return p; } return null; }
  _release(p) { p.active = false; p.mesh.visible = false; }
  _add(p, dur, fn) { this.effects.push({ p, t: 0, dur, fn }); }

  // ---------- RING giãn nở trên mặt đất ----------
  ring(x, y, z, radius, color, dur = 0.5, o = {}) {
    const p = this._acquire(this.ringPool); if (!p) return; const m = p.mesh; m.material.color.set(color); m.position.set(x, y + 0.15, z);
    const r0 = o.r0 === undefined ? 0.2 : o.r0, hold = o.hold || 0; const op = o.opacity || 0.9;
    this._add(p, dur, (t) => { const k = o.noExpand ? 1 : ease(Math.min(1, t * (1 + hold))); const s = r0 + (radius - r0) * k; m.scale.set(s, 1, s); m.material.opacity = op * (1 - t * t); });
  }
  // Decal tròn đặc (telegraph AoE)
  disc(x, y, z, radius, color, dur = 0.5, o = {}) {
    const p = this._acquire(this.discPool); if (!p) return; const m = p.mesh; m.material.color.set(color); m.position.set(x, y + 0.12, z); m.scale.set(radius, 1, radius);
    const op = o.opacity || 0.3;
    this._add(p, dur, (t) => { m.material.opacity = o.fadeIn ? op * Math.min(1, t * 3) * (t > 0.9 ? (1 - t) * 10 : 1) : op * (1 - t); if (o.grow) { const s = radius * (0.3 + 0.7 * t); m.scale.set(s, 1, s); } });
  }
  // Tia sáng A→B
  beam(a, b, color, width = 0.6, dur = 0.35, o = {}) {
    const p = this._acquire(this.beamPool); if (!p) return; const m = p.mesh; m.material.color.set(color);
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.01; m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); m.lookAt(b.x, b.y, b.z);
    this._add(p, dur, (t) => { const w = width * (o.taper ? 1 - t : 1 - t * t); m.scale.set(w, w, len); m.material.opacity = 0.85 * (1 - t); });
  }
  // Cột sáng
  pillar(x, y, z, color, radius = 1.2, height = 12, dur = 1.2, o = {}) {
    const p = this._acquire(this.pillarPool); if (!p) return; const m = p.mesh; m.material.color.set(color); m.position.set(x, y + height / 2, z);
    this._add(p, dur, (t) => { const r = radius * (o.pulse ? 1 + Math.sin(t * 20) * 0.1 : 1) * (t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4) * 0.8); m.scale.set(r, height, r); m.material.opacity = 0.55 * (t > 0.7 ? (1 - t) / 0.3 : 1); });
  }
  // Cầu bảo vệ/aura bám theo đơn vị
  orb(unit, color, radius = 1.8, dur = 3, op = 0.28) {
    const p = this._acquire(this.spherePool); if (!p) return; const m = p.mesh; m.material.color.set(color);
    this._add(p, dur, (t) => { if (!unit.alive && unit.kind === 'hero') { m.material.opacity = 0; return; } m.position.set(unit.pos.x, unit.pos.y + 1 + unit.lift, unit.pos.z); const s = radius * (1 + Math.sin(t * dur * 6) * 0.03); m.scale.setScalar(s); m.material.opacity = op * (t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 1); });
  }
  // Bóng mờ để lại khi dash (afterimage)
  ghost(unit, color) {
    const p = this._acquire(this.ghostPool); if (!p) return; const m = p.mesh; m.material.color.set(color);
    m.position.set(unit.pos.x, unit.pos.y + 1, unit.pos.z); m.rotation.y = unit.yaw; m.scale.setScalar(unit.def ? unit.def.height / 1.8 : 1);
    this._add(p, 0.4, (t) => { m.material.opacity = 0.5 * (1 - t); });
  }
  flash(pos, color, peak = 3, life = 0.4) { flashLight(this.lights, pos, color, peak, life); }

  // ---------- PROJECTILE ----------
  // cfg: {from, to(Vector3) | target(unit homing), color, speed, range, radius, size, owner, team, pierce, onHit(u,proj), onEnd(pos,proj), trail}
  projectile(cfg) {
    const pr = this.projFree.pop(); if (!pr) return null;
    const dir = new THREE.Vector3();
    if (cfg.target) dir.set(cfg.target.pos.x - cfg.from.x, 0, cfg.target.pos.z - cfg.from.z); else dir.set(cfg.dir.x, 0, cfg.dir.z);
    dir.normalize();
    const p = { pr, pos: cfg.from.clone(), dir, speed: cfg.speed || 20, range: cfg.range || 15, travelled: 0, radius: cfg.radius || 0.6, owner: cfg.owner, team: cfg.team, target: cfg.target || null, pierce: !!cfg.pierce, onHit: cfg.onHit, onEnd: cfg.onEnd, color: cfg.color, trailColor: cfg.trail || cfg.color, hit: new Set(), size: cfg.size || 0.35, stretch: cfg.stretch || 1, dead: false, y: cfg.from.y };
    pr.core.material.color.set(cfg.core || 0xffffff); pr.glow.material.color.set(cfg.color); pr.core.scale.set(p.size, p.size, p.size * p.stretch); pr.glow.scale.set(p.size * 2.2, p.size * 2.2, p.size * 2.2 * p.stretch);
    pr.g.position.copy(p.pos); pr.g.visible = true; pr.g.rotation.y = Math.atan2(dir.x, dir.z); this.projs.push(p); return p;
  }
  _killProj(i) { const p = this.projs[i]; p.pr.g.visible = false; this.projFree.push(p.pr); this.projs.splice(i, 1); }

  update(dt) {
    // particles
    let n = this.n; const P = this.pos, V = this.vel;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { n--; if (i !== n) { for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[n * 3 + k]; V[i * 3 + k] = V[n * 3 + k]; this.col[i * 3 + k] = this.col[n * 3 + k]; } this.life[i] = this.life[n]; this.max[i] = this.max[n]; this.grav[i] = this.grav[n]; this.s0[i] = this.s0[n]; this.drag[i] = this.drag[n]; } i--; continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt); V[i * 3] *= d; V[i * 3 + 2] *= d; V[i * 3 + 1] = V[i * 3 + 1] * d - this.grav[i] * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const a = this.life[i] / this.max[i]; this.alp[i] = Math.min(1, a * 2); this.siz[i] = this.s0[i] * (0.4 + 0.6 * a);
    }
    this.n = n; this.geo.setDrawRange(0, n);
    const at = this.geo.attributes; at.position.needsUpdate = at.color.needsUpdate = at.size.needsUpdate = at.alpha.needsUpdate = true;
    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.t += dt; const k = clamp(e.t / e.dur, 0, 1); e.fn(k);
      if (e.t >= e.dur) { this._release(e.p); this.effects.splice(i, 1); }
    }
    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; const step = p.speed * dt;
      if (p.target) { // homing (đòn đánh thường)
        const t = p.target; if (!t.alive) { this._killProj(i); continue; }
        const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, d = Math.hypot(dx, dz); p.dir.set(dx / (d || 1), 0, dz / (d || 1));
        if (d <= step + t.radius * 0.8) { if (p.onHit) p.onHit(t, p); p.dead = true; this._killProj(i); continue; }
      }
      p.pos.x += p.dir.x * step; p.pos.z += p.dir.z * step; p.travelled += step;
      const tY = p.target ? p.target.pos.y + 1.1 : p.y; p.pos.y += (tY - p.pos.y) * Math.min(1, dt * 8);
      p.pr.g.position.copy(p.pos); p.pr.g.rotation.y = Math.atan2(p.dir.x, p.dir.z);
      this.trail(p.pos.x, p.pos.y, p.pos.z, p.trailColor, p.size * 1.2, 0.3);
      let end = p.travelled >= p.range;
      if (!p.target && !end) {
        for (const u of G.units) {
          if (!u.alive || u.team === p.team || u.kind === 'nexus' && false || p.hit.has(u.id)) continue;
          if (u.kind === 'tower' || u.kind === 'nexus') continue;
          const dx = u.pos.x - p.pos.x, dz = u.pos.z - p.pos.z; const rr = u.radius + p.radius;
          if (dx * dx + dz * dz < rr * rr) { p.hit.add(u.id); const consume = p.onHit ? p.onHit(u, p) : true; if (!p.pierce || consume === 'stop') { end = true; break; } }
        }
        // chặn bởi tường
        if (!end) for (const b of G.wallsDyn) { if (p.pos.x > b.minx && p.pos.x < b.maxx && p.pos.z > b.minz && p.pos.z < b.maxz && !b.passProj) { end = true; break; } }
      }
      if (end) { if (p.onEnd) p.onEnd(p.pos, p); this._killProj(i); }
    }
  }
  clear() {
    this.n = 0; for (const e of this.effects) this._release(e.p); this.effects.length = 0;
    for (let i = this.projs.length - 1; i >= 0; i--) this._killProj(i);
  }
}
G.wallsDyn = [];
