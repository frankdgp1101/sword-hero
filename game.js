'use strict';
/* 剑仙之道 v3 — first-person sword immortal, three.js r160 (vendored) */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = V3(0, 1, 0);
let seedA = 20261001; const srand = () => { seedA |= 0; seedA = seedA + 0x6D2B79F5 | 0; let t = Math.imul(seedA ^ seedA >>> 15, 1 | seedA); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const srnd = (a, b) => a + srand() * (b - a);

function hash(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= .5; } return s / .9375; }

/* ---------------- renderer ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc4d8e4, 60, 420);
const camera = new THREE.PerspectiveCamera(70, 1, .1, 2000);
camera.rotation.order = 'YXZ';
const vScene = new THREE.Scene();
const vCam = new THREE.PerspectiveCamera(55, 1, .01, 10);
const SUN = V3(-.45, .62, -.55).normalize();

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x2f6cc6) }, mid: { value: new THREE.Color(0x8fbfe8) }, bot: { value: new THREE.Color(0xd2e4ee) }, sunDir: { value: SUN.clone() }, sunCol: { value: new THREE.Color(1, .92, .75) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }',
  fragmentShader: 'uniform vec3 top,mid,bot,sunDir,sunCol; varying vec3 vP; void main(){ vec3 d=normalize(vP); float h=d.y; vec3 c=mix(bot,mid,smoothstep(-0.05,0.16,h)); c=mix(c,top,smoothstep(0.16,0.8,h)); float s=max(dot(d,sunDir),0.); c+=sunCol*(pow(s,700.)*5.+pow(s,8.)*.3); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
let envTex = null;
function rebuildEnv(groundHex) {
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: groundHex }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -3; envScene.add(gnd);
  const pm = new THREE.PMREMGenerator(renderer);
  if (envTex) envTex.dispose();
  envTex = pm.fromScene(envScene, .02).texture; pm.dispose();
  scene.environment = envTex; vScene.environment = envTex;
}
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x55623a, .75); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xfff0d8, 2.0); scene.add(sunL);
const vHemi = new THREE.HemisphereLight(0xdfeaff, 0x3a3a30, .9); vScene.add(vHemi);
const vSun = new THREE.DirectionalLight(0xfff3e0, 2.4); vSun.position.set(-1, 2, 1.2); vScene.add(vSun);
const vRim = new THREE.DirectionalLight(0x9fd0ff, 1.6); vRim.position.set(1.5, .6, -1); vScene.add(vRim);
const vFill = new THREE.DirectionalLight(0xffe6d0, .6); vFill.position.set(.2, -1, 1); vScene.add(vFill);

/* ---------------- geometry helpers ---------------- */
const G = {
  sph: new THREE.SphereGeometry(1, 20, 14), sphLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cylT: new THREE.CylinderGeometry(.6, 1, 1, 16),
  cone: new THREE.ConeGeometry(1, 1, 14), box: new THREE.BoxGeometry(1, 1, 1),
  cap: new THREE.CapsuleGeometry(1, 1, 6, 14), tor: new THREE.TorusGeometry(1, .18, 8, 24),
};
function mk(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (parent) parent.add(m); return m; }
// smooth tapered tube through points; radii: array or fn(t). caps rounded. optional colorFn(t,a)->[r,g,b]
function taperTube(pts, radii, opt = {}) {
  const radial = opt.radial || 14, tub = opt.seg || Math.max(8, pts.length * 6);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const frames = curve.computeFrenetFrames(tub, false);
  const rf = typeof radii === 'function' ? radii : (t => { const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)); return lerp(radii[i], radii[i + 1], f - i); });
  const flat = opt.flat || 1; // ellipse ratio (normal axis)
  const rings = []; // {c, n, b, r, t}
  const capN = opt.noCap ? 0 : 4;
  const P0 = curve.getPointAt(0), P1 = curve.getPointAt(1);
  for (let k = capN; k >= 1; k--) { const a = k / (capN + 1) * Math.PI / 2; const r0 = rf(0); rings.push({ c: P0.clone().addScaledVector(frames.tangents[0], -Math.sin(a) * r0), n: frames.normals[0], b: frames.binormals[0], r: Math.cos(a) * r0, t: 0 }); }
  for (let i = 0; i <= tub; i++) { const t = i / tub; rings.push({ c: curve.getPointAt(t), n: frames.normals[i], b: frames.binormals[i], r: rf(t), t }); }
  for (let k = 1; k <= capN; k++) { const a = k / (capN + 1) * Math.PI / 2; const r1 = rf(1); rings.push({ c: P1.clone().addScaledVector(frames.tangents[tub], Math.sin(a) * r1), n: frames.normals[tub], b: frames.binormals[tub], r: Math.cos(a) * r1, t: 1 }); }
  const pos = [], uv = [], col = [], idx = [];
  rings.forEach((R, i) => {
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(R.c.x + (R.n.x * ca * flat + R.b.x * sa) * R.r, R.c.y + (R.n.y * ca * flat + R.b.y * sa) * R.r, R.c.z + (R.n.z * ca * flat + R.b.z * sa) * R.r);
      uv.push(R.t, j / radial);
      if (opt.colorFn) { const c = opt.colorFn(R.t, a); col.push(c[0], c[1], c[2]); }
    }
    if (i) for (let j = 0; j < radial; j++) { const a = (i - 1) * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opt.colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function superEllipsoid(rx, ry, rz, e = .55, ws = 20, hs = 14) {
  const g = new THREE.SphereGeometry(1, ws, hs); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = c => Math.sign(c) * Math.pow(Math.abs(c), e); p.setXYZ(i, f(p.getX(i)) * rx, f(p.getY(i)) * ry, f(p.getZ(i)) * rz); }
  g.computeVertexNormals(); return g;
}
function lathe(profile, segs = 28) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs); }
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function mergeColored(list) {
  const pos = [], nor = [], col = [];
  for (const [g0, hex, mtx] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(mtx); const c = new THREE.Color(hex);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V3(sx, sy, sz));

/* ---------------- sword model (blade along +Y, origin at grip centre) ---------------- */
function bladeGeo(len, w0, th) {
  const st = [[0, 1], [.06, 1], [.55, .9], [.86, .74], [.95, .5], [1, 0]];
  const pts = [];
  for (const [t, f] of st) { const w = w0 * f, d = th * (f > 0 ? Math.max(.55, f) : 0); pts.push([V3(-w, t * len, 0), V3(0, t * len, d), V3(w, t * len, 0), V3(0, t * len, -d)]); }
  const pos = [];
  const push = (a, b, c) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 4; s++) { const a = pts[i][s], b = pts[i][(s + 1) % 4], c = pts[i + 1][(s + 1) % 4], d = pts[i + 1][s]; push(a, b, c); push(a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const BLADE_LEN = 1.0, GUARD_Y = .075;
const BLADE_G = bladeGeo(BLADE_LEN, .016, .0055);
function buildSword(opts = {}) {
  const g = new THREE.Group();
  const bladeM = new THREE.MeshStandardMaterial({ color: opts.blade || 0xe9f0f7, metalness: 1, roughness: .14, envMapIntensity: 1.5, emissive: opts.glow || 0x66ccff, emissiveIntensity: opts.glowI || 0, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: opts.gold || 0xd8b25a, metalness: .9, roughness: .3, envMapIntensity: 1.2 });
  const gripM = new THREE.MeshStandardMaterial({ color: opts.grip || 0x3a1512, roughness: .8 });
  const wrapM = new THREE.MeshStandardMaterial({ color: 0x0e0b0a, roughness: .6 });
  const jade = new THREE.MeshStandardMaterial({ color: opts.jade || 0x3fd59a, emissive: opts.jadeE || 0x0f6644, roughness: .2, metalness: .2 });
  const blade = new THREE.Mesh(BLADE_G, bladeM); blade.position.y = GUARD_Y + .006; g.add(blade);
  mk(G.box, new THREE.MeshStandardMaterial({ color: 0x9fb2c6, metalness: 1, roughness: .25 }), g, 0, GUARD_Y + .006 + .4, 0, .0035, .74, .0118);
  // long grip (fits two hands): y -.11 .. .07
  mk(G.cyl, gripM, g, 0, -.02, 0, .0125, .18, .0125);
  for (let i = 0; i < 9; i++) { const t = mk(G.tor, wrapM, g, 0, -.1 + i * .02, 0, .0135, .0135, .0135); t.rotation.x = Math.PI / 2; }
  mk(G.box, gold, g, 0, GUARD_Y, 0, .03, .016, .026);
  for (const s of [-1, 1]) { const arm = mk(G.cone, gold, g, s * .03, GUARD_Y - .002, 0, .009, .045, .009); arm.rotation.z = s * (Math.PI / 2 + .35); mk(G.sph, gold, g, s * .05, GUARD_Y + .006, 0, .0075, .0075, .0075); }
  mk(G.sph, jade, g, 0, GUARD_Y, .012, .0075, .0075, .004);
  mk(G.sph, jade, g, 0, GUARD_Y, -.012, .0075, .0075, .004);
  mk(G.cylT, gold, g, 0, -.117, 0, .016, .014, .016);
  mk(G.sph, gold, g, 0, -.13, 0, .015, .013, .015);
  let tassel = null;
  if (opts.tassel) {
    tassel = new THREE.Group(); tassel.position.y = -.14; g.add(tassel);
    const red = new THREE.MeshStandardMaterial({ color: opts.tasselC || 0xc0172a, roughness: .7 });
    mk(G.cyl, red, tassel, 0, -.03, 0, .002, .06, .002);
    mk(G.sph, red, tassel, 0, -.062, 0, .008, .008, .008);
    const tc = mk(G.cone, red, tassel, 0, -.1, 0, .012, .07, .012); tc.rotation.x = Math.PI;
  }
  if (opts.scale) g.scale.setScalar(opts.scale);
  return { g, bladeM, tassel };
}

/* ---------------- particles ---------------- */
const PMAX = 1400;
const parts = { pos: new Float32Array(PMAX * 3), col: new Float32Array(PMAX * 3), size: new Float32Array(PMAX), alpha: new Float32Array(PMAX), vel: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX), grav: new Float32Array(PMAX), s0: new Float32Array(PMAX), n: 0 };
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(parts.pos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('color', new THREE.BufferAttribute(parts.col, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('size', new THREE.BufferAttribute(parts.size, 1).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('alpha', new THREE.BufferAttribute(parts.alpha, 1).setUsage(THREE.DynamicDrawUsage));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { scale: { value: 400 } },
  vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/max(-mv.z,.1); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; float a=smoothstep(.5,.0,r); gl_FragColor=vec4(vC*a*vA*1.4, a*vA); }'
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 5; scene.add(pPoints);
const _c = new THREE.Color();
function emit(x, y, z, vx, vy, vz, hex, size, life, grav = 0) {
  let i = parts.n < PMAX ? parts.n++ : Math.floor(Math.random() * PMAX);
  parts.pos[i * 3] = x; parts.pos[i * 3 + 1] = y; parts.pos[i * 3 + 2] = z; parts.vel[i * 3] = vx; parts.vel[i * 3 + 1] = vy; parts.vel[i * 3 + 2] = vz;
  _c.set(hex); parts.col[i * 3] = _c.r; parts.col[i * 3 + 1] = _c.g; parts.col[i * 3 + 2] = _c.b;
  parts.s0[i] = size; parts.size[i] = size; parts.life[i] = life; parts.max[i] = life; parts.grav[i] = grav; parts.alpha[i] = 1;
}
function burst(p, n, hex, speed, size, life, grav = -6, up = 0) { for (let i = 0; i < n; i++) { const v = V3(rand(-1, 1), rand(-1, 1) + up, rand(-1, 1)).normalize().multiplyScalar(speed * rand(.4, 1)); emit(p.x, p.y, p.z, v.x, v.y, v.z, hex, size * rand(.6, 1.2), life * rand(.6, 1.1), grav); } }
function updateParticles(dt) {
  const P = parts;
  for (let i = 0; i < P.n; i++) {
    P.life[i] -= dt;
    if (P.life[i] <= 0) { const j = --P.n; if (i !== j) { for (const a of [P.pos, P.vel, P.col]) { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; } for (const a of [P.size, P.alpha, P.life, P.max, P.grav, P.s0]) a[i] = a[j]; } i--; continue; }
    P.vel[i * 3 + 1] += P.grav[i] * dt;
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    const k = P.life[i] / P.max[i]; P.alpha[i] = k; P.size[i] = P.s0[i] * (.5 + .5 * k);
  }
  pGeo.setDrawRange(0, P.n);
  for (const n of ['position', 'color', 'size', 'alpha']) pGeo.attributes[n].needsUpdate = true;
}

/* ---------------- effects ---------------- */
const effects = [];
function addFx(obj, life, upd, parent) { if (obj) (parent || scene).add(obj); const e = { obj, t: 0, life, upd, parent: parent || scene }; effects.push(e); return e; }
function updateFx(dt) { for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i]; e.t += dt; const k = e.t / e.life; if (k >= 1) { if (e.obj) e.parent.remove(e.obj); e.end && e.end(); effects.splice(i, 1); continue; } e.upd && e.upd(k, dt, e); } }
function clearFx() { for (const e of effects) if (e.obj) e.parent.remove(e.obj); effects.length = 0; parts.n = 0; }
const ringGeo = new THREE.RingGeometry(.8, 1, 64);
const discGeo = new THREE.CircleGeometry(1, 48);
function addMat(hex, op = .9) { return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); }
function shockRing(p, hex, r0, r1, life, op = .9) {
  const m = new THREE.Mesh(ringGeo, addMat(hex, op));
  m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += .15;
  addFx(m, life, k => { const r = lerp(r0, r1, easeOut(k)); m.scale.set(r, r, r); m.material.opacity = op * (1 - k); });
}
function crescentGeo(r0, r1, a0, a1, n = 40) {
  const pos = [], tt = [], idx = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = lerp(a0, a1, u), th = Math.sin(u * Math.PI) * .9 + .1; const ri = lerp(r1, r0, th); pos.push(Math.cos(a) * ri, Math.sin(a) * ri, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); tt.push(u, u); if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('tt', new THREE.Float32BufferAttribute(tt, 1)); g.setIndex(idx); return g;
}
function slashMat(hex) { return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { prog: { value: 0 }, fade: { value: 1 }, col: { value: new THREE.Color(hex) } }, vertexShader: 'attribute float tt; varying float vT; void main(){ vT=tt; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float prog,fade; uniform vec3 col; varying float vT; void main(){ if(vT>prog) discard; float a=smoothstep(prog-.55,prog,vT)*fade; gl_FragColor=vec4(mix(col,vec3(1.),.5)*a,a); }' }); }
const ARC_WIDE = crescentGeo(1.5, 3.3, .2, Math.PI - .2), ARC_SMALL = crescentGeo(1.3, 2.3, .5, Math.PI - .5);
// sword-qi blade (flat glowing lens shape) along +Z
const QI_GEO = (() => { const s = new THREE.Shape(); s.moveTo(0, -1); s.quadraticCurveTo(.16, -.2, 0, 1); s.quadraticCurveTo(-.16, -.2, 0, -1); const g = new THREE.ShapeGeometry(s, 8); g.rotateX(-Math.PI / 2); return g; })();

/* ---------------- floating numbers ---------------- */
const labelsEl = $('labels');
const dnums = [];
const _v = V3();
function project(p) { _v.copy(p).project(camera); if (_v.z > 1 || _v.z < -1) return null; return { x: (_v.x * .5 + .5) * innerWidth, y: (-_v.y * .5 + .5) * innerHeight }; }
function showNum(p, txt, cls) { const el = document.createElement('div'); el.className = 'dn ' + cls; el.textContent = txt; labelsEl.appendChild(el); dnums.push({ el, p: p.clone().add(V3(rand(-.4, .4), 0, rand(-.4, .4))), t: 0, dx: rand(-20, 20) }); }
function updateNums(dt) { for (let i = dnums.length - 1; i >= 0; i--) { const d = dnums[i]; d.t += dt; if (d.t > 1.0) { d.el.remove(); dnums.splice(i, 1); continue; } const s = project(d.p); if (!s) { d.el.style.opacity = 0; continue; } const k = d.t; const sc = k < .12 ? 1.6 - k * 5 : 1; d.el.style.transform = `translate(${s.x + d.dx * k - 15}px,${s.y - 40 * k - 20}px) scale(${sc})`; d.el.style.opacity = k < .7 ? 1 : 1 - (k - .7) / .3; } }
const snums = [];
function screenNum(txt, cls, x, y) { const el = document.createElement('div'); el.className = 'dn ' + cls; el.textContent = txt; labelsEl.appendChild(el); snums.push({ el, x, y, t: 0 }); }
function updateSNums(dt) { for (let i = snums.length - 1; i >= 0; i--) { const s = snums[i]; s.t += dt / .9; if (s.t >= 1) { s.el.remove(); snums.splice(i, 1); continue; } s.el.style.transform = `translate(${s.x}px,${s.y - 30 * s.t}px)`; s.el.style.opacity = 1 - s.t * s.t; } }
let bannerT = 0; function banner(t, s, dur = 2.2) { $('banner').querySelector('b').textContent = t; $('banner').querySelector('span').textContent = s || ''; $('banner').style.opacity = 1; bannerT = dur; }
let toastT = 0; function toast(t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 1.6; }
function flashScreen(col, op, dur = .6) { const fl = $('flash'); fl.style.transition = 'none'; fl.style.background = col; fl.style.opacity = op; requestAnimationFrame(() => requestAnimationFrame(() => { fl.style.transition = `opacity ${dur}s`; fl.style.opacity = 0; })); }

/* ---------------- audio (synth) ---------------- */
let actx = null, noiseBuf = null;
function initAudio() { if (actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); noiseBuf = actx.createBuffer(1, actx.sampleRate * .5, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { actx = null; } }
function sfx(type) {
  if (!actx) return; const t = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
  const osc = (tp, f0, f1, L, v) => { const o = actx.createOscillator(); o.type = tp; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + L); const gg = actx.createGain(); gg.gain.setValueAtTime(v, t); gg.gain.exponentialRampToValueAtTime(.0001, t + L); o.connect(gg); gg.connect(actx.destination); o.start(t); o.stop(t + L); };
  const noise = (f0, f1, L, v, q = 2) => { const s = actx.createBufferSource(); s.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + L); const gg = actx.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.exponentialRampToValueAtTime(v, t + .03); gg.gain.exponentialRampToValueAtTime(.0001, t + L); s.connect(f); f.connect(gg); gg.connect(actx.destination); s.start(t); s.stop(t + Math.min(.5, L)); };
  if (type === 'swish') noise(600, 3500, .22, .35);
  else if (type === 'whoosh') noise(400, 3000, .5, .4);
  else if (type === 'hit') { osc('triangle', 260, 40, .15, .25); noise(2000, 800, .1, .15, 1); }
  else if (type === 'boom') { osc('triangle', 120, 30, .8, .6); noise(800, 100, .5, .5, .7); }
  else if (type === 'clang') { osc('square', 1800, 1200, .25, .08); osc('sine', 2600, 2400, .5, .12); noise(5000, 3000, .15, .2, 3); }
  else if (type === 'hurt') osc('sawtooth', 180, 70, .2, .12);
  else if (type === 'ding') osc('sine', 1400, 2200, .6, .12);
  else if (type === 'roar') { osc('sawtooth', 140, 60, .9, .2); noise(300, 120, .5, .4, 1); }
  else if (type === 'stone') { osc('square', 300, 90, .2, .15); noise(1500, 400, .2, .3, 1.5); }
  else if (type === 'drink') { for (let i = 0; i < 3; i++) { const o = actx.createOscillator(), gg = actx.createGain(); o.frequency.setValueAtTime(500 + i * 90, t + i * .12); o.frequency.exponentialRampToValueAtTime(220, t + i * .12 + .1); gg.gain.setValueAtTime(.0001, t + i * .12); gg.gain.exponentialRampToValueAtTime(.12, t + i * .12 + .02); gg.gain.exponentialRampToValueAtTime(.0001, t + i * .12 + .11); o.connect(gg); gg.connect(actx.destination); o.start(t + i * .12); o.stop(t + i * .12 + .12); } }
  else if (type === 'level' || type === 'win') { const fs = type === 'win' ? [392, 523, 659, 784, 1046] : [523, 659, 784, 1046]; fs.forEach((f, i) => { const o = actx.createOscillator(), gg = actx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.setValueAtTime(.0001, t + i * .1); gg.gain.exponentialRampToValueAtTime(.2, t + i * .1 + .02); gg.gain.exponentialRampToValueAtTime(.0001, t + i * .1 + .7); o.connect(gg); gg.connect(actx.destination); o.start(t + i * .1); o.stop(t + i * .1 + .75); }); }
  else if (type === 'shield') { osc('sine', 400, 900, .5, .15); osc('sine', 600, 1300, .5, .08); }
}
/* ---------------- worlds ---------------- */
const worlds = {};
let world = null;
function H(x, z) { return world ? world.H(x, z) : 0; }
const GLSL_NOISE = `float hh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }`;
const timeU = { value: 0 };

function blobCloud(list, cx, cy, cz, s, n, col, flat = .45) { for (let j = 0; j < n; j++) list.push([G.sphLo, col, M4(cx + srnd(-1.3, 1.3) * s, cy + srnd(-.1, .35) * s, cz + srnd(-1.3, 1.3) * s, s * srnd(.7, 1.25), s * srnd(flat * .8, flat * 1.2), s * srnd(.7, 1.25))]); }

/* ===== 云海之巅 (tutorial) ===== */
function buildCloudWorld() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const R = 15;
  // platform top texture: white jade + bagua
  const top = canvasTex(1024, 1024, (c, w) => {
    const cx = w / 2; const gr = c.createRadialGradient(cx, cx, 50, cx, cx, cx); gr.addColorStop(0, '#f2efe6'); gr.addColorStop(.7, '#e2ddd0'); gr.addColorStop(1, '#bdb6a6'); c.fillStyle = gr; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${120 + Math.random() * 60},${120 + Math.random() * 50},${110 + Math.random() * 40},${Math.random() * .08})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * w, Math.random() * 14, 0, 7); c.fill(); }
    c.strokeStyle = '#9c8456'; c.lineWidth = 6; for (const r of [500, 470, 300, 285, 120]) { c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke(); }
    // radial tiles
    c.lineWidth = 2; c.strokeStyle = 'rgba(120,105,80,.45)'; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * 300, cx + Math.sin(a) * 300); c.lineTo(cx + Math.cos(a) * 470, cx + Math.sin(a) * 470); c.stroke(); }
    // trigrams
    const tri = ['111', '011', '101', '001', '110', '010', '100', '000'];
    c.fillStyle = '#6d5a36';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.save(); c.translate(cx + Math.cos(a) * 385, cx + Math.sin(a) * 385); c.rotate(a + Math.PI / 2); for (let k = 0; k < 3; k++) { const y = -36 + k * 30; if (tri[i][k] === '1') c.fillRect(-55, y, 110, 16); else { c.fillRect(-55, y, 46, 16); c.fillRect(9, y, 46, 16); } } c.restore(); }
    // taiji
    c.save(); c.translate(cx, cx); c.fillStyle = '#2b2620'; c.beginPath(); c.arc(0, 0, 110, -Math.PI / 2, Math.PI / 2); c.fill(); c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(0, 0, 110, Math.PI / 2, Math.PI * 1.5); c.fill();
    c.fillStyle = '#2b2620'; c.beginPath(); c.arc(0, 55, 55, 0, 7); c.fill(); c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(0, -55, 55, 0, 7); c.fill();
    c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(0, 55, 16, 0, 7); c.fill(); c.fillStyle = '#2b2620'; c.beginPath(); c.arc(0, -55, 16, 0, 7); c.fill(); c.restore();
  });
  const topM = new THREE.MeshStandardMaterial({ map: top, roughness: .45, metalness: .05, envMapIntensity: .8 });
  const plat = new THREE.Mesh(new THREE.CircleGeometry(R, 64), topM); plat.rotation.x = -Math.PI / 2; g.add(plat);
  const sideM = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: .7 });
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R - .6, 1.2, 64, 1, true), sideM); side.position.y = -.6; g.add(side);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xc9a456, metalness: .85, roughness: .32 });
  const rim = mk(new THREE.TorusGeometry(R, .09, 8, 96), goldM, g, 0, .02, 0); rim.rotation.x = Math.PI / 2;
  // floating rock island beneath
  const rockG = new THREE.ConeGeometry(R - .6, 11, 40, 8, true); const rp = rockG.attributes.position;
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i); const n = .75 + .5 * vnoise(Math.atan2(z, x) * 3 + 10, y * .5 + 5); rp.setXYZ(i, x * n, y, z * n); }
  rockG.computeVertexNormals(); const rock = new THREE.Mesh(rockG, new THREE.MeshStandardMaterial({ color: 0x6f6878, roughness: .95, flatShading: true })); rock.rotation.x = Math.PI; rock.position.y = -6.7; g.add(rock);
  // pillars with glowing lanterns along rim
  const pilM = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .55 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc860, emissiveIntensity: 2.2 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + .13, x = Math.cos(a) * (R - .5), z = Math.sin(a) * (R - .5);
    mk(G.cyl, pilM, g, x, .55, z, .2, 1.1, .2); mk(G.box, goldM, g, x, 1.15, z, .5, .1, .5).rotation.y = -a; mk(G.sph, lampM, g, x, 1.38, z, .17, .2, .17); mk(G.cone, goldM, g, x, 1.65, z, .3, .22, .3);
  }
  // cloud sea shader plane
  const seaM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { t: timeU, hi: { value: new THREE.Color(0xfff1e6) }, lo: { value: new THREE.Color(0x9d8fc0) }, hz: { value: new THREE.Color(0xf0c3a8) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: GLSL_NOISE + 'uniform float t; uniform vec3 hi,lo,hz; varying vec3 vW; void main(){ vec2 p=vW.xz*.018+vec2(t*.012,t*.006); float n=fb(p); float n2=fb(p*2.7-vec2(t*.02,0.)); float v=smoothstep(.25,.85,n*.7+n2*.45); vec3 c=mix(lo,hi,v); float d=length(vW.xz-cameraPosition.xz); c=mix(c,hz,smoothstep(150.,900.,d)); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600, 1, 1), seaM); sea.rotation.x = -Math.PI / 2; sea.position.y = -9; g.add(sea);
  // puffy clouds
  const cl = [];
  for (let i = 0; i < 60; i++) { const a = srnd(0, 6.28), r = i < 22 ? srnd(17, 40) : srnd(45, 420); blobCloud(cl, Math.cos(a) * r, srnd(-8.5, -4.5) + (r < 40 ? 0 : srnd(-2, 4)), Math.sin(a) * r, r < 40 ? srnd(2.5, 5) : srnd(6, 22), 6, i % 3 ? 0xffffff : 0xf6e8ff); }
  for (let i = 0; i < 16; i++) { const a = srnd(0, 6.28), r = srnd(300, 700); blobCloud(cl, Math.cos(a) * r, srnd(60, 160), Math.sin(a) * r, srnd(18, 40), 5, 0xffeef0, .3); }
  const clouds = new THREE.Mesh(mergeColored(cl), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x8a7a9a, emissiveIntensity: .55, transparent: true, opacity: .95 })); g.add(clouds);
  // distant peaks poking through clouds
  const pk = [];
  for (let i = 0; i < 16; i++) {
    const a = srnd(0, 6.28), r = srnd(220, 650), h = srnd(30, 110), w = h * srnd(.45, .7);
    const geo = new THREE.ConeGeometry(1, 1, 9, 6); const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); const n = .8 + .45 * vnoise(k * .7 + i * 13, y * 3); if (y < .5) p.setXYZ(k, p.getX(k) * n, y, p.getZ(k) * n); } geo.computeVertexNormals();
    pk.push([geo, 0x6a6290, M4(Math.cos(a) * r, -10 + h / 2, Math.sin(a) * r, w, h, w, srnd(0, 6))]);
    pk.push([geo, 0xf3eef8, M4(Math.cos(a) * r, -10 + h * .87, Math.sin(a) * r, w * .27, h * .26, w * .27, srnd(0, 6))]);
  }
  g.add(new THREE.Mesh(mergeColored(pk), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true })));
  // floating islands with pines
  const fi = [];
  for (const [x, y, z, s] of [[-38, -1, -30, 4], [42, 3, -46, 5], [-55, 6, 20, 3.5], [30, -3, 38, 3]]) {
    fi.push([new THREE.ConeGeometry(1, 2.2, 8), 0x6f6878, M4(x, y - s * .9, z, s, s, s, 0, Math.PI)]);
    fi.push([new THREE.CylinderGeometry(1, 1, .3, 10), 0x5c8a4a, M4(x, y + .1, z, s, 1, s)]);
    for (let k = 0; k < 3; k++) { const ox = srnd(-.5, .5) * s, oz = srnd(-.5, .5) * s, hs = srnd(.6, 1.1); fi.push([new THREE.ConeGeometry(.5, 1.6, 7), 0x2f5f3a, M4(x + ox, y + .9 * hs + .2, z + oz, hs, hs, hs)]); fi.push([new THREE.ConeGeometry(.38, 1.2, 7), 0x3a7044, M4(x + ox, y + 1.6 * hs + .2, z + oz, hs, hs, hs)]); }
  }
  g.add(new THREE.Mesh(mergeColored(fi), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  return {
    name: 'cloud', group: g, R: R - 1.6, spawn: { x: 0, z: 7, yaw: 0 },
    H: (x, z) => Math.hypot(x, z) < R + .3 ? 0 : -40,
    sky: [0x1b2257, 0x8a73b2, 0xf6c49e], sunDir: V3(-.72, .16, -.62).normalize(), sunCol: [1, .78, .55], fog: [0xe9b9a8, 80, 900],
    hemi: [0xe9dcff, 0x8a7090, .85], sunL: [0xffd0a0, 2.2], ground: 0xc8b8c8,
    update(dt) { clouds.rotation.y += dt * .004; },
  };
}

/* ===== 幽谷 (valley fight) ===== */
const VAL = { R: 29.5, pond: { x: 15, z: 15, r: 7 } };
function valleyH(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * .06 + 2, z * .06 - 3) - .5) * 1.2 + (vnoise(x * .3, z * .3) - .5) * .15;
  const a = Math.atan2(z, x);
  const wob = (vnoise(a * 4 + 3, 1.3) - .5) * 3;
  h += smooth(30 + wob, 38 + wob, r) * (5 + fbm(x * .08, z * .08) * 9);
  h += smooth(38, 85, r) * (22 + fbm(x * .02 + 7, z * .02) * 55);
  const P = VAL.pond, dp = Math.hypot(x - P.x, z - P.z);
  if (dp < P.r * 1.6) { const tgt = -1.6 + 1.9 * (dp / P.r) * (dp / P.r); const w = 1 - smooth(P.r * .8, P.r * 1.5, dp); h = lerp(h, Math.min(h, tgt), w); }
  return h;
}
function buildValleyWorld() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const SIZE = 240, SEG = 180;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, valleyH(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color();
  const g1 = new THREE.Color(0x4f8a34), g2 = new THREE.Color(0x7aa847), rock = new THREE.Color(0x7d786f), rock2 = new THREE.Color(0x5f5a58), mud = new THREE.Color(0x5e5a40), snow = new THREE.Color(0xf0f4f8);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i); const v = fbm(x * .07, z * .07); c.copy(g1).lerp(g2, v); if (y < -.25) c.lerp(mud, smooth(-.25, -.8, y)); c.lerp(v > .5 ? rock : rock2, Math.max(smooth(.85, .66, ny), smooth(14, 26, y) * .9)); c.lerp(snow, smooth(45, 62, y + v * 8)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
  // pond water
  const P = VAL.pond;
  const water = new THREE.Mesh(new THREE.CircleGeometry(P.r * 1.35, 48), new THREE.MeshStandardMaterial({ color: 0x2d7d92, roughness: .05, metalness: .15, transparent: true, opacity: .82, envMapIntensity: 1.4 }));
  water.rotation.x = -Math.PI / 2; water.position.set(P.x, -.3, P.z); water.renderOrder = 1; g.add(water);
  // waterfall into pond
  const wa = Math.atan2(P.z, P.x), wr = 33.5, wx = Math.cos(wa) * wr, wz = Math.sin(wa) * wr, wh = valleyH(wx, wz);
  const fallM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { t: timeU }, vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: GLSL_NOISE + 'uniform float t; varying vec2 vU; void main(){ float n=fb(vec2(vU.x*8., vU.y*3.+t*2.6)); float a=smoothstep(.0,.15,vU.x)*smoothstep(1.,.85,vU.x)*(.55+.45*n); vec3 c=mix(vec3(.55,.75,.85),vec3(1.),n); gl_FragColor=vec4(c,a*.9); }' });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(3.2, wh + 1.5, 1, 1), fallM); fall.position.set(wx - Math.cos(wa) * 1.2, (wh + 1.5) / 2 - .6, wz - Math.sin(wa) * 1.2); fall.rotation.y = -wa + Math.PI / 2; fall.rotation.x = -.18; g.add(fall);
  const fallX = wx - Math.cos(wa) * 2.2, fallZ = wz - Math.sin(wa) * 2.2;
  // grass (instanced blades with wind)
  const bladeG = new THREE.BufferGeometry(); { const pos = [], cc = []; const segs = 4; for (let i = 0; i <= segs; i++) { const t = i / segs, w = .045 * (1 - t * .92); pos.push(-w, t, 0, w, t, 0); const k = .35 + .65 * t; cc.push(k * .9, k, k * .7, k * .9, k, k * .7); } const idx = []; for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } bladeG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bladeG.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); bladeG.setIndex(idx); bladeG.computeVertexNormals(); }
  const grassM = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  grassM.onBeforeCompile = sh => { sh.uniforms.t = timeU; sh.vertexShader = 'uniform float t;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 ip = instanceMatrix[3]; float sw = sin(t*1.8 + ip.x*.35 + ip.z*.27)*.5 + sin(t*3.1+ip.x*.9)*.18; transformed.x += sw * position.y * position.y * .35; transformed.z += sw * position.y * position.y * .2;'); };
  const N = 14000; const grass = new THREE.InstancedMesh(bladeG, grassM, N); const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let k = 0, tries = 0; const gc = new THREE.Color();
  while (k < N && tries++ < N * 4) { const a = srnd(0, 6.28), r = Math.sqrt(srand()) * 36; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = valleyH(x, z); if (h < -.15 || h > 6) continue; if (Math.hypot(x - P.x, z - P.z) < P.r * .95) continue; const clump = vnoise(x * .25 + 40, z * .25); if (clump < .3 && srand() < .6) continue; const s = srnd(.5, 1.1) * (.7 + clump * .7); e.set(srnd(-.25, .25), srnd(0, 6.28), srnd(-.25, .25)); mm.compose(V3(x, h - .03, z), q.setFromEuler(e), V3(s * srnd(.8, 1.4), s, s)); grass.setMatrixAt(k, mm); gc.setHSL(srnd(.2, .29), srnd(.45, .7), srnd(.32, .5)); grass.setColorAt(k, gc); k++; }
  grass.count = k; g.add(grass);
  // flowers
  { const fg = new THREE.IcosahedronGeometry(.07, 0); const NF = 500; const fl = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: 0xffffff }), NF); let j = 0, tr = 0; const fc = [0xfff6e0, 0xffd84a, 0xc8a0ff, 0xff9ab8]; while (j < NF && tr++ < 5000) { const a = srnd(0, 6.28), r = srnd(2, 31); const x = Math.cos(a) * r, z = Math.sin(a) * r, h = valleyH(x, z); if (h < 0 || Math.hypot(x - P.x, z - P.z) < P.r) continue; mm.compose(V3(x, h + srnd(.25, .5), z), q.identity(), V3(1, .6, 1)); fl.setMatrixAt(j, mm); fl.setColorAt(j, gc.set(fc[j % 4])); j++; } fl.count = j; g.add(fl); }
  // strange rocks (怪石)
  const cols = [];
  function strangeRock(seed, s, hgt) {
    const geo = new THREE.IcosahedronGeometry(1, 4); const pp = geo.attributes.position; const cc = [];
    for (let i = 0; i < pp.count; i++) { const v = V3(pp.getX(i), pp.getY(i), pp.getZ(i)); const nn = vnoise(v.x * 2.2 + seed, v.y * 2.2 + v.z * 1.7) * .6 + vnoise(v.x * 5 + seed * 2, v.z * 5 - v.y * 3) * .25; const pin = 1 - .55 * smooth(.62, .8, vnoise(v.x * 3.1 + seed * 3, v.y * 3.3 - seed)); const f = (.55 + nn) * pin; pp.setXYZ(i, v.x * f * s, (v.y * .5 + .5) * hgt * (1 + (nn - .4) * .4), v.z * f * s); const tone = .7 + nn * .5, moss = smooth(.35, .8, v.y) * smooth(.3, .6, vnoise(v.x * 4 + seed, v.z * 4)); cc.push(lerp(.34, .24, moss) * tone, lerp(.35, .31, moss) * tone, lerp(.36, .17, moss) * tone); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); geo.computeVertexNormals(); return geo;
  }
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: false, color: 0xb4b0a4, envMapIntensity: .55 });
  const place = (x, z, s, hgt, collide, ry) => { const m = new THREE.Mesh(strangeRock(srnd(0, 50), s, hgt), rockM); m.position.set(x, valleyH(x, z) - .4, z); m.rotation.y = ry ?? srnd(0, 6); g.add(m); if (collide) cols.push({ x, z, r: s * .8 }); return m; };
  for (const [a, r, s, h] of [[.5, 14, 1.3, 4.6], [2.1, 19, 1.6, 3.4], [3.0, 10, 1.0, 5.4], [4.1, 21, 1.8, 2.8], [5.3, 16, 1.2, 6.2], [1.2, 24, 1.1, 3.8], [3.7, 25, 1.4, 5]]) place(Math.cos(a) * r, Math.sin(a) * r, s, h, true);
  // ring of cliffs/rocks marking boundary
  for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + srnd(-.04, .04); if (Math.abs(angDiff(a, wa)) < .09) continue; const r = srnd(31.5, 34); place(Math.cos(a) * r, Math.sin(a) * r, srnd(1.6, 3.2), srnd(3, 9), false); }
  // trees on slopes
  { const trunkG = new THREE.CylinderGeometry(.18, .3, 2.2, 6); const pine = mergeColored([[trunkG, 0x5a3d26, M4(0, 1.1, 0)], [new THREE.ConeGeometry(2.1, 3.2, 8), 0x2f5f32, M4(0, 3.2, 0)], [new THREE.ConeGeometry(1.6, 2.7, 8), 0x376b37, M4(0, 4.8, 0)], [new THREE.ConeGeometry(1.05, 2.3, 8), 0x3f7a3c, M4(0, 6.3, 0)]]);
    const NT = 220; const im = new THREE.InstancedMesh(pine, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), NT); let j = 0, tr = 0;
    while (j < NT && tr++ < 6000) { const a = srnd(0, 6.28), r = srnd(36, 95); const x = Math.cos(a) * r, z = Math.sin(a) * r, h = valleyH(x, z); if (h > 40) continue; if (valleyH(x + 2, z) - h > 3.2) continue; const s = srnd(.7, 1.4); mm.compose(V3(x, h - .3, z), q.setFromAxisAngle(Y_AXIS, srnd(0, 6)), V3(s, s * srnd(.9, 1.3), s)); im.setMatrixAt(j++, mm); }
    im.count = j; g.add(im); }
  // sky clouds
  const cl = []; for (let i = 0; i < 18; i++) { const a = srnd(0, 6.3), r = srnd(250, 520); blobCloud(cl, Math.cos(a) * r, srnd(110, 190), Math.sin(a) * r, srnd(14, 26), 5, 0xffffff, .4); }
  g.add(new THREE.Mesh(mergeColored(cl), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa6b6, fog: false, transparent: true, opacity: .92 })));
  return {
    name: 'valley', group: g, R: VAL.R, cols, spawn: { x: 0, z: 17, yaw: 0 },
    H: valleyH, sky: [0x3a74c8, 0x9cc7ec, 0xd8e8f0], sunDir: V3(-.45, .62, -.55).normalize(), sunCol: [1, .92, .75], fog: [0xc8dce8, 70, 380],
    hemi: [0xcfe3ff, 0x55623a, .8], sunL: [0xfff0d8, 2.0], ground: 0x4d5a3a,
    update(dt) { if (Math.random() < .5) emit(fallX + rand(-1.4, 1.4), rand(-.2, .6), fallZ + rand(-1, 1), rand(-.6, .6), rand(1, 2.5), rand(-.6, .6), 0xffffff, .5, .8, -3); },
  };
}
function setWorld(name) {
  for (const k in worlds) worlds[k].group.visible = false;
  world = worlds[name]; world.group.visible = true;
  skyMat.uniforms.top.value.set(world.sky[0]); skyMat.uniforms.mid.value.set(world.sky[1]); skyMat.uniforms.bot.value.set(world.sky[2]);
  skyMat.uniforms.sunDir.value.copy(world.sunDir); skyMat.uniforms.sunCol.value.setRGB(...world.sunCol);
  scene.fog.color.set(world.fog[0]); scene.fog.near = world.fog[1]; scene.fog.far = world.fog[2];
  hemi.color.set(world.hemi[0]); hemi.groundColor.set(world.hemi[1]); hemi.intensity = world.hemi[2];
  sunL.color.set(world.sunL[0]); sunL.intensity = world.sunL[1]; sunL.position.copy(world.sunDir).multiplyScalar(100);
  rebuildEnv(world.ground);
}
worlds.cloud = buildCloudWorld();
worlds.valley = buildValleyWorld();
/* ---------------- view model: black leather gloves + sword ---------------- */
const grainTex = canvasTex(256, 256, (c, w, h) => { const d = c.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = 110 + (hash(i % w, (i / w) | 0) * 60 + vnoise((i % w) * .15, ((i / w) | 0) * .15) * 80) | 0; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } c.putImageData(d, 0, 0); }, [3, 3]);
grainTex.colorSpace = THREE.NoColorSpace;
const leather = new THREE.MeshPhysicalMaterial({ color: 0x18171b, roughness: .44, metalness: 0, clearcoat: .75, clearcoatRoughness: .32, sheen: .6, sheenColor: new THREE.Color(0x5a5a66), sheenRoughness: .5, envMapIntensity: 1.1, bumpMap: grainTex, bumpScale: .6 });
const leatherDark = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: .65 });
const stitchM = new THREE.MeshStandardMaterial({ color: 0x4a4740, roughness: .8 });
const steelM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: .25, envMapIntensity: 1.3 });
const sleeveM = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: .85 });
const sleeveTrim = new THREE.MeshStandardMaterial({ color: 0x5fa6d8, roughness: .55, metalness: .2 });
const vRoot = new THREE.Group(); vScene.add(vRoot);
function setOutfit(robe, trim) { sleeveM.color.set(robe); sleeveTrim.color.set(trim); }

// stitching line along a path
function stitch(parent, pts, r = .0011) { mk(taperTube(pts, [r, r], { radial: 5, noCap: true }), stitchM, parent); }
/* right fist — anatomically a RIGHT hand. local frame: hilt along +Y through origin (index finger at +Y),
   back of hand at -X, palm/hilt side +X, wrist toward -Z, knuckles near z≈0 */
function buildFist(parent) {
  const g = new THREE.Group(); parent.add(g);
  mk(superEllipsoid(.018, .048, .044, .62), leather, g, -.031, .003, -.038);               // hand back
  mk(superEllipsoid(.015, .023, .026, .7), leather, g, -.012, .03, -.054);                 // thenar pad
  mk(superEllipsoid(.014, .021, .024, .7), leather, g, -.014, -.027, -.052);               // hypothenar
  mk(superEllipsoid(.021, .036, .02, .7), leather, g, -.022, 0, -.085);                    // wrist
  // knuckle ridge
  mk(taperTube([V3(-.037, .044, -.002), V3(-.04, .012, .001), V3(-.038, -.02, 0), V3(-.034, -.036, -.004)], [.011, .012, .011, .009]), leather, g);
  const F = [[.036, .0099, .0236], [.0125, .0102, .0238], [-.0105, .0097, .0232], [-.0315, .0085, .0218]];
  F.forEach(([y, r, R], i) => {
    const ang = [12, 64, 116, 168, 222, 276], pts = ang.map(a => { a *= Math.PI / 180; return V3(-Math.cos(a) * R, y + (i === 0 ? -.001 : 0), Math.sin(a) * R); });
    pts[0].set(-.036, y, -.004);
    mk(taperTube(pts, [r * 1.1, r * 1.02, r, r * .96, r * .9, r * .8]), leather, g);
    // joint creases (subtle rings) & back seam
    const Rs = R + r * .96; stitch(g, [30, 70, 110, 150, 185].map(a => { a *= Math.PI / 180; return V3(-Math.cos(a) * Rs, y, Math.sin(a) * Rs); }));
  });
  // thumb wrapping over index & middle
  mk(taperTube([V3(-.022, .036, -.066), V3(-.004, .052, -.048), V3(.014, .054, -.026), V3(.024, .047, -.006), V3(.025, .04, .006)], [.0125, .0122, .0112, .0102, .0094]), leather, g);
  // back-of-hand seams + strap
  for (const y of [.024, .002, -.02]) stitch(g, [V3(-.05, y, -.074), V3(-.051, y * 1.05, -.04), V3(-.05, y * 1.1, -.012)]);
  return g;
}
/* left 剑指 — LEFT hand: fingers +Z, back of hand +X, palm -X, index finger at +Y */
function buildJianzhi(parent) {
  const g = new THREE.Group(); parent.add(g);
  mk(superEllipsoid(.017, .046, .043, .62), leather, g, .004, .002, 0);
  mk(superEllipsoid(.016, .024, .026, .7), leather, g, -.012, .028, -.016);
  mk(superEllipsoid(.021, .035, .02, .7), leather, g, .002, 0, -.05);
  for (const [y, len, r] of [[.0235, .084, .0103], [.0035, .09, .0105]]) {
    const pts = [V3(.002, y, .036), V3(.0, y, .036 + len * .35), V3(-.002, y - .001, .036 + len * .7), V3(-.003, y - .002, .036 + len)];
    mk(taperTube(pts, [r * 1.08, r, r * .95, r * .85]), leather, g);
    stitch(g, [V3(.011, y, .04), V3(.01, y, .036 + len * .5), V3(.008, y, .036 + len * .82)]);
  }
  for (const [y, r] of [[-.016, .0094], [-.034, .0083]]) mk(taperTube([V3(.004, y, .03), V3(-.002, y, .048), V3(-.016, y, .05), V3(-.023, y, .038), V3(-.019, y, .026)], [r * 1.1, r, r * .96, r * .9, r * .85]), leather, g);
  mk(taperTube([V3(-.006, .032, -.03), V3(-.022, .03, -.005), V3(-.034, .012, .022), V3(-.036, -.008, .04), V3(-.034, -.018, .046)], [.0125, .0118, .0108, .0098, .009]), leather, g);
  for (const y of [.022, .0, -.022]) stitch(g, [V3(.022, y, -.034), V3(.023, y, 0), V3(.021, y, .03)]);
  return g;
}
function buildGourd() { // 酒葫芦 (axis +Y, waist at origin)
  const g = new THREE.Group();
  const prof = [[0, -.11], [.03, -.108], [.05, -.095], [.058, -.07], [.055, -.045], [.04, -.022], [.022, -.004], [.019, .006], [.026, .02], [.036, .04], [.037, .06], [.028, .08], [.013, .094], [.011, .108], [.0, .109]];
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xc08433, roughness: .35, clearcoat: .9, clearcoatRoughness: .2, envMapIntensity: 1 });
  mk(lathe(prof, 28), gm, g);
  const red = new THREE.MeshStandardMaterial({ color: 0xb3162a, roughness: .7 });
  const cork = mk(G.cylT, new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: .9 }), g, 0, .116, 0, .012, .018, .012); cork.rotation.x = Math.PI;
  const tie = mk(G.tor, red, g, 0, .002, 0, .021, .021, .03); tie.rotation.x = Math.PI / 2;
  mk(taperTube([V3(.02, .0, 0), V3(.03, -.03, .008), V3(.034, -.06, .004)], [.0025, .0025]), red, g);
  const tc = mk(G.cone, red, g, .034, -.075, .004, .008, .03, .008); tc.rotation.x = Math.PI;
  return { g, mat: gm };
}
function addForearm() {
  const g = new THREE.Group(); vRoot.add(g);
  const cuff = mk(lathe([[.029, .01], [.03, -.02], [.033, -.05], [.038, -.085], [.043, -.1], [.046, -.106], [.044, -.112]], 26), leather, g); cuff.rotation.x = Math.PI / 2; cuff.material.side = THREE.DoubleSide;
  const strap = mk(G.tor, leatherDark, g, 0, 0, -.05, .034, .034, .045);
  mk(G.cyl, steelM, g, 0, .036, -.05, .007, .006, .007);
  stitch(g, [V3(.0, .0315, -.012), V3(0, .036, -.06), V3(0, .04, -.1)]);
  const sl = mk(new THREE.CylinderGeometry(.046, .066, .5, 20, 1, true), sleeveM, g, 0, 0, -.36); sl.rotation.x = -Math.PI / 2;
  sl.material.side = THREE.DoubleSide;
  mk(G.tor, sleeveTrim, g, 0, 0, -.112, .048, .048, .07);
  return g;
}
const rFore = addForearm(), lFore = addForearm();
const R_ELBOW = V3(.36, -.7, -.05), L_ELBOW = V3(-.36, -.7, -.05), NEG_Z = V3(0, 0, -1);
function placeForearm(fore, hand, wristLocal, elbow) {
  const w = wristLocal.clone().applyQuaternion(hand.quaternion).add(hand.position);
  fore.position.copy(w); fore.quaternion.setFromUnitVectors(NEG_Z, elbow.clone().sub(w).normalize());
  // keep the strap button roughly facing up/out: twist around axis
}
const rHand = new THREE.Group(); vRoot.add(rHand); buildFist(rHand);
const vSword = buildSword({ tassel: true }); rHand.add(vSword.g);
const lHand = new THREE.Group(); vRoot.add(lHand);
const lJZ = buildJianzhi(lHand);
const lFistG = new THREE.Group(); lHand.add(lFistG); buildFist(lFistG); lFistG.scale.x = -1; lFistG.visible = false;
const gourd = buildGourd(); lFistG.add(gourd.g); gourd.g.visible = false; gourd.g.scale.setScalar(.85);
function handQuat(d, f, out) { // d: grip dir (local +Y), f: toward elbow (local -Z)
  const y = d.clone().normalize(); const fz = f.clone().sub(y.clone().multiplyScalar(f.dot(y))).normalize().negate();
  const x = y.clone().cross(fz); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, fz));
}
function lHandQuat(d, up, out) { // fingers +Z = d, index side +Y ~ up
  const z = d.clone().normalize(); const y = up.clone().sub(z.clone().multiplyScalar(up.dot(z))).normalize(); const x = y.clone().cross(z);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function RK(k, p, d, f) { return { k, p: V3(...p), q: handQuat(V3(...d), V3(...(f || [.5, -.6, .6])), new THREE.Quaternion()) }; }
function LK(k, p, d, up) { return { k, p: V3(...p), q: lHandQuat(V3(...d), V3(...(up || [.3, .3, .9])), new THREE.Quaternion()) }; }
function LF(k, p, d, f) { // left fist (mirrored): mirror the direction inputs through X so the same handQuat works
  const q = handQuat(V3(-d[0], d[1], d[2]), V3(-(f || [-.5, -.6, .6])[0], (f || [-.5, -.6, .6])[1], (f || [-.5, -.6, .6])[2]), new THREE.Quaternion());
  // reflect quaternion across X: (x,y,z,w)->(x,-y,-z,w)
  q.set(q.x, -q.y, -q.z, q.w); return { k, p: V3(...p), q };
}
let R_IDLE = RK(0, [.2, -.23, -.52], [-.3, .82, -.48], [.5, -.62, .6]);
let L_IDLE = LK(0, [-.2, -.22, -.5], [.25, .72, -.6], [.55, .2, .8]);
const RIDE_R = RK(0, [.25, -.17, -.52], [.1, .95, -.2], [.5, -.8, .4]);

/* ---------------- VM animation ---------------- */
const VM = { act: null, t: 0, dur: 1, keys: null, lkeys: null, events: [], fired: 0, lmode: 'jz', hold: false };
function playVM(name, dur, keys, lkeys, events = [], lmode = 'jz') { VM.act = name; VM.t = 0; VM.dur = dur; VM.keys = keys; VM.lkeys = lkeys; VM.events = events.slice().sort((a, b) => a.at - b.at); VM.fired = 0; VM.lmode = lmode; }
function sampleKeys(keys, k, outP, outQ) {
  let i = 0; while (i < keys.length - 2 && k > keys[i + 1].k) i++;
  const a = keys[i], b = keys[i + 1]; const u = easeIO(clamp((k - a.k) / Math.max(1e-4, b.k - a.k), 0, 1));
  outP.lerpVectors(a.p, b.p, u); outQ.slerpQuaternions(a.q, b.q, u);
}
const vmR = { p: V3().copy(R_IDLE.p), q: R_IDLE.q.clone() }, vmL = { p: V3().copy(L_IDLE.p), q: L_IDLE.q.clone() };
let swordInHand = true, slashFlip = false, swordGlow = 0, handsAlpha = 1;
const TWO_OFF = V3(0, -.082, 0);
const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _te = new THREE.Euler();
function updateVM(dt) {
  let lmode = 'jz';
  if (VM.act) {
    VM.t += dt; const k = Math.min(1, VM.t / VM.dur);
    while (VM.fired < VM.events.length && VM.events[VM.fired].at <= k) VM.events[VM.fired++].fn();
    if (VM.keys) sampleKeys(VM.keys, k, vmR.p, vmR.q); else { vmR.p.lerp(R_IDLE.p, Math.min(1, dt * 10)); vmR.q.slerp(R_IDLE.q, Math.min(1, dt * 10)); }
    if (VM.lkeys) sampleKeys(VM.lkeys, k, vmL.p, vmL.q); else { vmL.p.lerp(L_IDLE.p, Math.min(1, dt * 10)); vmL.q.slerp(L_IDLE.q, Math.min(1, dt * 10)); }
    lmode = VM.lmode;
    if (k >= 1 && !VM.hold) { VM.act = null; }
  } else {
    const rp = player.riding ? RIDE_R : R_IDLE;
    vmR.p.lerp(rp.p, Math.min(1, dt * 10)); vmR.q.slerp(rp.q, Math.min(1, dt * 10));
    vmL.p.lerp(L_IDLE.p, Math.min(1, dt * 10)); vmL.q.slerp(L_IDLE.q, Math.min(1, dt * 10));
  }
  const ph = player.bob, w = player.moveAmt * (player.riding ? .25 : 1), br = Math.sin(gameT * 1.8) * .004;
  const bx = Math.cos(ph) * .014 * w, by = -Math.abs(Math.sin(ph)) * .016 * w + br;
  const sway = clamp(-yawVel * .012, -.05, .05);
  rHand.position.set(vmR.p.x + bx + sway, vmR.p.y + by, vmR.p.z); rHand.quaternion.copy(vmR.q);
  lJZ.visible = lmode === 'jz'; lFistG.visible = lmode !== 'jz'; gourd.g.visible = lmode === 'gourd';
  if (lmode === 'two') { lHand.quaternion.copy(rHand.quaternion); lHand.position.copy(TWO_OFF).applyQuaternion(rHand.quaternion).add(rHand.position); }
  else { lHand.position.set(vmL.p.x + bx * .8 + sway, vmL.p.y + by * 1.1 - br, vmL.p.z); lHand.quaternion.copy(vmL.q); }
  placeForearm(rFore, rHand, V3(-.02, 0, -.09), R_ELBOW);
  placeForearm(lFore, lHand, lmode === 'jz' ? V3(.002, 0, -.055) : V3(.02, 0, -.09), L_ELBOW);
  vSword.g.visible = swordInHand;
  if (vSword.tassel) { vSword.g.updateWorldMatrix(true, false); _tq.setFromRotationMatrix(vSword.g.matrixWorld).invert(); _tq2.setFromEuler(_te.set(Math.sin(gameT * 3) * .2 + w * Math.sin(ph * 2) * .3, 0, Math.cos(gameT * 2.3) * .15 - sway * 3)); vSword.tassel.quaternion.copy(_tq).multiply(_tq2); }
  swordGlow = Math.max(0, swordGlow - dt * 1.5);
  vSword.bladeM.emissiveIntensity = Math.min(1.3, swordGlow * .9);
  vRoot.position.y = player.riding ? -.02 : 0;
  vRoot.visible = handsAlpha > 0.01;
}
/* ---------------- characters ---------------- */
function phys(hex, o = {}) { return new THREE.MeshPhysicalMaterial(Object.assign({ color: hex, roughness: .7, metalness: 0, envMapIntensity: .7 }, o)); }
function std(hex, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: .7, metalness: 0, envMapIntensity: .7 }, o)); }
function collectMats(root) { const s = new Set(); root.traverse(o => { if (o.material) s.add(o.material); }); return [...s]; }
// fresnel aura shell
function auraMat(hex, power = 2.2, strength = 1) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, uniforms: { col: { value: new THREE.Color(hex) }, t: timeU, k: { value: strength } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=position; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: GLSL_NOISE + `uniform vec3 col; uniform float t,k; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f=pow(1.-abs(dot(vN,vV)),${power.toFixed(2)}); float n=fb(vec2(vP.x*3.+vP.z*2., vP.y*2.5-t*1.6)); float a=f*(.45+.9*n)*k; gl_FragColor=vec4(col*a,a); }` });
}

/* ===== humanoid sword immortal (used for 师兄 and the decoy) ===== */
function buildImmortal(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const robe = phys(o.robe, { roughness: .62, sheen: .8, sheenColor: new THREE.Color(o.sheen || 0xffffff), sheenRoughness: .4 });
  const inner = phys(o.inner, { roughness: .7, sheen: .5, sheenColor: new THREE.Color(0xffffff) });
  const trim = std(o.trim, { metalness: .85, roughness: .3, envMapIntensity: 1.2 });
  const skin = phys(o.skin, { roughness: .5, sheen: .3, sheenColor: new THREE.Color(0xffd0c0) });
  const hair = phys(0x0c0a10, { roughness: .35, clearcoat: .6, clearcoatRoughness: .3, sheen: .6, sheenColor: new THREE.Color(o.hairSheen || 0x6050a0) });
  const eyeM = std(o.eye, { emissive: o.eye, emissiveIntensity: o.eyeI || 2.5 });
  const dark = std(0x141018, { roughness: .6 });
  const sashM = phys(o.sash || o.trim, { roughness: .5 });
  // skirt: inner full, outer open at front
  mk(lathe([[.0, .02], [.37, .02], [.36, .25], [.3, .55], [.22, .85], [.17, 1.02], [0, 1.03]], 32), inner, body);
  const outer = new THREE.Mesh(new THREE.LatheGeometry([[.43, 0], [.42, .2], [.35, .5], [.255, .82], [.19, 1.0], [.18, 1.06]].map(([r, y]) => new THREE.Vector2(r, y)), 36, 0.45, Math.PI * 2 - .9), robe); outer.material.side = THREE.DoubleSide; body.add(outer);
  { const hp = []; for (let i = 0; i <= 24; i++) { const ph = .45 + (Math.PI * 2 - .9) * i / 24; hp.push(V3(Math.sin(ph) * .432, .012, Math.cos(ph) * .432)); } mk(taperTube(hp, [.014, .014], { radial: 6, seg: 72 }), trim, body);
    for (const s of [-1, 1]) { const ph = s > 0 ? .45 : -.45; const ep = []; for (const [r, y] of [[.43, 0], [.42, .2], [.35, .5], [.255, .82], [.19, 1.0]]) ep.push(V3(Math.sin(ph) * (r + .004), y, Math.cos(ph) * (r + .004))); mk(taperTube(ep, [.012, .012], { radial: 6 }), trim, body); } }
  for (const s of [-1, 1]) mk(superEllipsoid(.055, .04, .11, .7), dark, body, s * .1, .04, .1);
  // torso
  const torso = new THREE.Group(); torso.position.y = 1.02; body.add(torso);
  mk(lathe([[.0, -.04], [.17, -.04], [.175, .1], [.2, .25], [.2, .34], [.175, .44], [.08, .5], [.05, .54], [0, .54]], 28), robe, torso);
  // crossed collar (交领)
  const collar = (s, m, w) => mk(taperTube([V3(s * .09, .5, .02), V3(s * .05, .38, .15), V3(-s * .04, .22, .19), V3(-s * .12, .06, .165)], [w, w], { radial: 6, flat: .35 }), m, torso);
  collar(1, inner, .028); collar(-1, inner, .028);
  collar(1, trim, .009).position.z = .012;
  // belt + jade pendant
  const belt = mk(G.cyl, sashM, torso, 0, .02, 0, .185, .07, .185);
  mk(G.cyl, trim, torso, 0, .055, 0, .188, .01, .188); mk(G.cyl, trim, torso, 0, -.015, 0, .188, .01, .188);
  mk(superEllipsoid(.04, .03, .015, .6), trim, torso, 0, .02, .185);
  const pend = new THREE.Group(); pend.position.set(.1, -.02, .16); torso.add(pend);
  mk(G.cyl, sashM, pend, 0, -.06, 0, .004, .12, .004);
  const jade = std(o.jade || 0x9af0c8, { emissive: o.jade || 0x2a8060, emissiveIntensity: .4, roughness: .2 });
  mk(G.tor, jade, pend, 0, -.14, 0, .035, .035, .06);
  mk(G.cone, sashM, pend, 0, -.22, 0, .018, .1, .018).rotation.x = Math.PI;
  // shoulders (small ornate pauldrons)
  for (const s of [-1, 1]) { const sp = mk(superEllipsoid(.08, .045, .08, .6), trim, torso, s * .2, .43, 0); sp.rotation.z = s * -.35; }
  // neck & head
  mk(G.cyl, skin, torso, 0, .58, .0, .045, .1, .045);
  const head = new THREE.Group(); head.position.set(0, .7, .01); torso.add(head);
  mk(superEllipsoid(.088, .112, .1, .85, 24, 18), skin, head, 0, 0, .0);
  mk(superEllipsoid(.06, .05, .06, .9), skin, head, 0, -.075, .03);                 // jaw
  const nose = mk(G.cone, skin, head, 0, -.012, .1, .014, .045, .02); nose.rotation.x = .25;
  for (const s of [-1, 1]) {
    mk(superEllipsoid(.021, .009, .01, .8), std(0xf4f0ff), head, s * .036, .02, .088);
    mk(G.sph, eyeM, head, s * .036, .02, .094, .011, .008, .006);
    const brow = mk(G.box, hair, head, s * .038, .045, .093, .042, .008, .01); brow.rotation.z = s * (o.angry ? -.32 : -.08);
    mk(superEllipsoid(.012, .03, .02), skin, head, s * .088, 0, 0);
  }
  mk(G.box, std(0x6a3a4a), head, 0, -.058, .088, .03, .005, .006);
  if (o.mark) { const mm = mk(G.box, eyeM, head, 0, .07, .098, .01, .022, .003); mm.rotation.z = Math.PI / 4; }
  // hair: skull cap, top knot + crown, long back hair, side locks
  mk(superEllipsoid(.098, .1, .108, .8), hair, head, 0, .04, -.015).scale.set(1, .9, 1);
  mk(G.sph, hair, head, 0, .12, -.035, .05, .045, .05);
  mk(G.cyl, trim, head, 0, .15, -.035, .04, .05, .03);
  const pin = mk(G.cyl, trim, head, 0, .16, -.035, .005, .2, .005); pin.rotation.z = Math.PI / 2;
  const backHair = mk(taperTube([V3(0, .05, -.08), V3(0, -.12, -.13), V3(0, -.35, -.14), V3(0, -.6, -.12)], [.085, .095, .08, .03], { radial: 12 }), hair, head); backHair.scale.x = 1.2; backHair.scale.z = .5; backHair.position.z = -.04;
  const locks = [];
  for (const s of [-1, 1]) locks.push(mk(taperTube([V3(s * .07, .06, .07), V3(s * .095, -.06, .08), V3(s * .1, -.2, .07), V3(s * .09, -.33, .06)], [.014, .015, .011, .003], { radial: 7 }), hair, head));
  // arms with wide sleeves
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .22, .4, 0); torso.add(sh);
    mk(taperTube([V3(0, 0, 0), V3(0, -.14, 0), V3(0, -.28, 0)], [.06, .055, .05]), robe, sh);
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    const slv = mk(lathe([[.05, 0], [.065, -.08], [.085, -.2], [.1, -.29], [.104, -.31], [.03, -.30]], 22), robe, el); slv.material.side = THREE.DoubleSide; slv.scale.z = .75; slv.scale.x = .9;
    const cuffT = mk(G.tor, trim, el, 0, -.31, 0, .095, .095, .095); cuffT.rotation.x = Math.PI / 2; cuffT.scale.z = .1; cuffT.scale.y = .075;
    mk(G.cyl, inner, el, 0, -.28, 0, .04, .1, .04);
    const hand = new THREE.Group(); hand.position.y = -.34; el.add(hand);
    mk(superEllipsoid(.028, .045, .038, .7), skin, hand, 0, -.02, .0);
    mk(taperTube([V3(-.02 * s, -.0, .03), V3(-.032 * s, -.03, .04), V3(-.025 * s, -.05, .03)], [.011, .009]), skin, hand);
    arms.push({ sh, el, hand, s });
  }
  // sword in right hand
  const sw = buildSword(o.sword || {}); sw.g.scale.setScalar(1.05); arms[1].hand.add(sw.g); sw.g.position.set(0, -.03, .01); sw.g.rotation.x = Math.PI / 2;
  // floating ribbon (披帛)
  let ribbon = null;
  if (o.ribbon) {
    const rm = new THREE.MeshStandardMaterial({ color: o.ribbon, emissive: o.ribbon, emissiveIntensity: .35, roughness: .5, transparent: true, opacity: .85, side: THREE.DoubleSide });
    rm.onBeforeCompile = sh => { sh.uniforms.t = timeU; sh.vertexShader = 'uniform float t;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float ww = abs(position.x); transformed.z += sin(t*2.2 + position.x*4.)*.06*ww; transformed.y += sin(t*1.7 + position.x*3.)*.05*ww;'); };
    ribbon = mk(taperTube([V3(-.95, .65, -.1), V3(-.55, .95, -.25), V3(-.25, 1.42, -.2), V3(0, 1.48, -.24), V3(.25, 1.42, -.2), V3(.55, 1.0, -.25), V3(.9, .55, -.05)], [.035, .035], { radial: 6, flat: .12, seg: 60, noCap: true }), rm, body);
  }
  return { root, body, torso, head, arms, sword: sw, locks, ribbon, mats: collectMats(root) };
}
// pose: rotations for joints (radians)
const IPOSE = {
  idle: { t: [0, 0, 0], h: [0, 0, 0], rs: [-.25, 0, .18], re: [-.6, 0, 0], rw: [0, 0, 0], ls: [-.7, 0, -.3], le: [-1.5, .4, 0] },
  raise: { t: [-.12, -.3, 0], h: [-.1, 0, 0], rs: [-2.9, 0, .25], re: [-.3, 0, 0], rw: [.3, 0, 0], ls: [-.4, 0, -.5], le: [-.8, 0, 0] },
  slash: { t: [.25, .45, 0], h: [.1, -.3, 0], rs: [-.7, 0, -.4], re: [-.2, 0, 0], rw: [.6, 0, 0], ls: [-.2, 0, -.7], le: [-.4, 0, 0] },
  thrust: { t: [.15, -.35, 0], h: [0, .3, 0], rs: [-1.55, 0, .05], re: [0, 0, 0], rw: [-1.4, 0, 0], ls: [-.3, 0, -.8], le: [-.3, 0, 0] },
  cast: { t: [-.05, .2, 0], h: [-.05, -.15, 0], rs: [-.3, 0, .3], re: [-.5, 0, 0], rw: [0, 0, 0], ls: [-1.5, 0, -.15], le: [-.1, 0, 0] },
  sky: { t: [-.25, 0, 0], h: [-.4, 0, 0], rs: [-3.05, 0, -.1], re: [0, 0, 0], rw: [0, 0, 0], ls: [-2.6, 0, .4], le: [-.4, 0, 0] },
  ready: { t: [.1, -.25, 0], h: [0, .2, 0], rs: [-1.0, 0, .35], re: [-1.0, 0, 0], rw: [.4, 0, 0], ls: [-.9, 0, -.4], le: [-1.2, .3, 0] },
};
function applyIPose(m, cur, tgt, k) {
  for (const key in tgt) for (let i = 0; i < 3; i++) cur[key][i] = lerp(cur[key][i], tgt[key][i], k);
  m.torso.rotation.set(...cur.t); m.head.rotation.set(...cur.h);
  const [l, r] = m.arms;
  r.sh.rotation.set(cur.rs[0], cur.rs[1], cur.rs[2]); r.el.rotation.set(cur.re[0], cur.re[1], cur.re[2]); r.hand.rotation.set(cur.rw[0], cur.rw[1], cur.rw[2]);
  l.sh.rotation.set(cur.ls[0], cur.ls[1], cur.ls[2]); l.el.rotation.set(cur.le[0], cur.le[1], cur.le[2]);
}
function clonePose(p) { const o = {}; for (const k in p) o[k] = p[k].slice(); return o; }

/* ===== 狰 (red leopard, five tails, one horn) ===== */
const spotTex = canvasTex(512, 256, (c, w, h) => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = srnd(0, w), y = srnd(0, h), r = srnd(7, 15); for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { c.save(); c.translate(x + dx, y + dy); c.rotate(srnd(0, 3)); c.fillStyle = 'rgba(40,10,8,.85)'; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + srnd(-.3, .3); c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * .45, r * .3, a, 0, 7); c.fill(); } c.fillStyle = 'rgba(150,40,20,.5)'; c.beginPath(); c.arc(0, 0, r * .55, 0, 7); c.fill(); c.restore(); } }
}, [2, 1]);
function bellyColors(geo, back, belly, sideUp = -.15) {
  const n = geo.attributes.normal, c = [], A = new THREE.Color(back), B = new THREE.Color(belly), t = new THREE.Color();
  for (let i = 0; i < n.count; i++) { t.copy(A).lerp(B, smooth(sideUp, sideUp - .5, n.getY(i))); c.push(t.r, t.g, t.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return geo;
}
function buildZheng() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = phys(0xffffff, { vertexColors: true, map: spotTex, roughness: .78, sheen: 1, sheenColor: new THREE.Color(0xff9060), sheenRoughness: .55 });
  const furPlain = phys(0xffffff, { vertexColors: true, roughness: .8, sheen: 1, sheenColor: new THREE.Color(0xff9060), sheenRoughness: .55 });
  const mane = phys(0x5a0f0c, { roughness: .8, sheen: 1, sheenColor: new THREE.Color(0xff5030) });
  const dark = std(0x1a0c0a, { roughness: .5 }), claw = std(0xf2ead8, { roughness: .35 }), horn = phys(0xf0dca0, { roughness: .3, clearcoat: .8, emissive: 0x6a4a10, emissiveIntensity: .25 });
  const gum = std(0x6a1a1e, { roughness: .4 }), eyeM = std(0xffc020, { emissive: 0xffa000, emissiveIntensity: 2.6 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const RED = 0xc8402a, CREAM = 0xf2d6b0;
  // torso along spine
  const torsoG = bellyColors(taperTube([V3(0, 1.22, -1.05), V3(0, 1.3, -.55), V3(0, 1.28, -.05), V3(0, 1.36, .42), V3(0, 1.5, .78)], [.36, .42, .4, .5, .4], { radial: 22, seg: 40 }), RED, CREAM);
  const torso = mk(torsoG, fur, body); torso.scale.x = .82;
  // chest muscle & shoulder blades
  for (const s of [-1, 1]) { mk(bellyColors(superEllipsoid(.2, .3, .3, .9), RED, CREAM), furPlain, body, s * .26, 1.3, .48); mk(bellyColors(superEllipsoid(.2, .3, .34, .9), RED, CREAM), furPlain, body, s * .27, 1.25, -.85); }
  // neck
  const neck = new THREE.Group(); neck.position.set(0, 1.55, .78); body.add(neck);
  mk(bellyColors(taperTube([V3(0, -.05, -.1), V3(0, .1, .15), V3(0, .2, .4)], [.36, .3, .25], { radial: 18 }), RED, CREAM), fur, neck).scale.x = .85;
  // mane tufts
  for (let i = 0; i < 16; i++) { const a = (i / 15 - .5) * 3.4; const t = mk(G.cone, mane, neck, Math.sin(a) * .3, .14 + Math.cos(a) * .22, .05 + srnd(-.08, .08), .09, .42, .09); t.rotation.set(-1.9 + srnd(-.2, .2), 0, -Math.sin(a) * .9); }
  // spine ridge
  for (let i = 0; i < 9; i++) { const z = .55 - i * .18; const sp = mk(G.cone, mane, body, 0, 1.68 - Math.abs(z - .1) * .12 + (i < 2 ? .05 : 0), z, .05, .2, .07); sp.rotation.x = -.7; }
  // head
  const head = new THREE.Group(); head.position.set(0, .26, .45); neck.add(head);
  mk(bellyColors(superEllipsoid(.25, .22, .26, .8), RED, CREAM), fur, head);
  mk(bellyColors(taperTube([V3(0, -.03, .12), V3(0, -.06, .32), V3(0, -.08, .48)], [.17, .14, .11], { radial: 16 }), RED, CREAM), furPlain, head);
  mk(superEllipsoid(.06, .04, .04, .7), dark, head, 0, -.04, .56);
  for (const s of [-1, 1]) {
    mk(superEllipsoid(.1, .08, .12), furPlain, head, s * .1, -.1, .32).material = furPlain;
    const eye = mk(superEllipsoid(.045, .03, .025, .9), eyeM, head, s * .14, .06, .2); eye.rotation.y = s * .5;
    const pu = mk(G.box, dark, head, s * .152, .06, .216, .008, .045, .006); pu.rotation.y = s * .5;
    const brow = mk(superEllipsoid(.07, .025, .05), mane, head, s * .13, .11, .19); brow.rotation.z = s * -.35;
    const ear = mk(G.cone, furPlain, head, s * .17, .2, -.1, .08, .2, .035); ear.rotation.set(-.3, 0, s * -.5);
    const earIn = mk(G.cone, gum, head, s * .168, .195, -.088, .05, .13, .01); earIn.rotation.set(-.3, 0, s * -.5);
    const fang = mk(G.cone, claw, head, s * .07, -.18, .42, .018, .1, .018); fang.rotation.x = Math.PI;
    for (let k = 0; k < 3; k++) { const wh = mk(taperTube([V3(s * .12, -.08, .42), V3(s * (.3 + k * .03), -.1 + k * .03, .4), V3(s * (.45 + k * .03), -.16 + k * .05, .32)], [.004, .001], { radial: 4 }), claw, head); }
    const tuft = mk(G.cone, mane, head, s * .22, -.06, -.05, .07, .3, .05); tuft.rotation.set(-1.4, 0, s * -1.0);
  }
  // horn (single)
  const hornG = taperTube([V3(0, .16, .1), V3(0, .36, .18), V3(0, .55, .13), V3(0, .7, -.02)], [.075, .05, .03, .006], { radial: 14 });
  mk(hornG, horn, head);
  for (let k = 0; k < 4; k++) { const p = [V3(0, .2, .13), V3(0, .3, .17), V3(0, .4, .17), V3(0, .5, .14)][k]; const r = mk(G.tor, horn, head, p.x, p.y, p.z, .065 - k * .009, .065 - k * .009, .05); r.rotation.x = Math.PI / 2 + .3; }
  // jaw
  const jaw = new THREE.Group(); jaw.position.set(0, -.12, .12); head.add(jaw);
  mk(bellyColors(taperTube([V3(0, 0, 0), V3(0, -.05, .18), V3(0, -.07, .32)], [.12, .1, .07], { radial: 14 }), RED, CREAM), furPlain, jaw);
  mk(superEllipsoid(.08, .015, .13), gum, jaw, 0, .01, .17);
  for (const s of [-1, 1]) { const f = mk(G.cone, claw, jaw, s * .055, .04, .3, .014, .07, .014); }
  // legs
  const legs = [];
  const legDef = [[-1, .5, true], [1, .5, true], [-1, -.85, false], [1, -.85, false]];
  for (const [s, z, front] of legDef) {
    const hip = new THREE.Group(); hip.position.set(s * .28, 1.25, z); body.add(hip);
    const L1 = front ? .58 : .55, L2 = front ? .5 : .42;
    mk(bellyColors(taperTube([V3(0, .1, 0), V3(0, -L1 * .5, front ? .02 : .05), V3(0, -L1, 0)], [front ? .17 : .2, front ? .13 : .15, .085], { radial: 14 }), RED, CREAM), fur, hip);
    const knee = new THREE.Group(); knee.position.y = -L1; hip.add(knee);
    mk(bellyColors(taperTube([V3(0, 0, 0), V3(0, -L2 * .5, 0), V3(0, -L2, 0)], [.085, .07, .065], { radial: 12 }), RED, CREAM), furPlain, knee);
    const ankle = new THREE.Group(); ankle.position.y = -L2; knee.add(ankle);
    const footL = front ? .17 : .26;
    mk(bellyColors(taperTube([V3(0, 0, 0), V3(0, -footL, .03)], [.065, .06], { radial: 12 }), RED, CREAM), furPlain, ankle);
    const paw = new THREE.Group(); paw.position.set(0, -footL, .03); ankle.add(paw);
    mk(bellyColors(superEllipsoid(.085, .05, .11, .8), RED, CREAM), furPlain, paw, 0, -.01, .05);
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * .04; mk(superEllipsoid(.024, .026, .03), furPlain, paw, x, -.02, .14); const c = mk(G.cone, claw, paw, x, -.035, .175, .01, .05, .01); c.rotation.x = Math.PI / 2 + .5; }
    legs.push({ hip, knee, ankle, paw, front, s, base: front ? [.0, .15, -.15] : [.25, -.55, .3] });
  }
  // five tails
  const tails = []; const tb = new THREE.Group(); tb.position.set(0, 1.32, -1.3); body.add(tb);
  for (let i = 0; i < 5; i++) {
    const pv = new THREE.Group(); pv.rotation.order = 'YXZ'; pv.rotation.y = (i - 2) * .32; pv.rotation.x = -.5 - Math.abs(i - 2) * .08; tb.add(pv);
    let par = pv; const segs = [];
    for (let k = 0; k < 5; k++) { const sg = new THREE.Group(); par.add(sg); if (k) sg.position.z = -.26; const r = .075 - k * .009; mk(taperTube([V3(0, 0, 0), V3(0, 0, -.28)], [r, r * .9], { radial: 10 }), k > 2 ? mane : furPlain, sg).material = k > 2 ? mane : furPlain; segs.push(sg); par = sg; }
    const fl = mk(G.cone, flameM, par, 0, 0, -.42, .08, .32, .08); fl.rotation.x = -Math.PI / 2;
    const tip = mk(G.cone, mane, par, 0, 0, -.33, .07, .2, .07); tip.rotation.x = -Math.PI / 2;
    tails.push({ segs, fl, i });
  }
  // furPlain needs vertex colors everywhere; give the tail tube colours
  root.traverse(o => { if (o.isMesh && (o.material === furPlain || o.material === fur) && !o.geometry.attributes.color) bellyColors(o.geometry, RED, CREAM); });
  const glow = mk(G.sph, auraMat(0xff5a20, 2.5, .6), body, 0, 1.3, -.1, .62, .62, 1.45);
  return { root, body, neck, head, jaw, legs, tails, glow, mats: collectMats(root) };
}
/* ---------------- player ---------------- */
/* ===== v3 tuning (all numbers in one place) ===== */
const TUNE = {
  hp0: 1000, hpLv: 50, atk0: 50, atkLv: 5, wineFrac: .15, shieldFrac: .2, stealthDur: 3, ambushWin: 2,
  // damage multipliers of player.atk
  mult: { atk: 1, s1: 2.6, s2: 2.2, dahe: 12, daheSplash: 4, wanjian: .03, jianyu: .09, ride: .8, parry: 2.5, ambush: 2 },
  // toughness (韧性) damage per hit
  tough: { max: 200, atk: 8, s1: 60, s2: 18, dahe: 50, daheSplash: 20, wanjian: .8, jianyu: 1.5, ride: 12, parry: 45,
    breakT: 2.5, minMult: .2, maxMult: .85, parryStagger: .9 }, // v3b: no regen/refill; one bar per boss phase
};
const ALL_ST = ['dahe', 'wanjian', 'jianyu', 'yinshen', 'hudun'];
const player = { x: 0, z: 7, yaw: 0, pitch: -.04, lv: 90, xp: 0, hp: 1980, maxHp: 1980, atk: 279, name: '李白', dead: false, riding: false, rideT: 0, lastHurt: -99, moveAmt: 0, bob: 0,
  wine: 2, wineMax: 2, shield: 0, shieldMax: 200, blockT: 0, stealthT: 0, ambushT: 0, unlocked: ALL_ST.slice(), minHpFrac: 0, dashT: 0, dashV: V3(), slow: 1 };
const hasSt = id => player.unlocked.includes(id);
let rideTilt = 0, camY = 1.7, gameT = 0, state = 'title', mode = 'tutorial', shake = 0, yawVel = 0, hudDirty = true, camRoll = 0, camDrop = 0, fovKick = 0, timeScale = 1;
const needXp = l => Math.round(30 * Math.pow(l, 1.5) + 40);
function recalc() { const L = player.lv - 1; player.maxHp = TUNE.hp0 + TUNE.hpLv * L; player.atk = Math.round(TUNE.atk0 + TUNE.atkLv * L); player.shieldMax = Math.round(player.maxHp * TUNE.shieldFrac); }
const fwd = () => V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
const rightV = () => V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
const ppos = () => V3(player.x, camY - .6, player.z);

/* ---------------- enemies (generic) ---------------- */
const enemies = [];
const eproj = [];
function setFlash(e, k) { for (const mt of e.mats) { if (!mt.emissive || mt.userData.keepE) continue; if (!mt.userData.e0) { mt.userData.e0 = mt.emissive.clone(); mt.userData.ei = mt.emissiveIntensity; } if (k <= 0) { mt.emissive.copy(mt.userData.e0); mt.emissiveIntensity = mt.userData.ei; } else { mt.emissive.setRGB(k, k * .9, k * .85); mt.emissiveIntensity = 1; } } }
function eCenter(e) { return V3(e.x, e.y + e.height * .55, e.z); }
function aimPos() { return (player.stealthT > 0 && decoy.active) ? decoy.pos.clone() : V3(player.x, H(player.x, player.z), player.z); }
function playerNear(x, z, r) { return Math.hypot(player.x - x, player.z - z) < r; }
/* ===== 韧性 toughness ===== */
function initTough(e, max = TUNE.tough.max, phases = 1) { e.tough = true; e.Tmax = max; e.T = max; e.phase = 1; e.phases = phases; e.broken = false; e.brkT = 0; e.lastHitT = -99; e.breaks = 0; }
const PHASE_CN = ['', '第一阶段', '第二阶段', '第三阶段'];
// boss enters next phase: toughness restored to full exactly once
function toughNextPhase(e) {
  if (!e.tough || e.phase >= e.phases) return;
  e.phase++; e.T = e.Tmax; e.broken = false; e.brkT = 0;
  shockRing(V3(e.x, H(e.x, e.z), e.z), 0xffe080, .6, 4.5, .7); burst(eCenter(e), 40, 0xffe9a0, 6, .5, .7, -3);
  toast(`${e.name}进入${PHASE_CN[e.phase]} · 韧性已恢复`);
}
function toughMult(e) { if (!e.tough) return 1; if (e.broken) return 1; const f = clamp(e.T / e.Tmax, 0, 1); return TUNE.tough.minMult + (TUNE.tough.maxMult - TUNE.tough.minMult) * (1 - f); }
function cancelAct(e) { if (e.onInterrupt) e.onInterrupt(); else e.act = null; e.warnT = 0; }
function breakBoss(e) {
  e.broken = true; e.T = 0; e.brkT = TUNE.tough.breakT; e.breaks++;
  cancelAct(e); e.stagger = Math.max(e.stagger || 0, TUNE.tough.breakT);
  const el = $('breakfx'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sfx('boom'); sfx('clang'); shake = Math.max(shake, .45); flashScreen('#ffd8a0', .4, .5);
  shockRing(V3(e.x, H(e.x, e.z), e.z), 0xffb030, .6, 5, .7); burst(eCenter(e), 60, 0xffc040, 9, .6, .8, -6);
  showNum(V3(e.x, e.y + e.height + .6, e.z), '破防', 'brk');
}
function updateTough(e, dt) {
  if (!e.tough || e.dead) return;
  if (e.broken && e.brkT > 0) { e.brkT -= dt; if (Math.random() < .5) emit(e.x + rand(-1, 1), e.y + e.height + rand(0, .6), e.z + rand(-1, 1), 0, 1.2, 0, 0xffd060, .35, .6, 0); }
}
/* ===== displacement (knock-up / knock-back) — never applied to bosses ===== */
function knockBack(e, fx, fz, dist, dur = .3) { if (e.boss || e.dead) return; const dx = e.x - fx, dz = e.z - fz, d = Math.hypot(dx, dz) || 1; e.kbV = V3(dx / d * dist / dur, 0, dz / d * dist / dur); e.kbT = dur; e.stagger = Math.max(e.stagger || 0, dur + .25); }
function knockUp(e, h, dur) { if (e.boss || e.dead) return; e.airH = h; e.airDur = dur; e.airT = dur; e.stagger = Math.max(e.stagger || 0, dur + .3); if (e.act) cancelAct(e); }
function preDisplace(e, dt) { if (e.kbT > 0) { e.kbT -= dt; e.x += e.kbV.x * dt; e.z += e.kbV.z * dt; const R = world.R - 1, r = Math.hypot(e.x, e.z); if (r > R) { e.x *= R / r; e.z *= R / r; } if (Math.random() < .6) emit(e.x + rand(-.4, .4), H(e.x, e.z) + .1, e.z + rand(-.4, .4), 0, 1, 0, 0xc8b898, .5, .5, -2); } }
function postDisplace(e, dt) { if (e.airT > 0) { e.airT = Math.max(0, e.airT - dt); const k = 1 - e.airT / e.airDur; e.airY = Math.sin(k * Math.PI) * e.airH; if (e.airT <= 0) { e.airY = 0; burst(V3(e.x, H(e.x, e.z) + .2, e.z), 18, 0xc8b898, 4, .6, .6, -4); sfx('stone'); } } if (e.airY) { e.holder.position.y += e.airY; e.holder.rotation.x = Math.sin((1 - e.airT / e.airDur) * Math.PI) * -.5; } else if (e.holder.rotation.x) e.holder.rotation.x = 0; }
function hitEnemy(e, base, kind, td = 0) {
  if (e.dead || e.invuln) return 0;
  let amb = false;
  if (player.ambushT > 0 && kind !== 'tick') { amb = true; player.ambushT = 0; base *= TUNE.mult.ambush; td *= TUNE.mult.ambush; }
  const tm = toughMult(e);
  const crit = Math.random() < .15; let d = Math.round(base * (crit ? 1.8 : 1) * rand(.92, 1.08) * (e.armor || 1) * tm);
  d = Math.max(1, d);
  const before = e.hp; e.hp = Math.max(e.floorHp || 0, e.hp - d);
  e.flash = 1; e.onHit && e.onHit(kind, d);
  if (e.tough) { e.lastHitT = gameT; if (!e.broken && td > 0) { e.T = Math.max(0, e.T - td); if (e.T <= 0 && e.hp > 0) breakBoss(e); } }
  const np = V3(e.x, e.y + e.height * .85 + (e.airY || 0), e.z);
  if (amb) { showNum(np, '破隐一击 ' + d, 'amb'); sfx('clang'); flashScreen('#cff4ff', .3, .3); }
  else showNum(np, d, kind === 'ult' ? 'big' : (e.broken && kind !== 'tick') ? 'brkn' : crit ? 'crit' : (tm < .4 && kind !== 'tick') ? 'res' : kind === 'tick' ? 'tk' : 'n');
  burst(eCenter(e), kind === 'ult' ? 40 : 12, crit ? 0xffd040 : 0xbfe8ff, kind === 'ult' ? 12 : 6, .45, .4, -6);
  if (kind !== 'tick') sfx('hit');
  if (e.hp <= 0 && !e.dead) killEnemy(e);
  return before - e.hp;
}
function killEnemy(e) {
  e.dead = true; e.deadT = 0; e.hp = 0; setFlash(e, 0);
  burst(eCenter(e), 40, 0xffe9a0, 6, .7, 1.2, 2);
  player.wine = Math.min(player.wineMax, player.wine + 1); hudDirty = true;
  if (!e.boss) e.remT = 2.5;
  e.onDeath && e.onDeath();
}
/* telegraph decals */
function teleCircle(x, z, r, dur, hex, onEnd) {
  const g = new THREE.Group(); const y = Math.max(H(x, z), -.25) + .06; g.position.set(x, y, z);
  const ring = mk(ringGeo, addMat(hex, .9), g); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(r);
  const fill = mk(discGeo, addMat(hex, .35), g); fill.rotation.x = -Math.PI / 2;
  const base = mk(discGeo, addMat(hex, .12), g); base.rotation.x = -Math.PI / 2; base.scale.setScalar(r);
  const e = addFx(g, dur, k => { fill.scale.setScalar(Math.max(.01, r * k)); ring.material.opacity = .5 + .45 * Math.abs(Math.sin(k * 14)); });
  e.end = () => onEnd && onEnd(); return e;
}
function teleLine(x, z, yaw, len, w, dur, hex, onEnd) {
  const g = new THREE.Group(); g.position.set(x, Math.max(H(x, z), -.25) + .07, z); g.rotation.y = yaw;
  const base = mk(new THREE.PlaneGeometry(w, len), addMat(hex, .16), g); base.rotation.x = -Math.PI / 2; base.position.z = len / 2;
  const fill = mk(new THREE.PlaneGeometry(w, 1), addMat(hex, .45), g); fill.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) { const ed = mk(new THREE.PlaneGeometry(.08, len), addMat(hex, .9), g); ed.rotation.x = -Math.PI / 2; ed.position.set(s * w / 2, .01, len / 2); }
  const e = addFx(g, dur, k => { fill.scale.y = Math.max(.01, len * k); fill.position.z = len * k / 2; });
  e.end = () => onEnd && onEnd(); return e;
}
/* generic enemy projectile */
function spawnProj(o) { // {mesh, pos, vel, r, dmg, life, col, onHit, spin}
  o.t = 0; o.mesh.position.copy(o.pos); scene.add(o.mesh); eproj.push(o); return o;
}
function updateProj(dt) {
  const pp = ppos();
  for (let i = eproj.length - 1; i >= 0; i--) {
    const p = eproj[i]; p.t += dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos);
    p.upd && p.upd(p, dt);
    if (Math.random() < .8) emit(p.pos.x + rand(-.2, .2), p.pos.y + rand(-.2, .2), p.pos.z + rand(-.2, .2), rand(-.4, .4), rand(0, .8), rand(-.4, .4), p.col, .5, .35, 0);
    const hitP = !player.dead && Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z) < p.r && Math.abs(p.pos.y - pp.y) < 1.4;
    const hitD = player.stealthT > 0 && decoy.active && Math.hypot(p.pos.x - decoy.pos.x, p.pos.z - decoy.pos.z) < p.r;
    const gy = H(p.pos.x, p.pos.z);
    if (hitP || hitD || p.t > p.life || p.pos.y < gy - .2 || Math.hypot(p.pos.x, p.pos.z) > 60) {
      if (hitP) hurtPlayer(p.dmg, p.pos); if (hitD) decoyHit();
      burst(p.pos, 16, p.col, 5, .5, .45, -4); scene.remove(p.mesh); eproj.splice(i, 1);
    }
  }
}
function clearProj() { for (const p of eproj) scene.remove(p.mesh); eproj.length = 0; }

/* ---------------- player damage ---------------- */
function hurtPlayer(d, src) {
  if (player.dead || (state !== 'play' && state !== 'cut')) return 'none';
  if (player.blockT > 0 && state === 'play') { player.blockT = 0; blockSuccess(src); return 'block'; }
  if (src && src.attacker && src.attacker.stagger > 0 && src.melee) return 'none';
  d = Math.max(1, Math.round(d * rand(.92, 1.08)));
  if (player.shield > 0) {
    const a = Math.min(player.shield, d); player.shield -= a; d -= a; hudDirty = true;
    screenNum('护盾 -' + a, 'shieldn', innerWidth * .5 + rand(-50, 30), innerHeight * .44);
    shieldHitFx();
    if (player.shield <= 0) shieldBreak();
    if (d <= 0) return 'shield';
  }
  player.hp -= d; player.lastHurt = gameT; shake = Math.max(shake, .25); hudDirty = true; sfx('hurt');
  if (player.minHpFrac > 0) player.hp = Math.max(player.hp, Math.round(player.maxHp * player.minHpFrac));
  screenNum('-' + d, 'hurt', innerWidth * .5 + rand(-40, 40), innerHeight * .42);
  $('vign').style.opacity = .9; setTimeout(() => $('vign').style.opacity = player.hp / player.maxHp < .3 ? .45 : 0, 160);
  if (player.hp <= 0) { player.hp = 0; if (state === 'play') playerDie(); }
  return 'hit';
}
function knockPlayer(fromX, fromZ, dist) { const dx = player.x - fromX, dz = player.z - fromZ, d = Math.hypot(dx, dz) || 1; player.dashV.set(dx / d * dist * 6, 0, dz / d * dist * 6); player.dashT = .18; }
let blockFxT = 0;
let parryCount = 0;
function blockSuccess(src) {
  sfx('clang'); shake = Math.max(shake, .2); swordGlow = 1.2;
  const a = src && src.attacker; const counter = !!(a && !a.dead && src.melee !== false && Math.hypot(a.x - player.x, a.z - player.z) < 6.5);
  const el = $('blockfx'); el.textContent = counter ? '弹反' : '格挡成功'; el.classList.toggle('parry', counter); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  if (counter) {
    parryCount++;
    if (!a.broken) { cancelAct(a); a.stagger = Math.max(a.stagger || 0, TUNE.tough.parryStagger); }
    hitEnemy(a, player.atk * TUNE.mult.parry, 'parry', TUNE.tough.parry);
    const c = eCenter(a); burst(c, 30, 0xfff0a0, 8, .5, .5, -4); shockRing(V3(a.x, H(a.x, a.z), a.z), 0xbfe8ff, .4, 3, .45);
    setTimeout(() => sfx('hit'), 60);
    if (!a.boss) knockBack(a, player.x, player.z, 2.5);
  }
  flashScreen('#e8f6ff', .35, .35);
  const p = ppos().addScaledVector(fwd(), 1.0); p.y = camY - .25;
  burst(p, 34, 0xfff2c0, 7, .35, .4, -5); burst(p, 14, 0x9fe8ff, 4, .5, .5, 0);
  playVM('blockhit', .3, [BLOCK_R, { ...BLOCK_R, p: BLOCK_R.p.clone().add(V3(.02, .03, .04)), k: .3 }, { ...BLOCK_R, k: 1 }], [BLOCK_L, { ...BLOCK_L, k: 1 }]);
  tutEvent('block');
}

/* ---------------- decoy (隐身 afterimage) ---------------- */
const ghostMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color(0x7fd8ff) }, op: { value: 1 }, t: timeU },
  vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w=modelMatrix*vec4(position,1.); vY=w.y; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: 'uniform vec3 col; uniform float op,t; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f=pow(1.-abs(dot(vN,vV)),1.6); float scan=.75+.25*sin(vY*40.-t*6.); float a=(.18+f*.9)*scan*op; gl_FragColor=vec4(col*a,a); }' });
const decoyModel = buildImmortal({ robe: 0xf2f4f8, inner: 0xdfe8f2, trim: 0x6fb0e0, skin: 0xf0d2bc, eye: 0x2a2a2a, eyeI: 0, ribbon: 0x9fd8ff });
decoyModel.root.traverse(o => { if (o.isMesh) o.material = ghostMat; });
const decoyPose = clonePose(IPOSE.ready); applyIPose(decoyModel, decoyPose, IPOSE.ready, 1);
const decoy = { active: false, pos: V3(), t: 0, holder: new THREE.Group(), fade: 0 };
decoy.holder.add(decoyModel.root); decoy.holder.visible = false; scene.add(decoy.holder);
function decoyHit() { decoy.flick = .3; burst(decoy.pos.clone().setY(decoy.pos.y + 1.2), 10, 0x9fe8ff, 4, .4, .4, -2); }
function updateDecoy(dt) {
  if (decoy.active) { decoy.fade = Math.min(1, decoy.fade + dt * 4); if (player.stealthT <= 0) decoy.active = false; }
  else decoy.fade = Math.max(0, decoy.fade - dt * 3);
  decoy.holder.visible = decoy.fade > .01;
  if (decoy.flick > 0) decoy.flick -= dt;
  ghostMat.uniforms.op.value = decoy.fade * (decoy.flick > 0 ? (Math.random() < .5 ? .3 : 1) : 1);
  decoy.holder.position.copy(decoy.pos).y += Math.sin(gameT * 2) * .03;
  if (decoy.holder.visible && Math.random() < .3) emit(decoy.pos.x + rand(-.4, .4), decoy.pos.y + rand(0, 1.8), decoy.pos.z + rand(-.4, .4), 0, .6, 0, 0x8fe0ff, .25, .8, 0);
}
/* ---------------- shared bits ---------------- */
const purpleSwordM = new THREE.MeshStandardMaterial({ color: 0x4a2a6a, emissive: 0xb050ff, emissiveIntensity: 1.6, metalness: .8, roughness: .25 });
const purpleGoldM = new THREE.MeshStandardMaterial({ color: 0x9a7ad0, metalness: .9, roughness: .3, emissive: 0x401060, emissiveIntensity: .5 });
function cheapSword(bm, gm, s) { const g = new THREE.Group(); const b = new THREE.Mesh(BLADE_G, bm); b.position.y = GUARD_Y; g.add(b); mk(G.box, gm, g, 0, GUARD_Y, 0, .035, .016, .03); mk(G.cyl, gm, g, 0, -.02, 0, .013, .18, .013); g.scale.setScalar(s); return g; }
const WAVE_GEO = crescentGeo(.9, 2.1, .25, Math.PI - .25);
function smoke(p, hex = 0x8a3aff) { burst(p, 40, hex, 5, .9, .7, 1, .3); burst(p, 20, 0x201028, 3, 1.2, .9, .5); }
function faceTo(e, x, z, k) { e.yaw += angDiff(e.yaw, Math.atan2(x - e.x, z - e.z)) * Math.min(1, k); }
function inFront(e, px, pz, range, half) { const dx = px - e.x, dz = pz - e.z, d = Math.hypot(dx, dz); if (d > range) return false; if (d < 1.2) return true; return Math.abs(angDiff(e.yaw, Math.atan2(dx, dz))) < half; }

/* ===== 剑魔 · 师兄 ===== */
function makeShixiong() {
  const m = buildImmortal({ robe: 0x3a1a5c, inner: 0xd2c4ea, trim: 0xd0aa5a, skin: 0xe8d6da, eye: 0xd060ff, eyeI: 3.5, angry: true, mark: true, sash: 0x1e0c2e, jade: 0xb070ff, ribbon: 0xa048ff, sheen: 0xc890ff, hairSheen: 0x8040c0,
    sword: { blade: 0x3a2650, glow: 0xb050ff, glowI: 1.4, gold: 0x9a7ad0, grip: 0x1a0c22, jade: 0xc070ff, jadeE: 0x6020a0 } });
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder);
  m.root.scale.setScalar(1.08);
  const aura1 = mk(G.sph, auraMat(0xa040ff, 2.0, .9), m.body, 0, 1.05, 0, .55, 1.15, .5);
  const aura2 = mk(G.sph, auraMat(0x6010c0, 1.4, .5), m.body, 0, 1.1, 0, .75, 1.35, .7);
  const mist = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0x2a0a40, transparent: true, opacity: .45, depthWrite: false }), holder, 0, .02, 0, 1.2, 1.2, 1.2); mist.rotation.x = -Math.PI / 2;
  const e = { kind: 'shixiong', boss: true, name: '剑魔 · 师兄', lvTxt: '???', x: 0, z: -6.5, y: .3, yaw: 0, radius: .7, height: 2.2, hp: 100000, maxHp: 100000, floorHp: 0, armor: 1,
    model: m, holder, mats: m.mats, pose: clonePose(IPOSE.idle), tgt: IPOSE.idle, poseK: 8, act: null, cd: 2.5, ai: true, flash: 0, warnT: 0, home: V3(0, 0, -6.5), strafe: 0, last: '', dead: false, dmgK: 1, forced: null, visible: true,
    onInterrupt() { this.act = null; this.visible = true; if (timeScale < 1) timeScale = 1; tutBlockCue(false); setPose(this, 'idle', 6); this.cd = Math.max(this.cd, this.forced ? 1.6 : 2.2); this.model.sword.bladeM.emissiveIntensity = 1.4; } };
  initTough(e);
  e.update = dt => updateShixiong(e, dt);
  for (const mt of [purpleSwordM]) mt.userData.keepE = true;
  m.sword.bladeM.userData.keepE = true;
  return e;
}
function setPose(e, name, k = 8) { e.tgt = IPOSE[name]; e.poseK = k; }
function updateShixiong(e, dt) {
  const tgt = aimPos();
  if (e.stagger > 0) e.stagger -= dt;
  e.model.root.rotation.x = lerp(e.model.root.rotation.x, e.stagger > 0 ? .28 : 0, Math.min(1, dt * 8));
  if (!e.act && e.stagger > 0) { setPose(e, 'idle', 5); }
  else if (!e.act) {
    faceTo(e, tgt.x, tgt.z, dt * 5);
    e.strafe += dt * .5; const hx = e.home.x + Math.sin(e.strafe) * 2.2, hz = e.home.z + Math.cos(e.strafe * .7) * .8;
    e.x += (hx - e.x) * Math.min(1, dt * 1.2); e.z += (hz - e.z) * Math.min(1, dt * 1.2);
    setPose(e, 'idle', 5);
    if (e.ai) { e.cd -= dt; if (e.cd <= 0) { const choice = e.forced || pickShixiongAttack(e); startShixiongAct(e, choice); } }
  } else {
    const a = e.act; const prevT = a.t; a.t += dt; a.step(a.t, prevT, dt);
    if (a.t >= a.dur) { e.act = null; e.cd = (e.forced ? 1.6 : rand(2.6, 3.8)); }
  }
  // body
  e.y = .3 + Math.sin(gameT * 1.6) * .08;
  e.holder.position.set(e.x, H(e.x, e.z) + e.y, e.z); e.holder.rotation.y = e.yaw; e.holder.visible = e.visible;
  applyIPose(e.model, e.pose, e.tgt, Math.min(1, dt * e.poseK));
  e.model.body.rotation.z = Math.sin(gameT * 1.1) * .02;
  e.model.locks.forEach((l, i) => l.rotation.z = Math.sin(gameT * 2 + i) * .08);
  if (e.flash > 0) { e.flash = Math.max(0, e.flash - dt * 5); setFlash(e, e.flash * .7); }
  if (e.visible && Math.random() < .6) { const a = rand(0, 6.28), r = rand(.2, .6); emit(e.x + Math.cos(a) * r, e.holder.position.y + rand(0, 2), e.z + Math.sin(a) * r, 0, rand(.6, 1.6), 0, Math.random() < .3 ? 0x2a0a40 : 0xb060ff, rand(.2, .45), rand(.6, 1.2), 0); }
  e.warnT = Math.max(0, e.warnT - dt);
}
function pickShixiongAttack(e) { const opts = ['wave', 'blink', 'rain', 'swords'].filter(x => x !== e.last); const c = opts[Math.floor(Math.random() * opts.length)]; return c; }
function swordTip(e) { const p = V3(); e.model.sword.g.localToWorld(p.set(0, .9, 0)); return p; }
function startShixiongAct(e, name) {
  e.last = name; const D = 1;
  const A = { name, t: 0, dur: 1, step() { } };
  if (name === 'wave') {
    A.dur = 1.3; setPose(e, 'raise', 7); e.model.sword.bladeM.emissiveIntensity = 2.5;
    A.step = (t, p) => {
      if (p < .55 && t >= .55) {
        setPose(e, 'slash', 18); sfx('whoosh');
        const tg = aimPos(); const from = V3(e.x, e.holder.position.y + 1.2, e.z); const dir = V3(tg.x - from.x, 0, tg.z - from.z).normalize();
        const mesh = new THREE.Mesh(WAVE_GEO, slashMat(0xb050ff)); mesh.material.uniforms.prog.value = 1.3; mesh.rotation.order = 'YXZ'; mesh.rotation.y = Math.atan2(dir.x, dir.z); mesh.rotation.z = .5;
        spawnProj({ mesh, pos: from, vel: dir.multiplyScalar(14), r: 1.4, dmg: 120 * e.dmgK, life: 2.5, col: 0xb050ff, attacker: e });
      }
      if (t > 1.0) setPose(e, 'idle', 5);
    };
  } else if (name === 'blink') {
    A.dur = 2.0; const slow = mode === 'tutorial' && tut.cur && tut.cur.id === 'block';
    A.step = (t, p) => {
      if (p < .01 && t >= .0001) { smoke(V3(e.x, e.holder.position.y + 1, e.z)); e.visible = false; sfx('whoosh'); }
      if (p < .3 && t >= .3) {
        const tg = aimPos(); const dx = e.x - tg.x, dz = e.z - tg.z, d = Math.hypot(dx, dz) || 1; e.x = tg.x + dx / d * 2.4; e.z = tg.z + dz / d * 2.4; faceTo(e, tg.x, tg.z, 1);
        e.visible = true; smoke(V3(e.x, H(e.x, e.z) + 1, e.z)); setPose(e, 'ready', 14); e.warnT = .7; e.model.sword.bladeM.emissiveIntensity = 4;
        A.tele = teleCircle(e.x + Math.sin(e.yaw) * 1.3, e.z + Math.cos(e.yaw) * 1.3, 2.4, .7, 0xc040ff);
        if (slow) { timeScale = .3; tutBlockCue(true); }
      }
      if (p < 1.0 && t >= 1.0) {
        setPose(e, 'slash', 20); sfx('swish'); timeScale = 1; tutBlockCue(false);
        worldSlash(e, 0xc050ff);
        if (inFront(e, player.x, player.z, 3.7, 1.2)) { const r = hurtPlayer(160 * e.dmgK, { attacker: e, x: e.x, z: e.z, melee: true }); if (r === 'hit') knockPlayer(e.x, e.z, 1.5); }
        else if (player.stealthT > 0 && decoy.active && Math.hypot(decoy.pos.x - e.x, decoy.pos.z - e.z) < 3.8) decoyHit();
      }
      if (p < 1.55 && t >= 1.55) { smoke(V3(e.x, e.holder.position.y + 1, e.z)); e.x = e.home.x; e.z = e.home.z; smoke(V3(e.x, H(e.x, e.z) + 1, e.z)); setPose(e, 'idle', 6); }
    };
  } else if (name === 'rain') {
    A.dur = 2.2; setPose(e, 'sky', 6); e.model.sword.bladeM.emissiveIntensity = 3;
    A.step = (t, p) => {
      if (p < .35 && t >= .35) {
        const tg = aimPos(); const pts = [[tg.x, tg.z]]; for (let i = 0; i < 3; i++) { const a = rand(0, 6.28), r = rand(2.5, 4.5); pts.push([tg.x + Math.cos(a) * r, tg.z + Math.sin(a) * r]); }
        pts.forEach(([x, z], i) => setTimeout(() => teleCircle(x, z, 2.0, 1.1, 0xb040ff, () => fallingSword(x, z, 2.0, 140 * e.dmgK, e)), i * 90));
      }
      if (t > 1.6) setPose(e, 'idle', 5);
    };
  } else if (name === 'swords') {
    A.dur = 2.4; setPose(e, 'cast', 6); const sws = [];
    A.step = (t, p) => {
      if (p < .2 && t >= .2) for (let i = 0; i < 5; i++) { const s = cheapSword(purpleSwordM, purpleGoldM, 1.3); scene.add(s); sws.push({ s, i, launched: false }); smoke(V3(e.x, 2, e.z), 0xb060ff); }
      for (const o of sws) {
        if (o.launched) continue;
        const a = e.yaw + (o.i - 2) * .45, back = V3(e.x - Math.sin(e.yaw) * .6 + Math.cos(e.yaw) * (o.i - 2) * .55, e.holder.position.y + 2.3 + Math.abs(o.i - 2) * -.2 + Math.sin(gameT * 4 + o.i) * .05, e.z - Math.cos(e.yaw) * .6 - Math.sin(e.yaw) * (o.i - 2) * .55);
        o.s.position.copy(back); const tg = aimPos(); tg.y = H(tg.x, tg.z) + 1.2; o.s.quaternion.setFromUnitVectors(Y_AXIS, tg.clone().sub(back).normalize());
        if (t >= .9 + o.i * .2) { o.launched = true; const dir = tg.clone().sub(back).normalize(); scene.remove(o.s); const mesh = o.s; spawnProj({ mesh, pos: back.clone(), vel: dir.multiplyScalar(22), r: 1.0, dmg: 60 * e.dmgK, life: 2, col: 0xb050ff, attacker: e }); sfx('swish'); }
      }
      if (t > 2.0) setPose(e, 'idle', 5);
    };
  }
  e.act = A;
}
function worldSlash(e, hex) {
  const holder = new THREE.Group(); holder.position.set(e.x, e.holder.position.y + 1.1, e.z); holder.rotation.y = e.yaw + Math.PI;
  const m = new THREE.Mesh(ARC_WIDE, slashMat(hex)); m.rotation.x = -Math.PI / 2 + .3; m.rotation.z = Math.PI; m.scale.setScalar(1.1); holder.add(m);
  addFx(holder, .4, k => { m.material.uniforms.prog.value = Math.min(1.25, k * 2.4); m.material.uniforms.fade.value = k < .5 ? 1 : 1 - (k - .5) * 2; });
}
function fallingSword(x, z, r, dmg, e) {
  const s = cheapSword(purpleSwordM, purpleGoldM, 3.2); s.rotation.x = Math.PI; const gy = Math.max(H(x, z), -.2);
  addFx(s, .5, k => { const kk = Math.min(1, k / .3); s.position.set(x, gy + 3.2 + (1 - kk) * 12, z); if (kk >= 1 && !s.userData.hit) { s.userData.hit = true; shockRing(V3(x, gy, z), 0xb050ff, .4, r * 1.2, .5); burst(V3(x, gy + .3, z), 26, 0xc070ff, 7, .5, .5, -6, .5); sfx('stone'); if (playerNear(x, z, r)) hurtPlayer(dmg, { attacker: e, x, z, melee: false }); else if (player.stealthT > 0 && Math.hypot(decoy.pos.x - x, decoy.pos.z - z) < r) decoyHit(); } });
}

/* ===== 狰 ===== */
const ZHENG = { hp: 16000, tough: 900, phase2: .4, claw: 60, charge: 110, pounce: 130, fire: 50 };
function makeZheng() {
  const m = buildZheng();
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder);
  const shadow = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3, depthWrite: false }), holder, 0, .05, -.2, 1.0, 1.9, 1); shadow.rotation.x = -Math.PI / 2;
  const e = { kind: 'zheng', boss: true, name: '狰', lvTxt: '20', lv: 20, x: 0, z: -12, y: 0, yaw: 0, radius: 1.25, height: 2.2, hp: ZHENG.hp, maxHp: ZHENG.hp, armor: 1, floorHp: 0,
    model: m, holder, mats: m.mats, act: null, cd: 1.5, flash: 0, warnT: 0, dead: false, deadT: 0, moveAmt: 0, ph: 0, enraged: false, strafeDir: 1, stagger: 0, ai: false,
    an: { crouch: 0, pitch: 0, head: 0, jaw: 0, leap: 0, gallop: 0, rear: 0 },
    onInterrupt() { const an = this.an; an.leap = 0; an.gallop = 0; an.pitch = 0; this.act = null; this.cd = 1.0; },
    onHit(kind) { if (!this.enraged && this.hp > 0 && this.hp < this.maxHp * ZHENG.phase2) { this.enraged = true; banner('狰 · 狂暴', '第二阶段 · 韧性恢复，攻势更猛了！', 2.2); sfx('roar'); toughNextPhase(this); } },
    onDeath() { onZhengDeath(this); } };
  m.glow.material.uniforms.k.value = .0;
  initTough(e, ZHENG.tough, 2);
  e.update = dt => updateZheng(e, dt);
  return e;
}
function zSpeed(e) { return (e.enraged ? 1.18 : 1); }
function updateZheng(e, dt) {
  const an = e.an; let moving = 0, sp = 0;
  if (e.dead) {
    e.deadT += dt; const k = Math.min(1, e.deadT / 1.2);
    e.model.root.rotation.z = easeOut(k) * 1.45; e.model.root.position.y = -k * .5; an.jaw = .6; an.head = .3;
    e.model.legs.forEach((l, i) => { l.hip.rotation.x = lerp(l.hip.rotation.x, (i < 2 ? -.6 : .6), dt * 3); });
    e.model.tails.forEach((t, i) => t.fl.visible = false);
    e.holder.position.set(e.x, H(e.x, e.z), e.z);
    zhengPose(e, dt, 0);
    return;
  }
  const tgt = aimPos(); const dx = tgt.x - e.x, dz = tgt.z - e.z, dist = Math.hypot(dx, dz);
  if (e.stagger > 0) { e.stagger -= dt; const b = e.broken ? 1 : 0; an.crouch = lerp(an.crouch, .3 + b * .35, dt * 6); an.head = lerp(an.head, .4 + b * .4, dt * 6); an.jaw = lerp(an.jaw, .3 + b * .3, dt * 6); an.rear = lerp(an.rear, 0, dt * 6); an.gallop = 0; an.leap = lerp(an.leap, 0, dt * 10); }
  else if (!e.act) {
    an.crouch = lerp(an.crouch, 0, dt * 4); an.head = lerp(an.head, 0, dt * 4); an.jaw = lerp(an.jaw, .05 + Math.max(0, Math.sin(gameT * 1.3)) * .1, dt * 4); an.rear = lerp(an.rear, 0, dt * 5);
    const want = Math.atan2(dx, dz);
    if (e.ai) {
      e.cd -= dt;
      if (e.cd <= 0) startZhengAct(e, pickZheng(e, dist));
      else if (dist > 9) { faceTo(e, tgt.x, tgt.z, dt * 4); sp = 5.6 * zSpeed(e); moving = 1; }
      else if (dist < 4.2) { faceTo(e, tgt.x, tgt.z, dt * 4); const a = want + Math.PI + e.strafeDir * .9; e.x += Math.sin(a) * 2.6 * dt; e.z += Math.cos(a) * 2.6 * dt; moving = .5; }
      else { e.yaw += angDiff(e.yaw, want + e.strafeDir * 1.35) * Math.min(1, dt * 3); sp = 3.2 * zSpeed(e); moving = .55; if (Math.random() < dt * .3) e.strafeDir *= -1; }
    } else faceTo(e, tgt.x, tgt.z, dt * 3);
    if (sp) { e.x += Math.sin(e.yaw) * sp * dt; e.z += Math.cos(e.yaw) * sp * dt; }
  } else {
    const a = e.act; const p = a.t; a.t += dt; a.step(a.t, p, dt);
    moving = a.moving || 0; if (a.t >= a.dur) { e.act = null; e.cd = rand(1.1, 2.0) * (e.enraged ? .75 : 1); }
  }
  // arena constraints
  const R = world.R - e.radius * .6, r = Math.hypot(e.x, e.z); if (r > R) { e.x *= R / r; e.z *= R / r; }
  for (const c of world.cols || []) { const ox = e.x - c.x, oz = e.z - c.z, od = Math.hypot(ox, oz), mn = c.r + e.radius * .8; if (od < mn && od > 1e-3) { e.x = c.x + ox / od * mn; e.z = c.z + oz / od * mn; } }
  e.moveAmt += (moving - e.moveAmt) * Math.min(1, dt * 6);
  e.ph += dt * (4 + 6 * e.moveAmt) * (an.gallop > .5 ? 1.5 : 1);
  e.holder.position.set(e.x, Math.max(H(e.x, e.z), -.5) + an.leap, e.z); e.holder.rotation.y = e.yaw;
  zhengPose(e, dt, e.moveAmt);
  if (e.flash > 0) { e.flash = Math.max(0, e.flash - dt * 5); setFlash(e, e.flash * .6); }
  e.warnT = Math.max(0, e.warnT - dt);
  e.model.glow.material.uniforms.k.value = lerp(e.model.glow.material.uniforms.k.value, e.enraged ? .8 : (e.warnT > 0 ? .5 : 0), dt * 4);
}
function zhengPose(e, dt, w) {
  const m = e.model, an = e.an, ph = e.ph, g = an.gallop;
  m.body.position.y = -an.crouch * .45 + Math.abs(Math.sin(ph)) * .06 * w + Math.sin(gameT * 2.2) * .015;
  m.body.rotation.x = -an.rear * .5 + an.crouch * .12 + an.pitch;
  m.neck.rotation.x = an.head * .5 - an.rear * .2;
  m.head.rotation.x = an.head * .4 - an.jaw * .3 + Math.sin(gameT * 1.4) * .03;
  m.head.rotation.y = Math.sin(gameT * .7) * .15 * (1 - w);
  m.jaw.rotation.x = an.jaw * .9;
  m.legs.forEach((l, i) => {
    const off = g > .5 ? [0, .35, Math.PI, Math.PI + .35][i] : [0, Math.PI, Math.PI * 1.5, Math.PI * .5][i];
    const s = Math.sin(ph + off), c = Math.cos(ph + off), amp = (g > .5 ? .9 : .55) * w;
    const crouchK = an.crouch * (l.front ? .5 : .9);
    l.hip.rotation.x = l.base[0] + s * amp - crouchK * (l.front ? -.6 : .4) - (l.front ? an.rear * 1.2 : -an.rear * .3) + (an.leap > .3 ? (l.front ? -.9 : .9) : 0);
    l.knee.rotation.x = l.base[1] + (l.front ? Math.max(0, c) * 1.0 : -Math.max(0, c) * .3) * w + crouchK * (l.front ? .9 : 1.0) + (l.front ? an.rear * 1.4 : 0);
    l.ankle.rotation.x = l.base[2] - (l.front ? Math.max(0, c) * .6 * w : 0) - crouchK * (l.front ? .4 : .7);
  });
  m.tails.forEach((t, i) => { t.segs.forEach((sg, k) => { sg.rotation.x = -.12 + Math.sin(gameT * 2.2 + i * .8 + k * .7) * .14 - w * .05; sg.rotation.y = Math.sin(gameT * 1.6 + i * 1.3 + k * .9) * .2; }); const f = (e.enraged ? 1.6 : 1) * (.8 + .3 * Math.sin(gameT * 12 + i * 2)); t.fl.scale.set(.08 * f, .32 * f, .08 * f); });
}
function pickZheng(e, d) {
  if (d < 3.9) return Math.random() < .75 ? 'claw' : 'pounce';
  const r = Math.random();
  if (d > 15) return r < .55 ? 'charge' : 'roar';
  return r < .36 ? 'charge' : r < .7 ? 'pounce' : 'roar';
}
function startZhengAct(e, name) {
  const an = e.an; const A = { name, t: 0, dur: 1, step() { } };
  const tg0 = aimPos(); const sk = e.enraged ? .85 : 1;
  if (name === 'claw') {
    A.dur = 1.35; e.warnT = .6 * sk; const fx = e.x + Math.sin(e.yaw) * 1.9, fz = e.z + Math.cos(e.yaw) * 1.9;
    teleCircle(fx, fz, 2.1, .6 * sk, 0xff4020);
    A.step = (t, p, dt) => {
      if (t < .6 * sk) { faceTo(e, aimPos().x, aimPos().z, dt * 3); an.rear = lerp(an.rear, .55, dt * 8); an.head = lerp(an.head, -.3, dt * 6); an.jaw = lerp(an.jaw, .6, dt * 6); }
      else if (t < .8 * sk) { an.rear = lerp(an.rear, -.1, dt * 18); an.head = lerp(an.head, .35, dt * 14); an.jaw = lerp(an.jaw, .2, dt * 14); }
      else { an.rear = lerp(an.rear, 0, dt * 6); an.head = lerp(an.head, 0, dt * 6); }
      if (p < .62 * sk && t >= .62 * sk) {
        sfx('swish'); const fx2 = e.x + Math.sin(e.yaw) * 1.9, fz2 = e.z + Math.cos(e.yaw) * 1.9;
        burst(V3(fx2, .6, fz2), 16, 0xff9060, 6, .4, .3, -6);
        if (playerNear(fx2, fz2, 2.2) || inFront(e, player.x, player.z, 3.4, .9)) { const r = hurtPlayer(ZHENG.claw, { attacker: e, x: e.x, z: e.z, melee: true }); if (r === 'hit') knockPlayer(e.x, e.z, 1.6); }
        else if (player.stealthT > 0 && decoy.active && Math.hypot(decoy.pos.x - fx2, decoy.pos.z - fz2) < 2.4) decoyHit();
      }
    };
  } else if (name === 'charge') {
    const dirYaw = Math.atan2(tg0.x - e.x, tg0.z - e.z); const d0 = Math.hypot(tg0.x - e.x, tg0.z - e.z);
    // length limited by arena
    let len = d0 + 5; for (let L = 2; L <= len; L += .5) { const x = e.x + Math.sin(dirYaw) * L, z = e.z + Math.cos(dirYaw) * L; if (Math.hypot(x, z) > world.R - 1) { len = L; break; } }
    const wind = .95 * sk;
    A.dur = wind + len / 18 + .8; e.warnT = wind; A.hitDone = false; A.sx = e.x; A.sz = e.z;
    teleLine(e.x, e.z, dirYaw, len, 2.6, wind, 0xff3018);
    A.step = (t, p, dt) => {
      if (t < wind) { e.yaw += angDiff(e.yaw, dirYaw) * Math.min(1, dt * 10); an.crouch = lerp(an.crouch, .5, dt * 6); an.head = lerp(an.head, .7, dt * 6); if (Math.random() < .4) emit(e.x + rand(-.5, .5), .1, e.z + rand(-.5, .5), rand(-1, 1), rand(.5, 1.5), rand(-1, 1), 0xb8a888, .6, .6, -2); }
      else if (t < wind + len / 18) {
        if (p < wind) { sfx('roar'); }
        an.crouch = lerp(an.crouch, .15, dt * 8); an.gallop = 1; A.moving = 1;
        e.x += Math.sin(dirYaw) * 18 * dt; e.z += Math.cos(dirYaw) * 18 * dt;
        if (Math.random() < .8) emit(e.x + rand(-.6, .6), .15, e.z + rand(-.6, .6), rand(-1, 1), rand(.5, 2), rand(-1, 1), 0xc8b898, .8, .7, -2);
        if (!A.hitDone && Math.hypot(player.x - e.x, player.z - e.z) < 1.9) { A.hitDone = true; const r = hurtPlayer(ZHENG.charge, { attacker: e, x: e.x, z: e.z, melee: true }); if (r === 'hit') { knockPlayer(e.x, e.z, 3.2); shake = .5; } }
        if (!A.hitDone && player.stealthT > 0 && decoy.active && Math.hypot(decoy.pos.x - e.x, decoy.pos.z - e.z) < 1.9) { A.hitDone = true; decoyHit(); }
      } else { an.gallop = 0; A.moving = 0; an.crouch = lerp(an.crouch, .35, dt * 5); an.head = lerp(an.head, .5, dt * 5); }
    };
  } else if (name === 'pounce') {
    const tx = tg0.x, tz = tg0.z, crouchT = .5 * sk, air = .6; A.dur = crouchT + air + .9; const sx = e.x, sz = e.z;
    teleCircle(tx, tz, 3.0, crouchT + air, 0xff3018); e.warnT = crouchT + air;
    A.step = (t, p, dt) => {
      if (t < crouchT) { faceTo(e, tx, tz, dt * 8); an.crouch = lerp(an.crouch, .7, dt * 8); an.head = lerp(an.head, .2, dt * 6); }
      else if (t < crouchT + air) {
        const k = (t - crouchT) / air; e.x = lerp(sx, tx, k) - Math.sin(e.yaw) * k * .5; e.z = lerp(sz, tz, k) - Math.cos(e.yaw) * k * .5; an.leap = Math.sin(k * Math.PI) * 3.4; an.crouch = lerp(an.crouch, -.1, dt * 10); an.pitch = (k - .5) * .5; an.jaw = .7;
        if (p < crouchT) sfx('whoosh');
      } else {
        if (p < crouchT + air) { an.leap = 0; an.pitch = 0; sfx('boom'); shockRing(V3(tx, H(tx, tz), tz), 0xffa060, .5, 4, .6); burst(V3(tx, H(tx, tz) + .3, tz), 40, 0xc8b090, 8, .9, .8, -6, .4); if (playerNear(tx, tz, 3.0)) { const r = hurtPlayer(ZHENG.pounce, { attacker: e, x: tx, z: tz, melee: true }); if (r === 'hit') knockPlayer(tx, tz, 2.4); } else if (Math.hypot(player.x - tx, player.z - tz) < 7) shake = Math.max(shake, .25); if (player.stealthT > 0 && decoy.active && Math.hypot(decoy.pos.x - tx, decoy.pos.z - tz) < 3) decoyHit(); }
        an.crouch = lerp(an.crouch, .4, dt * 6); an.jaw = lerp(an.jaw, .1, dt * 4);
      }
    };
  } else if (name === 'roar') {
    const wind = .85 * sk; A.dur = wind + .9; e.warnT = wind;
    A.step = (t, p, dt) => {
      const tg = aimPos();
      if (t < wind) { faceTo(e, tg.x, tg.z, dt * 6); an.head = lerp(an.head, -.6, dt * 5); an.rear = lerp(an.rear, .25, dt * 5); an.jaw = lerp(an.jaw, .9, dt * 5); const mp = mouthPos(e); emit(mp.x + rand(-.15, .15), mp.y, mp.z + rand(-.15, .15), rand(-.5, .5), rand(-.5, .5), rand(-.5, .5), 0xffb040, .5, .3, 0); }
      else { an.head = lerp(an.head, .1, dt * 6); an.rear = lerp(an.rear, 0, dt * 6); }
      if (p < wind && t >= wind) {
        sfx('roar'); sfx('stone'); shake = Math.max(shake, .15);
        const mp = mouthPos(e); const base = Math.atan2(tg.x - mp.x, tg.z - mp.z); const n = e.enraged ? 5 : 3;
        for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .26; const mesh = new THREE.Group(); mk(G.sphLo, new THREE.MeshBasicMaterial({ color: 0xffc070 }), mesh, 0, 0, 0, .32, .32, .32); const rg = mk(G.tor, addMat(0xff8030, .8), mesh, 0, 0, 0, .55, .55, .55); mesh.rotation.y = a; spawnProj({ mesh, pos: V3(mp.x, 1.2 + H(mp.x, mp.z), mp.z), vel: V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(12), r: 1.0, dmg: ZHENG.fire, life: 3, col: 0xff9a40, attacker: e, upd: (pp) => { rg.scale.setScalar(.55 + Math.sin(pp.t * 20) * .1); pp.pos.y = H(pp.pos.x, pp.pos.z) + 1.2; } }); }
      }
    };
  } else if (name === 'intro') {
    A.dur = 2.2; A.step = (t, p, dt) => { an.head = lerp(an.head, t < 1.6 ? -.7 : 0, dt * 4); an.rear = lerp(an.rear, t < 1.6 ? .35 : 0, dt * 4); an.jaw = lerp(an.jaw, t < 1.6 && t > .4 ? 1 : .1, dt * 6); if (p < .4 && t >= .4) { sfx('roar'); shake = .35; shockRing(V3(e.x, H(e.x, e.z), e.z), 0xffa060, 1, 6, .8); } };
  }
  e.act = A;
}
function mouthPos(e) { const p = V3(); e.model.jaw.localToWorld(p.set(0, 0, .3)); return p; }

/* ===== 幼狰 (small monster — used to exercise knock-back / knock-up; not part of the 狰 test stage) ===== */
function makeMinion(x, z) {
  const m = buildZheng(); m.root.scale.setScalar(.45); m.glow.material.uniforms.k.value = 0;
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder);
  const e = { kind: 'minion', boss: false, name: '幼狰', lvTxt: '5', x, z, y: 0, yaw: 0, radius: .6, height: 1.0, hp: 900, maxHp: 900, armor: 1, floorHp: 0,
    model: m, holder, mats: m.mats, act: null, cd: rand(1, 2), flash: 0, warnT: 0, dead: false, deadT: 0, moveAmt: 0, ph: rand(0, 6), enraged: false, stagger: 0, ai: true,
    an: { crouch: 0, pitch: 0, head: 0, jaw: 0, leap: 0, gallop: 0, rear: 0 }, onInterrupt() { this.act = null; } };
  e.update = dt => updateMinion(e, dt);
  return e;
}
function spawnMinion(x, z) { const e = makeMinion(x, z); enemies.push(e); return e; }
function updateMinion(e, dt) {
  const an = e.an;
  if (e.dead) {
    e.deadT += dt; const k = Math.min(1, e.deadT / 1); e.model.root.rotation.z = easeOut(k) * 1.45; e.model.root.position.y = -k * .2;
    e.holder.position.set(e.x, H(e.x, e.z), e.z); zhengPose(e, dt, 0);
    if (e.deadT > 2.5) { scene.remove(e.holder); const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); }
    return;
  }
  const tg = aimPos(), dx = tg.x - e.x, dz = tg.z - e.z, dist = Math.hypot(dx, dz); let moving = 0;
  if (e.stagger > 0) { e.stagger -= dt; an.crouch = lerp(an.crouch, .4, dt * 6); an.head = lerp(an.head, .5, dt * 6); }
  else if (!e.act) {
    an.crouch = lerp(an.crouch, 0, dt * 4); an.head = lerp(an.head, 0, dt * 4); an.jaw = lerp(an.jaw, .1, dt * 4); an.rear = lerp(an.rear, 0, dt * 5);
    faceTo(e, tg.x, tg.z, dt * 5);
    if (e.ai && dist > 1.7) { e.x += Math.sin(e.yaw) * 3.6 * dt; e.z += Math.cos(e.yaw) * 3.6 * dt; moving = 1; }
    else if (e.ai) { e.cd -= dt; if (e.cd <= 0) {
      const A = { name: 'bite', t: 0, dur: .95 }; e.warnT = .45; teleCircle(e.x + Math.sin(e.yaw) * 1, e.z + Math.cos(e.yaw) * 1, 1.2, .45, 0xff4020);
      A.step = (t, p, dt) => { if (t < .45) { an.rear = lerp(an.rear, .5, dt * 8); an.jaw = lerp(an.jaw, .7, dt * 8); } else { an.rear = lerp(an.rear, 0, dt * 10); an.jaw = lerp(an.jaw, .1, dt * 10); }
        if (p < .5 && t >= .5) { sfx('swish'); const fx = e.x + Math.sin(e.yaw) * 1, fz = e.z + Math.cos(e.yaw) * 1; if (playerNear(fx, fz, 1.4)) { const r = hurtPlayer(40, { attacker: e, x: e.x, z: e.z, melee: true }); if (r === 'hit') knockPlayer(e.x, e.z, .8); } } };
      e.act = A; } }
  } else { const a = e.act; const p = a.t; a.t += dt; a.step(a.t, p, dt); if (a.t >= a.dur) { e.act = null; e.cd = rand(1.2, 2.2); } }
  for (const o of enemies) { if (o === e || o.dead) continue; const ox = e.x - o.x, oz = e.z - o.z, od = Math.hypot(ox, oz), mn = o.radius + e.radius; if (od < mn && od > 1e-3) { e.x = o.x + ox / od * mn; e.z = o.z + oz / od * mn; } }
  const R = world.R - 1, r = Math.hypot(e.x, e.z); if (r > R) { e.x *= R / r; e.z *= R / r; }
  e.moveAmt += (moving - e.moveAmt) * Math.min(1, dt * 6); e.ph += dt * (4 + 7 * e.moveAmt);
  e.holder.position.set(e.x, Math.max(H(e.x, e.z), -.5) + an.leap, e.z); e.holder.rotation.y = e.yaw;
  zhengPose(e, dt, e.moveAmt);
  if (e.flash > 0) { e.flash = Math.max(0, e.flash - dt * 5); setFlash(e, e.flash * .6); }
  e.warnT = Math.max(0, e.warnT - dt);
}
/* ---------------- poses ---------------- */
L_IDLE = LK(0, [-.2, -.22, -.5], [.25, .72, -.6], [0, .6, .72]);
const BLOCK_R = RK(0, [.16, -.17, -.47], [-1, .07, -.1], [.55, -.55, .62]);
const BLOCK_L = LK(0, [-.09, -.2, -.45], [0, 1, -.12], [1, 0, 0]);
const DAHE_R = RK(0, [.02, -.2, -.85], [0, 1, 0], [.05, -1, .3]);
const DAHE_L = LK(0, [-.085, -.18, -.8], [.05, 1, -.1], [0, 0, 1]);
const WJ_R = RK(0, [.08, -.19, -.58], [0, 1, .06], [.15, -.8, .58]);
const JY_R = RK(0, [.14, .0, -.5], [.08, 1, -.3], [.4, -.85, .35]);
const JY_L = LK(0, [-.17, -.15, -.5], [.15, .15, -1], [1, 0, 0]);
const SEAL_L = LK(0, [-.05, -.1, -.4], [0, 1, -.15], [0, 0, 1]);
const LOW_R = RK(0, [.24, -.3, -.5], [-.15, .6, -.8], [.5, -.6, .6]);
const PUSH_L = LK(0, [-.12, -.12, -.5], [.1, .3, -1], [1, 0, 0]);
const k_ = (key, k) => ({ ...key, k });

/* ---------------- skills ---------------- */
const SK = { atk: { cd: .42, t: 0 }, s1: { cd: 5, t: 0 }, s2: { cd: 7, t: 0 }, block: { cd: 1.6, t: 0 }, ride: { cd: 8, t: 0 }, wine: { cd: .5, t: 0 },
  dahe: { cd: 18, t: 0, st: 1 }, wanjian: { cd: 26, t: 0, st: 1 }, jianyu: { cd: 22, t: 0, st: 1 }, yinshen: { cd: 16, t: 0, st: 1 }, hudun: { cd: 14, t: 0, st: 1 } };
let pendingSkill = null, atkHeld = false, castQ = null, jyTarget = null;
function tickCastQ(dt) { if (!castQ) return; castQ.t -= dt; if (castQ.t <= 0) { castQ = null; return; } if (!VM.act || VM.act === 'atk' || VM.act === 'catch') { const id = castQ.id; castQ = null; tryCast(id); } }
function canAct() { return !player.dead && state === 'play'; }
function reveal() { if (player.stealthT > 0) { player.stealthT = 0; endStealth(true); } }
function tryCast(id) {
  if (!canAct()) return false;
  const s = SK[id];
  if (s.st && !hasSt(id)) { toast('神通尚未领悟'); jyTarget = null; return false; }
  if (wj.active) return false;
  if (id === 'hudun' && player.shield > 0) { toast('护盾生效中'); return false; }
  if (player.riding && id !== 'ride') { endRide(); pendingSkill = id; return false; }
  if (s.t > 0) { if (id !== 'atk') toast('冷却中'); if (id === 'jianyu') jyTarget = null; return false; }
  if (id === 'wine') { if (VM.act) return false; return doWine(); }
  if (id !== 'ride' && (!swordInHand || (VM.act && VM.act !== 'atk' && VM.act !== 'catch'))) { if (!swordInHand && id !== 'atk') toast('飞剑未归'); else if (swordInHand && id !== 'atk') castQ = { id, t: .7 }; return false; }
  if (id === 'atk' && VM.act) return false;
  if (player.stealthT > 0 && id !== 'ride' && id !== 'yinshen') reveal();
  ({ atk: doAttack, s1: doZhanma, s2: doFeijian, block: doBlock, ride: toggleRide, dahe: doDahe, wanjian: doWanjian, jianyu: doJianyu, yinshen: doYinshen, hudun: doHudun })[id]();
  tutEvent('cast', id);
  return true;
}
function liveEnemies() { return enemies.filter(e => !e.dead); }
function enemiesInCone(range, halfAng) {
  const f = fwd(), out = [];
  for (const m of liveEnemies()) { const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz) - m.radius; if (d > range) continue; const a = Math.acos(clamp((dx * f.x + dz * f.z) / Math.max(1e-3, Math.hypot(dx, dz)), -1, 1)); if (a <= halfAng || d < .6) out.push(m); }
  return out;
}
function pickTarget(maxD = 40) {
  const f = fwd(); let best = null, bs = 1e9;
  for (const m of liveEnemies()) { const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz); if (d > maxD) continue; const a = Math.acos(clamp((dx * f.x + dz * f.z) / Math.max(1e-3, d), -1, 1)); if (a > 1.2) continue; const s = d + a * 18; if (s < bs) { bs = s; best = m; } }
  return best;
}
function slashArc(wide, tilt, dir, hex) {
  const holder = new THREE.Group(); holder.position.set(player.x, camY - (wide ? .5 : .4), player.z); holder.rotation.y = player.yaw;
  const tg = new THREE.Group(); tg.rotation.z = tilt; holder.add(tg);
  const m = new THREE.Mesh(wide ? ARC_WIDE : ARC_SMALL, slashMat(hex)); m.rotation.x = -Math.PI / 2 + .22; if (dir < 0) m.scale.x = -1; tg.add(m);
  addFx(holder, wide ? .42 : .3, k => { m.material.uniforms.prog.value = Math.min(1.25, k * 2.2); m.material.uniforms.fade.value = k < .5 ? 1 : 1 - (k - .5) * 2; holder.position.set(player.x, camY - (wide ? .5 : .4), player.z); });
}
function doAttack() {
  SK.atk.t = SK.atk.cd; slashFlip = !slashFlip; sfx('swish');
  const keys = slashFlip ? [R_IDLE, RK(.3, [.36, .02, -.55], [.45, .85, .25], [.5, -.5, .7]), RK(.65, [-.2, -.17, -.55], [-.9, -.35, -.4], [.8, -.35, .5]), k_(R_IDLE, 1)]
    : [R_IDLE, RK(.3, [-.16, -.16, -.55], [-.9, -.15, -.4], [.8, -.4, .45]), RK(.65, [.36, .0, -.55], [.7, .65, -.3], [.45, -.6, .65]), k_(R_IDLE, 1)];
  playVM('atk', .4, keys, null, [{ at: .42, fn: () => { slashArc(false, slashFlip ? .55 : -.5, slashFlip ? 1 : -1, 0xbfe6ff); let n = 0; for (const m of enemiesInCone(3.4, .8)) { hitEnemy(m, player.atk * TUNE.mult.atk, 'atk', TUNE.tough.atk); n++; } if (n) tutEvent('hit'); } }]);
}
function doZhanma() {
  SK.s1.t = SK.s1.cd; swordGlow = 1; sfx('whoosh');
  const keys = [R_IDLE, RK(.25, [.4, -.12, -.5], [1, .1, -.15], [.3, -.6, .75]), RK(.45, [0, -.14, -.56], [-.25, .12, -1], [.5, -.7, .5]), RK(.66, [-.38, -.12, -.5], [-1, .05, -.2], [.8, -.5, .3]), k_(R_IDLE, 1)];
  const lk = [L_IDLE, LK(.3, [-.32, -.3, -.5], [-.3, .5, -.8], [0, .8, .5]), LK(.7, [-.32, -.3, -.5], [-.3, .5, -.8], [0, .8, .5]), k_(L_IDLE, 1)];
  playVM('s1', .62, keys, lk, [{ at: .38, fn: () => { slashArc(true, 0, 1, 0x7fd8ff); shake = Math.max(shake, .12); for (const m of enemiesInCone(5.6, 1.05)) hitEnemy(m, player.atk * TUNE.mult.s1, 's1', TUNE.tough.s1); } }]);
}
/* 飞剑 — v3: fast out-and-back (whole trip < 1s) */
const FLY = { out: 44, back: 54, range: 15 };
const fly = { active: false, phase: 0, pos: V3(), dir: V3(), dist: 0, hit: new Set(), obj: buildSword({ scale: 1.9 }), roll: 0, t: 0 };
fly.obj.bladeM.emissive.set(0x7fd8ff); fly.obj.bladeM.emissiveIntensity = .9; fly.obj.g.visible = false; scene.add(fly.obj.g);
function doFeijian() {
  SK.s2.t = SK.s2.cd; swordGlow = 1;
  const keys = [R_IDLE, RK(.35, [.22, -.12, -.55], [.1, .2, -1], [.5, -.6, .7]), RK(.55, [.18, -.13, -.72], [0, .05, -1], [.4, -.5, .8]), k_(R_IDLE, 1)];
  const lk = [L_IDLE, LK(.4, [-.1, -.12, -.6], [.05, .25, -1], [1, 0, 0]), LK(1, [-.12, -.13, -.6], [.05, .25, -1], [1, 0, 0])];
  playVM('s2', .45, keys, lk, [{ at: .55, fn: launchFly }]);
}
function launchFly() {
  swordInHand = false; sfx('whoosh');
  const f = fwd(); const r = rightV();
  fly.active = true; fly.phase = 0; fly.dist = 0; fly.t = 0; fly.hit.clear();
  fly.pos.set(player.x, camY - .35, player.z).addScaledVector(r, .25).addScaledVector(f, .8);
  fly.dir.copy(f); fly.dir.y = Math.sin(player.pitch) * .6; fly.dir.normalize(); fly.obj.g.visible = true;
}
function updateFly(dt) {
  if (!fly.active) return;
  fly.t += dt; const SP = fly.phase === 0 ? FLY.out : FLY.back;
  if (fly.phase === 0) { fly.pos.addScaledVector(fly.dir, SP * dt); fly.dist += SP * dt; const gy = H(fly.pos.x, fly.pos.z); if (fly.pos.y < gy + .5) fly.pos.y = gy + .5; if (fly.dist > FLY.range) { fly.phase = 1; fly.hit.clear(); } }
  else { const target = V3(player.x, camY - .4, player.z); const d = target.clone().sub(fly.pos); const len = d.length(); const SPr = Math.max(SP, len * 2.5); if (len < 1.2) { fly.lastTrip = fly.t; fly.active = false; fly.obj.g.visible = false; swordInHand = true; swordGlow = .8; sfx('ding'); playVM('catch', .25, [RK(0, [.22, -.14, -.7], [0, .3, -1]), k_(R_IDLE, 1)], null); tutEvent('catch'); return; } fly.dir.copy(d.normalize()); fly.pos.addScaledVector(fly.dir, Math.min(len, SPr * dt)); }
  fly.roll += dt * 2;
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, fly.dir); q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI / 2 + Math.sin(fly.roll) * .3));
  fly.obj.g.quaternion.copy(q); fly.obj.g.position.copy(fly.pos).addScaledVector(fly.dir, -1.0);
  for (let i = 0; i < 3; i++) { const b = fly.pos.clone().addScaledVector(fly.dir, -rand(0, 1.6)); emit(b.x, b.y, b.z, rand(-.3, .3), rand(-.3, .3), rand(-.3, .3), 0x8fe0ff, .3, .35, 0); }
  for (const m of liveEnemies()) { if (fly.hit.has(m)) continue; const c = eCenter(m); if (Math.hypot(c.x - fly.pos.x, c.z - fly.pos.z) < m.radius + .9 && Math.abs(c.y - fly.pos.y) < m.height * .7 + .6) { fly.hit.add(m); hitEnemy(m, player.atk * TUNE.mult.s2, 's2', TUNE.tough.s2); } }
}
/* 格挡 */
function doBlock() {
  SK.block.t = SK.block.cd; player.blockT = (timeScale < .5 && document.getElementById('blockcue').style.display === 'block') ? 1.2 : .5; sfx('swish');
  playVM('block', .62, [R_IDLE, k_(BLOCK_R, .14), k_(BLOCK_R, .82), k_(R_IDLE, 1)], [L_IDLE, k_(BLOCK_L, .14), k_(BLOCK_L, .82), k_(L_IDLE, 1)]);
}
/* 大河之剑 */
const GS = 9; const giant = buildSword({ scale: GS }); giant.g.scale.set(GS * 2.8, GS, GS * 2.8);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 80, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.visible = false; scene.add(beam); giant.bladeM.emissive.set(0xffe08a); giant.g.visible = false; scene.add(giant.g);
const ult = { active: false, t: 0, target: null, pt: V3(), hit: false, mark: null };
function showCaption(big, small) { const c = $('caption'); c.querySelector('b').textContent = big; c.querySelector('span').textContent = small || ''; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
function doDahe() {
  SK.dahe.t = SK.dahe.cd;
  const tgt = pickTarget(42); ult.target = tgt;
  if (tgt) ult.pt.set(tgt.x, 0, tgt.z); else { const f = fwd(); ult.pt.set(player.x + f.x * 12, 0, player.z + f.z * 12); }
  sfx('ding'); vSword.bladeM.emissive.set(0xffc860);
  showCaption('大河之剑', '君不见 · 大河之剑天上来');
  playVM('dahe', 2.3, [R_IDLE, k_(DAHE_R, .2), k_(DAHE_R, .82), k_(R_IDLE, 1)], [L_IDLE, k_(DAHE_L, .25), k_(DAHE_L, .8), k_(L_IDLE, 1)], [{ at: .12, fn: () => { swordGlow = 1; } }, { at: .3, fn: startGiant }, { at: .5, fn: () => { swordGlow = .8; } }, { at: .99, fn: () => vSword.bladeM.emissive.set(0x66ccff) }]);
}
function startGiant() {
  ult.active = true; ult.t = 0; ult.hit = false; giant.g.visible = true; giant.g.rotation.set(Math.PI, 0, 0); giant.bladeM.emissiveIntensity = .6;
  if (ult.mark) scene.remove(ult.mark);
  ult.mark = new THREE.Mesh(ringGeo, addMat(0xffd060, .9)); ult.mark.rotation.x = -Math.PI / 2; scene.add(ult.mark); sfx('whoosh');
}
function updateUlt(dt) {
  if (!ult.active) return;
  ult.t += dt;
  if (ult.target && !ult.target.dead && !ult.hit) ult.pt.set(ult.target.x, 0, ult.target.z);
  const gy = Math.max(H(ult.pt.x, ult.pt.z), -.3); const L = (BLADE_LEN + GUARD_Y) * GS;
  const top = ult.target ? ult.target.height + 1.2 : 0;
  const endY = gy + L - 1.6, startY = endY + 40;
  const DESC = .55, HOLD = 1.1;
  ult.mark.position.set(ult.pt.x, gy + .15, ult.pt.z); const mr = 3.2 + Math.sin(ult.t * 18) * .2; ult.mark.scale.set(mr, mr, mr);
  let y;
  if (ult.t < DESC) { const k = ult.t / DESC; y = lerp(startY, endY, k * k * k); }
  else { y = endY; if (!ult.hit) { ult.hit = true; impactUlt(gy); } }
  giant.g.position.set(ult.pt.x, y, ult.pt.z);
  beam.visible = true; beam.position.set(ult.pt.x, gy + 40, ult.pt.z); beam.material.opacity = ult.t < DESC ? .25 * (ult.t / DESC) : Math.max(0, .25 - (ult.t - DESC) * .3);
  if (ult.t > DESC) { ult.mark.material.opacity = Math.max(0, .9 - (ult.t - DESC) * 2); giant.bladeM.emissiveIntensity = Math.max(0, 1.5 - (ult.t - DESC) * 1.5); }
  if (ult.t > DESC + HOLD) { const k = (ult.t - DESC - HOLD) / .5; giant.g.position.y = endY + easeIO(Math.min(1, k)) * 60; if (k >= 1) { ult.active = false; giant.g.visible = false; beam.visible = false; scene.remove(ult.mark); ult.mark = null; } }
  if (ult.t < DESC) for (let i = 0; i < 4; i++) emit(ult.pt.x + rand(-1, 1), y - L + rand(0, L), ult.pt.z + rand(-1, 1), 0, 6, 0, 0xffe7a0, .6, .4, 0);
}
function impactUlt(gy) {
  const p = V3(ult.pt.x, gy, ult.pt.z);
  shake = .7; sfx('boom');
  shockRing(p, 0xffd060, 1, 13, .9); shockRing(p, 0xffffff, .5, 7, .5); shockRing(p, 0xff9a30, 2, 18, 1.3, .6);
  burst(V3(p.x, p.y + 1, p.z), 90, 0xffd27a, 16, .8, .9, -10, .8);
  burst(V3(p.x, p.y + .5, p.z), 50, 0xc8b89a, 7, 1.2, 1.2, -2, .3);
  flashScreen('#fff6d8', .55);
  const RAD = 6;
  if (ult.target && !ult.target.dead) { hitEnemy(ult.target, player.atk * TUNE.mult.dahe, 'ult', TUNE.tough.dahe); if (!ult.target.boss) knockUp(ult.target, 3.2, 1.15); }
  for (const m of liveEnemies()) { if (m === ult.target) continue; const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < RAD + m.radius) { hitEnemy(m, player.atk * TUNE.mult.daheSplash, 's1', TUNE.tough.daheSplash); if (!m.boss) knockBack(m, p.x, p.z, RAD + m.radius + 1.2 - d, .35); } }
}
/* 万剑归宗 */
const qiMat = new THREE.MeshBasicMaterial({ color: 0xa8ecff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const qiCore = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function makeQi(len, w) { const g = new THREE.Group(); const a = mk(QI_GEO, qiMat, g, 0, 0, 0, w, 1, len); const b = mk(QI_GEO, qiMat, g, 0, 0, 0, w, 1, len); b.rotation.z = Math.PI / 2; const c = mk(QI_GEO, qiCore, g, 0, 0, 0, w * .35, 1, len * .8); c.rotation.z = Math.PI / 4; return g; }
const wj = { active: false, t: 0, acc: 0, pool: [], live: [] };
for (let i = 0; i < 140; i++) { const q = makeQi(1.3, .7); q.visible = false; scene.add(q); wj.pool.push(q); }
function doWanjian() {
  SK.wanjian.t = 0; wj.active = true; wj.t = 0; wj.acc = 0; sfx('whoosh'); swordGlow = 1.3;
  showCaption('万剑归宗', '');
  playVM('wanjian', 5.5, [R_IDLE, k_(WJ_R, .06), k_(WJ_R, .95), k_(R_IDLE, 1)], null, [], 'two');
  shockRing(V3(player.x, H(player.x, player.z), player.z), 0x9fe8ff, .5, 5, .8);
}
function updateWanjian(dt) {
  if (wj.active) {
    wj.t += dt; swordGlow = Math.max(swordGlow, 1);
    wj.acc += dt * 50;
    const f = fwd(), r = rightV();
    while (wj.acc >= 1 && wj.pool.length) {
      wj.acc -= 1; const q = wj.pool.pop(); q.visible = true;
      const st = V3(player.x, camY, player.z).addScaledVector(f, -rand(1.2, 4)).addScaledVector(r, rand(-3.6, 3.6)).add(V3(0, rand(-.5, 2.4), 0));
      const tg = pickTarget(30); let to;
      if (tg && Math.random() < .85) { to = eCenter(tg).add(V3(rand(-.6, .6), rand(-.6, .8), rand(-.6, .6))); }
      else to = V3(player.x, camY + rand(-.5, 1.2), player.z).addScaledVector(f, 30).addScaledVector(r, rand(-6, 6));
      const dir = to.clone().sub(st).normalize();
      q.position.copy(st); q.quaternion.setFromUnitVectors(V3(0, 0, -1), dir);
      wj.live.push({ q, dir, tg, life: 1.4, sp: rand(30, 40) });
    }
    if (wj.t >= 5) { wj.active = false; SK.wanjian.t = SK.wanjian.cd; }
  }
  for (let i = wj.live.length - 1; i >= 0; i--) {
    const b = wj.live[i]; b.life -= dt; b.q.position.addScaledVector(b.dir, b.sp * dt);
    if (Math.random() < .35) emit(b.q.position.x, b.q.position.y, b.q.position.z, 0, 0, 0, 0x9fe8ff, .25, .25, 0);
    let done = b.life <= 0;
    if (!done && b.tg && !b.tg.dead) { const c = eCenter(b.tg); if (b.q.position.distanceTo(c) < b.tg.radius + .7) { hitEnemy(b.tg, player.atk * TUNE.mult.wanjian, 'tick', TUNE.tough.wanjian); burst(b.q.position, 6, 0xcff6ff, 4, .3, .25, 0); done = true; } }
    if (done) { b.q.visible = false; wj.pool.push(b.q); wj.live.splice(i, 1); }
  }
}
/* 剑雨 */
const runeTex = canvasTex(512, 512, (c, w) => { const cx = w / 2; c.clearRect(0, 0, w, w); c.strokeStyle = '#bff4ff'; c.shadowColor = '#7fd8ff'; c.shadowBlur = 12; for (const [r, lw] of [[244, 6], [226, 2], [170, 3], [150, 2], [70, 3]]) { c.lineWidth = lw; c.beginPath(); c.arc(cx, cx, r, 0, 7); c.stroke(); } c.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * 70, cx + Math.sin(a) * 70); c.lineTo(cx + Math.cos(a) * 226, cx + Math.sin(a) * 226); c.stroke(); } c.font = 'bold 34px serif'; c.fillStyle = '#dff8ff'; c.textAlign = 'center'; c.textBaseline = 'middle'; const ch = '乾坤震巽坎离艮兑'; for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; c.save(); c.translate(cx + Math.cos(a) * 196, cx + Math.sin(a) * 196); c.rotate(a + Math.PI / 2); c.fillText(ch[i], 0, 0); c.restore(); } c.font = 'bold 80px serif'; c.fillText('剑', cx, cx + 4); });
const zones = [];
const rainPool = []; for (let i = 0; i < 70; i++) { const q = makeQi(.75, .45); q.visible = false; scene.add(q); rainPool.push(q); }
const JY = { R: 4.5, maxRange: 12, dead: 14, full: 95 };
function doJianyu() {
  SK.jianyu.t = SK.jianyu.cd; sfx('whoosh');
  const tg = jyTarget; jyTarget = null;
  playVM('jianyu', .9, [R_IDLE, k_(JY_R, .35), k_(JY_R, .7), k_(R_IDLE, 1)], [L_IDLE, k_(JY_L, .35), k_(JY_L, .7), k_(L_IDLE, 1)], [{ at: .4, fn: () => { swordGlow = 1.2; if (tg) createZone(tg.x, tg.z); else createZone(player.x, player.z); } }]);
}
/* 剑雨 aiming: press-and-drag on the button moves a ground circle forward; release casts; quick tap casts at feet */
const jyAim = { on: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0, x: 0, z: 0 };
const jyInd = new THREE.Group(); jyInd.visible = false; scene.add(jyInd);
const aimMat = (hex, op) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false });
const AIM_RING = new THREE.RingGeometry(.93, 1, 64), RANGE_RING = new THREE.RingGeometry(.985, 1, 96);
{ const ring = mk(AIM_RING, aimMat(0x1aa8ff, .95), jyInd); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(JY.R); jyInd.userData.ring = ring;
  const fill = mk(discGeo, aimMat(0x0a4ab0, .3), jyInd); fill.rotation.x = -Math.PI / 2; fill.scale.setScalar(JY.R);
  const rune = mk(new THREE.PlaneGeometry(2 * JY.R, 2 * JY.R), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: .85, depthWrite: false, color: 0x3ab8ff, fog: false }), jyInd); rune.rotation.x = -Math.PI / 2; rune.position.y = .01; jyInd.userData.rune = rune; }
const jyRange = mk(RANGE_RING, aimMat(0x1aa8ff, .55), scene); jyRange.rotation.x = -Math.PI / 2; jyRange.visible = false;
const jyLine = mk(new THREE.PlaneGeometry(.12, 1), aimMat(0x1aa8ff, .6), scene); jyLine.rotation.order = 'YXZ'; jyLine.visible = false;
function jyAimTarget() {
  const len = Math.hypot(jyAim.dx, jyAim.dy);
  if (len < JY.dead) return { x: player.x, z: player.z, feet: true };
  const dist = Math.min(JY.maxRange, (len - JY.dead) / JY.full * JY.maxRange);
  const f = fwd(), r = rightV(); const vx = f.x * -jyAim.dy + r.x * jyAim.dx, vz = f.z * -jyAim.dy + r.z * jyAim.dx, vl = Math.hypot(vx, vz) || 1;
  let x = player.x + vx / vl * dist, z = player.z + vz / vl * dist; const rr = Math.hypot(x, z), R = (world.R || 40) - 1; if (rr > R) { x *= R / rr; z *= R / rr; }
  return { x, z, feet: false };
}
function jyAimStart(id, x, y) { jyAim.on = true; jyAim.id = id; jyAim.sx = x; jyAim.sy = y; jyAim.dx = 0; jyAim.dy = 0; document.body.classList.add('aiming'); toast('剑雨 · 拖动瞄准落点，松手施放'); }
function jyAimMove(x, y) { jyAim.dx = x - jyAim.sx; jyAim.dy = y - jyAim.sy; }
function jyAimEnd(cancel) { if (!jyAim.on) return; const t = jyAimTarget(); jyAim.on = false; jyAim.id = null; jyInd.visible = jyRange.visible = jyLine.visible = false; document.body.classList.remove('aiming'); if (cancel) return; jyTarget = t.feet ? null : { x: t.x, z: t.z }; if (!tryCast('jianyu') && !castQ) jyTarget = null; }
function updateJyAim() {
  if (!jyAim.on) return; if (!canAct()) { jyAimEnd(true); return; }
  const t = jyAimTarget(); jyAim.x = t.x; jyAim.z = t.z;
  jyInd.visible = true; jyInd.position.set(t.x, Math.max(H(t.x, t.z), -.25) + .08, t.z); jyInd.userData.rune.rotation.z += .02; jyInd.userData.ring.material.opacity = .7 + .25 * Math.sin(gameT * 10);
  jyRange.visible = true; jyRange.position.set(player.x, Math.max(H(player.x, player.z), -.25) + .07, player.z); jyRange.scale.setScalar(JY.maxRange + JY.R * 0);
  const dx = t.x - player.x, dz = t.z - player.z, L = Math.hypot(dx, dz);
  jyLine.visible = L > .5; if (L > .5) { jyLine.scale.y = L; jyLine.position.set(player.x + dx / 2, Math.max(H(player.x + dx / 2, player.z + dz / 2), -.25) + .09, player.z + dz / 2); jyLine.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0); jyLine.rotation.order = 'YXZ'; jyLine.rotation.y = Math.atan2(dx, dz); jyLine.rotation.x = -Math.PI / 2; }
}
function createZone(x, z) {
  const g = new THREE.Group(); const y = Math.max(H(x, z), -.25) + .06; g.position.set(x, y, z); scene.add(g);
  const R = 4.5;
  const disc = mk(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fe8ff }), g); disc.rotation.x = -Math.PI / 2;
  const fill = mk(discGeo, addMat(0x3fa8ff, .0), g, 0, .01, 0, R, R, R); fill.rotation.x = -Math.PI / 2;
  const wall = mk(new THREE.CylinderGeometry(R, R, 6, 48, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { op: { value: 0 } }, vertexShader: 'varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float op; varying float vY; void main(){ float a=(1.-vY)*(1.-vY)*op*.35; gl_FragColor=vec4(vec3(.5,.85,1.)*a,a); }' }), g, 0, 3, 0);
  zones.push({ g, disc, fill, wall, x, z, y, r: R, t: 0, dur: 10, tick: 0, acc: 0 });
  shockRing(V3(x, y, z), 0x9fe8ff, .5, R, .6);
}
const rainLive = [];
function updateZones(dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const Z = zones[i]; Z.t += dt; const fade = Math.min(1, Z.t * 3, (Z.dur - Z.t) * 1.5);
    Z.disc.material.opacity = .9 * fade; Z.fill.material.opacity = .12 * fade; Z.wall.material.uniforms.op.value = fade; Z.disc.rotation.z += dt * .4;
    Z.acc += dt * 34 * fade;
    while (Z.acc >= 1 && rainPool.length) { Z.acc -= 1; const q = rainPool.pop(); q.visible = true; const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * Z.r * .95; const px = Z.x + Math.cos(a) * r, pz = Z.z + Math.sin(a) * r; q.position.set(px, Z.y + rand(8, 12), pz); const dir = V3(rand(-.08, .08), -1, rand(-.08, .08)).normalize(); q.quaternion.setFromUnitVectors(V3(0, 0, -1), dir); rainLive.push({ q, dir, gy: Z.y, sp: rand(26, 34) }); }
    Z.tick -= dt; if (Z.tick <= 0) { Z.tick = .25; for (const m of liveEnemies()) if (Math.hypot(m.x - Z.x, m.z - Z.z) < Z.r + m.radius * .6) { m.slowT = .45; hitEnemy(m, player.atk * TUNE.mult.jianyu, 'tick', TUNE.tough.jianyu); } }
    if (Z.t >= Z.dur) { scene.remove(Z.g); zones.splice(i, 1); }
  }
  for (let i = rainLive.length - 1; i >= 0; i--) { const b = rainLive[i]; b.q.position.addScaledVector(b.dir, b.sp * dt); if (b.q.position.y <= b.gy + .2) { const p = b.q.position; burst(V3(p.x, b.gy + .1, p.z), 4, 0xbff4ff, 3, .3, .3, -4, .6); if (Math.random() < .15) shockRing(V3(p.x, b.gy, p.z), 0x9fe8ff, .1, .8, .3, .6); b.q.visible = false; rainPool.push(b.q); rainLive.splice(i, 1); } }
}
/* 隐身 */
function doYinshen() {
  SK.yinshen.t = SK.yinshen.cd;
  decoy.active = true; decoy.pos.set(player.x, H(player.x, player.z), player.z); decoy.holder.rotation.y = player.yaw + Math.PI; decoy.fade = .6;
  smoke(V3(player.x, camY - .6, player.z), 0x7fd8ff);
  player.stealthT = TUNE.stealthDur; player.dashV.copy(fwd()).multiplyScalar(7 / .28); player.dashT = .28; fovKick = 14;
  document.body.classList.add('stealth'); sfx('whoosh');
  playVM('yinshen', .55, [R_IDLE, k_(LOW_R, .3), k_(LOW_R, .7), k_(R_IDLE, 1)], [L_IDLE, k_(SEAL_L, .25), k_(SEAL_L, .7), k_(L_IDLE, 1)]);
  toast('隐身 · 敌人将攻击残影');
}
function endStealth(early) { document.body.classList.remove('stealth'); decoy.active = false; player.ambushT = TUNE.ambushWin; toast(early ? '出手现身 · 破隐一击！' : '隐身结束 · 下一击为破隐一击'); smoke(V3(decoy.pos.x, decoy.pos.y + 1, decoy.pos.z), 0x7fd8ff); }
/* 护盾 */
const orb = new THREE.Group(); scene.add(orb); orb.visible = false;
mk(G.sph, new THREE.MeshBasicMaterial({ color: 0xffffff }), orb, 0, 0, 0, .1, .1, .1);
const orbHalo = mk(G.sph, auraMat(0x7fe0ff, 1.2, 1.6), orb, 0, 0, 0, .16, .16, .16);
const orbRing = mk(G.tor, addMat(0xaef0ff, .8), orb, 0, 0, 0, .14, .14, .14);
const bubble = mk(G.sph, auraMat(0x7fd8ff, 3.0, .35), scene, 0, 0, 0, 1, 1, 1); bubble.visible = false;
let orbA = 0;
function doHudun() {
  player.shield = player.shieldMax; SK.hudun.t = 0; SK.hudun.active = true; orb.visible = true; bubble.visible = true; hudDirty = true; sfx('shield');
  shockRing(V3(player.x, H(player.x, player.z), player.z), 0x7fe0ff, .3, 3, .7);
  playVM('hudun', .55, [R_IDLE, k_(R_IDLE, 1)], [L_IDLE, k_(PUSH_L, .3), k_(PUSH_L, .65), k_(L_IDLE, 1)]);
  toast(`护盾：吸收 ${player.shieldMax} 点伤害`);
}
function shieldHitFx() { orbHalo.scale.setScalar(.32); burst(orb.position, 10, 0xaef0ff, 3, .3, .3, 0); flashScreen('#9fe8ff', .2, .3); }
function shieldBreak() { player.shield = 0; SK.hudun.active = false; SK.hudun.t = SK.hudun.cd; orb.visible = false; bubble.visible = false; burst(orb.position, 30, 0xaef0ff, 6, .4, .6, -2); sfx('clang'); toast('护盾破碎'); hudDirty = true; }
function updateOrb(dt) {
  if (!orb.visible) return;
  orbA += dt * 2.0; const r = 1.3;
  orb.position.set(player.x + Math.cos(orbA) * r, camY - .14 + Math.sin(gameT * 3) * .08, player.z + Math.sin(orbA) * r);
  orbHalo.scale.setScalar(lerp(orbHalo.scale.x, .24 + Math.sin(gameT * 8) * .02, dt * 6)); orbRing.rotation.set(gameT * 3, gameT * 2, 0);
  emit(orb.position.x, orb.position.y, orb.position.z, 0, 0, 0, 0x9fe8ff, .16, .7, 0);
  bubble.position.set(player.x, camY - .7, player.z); bubble.scale.set(1.2, 1.5, 1.2);
}
/* 酒 */
const DRINK_L = [LF(0, [-.26, -.34, -.45], [.0, 1, -.2], [-.4, -.7, .5]), LF(.35, [-.1, -.16, -.42], [.55, .55, .6], [-.5, -.75, .1]), LF(.75, [-.09, -.14, -.41], [.6, .6, .5], [-.5, -.75, .1]), LF(1, [-.26, -.34, -.45], [.0, 1, -.2], [-.4, -.7, .5])];
function doWine() {
  if (player.wine <= 0) { toast('酒已饮尽 · 击杀敌人可补充'); return false; }
  if (player.hp >= player.maxHp) { toast('气血已满'); return false; }
  SK.wine.t = SK.wine.cd;
  playVM('drink', .95, null, DRINK_L, [{ at: .5, fn: () => sfx('drink') }, { at: .62, fn: () => { player.wine--; const heal = Math.round(player.maxHp * TUNE.wineFrac); const h = Math.min(heal, player.maxHp - player.hp); player.hp += h; hudDirty = true; screenNum('+' + heal + ' 气血', 'heal', innerWidth * .5 - 30, innerHeight * .45); burst(ppos(), 16, 0x9effa0, 2, .3, .8, 1, .5); tutEvent('drink'); } }], 'gourd');
  return true;
}
/* 御剑 */
const rideSword = buildSword({ scale: 3.0 }); rideSword.bladeM.emissive.set(0x9fe8ff); rideSword.bladeM.emissiveIntensity = .5; rideSword.g.visible = false; scene.add(rideSword.g);
const RIDE_DUR = 10;
function toggleRide() { if (player.riding) endRide(); else startRide(); }
function startRide() {
  if (!swordInHand) { toast('飞剑未归'); return; }
  const keys = [R_IDLE, RK(.5, [.12, -.62, -.5], [0, .05, -1], [.4, -.4, .8]), RK(1, [.1, -.95, -.45], [0, -.1, -1], [.4, -.3, .8])];
  playVM('ridein', .42, keys, null, [{ at: 1, fn: () => { swordInHand = false; player.riding = true; player.rideT = RIDE_DUR; rideSword.g.visible = true; sfx('whoosh'); shockRing(V3(player.x, Math.max(0, H(player.x, player.z)), player.z), 0x9fe8ff, .3, 3.5, .6); toast('御剑飞行！'); } }]);
}
function endRide() {
  if (!player.riding) return;
  player.riding = false; rideSword.g.visible = false; SK.ride.t = SK.ride.cd;
  swordInHand = true;
  playVM('rideout', .38, [RK(0, [.1, -.95, -.45], [0, -.1, -1], [.4, -.3, .8]), RK(.5, [.14, -.6, -.5], [0, .2, -1], [.4, -.4, .8]), k_(R_IDLE, 1)], null, [{ at: 1, fn: () => { if (pendingSkill) { const s = pendingSkill; pendingSkill = null; setTimeout(() => tryCast(s), 30); } } }]);
}
/* 御剑 ram: enemies in the riding path take damage and are knocked back (bosses: rider rebounds instead) */
let rideRams = 0;
function updateRideRam() {
  if (!player.riding || player.dead) return;
  for (const m of liveEnemies()) {
    const d = Math.hypot(m.x - player.x, m.z - player.z); if (d > m.radius + 1.5 || (m.ramCd || 0) > gameT) continue;
    m.ramCd = gameT + .7; rideRams++;
    hitEnemy(m, player.atk * TUNE.mult.ride, 'ride', TUNE.tough.ride);
    const c = eCenter(m); burst(c, 26, 0x9fe8ff, 8, .5, .5, -3); shockRing(V3(m.x, H(m.x, m.z), m.z), 0x9fe8ff, .4, 3.2, .45); sfx('clang'); shake = Math.max(shake, .3);
    if (!m.boss) knockBack(m, player.x, player.z, 5, .35); else knockPlayer(m.x, m.z, 2.4);
  }
}
function resetSkills() {
  for (const k in SK) { SK[k].t = 0; SK[k].active = false; }
  wj.active = false; for (const b of wj.live) { b.q.visible = false; wj.pool.push(b.q); } wj.live.length = 0;
  for (const Z of zones) scene.remove(Z.g); zones.length = 0; for (const b of rainLive) { b.q.visible = false; rainPool.push(b.q); } rainLive.length = 0;
  ult.active = false; giant.g.visible = false; beam.visible = false; if (ult.mark) { scene.remove(ult.mark); ult.mark = null; }
  fly.active = false; fly.obj.g.visible = false; swordInHand = true; player.riding = false; rideSword.g.visible = false;
  player.shield = 0; orb.visible = false; bubble.visible = false; player.stealthT = 0; decoy.active = false; decoy.fade = 0; document.body.classList.remove('stealth');
  player.ambushT = 0; jyTarget = null; if (jyAim.on) jyAimEnd(true);
  player.blockT = 0; player.dashT = 0; VM.act = null; VM.hold = false; atkHeld = false; pendingSkill = null; castQ = null;
}
/* ---------------- story / flow ---------------- */
const shixiong = makeShixiong();
const zheng = makeZheng(); zheng.holder.visible = false;
let valleyT = 0, fightStart = 0;
function placePlayer(sp) { player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; player.pitch = -.04; camY = H(sp.x, sp.z) + 1.7; }
function setupLiBai() {
  player.name = '李白'; player.lv = 90; player.xp = 0; recalc(); player.hp = player.maxHp; player.wine = 2; player.wineMax = 2; player.unlocked = ALL_ST.slice(); player.minHpFrac = .3; player.dead = false;
  setOutfit(0xeef1f6, 0x5fa6d8); $('avatar').textContent = '李'; hudDirty = true;
}
/* ===== tutorial ===== */
const SHIXIONG_TOUGH = 300; // tutorial: single phase, one bar
const SHIXIONG_DMGK = 2.75; // 师兄 hits scaled to 李白's v3 气血 (5450)
const tut = { i: -1, cur: null, wait: 0, moved: 0, looked: 0, hits: 0, casts: 0, fails: 0, floorHp: 1 };
const TUT = [
  { id: 'intro', t: '你是诗剑仙 · 李白。师兄修炼魔剑走火入魔，于云海之巅拦住了你的去路。', next: true },
  { id: 'move', t: '按住<b>左下摇杆</b>移动，向师兄靠近', hl: 'joy', check: () => tut.moved > 3 },
  { id: 'look', t: '在<b>屏幕右侧滑动</b>，转动视角', hl: 'look', check: () => tut.looked > .9 },
  { id: 'atk', t: '靠近师兄，点击<b>普攻</b>，命中 3 次', hl: 'btn-atk', on: (ty) => (ty === 'hit' && ++tut.hits >= 3) || (ty === 'cast' && ++tut.casts >= 8) },
  { id: 's1', t: '<b>斩马</b>：横向大范围挥斩，<b>削减韧性最多</b>。首领血条下的金色条是<b>韧性</b>：韧性越高受伤越低且不会自动恢复，打空即「破防」，此后该阶段受全额伤害（进入下一阶段时韧性回满）', hl: 'btn-s1', on: (ty, id) => ty === 'cast' && id === 's1' },
  { id: 's2', t: '<b>飞剑</b>：剑脱手疾飞，穿透敌人后不到 1 秒便飞回手中', hl: 'btn-s2', on: (ty) => ty === 'catch' },
  { id: 'block', t: '师兄即将出招！看到<b>紫光与「!」</b>时按<b>格挡</b>——挡下近身攻击即触发<b>弹反</b>：反击、大幅削韧并震退对手', hl: 'btn-block', on: (ty) => ty === 'block', enter() { shixiong.forced = 'blink'; shixiong.cd = 1.5; SK.block.t = 0; }, exit() { shixiong.forced = null; shixiong.cd = 3; } },
  { id: 'wine', t: '你被剑气所伤！点击左侧<b>酒葫芦</b>饮酒，每口恢复 <b>15%</b> 气血', hl: 'wine', on: (ty) => ty === 'drink', enter() { player.hp = Math.round(player.maxHp * .52); hudDirty = true; shake = .4; $('vign').style.opacity = .8; setTimeout(() => $('vign').style.opacity = 0, 300); player.wine = Math.max(1, player.wine); } },
  { id: 'dahe', t: '神通 · <b>大河之剑</b>（神通中央）：巨剑自天而降，伤害最高；击飞目标，震退周围小怪（首领不会被击退）', hl: 'st-dahe', st: 'dahe', on: (ty, id) => ty === 'cast' && id === 'dahe', wait: 2.2 },
  { id: 'wanjian', t: '神通 · <b>万剑归宗</b>（上）：双手持剑，万道剑气自身后飞出，持续 5 秒', hl: 'st-wanjian', st: 'wanjian', on: (ty, id) => ty === 'cast' && id === 'wanjian', wait: 5.4 },
  { id: 'jianyu', t: '神通 · <b>剑雨</b>（左）：<b>按住并拖动</b>按钮瞄准落点，松手施放（轻点则落在脚下）。剑雨持续 10 秒并<b>减速</b>其中的敌人', hl: 'st-jianyu', st: 'jianyu', on: (ty, id) => ty === 'cast' && id === 'jianyu', wait: 2.5 },
  { id: 'yinshen', t: '神通 · <b>隐身</b>（右）：留下残影并向前冲刺，3 秒内敌人（包括首领）只会攻击残影；现身后第一击为<b>破隐一击</b>，伤害翻倍', hl: 'st-yinshen', st: 'yinshen', on: (ty, id) => ty === 'cast' && id === 'yinshen', wait: 3 },
  { id: 'hudun', t: '神通 · <b>护盾</b>（下）：法球环绕周身，吸收相当于 <b>20% 气血上限</b>的伤害', hl: 'st-hudun', st: 'hudun', on: (ty, id) => ty === 'cast' && id === 'hudun', wait: 2.5 },
];
function startTutorial() {
  mode = 'tutorial'; state = 'play'; setWorld('cloud'); clearFx(); clearProj(); resetSkills(); setupLiBai(); placePlayer(world.spawn);
  enemies.length = 0; enemies.push(shixiong); zheng.holder.visible = false;
  Object.assign(shixiong, { hp: 50000, maxHp: 50000, x: 0, z: -6.5, act: null, cd: 3, ai: true, visible: true, forced: null, dead: false, dmgK: SHIXIONG_DMGK, cutLift: 0, stagger: 0 }); initTough(shixiong, SHIXIONG_TOUGH, 1);
  shixiong.holder.visible = true; shixiong.model.sword.bladeM.emissiveIntensity = 1.4;
  document.body.className = 'm-tut'; $('skip').style.display = 'block';
  tut.i = -1; tut.wait = 0; nextStep();
  banner('剑仙之道', '序章 · 云海问剑', 2.6);
}
function stepFloor(i) { return Math.round(shixiong.maxHp * (1 - (i + 1) / TUT.length * .9)); }
function nextStep() {
  if (tut.cur && tut.cur.exit) tut.cur.exit();
  tut.i++; if (tut.i >= TUT.length) { tut.cur = null; hideGuide(); startCutscene(); return; }
  const c = tut.cur = TUT[tut.i]; tut.moved = 0; tut.looked = 0; tut.hits = 0; tut.casts = 0; tut.fails = 0;
  shixiong.floorHp = stepFloor(tut.i);
  if (c.st) SK[c.st].t = 0;
  c.enter && c.enter();
  showGuide(c);
}
function completeStep() {
  const c = tut.cur; if (!c || tut.wait > 0) return;
  tut.wait = c.wait || 1.1; sfx('ding');
  $('guide').classList.add('done');
  const target = stepFloor(tut.i); if (shixiong.hp > target) { const d = shixiong.hp - target; shixiong.hp = target; showNum(V3(shixiong.x, 2.6, shixiong.z), d, 'big'); shixiong.flash = 1; }
}
function tutEvent(ty, id) { if (mode !== 'tutorial' || state !== 'play' || !tut.cur || tut.wait > 0) return; const c = tut.cur; if (c.on && c.on(ty, id)) completeStep(); }
function tutBlockCue(on) { $('blockcue').style.display = on ? 'block' : 'none'; }
function updateTutorial(dt) {
  if (!tut.cur) return;
  if (tut.wait > 0) { tut.wait -= dt; if (tut.wait <= 0) nextStep(); return; }
  if (tut.cur.check && tut.cur.check()) completeStep();
  positionHighlight();
}
function showGuide(c) {
  const g = $('guide'); g.classList.remove('done'); g.style.display = 'block';
  $('gstep').textContent = `教程 ${tut.i + 1}/${TUT.length}`; $('gtext').innerHTML = c.t;
  $('gnext').style.display = c.next ? 'inline-block' : 'none';
  $('swipe').style.display = c.hl === 'look' ? 'block' : 'none';
  positionHighlight();
}
function hideGuide() { $('guide').style.display = 'none'; $('hl').style.display = 'none'; $('swipe').style.display = 'none'; tutBlockCue(false); }
function positionHighlight() {
  const c = tut.cur, hl = $('hl'); if (!c || !c.hl || c.hl === 'look' || tut.wait > 0) { hl.style.display = 'none'; return; }
  const el = $(c.hl); if (!el) { hl.style.display = 'none'; return; } const r = el.getBoundingClientRect();
  const pad = 8; hl.style.display = 'block'; hl.style.left = (r.left - pad) + 'px'; hl.style.top = (r.top - pad) + 'px'; hl.style.width = (r.width + pad * 2) + 'px'; hl.style.height = (r.height + pad * 2) + 'px';
}
function skipTutorial() { if (mode !== 'tutorial') return; hideGuide(); $('skip').style.display = 'none'; resetSkills(); clearProj(); startStory(); }
/* ===== cutscene ===== */
const cut = { t: 0, fired: {} };
let lostSword = null;
function sub(who, txt) { const s = $('sub'); s.innerHTML = who ? `<b>${who}</b>${txt}` : txt; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show'); }
function startCutscene() {
  state = 'cut'; cut.t = 0; cut.fired = {}; $('skip').style.display = 'none'; document.body.classList.add('cine');
  resetSkills(); clearProj();
  const e = shixiong; e.act = null; e.ai = false; e.floorHp = 0; e.hp = Math.round(e.maxHp * .08); e.cutLift = 0;
  sub('师兄', '师弟……你的剑，终究慢了我一步。');
}
const purpleSky = [new THREE.Color(0x12062a), new THREE.Color(0x5a2a8a), new THREE.Color(0xc070c0)];
function updateCut(dt) {
  cut.t += dt; const t = cut.t, e = shixiong; const once = (k, at, fn) => { if (!cut.fired[k] && t >= at) { cut.fired[k] = 1; fn(); } };
  const want = Math.atan2(-(e.x - player.x), -(e.z - player.z));
  if (t < 3) { player.yaw += angDiff(player.yaw, want) * Math.min(1, dt * 3); player.pitch = lerp(player.pitch, .14, dt * 2); }
  const k = smooth(0, 2.4, t);
  skyMat.uniforms.top.value.lerp(purpleSky[0], dt * .8); skyMat.uniforms.mid.value.lerp(purpleSky[1], dt * .8); skyMat.uniforms.bot.value.lerp(purpleSky[2], dt * .5);
  if (t < 2.5) { e.cutLift = k * 1.6; setPose(e, 'sky', 4); e.model.sword.bladeM.emissiveIntensity = 2 + k * 5; const tip = swordTip(e); for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), r = rand(1.5, 3.5); const p = tip.clone().add(V3(Math.cos(a) * r, rand(-1.5, 2), Math.sin(a) * r)); const v = tip.clone().sub(p).multiplyScalar(2.2); emit(p.x, p.y, p.z, v.x, v.y, v.z, Math.random() < .3 ? 0x300a50 : 0xc070ff, .5, .45, 0); } shake = Math.max(shake, .04 + k * .08); }
  once('l2', 1.2, () => sub('师兄', '这天下第一剑……只能是我的！'));
  once('slash', 2.5, () => {
    setPose(e, 'slash', 16); sfx('whoosh'); sfx('roar');
    const from = V3(e.x, e.holder.position.y + 1.3, e.z); const dir = V3(player.x - from.x, camY - .3 - from.y, player.z - from.z).normalize();
    const mesh = new THREE.Mesh(WAVE_GEO, slashMat(0xc050ff)); mesh.material.uniforms.prog.value = 1.3; mesh.scale.setScalar(2.4); mesh.rotation.order = 'YXZ'; mesh.rotation.y = Math.atan2(dir.x, dir.z); mesh.rotation.z = .6; mesh.position.copy(from); scene.add(mesh);
    addFx(null, .5, (kk) => { mesh.position.addScaledVector(dir, 34 * (1 / 60)); emit(mesh.position.x, mesh.position.y, mesh.position.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0xc070ff, .8, .4, 0); }).end = () => scene.remove(mesh);
  });
  once('hit', 2.95, () => {
    flashScreen('#f0d8ff', .95, 1.2); shake = 1.4; sfx('boom'); sfx('hurt');
    screenNum('-' + player.maxHp, 'hurt big', innerWidth * .5 - 40, innerHeight * .4); player.hp = 0; hudDirty = true;
    $('vign').style.opacity = 1;
    // sword knocked away
    swordInHand = false; lostSword = buildSword({ scale: 1.2 }); lostSword.bladeM.emissive.set(0x66ccff); lostSword.bladeM.emissiveIntensity = .6; scene.add(lostSword.g);
    const sp = V3(player.x, camY - .3, player.z).addScaledVector(fwd(), .8); const sv = fwd().multiplyScalar(-3).add(rightV().multiplyScalar(4)).add(V3(0, 7, 0));
    addFx(null, 2.4, (kk, ddt) => { sv.y -= 14 * ddt; sp.addScaledVector(sv, ddt); if (sp.y < .1) { sp.y = .1; sv.set(0, 0, 0); } lostSword.g.position.copy(sp); lostSword.g.rotation.x += ddt * (sv.lengthSq() > .1 ? 14 : 0); lostSword.g.rotation.z = 1.4; });
    burst(V3(player.x, camY - .3, player.z).addScaledVector(fwd(), 1), 60, 0xd080ff, 9, .7, .8, -4);
    playVM('fallen', 1.0, [R_IDLE, RK(1, [.3, -.75, -.4], [.3, .4, -.8], [.4, -.6, .6])], [L_IDLE, LK(1, [-.3, -.8, -.4], [.1, .2, -1], [0, .6, .72])]); VM.hold = true;
  });
  if (t > 2.95) { const kk = smooth(2.95, 4.3, t); camDrop = kk * 1.32; camRoll = kk * 1.15; player.pitch = lerp(player.pitch, .32, dt * 1.5); $('c').style.filter = `grayscale(${(kk * .75).toFixed(2)}) brightness(${(1 - kk * .25).toFixed(2)})`; e.cutLift = lerp(e.cutLift, .4, dt * 2); if (t > 3.6) setPose(e, 'idle', 2); }
  once('l3', 3.7, () => sub('李白', '师兄……你……'));
  once('fade', 5.0, () => { $('fade').style.transition = 'opacity 1.4s'; $('fade').style.opacity = 1; });
  once('story', 6.6, () => startStory());
}
/* ===== black screen story + naming ===== */
const STORY = '李白剑仙陨落之后，一位普通的剑修将接替他的使命。';
let storyTimer = null;
function startStory() {
  state = 'story'; document.body.className = 'm-story'; $('sub').classList.remove('show');
  $('fade').style.transition = 'none'; $('fade').style.opacity = 1;
  const st = $('story'); st.style.display = 'flex'; const tx = $('storytxt'); tx.textContent = ''; $('storynext').style.visibility = 'hidden';
  let i = 0; clearInterval(storyTimer);
  storyTimer = setInterval(() => { i++; tx.textContent = STORY.slice(0, i); if (i >= STORY.length) { clearInterval(storyTimer); setTimeout(() => { $('storynext').style.visibility = 'visible'; }, 500); } }, 90);
}
function storyTap() { if (state !== 'story') return; const tx = $('storytxt'); if (tx.textContent.length < STORY.length) { clearInterval(storyTimer); tx.textContent = STORY; $('storynext').style.visibility = 'visible'; return; } showNameBox(); }
function showNameBox() { state = 'name'; $('story').style.display = 'none'; $('namebox').style.display = 'flex'; const inp = $('nm'); inp.value = '无名剑修'; }
function confirmName() { const v = ($('nm').value || '').trim().slice(0, 8) || '无名剑修'; $('nm').blur(); $('namebox').style.display = 'none'; newCareer(v); }
/* ===== save (localStorage) ===== */
const SAVE_KEY = 'jianxianzhidao_save';
function saveGame() {
  if (player.name === '李白') return false;
  const d = { v: 3, name: player.name, lv: player.lv, xp: player.xp, stage: 'valley', unlocked: player.unlocked.slice(), wine: player.wine, wineMax: player.wineMax, wins: player.wins || 0, time: Date.now() };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
}
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && d.name && d.lv >= 1) return d; } catch (e) { } return null; }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
function applySave(d) { player.name = d.name; player.lv = clamp(d.lv | 0, 1, 100); player.xp = Math.max(0, d.xp | 0); player.unlocked = Array.isArray(d.unlocked) ? d.unlocked.filter(x => ALL_ST.includes(x)) : []; player.wineMax = Math.max(1, d.wineMax | 0 || 2); player.wine = clamp(d.wine ?? player.wineMax, 0, player.wineMax); player.wins = d.wins | 0; }
function newCareer(name) {
  player.name = name || '无名剑修'; player.lv = 1; player.xp = 0; player.unlocked = []; player.wineMax = 2; player.wine = 2; player.wins = 0;
  saveGame(); startValley();
}
/* ===== valley fight ===== */
function startValley(opt = {}) {
  initAudio();
  hideGuide(); tut.cur = null; $('skip').style.display = 'none';
  mode = 'valley'; state = 'play'; setWorld('valley'); clearFx(); clearProj(); resetSkills();
  $('c').style.filter = ''; camDrop = 0; camRoll = 0; $('vign').style.opacity = 0; timeScale = 1; if (lostSword) { scene.remove(lostSword.g); lostSword = null; }
  if (typeof opt === 'string') { player.name = opt; player.lv = 1; player.xp = 0; player.unlocked = []; player.wineMax = 2; opt = {}; }
  recalc(); player.hp = player.maxHp; if (!opt.keepWine) player.wine = player.wineMax; player.minHpFrac = 0; player.dead = false; player.lastHurt = -99;
  setOutfit(0x3c4a5e, 0x9aa8b8); $('avatar').textContent = '剑'; hudDirty = true;
  placePlayer(world.spawn);
  shixiong.holder.visible = false; enemies.length = 0; enemies.push(zheng);
  initTough(zheng, ZHENG.tough, 2); parryCount = 0; rideRams = 0;
  Object.assign(zheng, { hold: false, maxHp: ZHENG.hp, hp: ZHENG.hp, x: 0, z: -11, yaw: 0, dead: false, deadT: 0, act: null, ai: false, introDone: false, enraged: false, cd: 2, stagger: 0 });
  zheng.model.root.rotation.z = 0; zheng.model.root.position.y = 0; zheng.model.tails.forEach(t => t.fl.visible = true); zheng.holder.visible = true;
  Object.assign(zheng.an, { crouch: 0, pitch: 0, head: 0, jaw: 0, leap: 0, gallop: 0, rear: 0 });
  document.body.className = 'm-valley'; $('dead').style.display = 'none'; $('win').style.display = 'none'; $('story').style.display = 'none';
  $('fade').style.transition = 'opacity 1.2s'; requestAnimationFrame(() => $('fade').style.opacity = 0);
  valleyT = 0; fightStart = gameT;
  banner('第一战 · 幽谷', '击败山海异兽「狰」', 3);
  setTimeout(() => { if (mode === 'valley' && state === 'play') toast('留意地面红色预警：闪避，或在命中前按「格挡」'); }, 3200);
}
function updateValley(dt) {
  valleyT += dt; const z = zheng;
  if (!z.introDone && valleyT > 1.4) { z.introDone = true; startZhengAct(z, 'intro'); }
  else if (z.introDone && !z.ai && !z.act && !z.dead && !z.hold) { z.ai = true; z.cd = .8; }
}
function onZhengDeath(e) {
  e.ai = false; e.act = null; timeScale = .35; sfx('roar');
  setTimeout(() => { timeScale = 1; }, 1100);
  setTimeout(() => showVictory(), 2300);
}
function showVictory() {
  if (mode !== 'valley') return;
  state = 'win'; $('banner').style.opacity = 0; bannerT = 0; const secs = Math.round(gameT - fightStart);
  const lv0 = player.lv; player.wins = (player.wins || 0) + 1; gainXp(320); saveGame();
  $('wintxt').textContent = `${player.name} 斩杀了山海异兽 · 狰`;
  $('winstats').innerHTML = `用时 <b>${Math.floor(secs / 60)}分${String(secs % 60).padStart(2, '0')}秒</b>　剩余气血 <b>${Math.ceil(player.hp)}</b>　经验 <b>+320</b>` + (player.lv > lv0 ? `<br>等级提升至 <b>Lv${player.lv}</b> · 气血上限 <b>${player.maxHp}</b>` : '');
  $('win').style.display = 'flex'; sfx('win'); document.body.classList.add('won');
}
function gainXp(x) { player.xp += x; let up = false; while (player.lv < 100 && player.xp >= needXp(player.lv)) { player.xp -= needXp(player.lv); player.lv++; up = true; recalc(); player.hp = player.maxHp; } hudDirty = true; if (up && mode === 'valley') saveGame(); }
function playerDie() {
  player.dead = true; if (player.riding) endRide(); resetSkills(); swordInHand = true;
  setTimeout(() => { if (player.dead && mode === 'valley') { state = 'dead'; $('dead').style.display = 'flex'; } }, 1200);
}

/* ---------------- input ---------------- */
const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0, R: 50, half: 60 };
let camPtr = null, camLast = null;
const joyEl = $('joy'), knob = $('joyknob'), touchEl = $('touch');
function joyHome() { joyEl.style.left = ''; joyEl.style.top = ''; knob.style.transform = ''; joyEl.classList.remove('active'); layoutJoy(); }
touchEl.addEventListener('pointerdown', e => {
  e.preventDefault(); if (state !== 'play') return;
  const W = innerWidth, Hh = innerHeight;
  if (joy.id === null && e.clientX < W * .42 && e.clientY > Hh * .5) {
    joy.id = e.pointerId; const half = joy.half;
    joy.cx = clamp(e.clientX, half + 6, W * .36); joy.cy = clamp(e.clientY, Hh - half - 6 - 14 * uScale, Hh - half - 6);
    joyEl.style.left = (joy.cx - half) + 'px'; joyEl.style.top = (joy.cy - half) + 'px'; joyEl.classList.add('active');
    moveJoy(e);
  } else if (camPtr === null) { camPtr = e.pointerId; camLast = { x: e.clientX, y: e.clientY }; }
  try { touchEl.setPointerCapture(e.pointerId); } catch (_) { }
}, { passive: false });
function moveJoy(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy); if (d > joy.R) { dx *= joy.R / d; dy *= joy.R / d; } joy.x = dx / joy.R; joy.y = dy / joy.R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
touchEl.addEventListener('pointermove', e => {
  e.preventDefault();
  if (e.pointerId === joy.id) moveJoy(e);
  else if (e.pointerId === camPtr && camLast) { const dx = e.clientX - camLast.x, dy = e.clientY - camLast.y; camLast = { x: e.clientX, y: e.clientY }; if (state !== 'play') return; const s = 4.2 / Math.max(innerWidth, 600); player.yaw -= dx * s; yawVel = dx * s / (1 / 60); player.pitch = clamp(player.pitch - dy * s * .8, -1.15, .7); tut.looked += Math.abs(dx * s) + Math.abs(dy * s * .8); }
}, { passive: false });
function endPtr(e) { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyHome(); } if (e.pointerId === camPtr) { camPtr = null; camLast = null; } }
touchEl.addEventListener('pointerup', endPtr); touchEl.addEventListener('pointercancel', endPtr); touchEl.addEventListener('lostpointercapture', endPtr);
function bindBtn(id, skill) {
  const el = $(id);
  if (skill === 'jianyu') { // press-and-drag aiming
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('down');
      if (canAct() && hasSt('jianyu') && SK.jianyu.t <= 0 && !player.riding && !wj.active && !jyAim.on) { jyAimStart(e.pointerId, e.clientX, e.clientY); try { el.setPointerCapture(e.pointerId); } catch (_) { } }
      else tryCast('jianyu'); }, { passive: false });
    el.addEventListener('pointermove', e => { if (jyAim.on && e.pointerId === jyAim.id) { e.preventDefault(); jyAimMove(e.clientX, e.clientY); } }, { passive: false });
    el.addEventListener('pointerup', e => { el.classList.remove('down'); if (jyAim.on && e.pointerId === jyAim.id) { jyAimMove(e.clientX, e.clientY); jyAimEnd(false); } });
    el.addEventListener('pointercancel', e => { el.classList.remove('down'); if (jyAim.on && e.pointerId === jyAim.id) jyAimEnd(true); });
    return;
  }
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('down'); if (skill === 'atk') atkHeld = true; tryCast(skill); }, { passive: false });
  const up = () => { el.classList.remove('down'); if (skill === 'atk') atkHeld = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
const BTN = { atk: 'btn-atk', s1: 'btn-s1', s2: 'btn-s2', block: 'btn-block', ride: 'btn-ride', wine: 'wine', dahe: 'st-dahe', wanjian: 'st-wanjian', jianyu: 'st-jianyu', yinshen: 'st-yinshen', hudun: 'st-hudun' };
for (const k in BTN) bindBtn(BTN[k], k);
const btnEls = {}; for (const k in BTN) btnEls[k] = $(BTN[k]);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
const keys = {};
addEventListener('keydown', e => { if (state === 'name') return; keys[e.code] = true; const map = { KeyJ: 'atk', Space: 'atk', Digit1: 's1', Digit2: 's2', Digit3: 'block', KeyR: 'ride', KeyQ: 'wine', KeyZ: 'dahe', KeyX: 'wanjian', KeyC: 'jianyu', KeyV: 'yinshen', KeyB: 'hudun' }; if (map[e.code]) tryCast(map[e.code]); });
addEventListener('keyup', e => keys[e.code] = false);
$('skip').addEventListener('click', e => { e.stopPropagation(); skipTutorial(); });
$('gnext').addEventListener('click', e => { e.stopPropagation(); if (tut.cur && tut.cur.next) completeStep(); });
$('story').addEventListener('click', storyTap);
$('nmok').addEventListener('click', confirmName);
$('nm').addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });
$('retry').addEventListener('click', () => startValley());
$('again').addEventListener('click', () => { document.body.classList.remove('won'); startValley(); });
$('totitle').addEventListener('click', () => location.reload());

/* ---------------- HUD ---------------- */
let uScale = 1, hudBossName = '';
function layoutJoy() { const u = uScale, sz = 120 * u; joyEl.style.width = joyEl.style.height = sz + 'px'; joy.half = sz / 2; joy.R = 46 * u; if (joy.id === null) { joyEl.style.left = (22 * u) + 'px'; joyEl.style.top = (innerHeight - 10 * u - sz) + 'px'; } }
function layout() {
  const W = innerWidth, Hh = innerHeight;
  renderer.setSize(W, Hh, false); camera.aspect = W / Hh; camera.updateProjectionMatrix(); vCam.aspect = W / Hh; vCam.updateProjectionMatrix();
  pMat.uniforms.scale.value = Hh * renderer.getPixelRatio() * .9;
  const u = uScale = Math.min(Hh / 390, W / 844 * 1.1, 1.35);
  document.documentElement.style.setProperty('--u', u);
  const place = (el, cx, cy, sz) => { el.style.width = el.style.height = sz + 'px'; el.style.left = (cx - sz / 2) + 'px'; el.style.top = (cy - sz / 2) + 'px'; };
  const A = 88 * u, S = 60 * u, R = A / 2 + S / 2 + 22 * u;
  const ax = W - 34 * u - A / 2, ay = Hh - 26 * u - A / 2;
  place(btnEls.atk, ax, ay, A);
  [[btnEls.s1, 186], [btnEls.s2, 136], [btnEls.block, 88]].forEach(([el, deg]) => { const r = deg * Math.PI / 180; place(el, ax + Math.cos(r) * R, ay - Math.sin(r) * R, S); });
  place(btnEls.ride, W / 2, Hh - 18 * u - S * .5, S * .95);
  layoutJoy();
  const jcx = 22 * u + 60 * u;
  place(btnEls.wine, jcx - 2 * u, Hh - 10 * u - 120 * u - 34 * u, 58 * u);
  const cx = 212 * u, cy = Hh - 200 * u, arm = 57 * u, s = 46 * u;
  place(btnEls.dahe, cx, cy, 58 * u); place(btnEls.wanjian, cx, cy - arm, s); place(btnEls.hudun, cx, cy + arm, s); place(btnEls.jianyu, cx - arm, cy, s); place(btnEls.yinshen, cx + arm, cy, s);
  const cr = $('crossbg'); place(cr, cx, cy, 2 * arm + s + 18 * u);
  const lb = $('crosslbl'); lb.style.left = (cx - arm - s / 2 - 6 * u) + 'px'; lb.style.top = (cy - arm - s / 2 + 2 * u) + 'px';
  positionHighlight();
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 200));
function updateHUD() {
  for (const id in SK) {
    const s = SK[id], el = btnEls[id]; if (!el) continue; const cd = el.querySelector('.cd'); if (!cd) continue;
    if (s.t > 0 && id !== 'atk' && id !== 'wine') { el.classList.add('cooling'); cd.style.setProperty('--p', (s.t / s.cd).toFixed(3)); cd.textContent = s.t >= 1 ? Math.ceil(s.t) : s.t.toFixed(1); }
    else el.classList.remove('cooling');
  }
  btnEls.hudun.classList.toggle('active', !!SK.hudun.active); btnEls.wanjian.classList.toggle('active', wj.active);
  const lock = !swordInHand && !player.riding;
  for (const id of ['atk', 's1', 'block']) btnEls[id].classList.toggle('lock', lock);
  btnEls.ride.classList.toggle('on', player.riding);
  if (player.riding) btnEls.ride.querySelector('.dur').style.setProperty('--q', (player.rideT / RIDE_DUR).toFixed(3));
  document.body.classList.toggle('stlock', player.unlocked.length === 0);
  for (const id of ALL_ST) btnEls[id].classList.toggle('lk1', player.unlocked.length > 0 && !hasSt(id));
  if (player.stealthT > 0) $('stealthtxt').textContent = `隐身中 ${player.stealthT.toFixed(1)}s · 现身首击伤害翻倍`;
  const be = enemies[0];
  if (be) { const r = be.hp / be.maxHp; $('bossfill').style.width = (r * 100) + '%'; $('bosstxt').textContent = be.kind === 'zheng' ? `${Math.ceil(be.hp)}/${be.maxHp}` : `${Math.ceil(r * 100)}%`; const nm = `${be.name}<small>Lv${be.lvTxt}</small>`; if (nm !== hudBossName) { hudBossName = nm; $('bossname').innerHTML = nm; }
    const tb = $('tbar'); tb.style.display = be.tough ? 'block' : 'none';
    if (be.tough) { const tr = be.broken ? 0 : be.T / be.Tmax; $('tfill').style.width = (tr * 100).toFixed(1) + '%'; const st = be.broken ? (be.brkT > 0 ? 'brk stag' : 'brk') : ''; if (tb.dataset.st !== st) { tb.dataset.st = st; tb.className = 'tbar ' + st; }
      const ph = be.phases > 1 ? ` · ${PHASE_CN[be.phase]}` : ''; const tx = be.broken ? `已破防${ph}` : `韧性${ph}  ${Math.ceil(be.T)}/${be.Tmax}`; if ($('ttxt').textContent !== tx) $('ttxt').textContent = tx;
      const pp = $('tphase'); const pt = be.phases > 1 ? Array.from({ length: be.phases }, (_, i) => `<i class="${i < be.phase - 1 || (i === be.phase - 1 && be.broken) ? 'used' : i === be.phase - 1 ? 'cur' : ''}"></i>`).join('') : ''; if (pp.innerHTML !== pt) pp.innerHTML = pt; } }
  if (hudDirty) {
    hudDirty = false;
    $('pname').textContent = player.name; $('lvnum').textContent = player.lv;
    const need = needXp(player.lv); $('xpfill').style.width = (player.lv >= 100 ? 100 : player.xp / need * 100) + '%'; $('xptxt').textContent = player.lv >= 100 ? '已满级' : `${player.xp}/${need}`;
    const r = clamp(player.hp / player.maxHp, 0, 1);
    $('hpfill').style.width = (r * 100) + '%'; $('hpghost').style.width = (r * 100) + '%';
    $('hptxt').textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    $('hpbar').classList.toggle('low', r < .3);
    const sr = player.shield / player.shieldMax; $('shfill').style.width = (sr * 100) + '%'; $('shield').style.display = player.shield > 0 ? 'flex' : 'none'; $('shtxt').textContent = `护盾 ${Math.ceil(player.shield)}`;
    $('winecnt').textContent = `${player.wine}/${player.wineMax}`; btnEls.wine.classList.toggle('empty', player.wine <= 0);
    const pips = $('winepips'); pips.innerHTML = ''; for (let i = 0; i < player.wineMax; i++) { const p = document.createElement('i'); if (i < player.wine) p.className = 'on'; pips.appendChild(p); }
  }
  // warning marker over enemy
  const we = enemies.find(e => e.warnT > 0 && !e.dead), wel = $('warn');
  if (we) { const s = project(V3(we.x, we.holder.position.y + we.height + .5, we.z)); if (s) { wel.style.display = 'block'; wel.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`; } else wel.style.display = 'none'; } else wel.style.display = 'none';
}

/* ---------------- main update ---------------- */
function update(dtR) {
  const dt = dtR * timeScale;
  gameT += dt; timeU.value = gameT;
  world.update(dt);
  for (const id in SK) if (!(id === 'hudun' && SK.hudun.active) && !(id === 'wanjian' && wj.active)) SK[id].t = Math.max(0, SK[id].t - dt);
  player.blockT = Math.max(0, player.blockT - dt); player.ambushT = Math.max(0, player.ambushT - dt);
  tickCastQ(dtR);
  if (player.stealthT > 0) { player.stealthT -= dt; if (player.stealthT <= 0) { player.stealthT = 0; endStealth(false); } }
  // movement
  let jx = joy.x, jy = joy.y;
  if (keys.KeyW) jy = -1; if (keys.KeyS) jy = 1; if (keys.KeyA) jx = -1; if (keys.KeyD) jx = 1;
  if (keys.ArrowLeft) player.yaw += dt * 2; if (keys.ArrowRight) player.yaw -= dt * 2;
  const mag = Math.min(1, Math.hypot(jx, jy));
  let moving = false;
  const ox = player.x, oz = player.z;
  if (state === 'play' && !player.dead) {
    if (mag > .08) {
      const f = fwd(), r = rightV();
      const dir = f.multiplyScalar(-jy).add(r.multiplyScalar(jx)); if (dir.lengthSq() > 1) dir.normalize();
      const sp = (player.riding ? 15 : (jy > .3 ? 4.2 : 6.2)) * (wj.active ? .55 : 1);
      player.x += dir.x * sp * dt; player.z += dir.z * sp * dt; moving = true;
    }
    if (player.dashT > 0) { player.dashT -= dt; player.x += player.dashV.x * dt; player.z += player.dashV.z * dt; if (Math.random() < .9) emit(player.x + rand(-1, 1), camY + rand(-1, .5), player.z + rand(-1, 1), -player.dashV.x * .3, 0, -player.dashV.z * .3, 0xbff4ff, .15, .25, 0); }
    const R = world.R, rr = Math.hypot(player.x, player.z); if (rr > R) { player.x *= R / rr; player.z *= R / rr; }
    for (const c of world.cols || []) { const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz), mn = c.r + .45; if (d < mn && d > 1e-4) { player.x = c.x + dx / d * mn; player.z = c.z + dz / d * mn; } }
    if (H(player.x, player.z) < -1.15) { player.x = ox; player.z = oz; }
    for (const m of liveEnemies()) { const dx = player.x - m.x, dz = player.z - m.z, d = Math.hypot(dx, dz), mn = m.radius + .7; if (d < mn && d > 1e-3) { player.x = m.x + dx / d * mn; player.z = m.z + dz / d * mn; } }
    if (mode === 'tutorial') tut.moved += Math.hypot(player.x - ox, player.z - oz) * (moving ? 1 : 0);
  }
  player.moveAmt += ((moving ? mag : 0) - player.moveAmt) * Math.min(1, dt * 8);
  player.bob += dt * (player.riding ? 4 : 9) * player.moveAmt;
  if (player.riding) { player.rideT -= dt; if (player.rideT <= 0) endRide(); }
  if (state === 'play' && !player.dead && player.hp < player.maxHp) { const idle = gameT - player.lastHurt; if (mode === 'valley' ? idle > 8 : idle > 4) { player.hp = Math.min(player.maxHp, player.hp + (mode === 'valley' ? player.maxHp * .003 : player.maxHp * .02) * dt); hudDirty = true; } }
  if (atkHeld) tryCast('atk');
  // camera
  const gh = Math.max(H(player.x, player.z), -.6);
  const tY = (player.riding ? gh + 2.45 : gh + 1.7) + (moving && !player.riding ? Math.abs(Math.sin(player.bob)) * .05 : 0) - camDrop;
  camY += (tY - camY) * Math.min(1, dt * (player.riding ? 6 : 14));
  yawVel *= Math.pow(.001, dt);
  shake = Math.max(0, shake - dt * 1.2);
  camera.position.set(player.x + (Math.random() - .5) * shake * .35, camY + (Math.random() - .5) * shake * .35, player.z);
  rideTilt += ((player.riding ? -.24 : 0) - rideTilt) * Math.min(1, dt * 3);
  camera.rotation.set(player.pitch + rideTilt, player.yaw, (player.riding ? -clamp(jx, -1, 1) * .06 : 0) + camRoll);
  fovKick = Math.max(0, fovKick - dt * 40);
  camera.fov += ((player.riding && moving ? 82 : 70) + fovKick - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  if (player.riding) {
    rideSword.g.rotation.set(-Math.PI / 2, player.yaw, 0, 'YXZ');
    const f = fwd(); rideSword.g.position.set(player.x + f.x * .25, camY - 1.72 + Math.sin(gameT * 3) * .03, player.z + f.z * .25);
    const tail = V3(player.x - f.x * .8, camY - 1.72, player.z - f.z * .8);
    for (let i = 0; i < 2; i++) emit(tail.x + rand(-.15, .15), tail.y, tail.z + rand(-.15, .15), -f.x * 2 + rand(-.3, .3), rand(-.2, .2), -f.z * 2 + rand(-.3, .3), 0x9fe8ff, .25, .6, 0);
  }
  updateRideRam(); updateJyAim();
  for (const e of enemies.slice()) {
    if (e.slowT > 0) { e.slowT -= dt; if (!e.dead && Math.random() < .5) emit(e.x + rand(-1, 1) * e.radius, H(e.x, e.z) + rand(0, e.height), e.z + rand(-1, 1) * e.radius, 0, -.6, 0, 0x8fd8ff, .3, .5, 0); }
    const edt = dt * (e.slowT > 0 && !e.dead ? (e.boss ? .65 : .45) : 1);
    preDisplace(e, dt); updateTough(e, dt); e.update(edt); postDisplace(e, dt);
  }
  if (mode === 'tutorial' && shixiong.cutLift) shixiong.holder.position.y += shixiong.cutLift;
  updateProj(dt); updateFly(dt); updateUlt(dt); updateWanjian(dt); updateZones(dt); updateOrb(dt); updateDecoy(dt);
  updateFx(dt); updateParticles(dt); updateNums(dtR); updateSNums(dtR);
  updateVM(dt); updateHUD();
  if (state === 'play' && mode === 'tutorial') updateTutorial(dtR);
  if (state === 'play' && mode === 'valley') updateValley(dt);
  if (state === 'cut') updateCut(dt);
  if (bannerT > 0) { bannerT -= dtR; if (bannerT <= 0) $('banner').style.opacity = 0; }
  if (toastT > 0) { toastT -= dtR; if (toastT <= 0) $('toast').style.opacity = 0; }
}
function titleUpdate(dt) {
  gameT += dt; timeU.value = gameT; world.update(dt);
  const a = gameT * .05; player.x = Math.sin(a) * 9; player.z = Math.cos(a) * 9 - 2; camY = 2.2;
  camera.position.set(player.x, camY, player.z); camera.rotation.set(-.02, Math.atan2(-(shixiong.x - player.x), -(shixiong.z - player.z)) + .25, 0); camera.fov = 70; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  shixiong.ai = false; shixiong.update(dt); updateParticles(dt); updateFx(dt);
  vRoot.visible = false;
}
function render() { renderer.clear(); renderer.render(scene, camera); if (state !== 'title' && state !== 'story' && state !== 'name') { renderer.clearDepth(); renderer.render(vScene, vCam); } }
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (window.__freeze) { }
  else if (state === 'title') titleUpdate(dt);
  else if (state === 'play' || state === 'cut' || state === 'win' || state === 'dead') update(dt);
  else { gameT += dt; timeU.value = gameT; }
  render();
}
setWorld('cloud'); enemies.push(shixiong); recalc(); layout(); hudDirty = true; updateHUD();
document.body.className = 'm-title';
function goFull() { const de = document.documentElement; try { if (de.requestFullscreen && !/Headless/.test(navigator.userAgent)) de.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (_) { } }
function refreshTitle() {
  const d = loadSave();
  $('go').style.display = d ? 'none' : 'inline-block'; $('cont').style.display = d ? 'inline-block' : 'none'; $('restart').style.display = d ? 'inline-block' : 'none';
  $('saveinfo').style.display = d ? 'block' : 'none';
  if (d) $('saveinfo').textContent = `存档：剑修「${d.name}」 · Lv${d.lv} · 第一战 · 幽谷`;
}
refreshTitle();
$('go').addEventListener('click', () => { initAudio(); $('start').style.display = 'none'; goFull(); startTutorial(); });
$('cont').addEventListener('click', () => { const d = loadSave(); if (!d) { refreshTitle(); return; } initAudio(); $('start').style.display = 'none'; goFull(); applySave(d); startValley({ keepWine: true }); });
$('restart').addEventListener('click', () => { const d = loadSave(); $('cfmtxt').textContent = d ? `重新开始将清除剑修「${d.name}」（Lv${d.lv}）的存档，并从序章教程开始。确定吗？` : '确定重新开始吗？'; $('confirm').style.display = 'flex'; });
$('cfmno').addEventListener('click', () => { $('confirm').style.display = 'none'; });
$('cfmyes').addEventListener('click', () => { $('confirm').style.display = 'none'; wipeSave(); refreshTitle(); initAudio(); $('start').style.display = 'none'; goFull(); startTutorial(); });
requestAnimationFrame(frame);
// debug / test hooks
window.__G = { renderer, camera, vCam, vRoot, rHand, lHand, player, enemies, shixiong, zheng, SK, tryCast, tut, VM, wj, zones, decoy, ult, fly, cut,
  get state() { return state; }, get mode() { return mode; }, get camY() { return camY; }, set timeScale(v) { timeScale = v; },
  step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { if (state === 'title') titleUpdate(dt); else if (state === 'play' || state === 'cut' || state === 'win' || state === 'dead') update(dt); } },
  start() { $('go').click(); }, next() { completeStep(); }, skip() { skipTutorial(); }, valley(n) { startValley(n || '测试剑修'); },
  resetCd() { for (const k in SK) SK[k].t = 0; }, TUNE, ZHENG, FLY, JY, jyAim, spawnMinion, saveGame, loadSave, wipeSave, newCareer, startValley, hitEnemy, get parryCount() { return parryCount; }, get rideRams() { return rideRams; }, get jyTarget() { return jyTarget; }, tp(x, z, yaw) { player.x = x; player.z = z; if (yaw !== undefined) player.yaw = yaw; camY = H(x, z) + 1.7; },
  face(e, d) { const a = Math.atan2(player.x - e.x, player.z - e.z); player.yaw = Math.atan2(-(e.x - player.x), -(e.z - player.z)); },
  pose(rk, lk, lmode) { playVM('test', 1e9, rk ? [rk, rk] : null, lk ? [lk, lk] : null, [], lmode || 'jz'); VM.hold = true; }, RK, LK, LF, setWorld, startZhengAct, startShixiongAct, hurtPlayer };
