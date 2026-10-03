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

/* ===== humanoid sword immortal (used for 魔神 and the decoy) ===== */
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
    breakMin: 7, breakMax: 10, refillT: 5, minMult: .2, maxMult: .85, parryStagger: .9 }, // v3c: no idle regen; break → 7–10s stagger (100% dmg) → 5s refill
};
const ALL_ST = ['dahe', 'wanjian', 'jianyu', 'yinshen', 'hudun'];
const player = { x: 0, z: 7, yaw: 0, pitch: -.04, lv: 90, xp: 0, hp: 1980, maxHp: 1980, atk: 279, name: '仙尊', dead: false, riding: false, rideT: 0, lastHurt: -99, moveAmt: 0, bob: 0,
  wine: 2, wineMax: 2, shield: 0, shieldMax: 200, blockT: 0, stealthT: 0, ambushT: 0, unlocked: ALL_ST.slice(), rideOK: true, minHpFrac: 0, dashT: 0, dashV: V3(), slow: 1 };
const hasSt = id => player.unlocked.includes(id);
let rideTilt = 0, camY = 1.7, gameT = 0, state = 'title', mode = 'tutorial', shake = 0, yawVel = 0, hudDirty = true, camRoll = 0, camDrop = 0, fovKick = 0, timeScale = 1;
const needXp = l => Math.round(30 * Math.pow(l, 1.5) + 40);
function recalc() { const L = player.lv - 1; player.maxHp = TUNE.hp0 + TUNE.hpLv * L + 10 * ((player.pages && player.pages.length) || 0) + (player.hpBonus || 0); if (player.eq && player.eq.gourd && typeof ITEMS !== 'undefined' && ITEMS[player.eq.gourd]) { player.wineMax = ITEMS[player.eq.gourd].drinks; if (player.wine > player.wineMax) player.wine = player.wineMax; } player.atk = Math.round(TUNE.atk0 + TUNE.atkLv * L); player.shieldMax = Math.round(player.maxHp * TUNE.shieldFrac); }
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
function initTough(e, max = TUNE.tough.max) { e.tough = true; e.Tmax = max; e.T = max; e.broken = false; e.refill = false; e.brkT = 0; e.brkDur = 0; e.lastHitT = -99; e.breaks = 0; }
function toughMult(e) { if (!e.tough) return 1; if (e.broken) return 1; const f = clamp(e.T / e.Tmax, 0, 1); return TUNE.tough.minMult + (TUNE.tough.maxMult - TUNE.tough.minMult) * (1 - f); }
function cancelAct(e) { if (e.onInterrupt) e.onInterrupt(); else e.act = null; e.warnT = 0; }
function endBreak(e) { if (!e.broken) return; e.broken = false; e.refill = true; e.brkT = 0; e.stagger = Math.min(e.stagger || 0, .2); }
function breakBoss(e) {
  e.broken = true; e.refill = false; e.T = 0; e.brkDur = e.brkT = rand(TUNE.tough.breakMin, TUNE.tough.breakMax); e.breaks++;
  cancelAct(e); e.stagger = Math.max(e.stagger || 0, e.brkT);
  const el = $('breakfx'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sfx('boom'); sfx('clang'); shake = Math.max(shake, .45); flashScreen('#ffd8a0', .4, .5);
  shockRing(V3(e.x, H(e.x, e.z), e.z), 0xffb030, .6, 5, .7); burst(eCenter(e), 60, 0xffc040, 9, .6, .8, -6);
  showNum(V3(e.x, e.y + e.height + .6, e.z), '破防', 'brk');
}
function updateTough(e, dt) {
  if (!e.tough || e.dead) return;
  if (e.refill) { e.T += e.Tmax / TUNE.tough.refillT * dt; if (e.T >= e.Tmax) { e.T = e.Tmax; e.refill = false; } }
  if (e.broken) { e.brkT -= dt; if (e.brkT <= 0) { endBreak(e); return; } e.stagger = Math.max(e.stagger, .05); if (Math.random() < .5) emit(e.x + rand(-1, 1), e.y + e.height + rand(0, .6), e.z + rand(-1, 1), 0, 1.2, 0, 0xffd060, .35, .6, 0); }
}
/* ===== displacement (knock-up / knock-back) — never applied to bosses ===== */
function knockBack(e, fx, fz, dist, dur = .3) { if (e.boss || e.dead) return; const dx = e.x - fx, dz = e.z - fz, d = Math.hypot(dx, dz) || 1; e.kbV = V3(dx / d * dist / dur, 0, dz / d * dist / dur); e.kbT = dur; e.stagger = Math.max(e.stagger || 0, dur + .25); }
function knockUp(e, h, dur) { if (e.boss || e.dead) return; e.airH = h; e.airDur = dur; e.airT = dur; e.stagger = Math.max(e.stagger || 0, dur + .3); if (e.act) cancelAct(e); }
function preDisplace(e, dt) { if (e.kbT > 0) { e.kbT -= dt; e.x += e.kbV.x * dt; e.z += e.kbV.z * dt; const R = world.R - 1, r = Math.hypot(e.x, e.z); if (r > R) { e.x *= R / r; e.z *= R / r; } if (Math.random() < .6) emit(e.x + rand(-.4, .4), H(e.x, e.z) + .1, e.z + rand(-.4, .4), 0, 1, 0, 0xc8b898, .5, .5, -2); } }
function postDisplace(e, dt) { if (e.airT > 0) { e.airT = Math.max(0, e.airT - dt); const k = 1 - e.airT / e.airDur; e.airY = Math.sin(k * Math.PI) * e.airH; if (e.airT <= 0) { e.airY = 0; burst(V3(e.x, H(e.x, e.z) + .2, e.z), 18, 0xc8b898, 4, .6, .6, -4); sfx('stone'); } } if (e.airY && e.airT > 0 && e.airDur > 0) { if (!e.selfAir) e.holder.position.y += e.airY; e.holder.rotation.x = Math.sin((1 - e.airT / e.airDur) * Math.PI) * -.5; } else if (e.holder.rotation.x !== 0) e.holder.rotation.x = 0; }
function hitEnemy(e, base, kind, td = 0) {
  if (e.dead || e.invuln) return 0;
  let amb = false;
  if (player.ambushT > 0 && kind !== 'tick') { amb = true; player.ambushT = 0; base *= TUNE.mult.ambush; td *= TUNE.mult.ambush; }
  const tm = toughMult(e);
  const crit = Math.random() < .15; let d = Math.round(base * (crit ? 1.8 : 1) * rand(.92, 1.08) * (e.armor || 1) * tm);
  d = Math.max(1, d);
  const before = e.hp; e.hp = Math.max(e.floorHp || 0, e.hp - d);
  e.flash = 1; e.onHit && e.onHit(kind, d);
  if (e.tough) { e.lastHitT = gameT; if (!e.broken && !e.refill && td > 0) { e.T = Math.max(0, e.T - td); if (e.T <= 0 && e.hp > 0) breakBoss(e); } }
  const np = V3(e.x, e.y + e.height * .85 + (e.airY || 0), e.z);
  if (e.noNum) { } else if (amb) { showNum(np, '破隐一击 ' + d, 'amb'); sfx('clang'); flashScreen('#cff4ff', .3, .3); }
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
      if (hitP) { const sh0 = player.shield, hr = hurtPlayer(p.dmg, p.pos); if (p.onHitP) p.onHitP(hr, sh0); } if (hitD) decoyHit();
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
  if (player.hp <= 0 && amuletSave()) return 'hit';
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

/* ===== 魔神 (tutorial boss; internal id 'shixiong') ===== */
function makeShixiong() {
  const m = buildImmortal({ robe: 0x3a1a5c, inner: 0xd2c4ea, trim: 0xd0aa5a, skin: 0xe8d6da, eye: 0xd060ff, eyeI: 5, angry: true, mark: true, sash: 0x1e0c2e, jade: 0xb070ff, ribbon: 0xa048ff, sheen: 0xc890ff, hairSheen: 0x8040c0,
    sword: { blade: 0x3a2650, glow: 0xb050ff, glowI: 1.4, gold: 0x9a7ad0, grip: 0x1a0c22, jade: 0xc070ff, jadeE: 0x6020a0 } });
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder);
  m.root.scale.setScalar(1.22);
  const aura1 = mk(G.sph, auraMat(0xa040ff, 2.0, .9), m.body, 0, 1.05, 0, .55, 1.15, .5);
  const aura2 = mk(G.sph, auraMat(0x6010c0, 1.4, .5), m.body, 0, 1.1, 0, .75, 1.35, .7);
  const mist = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0x2a0a40, transparent: true, opacity: .45, depthWrite: false }), holder, 0, .02, 0, 1.2, 1.2, 1.2); mist.rotation.x = -Math.PI / 2;
  const e = { kind: 'shixiong', boss: true, name: '魔神', lvTxt: '???', x: 0, z: -6.5, y: .3, yaw: 0, radius: .8, height: 2.5, hp: 100000, maxHp: 100000, floorHp: 0, armor: 1,
    model: m, holder, mats: m.mats, pose: clonePose(IPOSE.idle), tgt: IPOSE.idle, poseK: 8, act: null, cd: 2.5, ai: true, flash: 0, warnT: 0, home: V3(0, 0, -6.5), strafe: 0, last: '', dead: false, dmgK: 1, forced: null, visible: true,
    onInterrupt() { this.act = null; this.visible = true; if (timeScale < 1) timeScale = 1; tutBlockCue(false); setPose(this, 'idle', 6); this.cd = Math.max(this.cd, this.forced ? 1.6 : 2.2); this.model.sword.bladeM.emissiveIntensity = 1.4; } };
  initTough(e, 300);
  e.divine = addDivine(m, holder);
  e.update = dt => updateShixiong(e, dt);
  for (const mt of [purpleSwordM]) mt.userData.keepE = true;
  m.sword.bladeM.userData.keepE = true;
  return e;
}
/* 魔神 divine adornments: rune halo, glowing horns, sash streamers, orbiting flying swords (all cheap, shared mats) */
const haloTex = canvasTex(512, 512, (c, w, h) => {
  const cx = w / 2, cy = h / 2; c.clearRect(0, 0, w, h); c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineCap = 'round';
  c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, 236, 0, 7); c.stroke();
  c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, 214, 0, 7); c.stroke(); c.beginPath(); c.arc(cx, cy, 160, 0, 7); c.stroke();
  // rune glyphs between the rings
  let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 24; i++) {
    c.save(); c.translate(cx, cy); c.rotate(i / 24 * Math.PI * 2); c.translate(0, -187); c.lineWidth = 3.2; c.beginPath();
    const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const x0 = (r() - .5) * 18, y0 = (r() - .5) * 26, x1 = (r() - .5) * 18, y1 = (r() - .5) * 26; c.moveTo(x0, y0); c.lineTo(x1, y1); }
    c.stroke(); if (r() < .5) { c.beginPath(); c.arc((r() - .5) * 10, (r() - .5) * 14, 3, 0, 7); c.fill(); } c.restore();
  }
  // inner spokes + small diamonds
  for (let i = 0; i < 12; i++) { c.save(); c.translate(cx, cy); c.rotate(i / 12 * Math.PI * 2); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -160); c.lineTo(0, -128); c.stroke(); c.beginPath(); c.moveTo(0, -122); c.lineTo(5, -114); c.lineTo(0, -106); c.lineTo(-5, -114); c.closePath(); c.fill(); c.restore(); }
});
function addDivine(m, holder) {
  const glow = (hex, op) => new THREE.MeshBasicMaterial({ color: hex, map: haloTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  // halo: two counter-rotating rune discs behind the head (on torso so it follows the lean)
  const halo = new THREE.Group(); halo.position.set(0, .76, -.24); m.torso.add(halo);
  const h1 = mk(new THREE.PlaneGeometry(1, 1), glow(0xc070ff, .85), halo, 0, 0, 0, .78, .78, 1);
  const h2 = mk(new THREE.PlaneGeometry(1, 1), glow(0x7a30ff, .5), halo, 0, 0, -.01, .5, .5, 1);
  const core = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0x5a20a0, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), halo, 0, 0, -.02, .2, .2, 1);
  // horns: large curved demon horns (thick at the temples, sweeping out, up and back, tips hooking forward)
  const hornM = new THREE.MeshStandardMaterial({ color: 0x1a0a26, emissive: 0x7a2ad8, emissiveIntensity: .95, metalness: .55, roughness: .32 }); hornM.userData.keepE = true;
  const tipM = new THREE.MeshBasicMaterial({ color: 0xe0a0ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) { const pts = phantomHornPts(s, .82); mk(taperTube(pts, [.036, .032, .025, .016, .008, .001], { radial: 10, seg: 24 }), hornM, m.head);
    for (let k = 1; k <= 3; k++) { const q = pts[k]; mk(G.sphLo, hornM, m.head, q.x, q.y, q.z, .036 - k * .006, .012, .036 - k * .006); }
    const tp = pts[5]; mk(G.sphLo, tipM, m.head, tp.x, tp.y, tp.z, .018, .018, .018); }
  // sash streamers (飘带) from the belt, waving
  const sm = new THREE.MeshStandardMaterial({ color: 0x8a40e0, emissive: 0x6a20c0, emissiveIntensity: .45, roughness: .5, transparent: true, opacity: .82, side: THREE.DoubleSide });
  sm.onBeforeCompile = sh => { sh.uniforms.t = timeU; sh.vertexShader = 'uniform float t;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float dd = clamp(-position.y*1.4, 0., 1.6); transformed.z += sin(t*2.4 - position.y*5.)*.07*dd - dd*.05; transformed.x += sin(t*1.9 - position.y*4. + position.x*9.)*.035*dd;'); };
  for (const s of [-1, 1]) mk(taperTube([V3(s * .17, .02, -.06), V3(s * .22, -.25, -.18), V3(s * .26, -.55, -.3), V3(s * .25, -.85, -.42), V3(s * .3, -1.1, -.6)], [.03, .034, .036, .03, .012], { radial: 6, flat: .1, seg: 40, noCap: true }), sm, m.torso);
  // orbiting flying swords
  const orbit = new THREE.Group(); orbit.position.y = 1.25; holder.add(orbit);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xc8a8ff, metalness: .9, roughness: .3, emissive: 0x402070, emissiveIntensity: .6 });
  const swords = [], sheathM = new THREE.MeshBasicMaterial({ color: 0xd090ff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); orbit.add(g);
    mk(G.cone, purpleSwordM, g, 0, .2, 0, .022, .44, .007);          // blade (points +Y)
    mk(G.box, goldM, g, 0, -.03, 0, .09, .018, .025);                // guard
    mk(G.cyl, goldM, g, 0, -.09, 0, .012, .1, .012);                 // grip
    mk(G.sphLo, sheathM, g, 0, .2, 0, .045, .28, .02);              // glow sheath
    swords.push(g);
  }
  return { halo, h1, h2, core, orbit, swords };
}
function updateDivine(e, dt) {
  const d = e.divine; if (!d) return;
  d.h1.rotation.z += dt * .35; d.h2.rotation.z -= dt * .6;
  const pul = .8 + Math.sin(gameT * 2.2) * .12; d.h1.material.opacity = .85 * pul; d.core.material.opacity = .18 + Math.sin(gameT * 3) * .06;
  d.halo.position.y = .76 + Math.sin(gameT * 1.3) * .015;
  // swords orbit around him, slightly tilted, blades pointing along the orbit
  const hide = e.act && e.act.name === 'swords'; d.orbit.visible = !hide;
  d.swords.forEach((g, i) => { const a = gameT * .9 + i * Math.PI / 2, r = .95; g.position.set(Math.cos(a) * r, Math.sin(a * 2 + i) * .12 + Math.sin(a) * .18, Math.sin(a) * r); g.rotation.set(0, -a, 0); g.rotateX(-1.25); });
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
  updateDivine(e, dt);
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
const ZHENG = { hp: 11000, tough: 600, phase2: .35, claw: 50, charge: 90, pounce: 110, fire: 40 };
function makeZheng() {
  const m = buildZheng();
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder);
  const shadow = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .3, depthWrite: false }), holder, 0, .05, -.2, 1.0, 1.9, 1); shadow.rotation.x = -Math.PI / 2;
  const e = { kind: 'zheng', boss: true, name: '狰', lvTxt: '20', lv: 20, x: 0, z: -12, y: 0, yaw: 0, radius: 1.25, height: 2.2, hp: ZHENG.hp, maxHp: ZHENG.hp, armor: 1, floorHp: 0,
    model: m, holder, mats: m.mats, act: null, cd: 1.5, flash: 0, warnT: 0, dead: false, deadT: 0, moveAmt: 0, ph: 0, enraged: false, strafeDir: 1, stagger: 0, ai: false,
    an: { crouch: 0, pitch: 0, head: 0, jaw: 0, leap: 0, gallop: 0, rear: 0 },
    onInterrupt() { const an = this.an; an.leap = 0; an.gallop = 0; an.pitch = 0; this.act = null; this.cd = 1.0; },
    onHit(kind) { if (!this.enraged && this.hp > 0 && this.hp < this.maxHp * ZHENG.phase2) { this.enraged = true; banner('狰 · 狂暴', '五尾燃起烈焰，攻势更猛了！', 2.2); sfx('roar'); } },
    onDeath() { onZhengDeath(this); } };
  m.glow.material.uniforms.k.value = .0;
  initTough(e, ZHENG.tough);
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
/* ===== 魔神法相: giant translucent demon-god avatar that mirrors 魔神's rig (tutorial only) =====
   Own materials only (never shares/mutates other characters' materials). ~10 draw calls, no depth writes. */
const PHANTOM = { S: 4.6, BACK: 3.2, SINK: -2.6, RISE: 2.6 };
const phantomMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.FrontSide, fog: false,
  uniforms: { t: timeU, op: { value: 0 }, gy: { value: 0 }, flash: { value: 0 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: GLSL_NOISE + `uniform float t,op,gy,flash; varying vec3 vN; varying vec3 vV; varying vec3 vW;
    void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.7);
      float n=fb(vec2(vW.x*.35+vW.z*.3, vW.y*.45-t*.7)); float fl=fb(vec2(vW.x*.9-t*.3, vW.y*1.2-t*2.2));
      vec3 core=vec3(.045,.0,.085), rim=vec3(.72,.26,1.), hot=vec3(1.,.7,1.);
      vec3 col=mix(core, rim, f)+hot*pow(f,4.)*.6+vec3(.35,.1,.6)*fl*f*.6+vec3(.6,.3,.9)*flash;
      float a=(.5+f*.48)*(.8+.35*n)*op*smoothstep(gy, gy+3.2, vW.y);
      gl_FragColor=vec4(col, clamp(a,0.,.92)); }`,
});
const phantomEyeMat = new THREE.MeshBasicMaterial({ color: 0xff70ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
function phantomHornPts(s, k = 1) { return [V3(s * .07, .07, .02), V3(s * .16, .13, 0), V3(s * .25, .24, -.06), V3(s * .3, .38, -.12), V3(s * .28, .52, -.08), V3(s * .22, .62, .02)].map(p => p.multiplyScalar(k)); }
function buildPhantom() {
  const holder = new THREE.Group(); holder.visible = false; scene.add(holder);
  const root = new THREE.Group(); holder.add(root); const body = new THREE.Group(); root.add(body);
  const pm = (list, parent) => { const m = new THREE.Mesh(mergeColored(list), phantomMat); m.frustumCulled = false; parent.add(m); return m; };
  // robe (skirt) — dissolves into mist near the ground via the shader
  pm([[lathe([[.52, -.2], [.48, .25], [.36, .62], [.23, .95], [.18, 1.06]], 14), 0, M4(0, 0, 0)]], body);
  const torso = new THREE.Group(); torso.position.y = 1.02; body.add(torso);
  const tl = [[lathe([[.17, -.04], [.22, .18], [.27, .36], [.21, .47], [.07, .53]], 12), 0, M4(0, 0, 0)]];
  for (const s of [-1, 1]) { tl.push([G.sphLo, 0, M4(s * .25, .44, 0, .1, .07, .1)]); tl.push([new THREE.ConeGeometry(.04, .2, 6), 0, M4(s * .3, .53, 0, 1, 1, 1, 0, 0, s * -.5)]); tl.push([new THREE.ConeGeometry(.03, .14, 6), 0, M4(s * .22, .52, -.04, 1, 1, 1, 0, 0, s * -.25)]); }
  pm(tl, torso);
  const head = new THREE.Group(); head.position.set(0, .7, .01); torso.add(head);
  const hl = [[superEllipsoid(.095, .118, .105, .8, 12, 9), 0, M4(0, 0, 0)], [superEllipsoid(.065, .055, .065, .9, 10, 7), 0, M4(0, -.075, .03)]];
  for (const s of [-1, 1]) hl.push([taperTube(phantomHornPts(s, 1), [.042, .037, .028, .018, .009, .001], { radial: 7, seg: 14 }), 0, M4(0, 0, 0)]);
  for (const x of [-.04, 0, .04]) hl.push([new THREE.ConeGeometry(.018, x ? .08 : .12, 5), 0, M4(x, .14 + (x ? 0 : .02), .03)]);
  hl.push([taperTube([V3(0, .02, -.08), V3(0, -.2, -.16), V3(0, -.5, -.2)], [.09, .1, .02], { radial: 7, seg: 8 }), 0, M4(0, 0, 0)]); // mane
  pm(hl, head);
  const eyes = new THREE.Mesh(mergeColored([[G.sphLo, 0, M4(-.038, .02, .095, .028, .014, .012)], [G.sphLo, 0, M4(.038, .02, .095, .028, .014, .012)], [G.sphLo, 0, M4(0, .072, .1, .01, .02, .006)]]), phantomEyeMat); eyes.frustumCulled = false; head.add(eyes);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .22, .4, 0); torso.add(sh);
    pm([[taperTube([V3(0, 0, 0), V3(0, -.14, 0), V3(0, -.28, 0)], [.075, .065, .06], { radial: 7, seg: 6 }), 0, M4(0, 0, 0)]], sh);
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    pm([[lathe([[.055, 0], [.075, -.09], [.1, -.21], [.12, -.31], [.03, -.3]], 10), 0, M4(0, 0, 0)], ...(s < 0 ? [[G.sphLo, 0, M4(0, -.36, 0, .035, .05, .04)]] : [])], el);
    const hand = new THREE.Group(); hand.position.y = -.34; el.add(hand);
    if (s > 0) { pm([[G.sphLo, 0, M4(0, -.02, 0, .035, .05, .04)]], hand); const sg = new THREE.Group(); sg.position.set(0, -.03, .01); sg.rotation.x = Math.PI / 2; hand.add(sg);
      pm([[new THREE.ConeGeometry(1, 1, 4), 0, M4(0, .82, 0, .045, 1.45, .014)], [G.box, 0, M4(0, .08, 0, .16, .03, .04)], [G.cyl, 0, M4(0, -.04, 0, .018, .16, .018)]], sg); }
    arms.push({ sh, el, hand, s });
  }
  holder.scale.setScalar(PHANTOM.S);
  return { holder, root, body, torso, head, arms, eyes, lvl: 0, target: 0, op: 0 };
}
const demonPhantom = buildPhantom();
/* sky palettes for the tutorial: white (start) → pale purple (after the 法相 is summoned) */
const CLOUD_PAL = [
  { top: 0xd2dbea, mid: 0xf0f2f7, bot: 0xffffff, sun: [1, .97, .92], fog: 0xf1f2f6, hemi: 0xf4f4ff, hemiG: 0x9a98a8, sunL: 0xfff6ea },
  { top: 0x8f7cc6, mid: 0xc8b8e8, bot: 0xefe6f9, sun: [.95, .8, 1], fog: 0xe0d2f0, hemi: 0xe6d4ff, hemiG: 0x8a7090, sunL: 0xe8ccff },
];
const demonSky = { k: -1, target: 0, applied: -1 };
const _ca = new THREE.Color(), _cb = new THREE.Color();
function applyCloudTint(k) {
  if (!world || world.name !== 'cloud') return; demonSky.applied = k; const A = CLOUD_PAL[0], B = CLOUD_PAL[1];
  const L = (a, b, tgt) => tgt.copy(_ca.set(a)).lerp(_cb.set(b), k);
  L(A.top, B.top, skyMat.uniforms.top.value); L(A.mid, B.mid, skyMat.uniforms.mid.value); L(A.bot, B.bot, skyMat.uniforms.bot.value);
  skyMat.uniforms.sunCol.value.setRGB(...A.sun.map((v, i) => lerp(v, B.sun[i], k)));
  L(A.fog, B.fog, scene.fog.color); L(A.hemi, B.hemi, hemi.color); L(A.hemiG, B.hemiG, hemi.groundColor); L(A.sunL, B.sunL, sunL.color);
}
function resetDemonPhantom() { demonSky.k = 0; demonSky.target = 0; applyCloudTint(0); demonPhantom.lvl = 0; demonPhantom.target = 0; demonPhantom.holder.visible = false; }
function summonDemonPhantom(instant) { demonPhantom.target = 1; demonSky.target = 1; if (instant) { demonPhantom.lvl = 1; demonSky.k = 1; applyCloudTint(1); } }
let _phLast = 0;
function updateDemonPhantom() {
  const dt = clamp(gameT - _phLast, 0, .1); _phLast = gameT;
  if (demonSky.k >= 0 && demonSky.k !== demonSky.target) { demonSky.k = demonSky.target > demonSky.k ? Math.min(demonSky.target, demonSky.k + dt / 3.4) : Math.max(demonSky.target, demonSky.k - dt / 3.4); const e = demonSky.k; applyCloudTint(e * e * (3 - 2 * e)); }
  const P = demonPhantom, src = shixiong;
  P.lvl += (P.target > P.lvl ? 1 : -1) * Math.min(Math.abs(P.target - P.lvl), dt / PHANTOM.RISE);
  const show = P.lvl > 0 && mode === 'tutorial' && world && world.name === 'cloud' && src.holder.visible;
  P.holder.visible = show; if (!show) return;
  const m = src.model, sh = src.holder, k = 1 - Math.pow(1 - P.lvl, 3);
  // follow position/rotation: directly behind 魔神, facing the same way, rising out of the clouds
  const yaw = sh.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);
  P.holder.position.set(sh.position.x - fx * PHANTOM.BACK, sh.position.y + lerp(-14, PHANTOM.SINK, k), sh.position.z - fz * PHANTOM.BACK);
  P.holder.rotation.set(sh.rotation.x, yaw, sh.rotation.z);
  // mirror the rig every frame (same joint layout as buildImmortal)
  P.root.position.copy(m.root.position); P.root.rotation.copy(m.root.rotation); P.root.scale.copy(m.root.scale);
  P.body.position.copy(m.body.position); P.body.rotation.copy(m.body.rotation);
  P.torso.rotation.copy(m.torso.rotation); P.head.rotation.copy(m.head.rotation);
  for (let i = 0; i < 2; i++) { const a = m.arms[i], b = P.arms[i]; b.sh.rotation.copy(a.sh.rotation); b.el.rotation.copy(a.el.rotation); b.hand.rotation.copy(a.hand.rotation); }
  // keep the view of 魔神 clear: fade when the camera gets close to the avatar's body axis
  const cd = Math.hypot(camera.position.x - P.holder.position.x, camera.position.z - P.holder.position.z);
  const near = clamp((cd - 3) / 6, .3, 1);
  P.op = k * near * (.92 + Math.sin(gameT * 2.3) * .08);
  phantomMat.uniforms.op.value = P.op; phantomMat.uniforms.gy.value = H(sh.position.x, sh.position.z) - .2;
  phantomMat.uniforms.flash.value = Math.max(0, (src.flash || 0) * .25);
  phantomEyeMat.opacity = Math.min(1, P.op * 1.3);
  // faint purple flame / mist around the base
  if (state !== 'title' && Math.random() < .55 * k) { const a = rand(0, 6.28), r = rand(1.2, 3.2); emit(P.holder.position.x + Math.cos(a) * r, H(sh.position.x, sh.position.z) + rand(0, 1.2), P.holder.position.z + Math.sin(a) * r, rand(-.2, .2), rand(.8, 2), rand(-.2, .2), Math.random() < .5 ? 0x8a3aff : 0x3a0a60, rand(.9, 1.7), rand(1.2, 2.2), 0); }
  if (Math.random() < .25 * k) { const hp = P.head.getWorldPosition(V3()); emit(hp.x + rand(-1, 1), hp.y + rand(.5, 2.2), hp.z + rand(-1, 1), 0, rand(.5, 1.4), 0, 0xc070ff, rand(.5, 1), rand(.8, 1.4), 0); }
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
  if (id === 'ride' && !player.rideOK) { toast('御剑之术尚未习得'); return false; }
  if (id === 'ride' && !player.riding && typeof ch1 !== 'undefined' && mode === 'ch1' && ch1.noRide) { toast('此处不可御剑'); return false; }
  if (id === 'ride' && (VM.act === 'ridein' || VM.act === 'rideout')) return false;
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
  playVM('s1', .62, keys, lk, [{ at: .38, fn: () => { slashArc(true, 0, 1, 0x7fd8ff); shake = Math.max(shake, .12); for (const m of enemiesInCone(5.6, 1.05)) { hitEnemy(m, player.atk * TUNE.mult.s1, 's1', TUNE.tough.s1); if (m.kbS1 && !m.dead) zhanmaKB(m); } } }]);
}
/* 斩马 knockback (地宫 bridge phantoms): strong shove away from the player, biased toward the nearer bridge edge */
const ZM_KB = { dist: 5.5, dur: .32, side: .7 };
function zhanmaKB(m) { let dx = m.x - player.x, dz = m.z - player.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const sx = Math.abs(m.x) > .3 ? Math.sign(m.x) : (Math.sign(m.x - player.x) || (Math.random() < .5 ? -1 : 1)); dx += sx * ZM_KB.side; const l = Math.hypot(dx, dz) || 1;
  m.kbV = V3(dx / l * ZM_KB.dist / ZM_KB.dur, 0, dz / l * ZM_KB.dist / ZM_KB.dur); m.kbT = ZM_KB.dur; m.stagger = Math.max(m.stagger || 0, ZM_KB.dur + .35); if (m.act) cancelAct(m); burst(eCenter(m), 14, 0x7fd8ff, 6, .4, .4, -3); }
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
  FLY.range = (mode === 'ch1' && world.name === 'digong' && ch1.flags.needFly) ? 40 : 15;
  for (const m of liveEnemies()) { if (!m.flyMagnet) continue; const c = eCenter(m), v = c.clone().sub(fly.pos), hd = Math.hypot(v.x, v.z); if (hd > FLY.range + 2) continue; const a = Math.acos(clamp((v.x * f.x + v.z * f.z) / Math.max(1e-3, hd), -1, 1)); if (a < .36) { fly.dir.copy(v.normalize()); break; } }
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
  playVM('drink', .95, null, DRINK_L, [{ at: .5, fn: () => sfx('drink') }, { at: .62, fn: () => { player.wine--; const heal = Math.round(player.maxHp * wineHeal()); const h = Math.min(heal, player.maxHp - player.hp); player.hp += h; hudDirty = true; screenNum('+' + heal + ' 气血', 'heal', innerWidth * .5 - 30, innerHeight * .45); burst(ppos(), 16, 0x9effa0, 2, .3, .8, 1, .5); tutEvent('drink'); } }], 'gourd');
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
  invReset(true); player.name = '仙尊'; player.tutChar = true; player.pages = []; player.items = []; player.jdTp = false; player.quests = []; player.lv = 90; player.xp = 0; recalc(); player.hp = player.maxHp; player.wine = 2; player.wineMax = 2; player.unlocked = ALL_ST.slice(); player.rideOK = true; player.minHpFrac = .3; player.dead = false;
  setOutfit(0xeef1f6, 0x5fa6d8); $('avatar').textContent = '仙'; hudDirty = true;
}
/* ===== tutorial ===== */
const SHIXIONG_TOUGH = 300; // tutorial: same rules as 狰
const SHIXIONG_DMGK = 2.75; // 魔神 hits scaled to 仙尊's v3 气血 (5450)
const tut = { i: -1, cur: null, wait: 0, moved: 0, looked: 0, hits: 0, casts: 0, fails: 0, floorHp: 1 };
const TUT = [
  { id: 'intro', t: '你是剑修始祖 · 仙尊。为争夺「天地第一剑」，魔神与你反目，于云海之巅拦住了你的去路。', next: true },
  { id: 'move', t: '按住<b>左下摇杆</b>移动，向魔神靠近', hl: 'joy', check: () => tut.moved > 3 },
  { id: 'look', t: '在<b>屏幕右侧滑动</b>，转动视角', hl: 'look', check: () => tut.looked > .9 },
  { id: 'atk', t: '靠近魔神，点击<b>普攻</b>，命中 3 次', hl: 'btn-atk', on: (ty) => (ty === 'hit' && ++tut.hits >= 3) || (ty === 'cast' && ++tut.casts >= 8) },
  { id: 's1', t: '<b>斩马</b>：横向大范围挥斩，<b>削减韧性最多</b>。首领血条下的金色条是<b>韧性</b>：韧性越高受伤越低；打空即「破防」，首领硬直 7–10 秒并受全额伤害，之后 5 秒内韧性回满', hl: 'btn-s1', on: (ty, id) => ty === 'cast' && id === 's1' },
  { id: 's2', t: '<b>飞剑</b>：剑脱手疾飞，穿透敌人后不到 1 秒便飞回手中', hl: 'btn-s2', on: (ty) => ty === 'catch' },
  { id: 'block', t: '魔神即将出招！看到<b>紫光与「!」</b>时按<b>格挡</b>——挡下近身攻击即触发<b>弹反</b>：反击、大幅削韧并震退对手', hl: 'btn-block', on: (ty) => ty === 'block', enter() { endBreak(shixiong); shixiong.stagger = 0; shixiong.forced = 'blink'; shixiong.cd = 1.5; SK.block.t = 0; }, exit() { shixiong.forced = null; shixiong.cd = 3; } },
  { id: 'wine', t: '你被剑气所伤！点击左侧<b>酒葫芦</b>饮酒，每口恢复 <b>15%</b> 气血', hl: 'wine', on: (ty) => ty === 'drink', enter() { player.hp = Math.round(player.maxHp * .52); hudDirty = true; shake = .4; $('vign').style.opacity = .8; setTimeout(() => $('vign').style.opacity = 0, 300); player.wine = Math.max(1, player.wine); } },
  { id: 'summon', t: '魔神：「仙尊，就凭这点本事？……且看本尊法相！」', enter() { startSummon(); }, check: () => false },
  { id: 'dahe', t: '神通 · <b>大河之剑</b>（神通中央）：巨剑自天而降，伤害最高；击飞目标，震退周围小怪（首领不会被击退）', hl: 'st-dahe', st: 'dahe', on: (ty, id) => ty === 'cast' && id === 'dahe', wait: 2.2 },
  { id: 'wanjian', t: '神通 · <b>万剑归宗</b>（上）：双手持剑，万道剑气自身后飞出，持续 5 秒', hl: 'st-wanjian', st: 'wanjian', on: (ty, id) => ty === 'cast' && id === 'wanjian', wait: 5.4 },
  { id: 'jianyu', t: '神通 · <b>剑雨</b>（左）：<b>按住并拖动</b>按钮瞄准落点，松手施放（轻点则落在脚下）。剑雨持续 10 秒并<b>减速</b>其中的敌人', hl: 'st-jianyu', st: 'jianyu', on: (ty, id) => ty === 'cast' && id === 'jianyu', wait: 2.5 },
  { id: 'yinshen', t: '神通 · <b>隐身</b>（右）：留下残影并向前冲刺，3 秒内敌人（包括首领）只会攻击残影；现身后第一击为<b>破隐一击</b>，伤害翻倍', hl: 'st-yinshen', st: 'yinshen', on: (ty, id) => ty === 'cast' && id === 'yinshen', wait: 3 },
  { id: 'hudun', t: '神通 · <b>护盾</b>（下）：法球环绕周身，吸收相当于 <b>20% 气血上限</b>的伤害', hl: 'st-hudun', st: 'hudun', on: (ty, id) => ty === 'cast' && id === 'hudun', wait: 2.5 },
];
function startTutorial() {
  mode = 'tutorial'; state = 'play'; setWorld('cloud'); resetDemonPhantom(); summon.on = false; clearFx(); clearProj(); resetSkills(); setupLiBai(); placePlayer(world.spawn);
  enemies.length = 0; enemies.push(shixiong); zheng.holder.visible = false;
  Object.assign(shixiong, { hp: 50000, maxHp: 50000, x: 0, z: -6.5, act: null, cd: 3, ai: true, visible: true, forced: null, dead: false, dmgK: SHIXIONG_DMGK, cutLift: 0, stagger: 0 }); initTough(shixiong, SHIXIONG_TOUGH);
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
  updateSummon(dt);
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
function skipTutorial() { if (mode !== 'tutorial') return; summon.on = false; hideGuide(); $('skip').style.display = 'none'; resetSkills(); clearProj(); startStory(); }
/* ===== 魔神祭出法相 (story beat between the basic skills and the 神通 lessons) ===== */
const summon = { on: false, t: 0, fired: false, px: 0, pz: 0 };
function startSummon() {
  const e = shixiong; if (e.broken) endBreak(e); if (e.act) e.onInterrupt(); e.ai = false; e.stagger = 0; e.forced = null; tutBlockCue(false); clearProj();
  Object.assign(summon, { on: true, t: 0, fired: false, px: player.x, pz: player.z });
  setPose(e, 'cast', 6); sfx('roar');
}
function updateSummon(dt) {
  if (!summon.on) return; const e = shixiong; summon.t += dt; const t = summon.t;
  player.x = summon.px; player.z = summon.pz;
  player.yaw += angDiff(player.yaw, Math.atan2(-(e.x - player.x), -(e.z - player.z))) * Math.min(1, dt * 4);
  const pt = t < 1.1 ? .03 : t < 4.1 ? .36 : .04; player.pitch = lerp(player.pitch, pt, Math.min(1, dt * (t < 4.1 ? 1.6 : 2.4)));
  faceTo(e, player.x, player.z, dt * 5);
  if (!summon.fired && t >= 1.0) { summon.fired = true; summonDemonPhantom(); setPose(e, 'sky', 4); sfx('boom'); sfx('whoosh'); shake = Math.max(shake, .35); flashScreen('#b070ff', .35, .9); smoke(V3(e.x, 1, e.z)); }
  if (summon.fired && t < 3.6) shake = Math.max(shake, .06);
  if (t >= 5.2) { summon.on = false; e.ai = true; e.cd = 1.6; setPose(e, 'idle', 5); $('guide').classList.add('done'); sfx('ding'); tut.wait = .6; }
}
/* ===== cutscene ===== */
const cut = { t: 0, fired: {} };
let lostSword = null;
function sub(who, txt) { const s = $('sub'); s.innerHTML = who ? `<b>${who}</b>${txt}` : txt; s.classList.remove('show'); void s.offsetWidth; s.classList.add('show'); }
function startCutscene() {
  state = 'cut'; cut.t = 0; cut.fired = {}; $('skip').style.display = 'none'; document.body.classList.add('cine');
  resetSkills(); clearProj();
  const e = shixiong; e.act = null; e.ai = false; e.floorHp = 0; e.hp = Math.round(e.maxHp * .08); e.cutLift = 0;
  sub('魔神', '仙尊……你的剑，终究慢了我一步。');
}
const purpleSky = [new THREE.Color(0x12062a), new THREE.Color(0x5a2a8a), new THREE.Color(0xc070c0)];
function updateCut(dt) {
  cut.t += dt; const t = cut.t, e = shixiong; const once = (k, at, fn) => { if (!cut.fired[k] && t >= at) { cut.fired[k] = 1; fn(); } };
  const want = Math.atan2(-(e.x - player.x), -(e.z - player.z));
  if (t < 3) { player.yaw += angDiff(player.yaw, want) * Math.min(1, dt * 3); player.pitch = lerp(player.pitch, .14, dt * 2); }
  const k = smooth(0, 2.4, t);
  skyMat.uniforms.top.value.lerp(purpleSky[0], dt * .8); skyMat.uniforms.mid.value.lerp(purpleSky[1], dt * .8); skyMat.uniforms.bot.value.lerp(purpleSky[2], dt * .5);
  if (t < 2.5) { e.cutLift = k * 1.6; setPose(e, 'sky', 4); e.model.sword.bladeM.emissiveIntensity = 2 + k * 5; const tip = swordTip(e); for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), r = rand(1.5, 3.5); const p = tip.clone().add(V3(Math.cos(a) * r, rand(-1.5, 2), Math.sin(a) * r)); const v = tip.clone().sub(p).multiplyScalar(2.2); emit(p.x, p.y, p.z, v.x, v.y, v.z, Math.random() < .3 ? 0x300a50 : 0xc070ff, .5, .45, 0); } shake = Math.max(shake, .04 + k * .08); }
  once('l2', 1.2, () => sub('魔神', '这天地第一剑……只能是我的！'));
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
  once('l3', 3.7, () => sub('仙尊', '魔神……你……'));
  once('fade', 5.0, () => { $('fade').style.transition = 'opacity 1.4s'; $('fade').style.opacity = 1; });
  once('story', 6.6, () => startStory());
}
/* ===== black screen story + naming ===== */
const STORY = '仙尊陨落之后，一位普通的剑修将接替他的使命。';
let storyTimer = null;
function startStory() {
  state = 'story'; resetInputs('story'); document.body.className = 'm-story'; $('sub').classList.remove('show');
  $('fade').style.transition = 'none'; $('fade').style.opacity = 1;
  const st = $('story'); st.style.display = 'flex'; const tx = $('storytxt'); tx.textContent = ''; $('storynext').style.visibility = 'hidden';
  let i = 0; clearInterval(storyTimer);
  storyTimer = setInterval(() => { i++; tx.textContent = STORY.slice(0, i); if (i >= STORY.length) { clearInterval(storyTimer); setTimeout(() => { $('storynext').style.visibility = 'visible'; }, 500); } }, 90);
}
function storyTap() { if (state !== 'story') return; const tx = $('storytxt'); if (tx.textContent.length < STORY.length) { clearInterval(storyTimer); tx.textContent = STORY; $('storynext').style.visibility = 'visible'; return; } showNameBox(); }
function showNameBox() { if (JUMP.pending) { $('story').style.display = 'none'; jumpStart('intro'); return; } state = 'name'; resetInputs('name'); $('story').style.display = 'none'; $('namebox').style.display = 'flex'; $('nmerr').textContent = ''; const inp = $('nm'); inp.value = suggestName(); }
function confirmName() {
  const v = ($('nm').value || '').trim().slice(0, 8) || '无名剑修';
  const err = nameError(v); if (err) { $('nmerr').textContent = err; sfx('hurt'); return; }
  $('nm').blur(); $('namebox').style.display = 'none'; if (JUMP.pending) { jumpStart('intro'); return; } newCareer(v);
}
/* ===== multi-slot saves (localStorage) ===== */
const SAVES_KEY = 'jianxianzhidao_saves', OLD_SAVE_KEY = 'jianxianzhidao_save', MAX_SLOTS = 8;
let activeSlot = null;
function readStore() {
  let st = null; try { st = JSON.parse(localStorage.getItem(SAVES_KEY) || 'null'); } catch (e) { }
  if (!st || !Array.isArray(st.slots)) st = { v: 1, slots: [], last: null };
  st.slots = st.slots.filter(d => d && d.name && d.lv >= 1);
  // migrate the v3 single save into the slot list
  try { const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null'); if (old && old.name) { if (!st.slots.some(d => d.name === old.name) && st.slots.length < MAX_SLOTS) { const id = 's' + (old.time || Date.now()).toString(36); st.slots.push({ ...old, id }); st.last = st.last || id; } localStorage.removeItem(OLD_SAVE_KEY); localStorage.setItem(SAVES_KEY, JSON.stringify(st)); } } catch (e) { }
  return st;
}
function writeStore(st) { try { localStorage.setItem(SAVES_KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }
function listSaves() { const st = readStore(); return st.slots.slice().sort((a, b) => (b.id === st.last) - (a.id === st.last) || (b.time || 0) - (a.time || 0)); }
function nameError(v) { const st = readStore(); if (st.slots.some(d => d.name === v)) return `已有名为「${v}」的存档，请换一个名字`; if (st.slots.filter(d => d.id !== JUMP_SLOT).length >= MAX_SLOTS) return `存档已满（最多 ${MAX_SLOTS} 个），请先在「继续游戏」中删除一个存档`; return ''; }
function suggestName() { const st = readStore(); let n = '无名剑修', k = 2; while (st.slots.some(d => d.name === n)) n = '无名剑修' + k++; return n; }
function saveGame() {
  if (player.tutChar || !activeSlot) return false;
  const st = readStore(); let d = st.slots.find(x => x.id === activeSlot);
  if (!d) { if (st.slots.length >= MAX_SLOTS + (activeSlot === JUMP_SLOT ? 1 : 0)) return false; d = { id: activeSlot }; st.slots.push(d); }
  Object.assign(d, { v: 3, name: player.name, lv: player.lv, xp: player.xp, stage: mode === 'valley' ? 'valley' : 'ch1', ch: ch1.cp, rideOK: !!player.rideOK, unlocked: player.unlocked.slice(), pages: (player.pages || []).slice(), items: (player.items || []).slice(), jdTp: !!player.jdTp, quests: (player.quests || []).slice(), wine: player.wine, wineMax: player.wineMax, wins: player.wins || 0, ...invSaveData(), time: Date.now() });
  st.last = activeSlot; return writeStore(st);
}
function loadSave(id) { const st = readStore(); return st.slots.find(d => d.id === (id || st.last)) || null; }
function deleteSave(id) { const st = readStore(); st.slots = st.slots.filter(d => d.id !== id); if (st.last === id) st.last = null; writeStore(st); }
function wipeSave() { try { localStorage.removeItem(SAVES_KEY); localStorage.removeItem(OLD_SAVE_KEY); } catch (e) { } }
function applySave(d) { player.tutChar = false; activeSlot = d.id; player.name = d.name; player.lv = clamp(d.lv | 0, 1, 100); player.xp = Math.max(0, d.xp | 0); player.unlocked = Array.isArray(d.unlocked) ? d.unlocked.filter(x => ALL_ST.includes(x)) : []; player.pages = Array.isArray(d.pages) ? d.pages.filter(i => Number.isInteger(i) && i >= 0 && i < 10).filter((v, k, arr) => arr.indexOf(v) === k) : []; player.items = Array.isArray(d.items) ? d.items.filter(x => typeof x === 'string').slice(0, 20) : []; player.jdTp = !!d.jdTp; player.quests = Array.isArray(d.quests) ? d.quests.filter(x => typeof x === 'string') : []; player.wineMax = Math.max(1, d.wineMax | 0 || 2); player.wine = clamp(d.wine ?? player.wineMax, 0, player.wineMax); player.wins = d.wins | 0; player.rideOK = !!d.rideOK; ch1.cp = d.ch || 'intro'; invLoad(d); }
function newCareer(name) {
  player.tutChar = false; activeSlot = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  player.name = name || '无名剑修'; player.lv = 1; player.xp = 0; player.unlocked = []; player.pages = []; player.items = []; player.jdTp = false; player.quests = []; player.wineMax = 2; player.wine = 2; player.wins = 0; invReset();
  player.rideOK = false; ch1.cp = 'intro'; saveGame(); startCh1('intro');
}
const STAGE_CN = { valley: '第一章 · 学院' };
function fmtTime(t) { if (!t) return '—'; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showSlots() {
  const st = readStore(), list = listSaves(); if (!list.length) { $('slots').style.display = 'none'; refreshTitle(); return; }
  $('slotcnt').textContent = `${list.length}/${MAX_SLOTS}`;
  $('slotlist').innerHTML = list.map(d => `<div class="slot${d.id === st.last ? ' last' : ''}" data-id="${escHtml(d.id)}"><div class="sav">剑</div><div class="sinfo"><b>${escHtml(d.name)}</b><span class="slv">Lv${d.lv | 0}</span>${d.id === st.last ? '<em>上次游玩</em>' : ''}<div class="smeta">${slotStageTxt(d)} · 最近游玩 ${fmtTime(d.time)}</div></div><button class="gbtn sgo" data-act="go">进入</button><button class="gbtn alt sdel" data-act="del">删除</button></div>`).join('');
  resetInputs('slots'); $('slots').style.display = 'flex';
}
function enterSlot(id) { const d = loadSave(id); if (!d) { showSlots(); return; } const st = readStore(); st.last = id; writeStore(st); $('slots').style.display = 'none'; initAudio(); $('start').style.display = 'none'; goFull(); applySave(d); resumeCh1(d); }
let confirmYes = null;
function showConfirm(title, txt, onYes) { $('cfmtitle').textContent = title; $('cfmtxt').textContent = txt; confirmYes = onYes; resetInputs('confirm'); $('confirm').style.display = 'flex'; }
/* ===== valley fight ===== */
function startValley(opt = {}) {
  if (!op.done) { op.done = true; clearTimeout(op.timer); $('opening').style.display = 'none'; }
  initAudio();
  hideGuide(); tut.cur = null; $('skip').style.display = 'none';
  mode = 'valley'; state = 'play'; setWorld('valley'); clearFx(); clearProj(); resetSkills();
  $('c').style.filter = ''; camDrop = 0; camRoll = 0; $('vign').style.opacity = 0; timeScale = 1; if (lostSword) { scene.remove(lostSword.g); lostSword = null; }
  if (typeof opt === 'string') { player.name = opt; player.lv = 1; player.xp = 0; player.unlocked = []; player.wineMax = 2; opt = {}; }
  player.rideOK = true; recalc(); player.hp = player.maxHp; if (!opt.keepWine) player.wine = player.wineMax; player.minHpFrac = 0; player.dead = false; player.lastHurt = -99;
  setOutfit(0x3c4a5e, 0x9aa8b8); $('avatar').textContent = '剑'; hudDirty = true;
  placePlayer(world.spawn);
  shixiong.holder.visible = false; enemies.length = 0; enemies.push(zheng);
  initTough(zheng, ZHENG.tough); parryCount = 0; rideRams = 0;
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
  resetInputs('win'); $('win').style.display = 'flex'; sfx('win'); document.body.classList.add('won');
}
function gainXp(x) { player.xp += x; let up = false; while (player.lv < 100 && player.xp >= needXp(player.lv)) { player.xp -= needXp(player.lv); player.lv++; up = true; recalc(); player.hp = player.maxHp; } hudDirty = true; if (up && mode === 'valley') saveGame(); }
function playerDie() {
  player.dead = true; if (player.riding) endRide(); resetSkills(); swordInHand = true;
  if (mode === 'ch1') { ch1OnDeath(); return; }
  setTimeout(() => { if (player.dead && mode === 'valley') { state = 'dead'; resetInputs('dead'); $('dead').style.display = 'flex'; } }, 1200);
}

/* ---------------- input ---------------- */
const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0, R: 50, half: 60 };
let camPtr = null, camLast = null;
const joyEl = $('joy'), knob = $('joyknob'), touchEl = $('touch');
function joyHome() { joyEl.style.left = ''; joyEl.style.top = ''; knob.style.transform = ''; joyEl.classList.remove('active'); layoutJoy(); }
/* v3c robust input: ids are 't<identifier>' for touches, 'p<pointerId>' for mouse/pen.
   Touch end/cancel are listened on window in capture phase so nothing can swallow them, and every touch event
   re-validates that each tracked finger is still in e.touches (iOS Safari can drop touchend). */
const IN = { atkId: null, jyTid: null, resets: 0, last: '' };
function resetJoy() { if (joy.id === null && !joy.x && !joy.y) return; joy.id = null; joy.x = joy.y = 0; joyHome(); }
function resetCam() { camPtr = null; camLast = null; }
function resetAtk() { atkHeld = false; IN.atkId = null; const b = $('btn-atk'); b && b.classList.remove('down'); }
function resetInputs(why) { IN.resets++; IN.last = why; resetJoy(); resetCam(); resetAtk(); if (jyAim.on) jyAimEnd(true); for (const k in keys) keys[k] = false; document.querySelectorAll('.btn.down').forEach(b => b.classList.remove('down')); }
function startJoy(id, x, y) {
  const W = innerWidth, Hh = innerHeight, half = joy.half;
  joy.id = id; joy.cx = clamp(x, half + 6, W * .36); joy.cy = clamp(y, Hh - half - 6 - 14 * uScale, Hh - half - 6);
  joyEl.style.left = (joy.cx - half) + 'px'; joyEl.style.top = (joy.cy - half) + 'px'; joyEl.classList.add('active'); moveJoy(x, y);
}
function moveJoy(x, y) { let dx = x - joy.cx, dy = y - joy.cy; const d = Math.hypot(dx, dy); if (d > joy.R) { dx *= joy.R / d; dy *= joy.R / d; } joy.x = dx / joy.R; joy.y = dy / joy.R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
function lookMove(x, y) { const dx = x - camLast.x, dy = y - camLast.y; camLast = { x, y }; if (state !== 'play') return; const s = 4.2 / Math.max(innerWidth, 600); player.yaw -= dx * s; yawVel = dx * s / (1 / 60); player.pitch = clamp(player.pitch - dy * s * .8, -1.15, .7); tut.looked += Math.abs(dx * s) + Math.abs(dy * s * .8); }
function areaDown(id, x, y) {
  if (state !== 'play') return;
  if (joy.id === null && x < innerWidth * .42 && y > innerHeight * .5) startJoy(id, x, y);
  else if (camPtr === null) { camPtr = id; camLast = { x, y }; }
}
function trackMove(id, x, y) { if (id === joy.id) moveJoy(x, y); else if (id === camPtr && camLast) lookMove(x, y); }
function trackEnd(id) { if (id === joy.id) resetJoy(); if (id === camPtr) resetCam(); if (id === IN.atkId) resetAtk(); if (jyAim.on && jyAim.tid === id) jyAimEnd(false); }
function trackCancel(id) { if (id === joy.id) resetJoy(); if (id === camPtr) resetCam(); if (id === IN.atkId) resetAtk(); if (jyAim.on && jyAim.tid === id) jyAimEnd(true); }
// validate tracked touch ids against the live e.touches list
function validateTouches(e) {
  const live = new Set(); for (const t of e.touches) live.add('t' + t.identifier);
  const gone = id => typeof id === 'string' && id[0] === 't' && !live.has(id);
  if (gone(joy.id)) resetJoy();
  if (gone(camPtr)) resetCam();
  if (gone(IN.atkId)) resetAtk();
  if (jyAim.on && gone(jyAim.tid)) jyAimEnd(true);
}
// touch: start only on the game area; move/end/cancel on window (capture) so overlays/buttons can't swallow them
touchEl.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) areaDown('t' + t.identifier, t.clientX, t.clientY); }, { passive: false });
addEventListener('touchstart', e => validateTouches(e), { capture: true, passive: true });
addEventListener('touchmove', e => { for (const t of e.changedTouches) trackMove('t' + t.identifier, t.clientX, t.clientY); validateTouches(e); if (e.target === touchEl) e.preventDefault(); }, { capture: true, passive: false });
addEventListener('touchend', e => { for (const t of e.changedTouches) trackEnd('t' + t.identifier); validateTouches(e); }, { capture: true, passive: true });
addEventListener('touchcancel', e => { for (const t of e.changedTouches) trackCancel('t' + t.identifier); validateTouches(e); }, { capture: true, passive: true });
// mouse / pen (touch pointers are handled by the touch events above)
touchEl.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; e.preventDefault(); areaDown('p' + e.pointerId, e.clientX, e.clientY); try { touchEl.setPointerCapture(e.pointerId); } catch (_) { } }, { passive: false });
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; trackMove('p' + e.pointerId, e.clientX, e.clientY); }, { capture: true });
const ptrUp = e => { if (e.pointerType === 'touch') return; trackEnd('p' + e.pointerId); };
addEventListener('pointerup', ptrUp, { capture: true }); addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') trackCancel('p' + e.pointerId); }, { capture: true }); touchEl.addEventListener('lostpointercapture', ptrUp);
// lifecycle resets
addEventListener('blur', () => resetInputs('blur')); addEventListener('pagehide', () => resetInputs('pagehide'));
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInputs('hidden'); });
addEventListener('orientationchange', () => resetInputs('orientation')); addEventListener('resize', () => resetInputs('resize'));
// any overlay/dialog becoming visible (or leaving play) resets inputs — checked every frame
let __ipS = null, __ipO = '';
window.__inputWatch = () => { const ov = ['start', 'opening', 'story', 'namebox', 'dead', 'win', 'confirm', 'slots', 'dlg', 'chend'].filter(i => { const d = $(i).style.display; return d === 'flex' || d === 'block'; }).join(','); if (state !== __ipS || ov !== __ipO) { if ((state !== 'play' && __ipS === 'play') || (ov && ov !== __ipO)) resetInputs('overlay:' + (ov || state)); __ipS = state; __ipO = ov; } };
function bindBtn(id, skill) {
  const el = $(id);
  if (skill === 'jianyu') { // press-and-drag aiming
    el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t) IN.jyTid = 't' + t.identifier; }, { passive: true });
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('down');
      if (canAct() && hasSt('jianyu') && SK.jianyu.t <= 0 && !player.riding && !wj.active && !jyAim.on) { jyAimStart(e.pointerId, e.clientX, e.clientY); jyAim.tid = e.pointerType === 'touch' ? IN.jyTid : null; try { el.setPointerCapture(e.pointerId); } catch (_) { } }
      else tryCast('jianyu'); }, { passive: false });
    el.addEventListener('pointermove', e => { if (jyAim.on && e.pointerId === jyAim.id) { e.preventDefault(); jyAimMove(e.clientX, e.clientY); } }, { passive: false });
    el.addEventListener('pointerup', e => { el.classList.remove('down'); if (jyAim.on && e.pointerId === jyAim.id) { jyAimMove(e.clientX, e.clientY); jyAimEnd(false); } });
    el.addEventListener('pointercancel', e => { el.classList.remove('down'); if (jyAim.on && e.pointerId === jyAim.id) jyAimEnd(true); });
    return;
  }
  if (skill === 'atk') el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t) IN.atkId = 't' + t.identifier; }, { passive: true });
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('down'); if (skill === 'atk') { atkHeld = state === 'play'; if (e.pointerType !== 'touch') IN.atkId = 'p' + e.pointerId; } tryCast(skill); }, { passive: false });
  const up = () => { el.classList.remove('down'); if (skill === 'atk') resetAtk(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
const BTN = { atk: 'btn-atk', s1: 'btn-s1', s2: 'btn-s2', block: 'btn-block', ride: 'btn-ride', wine: 'wine', dahe: 'st-dahe', wanjian: 'st-wanjian', jianyu: 'st-jianyu', yinshen: 'st-yinshen', hudun: 'st-hudun' };
for (const k in BTN) bindBtn(BTN[k], k);
const btnEls = {}; for (const k in BTN) btnEls[k] = $(BTN[k]);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
const keys = {};
addEventListener('keydown', e => { if (state === 'name') return; if (state === 'talk' && (e.code === 'Space' || e.code === 'Enter')) { dlgTap(); return; } keys[e.code] = true; const map = { KeyJ: 'atk', Space: 'atk', Digit1: 's1', Digit2: 's2', Digit3: 'block', KeyR: 'ride', KeyQ: 'wine', KeyZ: 'dahe', KeyX: 'wanjian', KeyC: 'jianyu', KeyV: 'yinshen', KeyB: 'hudun' }; if (map[e.code]) tryCast(map[e.code]); });
addEventListener('keyup', e => keys[e.code] = false);
$('skip').addEventListener('click', e => { e.stopPropagation(); skipTutorial(); });
$('gnext').addEventListener('click', e => { e.stopPropagation(); if (tut.cur && tut.cur.next) completeStep(); });
$('story').addEventListener('click', storyTap);
$('nmok').addEventListener('click', confirmName);
$('nm').addEventListener('keydown', e => { if (e.key === 'Enter') confirmName(); });
$('retry').addEventListener('click', () => startValley());
$('deadtitle').addEventListener('click', () => toTitle());
$('again').addEventListener('click', () => { document.body.classList.remove('won'); startValley(); });
$('totitle').addEventListener('click', () => toTitle());
function toTitle() { saveGame(); location.reload(); }  // reload → title (继续游戏 opens the save list)

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
  btnEls.ride.classList.toggle('on', player.riding); btnEls.ride.classList.toggle('locked', !player.rideOK);
  if (player.riding) btnEls.ride.querySelector('.dur').style.setProperty('--q', (player.rideT / RIDE_DUR).toFixed(3));
  document.body.classList.toggle('stlock', player.unlocked.length === 0);
  for (const id of ALL_ST) btnEls[id].classList.toggle('lk1', player.unlocked.length > 0 && !hasSt(id));
  if (player.stealthT > 0) $('stealthtxt').textContent = `隐身中 ${player.stealthT.toFixed(1)}s · 现身首击伤害翻倍`;
  const be = enemies[0];
  if (be) { const r = be.hp / be.maxHp; $('bossfill').style.width = (r * 100) + '%'; $('bosstxt').textContent = (be.kind === 'zheng' || be.showNum) ? `${Math.ceil(be.hp)}/${be.maxHp}` : `${Math.ceil(r * 100)}%`; const nm = `${be.name}<small>Lv${be.lvTxt}</small>`; if (nm !== hudBossName) { hudBossName = nm; $('bossname').innerHTML = nm; }
    const tb = $('tbar'); tb.style.display = be.tough ? 'block' : 'none';
    if (be.tough) { const tr = be.broken ? Math.max(0, be.brkT / be.brkDur) : be.T / be.Tmax; $('tfill').style.width = (tr * 100).toFixed(1) + '%'; const st = be.broken ? 'brk' : be.refill ? 'ref' : ''; if (tb.dataset.st !== st) { tb.dataset.st = st; tb.className = 'tbar ' + st; }
      const tx = be.broken ? `破防 · 硬直 ${Math.max(0, be.brkT).toFixed(1)}s` : be.refill ? `韧性恢复中 ${Math.floor(be.T)}/${be.Tmax}` : `韧性 ${Math.ceil(be.T)}/${be.Tmax}`; if ($('ttxt').textContent !== tx) $('ttxt').textContent = tx; } }
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
    for (const c of world.cols || []) { if (c.off) continue; const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz), mn = c.r + .45; if (d < mn && d > 1e-4) { player.x = c.x + dx / d * mn; player.z = c.z + dz / d * mn; } }
    if (H(player.x, player.z) < -1.15) { player.x = ox; player.z = oz; }
    if (world.resolve) { const ddx = player.x - ox, ddz = player.z - oz, n = Math.max(1, Math.ceil(Math.hypot(ddx, ddz) / .25)); let x = ox, z = oz; for (let i = 0; i < n; i++) { const r = world.resolve(x + ddx / n, z + ddz / n, .45); x = r[0]; z = r[1]; } player.x = x; player.z = z; if (mode === 'ch1') ch1PlayerClamp(); }
    for (const m of liveEnemies()) { if (m.noPush) continue; const dx = player.x - m.x, dz = player.z - m.z, d = Math.hypot(dx, dz), mn = m.radius + .7; if (d < mn && d > 1e-3) { player.x = m.x + dx / d * mn; player.z = m.z + dz / d * mn; } }
    if (mode === 'tutorial') tut.moved += Math.hypot(player.x - ox, player.z - oz) * (moving ? 1 : 0);
  }
  player.moveAmt += ((moving ? mag : 0) - player.moveAmt) * Math.min(1, dt * 8);
  player.bob += dt * (player.riding ? 4 : 9) * player.moveAmt;
  if (player.riding) { player.rideT -= dt; if (player.rideT <= 0) endRide(); }
  if (state === 'play' && !player.dead && player.hp < player.maxHp) { const idle = gameT - player.lastHurt; const slowR = mode === 'valley' || (mode === 'ch1' && ch1.fight); if (slowR ? idle > 8 : idle > 4) { player.hp = Math.min(player.maxHp, player.hp + (slowR ? player.maxHp * .003 : player.maxHp * .02) * dt); hudDirty = true; } }
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
  updateDemonPhantom();
  updateProj(dt); updateFly(dt); updateUlt(dt); updateWanjian(dt); updateZones(dt); updateOrb(dt); updateDecoy(dt);
  updateFx(dt); updateParticles(dt); updateNums(dtR); updateSNums(dtR);
  updateVM(dt); updateHUD();
  if (state === 'play' && mode === 'tutorial') updateTutorial(dtR);
  if (state === 'play' && mode === 'valley') updateValley(dt);
  if (state === 'cut' && mode === 'tutorial') updateCut(dt);
  if (mode === 'ch1') updateCh1(dt, dtR);
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
function render() { renderer.clear(); renderer.render(scene, camera); if (state !== 'title' && state !== 'story' && state !== 'name' && state !== 'opening') { renderer.clearDepth(); renderer.render(vScene, vCam); } }
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); window.__inputWatch();
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (window.__freeze) { }
  else if (state === 'title') titleUpdate(dt);
  else if (state === 'play' || state === 'cut' || state === 'win' || state === 'dead' || state === 'talk') update(dt);
  else { gameT += dt; timeU.value = gameT; }
  render();
}
setWorld('cloud'); enemies.push(shixiong); recalc(); layout(); hudDirty = true; updateHUD();
document.body.className = 'm-title';
function goFull() { const de = document.documentElement; try { if (de.requestFullscreen && !/Headless/.test(navigator.userAgent)) de.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (_) { } }
function refreshTitle() {
  const list = listSaves(), last = loadSave(), has = list.length > 0;
  $('go').style.display = has ? 'none' : 'inline-block'; $('cont').style.display = has ? 'inline-block' : 'none'; $('newsave').style.display = has ? 'inline-block' : 'none';
  $('saveinfo').style.display = has ? 'block' : 'none';
  if (has) $('saveinfo').textContent = `共 ${list.length} 个存档` + (last ? ` · 上次：剑修「${last.name}」 Lv${last.lv}` : '');
}
refreshTitle();
function startNewSave() { JUMP.pending = false; if (listSaves().filter(d => d.id !== JUMP_SLOT).length >= MAX_SLOTS) { toastTitle(`存档已满（最多 ${MAX_SLOTS} 个），请先删除一个存档`); return; } activeSlot = null; initAudio(); $('start').style.display = 'none'; $('slots').style.display = 'none'; goFull(); playOpening(); }
/* ===== black-screen opening (3 paragraphs, fade in → hold → fade out; 跳过 skips all, tap advances) ===== */
const OPENING = [
  '三千万年前，混沌初开。\n天地孕出一头异兽，修为通天，一息可吞日月。它撕开鸿蒙，辟出一方天地，后人称之为“仙境”。\n然仙境之中，异兽横行，生灵涂炭。',
  '两千万年后，有两人持剑而起，一曰仙尊，一曰魔神。\n二人并肩斩尽凶兽，于大陆中央立下修仙之地，广开山门，传道天下。\n自此，世间始有剑修。',
  '五百万年前，天降一剑，名曰“太初”，号称天地第一剑。\n魔神欲执此剑，镇压众生；仙尊欲封此剑，永绝后患。\n昔日同袍，自此拔剑相向……',
];
const OP_T = { fadeIn: 1.6, hold: 4.2, fadeOut: 1.2, gap: .35 };
const op = { i: -1, phase: '', timer: null, done: true };
function opSet(fn, s) { clearTimeout(op.timer); op.timer = setTimeout(fn, s * 1000); }
function playOpening() {
  state = 'opening'; document.body.className = 'm-story'; resetInputs('opening');
  const el = $('opening'); el.style.display = 'flex'; op.i = -1; op.done = false; opNext();
}
function opNext() {
  if (op.done) return; op.i++;
  if (op.i >= OPENING.length) { endOpening(); return; }
  const t = $('optxt'); t.style.transition = 'none'; t.style.opacity = 0; t.textContent = OPENING[op.i]; void t.offsetWidth;
  t.style.transition = `opacity ${OP_T.fadeIn}s ease-in-out`; t.style.opacity = 1; op.phase = 'in';
  $('opdots').innerHTML = OPENING.map((_, k) => `<i class="${k === op.i ? 'on' : k < op.i ? 'past' : ''}"></i>`).join('');
  opSet(() => { op.phase = 'hold'; opSet(opOut, opHold(op.i)); }, OP_T.fadeIn);
}
function opHold(i) { return Math.max(OP_T.hold, OPENING[i].length * .085); } // ~5s for short paras, ~6.7s for the longer 3rd
function opOut() { if (op.done || op.phase === 'out') return; op.phase = 'out'; const t = $('optxt'); t.style.transition = `opacity ${OP_T.fadeOut}s ease-in-out`; t.style.opacity = 0; opSet(opNext, OP_T.fadeOut + OP_T.gap); }
function opTap() { if (op.done) return; if (op.phase === 'in' || op.phase === 'hold') opOut(); }
function endOpening() { if (op.done) return; op.done = true; clearTimeout(op.timer); $('opening').style.display = 'none'; startTutorial(); }
onTap($('opskip'), () => { op.skipT = performance.now(); endOpening(); });
$('opening').addEventListener('click', e => { if (e.target.id === 'opskip' || performance.now() - (op.skipT || 0) < 800) return; opTap(); });
function toastTitle(t) { const el = $('saveinfo'); el.style.display = 'block'; el.textContent = t; el.classList.remove('warn'); void el.offsetWidth; el.classList.add('warn'); }
/* onTap: fire on touchend (a real tap: same finger, moved < 12px) AND on click, de-duplicated — so UI buttons respond
   on iOS Safari even if the synthesized click is lost (e.g. canvas/rAF busy, viewport bars resizing). */
function onTap(el, fn) {
  let tid = null, sx = 0, sy = 0, moved = false, lastTap = -1e9;
  el.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (!t || tid !== null) return; tid = t.identifier; sx = t.clientX; sy = t.clientY; moved = false; }, { passive: true });
  el.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === tid && Math.hypot(t.clientX - sx, t.clientY - sy) > 12) moved = true; }, { passive: true });
  el.addEventListener('touchcancel', () => { tid = null; }, { passive: true });
  el.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === tid) { tid = null; if (moved) return; const tgt = document.elementFromPoint(t.clientX, t.clientY) || e.target; if (!el.contains(tgt)) return; e.preventDefault(); lastTap = performance.now(); fn({ target: tgt, stopPropagation() { }, type: 'tap' }); } }, { passive: false });
  el.addEventListener('click', e => { if (performance.now() - lastTap < 800) return; fn(e); });
}
function closeSlots() { $('slots').style.display = 'none'; refreshTitle(); }
onTap($('go'), startNewSave);
onTap($('newsave'), startNewSave);
onTap($('cont'), showSlots);   // 继续游戏 → save list (last-used first, marked 上次游玩)
onTap($('slotback'), closeSlots);
onTap($('slotlist'), e => { const row = e.target.closest && e.target.closest('.slot'); if (!row) return; const btn = e.target.closest('button'), id = row.dataset.id, d = loadSave(id); if (!d) return;
  if (!btn || btn.dataset.act === 'go') enterSlot(id);   // tapping anywhere on the row (except 删除) enters that save
  else showConfirm('删除存档', `确定删除剑修「${d.name}」（Lv${d.lv}）的存档吗？此操作无法撤销。`, () => { deleteSave(id); refreshTitle(); if (listSaves().length) showSlots(); else $('slots').style.display = 'none'; }); });
onTap($('cfmno'), () => { $('confirm').style.display = 'none'; confirmYes = null; });
onTap($('cfmyes'), () => { $('confirm').style.display = 'none'; const f = confirmYes; confirmYes = null; f && f(); });
requestAnimationFrame(frame);
// debug / test hooks
window.__G = { renderer, camera, vCam, vRoot, rHand, lHand, player, enemies, shixiong, zheng, SK, tryCast, tut, VM, wj, zones, decoy, ult, fly, cut,
  get state() { return state; }, set state(v) { state = v; }, get mode() { return mode; }, get camY() { return camY; }, set timeScale(v) { timeScale = v; },
  step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) { if (state === 'title') titleUpdate(dt); else if (state === 'play' || state === 'cut' || state === 'win' || state === 'dead' || state === 'talk') update(dt); } },
  start() { $('go').click(); }, next() { completeStep(); }, skip() { skipTutorial(); }, valley(n) { startValley(n || '测试剑修'); },
  resetCd() { for (const k in SK) SK[k].t = 0; }, TUNE, ZHENG, FLY, JY, jyAim, joy, IN, resetInputs, get atkHeld() { return atkHeld; }, get camPtr() { return camPtr; }, spawnMinion, saveGame, loadSave, wipeSave, newCareer, listSaves, deleteSave, enterSlot, showSlots, get activeSlot() { return activeSlot; }, op, playOpening, endOpening, startValley, hitEnemy, get parryCount() { return parryCount; }, get rideRams() { return rideRams; }, get jyTarget() { return jyTarget; }, tp(x, z, yaw) { player.x = x; player.z = z; if (yaw !== undefined) player.yaw = yaw; camY = H(x, z) + 1.7; },
  face(e, d) { const a = Math.atan2(player.x - e.x, player.z - e.z); player.yaw = Math.atan2(-(e.x - player.x), -(e.z - player.z)); },
  pose(rk, lk, lmode) { playVM('test', 1e9, rk ? [rk, rk] : null, lk ? [lk, lk] : null, [], lmode || 'jz'); VM.hold = true; }, RK, LK, LF, setWorld, startZhengAct, startShixiongAct, hurtPlayer };
/* ================= v4 · 第一章 学院 — worlds ================= */
/* collision: axis-aligned boxes + circles + hard bounds clamp. resolve(x,z,r) → [x,z] */
function makeCollider(boxes, cols, bounds, dyn) {
  return function resolve(x, z, r) {
    for (let it = 0; it < 4; it++) {
      for (const b of boxes) {
        if (b.off) continue;
        const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; }
        else { const pl = x - b.x0, pr = b.x1 - x, pd = z - b.z0, pu = b.z1 - z, m = Math.min(pl, pr, pd, pu); if (m === pl) x = b.x0 - r; else if (m === pr) x = b.x1 + r; else if (m === pd) z = b.z0 - r; else z = b.z1 + r; }
      }
      for (const c of cols) { if (c.off) continue; const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), mn = c.r + r; if (d < mn) { if (d > 1e-4) { x = c.x + dx / d * mn; z = c.z + dz / d * mn; } else x = c.x + mn; } }
      if (dyn) for (const c of dyn) { if (!c.solid || c.world !== world.name) continue; const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), mn = c.r + r; if (d < mn && d > 1e-4) { x = c.x + dx / d * mn; z = c.z + dz / d * mn; } }
      x = clamp(x, bounds.x0 + r, bounds.x1 - r); z = clamp(z, bounds.z0 + r, bounds.z1 - r);
    }
    return [x, z];
  };
}
const npcSolids = []; // dynamic NPC circles {x,z,r,solid}
/* gabled roof (ridge along X), curved eaves; returns geometry centred at origin, base y=0 */
function roofGeo(w, d, h, over = 1.0) {
  const a = d / 2 + over, s = new THREE.Shape();
  s.moveTo(-a, -.05); s.quadraticCurveTo(-a * .42, h * .2, 0, h); s.quadraticCurveTo(a * .42, h * .2, a, -.05);
  s.lineTo(a - .05, -.32); s.quadraticCurveTo(a * .42, h * .2 - .32, 0, h - .34); s.quadraticCurveTo(-a * .42, h * .2 - .32, -a + .05, -.32); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w + over * 2, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -(w + over * 2) / 2); g.rotateY(Math.PI / 2); return g;
}
function gableGeo(d, h) { const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: false }); g.translate(0, 0, -.15); g.rotateY(Math.PI / 2); return g; }
const ACW = { wall: .8, h: 4.6 };
/* building with 4 walls, door gap on the south (+z) side; pushes collision boxes + visual pieces */
function addBuilding(L, boxes, b) {
  const { x0, x1, z0, z1, dx0, dx1 } = b, t = ACW.wall, H = b.h || ACW.h, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const walls = [[x0, x1, z0, z0 + t], [x0, x0 + t, z0, z1], [x1 - t, x1, z0, z1], [x0, dx0, z1 - t, z1], [dx1, x1, z1 - t, z1]];
  for (const [a0, a1, c0, c1] of walls) { boxes.push({ x0: a0, x1: a1, z0: c0, z1: c1 }); L.push([G.box, 0xf6f4ee, M4((a0 + a1) / 2, H / 2, (c0 + c1) / 2, a1 - a0, H, c1 - c0)]); L.push([G.box, 0xb9b2a4, M4((a0 + a1) / 2, .25, (c0 + c1) / 2, a1 - a0 + .12, .5, c1 - c0 + .12)]); }
  // lintel over door, dark-wood frame + wooden beams along walls (fairy-white with timber accents)
  L.push([G.box, 0xf6f4ee, M4((dx0 + dx1) / 2, H - .5, z1 - t / 2, dx1 - dx0, 1, t)]);
  for (const x of [dx0, dx1]) L.push([G.box, 0x7a5236, M4(x, (H - 1) / 2, z1 - t / 2, .22, H - 1, t + .14)]);
  L.push([G.box, 0x7a5236, M4((dx0 + dx1) / 2, H - 1, z1 - t / 2, dx1 - dx0 + .3, .2, t + .14)]);
  L.push([G.box, 0x7a5236, M4(cx, H - .15, z1 + .02, W + .1, .22, .1)]); L.push([G.box, 0x7a5236, M4(cx, H - .15, z0 - .02, W + .1, .22, .1)]);
  for (let x = x0 + 4; x < x1 - 2; x += 4) { if (x > dx0 - 1 && x < dx1 + 1) continue; L.push([G.box, 0x7a5236, M4(x, H / 2, z1 + .03, .18, H, .08)]); L.push([new THREE.CircleGeometry(.7, 8), 0x9ac8d8, M4(x + 2, H * .58, z1 + .04, 1, 1, 1)]); }
  // plaque above door
  if (b.plaque) L.push([G.box, 0x3a2418, M4((dx0 + dx1) / 2, H + .25, z1 + .2, 3.2, 1, .12)]);
  // ceiling + roof
  L.push([G.box, 0xe0b888, M4(cx, H + .05, cz, W, .1, D)]);
  L.push([roofGeo(W, D, b.rh || 3.4, 1.1), 0xdfe6ee, M4(cx, H, cz)]);
  for (const x of [x0 + .2, x1 - .2]) L.push([gableGeo(D - .2, (b.rh || 3.4) - .4), 0xf6f4ee, M4(x, H, cz)]);
  L.push([G.cyl, 0xc8d0dc, M4(cx, H + (b.rh || 3.4) - .05, cz, .22, W + 2.6, .22, 0, 0, Math.PI / 2)]);
  // floor (slightly raised wood visual; walkable since ground height stays 0)
  L.push([G.box, b.floor || 0xc8a87e, M4(cx, .015, cz, W - .1, .03, D - .1)]);
}
/* v4.3 academy facilities: 药房, 食堂, 弟子居所, 大钟楼, 测灵石台 (all merged into the static mesh) */
function addFacilities(L, boxes, cols) {
  const A = ACAD, P = A.pharm, D = A.dining, M = A.dorm, B = A.bell;
  addBuilding(L, boxes, { ...P, plaque: true, floor: 0xb89a70 });
  addBuilding(L, boxes, { ...D, plaque: true, floor: 0xc0a074 });
  addBuilding(L, boxes, { ...M, plaque: true, floor: 0xc8a87e });
  const box = (x0, x1, z0, z1, h, c, solid = true) => { if (solid) boxes.push({ x0, x1, z0, z1 }); L.push([G.box, c, M4((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0)]); };
  const jarC = [0x8a5a3a, 0x6a7a5a, 0xa8986a, 0x5a4a3a, 0x9a3a2a];
  // 药房: back shelves of jars, counter with herbs, drying racks, baskets
  box(P.x0 + 1, P.x1 - 1, P.z0 + .8, P.z0 + 1.5, 3, 0x5a3420);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 14; k++) { const x = P.x0 + 1.5 + k * .8; L.push([G.cyl, jarC[(k + r) % 5], M4(x, .6 + r * .95, P.z0 + 1.62, .22, .5, .22)]); L.push([G.box, 0x6a4028, M4((P.x0 + P.x1) / 2, .32 + r * .95, P.z0 + 1.2, P.x1 - P.x0 - 2, .06, .8)]); }
  box(P.x0 + 3, P.x1 - 3, -36.4, -35.6, 1.05, 0x6a4028);
  for (let k = 0; k < 6; k++) { L.push([G.sphLo, k % 2 ? 0x6a9a4a : 0x8aaa5a, M4(P.x0 + 4 + k * 1.2, 1.15, -36, .35, .18, .3)]); }
  L.push([G.box, 0x3a2a1a, M4(P.x0 + 6.2, 1.12, -36, .5, .04, .35)]); // scale tray
  for (const x of [P.x0 + 1.6, P.x1 - 1.6]) { cols.push({ x, z: -32, r: .55 }); L.push([G.cyl, 0x9a7a4a, M4(x, .35, -32, .5, .7, .5)]); L.push([G.sphLo, 0x5a8a3a, M4(x, .75, -32, .45, .25, .45)]); }
  for (let k = 0; k < 7; k++) L.push([G.box, k % 2 ? 0x7a9a5a : 0xa89a5a, M4(P.x0 + 2 + k * 1.6, 3.6, -38.5, .25, .7, .06)]); L.push([G.cyl, 0x5a3420, M4((P.x0 + P.x1) / 2, 3.95, -38.5, .04, P.x1 - P.x0 - 2, .04, 0, 0, Math.PI / 2)]);
  // 食堂: two long tables with benches, stove + big pot, rice barrels
  for (const tx of [D.x0 + 3.4, D.x1 - 3.4]) { box(tx - 1.5, tx + 1.5, -38.5, -30.5, .2, 0x7a5236); L.push([G.box, 0x6a4028, M4(tx, .78, -34.5, 1.3, .08, 8)]); for (const bx of [-1.15, 1.15]) L.push([G.box, 0x5a3420, M4(tx + bx, .42, -34.5, .4, .06, 7.6)]);
    for (let k = 0; k < 5; k++) L.push([G.cyl, 0xf0ead8, M4(tx + (k % 2 ? .35 : -.35), .86, -37.5 + k * 1.5, .16, .06, .16)]); }
  box(-58.2, -53.8, D.z0 + .8, D.z0 + 2, 1.1, 0x8a8478); L.push([G.cyl, 0x2a2420, M4(-56, 1.35, D.z0 + 1.4, .8, .5, .8)]); L.push([G.cyl, 0x5a5048, M4(-56, 3.2, D.z0 + 1.1, .25, 3, .25)]);
  for (const x of [D.x0 + 1.4, D.x1 - 1.4]) { cols.push({ x, z: D.z0 + 1.6, r: .55 }); L.push([G.cyl, 0x9a7a4a, M4(x, .5, D.z0 + 1.6, .5, 1, .5)]); }
  // 弟子居所: beds along the side walls, low tables
  for (const bx of [M.x0 + 1.9, M.x1 - 1.9]) for (const bz of [-58.2, -55, -51.8]) { box(bx - 1.1, bx + 1.1, bz - .55, bz + .55, .5, 0x7a5236); L.push([G.box, 0xe8e0cc, M4(bx, .55, bz, 2, .1, .9)]); L.push([G.box, 0x6a8ab8, M4(bx + (bx < -56 ? -.7 : .7), .62, bz, .45, .1, .7)]); }
  cols.push({ x: -56, z: -56.5, r: .6 }); L.push([G.cyl, 0x6a4028, M4(-56, .3, -56.5, .6, .6, .6)]);
  // 大钟楼: stone base, red pillars, bell, double roof
  box(B.x - 2.5, B.x + 2.5, B.z - 2.5, B.z + 2.5, 1.2, 0xd8d2c4);
  for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) L.push([G.cyl, 0x9a3a2a, M4(B.x + px, 6, B.z + pz, .3, 9.6, .3)]);
  L.push([G.box, 0xf6f4ee, M4(B.x, 3, B.z, 3.6, 3.6, 3.6)]); L.push([G.box, 0x7a5236, M4(B.x, 7.2, B.z, 4.6, .3, 4.6)]);
  L.push([G.cyl, 0x8a6a3a, M4(B.x, 8.9, B.z, 1.1, 2, 1.1)]); L.push([G.cone, 0x8a6a3a, M4(B.x, 10.25, B.z, 1, .8, 1)]); L.push([G.cyl, 0x5a3420, M4(B.x, 10.8, B.z, .12, 4.4, .12, 0, 0, Math.PI / 2)]);
  L.push([G.cone, 0xdfe6ee, M4(B.x, 12.2, B.z, 4.4, 1.8, 4.4, Math.PI / 4)]); L.push([G.cone, 0xdfe6ee, M4(B.x, 14, B.z, 2.6, 1.6, 2.6, Math.PI / 4)]); L.push([G.sph, 0xd8b25a, M4(B.x, 15.1, B.z, .3, .3, .3)]);
  // spirit-stone pedestal in the square
  cols.push({ x: A.ling.x, z: A.ling.z, r: .9 }); L.push([G.cyl, 0xd8d2c4, M4(A.ling.x, .55, A.ling.z, .85, 1.1, .85)]); L.push([G.cyl, 0xb8b2a4, M4(A.ling.x, 1.12, A.ling.z, .65, .1, .65)]);
}
/* ground texture painted from world rects (X -48..48, Z -66..44) */
const ACG = { x0: -68, x1: 68, z0: -66, z1: 44 };
function acadGroundTex(paint) {
  return canvasTex(2048, 2048, (c, w, h) => {
    const sx = w / (ACG.x1 - ACG.x0), sz = h / (ACG.z1 - ACG.z0);
    const R = (x0, x1, z0, z1, col) => { c.fillStyle = col; c.fillRect((x0 - ACG.x0) * sx, (z0 - ACG.z0) * sz, (x1 - x0) * sx, (z1 - z0) * sz); };
    const C = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.ellipse((x - ACG.x0) * sx, (z - ACG.z0) * sz, r * sx, r * sz, 0, 0, 7); c.fill(); };
    paint({ c, R, C, sx, sz, w, h });
  });
}
function buildAcademyWorld() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const boxes = [], cols = [], L = [], bounds = { x0: -65.4, x1: 65.4, z0: -63.4, z1: 41.4 };
  const A = ACAD;
  // ---- ground
  const tex = acadGroundTex(({ c, R, C, w, h, sx, sz }) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#86b866'); gr.addColorStop(1, '#9cc874'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${40 + Math.random() * 60},${90 + Math.random() * 70},${30 + Math.random() * 40},${Math.random() * .25})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 0, 7); c.fill(); }
    R(-44, -16, -28, -4, '#a6d67e'); // 学堂 lawn
    for (let i = 0; i < 260; i++) { const x = srnd(-43.5, -16.5), z = srnd(-27.5, -4.5); if (Math.abs(x + 30) < 4) continue; C(x, z, .18, ['#fff6f0', '#ffd0e0', '#fff0a0', '#d8c8ff'][i % 4]); }
    const stone = '#e4e0d4', stoneL = '#d2ccbc';
    R(-3, 3, -30, 41.5, stone); R(-33, -3, -3, 3, stone); R(-33, -27, -30, -3, stone); R(3, 13, -3, 3, stone); R(-16, 16, -42, -30, stone);
    R(13, 39, -25, 1, '#dcd6c6'); // 练武场
    c.strokeStyle = '#b8ad96'; c.lineWidth = 10; c.beginPath(); c.ellipse((A.ring.x - ACG.x0) * sx, (A.ring.z - ACG.z0) * sz, A.ring.r * sx, A.ring.r * sz, 0, 0, 7); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.ellipse((A.ring.x - ACG.x0) * sx, (A.ring.z - ACG.z0) * sz, (A.ring.r - 1) * sx, (A.ring.r - 1) * sz, 0, 0, 7); c.stroke();
    c.save(); c.translate((A.ring.x - ACG.x0) * sx, (A.ring.z - ACG.z0) * sz); c.fillStyle = 'rgba(120,100,70,.35)'; c.font = `bold ${Math.round(9 * sx)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('武', 0, 0); c.restore();
    // tile seams on stone areas
    c.strokeStyle = 'rgba(140,130,110,.35)'; c.lineWidth = 1.5;
    for (let z = -42; z < 41; z += 1.5) { c.beginPath(); c.moveTo((-3 - ACG.x0) * sx, (z - ACG.z0) * sz); c.lineTo((3 - ACG.x0) * sx, (z - ACG.z0) * sz); c.stroke(); }
    for (let x = 13; x <= 39; x += 2) { c.beginPath(); c.moveTo((x - ACG.x0) * sx, (-25 - ACG.z0) * sz); c.lineTo((x - ACG.x0) * sx, (1 - ACG.z0) * sz); c.stroke(); }
    for (let z = -25; z <= 1; z += 2) { c.beginPath(); c.moveTo((13 - ACG.x0) * sx, (z - ACG.z0) * sz); c.lineTo((39 - ACG.x0) * sx, (z - ACG.z0) * sz); c.stroke(); }
    // v4.3 expansion: 大广场, long east-west avenue, facility paths, bell-tower plaza
    C(A.square.x, A.square.z, A.square.r + .6, '#cfc8b6'); C(A.square.x, A.square.z, A.square.r, stone);
    c.strokeStyle = 'rgba(150,138,112,.5)'; c.lineWidth = 4; for (const rr of [3, 7, A.square.r - .4]) { c.beginPath(); c.ellipse((A.square.x - ACG.x0) * sx, (A.square.z - ACG.z0) * sz, rr * sx, rr * sz, 0, 0, 7); c.stroke(); }
    R(-64, -33, -3, 3, stone); R(39, 64, -3, 3, stone); R(13, 39, 1, 3, stone);
    R(A.pharm.dx0, A.pharm.dx1, A.pharm.z1, -3, stone); R(A.dining.dx0, A.dining.dx1, A.dining.z1, -3, stone);
    R(-48, -44, -47, -3, stone); R(A.dorm.dx0, -44, -47.5, -44, stone);
    C(A.bell.x, A.bell.z, 5.2, stoneL);
    // water beds
    for (const p of A.ponds) C(p.x, p.z, p.r + .5, '#cfc7b0');
    R(-68, 68, A.stream.z0 - .5, A.stream.z1 + .5, '#cfc7b0');
    for (const p of A.ponds) C(p.x, p.z, p.r, '#3f8fa0');
    R(-68, 68, A.stream.z0, A.stream.z1, '#3f8fa0');
    R(-5, 5, A.stream.z0 - 1, A.stream.z1 + 1, stoneL);
  });
  tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ACG.x1 - ACG.x0, ACG.z1 - ACG.z0), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((ACG.x0 + ACG.x1) / 2, 0, (ACG.z0 + ACG.z1) / 2); g.add(ground);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshLambertMaterial({ color: 0x8cb070 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -.05; g.add(outer);
  // ---- outer wall (white with blue-grey tile cap) + gate
  const OW = [[-66.6, 66.6, 41.4, 42.6], [-66.6, 66.6, -64.6, -63.4], [-66.6, -65.4, -64.6, 42.6], [65.4, 66.6, -64.6, 42.6]];
  for (const [a0, a1, c0, c1] of OW) { boxes.push({ x0: a0, x1: a1, z0: c0, z1: c1 }); const cx = (a0 + a1) / 2, cz = (c0 + c1) / 2, w = a1 - a0, d = c1 - c0; L.push([G.box, 0xf8f6f0, M4(cx, 1.6, cz, w, 3.2, d)]); L.push([G.box, 0x9aa8b8, M4(cx, 3.3, cz, w + .5, .25, d + .5)]); L.push([G.box, 0xb4beca, M4(cx, 3.5, cz, w * .98 + .1, .2, d * .5 + .1)]); }
  // gate (山门): pillars + roof on south wall; doors shown closed-ish with mist beyond
  for (const x of [-4.5, 4.5]) { L.push([G.cyl, 0x9a3a2a, M4(x, 3, 42, .45, 6, .45)]); L.push([G.box, 0xd8d2c4, M4(x, .3, 42, 1.4, .6, 1.4)]); }
  L.push([G.box, 0x7a5236, M4(0, 5.6, 42, 10, .5, .7)]); L.push([G.box, 0x3a2418, M4(0, 4.6, 42, 3.6, 1.2, .9)]);
  L.push([roofGeo(10, 2.4, 1.6, .8), 0xdfe6ee, M4(0, 5.85, 42)]);
  L.push([G.box, 0x6a4028, M4(-2.2, 2.3, 42.15, 4.2, 4.6, .2)]); L.push([G.box, 0x6a4028, M4(2.2, 2.3, 42.15, 4.2, 4.6, .2)]);
  for (const x of [-1.2, 1.2]) L.push([G.cyl, 0xd8b25a, M4(x * .9, 2.3, 42, .15, .06, .15, 0, Math.PI / 2)]);
  // ---- buildings
  addBuilding(L, boxes, { ...A.school, plaque: true, floor: 0xd2b48a });
  addBuilding(L, boxes, { ...A.lib, plaque: true, h: 5.2, rh: 4, floor: 0xb89268 });
  addFacilities(L, boxes, cols);
  // 学堂 interior: desks, cushions, scrolls, teacher desk
  for (const x of [-36, -30, -24]) for (const z of [-42, -38.5, -35]) {
    boxes.push({ x0: x - .8, x1: x + .8, z0: z - .35, z1: z + .35 });
    L.push([G.box, 0x6a4028, M4(x, .42, z, 1.6, .08, .7)]); for (const sx of [-.7, .7]) L.push([G.box, 0x5a3420, M4(x + sx, .2, z, .1, .4, .6)]);
    L.push([G.box, 0xf0ead8, M4(x - .3, .47, z, .5, .02, .35)]); L.push([G.cyl, 0x2a1a10, M4(x + .4, .5, z - .1, .04, .1, .04)]);
    L.push([G.cyl, 0x8a3a3a, M4(x, .06, z + .75, .32, .12, .32)]);
  }
  boxes.push({ x0: -31, x1: -29, z0: -44.35, z1: -43.65 }); L.push([G.box, 0x5a3420, M4(-30, .45, -44, 2, .9, .7)]); L.push([G.cyl, 0x6a2a6a, M4(-30, .06, -44.9, .35, .12, .35)]);
  for (const [x, z, ry] of [[-36, -45.15, 0], [-24, -45.15, 0], [-30, -45.15, 0], [-41.15, -40, Math.PI / 2], [-41.15, -34, Math.PI / 2], [-18.85, -40, -Math.PI / 2], [-18.85, -34, -Math.PI / 2]]) {
    L.push([G.box, 0xf4ecd6, M4(x, 2.6, z, 1.1, 2.2, .03, ry)]); L.push([G.box, 0x6a4028, M4(x, 3.75, z, 1.3, .08, .06, ry)]); L.push([G.box, 0x6a4028, M4(x, 1.45, z, 1.3, .08, .06, ry)]);
    for (let k = 0; k < 4; k++) L.push([G.box, 0x2a2420, M4(x + (ry ? 0 : (k - 1.5) * .2), 2.6 + (k % 2) * .2, z + (ry ? (k - 1.5) * .2 * (ry > 0 ? 1 : -1) : 0) + (ry ? 0 : .02), ry ? .03 : .06, 1.2 - k * .12, ry ? .06 : .03, ry)]);
  }
  // 图书馆 interior: 6 bookshelves, long table, lectern, reading desk
  const bookCols = [0x8a2a2a, 0x2a4a7a, 0x3a6a3a, 0x8a6a2a, 0x5a3a6a, 0xd8c8a0];
  for (const x of A.shelfX) {
    boxes.push({ x0: x - .4, x1: x + .4, z0: A.shelfZ0, z1: A.shelfZ1 });
    const zc = (A.shelfZ0 + A.shelfZ1) / 2, len = A.shelfZ1 - A.shelfZ0;
    L.push([G.box, 0x5a3420, M4(x, 1.6, zc, .8, 3.2, len)]);
    for (let s = 0; s < 4; s++) for (let k = 0; k < 14; k++) { const z = A.shelfZ0 + .3 + k * (len - .6) / 13, hh = srnd(.32, .48); for (const side of [-1, 1]) L.push([G.box, bookCols[(k + s + (side > 0 ? 2 : 0)) % 6], M4(x + side * .41, .25 + s * .78 + hh / 2, z, .04, hh, srnd(.34, .46))]); }
  }
  boxes.push({ x0: -1, x1: 1, z0: -56, z1: -50 }); L.push([G.box, 0x6a4028, M4(0, .78, -53, 2, .1, 6)]); for (const [sx, sz] of [[-.85, -55.8], [.85, -55.8], [-.85, -50.2], [.85, -50.2]]) L.push([G.box, 0x5a3420, M4(sx, .38, sz, .12, .76, .12)]);
  for (let k = 0; k < 4; k++) { L.push([G.box, 0xf0ead8, M4(srnd(-.5, .5), .86, -55 + k * 1.4, .4, .06, .3, srnd(-.4, .4))]); }
  L.push([G.cyl, 0xffe8a0, M4(0, .95, -51, .08, .2, .08)]);
  cols.push({ x: A.book.x, z: A.book.z, r: .45 }); L.push([G.cyl, 0x5a3420, M4(A.book.x, .5, A.book.z, .12, 1, .12)]); L.push([G.box, 0x6a4028, M4(A.book.x, 1.05, A.book.z, .8, .08, .6, 0, -.35)]);
  boxes.push({ x0: 7.3, x1: 9.7, z0: -46.5, z1: -45.5 }); L.push([G.box, 0x6a4028, M4(8.5, .75, -46, 2.4, .1, 1)]); for (const sx of [-1.1, 1.1]) L.push([G.box, 0x5a3420, M4(8.5 + sx, .37, -46, .1, .74, .9)]);
  // ---- stream + ponds (collision) + bridge
  const S = A.stream;
  boxes.push({ x0: -66, x1: -5, z0: S.z0 + .3, z1: S.z1 - .3 }, { x0: 5, x1: 66, z0: S.z0 + .3, z1: S.z1 - .3 });
  for (const p of A.ponds) cols.push({ x: p.x, z: p.z, r: p.r - .2 });
  for (const sx of [-1, 1]) { boxes.push({ x0: sx > 0 ? 4.7 : -5.3, x1: sx > 0 ? 5.3 : -4.7, z0: S.z0 - .8, z1: S.z1 + .8 }); L.push([G.box, 0xc84a3a, M4(sx * 5, .55, (S.z0 + S.z1) / 2, .3, 1.1, S.z1 - S.z0 + 1.6)]); L.push([G.box, 0xeae6da, M4(sx * 5, 1.1, (S.z0 + S.z1) / 2, .4, .12, S.z1 - S.z0 + 1.7)]); }
  L.push([G.box, 0xd8d2c4, M4(0, .04, (S.z0 + S.z1) / 2, 10, .08, S.z1 - S.z0 + 2)]);
  // ---- 练武场 props: weapon racks, drums, banner poles (outside the ring)
  for (const z of [-20, -4]) { boxes.push({ x0: 40.6, x1: 41.4, z0: z - 2.5, z1: z + 2.5 }); L.push([G.box, 0x6a4028, M4(41, 1, z, .3, 2, 5)]); for (let k = -2; k <= 2; k++) { L.push([G.cyl, 0xb8c0c8, M4(40.85, 1.2, z + k, .03, 2, .03)]); L.push([G.cone, 0xd0d8e0, M4(40.85, 2.35, z + k, .06, .3, .06)]); } }
  for (const [x, z] of [[15, -24], [37, -24], [15, 0], [37, 0]]) { cols.push({ x, z, r: .4 }); L.push([G.cyl, 0x9a3a2a, M4(x, 2.5, z, .12, 5, .12)]); L.push([G.box, 0xc84a3a, M4(x + .5, 3.8, z, 1, 1.8, .04)]); }
  cols.push({ x: 26, z: -26.5, r: .9 }); L.push([G.cyl, 0x8a2a1a, M4(26, .9, -26.5, .8, 1, .8, 0, 0, 0)]); L.push([G.cyl, 0xf0e2c0, M4(26, 1.42, -26.5, .78, .04, .78)]);
  // ---- pavilion by the west pond
  for (const [x, z] of [[-16, 27], [-11, 27], [-16, 33], [-11, 33]]) { cols.push({ x, z, r: .3 }); L.push([G.cyl, 0x9a3a2a, M4(x, 1.75, z, .2, 3.5, .2)]); }
  L.push([G.box, 0xd8d2c4, M4(-13.5, .05, 30, 6.4, .1, 7.4)]); L.push([G.cone, 0xdfe6ee, M4(-13.5, 4.4, 30, 5.6, 1.9, 5.6, Math.PI / 4)]); L.push([G.sph, 0xd8b25a, M4(-13.5, 5.45, 30, .25, .25, .25)]);
  cols.push({ x: -13.5, z: 30, r: .6 }); L.push([G.cyl, 0xe8e2d4, M4(-13.5, .4, 30, .6, .8, .6)]);
  // ---- stone lanterns along the main path
  const lanternPts = []; for (const [x, z] of [[-52, 4.4], [-44, -4.4], [-22, 4.4], [-14, -4.4], [46, 4.4], [60, -4.4], [46, -4.4]]) lanternPts.push([x, z]);
  for (let z = 36; z > -28; z -= 9) { if (Math.abs(z - (S.z0 + S.z1) / 2) < 5 || (z > -19.5 && z < 7.5)) continue; for (const x of [-4.4, 4.4]) lanternPts.push([x, z]); }
  for (const [x, z] of lanternPts) { cols.push({ x, z, r: .38 }); L.push([G.box, 0xd8d2c4, M4(x, .5, z, .5, 1, .5)]); L.push([G.box, 0xfff2c0, M4(x, 1.2, z, .42, .4, .42)]); L.push([G.cone, 0xb8b2a4, M4(x, 1.65, z, .5, .5, .5, Math.PI / 4)]); }
  // ---- rocks (怪石) with collision
  for (const [x, z, s] of [[30, 36, 1.2], [36, 24, 1.4], [-38, 22, 1.3], [-8, 34, 1.0], [12, 30, 1.1], [-42, 6, 1.2], [42, 10, 1.3], [-10, -58, 1.1], [30, -55, 1.4]]) {
    cols.push({ x, z, r: s * .9 }); const geo = new THREE.IcosahedronGeometry(1, 1); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const n = .75 + .4 * vnoise(p.getX(i) * 2 + x, p.getZ(i) * 2 + z); p.setXYZ(i, p.getX(i) * n, (p.getY(i) * .5 + .5) * 2.2 * n, p.getZ(i) * n); } geo.computeVertexNormals(); L.push([geo, 0xa8aab0, M4(x, -.1, z, s, s, s, srnd(0, 6))]);
  }
  // ---- trees (instanced): blossom + pine, placed by rejection sampling against everything above
  const clearOf = (x, z, r) => {
    if (x < bounds.x0 + 1.5 || x > bounds.x1 - 1.5 || z < bounds.z0 + 1.5 || z > bounds.z1 - 1.5) return false;
    for (const b of boxes) { const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1); if (Math.hypot(x - cx, z - cz) < r + 1.6) return false; }
    for (const c of cols) if (Math.hypot(x - c.x, z - c.z) < r + c.r + 1.6) return false;
    for (const q of A.keepClear) if (x > q[0] - r && x < q[1] + r && z > q[2] - r && z < q[3] + r) return false;
    return true;
  };
  const trees = [];
  for (let tries = 0; tries < 7000 && trees.length < 96; tries++) { const x = srnd(-65, 65), z = srnd(-63, 41); if (!clearOf(x, z, .55)) continue; const t = { x, z, r: .55, kind: srand() < .55 ? 0 : 1, s: srnd(.85, 1.3) }; trees.push(t); cols.push({ x, z, r: .55 }); }
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const blossomG = mergeColored([[new THREE.CylinderGeometry(.16, .26, 2.6, 6), 0x6a4a3a, M4(0, 1.3, 0)], [new THREE.CylinderGeometry(.07, .1, 1.4, 5), 0x6a4a3a, M4(.5, 2.6, 0, 1, 1, 1, 0, 0, -.6)], [G.sphLo, 0xf6c4d4, M4(0, 3.4, 0, 1.6, 1.15, 1.6)], [G.sphLo, 0xfad8e4, M4(.9, 3.0, .4, 1.1, .85, 1.1)], [G.sphLo, 0xf0b0c8, M4(-.7, 3.1, -.5, 1.2, .9, 1.2)], [G.sphLo, 0xfce8ee, M4(.2, 3.9, -.3, .9, .7, .9)]]);
  const pineG = mergeColored([[new THREE.CylinderGeometry(.16, .26, 2.2, 6), 0x5a3d26, M4(0, 1.1, 0)], [new THREE.ConeGeometry(1.7, 2.6, 8), 0x2f6a44, M4(0, 2.8, 0)], [new THREE.ConeGeometry(1.3, 2.2, 8), 0x3a7a4c, M4(0, 4.1, 0)], [new THREE.ConeGeometry(.85, 1.8, 8), 0x4a8a58, M4(0, 5.2, 0)]]);
  const treeM = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const [geo, kind] of [[blossomG, 0], [pineG, 1]]) { const list = trees.filter(t => t.kind === kind); const im = new THREE.InstancedMesh(geo, treeM, Math.max(1, list.length)); list.forEach((t, i) => { im.setMatrixAt(i, mm.compose(V3(t.x, 0, t.z), q.setFromAxisAngle(Y_AXIS, srnd(0, 6)), V3(t.s, t.s * srnd(.9, 1.15), t.s))); }); im.count = list.length; g.add(im); }
  // shrubs / flower beds along the lawn edge and inner walls (no collision needed: kept against walls via box)
  const shr = [];
  for (let x = -43; x <= -17; x += 2.6) { if (Math.abs(x + 30) < 4) continue; shr.push([G.sphLo, srand() < .5 ? 0x5a9a4a : 0x6aaa52, M4(x, .35, -28.6, .9, .55, .6)]); shr.push([G.sphLo, 0xffc8d8, M4(x + .3, .7, -28.5, .25, .2, .25)]); }
  boxes.push({ x0: -44, x1: -34, z0: -29.1, z1: -28.1 }, { x0: -26, x1: -16, z0: -29.1, z1: -28.1 });
  // lotus pads on ponds
  for (const p of A.ponds) for (let i = 0; i < 14; i++) { const a = srnd(0, 6.28), r = Math.sqrt(srand()) * (p.r - .8); shr.push([new THREE.CircleGeometry(.35, 8), 0x4a9a4a, M4(p.x + Math.cos(a) * r, .08, p.z + Math.sin(a) * r, 1, 1, 1, srnd(0, 6), -Math.PI / 2)]); if (i % 3 === 0) shr.push([G.sphLo, 0xffb8d0, M4(p.x + Math.cos(a) * r, .2, p.z + Math.sin(a) * r, .14, .12, .14)]); }
  L.push(...shr);
  g.add(new THREE.Mesh(mergeColored(L), new THREE.MeshLambertMaterial({ vertexColors: true })));
  // ---- water (one transparent mesh)
  const wl = []; for (const p of A.ponds) wl.push([new THREE.CircleGeometry(p.r, 32), 0xffffff, M4(p.x, .03, p.z, 1, 1, 1, 0, -Math.PI / 2)]);
  wl.push([new THREE.PlaneGeometry(132, S.z1 - S.z0), 0xffffff, M4(0, .03, (S.z0 + S.z1) / 2, 1, 1, 1, 0, -Math.PI / 2)]);
  const waterM = new THREE.MeshStandardMaterial({ color: 0x7fd0e0, roughness: .06, metalness: .2, transparent: true, opacity: .62, envMapIntensity: 1.6, vertexColors: false });
  waterM.onBeforeCompile = sh => { sh.uniforms.t = timeU; sh.fragmentShader = 'uniform float t;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(normal + vec3(sin(vViewPosition.x*1.7+t*1.3)*.06, 0., cos(vViewPosition.z*1.9+t*1.1)*.06));'); };
  const water = new THREE.Mesh(mergeColored(wl), waterM); water.renderOrder = 1; g.add(water);
  // ---- distant scenery: misty peaks + clouds beyond the wall
  const pk = [];
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + srnd(-.1, .1), r = srnd(140, 260), h = srnd(40, 110), w = h * srnd(.35, .55); pk.push([new THREE.ConeGeometry(1, 1, 7, 3), i % 2 ? 0x8aa0b8 : 0x9ab0c4, M4(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r, w, h, w, srnd(0, 6))]); pk.push([new THREE.ConeGeometry(1, 1, 7), 0xf4f6fa, M4(Math.cos(a) * r, h * .86 - 8, Math.sin(a) * r, w * .3, h * .3, w * .3)]); }
  g.add(new THREE.Mesh(mergeColored(pk), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const cl = []; for (let i = 0; i < 26; i++) { const a = srnd(0, 6.28), r = srnd(80, 240); blobCloud(cl, Math.cos(a) * r, srnd(-2, 14), Math.sin(a) * r, srnd(8, 18), 5, 0xffffff, .35); }
  for (let i = 0; i < 10; i++) { const a = srnd(0, 6.28), r = srnd(200, 420); blobCloud(cl, Math.cos(a) * r, srnd(70, 130), Math.sin(a) * r, srnd(18, 34), 5, 0xfff4f8, .3); }
  const clouds = new THREE.Mesh(mergeColored(cl), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xb0b8c8, emissiveIntensity: .5, transparent: true, opacity: .9 })); g.add(clouds);
  // ---- 牌匾 「天剑学院」 (both faces of the gate beam)
  const plaqueTex = canvasTex(512, 160, (c, w, h) => { c.fillStyle = '#2a170e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8b25a'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#f0cf72'; c.font = 'bold 104px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('天剑学院', w / 2, h / 2 + 4); });
  const plM = new THREE.MeshBasicMaterial({ map: plaqueTex }); for (const [z, ry] of [[42.47, 0], [41.53, Math.PI]]) { const m = mk(new THREE.PlaneGeometry(3.4, 1.06), plM, g, 0, 4.6, z); m.rotation.y = ry; }
  // ---- 测灵根: spirit stone on a pedestal in the square
  const lingM = new THREE.MeshStandardMaterial({ color: 0xd8e8f0, emissive: 0x6080a0, emissiveIntensity: .3, roughness: .2, metalness: .1, flatShading: true });
  const lingStone = mk(new THREE.IcosahedronGeometry(.62, 0), lingM, g, A.ling.x, 1.75, A.ling.z, 1, 1.35, 1);
  const lingBeam = mk(new THREE.CylinderGeometry(.5, .9, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xb050ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), g, A.ling.x, 8, A.ling.z); lingBeam.visible = false;
  // ---- night dressing: lantern glows + moon (hidden by day)
  const glowL = lanternPts.map(([x, z]) => [G.sphLo, 0xffc070, M4(x, 1.2, z, .55, .45, .55)]);
  const lanternGlow = new THREE.Mesh(mergeColored(glowL), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })); lanternGlow.visible = false; g.add(lanternGlow);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xf4f0d8, fog: false })); moon.position.set(-120, 130, -260); moon.lookAt(0, 0, 0); moon.visible = false; g.add(moon);
  // ---- 漂浮书页 ×10
  const pageM = new THREE.MeshBasicMaterial({ color: 0xfff6dc, side: THREE.DoubleSide }), pageAura = auraMat(0xffe0a0, 1.4, 1.4);
  const pages = A.pages.map(([x, z], i) => { const pg = new THREE.Group(); pg.position.set(x, 1.4, z); g.add(pg); mk(new THREE.PlaneGeometry(.42, .56), pageM, pg, 0, 0, 0); mk(G.sph, pageAura, pg, 0, 0, 0, .55, .55, .55); pg.visible = false; return pg; });
  // ---- 御剑光环 ×6 (rings training)
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const flyRings = A.flyRings.map(([x, z, y], i) => { const rg = new THREE.Group(); rg.position.set(x, y, z); g.add(rg); mk(new THREE.TorusGeometry(1.9, .09, 6, 32), ringM, rg); mk(new THREE.TorusGeometry(2.1, .04, 4, 32), ringM, rg); const nx = A.flyRings[Math.min(i + 1, A.flyRings.length - 1)], pv = A.flyRings[Math.max(0, i - 1)]; rg.rotation.y = Math.atan2(nx[0] - pv[0], nx[1] - pv[1]); rg.visible = false; return rg; });
  // ---- library hidden door (visible only while 隐身) — own mesh, toggled by chapter logic
  const hd = new THREE.Group(); hd.position.set(A.hidden.x, 0, A.hidden.z + .05); g.add(hd);
  const doorTex = canvasTex(256, 384, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h * .55, 10, w / 2, h * .55, h * .6); gr.addColorStop(0, 'rgba(255,220,255,1)'); gr.addColorStop(.35, 'rgba(190,90,255,.95)'); gr.addColorStop(1, 'rgba(60,0,120,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,230,255,.95)'; c.lineWidth = 6; c.strokeRect(30, 40, w - 60, h - 50); c.font = 'bold 60px serif'; c.fillStyle = 'rgba(80,0,120,.8)'; c.textAlign = 'center'; c.fillText('魔', w / 2, h * .58); });
  const hdM = new THREE.MeshBasicMaterial({ map: doorTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  mk(new THREE.PlaneGeometry(2.6, 3.6), hdM, hd, 0, 1.8, 0);
  hd.visible = false;
  return {
    name: 'academy', group: g, R: 1e5, boxes, cols, bounds, resolve: makeCollider(boxes, cols, bounds, npcSolids), spawn: { x: 0, z: 36, yaw: 0 }, hiddenDoor: hd, hiddenMat: hdM, lingStone, lingM, lingBeam, lanternGlow, moon, pages, flyRings,
    H: () => 0, sky: [0x5a9ae0, 0xb8daf4, 0xeaf2f6], sunDir: V3(-.4, .7, -.45).normalize(), sunCol: [1, .95, .85], fog: [0xdce8f0, 60, 300],
    hemi: [0xf0f6ff, 0xa89a80, .95], sunL: [0xfff4e4, 1.9], ground: 0x9ab87a,
    update(dt) {
      clouds.rotation.y += dt * .003;
      if (Math.random() < .35) { const x = player.x + rand(-14, 14), z = player.z + rand(-14, 14); emit(x, rand(3, 7), z, rand(.2, .6), -rand(.3, .6), rand(-.2, .2), Math.random() < .6 ? 0xffc8dc : 0xffffff, .14, 4, 0); }
    },
  };
}
/* layout constants shared by world + chapter logic */
const ACAD = {
  school: { x0: -42, x1: -18, z0: -46, z1: -30, dx0: -32, dx1: -28 },
  lib: { x0: -13, x1: 13, z0: -60, z1: -42, dx0: -2.2, dx1: 2.2 },
  shelfX: [-10.2, -7, -3.8, 3.8, 7, 10.2], shelfZ0: -57.2, shelfZ1: -50.2,
  book: { x: -8.4, z: -46 }, hidden: { x: 0, z: -59.2 },
  ring: { x: 26, z: -12, r: 10 },
  square: { x: 0, z: -6, r: 12 }, ling: { x: 0, z: -8 },
  pharm: { x0: 48, x1: 62, z0: -42, z1: -30, dx0: 53.5, dx1: 56.5 }, dining: { x0: -64, x1: -48, z0: -42, z1: -26, dx0: -57.5, dx1: -54.5 }, dorm: { x0: -64, x1: -48, z0: -60, z1: -48, dx0: -57.5, dx1: -54.5 },
  bell: { x: -32, z: 8 }, dummy: { x: -30, z: -20 },
  pages: [[-40, 34], [-30, 12], [-58, -10], [-56, -34], [-38, -20], [8.5, -48.6], [18, 37], [44, -14], [55, -33], [58, 12]],
  flyRings: [[0, -24, 2.3], [-14, -1, 2.3], [-24, 8, 2.4], [-8, 10, 2.3], [14, 8, 2.3], [26, -12, 2.4]],
  stream: { z0: 16, z1: 20 },
  ponds: [{ x: -27, z: 30, r: 6 }, { x: 26, z: 30, r: 5.5 }],
  keepClear: [[-3.5, 3.5, -42, 42], [-34, -2, -3.5, 3.5], [-34, -26, -30, -2], [2, 13, -3.5, 3.5], [12, 42, -27, 3], [-17, 17, -43, -29], [-45, -15, -29, -3], [-6, 6, 14, 22], [-18, -9, 25, 35], [-13, 13, -19, 7], [-66, -33, -4, 4], [39, 66, -4, 4], [52, 58, -30, -3], [-59, -54, -26, -3], [-49, -43, -48, -3], [-58, -43, -48, -43], [-38, -26, 2, 14]],
};
ACAD.school.dx0 = -32; ACAD.school.dx1 = -28;
/* ===== 地宫 (underground palace) ===== */
/* ===== 地宫 (v4.3): entry corridor → 石门一 → 断崖大殿 (飞剑机关 · 升起石桥) → 石门二 → 圣书密室 ===== */
const DG = { x0: -10, x1: 10, z0: -16, z1: 14, pillars: [[-5.5, -7], [5.5, -7], [-5.5, 1], [5.5, 1], [-5.5, 8.5], [5.5, 8.5]], book: { x: 0, z: -12.6 },
  spawn: { x: 0, z: 56, yaw: 0 }, door1Z: 51, door2Z: 15, chasm: { z0: 19, z1: 45, hw: 2.25 }, nearEdge: { x: 0, z: 46.6 }, hallIn: { x: 0, z: 11.5 }, HW: 12 };
/* split stone door with a big round button; front face at zf (facing +z) */
function makeSplitDoor(g, zf, w, h, btnY, btnR) {
  const stoneM = new THREE.MeshLambertMaterial({ color: 0x4a3e58 }), btnM = new THREE.MeshStandardMaterial({ color: 0x2a1236, emissive: 0x8a30ff, emissiveIntensity: .7, roughness: .4, metalness: .3 });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xd090ff }), crackM = new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloM = new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }), glowM = new THREE.MeshBasicMaterial({ color: 0x8030d0, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const halves = [];
  for (const s of [-1, 1]) {
    const hg = new THREE.Group(); g.add(hg);
    const slab = new THREE.Mesh(G.box, stoneM); slab.scale.set(w / 2, h, .8); slab.position.set(s * w / 4, h / 2, zf - .5); hg.add(slab);
    for (let k = 0; k < 3; k++) mk(G.box, crackM, hg, s * w / 4, 1 + k * 1.6, zf - .08, w / 2 - .6, .06, .02); // rune lines
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(btnR, btnR, .24, 24, 1, false, s > 0 ? 0 : Math.PI, Math.PI), btnM); disc.rotation.x = Math.PI / 2; disc.position.set(0, btnY, zf + .02); hg.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(btnR * .78, .07, 6, 24, Math.PI), ringM); ring.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; ring.position.set(0, btnY, zf + .16); hg.add(ring);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(btnR * 1.22, .16, 6, 24, Math.PI), haloM); halo.rotation.z = ring.rotation.z; halo.position.set(0, btnY, zf + .05); hg.add(halo);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(btnR * 1.9, 20, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), glowM); glow.position.set(0, btnY, zf + .03); hg.add(glow);
    halves.push({ g: hg, s, disc, ring, halo, glow });
  }
  const crack = mk(G.box, new THREE.MeshBasicMaterial({ color: 0xe0a0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), g, 0, h / 2, zf + .05, .08, h, .05);
  return { halves, crack, btnM, k: 0, target: 0, open: false, zf, w, btnY, btnR };
}
function buildDigongWorld() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const C = DG.chasm, W = DG.HW, boxes = [], cols = [], L = [], bounds = { x0: -W + .6, x1: W - .6, z0: DG.z0 + .6, z1: 57.4 };
  const floorTex = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#2a2232'; c.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = 34 + Math.random() * 14; c.fillStyle = `rgb(${v},${v - 6},${v + 8})`; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } c.strokeStyle = 'rgba(190,90,255,.55)'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h * .25, 150, 0, 7); c.stroke(); c.beginPath(); c.arc(w / 2, h * .25, 110, 0, 7); c.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 110, h * .25 + Math.sin(a) * 110); c.lineTo(w / 2 + Math.cos(a + 2.1) * 110, h * .25 + Math.sin(a + 2.1) * 110); c.stroke(); } });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(DG.x1 - DG.x0, DG.z1 - DG.z0), new THREE.MeshLambertMaterial({ map: floorTex })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, (DG.z0 + DG.z1) / 2); g.add(fl);
  const wallC = 0x3a3044, Hh = 7, HB = 16, box = (x0, x1, y0, y1, z0, z1, c) => L.push([G.box, c, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0)]);
  // ---- secret chamber (original hall) ----
  for (const [a0, a1, c0, c1] of [[DG.x0 - 1, DG.x1 + 1, DG.z0 - 1, DG.z0], [-W, DG.x0, DG.z0, DG.z1], [DG.x1, W, DG.z0, DG.z1]]) { boxes.push({ x0: a0, x1: a1, z0: c0, z1: c1 }); box(a0, a1, 0, Hh, c0, c1, wallC); }
  box(DG.x0 - 1, DG.x1 + 1, Hh, Hh + .3, DG.z0 - 1, DG.z1, 0x1a1420);
  for (const [x, z] of DG.pillars) { cols.push({ x, z, r: .75 }); L.push([G.cyl, 0x4a3a56, M4(x, Hh / 2, z, .6, Hh, .6)]); L.push([G.box, 0x2a2232, M4(x, .3, z, 1.6, .6, 1.6)]); L.push([G.box, 0x2a2232, M4(x, Hh - .3, z, 1.5, .6, 1.5)]); }
  boxes.push({ x0: -2.2, x1: 2.2, z0: DG.z0, z1: -13.05 }); box(-2.2, 2.2, 0, .8, DG.z0, -13.6, 0x2a2232);
  cols.push({ x: DG.book.x, z: DG.book.z, r: .5 }); L.push([G.cyl, 0x1a1420, M4(DG.book.x, .55, DG.book.z, .15, 1.1, .15)]); L.push([G.box, 0x2a1a30, M4(DG.book.x, 1.15, DG.book.z, .8, .1, .6, 0, .35)]);
  for (let i = 0; i < 6; i++) { const z = DG.z0 + 3 + i * 4.4; for (const sx of [-1, 1]) L.push([G.box, 0x6a3a9a, M4(sx * (DG.x1 - .05), 3.2, z, .05, 1.6, .9)]); }
  // ---- wall 2 (between far ledge and chamber): fixed parts + split door (x -5..5) ----
  const z2 = DG.door2Z; for (const s of [-1, 1]) { boxes.push({ x0: s < 0 ? -W : 5, x1: s < 0 ? -5 : W, z0: z2 - 1, z1: z2 }); box(s < 0 ? -W : 5, s < 0 ? -5 : W, -30, HB, z2 - 1, z2, wallC); }
  box(-5, 5, 6.5, HB, z2 - 1, z2, wallC); const door2Box = { x0: -5, x1: 5, z0: z2 - 1, z1: z2 }; boxes.push(door2Box);
  // ---- chasm hall: far ledge (z 15..19), chasm (19..45), near ledge (45..50) ----
  box(-W, W, -30, 0, z2, C.z0, 0x3a3046); box(-W, W, -30, 0, C.z1, DG.door1Z - 1, 0x3a3046);
  for (const s of [-1, 1]) { const x0 = s < 0 ? -W - 1 : W, x1 = s < 0 ? -W : W + 1; boxes.push({ x0, x1, z0: z2, z1: DG.door1Z }); box(x0, x1, -30, HB, z2 - 1, DG.door1Z, wallC); for (let i = 0; i < 7; i++) L.push([G.box, 0x6a3a9a, M4(s * (W - .05), 4 + (i % 2) * 3, 17 + i * 4.8, .05, 2, .6)]); }
  for (const [z0, z1] of [[C.z0 - .6, C.z0], [C.z1, C.z1 + .6]]) for (const s of [-1, 1]) box(s * 2.6 - .25, s * 2.6 + .25, 0, .9, z0 + .05, z1 - .05, 0x54486a); // bridge-head posts
  const chasmBox = { x0: -W, x1: W, z0: C.z0, z1: C.z1 }; boxes.push(chasmBox);
  // abyss: dark floor far below + purple haze
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, C.z1 - C.z0), new THREE.MeshBasicMaterial({ color: 0x0a0412 })); abyss.rotation.x = -Math.PI / 2; abyss.position.set(0, -26, (C.z0 + C.z1) / 2); g.add(abyss);
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, C.z1 - C.z0), new THREE.MeshBasicMaterial({ color: 0x5a20a0, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); haze.rotation.x = -Math.PI / 2; haze.position.set(0, -9, (C.z0 + C.z1) / 2); g.add(haze);
  // ---- wall 1 + entry corridor ----
  const z1 = DG.door1Z; for (const s of [-1, 1]) { boxes.push({ x0: s < 0 ? -W : 5, x1: s < 0 ? -5 : W, z0: z1 - 1, z1 }); box(s < 0 ? -W : 5, s < 0 ? -5 : W, -30, HB, z1 - 1, z1, wallC); }
  box(-5, 5, -.4, 0, z1 - 1.02, z1 + .02, 0x342a3e); box(-5, 5, -.4, 0, z2 - 1.02, z2 + .02, 0x342a3e); box(-5, 5, 6.5, HB, z1 - 1, z1, wallC); const door1Box = { x0: -5, x1: 5, z0: z1 - 1, z1 }; boxes.push(door1Box);
  for (const s of [-1, 1]) { boxes.push({ x0: s < 0 ? -W : 4.5, x1: s < 0 ? -4.5 : W, z0: z1, z1: 59 }); box(s < 0 ? -5.5 : 4.5, s < 0 ? -4.5 : 5.5, 0, 6.5, z1, 58.6, wallC); }
  box(-5.5, 5.5, -.4, 0, z1, 58.6, 0x342a3e); box(-5.5, 5.5, 6.5, 6.8, z1, 58.6, 0x1a1420); box(-5.5, 5.5, 0, 6.5, 58, 58.6, wallC);
  g.add(new THREE.Mesh(mergeColored(L), new THREE.MeshLambertMaterial({ vertexColors: true })));
  // bridge (rises from the chasm)
  const bridge = new THREE.Group(); g.add(bridge); const blen = C.z1 - C.z0 + .4;
  mk(G.box, new THREE.MeshLambertMaterial({ color: 0x5a4e6a }), bridge, 0, -.3, (C.z0 + C.z1) / 2, C.hw * 2, .6, blen);
  const edgeM = new THREE.MeshBasicMaterial({ color: 0xb060ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) mk(G.box, edgeM, bridge, s * (C.hw - .06), .01, (C.z0 + C.z1) / 2, .1, .04, blen);
  for (let i = 0; i < 6; i++) mk(G.box, new THREE.MeshLambertMaterial({ color: 0x3a3048 }), bridge, 0, -1.4, C.z0 + 2 + i * 4.4, C.hw * 1.6, 2.2, .5);
  bridge.position.y = -16; bridge.visible = false;
  // purple barrier in doorway 2 (solid unless the player is 隐身)
  const barrierBox = { x0: -5, x1: 5, z0: z2 - 1.2, z1: z2 + .2, off: true }; boxes.push(barrierBox);
  const barM = new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const barrier = new THREE.Group(); barrier.visible = false; g.add(barrier); mk(G.box, barM, barrier, 0, 3.25, z2 - .5, 9.8, 6.5, .08);
  const barRingM = new THREE.MeshBasicMaterial({ color: 0xe0b0ff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 4; i++) mk(G.box, barRingM, barrier, 0, .8 + i * 1.6, z2 - .5, 9.8, .05, .1);
  const door1 = makeSplitDoor(g, z1, 10, 6.5, 2.6, 1.7), door2 = makeSplitDoor(g, z2, 10, 6.5, 3.2, 2.3);
  door1.box = door1Box; door2.box = door2Box;
  const fireM = new THREE.MeshBasicMaterial({ color: 0xc070ff }), fires = [];
  const brazier = (x, z) => { cols.push({ x, z, r: .45 }); mk(G.cyl, std(0x2a2232), g, x, .5, z, .35, 1, .35); fires.push(mk(G.sphLo, fireM, g, x, 1.2, z, .25, .35, .25)); };
  for (const z of [-10, -3, 5]) for (const sx of [-1, 1]) brazier(sx * 8.6, z);
  for (const sx of [-1, 1]) { brazier(sx * 9.5, 47.5); brazier(sx * 9.5, 17); brazier(sx * 4.1, 55); }
  const bookGlow = mk(G.sph, auraMat(0xb050ff, 1.6, 1.4), g, DG.book.x, 1.3, DG.book.z, .5, .4, .5);
  const tome = new THREE.Group(); tome.position.set(DG.book.x, 1.27, DG.book.z); tome.rotation.x = .35; g.add(tome); mk(G.box, new THREE.MeshLambertMaterial({ color: 0x4a1a6a, emissive: 0x6a20a0, emissiveIntensity: .6 }), tome, 0, 0, 0, .62, .12, .46); mk(G.box, new THREE.MeshBasicMaterial({ color: 0xe0c070 }), tome, 0, .065, 0, .4, .01, .3);
  const altarL = new THREE.PointLight(0xb060ff, 6, 14, 1.6); altarL.position.set(0, 2.5, -12); g.add(altarL);
  // floor-shatter visuals (boss end)
  const pit = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x040208 })); pit.rotation.x = -Math.PI / 2; pit.position.set(0, .03, -6); pit.visible = false; g.add(pit);
  const W2 = {
    name: 'digong', group: g, R: 1e5, boxes, cols, bounds, resolve: makeCollider(boxes, cols, bounds, npcSolids), spawn: DG.spawn, bookGlow, tome, door1, door2, bridge, chasmBox, pit, bridgeK: 0, bridgeT: 0, barrier, barrierBox, barM, barOn: false,
    H: () => 0, sky: [0x08040e, 0x140a20, 0x1e1028], sunDir: V3(0, 1, 0), sunCol: [.4, .2, .6], fog: [0x1a0e28, 14, 66],
    hemi: [0xc0a0f0, 0x5a4070, 2.6], sunL: [0xc0a0ff, .7], ground: 0x201828,
    setState(o) { for (const [d, v] of [[door1, o.d1], [door2, o.d2]]) { d.k = d.target = v ? 1 : 0; d.open = !!v; applyDoor(d); }
      W2.bridgeK = W2.bridgeT = o.br ? 1 : 0; applyBridge(W2); W2.barOn = !!o.bar; barrier.visible = W2.barOn; barrierBox.off = !W2.barOn; pit.visible = false; pit.scale.setScalar(1); tome.visible = bookGlow.visible = o.tome !== false; },
    openDoor(d) { d.target = 1; d.crackT = 0; sfx('stone'); },
    raiseBridge() { W2.bridgeT = 1; bridge.visible = true; },
    update(dt) {
      for (const f of fires) { f.scale.y = .35 + Math.sin(gameT * 9 + f.position.z) * .06; if (Math.random() < .2) emit(f.position.x + rand(-.15, .15), 1.3, f.position.z + rand(-.15, .15), 0, rand(.8, 1.6), 0, 0xc070ff, .35, .6, 0); }
      if (Math.random() < .5) emit(rand(-9, 9), rand(0, 5), rand(-15, 56), rand(-.1, .1), rand(.05, .3), rand(-.1, .1), 0x9a50ff, .2, 3, 0);
      if (Math.random() < .4) emit(rand(-11, 11), rand(-12, -4), rand(C.z0, C.z1), 0, rand(1, 3), 0, 0x8a40ff, .5, 2, 0);
      bookGlow.scale.setScalar(.5 + Math.sin(gameT * 2.5) * .05);
      if (barrier.visible) { const st = player.stealthT > 0; barM.opacity = (st ? .16 : .42) + Math.sin(gameT * 3) * .06; barrier.children.forEach((m, i) => { if (i) m.position.y = .4 + ((gameT * .8 + i * 1.6) % 6.4); }); if (Math.random() < .4) emit(rand(-4.8, 4.8), rand(0, 6.4), DG.door2Z - .5, 0, rand(.2, .6), 0, 0xc080ff, .25, .9, 0); }
      for (const d of [door1, door2]) {
        if (d.target > d.k) { d.crackT = (d.crackT || 0) + dt; d.crack.material.opacity = Math.min(1, d.crackT * 2) * (1 - d.k); if (d.crackT > .7) { d.k = Math.min(1, d.k + dt / 1.8); if (Math.random() < .6) emit(rand(-1, 1) * d.k * 5, rand(0, 6), d.zf + .3, rand(-1, 1), rand(-.5, .5), .5, 0x8a7a9a, .4, .8, -3); shake = Math.max(shake, .05); } applyDoor(d); }
      }
      if (W2.bridgeT > W2.bridgeK) { W2.bridgeK = Math.min(1, W2.bridgeK + dt / 2.6); shake = Math.max(shake, .07); if (Math.random() < .8) emit(rand(-2.2, 2.2), bridge.position.y, rand(C.z0, C.z1), 0, rand(2, 4), 0, 0xb070ff, .5, .8, -2); applyBridge(W2); }
    },
  };
  return W2;
}
function applyDoor(d) { const e = d.k * d.k * (3 - 2 * d.k); for (const h of d.halves) { h.g.position.x = h.s * e * 5.3; h.disc.visible = h.ring.visible = h.halo.visible = h.glow.visible = d.k < .98; } d.box.off = d.k > .55; d.open = d.k >= 1; if (d.k >= 1) d.crack.material.opacity = 0; d.btnM.emissiveIntensity = d.target ? 2.2 : .7; }
function applyBridge(w) { const e = 1 - Math.pow(1 - w.bridgeK, 3); w.bridge.position.y = lerp(-16, 0, e); w.bridge.visible = w.bridgeK > 0; w.chasmBox.off = w.bridgeK >= 1; }
/* ===== 七印镜殿 (v4.4): 地底甬道 (floor y=12) → 七印巨门 → 宽阔石阶 (down to y=0) → 椭圆大殿 · 七面古镜 · 殿心书架 ===== */
const JD = {
  rects: [[-5, 5, 112, 122], [-2, 2, 97, 112], [-2, 16, 94, 98], [12, 16, 78, 94], [-8, 16, 74, 78], [-16, 0, 56, 74], [-10, 10, 45, 56]],
  spawn: { x: 0, z: 118.5, yaw: 0 },
  orbPath: [[0, 114], [0, 103], [0, 96], [7, 96], [14, 96], [14, 88], [14, 80], [14, 76], [5, 76], [-4, 76], [-8, 70], [-8, 62], [-4, 57], [0, 52], [0, 49.5]],
  top: 12, doorZ: 45, doorHW: 8, st: { z0: 22, z1: 44, hw: 8 },
  E: { cz: -20, ax: 32, az: 46 }, shelf: { x: 0, z: -20 }, crystal: { x: 0, z: -15.6 }, circle: { x: 0, z: -8.5 }, tp: { x: 3.4, z: -7.4, yaw: Math.atan2(3.4, 1.1) },
  lit: [1, 3, 5], hallZ: 21.5, door: { x: 0, z: 47.6 }, place: { x: 0, z: -17.6 },
};
JD.mirrors = Array.from({ length: 7 }, (_, k) => { const t = (2 * k + 1) * Math.PI / 7, s = .972, x = JD.E.ax * s * Math.sin(t), z = JD.E.cz + JD.E.az * s * Math.cos(t); return { x, z, yaw: Math.atan2(-x, JD.E.cz - z) }; });
function jdH(x, z) { return z >= 44 ? 12 : (z > 22 && Math.abs(x) < 8 ? 12 * (z - 22) / 22 : 0); }
function buildJingWorld() {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const T = JD.top, E = JD.E, X0 = -18, X1 = 18, Z0 = 45, Z1 = 124, walk = (x, z) => JD.rects.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  const boxes = [], cols = [], L = [], GL = []; let sd = 23; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const box = (x0, x1, y0, y1, z0, z1, c, list = L) => list.push([G.box, c, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0)]);
  // ---- tunnel (y=12): collision from the walkable rects, rock visuals on the border cells ----
  for (let z = Z0; z < Z1; z++) { let run = null; for (let x = X0; x <= X1; x++) { const solid = x < X1 && !walk(x + .5, z + .5); if (solid && run === null) run = x; if (!solid && run !== null) { boxes.push({ x0: run, x1: x, z0: z, z1: z + 1 }); run = null; } } }
  for (let z = Z0; z < Z1; z++) for (let x = X0; x < X1; x++) { if (walk(x + .5, z + .5)) continue; let edge = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (walk(x + .5 + a, z + .5 + b)) edge = true; if (!edge) continue; const ante = z < 57, h = ante ? 17 + rr() * 2 : 3.6 + rr() * 3.2, c = rr() < .5 ? 0x4a4056 : 0x3c3448; L.push([G.box, c, M4(x + .5, T + h / 2, z + .5, 1.05 + rr() * .3, h, 1.05 + rr() * .3, rr() * .6)]); if (rr() < .14) GL.push([new THREE.ConeGeometry(.18, .7, 5), 0xb070ff, M4(x + .5 + (rr() - .5) * .6, T + .5 + rr() * 2.5, z + .5 + (rr() - .5) * .6, 1, 1, 1, rr() * 3, (rr() - .5) * 1.2, (rr() - .5) * 1.2)]); }
  for (const r of JD.rects) { const ante = r[2] === 45; box(r[0] - .5, r[1] + .5, T - .4, T, r[2] - (ante ? 0 : .5), r[3] + .5, 0x2e2638); box(r[0] - 1, r[1] + 1, T + (ante ? 18 : 7), T + (ante ? 18.4 : 7.4), r[2] - (ante ? 0 : 1), r[3] + 1, 0x16121c); }
  for (let i = 0; i < 46; i++) { const r = JD.rects[(rr() * 6) | 0]; const x = r[0] + .8 + rr() * (r[1] - r[0] - 1.6), z = r[2] + .8 + rr() * (r[3] - r[2] - 1.6); L.push([new THREE.ConeGeometry(.12 + rr() * .15, .6 + rr(), 5), 0x5a4e66, M4(x, T + 6.8 - .4, z, 1, 1, 1, 0, Math.PI)]); }
  // ---- 七印巨门 facade (z 44..45) + doorway x -8..8, y 12..26 ----
  const HW = JD.doorHW, DH = 14;
  for (const s of [-1, 1]) { box(s < 0 ? -18 : HW, s < 0 ? -HW : 18, 0, T + 20, 44, 45, 0x4e4260); boxes.push({ x0: s < 0 ? -18 : HW, x1: s < 0 ? -HW : 18, z0: 44, z1: 45 }); box(s * (HW + .6) - .6, s * (HW + .6) + .6, T, T + DH + 1, 45, 45.5, 0x6a5878); }
  box(-HW, HW, T + DH, T + 20, 44, 45, 0x4e4260); box(-HW - 1.2, HW + 1.2, T + DH, T + DH + 1.1, 45, 45.6, 0x6a5878);
  box(-HW - 1.2, HW + 1.2, T - .1, T + .05, 45, 46.4, 0x5a4c6a); // threshold
  // ---- wide stairs down (z 44 → 22, y 12 → 0) + corridor walls/ceiling ----
  const NS = 22; for (let i = 0; i < NS; i++) { const zt = 44 - i, top = 12 * ((zt - .5) - 22) / 22; box(-JD.st.hw, JD.st.hw, -.2, top, zt - 1, zt, i % 2 ? 0x5a4e6c : 0x544866); box(-JD.st.hw, JD.st.hw, top - .02, top + .03, zt - 1.02, zt - .9, 0x8a6ab0, GL); }
  box(-HW - 2, HW + 2, -.2, T, 43.99, 45.01, 0x544866);
  for (const s of [-1, 1]) { const x0 = s < 0 ? -14 : 8, x1 = s < 0 ? -8 : 14; boxes.push({ x0, x1, z0: 22, z1: 45 }); box(x0, x1, 0, 31, 22, 45, 0x5a4e6c); for (let i = 0; i < 6; i++) { const zc = 24.6 + i * 3.6, hy = jdH(0, zc); box(s * 8 - .06, s * 8 + .06, hy + 2.2, hy + 3.1, zc - .6, zc + .6, 0xb070ff, GL); } }
  box(-14, 14, 28, 29, 22, 45, 0x2a2236); box(-9, 9, 28, 31, 22.5, 26.5, 0x5a4e6c);
  // ---- hall: ellipse wall (gap for the stairs), dome, floor ----
  const gapT = Math.asin(JD.st.hw / (E.ax + .6)) + .01;
  const brickTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a6c8e'; c.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const l = 96 + ((x * 7 + y * 13) % 5) * 7; c.fillStyle = `rgb(${l + 10},${l},${l + 26})`; c.fillRect(((x + (y % 2) * .5) % 4) * 64 + 2, y * 32 + 2, 60, 28); } }, [40, 6]);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 31, 72, 1, true, gapT, Math.PI * 2 - gapT * 2), new THREE.MeshLambertMaterial({ map: brickTex, side: THREE.BackSide })); wall.scale.set(E.ax + .6, 1, E.az + .6); wall.position.set(0, 15.5, E.cz); g.add(wall);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3e3054, side: THREE.BackSide })); dome.scale.set(E.ax + .7, 14, E.az + .7); dome.position.set(0, 30.9, E.cz); g.add(dome);
  const tileTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#3a3048'; c.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const l = 70 + ((x * 3 + y * 5) % 4) * 8; c.fillStyle = `rgb(${l},${l - 6},${l + 18})`; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }, [14, 20]);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshLambertMaterial({ map: tileTex })); floor.rotation.x = -Math.PI / 2; floor.scale.set(E.ax + .7, E.az + .7, 1); floor.position.set(0, 0, E.cz); g.add(floor);
  // giant rune disc
  const runeTex = canvasTex(1024, 1024, (c, w, h) => { const cx = w / 2; c.fillStyle = '#2a2034'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a0ff'; c.fillStyle = '#c8a0ff'; c.lineWidth = 10;
    for (const r of [500, 470, 330, 300, 140]) { c.beginPath(); c.arc(cx, cx, r, 0, 6.283); c.stroke(); }
    c.font = 'bold 54px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const gl = '乾坤震巽坎离艮兑天地玄黄宇宙洪荒日月盈昃辰宿列张'; for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; c.save(); c.translate(cx + Math.sin(a) * 400, cx - Math.cos(a) * 400); c.rotate(a); c.fillText(gl[i], 0, 0); c.restore(); }
    c.lineWidth = 7; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, x = cx + Math.sin(a) * 222, y = cx - Math.cos(a) * 222; c.beginPath(); c.arc(x, y, 58, 0, 6.283); c.stroke(); c.beginPath(); for (let k = 0; k < 5; k++) { const b = a + k * 2.513; c.lineTo(x + Math.sin(b) * 44, y - Math.cos(b) * 44); } c.closePath(); c.stroke(); }
    c.beginPath(); for (let k = 0; k <= 7; k++) { const a = k * 3 / 7 * 6.283; c.lineTo(cx + Math.sin(a) * 300, cx - Math.cos(a) * 300); } c.stroke(); });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshLambertMaterial({ map: runeTex })); disc.rotation.x = -Math.PI / 2; disc.position.set(JD.shelf.x, .03, JD.shelf.z); g.add(disc);
  const discGlowM = new THREE.MeshBasicMaterial({ map: runeTex, color: 0xb070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const discGlow = new THREE.Mesh(new THREE.CircleGeometry(14, 64), discGlowM); discGlow.rotation.x = -Math.PI / 2; discGlow.position.set(JD.shelf.x, .06, JD.shelf.z); g.add(discGlow);
  L.push([new THREE.TorusGeometry(14.2, .3, 4, 72), 0x8a7050, M4(JD.shelf.x, .05, JD.shelf.z, 1, 1, .5, 0, Math.PI / 2)]);
  // central bookshelf-lectern
  const S = JD.shelf; box(S.x - 1.9, S.x + 1.9, 0, .35, S.z - 1.3, S.z + 1.2, 0x4a3a2a); box(S.x - 1.6, S.x + 1.6, .35, 3.1, S.z - 1.15, S.z - .85, 0x5a3a24);
  for (const s of [-1, 1]) box(S.x + s * 1.6 - .12, S.x + s * 1.6 + .12, .35, 3.3, S.z - 1.2, S.z - .3, 0x6a4428);
  for (let k = 0; k < 3; k++) { box(S.x - 1.5, S.x + 1.5, .9 + k * .8, .98 + k * .8, S.z - 1.1, S.z - .45, 0x6a4428); for (let b = 0; b < 9; b++) { const hh = .35 + ((b * 7 + k * 3) % 4) * .06; box(S.x - 1.35 + b * .3, S.x - 1.12 + b * .3, .98 + k * .8, .98 + k * .8 + hh, S.z - 1.05, S.z - .55, [0x6a2a3a, 0x2a3a6a, 0x3a5a3a, 0x7a5a2a, 0x4a2a6a][(b + k) % 5]); } }
  L.push([G.cyl, 0x5a3a24, M4(S.x, .75, S.z + .35, .14, .8, .14)]); L.push([G.box, 0x6a4428, M4(S.x, 1.2, S.z + .35, 1.1, .1, .8, 0, -.4)]);
  boxes.push({ x0: S.x - 1.9, x1: S.x + 1.9, z0: S.z - 1.3, z1: S.z + 1.0 });
  const tomeM = new THREE.MeshLambertMaterial({ color: 0x4a1a6a, emissive: 0x6a20a0, emissiveIntensity: .5 });
  const shelfBook = new THREE.Group(); shelfBook.position.set(S.x, 1.32, S.z + .35); shelfBook.rotation.x = -.4; g.add(shelfBook); mk(G.box, tomeM, shelfBook, 0, 0, 0, .62, .12, .46); mk(G.box, new THREE.MeshBasicMaterial({ color: 0xe0c070 }), shelfBook, 0, .065, 0, .4, .01, .3);
  const bookAura = mk(G.sph, auraMat(0xb050ff, 1.6, 1.4), shelfBook, 0, .1, 0, .7, .5, .7); shelfBook.visible = false;
  // pillars (instanced): 16 around the hall
  const pillarG = mergeColored([[G.box, 0x4a3e5a, M4(0, .5, 0, 2.7, 1, 2.7)], [new THREE.CylinderGeometry(1, 1, 1, 8), 0x6a5a80, M4(0, 15, 0, .95, 28, .95)], [G.box, 0x4a3e5a, M4(0, 29.3, 0, 2.5, 1.4, 2.5)], [G.box, 0x8a6ab0, M4(0, 3, 0, 2.02, .25, 2.02)]]);
  const NP = 16, pim = new THREE.InstancedMesh(pillarG, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), NP); const mm = new THREE.Matrix4();
  for (let k = 0; k < NP; k++) { const t = (k + .5) / NP * Math.PI * 2, x = E.ax * .8 * Math.sin(t), z = E.cz + E.az * .8 * Math.cos(t); pim.setMatrixAt(k, mm.makeTranslation(x, 0, z)); cols.push({ x, z, r: 1.35 }); }
  g.add(pim);
  // seven mirrors
  const mirrorDark = new THREE.MeshLambertMaterial({ color: 0x1a1426, emissive: 0x0a0612 });
  const mirTex = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0d0ff'); gr.addColorStop(.5, '#a050ff'); gr.addColorStop(1, '#5a1aa0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(8, 0, 6, h); });
  const mirrorLit = new THREE.MeshBasicMaterial({ map: mirTex });
  const glowTex = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(220,170,255,1)'); gr.addColorStop(1, 'rgba(120,40,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const mirrors = JD.mirrors.map((m, k) => {
    const q = new THREE.Matrix4().makeRotationY(m.yaw), at = (lx, ly, lz) => V3(lx, ly, lz).applyMatrix4(q).add(V3(m.x, 0, m.z));
    const part = (lx, ly, lz, sx, sy, sz, c, list = L) => { const p = at(lx, ly, lz); list.push([G.box, c, M4(p.x, p.y, p.z, sx, sy, sz, m.yaw)]); };
    part(0, .6, 0, 6, 1.2, 2, 0x3a3048); part(0, 7.2, -.2, 5.2, 12.4, .7, 0x2e2638); part(0, 13.6, -.1, 6, .9, 1, 0x8a7050); for (const s of [-1, 1]) part(s * 2.55, 7.2, .1, .35, 12, .5, 0x8a7050); part(0, 1.3, .1, 5.4, .3, .5, 0x8a7050);
    part(0, 14.6, -.1, 1.6, 1.1, .6, 0xb090d0, GL);
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 11.6), mirrorDark); const sp = at(0, 7.4, .2); surf.position.copy(sp); surf.rotation.y = m.yaw; g.add(surf);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 17), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.copy(at(0, 7.4, .4)); glow.rotation.y = m.yaw; glow.visible = false; g.add(glow);
    const dx = JD.shelf.x - m.x, dz = JD.shelf.z - m.z, dl = Math.hypot(dx, dz), len = dl - 14.6;
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ray.rotation.order = 'YXZ'; ray.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0); ray.position.set(m.x + dx / dl * (len / 2 + .2), .05, m.z + dz / dl * (len / 2 + .2)); ray.visible = false; g.add(ray);
    const cp = at(0, 0, -.2); cols.push({ x: cp.x, z: cp.z, r: 2.2 });
    return { surf, glow, ray, k: 0, t: -1, lit: false };
  });
  // wall braziers between mirrors + light shafts
  const fires = [];
  for (let k = 1; k < 7; k++) { const t = k / 7 * Math.PI * 2, x = E.ax * .955 * Math.sin(t), z = E.cz + E.az * .955 * Math.cos(t); L.push([G.cyl, 0x2e2638, M4(x, .7, z, .55, 1.4, .55)]); GL.push([G.sphLo, 0xc070ff, M4(x, 1.75, z, .4, .55, .4)]); fires.push([x, z]); cols.push({ x, z, r: .7 }); }
  const shaftG = []; for (const [x, z] of [[0, -20], [-14, -4], [14, -4], [-12, -40], [12, -40], [0, 8]]) shaftG.push([new THREE.CylinderGeometry(1.6, 3.2, 40, 10, 1, true), 0xffffff, M4(x, 20, z)]);
  const shafts = new THREE.Mesh(mergeColored(shaftG), new THREE.MeshBasicMaterial({ color: 0x6a40a0, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); g.add(shafts);
  g.add(new THREE.Mesh(mergeColored(L), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  g.add(new THREE.Mesh(mergeColored(GL), new THREE.MeshBasicMaterial({ vertexColors: true })));
  // ---- door leaves (slide into the facade), seven seals, crack, backlight ----
  const leafM = new THREE.MeshLambertMaterial({ color: 0x54466a }), trimM = new THREE.MeshLambertMaterial({ color: 0x8a7050 });
  const sealTex = (i) => canvasTex(128, 128, (c, w, h) => { c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 56, 0, 6.283); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 44, 0, 6.283); c.stroke(); c.font = 'bold 52px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('壹贰叁肆伍陆柒'[i], 64, 68); });
  const seals = [], halves = [];
  for (const s of [-1, 1]) { const hg = new THREE.Group(); g.add(hg); mk(G.box, leafM, hg, s * HW / 2, T + DH / 2, 44.5, HW + .02, DH, .8); for (let k = 0; k < 4; k++) mk(G.box, trimM, hg, s * HW / 2, T + 1 + k * 4, 44.92, HW - .6, .2, .1); mk(G.box, trimM, hg, s * (HW - .3), T + DH / 2, 44.92, .25, DH - .4, .1); halves.push({ g: hg, s }); }
  const sealPos = [[-1, 3.2], [-1, 7], [-1, 10.8], [1, 3.2], [1, 7], [1, 10.8]];
  sealPos.forEach(([s, y], i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: sealTex(i), color: 0xb070ff, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(s * HW / 2, T + y, 44.97); halves[s < 0 ? 0 : 1].g.add(m); seals.push(m); });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: sealTex(6), color: 0xb070ff, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(0, T + DH + 3, 45.04); g.add(m); seals.push(m); }
  const crackM = new THREE.MeshBasicMaterial({ color: 0xe0b0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); const crack = mk(G.box, crackM, g, 0, T + DH / 2, 44.95, .14, DH, .05);
  const backM = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); const back = mk(new THREE.PlaneGeometry(1, 1), backM, g, 0, T + DH / 2, 43.8, 22, 18, 1);
  const doorBox = { x0: -HW, x1: HW, z0: 44, z1: 45.3 }; boxes.push(doorBox);
  const door = { k: 0, t: -1, open: false };
  // ---- crystal / circle / orb (as before) ----
  const crys = { x: JD.crystal.x, z: JD.crystal.z, r: 1.3, off: true }; cols.push(crys);
  const crystal = new THREE.Group(); crystal.position.set(JD.crystal.x, 1.9, JD.crystal.z); crystal.visible = false; g.add(crystal);
  const crM = new THREE.MeshStandardMaterial({ color: 0x8a40e0, emissive: 0xa050ff, emissiveIntensity: 1.4, roughness: .15, metalness: .2, transparent: true, opacity: .92, flatShading: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), crM); crystal.add(core); const aura = mk(G.sph, auraMat(0xc070ff, 1.8, 1.4), crystal, 0, 0, 0, 1.7, 1.7, 1.7);
  const crL = new THREE.PointLight(0xb060ff, 0, 22, 1.4); crL.position.set(JD.crystal.x, 3, JD.crystal.z); g.add(crL);
  const orb = new THREE.Group(); orb.visible = false; g.add(orb); mk(G.sphLo, new THREE.MeshBasicMaterial({ color: 0xf0d0ff }), orb, 0, 0, 0, .16, .16, .16); mk(G.sph, auraMat(0xc070ff, 1.4, 1.6), orb, 0, 0, 0, .45, .45, .45);
  const circle = new THREE.Group(); circle.position.set(JD.circle.x, .08, JD.circle.z); circle.visible = false; g.add(circle);
  const cm = addMat(0xc080ff, .85); const c1 = mk(ringGeo, cm, circle, 0, 0, 0, 1.7, 1.7, 1.7); c1.rotation.x = -Math.PI / 2; const c2 = mk(ringGeo, addMat(0x8a40ff, .6), circle, 0, .01, 0, 1.1, 1.1, 1.1); c2.rotation.x = -Math.PI / 2; const c3 = mk(discGeo, addMat(0x6a20c0, .25), circle, 0, .005, 0, 1.7, 1.7, 1.7); c3.rotation.x = -Math.PI / 2;
  const bounds = { x0: -34, x1: 34, z0: -67, z1: 124 }; boxes.push({ x0: -40, x1: X0, z0: 44, z1: 130 }, { x0: X1, x1: 40, z0: 44, z1: 130 });
  const base = makeCollider(boxes, cols, bounds, npcSolids);
  const resolve = (x, z, r) => { for (let it = 0; it < 2; it++) { [x, z] = base(x, z, r); if (z < 44 && (z < 22 || Math.abs(x) > JD.st.hw)) { const u = x / (E.ax - r), v = (z - E.cz) / (E.az - r), s2 = u * u + v * v; if (s2 > 1) { const k = 1 / Math.sqrt(s2); x *= k; z = E.cz + (z - E.cz) * k; } } } return [x, z]; };
  const ease = k => k * k * (3 - 2 * k);
  const W = {
    name: 'jingdian', group: g, R: 1e5, boxes, cols, bounds, resolve, spawn: JD.spawn, actorH: true, crystal, core, aura, crL, crys, orb, circle, orbI: 0, orbOn: false, door, doorBox, mirrors, discGlowM, shelfBook, seals,
    H: jdH, sky: [0x06030c, 0x100820, 0x1a0e2a], sunDir: V3(0, 1, 0), sunCol: [.3, .2, .45], fog: [0x22163a, 26, 165],
    hemi: [0xd8c0ff, 0x4a3a6a, 3.1], sunL: [0xb090ff, .6], ground: 0x1e1628,
    setState(o) { door.k = o.open ? 1 : 0; door.t = -1; door.open = !!o.open; W.applyDoor(); crackM.opacity = 0; backM.opacity = 0; seals.forEach(m => m.material.opacity = o.open ? .9 : .3);
      shelfBook.visible = !!o.placed; discGlowM.opacity = o.placed ? .75 : 0; mirrors.forEach((m, k) => { const on = !!o.placed && JD.lit.includes(k); m.lit = on; m.t = -1; m.k = on ? 1 : 0; W.applyMirror(m); });
      const cv = !!o.placed && !o.absorbed; crystal.visible = cv; crystal.scale.setScalar(1); crys.off = !cv; crL.intensity = cv ? 5 : 0; circle.visible = !!o.absorbed; orb.visible = false; W.orbOn = false; W.orbI = 0; orb.position.set(JD.orbPath[0][0], T + 1.7, JD.orbPath[0][1] + 2); },
    applyDoor() { const e = ease(door.k); for (const h of halves) h.g.position.x = h.s * e * (HW + .3); doorBox.off = door.k > .45; door.open = door.k >= 1; },
    applyMirror(m) { m.surf.material = m.k > .02 ? mirrorLit : mirrorDark; m.glow.visible = m.ray.visible = m.k > .02; m.glow.material.opacity = .85 * m.k; m.ray.material.opacity = .5 * m.k; },
    openDoor() { if (door.t < 0 && door.k < 1) { door.t = 0; sfx('stone'); } },
    lightMirrors() { JD.lit.forEach((k, j) => { const m = mirrors[k]; m.lit = true; m.t = -j * .7; }); },
    update(dt) {
      crystal.rotation.y += dt * .5; if (crystal.visible) { crystal.position.y = Math.min(1.9, crystal.position.y + dt * 2) + Math.sin(gameT * 1.3) * .004; if (Math.random() < .5) emit(JD.crystal.x + rand(-1.5, 1.5), rand(.5, 3), JD.crystal.z + rand(-1.5, 1.5), 0, rand(.3, .8), 0, 0xc080ff, .3, 1.2, 0); }
      if (circle.visible) { c1.rotation.z += dt * .8; c2.rotation.z -= dt * 1.4; if (Math.random() < .6) { const a = rand(0, 6.28); emit(JD.circle.x + Math.cos(a) * 1.6, .1, JD.circle.z + Math.sin(a) * 1.6, 0, rand(1, 2.2), 0, 0xc080ff, .3, .9, 0); } }
      if (orb.visible && Math.random() < .5) emit(orb.position.x + rand(-.1, .1), orb.position.y, orb.position.z + rand(-.1, .1), 0, rand(-.2, .2), 0, 0xd0a0ff, .18, .7, 0);
      if (!door.open && door.t < 0) seals.forEach((m, i) => { m.material.opacity = .26 + .1 * Math.sin(gameT * 1.6 + i); });
      if (door.t >= 0 && door.k < 1) { const t = door.t += dt;
        seals.forEach((m, i) => { const on = t > .3 + i * .26; m.material.opacity = on ? Math.min(1, .3 + (t - .3 - i * .26) * 3) : .3; if (on && !m.userData.fx) { m.userData.fx = 1; sfx('ding'); const p = m.getWorldPosition(V3(0, 0, 0)); burst(p, 14, 0xd0a0ff, 3, .3, .5, 0); } });
        if (t > 2.3) { crackM.opacity = Math.min(1, (t - 2.3) * 2) * (1 - door.k); shake = Math.max(shake, .08); if (!door.rum) { door.rum = 1; sfx('roar'); sfx('stone'); } }
        if (t > 3.0) { door.k = Math.min(1, (t - 3.0) / 2.8); W.applyDoor(); backM.opacity = Math.sin(door.k * Math.PI) * .9; shake = Math.max(shake, .12 * (1 - door.k)); if (Math.random() < .8) { const s = Math.random() < .5 ? -1 : 1; emit(s * ease(door.k) * (HW + .3), T + rand(0, 1.2), 45.4, s * rand(.5, 1.5), rand(.3, 1.2), rand(.5, 1.5), 0x8a7a9a, .5, 1, -1.5); } if (Math.random() < .5) emit(rand(-1, 1) * HW * door.k, T + rand(1, DH), 44.2, 0, rand(-.2, .4), rand(1, 3), 0xc080ff, .3, 1.2, 0); }
        if (door.k >= 1) { crackM.opacity = 0; backM.opacity = 0; door.t = -1; seals.forEach(m => { m.userData.fx = 0; }); } }
      for (const m of mirrors) if (m.lit && m.k < 1) { m.t += dt; if (m.t >= 0) { if (m.k === 0) { sfx('level'); shockRing(V3(m.surf.position.x, .1, m.surf.position.z), 0xc080ff, .4, 6, .8); burst(m.surf.position.clone(), 50, 0xd0a0ff, 6, .5, .8, 0); } m.k = Math.min(1, m.t / .9); W.applyMirror(m); } }
      for (const m of mirrors) if (m.lit && m.k >= 1) m.glow.material.opacity = .7 + Math.sin(gameT * 2 + m.surf.position.x) * .15;
      if (shelfBook.visible) bookAura.scale.setScalar(.7 + Math.sin(gameT * 2.5) * .05);
      for (const [x, z] of fires) if (Math.random() < .12) emit(x + rand(-.2, .2), 2, z + rand(-.2, .2), 0, rand(.8, 1.6), 0, 0xc070ff, .35, .7, 0);
      if (Math.random() < .5) emit(rand(-25, 25), rand(0, 10), rand(-60, 18), rand(-.1, .1), rand(.05, .3), rand(-.1, .1), 0x9a50ff, .25, 3, 0);
    },
  };
  return W;
}
worlds.academy = buildAcademyWorld();
worlds.digong = buildDigongWorld();
worlds.jingdian = buildJingWorld();

/* ================= v4 · 第一章 — characters (primitive-built, merged per limb: ~5 draw calls each) ================= */
const CPOSE = {
  idle: { ar: [0, .1], al: [0, -.1], lean: 0, twist: 0, crouch: 0 },
  ready: { ar: [-.9, .25], al: [-.45, -.25], lean: .08, twist: .15, crouch: .05 },
  raise: { ar: [-2.9, .1], al: [-2.7, -.15], lean: -.18, twist: 0, crouch: 0 },
  slam: { ar: [-1.0, 0], al: [-.95, 0], lean: .5, twist: 0, crouch: .2 },
  windR: { ar: [-1.3, 1.1], al: [-.4, -.3], lean: .05, twist: .9, crouch: .08 },
  slashR: { ar: [-1.4, -1.0], al: [-.3, -.4], lean: .2, twist: -.8, crouch: .05 },
  thrust: { ar: [-1.6, 0], al: [-.3, -.5], lean: .22, twist: -.3, crouch: .1 },
  throwW: { ar: [-2.6, .4], al: [-.8, -.3], lean: -.12, twist: .5, crouch: 0 },
  throwR: { ar: [-1.2, -.2], al: [-.6, -.2], lean: .2, twist: -.4, crouch: 0 },
  cast: { ar: [-1.45, .35], al: [-1.45, -.35], lean: .1, twist: 0, crouch: 0 },
  sky: { ar: [-3.0, -.2], al: [-2.9, .2], lean: -.2, twist: 0, crouch: 0 },
  kneel: { ar: [-.3, .15], al: [-.6, -.2], lean: .55, twist: .1, crouch: .5 },
  bow: { ar: [-.9, -.55], al: [-.9, .55], lean: .45, twist: 0, crouch: 0 },
  point: { ar: [-1.5, .05], al: [0, -.1], lean: 0, twist: .1, crouch: 0 },
  whisk: { ar: [-.2, .15], al: [-.75, -.25], lean: .04, twist: 0, crouch: 0 },
  cheer: { ar: [-2.7, .35], al: [-.2, -.1], lean: -.05, twist: 0, crouch: 0 },
  stagger: { ar: [.3, .5], al: [.3, -.5], lean: -.35, twist: .2, crouch: .1 },
  float: { ar: [-.5, .5], al: [-.5, -.5], lean: .1, twist: 0, crouch: 0 },
};
function buildChar(o) {
  const w = o.w || 1, ghost = !!o.ghost;
  const mat = ghost ? o.ghostMat : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .05, envMapIntensity: .55 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const B = [], Hd = [], AL = [], AR = [];
  const robe = o.robe, lower = o.lower || o.robe, trim = o.trim, skin = o.skin || 0xf0d2bc, hair = o.hair ?? 0x18141c, inner = o.inner || 0xf2eee2, sash = o.sash || trim;
  const tz = .78; // torso depth factor
  if (!o.noLegs) for (const s of [-1, 1]) B.push([G.box, o.boots || 0x2a2420, M4(s * .1 * w, .05, .04, .11 * w, .1, .26)]);
  B.push([lathe(o.noLegs ? [[0, .3], [.12 * w, .3], [.2 * w, .6], [.205 * w, .88], [.185 * w, 1.0], [0, 1.0]] : [[0, .06], [.3 * w, .06], [.29 * w, .16], [.25 * w, .5], [.205 * w, .88], [.185 * w, 1.0], [0, 1.0]], 16), lower, M4(0, 0, 0, 1, 1, .9)]);
  if (!o.noLegs) B.push([new THREE.CylinderGeometry(.3 * w, .304 * w, .08, 16), trim, M4(0, .1, 0, 1, 1, .9)]);
  B.push([G.box, inner, M4(0, .52, .235 * w * .9, .1 * w, .8, .02, 0, -.12)]);
  B.push([G.cyl, sash, M4(0, 1.0, 0, .2 * w, .1, .2 * w * tz)]);
  B.push([G.box, trim, M4(0, 1.0, .2 * w * tz + .01, .07, .08, .02)]);
  B.push([lathe([[0, 0], [.19 * w, 0], [.205 * w, .15], [.228 * w, .33], [.2 * w, .44], [.1, .5], [.05, .53], [0, .53]], 16), robe, M4(0, 1.0, 0, 1, 1, tz)]);
  for (const s of [-1, 1]) { B.push([G.box, inner, M4(s * .05, 1.36, .178 * w + .005, .055, .28, .02, 0, 0, s * .5)]); B.push([G.box, trim, M4(s * .072, 1.36, .178 * w + .012, .016, .28, .02, 0, 0, s * .5)]); }
  for (const s of [-1, 1]) B.push([G.sph, robe, M4(s * .2 * w, 1.44, 0, .085 * w, .07, .08)]);
  B.push([G.cyl, skin, M4(0, 1.57, 0, .045, .1, .045)]);
  if (o.extraBody) o.extraBody(B, w);
  // head (pivot at neck top)
  Hd.push([G.sph, skin, M4(0, .1, 0, .1, .118, .106)]);
  for (const s of [-1, 1]) {
    Hd.push([G.box, o.eye || 0x1a1418, M4(s * .036, .118, .096, .032, .012, .01)]);
    Hd.push([G.box, o.brow ?? hair, M4(s * .037, .145, .098, .042, .011, .01, 0, 0, s * (o.angry ? -.32 : -.06))]);
    Hd.push([G.sph, skin, M4(s * .1, .1, 0, .02, .035, .025)]);
  }
  Hd.push([G.cone, skin, M4(0, .088, .108, .013, .032, .013, 0, .5)]);
  Hd.push([G.box, 0x9a5a52, M4(0, .048, .098, .03, .006, .008)]);
  if (o.hairStyle !== 'bald') { Hd.push([G.sph, hair, M4(0, .145, -.012, .109, .088, .113)]); Hd.push([G.sph, hair, M4(0, .09, -.035, .104, .1, .09)]); }
  if (o.head) o.head(Hd, hair, skin);
  // arms (pivot at shoulder), sleeves widen toward the cuff
  const armList = (L, s) => { L.push([new THREE.CylinderGeometry(.052 * w, (o.sleeve || .1) * w, .56, 10), robe, M4(0, -.28, 0)]); L.push([new THREE.CylinderGeometry((o.sleeve || .1) * w + .004, (o.sleeve || .1) * w + .004, .045, 10), trim, M4(0, -.56, 0)]); L.push([G.sph, skin, M4(0, -.62, .01, .042, .05, .042)]); };
  armList(AL, -1); armList(AR, 1);
  const bodyM = mk(mergeColored(B), mat, body);
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head); mk(mergeColored(Hd), mat, head);
  const arms = [];
  for (const [L, s] of [[AL, -1], [AR, 1]]) { const p = new THREE.Group(); p.position.set(s * .235 * w, 1.46, 0); body.add(p); mk(mergeColored(L), mat, p); const hand = new THREE.Group(); hand.position.set(0, -.62, .02); p.add(hand); arms.push({ p, hand }); }
  root.scale.setScalar(o.h || 1);
  if (o.weaponR) { const wm = mk(mergeColored(o.weaponR), mat, arms[1].hand); wm.rotation.x = o.weaponRx ?? 1.25; arms[1].weapon = wm; }
  if (o.weaponL) { const wm = mk(mergeColored(o.weaponL), mat, arms[0].hand); wm.rotation.x = o.weaponLx ?? 0; arms[0].weapon = wm; }
  return { root, body, head, armL: arms[0], armR: arms[1], mat, mats: [mat] };
}
/* weapons (built along +Y from grip at origin) */
const W_WHISK = [[G.cyl, 0x6a4028, M4(0, .1, 0, .014, .36, .014)], [G.sph, 0xd8b25a, M4(0, .29, 0, .025, .025, .025)], [G.cone, 0xf6f6f6, M4(0, -.25, 0, .07, .5, .07, 0, Math.PI)], [G.cone, 0xe6e6ea, M4(.02, -.28, .02, .05, .45, .05, 0, Math.PI)]];
const W_THIN = [[G.cyl, 0x2a1a14, M4(0, 0, 0, .014, .2, .014)], [G.box, 0xd8b25a, M4(0, .11, 0, .1, .02, .03)], [G.box, 0xe6eef6, M4(0, .6, 0, .028, .98, .008)], [G.cone, 0xe6eef6, M4(0, 1.12, 0, .02, .08, .006)]];
const W_BLACK = [[G.cyl, 0x1a1418, M4(0, 0, 0, .02, .26, .02)], [G.box, 0x6a3a9a, M4(0, .14, 0, .26, .05, .06)], [G.box, 0x14101a, M4(0, .72, 0, .15, 1.1, .03)], [G.box, 0x9a4ae0, M4(.078, .72, 0, .01, 1.1, .035)], [G.box, 0x9a4ae0, M4(-.078, .72, 0, .01, 1.1, .035)], [G.cone, 0x14101a, M4(0, 1.34, 0, .075, .14, .016)]];
const W_GREAT = [[G.cyl, 0x3a2418, M4(0, 0, 0, .03, .42, .03)], [G.box, 0x6a5a40, M4(0, .22, 0, .6, .09, .1)], [G.box, 0x8a929c, M4(0, 1.12, 0, .32, 1.72, .06)], [G.box, 0xc8d0d8, M4(0, 1.12, 0, .34, 1.6, .02)], [G.cone, 0x8a929c, M4(0, 2.06, 0, .17, .2, .03)]];
const W_DART = [[G.cone, 0xc8d0d8, M4(0, .1, 0, .025, .2, .025)], [G.cyl, 0x8a2a2a, M4(0, -.03, 0, .01, .08, .01)]];
const ghostCharMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color(0x9a40ff) }, op: { value: 1 }, t: timeU, fl: { value: 0 } }, vertexColors: true,
  vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC; void main(){ vC=color; vec4 w=modelMatrix*vec4(position,1.); vY=w.y; vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader: 'uniform vec3 col; uniform float op,t,fl; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC; void main(){ float f=pow(1.-abs(dot(vN,vV)),1.5); float scan=.7+.3*sin(vY*22.-t*5.); float a=(.22+f*1.1)*scan*op; vec3 c=mix(col,vC,.35)+fl; gl_FragColor=vec4(c*a,a); }' });
ghostCharMat.userData.keepE = true;
/* ---- the cast ---- */
const CAST = {
  master: { name: '青玄真人', title: '师傅', h: 1.0, w: 1.05, robe: 0xd6d6d0, lower: 0xc8c8c2, trim: 0x8a8a96, inner: 0xf4f4f0, hair: 0xf2f2f2, brow: 0xf8f8f8, sash: 0x6a6a7a, sleeve: .13,
    head(Hd, hair) { Hd.push([G.sph, hair, M4(0, .25, -.02, .05, .045, .05)]); Hd.push([G.box, 0xc8a050, M4(0, .27, -.02, .06, .03, .08)]); Hd.push([G.cyl, 0xc8a050, M4(0, .28, -.02, .006, .16, .006, 0, 0, Math.PI / 2)]); Hd.push([G.cone, 0xf8f8f8, M4(0, -.1, .07, .07, .32, .045, 0, Math.PI)]); for (const s of [-1, 1]) Hd.push([G.cone, 0xf8f8f8, M4(s * .03, .05, .1, .012, .09, .012, 0, Math.PI, s * -.9)]); Hd.push([G.box, hair, M4(0, -.05, -.09, .17, .3, .05)]); },
    weaponL: W_WHISK, weaponLx: 0 },
  lin: { name: '林清风', title: '师兄', h: 1.04, w: .85, robe: 0x3fb8b0, lower: 0x2e9c96, trim: 0xe8f8f4, inner: 0xf2fffc, hair: 0x14121a, sash: 0x1e6a6a, sleeve: .085,
    head(Hd, hair) { Hd.push([G.sph, hair, M4(0, .25, -.06, .045, .05, .045)]); Hd.push([G.box, 0xe8f8f4, M4(0, .24, -.06, .1, .015, .015)]); Hd.push([G.cone, hair, M4(0, .02, -.14, .045, .5, .03, 0, Math.PI + .25)]); for (const s of [-1, 1]) Hd.push([G.box, hair, M4(s * .085, .06, .07, .015, .14, .015)]); },
    extraBody(B, w) { B.push([G.box, 0x2a4a6a, M4(.1, 1.18, -.2 * w, .06, 1.1, .035, 0, 0, .55)]); B.push([G.box, 0xd8b25a, M4(-.18, 1.62, -.2 * w, .1, .025, .04, 0, 0, .55)]); B.push([G.cyl, 0x2a1a14, M4(-.24, 1.72, -.2 * w, .014, .2, .014, 0, 0, .55)]); } },
  mohan: { name: '墨寒', title: '魔派首席', h: 1.12, w: 1.0, robe: 0x17131c, lower: 0x100c14, trim: 0x7a3aaa, inner: 0x3a2a4a, hair: 0x0a080c, sash: 0x5a2a8a, angry: true, eye: 0xb050ff, sleeve: .1,
    head(Hd, hair) { Hd.push([G.sph, hair, M4(0, .24, -.04, .05, .05, .05)]); Hd.push([G.box, 0x7a3aaa, M4(0, .25, -.04, .07, .025, .07)]); Hd.push([G.box, hair, M4(0, -.08, -.08, .2, .38, .06)]); for (const s of [-1, 1]) Hd.push([G.box, hair, M4(s * .09, .02, .06, .02, .2, .02)]); },
    extraBody(B, w) { for (const s of [-1, 1]) B.push([G.box, 0x2a2232, M4(s * .22 * w, 1.47, 0, .14, .05, .18, 0, 0, s * -.3)]); },
    weaponR: W_BLACK },
  heavy: { name: '重剑弟子', title: '重剑堂', h: 1.15, w: 1.45, robe: 0x8a6a42, lower: 0x6a4e30, trim: 0x3a2a1a, inner: 0xd8c8a8, skin: 0xd8aa88, hair: 0x2a1a10, sash: 0x2a1a10, sleeve: .085, boots: 0x1a1410,
    hairStyle: 'bald', head(Hd) { Hd.push([G.tor, 0xb02a2a, M4(0, .17, 0, .1, .1, .1, 0, Math.PI / 2)]); Hd.push([G.box, 0xb02a2a, M4(0, .17, -.12, .03, .14, .02, 0, .3)]); Hd.push([G.sph, 0x2a1a10, M4(0, .03, .07, .06, .04, .04)]); },
    extraBody(B, w) { for (const s of [-1, 1]) B.push([G.sph, 0x5a4a3a, M4(s * .23 * w, 1.47, 0, .1 * w, .07, .1)]); B.push([G.box, 0x3a2a1a, M4(0, 1.25, .175 * w, .06, .5, .02, 0, 0, .7)]); },
    weaponR: W_GREAT, weaponRx: 1.0 },
  dart: { name: '暗器弟子', title: '暗器堂', h: .9, w: .78, robe: 0x3a4a44, lower: 0x2a3632, trim: 0xa8b0a0, inner: 0x5a6a60, hair: 0x101010, sash: 0x8a2a2a, sleeve: .06,
    head(Hd) { Hd.push([G.sph, 0x26302c, M4(0, .15, -.02, .125, .12, .13)]); Hd.push([G.box, 0x26302c, M4(0, .055, .085, .2, .07, .04)]); Hd.push([G.box, 0x8a2a2a, M4(0, .19, .09, .21, .02, .02)]); },
    extraBody(B, w) { B.push([new THREE.ConeGeometry(.36 * w, .62, 12), 0x26302c, M4(0, 1.3, -.02, 1, 1, .85)]); for (let i = 0; i < 6; i++) B.push([G.cone, 0xc8d0d8, M4(-.12 + i * .05, 1.0, .2 * w * .78 + .02, .012, .07, .012, 0, Math.PI)]); } },
  ghost: { name: '魔修虚影', title: '', h: 1.3, w: 1.15, robe: 0x5a20a0, lower: 0x3a1070, trim: 0xd090ff, inner: 0x8a40d0, skin: 0x7a40c0, hair: 0x2a0a50, eye: 0xffd0ff, angry: true, sleeve: .14, noLegs: true, ghost: true, ghostMat: ghostCharMat,
    head(Hd, hair) { for (const s of [-1, 1]) Hd.push([G.cone, 0xd090ff, M4(s * .07, .26, -.02, .02, .14, .02, 0, -.3, s * -.4)]); Hd.push([G.box, hair, M4(0, -.1, -.09, .24, .45, .05)]); } },
  dummy: { name: '黑甲陪练', title: '木人', h: 1.08, w: 1.25, robe: 0x1c1c22, lower: 0x141418, trim: 0x6a6a76, inner: 0x2a2a32, skin: 0x2a2a30, hair: 0x101014, sash: 0x8a2a2a, sleeve: .08, hairStyle: 'bald', eye: 0xd04030,
    head(Hd) { Hd.push([G.box, 0x18181e, M4(0, .06, 0, .27, .3, .27)]); Hd.push([G.box, 0x6a6a76, M4(0, .08, .14, .2, .03, .02)]); Hd.push([G.cone, 0x2a2a32, M4(0, .26, 0, .1, .12, .1)]); },
    extraBody(B, w) { for (const s of [-1, 1]) B.push([G.sph, 0x2a2a32, M4(s * .23 * w, 1.47, 0, .12 * w, .08, .12)]); B.push([G.box, 0x24242a, M4(0, 1.2, .16 * w, .36 * w, .4, .04)]); } },
  d1: { name: '弟子甲', title: '外门', h: .98, w: .9, robe: 0x5a7aa8, lower: 0x4a6890, trim: 0xe8eef4, inner: 0xf2f4f8, hair: 0x16121a, sash: 0x2a3a5a, sleeve: .08 },
  d2: { name: '弟子乙', title: '外门', h: .94, w: .82, robe: 0xa86a5a, lower: 0x8a5446, trim: 0xf4ece4, inner: 0xf8f2ea, hair: 0x1a1210, sash: 0x5a2a20, sleeve: .07 },
  d3: { name: '弟子丙', title: '外门', h: 1.0, w: .95, robe: 0x7a8a5a, lower: 0x627048, trim: 0xeef2e4, inner: 0xf4f6ee, hair: 0x121010, sash: 0x3a4a2a, sleeve: .08 },
  liu: { name: '刘醉', title: '酒痴', h: 1.0, w: 1.12, robe: 0x9a6a42, lower: 0x7a5232, trim: 0xd8b25a, inner: 0xe8dcc0, skin: 0xe8b090, hair: 0x2a2018, sash: 0x8a2a2a, sleeve: .12,
    head(Hd, hair) { Hd.push([G.sph, hair, M4(0, .22, -.05, .06, .05, .06)]); Hd.push([G.cyl, 0x8a2a2a, M4(0, .19, -.02, .145, .03, .145)]); Hd.push([G.sph, 0xd86a5a, M4(0, .02, .12, .028, .024, .024)]); for (const s of [-1, 1]) Hd.push([G.box, hair, M4(s * .09, -.02, .02, .02, .18, .03, 0, 0, s * .2)]); } },
  stone: { name: '小石头', title: '同门', h: .8, w: .78, robe: 0x6a8ab8, lower: 0x52709a, trim: 0xf0f0e8, inner: 0xf6f6f0, hair: 0x14100c, sash: 0xd8b25a, sleeve: .06,
    head(Hd, hair) { for (const s of [-1, 1]) Hd.push([G.sph, hair, M4(s * .08, .2, -.02, .045, .045, .045)]); } },
  pharm: { name: '白芷', title: '药师', h: .96, w: 1.0, robe: 0x8a7a5a, lower: 0x6e6046, trim: 0x4a6a3a, inner: 0xeee6d4, hair: 0xb8b8b0, brow: 0xd8d8d0, sash: 0x4a6a3a, sleeve: .12 },
  cook: { name: '伙夫', title: '食堂', h: .98, w: 1.3, robe: 0xd8d0c0, lower: 0x9a8a70, trim: 0x6a5a40, inner: 0xf4f0e8, skin: 0xe0b090, hair: 0x2a2018, sash: 0x8a3a2a, sleeve: .09, hairStyle: 'bald' },
  guard: { name: '守门弟子', title: '山门', h: 1.04, w: 1.05, robe: 0x4a5a6a, lower: 0x3a4856, trim: 0xd8b25a, inner: 0xe8e8e8, hair: 0x101014, sash: 0x8a2a2a, sleeve: .07, weaponR: W_GREAT, weaponRx: 1.0 },
  appr: { name: '魔修学徒虚影', title: '', h: .95, w: .85, robe: 0x6a30b0, lower: 0x4a1a80, trim: 0xc080ff, inner: 0x8a50d0, skin: 0x8a50c0, hair: 0x2a0a50, eye: 0xffc0ff, angry: true, sleeve: .1, noLegs: true, ghost: true, ghostMat: null,
    head(Hd, hair) { Hd.push([G.box, hair, M4(0, -.1, -.09, .22, .4, .05)]); } },
};
/* each 学徒虚影 gets its own shader material (independent fade / hit flash), sharing the global time uniform */
function newApprMat() { const m = ghostCharMat.clone(); m.uniforms.t = timeU; m.uniforms.col.value.set(0xb070ff); m.userData.keepE = true; return m; }
function makeAppr() { CAST.appr.ghostMat = newApprMat(); const a = makeActor('appr', { float: true, kbS1: true, speed: 2.6 }); a.world = 'digong'; return a; }
function makeActor(id, extra = {}) {
  const c = CAST[id], m = buildChar(c);
  const holder = new THREE.Group(); holder.add(m.root); scene.add(holder); holder.visible = false;
  const shadow = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: c.ghost ? .0 : .22, depthWrite: false }), holder, 0, .02, 0, .45 * (c.w || 1), .45 * (c.w || 1), 1); shadow.rotation.x = -Math.PI / 2;
  const a = Object.assign({ id, kind: id, name: c.name, title: c.title, lvTxt: '1', boss: false, selfAir: true, showNum: true, x: 0, z: 0, y: 0, yaw: 0, radius: .5 * (c.w || 1), height: 1.85 * (c.h || 1), hp: 1, maxHp: 1, armor: 1, floorHp: 0,
    model: m, holder, mats: m.mats, act: null, cd: 1, flash: 0, warnT: 0, dead: false, stagger: 0, moveAmt: 0, ph: 0, pose: 'idle', cur: JSON.parse(JSON.stringify(CPOSE.idle)), world: 'academy', shown: false, path: null, speed: 3.2, fighting: false, solid: false, label: null, spin: 0,
    update(dt) { foeUpdate(this, dt); }, onInterrupt() { this.act = null; this.warnT = 0; this.pose = 'stagger'; this.cd = Math.max(this.cd, .8); if (this.onCancel) this.onCancel(); } }, extra);
  a.r = a.radius; return a;
}
function setActorPose(a, name) { a.pose = name; }
/* procedural animation */
function animActor(a, dt) {
  const m = a.model, P = CPOSE[a.pose] || CPOSE.idle, k = Math.min(1, dt * (a.poseK || 9)), cur = a.cur;
  for (const key of ['ar', 'al']) for (let i = 0; i < 2; i++) cur[key][i] = lerp(cur[key][i], P[key][i], k);
  for (const key of ['lean', 'twist', 'crouch']) cur[key] = lerp(cur[key], P[key], k);
  a.ph += dt * (3 + 6 * a.moveAmt);
  const sw = Math.sin(a.ph) * .55 * a.moveAmt, idleB = Math.sin(gameT * 1.8 + a.x) * .02;
  const freeArms = a.pose === 'idle' || a.pose === 'whisk';
  m.armR.p.rotation.set(cur.ar[0] + (freeArms ? sw : 0), 0, cur.ar[1]);
  m.armL.p.rotation.set(cur.al[0] - (freeArms ? sw : 0), 0, cur.al[1]);
  m.body.rotation.set(cur.lean + a.moveAmt * .06, cur.twist + a.spin, 0);
  m.body.position.y = -cur.crouch * .55 + Math.abs(Math.sin(a.ph)) * .04 * a.moveAmt + idleB * (a.float ? 4 : 0);
  m.head.rotation.x = -cur.lean * .4 + (a.headTilt || 0);
  if (a.lie) { m.root.rotation.x = -Math.PI / 2 + .06; m.root.position.set(0, .16, .95); m.head.rotation.x = .5 + Math.sin(gameT * .7) * .05; m.armR.p.rotation.set(-2.4, 0, -.3); m.armL.p.rotation.set(-.3, 0, .5); }
  if (a.flash > 0) { a.flash = Math.max(0, a.flash - dt * 5); const mu = a.model.mat && a.model.mat.uniforms; if (mu && mu.fl) mu.fl.value = a.flash * .6; else setFlash(a, a.flash * .7); }
}
function placeActor(a, x, z, yaw) { a.x = x; a.z = z; if (yaw !== undefined) a.yaw = yaw; a.path = null; a.moveAmt = 0; syncActor(a); }
function syncActor(a) { // self-heal any non-finite transform so a bad value can never make an actor vanish permanently
  if (!isFinite(a.x) || !isFinite(a.z)) { a.x = a.lastX ?? 0; a.z = a.lastZ ?? 0; } else { a.lastX = a.x; a.lastZ = a.z; }
  if (!isFinite(a.yaw)) a.yaw = 0; if (!isFinite(a.airY)) a.airY = 0; if (!isFinite(a.holder.rotation.x)) a.holder.rotation.x = 0;
  a.holder.position.set(a.x, actorY(a) + (a.float ? .35 + Math.sin(gameT * 1.6) * .1 : 0) + (a.airY || 0), a.z); a.holder.rotation.y = a.yaw; }
function actorY(a) { const w = worlds[a.world]; return w && w.actorH ? w.H(a.x, a.z) : 0; }
function faceActor(a, x, z, k = 1) { a.yaw += angDiff(a.yaw, Math.atan2(x - a.x, z - a.z)) * Math.min(1, k); }
/* move along a list of waypoints; returns true when done */
function walkPath(a, dt) {
  if (!a.path || !a.path.length) { a.moveAmt += (0 - a.moveAmt) * Math.min(1, dt * 6); return true; }
  const p = a.path[0], dx = p[0] - a.x, dz = p[1] - a.z, d = Math.hypot(dx, dz);
  if (d < .25) { a.path.shift(); if (!a.path.length) { a.moveAmt = 0; return true; } return false; }
  const sp = Math.min(d / dt, a.speed); a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; faceActor(a, p[0], p[1], dt * 8); a.moveAmt += (1 - a.moveAmt) * Math.min(1, dt * 6);
  if (world.resolve && !a.noCollide) { const r = world.resolve(a.x, a.z, a.r * .8); a.x = r[0]; a.z = r[1]; }
  return false;
}
/* ================= foe AI (duels + phantom) ================= */
function foeTarget(e) { if (e.tgtAlly && ch1.ally && !ch1.ally.retreat) return { x: ch1.ally.x, z: ch1.ally.z, ally: true }; const p = aimPos(); return { x: p.x, z: p.z }; }
function foeHitArea(e, x, z, r, dmg, kb, melee = true) {
  let hit = false; dmg = Math.round(dmg * (e.dmgMul || 1));
  if (playerNear(x, z, r + .3)) { const res = hurtPlayer(dmg, { attacker: e, x: e.x, z: e.z, melee }); if (res === 'hit' && kb) knockPlayer(e.x, e.z, kb); hit = true; }
  else if (player.stealthT > 0 && decoy.active && Math.hypot(decoy.pos.x - x, decoy.pos.z - z) < r + .3) decoyHit();
  const al = ch1.ally; if (al && ch1.fight && ch1.fight.withAlly && !al.retreat && Math.hypot(al.x - x, al.z - z) < r + .3) allyHurt(dmg);
  return hit;
}
function foeMeleeFront(e, range, half, dmg, kb) {
  let hit = false; dmg = Math.round(dmg * (e.dmgMul || 1));
  if (inFront(e, player.x, player.z, range, half)) { const res = hurtPlayer(dmg, { attacker: e, x: e.x, z: e.z, melee: true }); if (res === 'hit' && kb) knockPlayer(e.x, e.z, kb); hit = true; }
  else if (player.stealthT > 0 && decoy.active && inFront(e, decoy.pos.x, decoy.pos.z, range, half)) decoyHit();
  const al = ch1.ally; if (al && ch1.fight && ch1.fight.withAlly && !al.retreat && inFront(e, al.x, al.z, range, half)) allyHurt(dmg);
  return hit;
}
function foeSlashFx(e, hex, tilt = 0, s = 1) {
  const holder = new THREE.Group(); holder.position.set(e.x, 1.1 * (e.model.root.scale.x), e.z); holder.rotation.y = e.yaw + Math.PI;
  const m = new THREE.Mesh(ARC_WIDE, slashMat(hex)); m.rotation.x = -Math.PI / 2 + .3; m.rotation.z = Math.PI + tilt; m.scale.setScalar(.75 * s); holder.add(m);
  addFx(holder, .38, k => { m.material.uniforms.prog.value = Math.min(1.25, k * 2.4); m.material.uniforms.fade.value = k < .5 ? 1 : 1 - (k - .5) * 2; });
}
function moveFoe(e, vx, vz, sp, dt) { const l = Math.hypot(vx, vz) || 1; e.x += vx / l * sp * dt; e.z += vz / l * sp * dt; e._mv = 1; }
function dartMesh(hex = 0xd8e0e8) { const g = new THREE.Group(); mk(G.cone, new THREE.MeshBasicMaterial({ color: hex }), g, 0, 0, 0, .05, .34, .05).rotation.x = Math.PI / 2; mk(G.sphLo, addMat(0x9fffd0, .7), g, 0, 0, 0, .1, .1, .1); return g; }
function foeUpdate(e, dt) {
  if (!e.fighting) { animActor(e, dt); syncActor(e); return; }
  const D = e.def; e._mv = 0;
  if (e.dead) { e.act = null; e.warnT = 0; setActorPose(e, D.deadPose || 'kneel'); e.moveAmt = 0; if (D.onDeadTick) D.onDeadTick(e, dt); animActor(e, dt); syncActor(e); return; }
  const tg = foeTarget(e), dx = tg.x - e.x, dz = tg.z - e.z, dist = Math.hypot(dx, dz);
  if (e.stagger > 0) { e.stagger -= dt; setActorPose(e, 'stagger'); if (e.broken) e.model.body.rotation.z = Math.sin(gameT * 9) * .05; }
  else if (e.act) { const a = e.act, p = a.t; a.t += dt; a.step(a.t, p, dt, tg); if (e.act === a && a.t >= a.dur) { e.act = null; e.cd = D.cd(e); setActorPose(e, D.idlePose || 'ready'); } }
  else {
    setActorPose(e, D.idlePose || 'ready');
    if (e.ai) { D.think(e, dt, tg, dist, dx, dz); e.cd -= dt; if (e.cd <= 0 && !e.act) { const nm = D.pick(e, dist, tg); if (nm) { e.act = { name: nm, t: 0, dur: 1, step() { } }; D.acts[nm](e, e.act, tg); } else e.cd = .3; } }
    else faceActor(e, tg.x, tg.z, dt * 4);
  }
  // collision + arena
  if (world.resolve) { const r = world.resolve(e.x, e.z, e.r * .8); e.x = r[0]; e.z = r[1]; }
  const F = ch1.fight; if (F && F.ring) { const R = ACAD.ring, ox = e.x - R.x, oz = e.z - R.z, d = Math.hypot(ox, oz), mx = R.r - .6; if (d > mx) { e.x = R.x + ox / d * mx; e.z = R.z + oz / d * mx; } }
  { const ox = e.x - player.x, oz = e.z - player.z, d = Math.hypot(ox, oz), mn = e.r + .55; if (d < mn && d > 1e-3 && !e.passThrough) { e.x = player.x + ox / d * mn; e.z = player.z + oz / d * mn; } }
  e.moveAmt += ((e._mv ? 1 : 0) - e.moveAmt) * Math.min(1, dt * 7);
  if (D.tick) D.tick(e, dt);
  e.warnT = Math.max(0, e.warnT - dt);
  animActor(e, dt); syncActor(e);
}
/* ---- 重剑弟子: slow, huge telegraphed hits, long recovery windows ---- */
const FOE_HEAVY = {
  hp: 3400, tough: 170, lv: 1, idlePose: 'ready', speed: 2.3,
  cd: e => rand(1.3, 2.0) * (e.hp < e.maxHp * .4 ? .8 : 1),
  think(e, dt, tg, d, dx, dz) { faceActor(e, tg.x, tg.z, dt * 3); if (d > 2.6) moveFoe(e, dx, dz, FOE_HEAVY.speed, dt); },
  pick(e, d) { if (d < 3.3) return Math.random() < .58 ? 'smash' : 'sweep'; if (d > 6 && Math.random() < .55) return 'charge'; return d < 5 ? 'smash' : null; },
  acts: {
    smash(e, A) { const rage = e.hp < e.maxHp * .4; A.dur = 2.5; A.n = rage ? 2 : 1; A.k = 0; A.setup = (t0) => { A.t0 = t0; A.fx = e.x + Math.sin(e.yaw) * 1.9; A.fz = e.z + Math.cos(e.yaw) * 1.9; teleCircle(A.fx, A.fz, 2.1, 1.05, 0xff5020); e.warnT = 1.05; setActorPose(e, 'raise'); e.poseK = 4; }; A.setup(0);
      A.step = (t, p, dt, tg) => {
        const lt = t - A.t0;
        if (lt < .5) faceActor(e, tg.x, tg.z, dt * 3);
        if (lt >= 1.05 && !A['h' + A.k]) { A['h' + A.k] = 1; e.poseK = 22; setActorPose(e, 'slam'); sfx('boom'); shake = Math.max(shake, .35); shockRing(V3(A.fx, 0, A.fz), 0xffb060, .4, 3.2, .5); burst(V3(A.fx, .3, A.fz), 30, 0xc8b090, 7, .7, .7, -6, .4); foeHitArea(e, A.fx, A.fz, 2.1, 140, 2); }
        if (A.k + 1 < A.n && lt > 1.6) { A.k++; A.dur = t + 2.5; A.setup(t); }
        if (lt > 2.1) e.poseK = 5;
      }; },
    sweep(e, A) { A.dur = 2.2; teleCircle(e.x, e.z, 3.1, .9, 0xff5020); e.warnT = .9; setActorPose(e, 'windR'); e.poseK = 5;
      A.step = (t, p, dt) => { if (t >= .9 && t < 1.3) { e.spin = (t - .9) / .4 * Math.PI * 2; setActorPose(e, 'slashR'); } else e.spin = 0; if (p < .95 && t >= .95) { sfx('whoosh'); foeSlashFx(e, 0xffc080, 0, 1.4); foeHitArea(e, e.x, e.z, 3.1, 110, 2.6); } if (t > 1.4) e.poseK = 4; }; },
    charge(e, A, tg) { const yaw = Math.atan2(tg.x - e.x, tg.z - e.z), len = 9; A.dur = 1.0 + .9 + 1.1; e.yaw = yaw; teleLine(e.x, e.z, yaw, len, 2.2, 1.0, 0xff4020); e.warnT = 1.0; setActorPose(e, 'thrust'); e.poseK = 5;
      A.step = (t, p, dt) => { if (t > 1.0 && t < 1.9) { if (p <= 1.0) sfx('roar'); moveFoe(e, Math.sin(yaw), Math.cos(yaw), 10, dt); if (Math.random() < .7) emit(e.x + rand(-.5, .5), .15, e.z + rand(-.5, .5), rand(-1, 1), rand(.5, 1.5), rand(-1, 1), 0xc8b898, .6, .6, -2); if (!A.hit && Math.hypot(player.x - e.x, player.z - e.z) < 1.6) { A.hit = 1; const r = hurtPlayer(120, { attacker: e, x: e.x, z: e.z, melee: true }); if (r === 'hit') knockPlayer(e.x, e.z, 2.6); } } if (t >= 1.9) setActorPose(e, 'stagger'); }; },
  },
};
/* ---- 暗器弟子: keeps distance, darts, smoke-bomb backflip ---- */
const FOE_DART = {
  hp: 3600, tough: 130, lv: 2, idlePose: 'ready', speed: 4.4,
  cd: e => rand(1.1, 1.7),
  think(e, dt, tg, d, dx, dz) {
    faceActor(e, tg.x, tg.z, dt * 6); e.strT = (e.strT || 0) - dt; if (e.strT <= 0) { e.strT = rand(1.2, 2.4); e.strDir = Math.random() < .5 ? -1 : 1; }
    if (d < 5.5) moveFoe(e, -dx - dz * e.strDir * .6, -dz + dx * e.strDir * .6, FOE_DART.speed, dt);
    else if (d > 10.5) moveFoe(e, dx, dz, FOE_DART.speed * .8, dt);
    else moveFoe(e, -dz * e.strDir, dx * e.strDir, 2.6, dt);
    e.evCd = (e.evCd || 0) - dt;
    if (d < 3.0 && e.evCd <= 0 && !e.act) { e.evCd = 5.5; e.act = { name: 'flip', t: 0, dur: 1, step() { } }; FOE_DART.acts.flip(e, e.act, tg); }
  },
  pick(e, d) { if (d < 3) return null; return Math.random() < .55 ? 'volley' : 'rapid'; },
  acts: {
    volley(e, A, tg) { const n = e.hp < e.maxHp * .5 ? 5 : 3; A.dur = 1.2; e.warnT = .55; setActorPose(e, 'throwW'); e.poseK = 8;
      A.step = (t, p, dt, tg2) => { if (t < .5) faceActor(e, tg2.x, tg2.z, dt * 8); if (p < .55 && t >= .55) { setActorPose(e, 'throwR'); e.poseK = 20; sfx('swish'); const base = Math.atan2(tg2.x - e.x, tg2.z - e.z); for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .2, mesh = dartMesh(); mesh.rotation.y = a; spawnProj({ mesh, pos: V3(e.x, 1.25, e.z), vel: V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(15), r: .7, dmg: 55, life: 1.6, col: 0x9fffd0, attacker: e }); } } }; },
    rapid(e, A) { A.dur = 1.6; e.warnT = .4; setActorPose(e, 'throwW'); e.poseK = 10; A.k = 0;
      A.step = (t, p, dt, tg2) => { faceActor(e, tg2.x, tg2.z, dt * 10); const at = .4 + A.k * .2; if (A.k < 5 && t >= at) { A.k++; setActorPose(e, A.k % 2 ? 'throwR' : 'throwW'); sfx('swish'); const lead = V3(tg2.x + rand(-.4, .4), 1.25, tg2.z + rand(-.4, .4)); const from = V3(e.x, 1.25, e.z); const v = lead.sub(from).setY(0).normalize().multiplyScalar(17); const mesh = dartMesh(0xffe0a0); mesh.rotation.y = Math.atan2(v.x, v.z); spawnProj({ mesh, pos: from, vel: v, r: .6, dmg: 40, life: 1.5, col: 0xffd080, attacker: e }); } }; },
    flip(e, A, tg) { A.dur = 1.0; const ax = e.x - tg.x, az = e.z - tg.z, l = Math.hypot(ax, az) || 1; A.vx = ax / l; A.vz = az / l; A.ox = e.x; A.oz = e.z; e.passThrough = true; smoke(V3(e.x, .8, e.z), 0x8aa090); sfx('whoosh');
      teleCircle(A.ox, A.oz, 2.2, .75, 0x80ff60, () => { sfx('boom'); burst(V3(A.ox, .5, A.oz), 40, 0x9aff80, 6, .8, .7, -2, .3); shockRing(V3(A.ox, 0, A.oz), 0x9aff80, .3, 2.6, .5); foeHitArea(e, A.ox, A.oz, 2.2, 80, 1.6, false); });
      A.step = (t, p, dt) => { if (t < .45) { moveFoe(e, A.vx, A.vz, 11, dt); e.airY = Math.sin(t / .45 * Math.PI) * 1.2; e.spin = -t / .45 * Math.PI * 2; } else { e.airY = 0; e.spin = 0; e.passThrough = false; } }; },
  },
  tick(e, dt) { // orbiting darts
    const o = e.orbit; if (!o) return; o.visible = !e.dead; o.rotation.y += dt * 3.2; o.position.set(e.x, 1.05 + (e.airY || 0), e.z);
  },
};
/* ---- 墨寒: fast combos, sword waves, blink strikes, purple burst ---- */
const FOE_MOHAN = {
  hp: 4800, tough: 220, lv: 3, idlePose: 'ready', speed: 3.8,
  cd: e => rand(.9, 1.5),
  think(e, dt, tg, d, dx, dz) { faceActor(e, tg.x, tg.z, dt * 6); if (d > 3) moveFoe(e, dx, dz, FOE_MOHAN.speed, dt); else { e.sd = e.sd || 1; if (Math.random() < dt * .5) e.sd *= -1; moveFoe(e, -dz * e.sd, dx * e.sd, 1.8, dt); } },
  pick(e, d) { const low = e.hp < e.maxHp * .6, r = Math.random(); const opts = d < 3.2 ? (low ? ['combo', 'combo', 'burst', 'blink'] : ['combo', 'combo', 'blink']) : ['wave', 'wave', 'blink', 'dash']; let c = opts[Math.floor(r * opts.length)]; if (c === e.last && Math.random() < .6) c = opts[(opts.indexOf(c) + 1) % opts.length]; e.last = c; return c; },
  acts: {
    dash(e, A, tg) { A.dur = .5; setActorPose(e, 'thrust'); A.step = (t, p, dt, tg2) => { const dx = tg2.x - e.x, dz = tg2.z - e.z, d = Math.hypot(dx, dz); if (d > 1.8) moveFoe(e, dx, dz, 12, dt); faceActor(e, tg2.x, tg2.z, dt * 10); if (Math.random() < .8) emit(e.x, rand(.3, 1.8), e.z, 0, .5, 0, 0x8a40ff, .4, .5, 0); if (t >= .45 || d <= 1.8) { e.act = { name: 'combo', t: 0, dur: 1, step() { } }; FOE_MOHAN.acts.combo(e, e.act, tg2); } }; },
    combo(e, A) { A.dur = 2.2; const hits = [[.55, 55, 'slashR', .4], [1.0, 55, 'windR', -.5], [1.5, 85, 'slam', 0]];
      A.step = (t, p, dt, tg2) => {
        faceActor(e, tg2.x, tg2.z, dt * 5); const d = Math.hypot(tg2.x - e.x, tg2.z - e.z); if (d > 1.7 && t < 1.4) moveFoe(e, tg2.x - e.x, tg2.z - e.z, 3.5, dt);
        for (const [at, dmg, pose, tilt] of hits) { if (p < at - .38 && t >= at - .38) { e.warnT = .38; setActorPose(e, pose === 'slam' ? 'raise' : (pose === 'slashR' ? 'windR' : 'slashR')); e.poseK = 10; } if (p < at && t >= at) { setActorPose(e, pose); e.poseK = 24; sfx('swish'); foeSlashFx(e, 0xb060ff, tilt); foeMeleeFront(e, 3.0, 1.0, dmg, dmg > 60 ? 2 : .8); } }
      }; },
    wave(e, A) { const n = e.hp < e.maxHp * .5 ? 3 : 1; A.dur = 1.3; setActorPose(e, 'raise'); e.poseK = 7; e.warnT = .6;
      A.step = (t, p, dt, tg2) => { if (t < .55) faceActor(e, tg2.x, tg2.z, dt * 8); if (p < .6 && t >= .6) { setActorPose(e, 'slashR'); e.poseK = 20; sfx('whoosh'); const base = Math.atan2(tg2.x - e.x, tg2.z - e.z); for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * .32, dir = V3(Math.sin(a), 0, Math.cos(a)); const mesh = new THREE.Mesh(WAVE_GEO, slashMat(0xa040ff)); mesh.material.uniforms.prog.value = 1.3; mesh.rotation.order = 'YXZ'; mesh.rotation.y = a; mesh.rotation.z = .5; mesh.scale.setScalar(.85); spawnProj({ mesh, pos: V3(e.x, 1.2, e.z), vel: dir.multiplyScalar(13), r: 1.2, dmg: 85, life: 1.8, col: 0xa040ff, attacker: e }); } } }; },
    blink(e, A) { A.dur = 1.7; smoke(V3(e.x, 1, e.z)); e.holder.visible = false; e.invuln = true; sfx('whoosh');
      A.step = (t, p, dt, tg2) => {
        if (p < .45 && t >= .45) { const f = player.stealthT > 0 ? V3(Math.sin(decoy.holder.rotation.y), 0, Math.cos(decoy.holder.rotation.y)) : fwd(); e.x = tg2.x - f.x * 2.2; e.z = tg2.z - f.z * 2.2; if (world.resolve) { const r = world.resolve(e.x, e.z, .5); e.x = r[0]; e.z = r[1]; } faceActor(e, tg2.x, tg2.z, 1); e.holder.visible = true; e.invuln = false; smoke(V3(e.x, 1, e.z)); setActorPose(e, 'windR'); e.warnT = .55; teleCircle(e.x + Math.sin(e.yaw) * 1.3, e.z + Math.cos(e.yaw) * 1.3, 2, .55, 0xb040ff); }
        if (p < 1.0 && t >= 1.0) { setActorPose(e, 'slashR'); e.poseK = 24; sfx('swish'); foeSlashFx(e, 0xc060ff, .2, 1.1); foeMeleeFront(e, 3.2, 1.1, 100, 1.5); }
      }; e.onCancel = () => { e.holder.visible = true; e.invuln = false; }; },
    burst(e, A) { A.dur = 2.0; setActorPose(e, 'sky'); e.poseK = 5; e.warnT = 1.1; teleCircle(e.x, e.z, 4.0, 1.1, 0x9030ff);
      A.step = (t, p, dt) => { if (t < 1.1 && Math.random() < .8) { const a = rand(0, 6.28); emit(e.x + Math.cos(a) * 3.5, .2, e.z + Math.sin(a) * 3.5, -Math.cos(a) * 4, 1, -Math.sin(a) * 4, 0xa050ff, .5, .6, 0); } if (p < 1.1 && t >= 1.1) { setActorPose(e, 'slam'); e.poseK = 20; sfx('boom'); shake = Math.max(shake, .4); shockRing(V3(e.x, 0, e.z), 0xb060ff, .5, 5, .6); burst(V3(e.x, 1, e.z), 50, 0xb060ff, 8, .6, .6, -3); foeHitArea(e, e.x, e.z, 4.0, 115, 3); } }; },
  },
  tick(e, dt) { if (!e.dead && Math.random() < .7) { const a = rand(0, 6.28), r = rand(.2, .7); emit(e.x + Math.cos(a) * r, rand(.1, 2.1), e.z + Math.sin(a) * r, 0, rand(.3, 1), 0, Math.random() < .4 ? 0x1a0828 : 0x9a50ff, rand(.25, .5), rand(.6, 1.2), 0); } },
};
/* ---- 魔修虚影: floating phantom; may target 林清风 ---- */
const FOE_GHOST = {
  hp: 7600, tough: 260, lv: 5, idlePose: 'float', speed: 3.0, deadPose: 'sky',
  cd: e => rand(1.0, 1.6) * (e.cdMul || 1),
  reset(e) { // phase 1 baseline (also used on restart); fight ends via cutscene at 10% hp
    if (e.baseS === undefined) { e.baseS = e.model.root.scale.x; e.baseR = e.radius; e.baseH = e.height; }
    e.model.root.scale.setScalar(e.baseS); e.radius = e.r = e.baseR; e.height = e.baseH; e.p2 = false; e.trans = 0; e.dmgMul = 1; e.spMul = 1; e.cdMul = 1; e.floorHp = Math.round(e.maxHp * .1); ghostCharMat.uniforms.col.value.set(0x9a40ff);
  },
  think(e, dt, tg, d, dx, dz) { faceActor(e, tg.x, tg.z, dt * 4); if (d > 2.8 * (e.p2 ? 1.2 : 1)) moveFoe(e, dx, dz, FOE_GHOST.speed * (e.spMul || 1), dt); e.reT = (e.reT || 0) - dt; if (e.reT <= 0) { e.reT = rand(3, 5); e.tgtAlly = !!(ch1.ally && !ch1.ally.retreat && Math.random() < .3); } },
  pick(e, d) { const r = Math.random(); if (e.p2 && r < .24) return 'rain'; if (d < 3.2 * (e.p2 ? 1.2 : 1)) return r < .55 ? 'claw' : r < .8 ? 'nova' : 'grasp'; return r < .4 ? 'orbs' : r < .75 ? 'grasp' : 'nova'; },
  acts: {
    claw(e, A) { A.dur = 1.5; setActorPose(e, 'windR'); e.poseK = 7; e.warnT = .6; const fx = e.x + Math.sin(e.yaw) * 1.6, fz = e.z + Math.cos(e.yaw) * 1.6; teleCircle(fx, fz, 2.2, .6, 0xb040ff);
      A.step = (t, p) => { if (p < .6 && t >= .6) { setActorPose(e, 'slashR'); e.poseK = 22; sfx('swish'); foeSlashFx(e, 0xc060ff, .3, 1.2); foeHitArea(e, fx, fz, 2.2, 100, 1.6); } }; },
    orbs(e, A) { A.dur = 1.8; setActorPose(e, 'cast'); e.poseK = 6;
      A.step = (t, p) => { if (p < .7 && t >= .7) { sfx('whoosh'); for (let i = 0; i < 5; i++) { const a = e.yaw + (i - 2) * .5, mesh = new THREE.Group(); mk(G.sphLo, new THREE.MeshBasicMaterial({ color: 0xe0b0ff }), mesh, 0, 0, 0, .22, .22, .22); mk(G.sphLo, addMat(0x9030ff, .6), mesh, 0, 0, 0, .45, .45, .45); spawnProj({ mesh, pos: V3(e.x, 1.6, e.z), vel: V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(5.5), r: .8, dmg: Math.round(45 * (e.dmgMul || 1)), life: 4, col: 0xb060ff, attacker: e, upd: pp => { const tg = aimPos(), v = V3(tg.x - pp.pos.x, 0, tg.z - pp.pos.z).normalize().multiplyScalar(6.2); pp.vel.lerp(v, .025); pp.pos.y = lerp(pp.pos.y, 1.2, .05); } }); } } }; },
    nova(e, A) { A.dur = 2.1; setActorPose(e, 'sky'); e.poseK = 5; e.warnT = 1.3; teleCircle(e.x, e.z, 5, 1.3, 0x8020ff);
      A.step = (t, p) => { if (p < 1.3 && t >= 1.3) { setActorPose(e, 'slam'); e.poseK = 20; sfx('boom'); shake = Math.max(shake, .45); shockRing(V3(e.x, 0, e.z), 0xc070ff, .5, 6, .7); burst(V3(e.x, 1, e.z), 60, 0xb060ff, 9, .6, .7, -2); foeHitArea(e, e.x, e.z, 5, 130, 3); } }; },
    rain(e, A) { A.dur = 2.6; setActorPose(e, 'sky'); e.poseK = 6; sfx('roar');
      A.step = (t, p) => { for (const at of [.3, .85, 1.4]) if (p < at && t >= at) { const tp = aimPos(), x = tp.x, z = tp.z; teleCircle(x, z, 1.8, .8, 0xc040ff, () => { sfx('stone'); burst(V3(x, .3, z), 24, 0xc070ff, 6, .5, .5, -4, .7); shockRing(V3(x, 0, z), 0xc070ff, .3, 2.2, .4); foeHitArea(e, x, z, 1.8, 60, 1.0); });
          const s = cheapSword(purpleSwordM, purpleGoldM, 1.6); s.position.set(x, 7, z); s.rotation.x = Math.PI; addFx(s, .8, k => { s.position.y = .6 + 6.4 * (1 - k * k); }); } }; },
    grasp(e, A, tg) { A.dur = 1.6; setActorPose(e, 'cast'); e.poseK = 6; const pts = [[tg.x, tg.z]]; if (e.hp < e.maxHp * .5) { const p2 = tg.ally ? aimPos() : (ch1.ally && !ch1.ally.retreat ? ch1.ally : null); if (p2) pts.push([p2.x, p2.z]); }
      for (const [x, z] of pts) teleCircle(x, z, 2.0, 1.0, 0x9030ff, () => { sfx('stone'); burst(V3(x, .3, z), 30, 0xb060ff, 7, .5, .6, -4, .8); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, s = cheapSword(purpleSwordM, purpleGoldM, 1.4); s.position.set(x + Math.cos(a) * .9, 0, z + Math.sin(a) * .9); s.rotation.z = Math.cos(a) * .4; s.rotation.x = -Math.sin(a) * .4; addFx(s, .6, kk => { s.position.y = Math.sin(Math.min(1, kk * 3) * Math.PI / 2) * .8 - .5 - kk * .3; }); } foeHitArea(e, x, z, 2.0, 90, 1.2, false); }); },
  },
  tick(e, dt) {
    if (!e.dead && !e.p2 && !e.trans && e.hp < e.maxHp * .5) { // ---- phase 2 transition ----
      e.trans = 1.6; if (e.act) cancelAct(e); e.act = null; e.warnT = 0; e.invuln = true; e.stagger = 1.7; e.holder.visible = true;
      banner('魔修虚影 · 第二形态', '虚影暴涨，攻势更烈！', 1.8); sfx('roar'); shake = Math.max(shake, .55); flashScreen('#b060ff', .35, .6);
      shockRing(V3(e.x, 0, e.z), 0xc070ff, .5, 7, .8); burst(V3(e.x, 1.5, e.z), 70, 0xb060ff, 9, .6, .9, -1); ghostCharMat.uniforms.col.value.set(0xc03cff);
    }
    if (e.trans > 0) { e.trans -= dt; const k = 1 - Math.max(0, e.trans) / 1.6; e.model.root.scale.setScalar(e.baseS * (1 + .45 * k * k * (3 - 2 * k))); e.stagger = Math.max(e.stagger, .05); if (Math.random() < .9) { const a = rand(0, 6.28), r = rand(1.5, 3); emit(e.x + Math.cos(a) * r, rand(.1, 3), e.z + Math.sin(a) * r, -Math.cos(a) * 3, rand(.5, 2), -Math.sin(a) * 3, 0xc070ff, .45, .6, 0); }
      if (e.trans <= 0) { e.trans = 0; e.p2 = true; e.invuln = false; e.dmgMul = 1.2; e.spMul = 1.3; e.cdMul = .78; e.radius = e.r = e.baseR * 1.3; e.height = e.baseH * 1.4; e.stagger = 0; e.cd = .6; sfx('boom'); shockRing(V3(e.x, 0, e.z), 0xffffff, .3, 4, .5); } }
    if (!e.dead && Math.random() < (e.p2 ? 1 : .8)) emit(e.x + rand(-.5, .5), rand(.2, e.p2 ? 3.6 : 2.6), e.z + rand(-.5, .5), 0, rand(.5, 1.4), 0, Math.random() < .3 ? 0x2a0a40 : 0xb060ff, rand(.3, .6), rand(.6, 1.2), 0); },
  onDeadTick(e, dt) { e.fade = Math.max(0, (e.fade ?? 1) - dt * .5); ghostCharMat.uniforms.op.value = e.fade; if (Math.random() < .8) emit(e.x + rand(-.6, .6), rand(.2, 2.5), e.z + rand(-.6, .6), 0, rand(1, 2.4), 0, 0xc080ff, .5, .9, 0); },
};
/* ---- 魔修学徒虚影 (bridge fight): weak melee phantoms; knocked off the bridge = instant kill ---- */
const FOE_APPR = {
  hp: 520, tough: 0, lv: 2, idlePose: 'float', speed: 2.6, deadPose: 'sky',
  cd: e => rand(1.6, 2.4),
  think(e, dt, tg, d, dx, dz) { faceActor(e, tg.x, tg.z, dt * 5); if (d > 1.9) moveFoe(e, dx, dz, FOE_APPR.speed, dt); else if (Math.random() < dt * .8) e.sd = -(e.sd || 1); },
  pick(e, d) { return d < 2.6 ? 'slash' : null; },
  acts: {
    slash(e, A) { A.dur = 1.25; setActorPose(e, 'windR'); e.poseK = 8; e.warnT = .5;
      A.step = (t, p, dt, tg) => { if (t < .35) faceActor(e, tg.x, tg.z, dt * 6); if (p < .5 && t >= .5) { setActorPose(e, 'slashR'); e.poseK = 22; sfx('swish'); foeSlashFx(e, 0xb070ff, .2, .7); foeMeleeFront(e, 2.3, .9, 40, .4); } }; },
  },
  tick(e, dt) { apprBridge(e); if (!e.dead && Math.random() < .3) emit(e.x + rand(-.3, .3), rand(.2, 1.6), e.z + rand(-.3, .3), 0, rand(.3, .9), 0, Math.random() < .3 ? 0x2a0a40 : 0xb070ff, rand(.2, .4), rand(.5, 1), 0); },
  onDeadTick(e, dt) {
    e.fade = Math.max(0, (e.fade ?? 1) - dt * (e.falling ? .9 : 1.2)); e.model.mat.uniforms.op.value = e.fade;
    if (e.falling) { e.fallV = (e.fallV || 0) + dt * 22; e.airY = (e.airY || 0) - e.fallV * dt; e.x += (e.fdx || 0) * dt; e.z += (e.fdz || 0) * dt; e.fdx *= .97; e.fdz *= .97; e.holder.rotation.x = Math.min(1.2, (e.holder.rotation.x || 0) + dt * 2); }
    if (e.fade > 0 && Math.random() < .6) emit(e.x + rand(-.4, .4), (e.airY || 0) + rand(.2, 1.6), e.z + rand(-.4, .4), 0, rand(1, 2), 0, 0xc080ff, .35, .7, 0);
  },
};
/* keep apprentices on the bridge while they walk; only a knockback can carry them over the edge */
function apprBridge(e) {
  if (e.dead || world.name !== 'digong' || !world.bridge) return; const C = DG.chasm;
  if (e.z < C.z0 || e.z > C.z1) return;
  if (e.kbT > 0) { if (Math.abs(e.x) > C.hw + .2) apprFall(e); return; }
  e.x = clamp(e.x, -C.hw + .35, C.hw - .35);
}
function apprFall(e) {
  if (e.dead) return; const v = e.kbV || V3(Math.sign(e.x), 0, 0); e.fdx = v.x * .35; e.fdz = v.z * .35; e.kbT = 0; e.falling = true; e.fallV = 2; e.passThrough = true;
  showNum(V3(e.x, 1.8, e.z), '坠崖', 'brk'); sfx('whoosh'); burst(V3(e.x, .8, e.z), 26, 0xc080ff, 5, .5, .7, -3);
  e.floorHp = 0; e.hp = 0; killEnemy(e); ch1.apprFalls = (ch1.apprFalls || 0) + 1;
}
/* ---- 林清风 (第二日切磋): a gentler 墨寒 moveset, no blink / burst, reduced damage ---- */
const FOE_LIN = Object.assign({}, FOE_MOHAN, {
  hp: 2600, tough: 150, lv: 3, speed: 3.2,
  cd: e => rand(1.3, 2.0),
  reset(e) { e.dmgMul = .62; e.floorHp = 0; },
  pick(e, d) { const r = Math.random(); if (d < 3.2) return r < .75 ? 'combo' : 'dash'; return r < .6 ? 'wave' : 'dash'; },
  tick(e, dt) { if (!e.dead && Math.random() < .35) emit(e.x + rand(-.4, .4), rand(.2, 1.9), e.z + rand(-.4, .4), 0, rand(.3, .8), 0, 0x6ff0e0, .3, .7, 0); },
});
/* ---- ally (林清风 in the phantom fight) ---- */
function allyHurt(d) { const al = ch1.ally; if (!al || al.retreat) return; al.hpF = Math.max(0, al.hpF - d / 900); showNum(V3(al.x, 2.1, al.z), '-' + Math.round(d), 'allyh'); al.flash = 1; if (al.hpF < .3) { al.retreat = 6; toast('林清风：我先调息片刻，你撑住！'); } }
function allyHit(e, d, td) { if (!e || e.dead || e.invuln) return; const tm = toughMult(e); const dmg = Math.max(1, Math.round(d * tm * rand(.9, 1.1))); e.hp = Math.max(e.floorHp || 0, e.hp - dmg); e.flash = 1; if (e.tough && !e.broken && !e.refill) { e.T = Math.max(0, e.T - td); if (e.T <= 0 && e.hp > 0) breakBoss(e); } showNum(V3(e.x, e.height * .8, e.z), dmg, 'ally'); burst(eCenter(e), 8, 0x8ff0e0, 5, .4, .35, -4); if (e.hp <= 0 && !e.dead) killEnemy(e); }
/* ================= v4 · 第一章 学院 — story, dialogue, objectives, fights, saves ================= */
const ch1 = { cp: 'intro', co: null, wait: null, fight: null, ally: null, follow: false, trail: [], A: null, flags: {}, timers: [], obj: null, camT: null, talking: false, uses: [], noRide: false, hl: null, lastSpeaker: null };
const CP_ORDER = ['intro', 'lingen', 'school', 'day1', 'day2', 'day3', 'night', 'arena', 'duel1', 'duel2', 'duel3', 'ceremony', 'heart', 'library', 'hidden', 'digong', 'chasm', 'bridge', 'chamber', 'phantom', 'tunnel', 'door', 'hall', 'placed', 'return', 'rings', 'gate', 'done'];
CP_ORDER.splice(CP_ORDER.indexOf('school') + 1, 0, 'shield');
const CP_CN = { lingen: '测灵根', day1: '第一日 · 习剑', day2: '第二日 · 切磋', day3: '第三日 · 闲暇', night: '第三日 · 夜', heart: '同道', rings: '御剑试炼', intro: '初入学院', school: '前往学堂', shield: '学堂 · 护盾课', arena: '学院大比', duel1: '大比 · 第一场', duel2: '大比 · 第二场', duel3: '大比 · 决赛', ceremony: '颁奖', library: '图书馆禁阁', hidden: '无形之门', digong: '地宫', chasm: '地宫 · 断崖', bridge: '地宫 · 石桥', chamber: '地宫 · 密室', phantom: '地宫 · 魔修虚影', tunnel: '地底甬道', door: '七印之门', hall: '七印镜殿', placed: '七印镜殿 · 归书', return: '返回地面', gate: '下山', done: '已完成' };
const CP_LV = { lingen: 1, day1: 1, day2: 1, day3: 1, night: 1, heart: 5, rings: 5, intro: 1, school: 1, shield: 1, arena: 1, duel1: 1, duel2: 2, duel3: 3, ceremony: 5, library: 5, hidden: 5, digong: 5, chasm: 5, bridge: 5, chamber: 5, phantom: 5, tunnel: 5, door: 5, hall: 5, placed: 5, return: 5, gate: 5, done: 5 };
function slotStageTxt(d) { if (d.stage !== 'ch1') return '第一章 · 学院'; return '第一章 · ' + (CP_CN[d.ch] || '学院'); }
function hasItem(id) { return (player.items || []).includes(id); }
function giveItem(id, silent) { if (!player.items) player.items = []; if (!player.items.includes(id)) player.items.push(id); }
function takeItem(id, silent) { if (player.items) player.items = player.items.filter(x => x !== id); }
function cpIdx(c) { return CP_ORDER.indexOf(c); }
function setCP(c) { ch1.cp = c; saveGame(); }
/* ---------- actors ---------- */
function ensureActors() {
  if (ch1.A) return ch1.A;
  const A = ch1.A = { master: makeActor('master'), lin: makeActor('lin', { speed: 3.6 }), mohan: makeActor('mohan'), heavy: makeActor('heavy'), dart: makeActor('dart'), ghost: makeActor('ghost', { float: true }), dummy: makeActor('dummy'), d1: makeActor('d1'), d2: makeActor('d2'), d3: makeActor('d3'), pharm: makeActor('pharm'), liu: makeActor('liu'), stone: makeActor('stone'), cook: makeActor('cook'), guard1: makeActor('guard'), guard2: makeActor('guard') };
  A.master.pose = 'whisk';
  // orbiting darts for 暗器弟子
  const orb = new THREE.Group(); scene.add(orb); orb.visible = false; A.dart.orbit = orb; const dm = new THREE.MeshStandardMaterial({ color: 0xd8e0e8, metalness: .9, roughness: .25, emissive: 0x2a6a50, emissiveIntensity: .6 });
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.rotation.y = i / 4 * Math.PI * 2; orb.add(g); mk(G.cone, dm, g, .62, 0, 0, .03, .2, .03).rotation.x = Math.PI / 2; }
  // 林清风's flying sword (when following a riding player)
  A.lin.rideSw = cheapSword(new THREE.MeshStandardMaterial({ color: 0xe6eef6, metalness: 1, roughness: .2, emissive: 0x4fd8c8, emissiveIntensity: .7 }), purpleGoldM, 2.4); A.lin.rideSw.rotation.set(Math.PI / 2, 0, 0); A.lin.rideSw.visible = false; scene.add(A.lin.rideSw);
  // 墨寒 dark mist disc
  const mist = mk(discGeo, new THREE.MeshBasicMaterial({ color: 0x2a0a40, transparent: true, opacity: .4, depthWrite: false }), A.mohan.holder, 0, .03, 0, .9, .9, 1); mist.rotation.x = -Math.PI / 2;
  for (const k in A) { const a = A[k], el = document.createElement('div'); el.className = 'npcname' + (k === 'lin' ? ' ally' : ''); el.innerHTML = `${a.name}${a.title ? `<small>${a.title}</small>` : ''}`; el.style.display = 'none'; labelsEl.appendChild(el); a.label = el; }
  for (const k of ['master', 'mohan', 'heavy', 'dart', 'dummy', 'd1', 'd2', 'd3', 'pharm', 'cook', 'guard1', 'guard2', 'stone']) { A[k].solid = true; A[k].r = A[k].radius; npcSolids.push(A[k]); }
  return A;
}
function showActor(a, wname, x, z, yaw, pose) { a.shown = true; a.world = wname; a.fighting = false; a.dead = false; a.act = null; a.path = null; a.airY = 0; a.spin = 0; a.holder.visible = true; placeActor(a, x, z, yaw ?? a.yaw); if (pose) a.pose = pose; a.solid = a.id !== 'lin' && a.id !== 'ghost' && !!npcSolids.includes(a); }
function hideActor(a) { a.shown = false; a.holder.visible = false; a.solid = false; if (a.label) a.label.style.display = 'none'; if (a.orbit) a.orbit.visible = false; }
function faceYaw(x, z, tx, tz) { return Math.atan2(tx - x, tz - z); }
/* ---------- coroutine runner ---------- */
function runCo(gen) { ch1.co = gen; ch1.wait = null; stepCo(); }
function waitDone(w) { if (w.say) return w.done; if (w.t !== undefined) return w.t <= 0; if (w.until) return !!w.until(); return true; }
function stepCo() {
  for (let g = 0; g < 60 && ch1.co; g++) {
    if (ch1.wait && !waitDone(ch1.wait)) return;
    const r = ch1.co.next();
    if (r.done) { ch1.co = null; ch1.wait = null; endTalk(); return; }
    const w = ch1.wait = r.value || { t: 0 };
    if (w.say) openDlg(w); else endTalk();
  }
}
const say = (who, text) => ({ say: true, who, text });
const wait = t => ({ t });
const until = fn => ({ until: fn });
/* ---------- dialogue ---------- */
const dlg = { w: null, shown: 0, full: '', typing: false };
function speakerActor(who) { const A = ch1.A; if (!A) return null; return { '青玄真人': A.master, '林清风': A.lin, '墨寒': A.mohan, '重剑弟子': A.heavy, '暗器弟子': A.dart, '魔修虚影': A.ghost, '弟子甲': A.d1, '弟子乙': A.d2, '弟子丙': A.d3, '药师': A.pharm, '白芷': A.pharm, '刘醉': A.liu, '小石头': A.stone, '伙夫': A.cook, '守门弟子': A.guard1 }[who] || null; }
function openDlg(w) {
  ch1.talking = true; if (state === 'play') state = 'talk'; document.body.classList.add('talking'); resetInputs('talk');
  const who = w.who === '你' ? player.name : w.who, nm = $('dlgname');
  nm.style.display = who ? 'block' : 'none'; nm.textContent = who || ''; nm.className = w.who === '你' ? 'you' : (w.who === '墨寒' || w.who === '魔修虚影') ? 'foe' : '';
  const tx = $('dlgtxt'); tx.className = who ? '' : 'narr'; tx.style.fontSize = w.text.length > 90 ? 'calc(15px*var(--u))' : '';
  dlg.w = w; dlg.full = w.text.replace(/\{name\}/g, player.name); dlg.shown = 0; dlg.typing = true; tx.textContent = ''; $('dlgnext').style.visibility = 'hidden';
  $('dlg').style.display = 'block';
  const a = speakerActor(w.who); if (a) { ch1.camT = a; ch1.lastSpeaker = a; } else if (!who) ch1.camT = null;
  if (a && a.shown && !a.fighting && a.id !== 'ghost') a.faceP = 1;
}
function dlgTap() {
  if (!dlg.w) return;
  if (dlg.typing) { dlg.shown = dlg.full.length; $('dlgtxt').textContent = dlg.full; dlg.typing = false; $('dlgnext').style.visibility = 'visible'; return; }
  const w = dlg.w; dlg.w = null; w.done = true; sfx('swish'); stepCo();
}
function updateDlg(dt) { if (!dlg.w || !dlg.typing) return; dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 32); $('dlgtxt').textContent = dlg.full.slice(0, Math.floor(dlg.shown)); if (dlg.shown >= dlg.full.length) { dlg.typing = false; $('dlgnext').style.visibility = 'visible'; } }
function endTalk() { if (!ch1.talking) return; ch1.talking = false; $('dlg').style.display = 'none'; document.body.classList.remove('talking'); if (state === 'talk') state = 'play'; ch1.camT = null; }
onTap($('dlg'), () => dlgTap());
function bark(who, txt) { sub(who, txt); }
/* ---------- objective + beacon + arrows ---------- */
const beacon = new THREE.Group(); beacon.visible = false; scene.add(beacon);
{ const bm = new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  mk(new THREE.CylinderGeometry(.35, .5, 14, 12, 1, true), bm, beacon, 0, 7, 0);
  const cone = mk(G.cone, new THREE.MeshBasicMaterial({ color: 0xffe08a, fog: false }), beacon, 0, 3.2, 0, .32, .6, .32); cone.rotation.x = Math.PI; beacon.userData.cone = cone;
  const ring = mk(ringGeo, addMat(0xffd36a, .7), beacon, 0, .08, 0, 1.1, 1.1, 1.1); ring.rotation.x = -Math.PI / 2; beacon.userData.ring = ring; }
function setObj(text, target, wname) { ch1.obj = text ? { text, target, world: wname || (world && world.name) } : null; $('obj').classList.toggle('on', !!text); if (text) { $('objtxt').textContent = text; sfx('ding'); } }
function objPos() { const o = ch1.obj; if (!o || !o.target) return null; const t = typeof o.target === 'function' ? o.target() : o.target; if (!t) return null; return { x: t.x, z: t.z, h: t.height ? t.height + .6 : 0 }; }
function updateObj(dt) {
  const p = objPos(), ea = $('edgearr');
  if (!p || ch1.obj.world !== world.name || state !== 'play') { beacon.visible = false; ea.style.display = 'none'; $('objarr').style.visibility = p ? 'visible' : 'hidden'; $('objdist').textContent = ''; return; }
  beacon.visible = true; beacon.position.set(p.x, world.actorH ? world.H(p.x, p.z) : 0, p.z); beacon.userData.cone.position.y = (p.h || 2.6) + .8 + Math.sin(gameT * 3) * .2; beacon.userData.ring.scale.setScalar(1 + Math.sin(gameT * 4) * .08);
  const dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz); beacon.visible = d > 1.6;
  const rel = angDiff(player.yaw, Math.atan2(-dx, -dz)); $('objarr').style.visibility = 'visible'; $('objarr').style.transform = `rotate(${(-90 - rel * 180 / Math.PI).toFixed(1)}deg)`;
  $('objdist').textContent = ` · ${Math.round(d)}米`;
  if (Math.abs(rel) > .75 && d > 3) { ea.style.display = 'block'; const left = rel > 0; ea.style.transform = `translate(${left ? 34 : innerWidth - 34}px,${innerHeight * .42}px) rotate(${left ? 180 : 0}deg)`; } else ea.style.display = 'none';
}
/* ---------- interaction button ---------- */
function addUse(u) { ch1.uses.push(u); return u; }
let curUse = null;
function updateUse() {
  let best = null, bd = 1e9;
  if (state === 'play' && !player.dead && !ch1.fight) for (const u of ch1.uses) { if (u.world !== world.name || (u.cond && !u.cond())) continue; const d = Math.hypot(player.x - u.x, player.z - u.z); if (d < u.r && d < bd) { bd = d; best = u; } }
  curUse = best; const b = $('btn-use'); b.classList.toggle('on', !!best); if (best && b.textContent !== best.label) b.textContent = best.label;
  if (best) { const u = uScale; b.style.right = (40 * u + 210 * u) + 'px'; b.style.bottom = (150 * u) + 'px'; }
}
onTap($('btn-use'), () => { if (curUse && state === 'play') { const u = curUse; sfx('ding'); u.fn(); } });
$('btn-use').addEventListener('pointerdown', e => e.stopPropagation());
/* ---------- name labels ---------- */
function updateLabels() {
  const A = ch1.A; if (!A) return;
  for (const k in A) {
    const a = A[k], el = a.label; if (!el) continue;
    const vis = a.shown && a.world === world.name && a.holder.visible && !(a.dead && a.id === 'ghost') && !ch1.talking;
    const d = Math.hypot(a.x - player.x, a.z - player.z);
    if (!vis || d > 32) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    const s = project(V3(a.x, actorY(a) + a.height + .42 + (a.airY || 0) + (a.float ? .4 : 0), a.z));
    if (!s) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.classList.toggle('foe', a.fighting); el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`; el.style.opacity = d > 24 ? (32 - d) / 8 : 1;
  }
}
/* ---------- follower (林清风) ---------- */
function resetTrail() { ch1.trail.length = 0; }
function followerTeleport(a) {
  const tr = ch1.trail; let p = null;
  for (let k = tr.length - 4; k >= 0; k--) { const q = tr[k]; if (Math.hypot(q[0] - player.x, q[1] - player.z) > 1.8) { p = q; tr.splice(0, k + 1); break; } }
  if (!p) { const f = fwd(); for (const [ax, az] of [[-f.x, -f.z], [f.z, -f.x], [-f.z, f.x], [f.x, f.z]]) { const x = player.x + ax * 2, z = player.z + az * 2, r = world.resolve(x, z, .4); if (Math.hypot(r[0] - x, r[1] - z) < .05) { p = [x, z]; break; } } }
  if (!p) p = [player.x, player.z];
  const r = world.resolve(p[0], p[1], .4); smoke(V3(a.x, 1, a.z), 0x6fe0d0); a.x = r[0]; a.z = r[1]; a.stuckT = 0; smoke(V3(a.x, 1, a.z), 0x6fe0d0); ch1.teleports = (ch1.teleports || 0) + 1;
}
function updateFollower(a, dt) {
  const tr = ch1.trail, last = tr[tr.length - 1];
  if (!last || Math.hypot(last[0] - player.x, last[1] - player.z) > .6) { tr.push([player.x, player.z]); if (tr.length > 90) tr.shift(); }
  const dp = Math.hypot(player.x - a.x, player.z - a.z), riding = player.riding;
  a.float = riding; a.rideSw.visible = riding && a.shown; if (riding) a.rideSw.position.set(a.x, .3 + actorY(a), a.z), a.rideSw.rotation.set(Math.PI / 2, 0, -a.yaw, 'YXZ');
  if (state !== 'play') { a.moveAmt += (0 - a.moveAmt) * Math.min(1, dt * 6); faceActor(a, player.x, player.z, dt * 3); return; }
  if (dp > (riding ? 30 : 20) || (a.stuckT || 0) > 2.2 || tr.length > 70) { followerTeleport(a); return; }
  if (dp < 2.4) { tr.length = 0; a.moveAmt += (0 - a.moveAmt) * Math.min(1, dt * 6); faceActor(a, player.x, player.z, dt * 3); a.stuckT = 0; return; }
  while (tr.length && Math.hypot(tr[0][0] - a.x, tr[0][1] - a.z) < .7) tr.shift();
  const t = tr.length ? tr[0] : [player.x, player.z];
  const sp = clamp(dp * 1.3, 3.2, riding ? 16 : 7.2), dx = t[0] - a.x, dz = t[1] - a.z, d = Math.hypot(dx, dz) || 1;
  const ox = a.x, oz = a.z; a.x += dx / d * Math.min(d, sp * dt); a.z += dz / d * Math.min(d, sp * dt);
  const r = world.resolve(a.x, a.z, .4); a.x = r[0]; a.z = r[1];
  const moved = Math.hypot(a.x - ox, a.z - oz); if (moved < sp * dt * .25) a.stuckT = (a.stuckT || 0) + dt; else a.stuckT = Math.max(0, (a.stuckT || 0) - dt);
  faceActor(a, t[0], t[1], dt * 8); a.moveAmt += (Math.min(1, sp / 4) - a.moveAmt) * Math.min(1, dt * 6);
}
/* ally behaviour in the phantom fight */
function updateAlly(a, dt) {
  const e = ch1.fight && ch1.fight.e; if (!e) return;
  a.atkCd = (a.atkCd || 1) - dt;
  if (a.retreat > 0) {
    a.retreat -= dt; a.hpF = Math.min(1, a.hpF + dt * .1);
    const tx = e.x > 0 ? -7.5 : 7.5, tz = 11; const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d > .5) { a.x += dx / d * 5 * dt; a.z += dz / d * 5 * dt; faceActor(a, tx, tz, dt * 8); a.moveAmt = 1; a.pose = 'idle'; } else { a.moveAmt = 0; faceActor(a, e.x, e.z, dt * 4); a.pose = 'cast'; if (Math.random() < .3) emit(a.x + rand(-.4, .4), rand(.2, 1.8), a.z + rand(-.4, .4), 0, 1, 0, 0x8ff0e0, .3, .7, 0); }
    if (a.retreat <= 0) { a.hpF = Math.max(a.hpF, .85); bark('林清风', '我回来了！'); }
  } else if (!e.dead) {
    const dx = e.x - a.x, dz = e.z - a.z, d = Math.hypot(dx, dz); faceActor(a, e.x, e.z, dt * 8);
    // stay on the far side of the boss from the player when possible
    if (d > 2.4) { a.x += dx / d * 4.6 * dt; a.z += dz / d * 4.6 * dt; a.moveAmt = 1; if (a.pose !== 'slashR' && a.pose !== 'windR') a.pose = 'ready'; }
    else { a.moveAmt = 0; if (a.atkCd <= 0 && !e.invuln && e.holder.visible) { a.atkCd = rand(1.1, 1.5); a.pose = 'windR'; a.poseK = 14; a.swingT = .22; } }
    if (a.swingT > 0) { a.swingT -= dt; if (a.swingT <= 0) { a.pose = 'slashR'; a.poseK = 24; sfx('swish'); foeSlashFx(a, 0x6ff0e0, .3, .8); allyHit(e, 22 + player.lv * 2, 7); setTimeout(() => { if (a.pose === 'slashR') a.pose = 'ready'; }, 260); } }
  } else { a.moveAmt = 0; a.pose = 'idle'; }
  const r = world.resolve(a.x, a.z, .4); a.x = r[0]; a.z = r[1];
}
/* ---------- fights ---------- */
function startFight(a, def, opt = {}) {
  Object.assign(a, { fighting: true, def, ai: false, dead: false, hp: def.hp, maxHp: def.hp, lvTxt: String(def.lv), act: null, cd: 1.3, stagger: 0, warnT: 0, invuln: false, airY: 0, spin: 0, passThrough: false, solid: false, fade: 1, slowT: 0, kbT: 0 });
  a.holder.visible = true; a.onDeath = () => { if (ch1.fight && ch1.fight.e === a) { ch1.fight.won = true; ch1.fight.wonT = gameT; sfx('win'); timeScale = .4; ch1Timer(.9, () => { timeScale = 1; }); } };
  initTough(a, def.tough); if (def.reset) def.reset(a); if (a.id === 'ghost') ghostCharMat.uniforms.op.value = 1;
  enemies.length = 0; enemies.push(a); clearProj(); player.amuletUsed = false;
  ch1.fight = { e: a, def, ring: !!opt.ring, withAlly: !!opt.ally, won: false, ex: a.x, ez: a.z, eyaw: a.yaw, px: opt.px, pz: opt.pz, deaths: 0, lose: opt.lose || '胜败乃兵家常事，再来！', t0: gameT, spar: !!opt.spar };
  document.body.classList.add('fight'); hudBossName = ''; hudDirty = true;
  if (opt.ally) { const al = ch1.A.lin; ch1.ally = al; al.hpF = 1; al.retreat = 0; al.atkCd = 2; }
}
function* fightIntro(title, subt) { banner(title, subt, 1.6); yield wait(1.7); banner('开始！', '', .9); sfx('clang'); ch1.fight.e.ai = true; ch1.fight.e.cd = .9; }
function endFight() { const F = ch1.fight; if (!F) return; F.e.fighting = false; F.e.act = null; F.e.warnT = 0; F.e.invuln = false; F.e.airY = 0; F.e.spin = 0; F.e.holder.rotation.x = 0; if (F.e.id !== 'ghost') F.e.holder.visible = true; enemies.length = 0; clearProj(); ch1.fight = null; ch1.ally = null; document.body.classList.remove('fight'); player.hp = player.maxHp; player.wine = player.wineMax; resetSkills(); hudDirty = true; if (F.e.orbit) F.e.orbit.visible = false; }
function ch1OnDeath() {
  const F = ch1.fight; if (!F) { ch1Timer(1, () => { player.dead = false; player.hp = player.maxHp; player.amuletUsed = false; hudDirty = true; if (ch1.cp === 'bridge' && world.name === 'digong') { placePlayer({ x: 0, z: DG.chasm.z1 + 1.6, yaw: 0 }); banner('重整旗鼓', '虚影仍在桥上', 1.4); } }); return; }
  if (F.spar) { F.lost = true; ch1Timer(.8, () => { player.dead = false; player.hp = Math.max(player.hp, Math.round(player.maxHp * .1)); hudDirty = true; }); return; }
  F.deaths++; F.e.ai = false; F.e.act = null; F.e.warnT = 0; clearProj();
  ch1Timer(1.3, () => { banner('败北', F.lose, 2.2); $('fade').style.transition = 'opacity .5s'; $('fade').style.opacity = .85; });
  ch1Timer(2.6, () => restartFight());
}
function restartFight() {
  const F = ch1.fight; if (!F) return; const e = F.e;
  clearFx(); clearProj(); resetSkills();
  Object.assign(e, { dead: false, hp: e.maxHp, act: null, cd: 1.5, stagger: 0, warnT: 0, invuln: false, airY: 0, spin: 0, x: F.ex, z: F.ez, yaw: F.eyaw, slowT: 0, kbT: 0, fade: 1 }); e.holder.visible = true; initTough(e, F.def.tough); if (F.def.reset) F.def.reset(e); if (e.id === 'ghost') ghostCharMat.uniforms.op.value = 1;
  if (F.px !== undefined) { player.x = F.px; player.z = F.pz; player.yaw = faceYaw(e.x, e.z, player.x, player.z) + Math.PI; }
  player.dead = false; player.hp = player.maxHp; player.wine = player.wineMax; player.lastHurt = -99; player.amuletUsed = false; hudDirty = true; $('vign').style.opacity = 0;
  if (ch1.ally) { ch1.ally.hpF = 1; ch1.ally.retreat = 0; placeActor(ch1.ally, e.x + 2.5, e.z + 4, ch1.ally.yaw); }
  $('fade').style.opacity = 0; state = 'play';
  banner('再战', '', 1.2); ch1Timer(1.3, () => { if (ch1.fight === F && !F.won) { e.ai = true; e.cd = .8; banner('开始！', '', .8); sfx('clang'); } });
}
function ch1Timer(t, fn) { ch1.timers.push({ t, fn }); }
function levelUp(n) {
  const lv0 = player.lv; player.lv += n; player.xp = 0; recalc(); player.hp = player.maxHp; hudDirty = true;
  const el = $('lvup'); el.querySelector('b').textContent = `Lv${lv0} → Lv${player.lv}`; el.querySelector('span').textContent = `等级提升！气血上限 ${player.maxHp} · 攻击 ${player.atk}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sfx('level'); shockRing(V3(player.x, 0, player.z), 0xffd36a, .4, 4, .9); shockRing(V3(player.x, 0, player.z), 0xffffff, .2, 2.5, .6);
  for (let i = 0; i < 50; i++) { const a = rand(0, 6.28), r = rand(.4, 1.4); emit(player.x + Math.cos(a) * r, rand(0, .4), player.z + Math.sin(a) * r, 0, rand(2, 4.5), 0, i % 3 ? 0xffd36a : 0xfff6d0, rand(.3, .55), rand(.8, 1.5), 0); }
  flashScreen('#fff2c0', .35, .6);
}
function showLearn(t, s) { const el = $('learn'); el.querySelector('b').textContent = t; el.querySelector('span').textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); sfx('level'); flashScreen('#d8f4ff', .45, .8); shockRing(V3(player.x, 0, player.z), 0x9fe8ff, .3, 5, 1); for (let i = 0; i < 60; i++) { const a = rand(0, 6.28), r = rand(1.5, 3); emit(player.x + Math.cos(a) * r, rand(.2, 2.4), player.z + Math.sin(a) * r, -Math.cos(a) * 2.5, rand(-.3, .6), -Math.sin(a) * 2.5, i % 2 ? 0x9fe8ff : 0xffffff, .4, .9, 0); } }
function ch1Hint(html, hl) { const g = $('guide'); g.classList.remove('done'); g.style.display = 'block'; $('gstep').textContent = '提示'; $('gtext').innerHTML = html; $('gnext').style.display = 'none'; ch1.hl = hl || null; }
function ch1HintOff() { $('guide').style.display = 'none'; $('hl').style.display = 'none'; ch1.hl = null; }
function* fadeSwap(fn, title, sub2, hold = 1.6) {
  const prev = state; state = 'cut'; resetInputs('fade'); const f = $('fade'); f.style.transition = 'opacity .7s'; f.style.opacity = 1; yield wait(.8);
  if (title) { const b = $('bigtxt'); b.querySelector('b').textContent = title; b.querySelector('span').textContent = sub2 || ''; b.style.display = 'flex'; void b.offsetWidth; b.style.opacity = 1; yield wait(hold); b.style.opacity = 0; yield wait(.8); b.style.display = 'none'; }
  fn && fn(); yield wait(.15); f.style.transition = 'opacity .9s'; f.style.opacity = 0; state = 'play'; yield wait(.4);
}
function goWorld(name, sp) { setWorld(name); clearFx(); clearProj(); placePlayer(sp); resetTrail(); const L = ch1.A.lin; if (L.shown && ch1.follow) { L.world = name; const f = fwd(); const r = world.resolve(player.x - f.x * 2 + .6, player.z - f.z * 2, .4); placeActor(L, r[0], r[1], player.yaw + Math.PI); } }
const inLib = () => world.name === 'academy' && player.x > ACAD.lib.x0 && player.x < ACAD.lib.x1 && player.z > ACAD.lib.z0 && player.z < ACAD.lib.z1;
/* ---------- checkpoint setup (resume / start) ---------- */
function setupCP(cp) {
  const A = ensureActors(); for (const k in A) hideActor(A[k]); ch1.uses.length = 0; ch1.flags = {}; ch1.follow = false; resetTrail(); setObj(null); ch1HintOff(); ch1.fight = null; ch1.ally = null; document.body.classList.remove('fight');
  if (player.lv < CP_LV[cp]) { player.lv = CP_LV[cp]; recalc(); }
  if (cpIdx(cp) > cpIdx('library') && !hasSt('yinshen')) player.unlocked.push('yinshen');
  if (cpIdx(cp) >= cpIdx('rings')) player.rideOK = true;
  if (cpIdx(cp) >= cpIdx('phantom') && cpIdx(cp) < cpIdx('placed')) giveItem('tome', true); else takeItem('tome', true);
  if (cpIdx(cp) > cpIdx('placed')) player.jdTp = true;
  ch1.jdVisit = false; ch1.questOK = false; quest.cur = null; ch1.questReq = null; ch1.chatOff = false; ch1.sayQ = []; player.amuletUsed = false; ensureState(cp);
  const dig = ['digong', 'chasm', 'bridge', 'chamber', 'phantom'].includes(cp), jd = ['tunnel', 'door', 'hall', 'placed'].includes(cp);
  hideAppr(); enemies.length = 0; ch1.pfall = null; ch1.anim = null; camDrop = 0; $('fade').style.opacity = 0;
  setWorld(dig ? 'digong' : jd ? 'jingdian' : 'academy');
  if (dig) worlds.digong.setState({ d1: cpIdx(cp) >= cpIdx('chasm'), br: cpIdx(cp) >= cpIdx('bridge'), d2: cpIdx(cp) >= cpIdx('chamber'), bar: cpIdx(cp) >= cpIdx('chamber'), tome: cpIdx(cp) <= cpIdx('chamber') });
  if (jd) worlds.jingdian.setState({ open: cpIdx(cp) >= cpIdx('hall'), placed: cp === 'placed' });
  setNight(cp === 'night'); lingReset(); placeAmbient(cp); worlds.academy.flyRings.forEach(r => r.visible = false);
  addUses();
  const lib = ACAD.lib, R = ACAD.ring;
  const arenaSet = (n) => { showActor(A.master, 'academy', R.x, -23.4, 0, 'whisk'); showActor(A.lin, 'academy', 14.6, -8, Math.PI / 2); A.lin.pose = 'idle'; showActor(A.mohan, 'academy', 14.6, -16, Math.PI / 2); if (n <= 1) showActor(A.heavy, 'academy', 38, -15.5, -Math.PI / 2); if (n <= 2) showActor(A.dart, 'academy', 38, -8.5, -Math.PI / 2); };
  switch (cp) {
    case 'lingen': placePlayer({ x: 0, z: 30, yaw: 0 }); showActor(A.master, 'academy', -2.6, 33, Math.PI * .8, 'whisk'); break;
    case 'day1': placePlayer({ x: ACAD.dummy.x, z: ACAD.dummy.z + 8, yaw: 0 }); showActor(A.master, 'academy', ACAD.dummy.x - 4.5, ACAD.dummy.z + 4, -.6, 'whisk'); break;
    case 'day2': placePlayer({ x: R.x - 5, z: R.z, yaw: -Math.PI / 2 }); showActor(A.master, 'academy', R.x, -23.4, 0, 'whisk'); showActor(A.lin, 'academy', R.x + 4.5, R.z, Math.PI / 2); A.lin.pose = 'idle'; break;
    case 'day3': placePlayer({ x: 4, z: -1, yaw: Math.PI * .8 }); showActor(A.master, 'academy', 2.6, -6.4, .4, 'whisk'); break;
    case 'night': placePlayer({ x: -56, z: -45.4, yaw: -Math.PI / 2 }); break;
    case 'heart': placePlayer({ x: -11.2, z: 24.4, yaw: 1.2 }); showActor(A.lin, 'academy', -13.2, 25.4, -2); A.lin.pose = 'idle'; break;
    case 'rings': placePlayer({ x: 0, z: -37, yaw: 0 }); showActor(A.master, 'academy', 3.8, -38.6, -Math.PI * .75, 'whisk'); showActor(A.lin, 'academy', -1.8, -35.8, Math.PI); ch1.follow = true; player.rideOK = true; break;
    case 'intro': placePlayer(world.spawn); showActor(A.master, 'academy', 0, 31.5, Math.PI, 'whisk'); break;
    case 'shield': placePlayer({ x: -30, z: -25.5, yaw: 0 }); showActor(A.master, 'academy', CLASS.master.x, CLASS.master.z, 0, 'whisk'); break;
    case 'school': placePlayer({ x: 0, z: 30, yaw: 0 }); showActor(A.master, 'academy', -2.6, 33, Math.PI * .8, 'whisk'); showActor(A.lin, 'academy', -27, -13, -1); showActor(A.mohan, 'academy', -33.5, -16.5, .6); break;
    case 'arena': placePlayer({ x: -24, z: -11, yaw: Math.PI / 2 }); showActor(A.lin, 'academy', -27.5, -11.5, 1.2); break;
    case 'duel1': case 'duel2': case 'duel3': placePlayer({ x: 14.5, z: -12, yaw: -Math.PI / 2 }); arenaSet(+cp[4]); ch1.follow = false; break;
    case 'ceremony': placePlayer({ x: R.x, z: -15, yaw: 0 }); showActor(A.master, 'academy', R.x, -21, Math.PI, 'whisk'); showActor(A.lin, 'academy', R.x - 2.4, -15.2, Math.PI); showActor(A.mohan, 'academy', R.x + 3, -15.8, Math.PI); break;
    case 'library': case 'gate': case 'done': placePlayer({ x: 0, z: cp === 'library' ? -35 : -37, yaw: cp === 'library' ? 0 : Math.PI }); showActor(A.master, 'academy', 3.8, -38.6, cp === 'library' ? -Math.PI * .75 : Math.PI * .25, 'whisk'); showActor(A.lin, 'academy', -1.8, -33.8, Math.PI); ch1.follow = true; if (cp === 'done') placePlayer({ x: 0, z: 34, yaw: Math.PI }), placeActor(A.lin, 1.8, 32.5, Math.PI); break;
    case 'hidden': placePlayer({ x: -8.4, z: -44.4, yaw: 0 }); showActor(A.master, 'academy', 3.8, -38.6, -Math.PI * .75, 'whisk'); showActor(A.lin, 'academy', -6.2, -44.2, -1); ch1.follow = true; break;
    case 'digong': placePlayer(DG.spawn); showActor(A.lin, 'digong', 1.9, DG.spawn.z + .8, 0); ch1.follow = true; break;
    case 'chasm': case 'bridge': placePlayer({ x: 0, z: DG.chasm.z1 + 1.6, yaw: 0 }); showActor(A.lin, 'digong', 1.7, DG.chasm.z1 + 2.8, 0); ch1.follow = true; break;
    case 'chamber': placePlayer({ x: 0, z: DG.door2Z + 2.6, yaw: 0 }); showActor(A.lin, 'digong', 1.7, DG.door2Z + 3.4, 0); ch1.follow = true; break;
    case 'tunnel': placePlayer(JD.spawn); showActor(A.lin, 'jingdian', 1.5, JD.spawn.z - 1.2, Math.PI); ch1.follow = true; break;
    case 'door': placePlayer({ x: 0, z: 53, yaw: 0 }); showActor(A.lin, 'jingdian', 1.9, 54.4, 0); ch1.follow = true; break;
    case 'hall': placePlayer({ x: 0, z: 20, yaw: 0 }); showActor(A.lin, 'jingdian', 2.2, 21.2, 0); ch1.follow = true; break;
    case 'placed': placePlayer({ x: 0, z: -11.5, yaw: 0 }); showActor(A.lin, 'jingdian', 2.6, -11.2, -.4); ch1.follow = true; break;
    case 'phantom': placePlayer({ x: 0, z: -6, yaw: 0 }); showActor(A.lin, 'digong', 2.2, -5, -Math.PI * .8); ch1.follow = true; break;
    case 'return': placePlayer({ x: 0, z: -56.6, yaw: Math.PI }); showActor(A.master, 'academy', 3.8, -38.6, -Math.PI * .75, 'whisk'); showActor(A.lin, 'academy', 1.6, -56.2, Math.PI); ch1.follow = true; break;
  }
  hudDirty = true;
}
function addUses() {
  addUse({ world: 'academy', x: ACAD.book.x, z: ACAD.book.z, r: 2.4, label: '查看', cond: () => ch1.cp === 'library' && !ch1.flags.book, fn: () => { ch1.flags.book = true; } });
  addUse({ world: 'academy', x: ACAD.hidden.x, z: ACAD.hidden.z + .9, r: 2.8, label: '进入', cond: () => ch1.cp === 'hidden' && player.stealthT > 0, fn: () => { ch1.flags.door = true; } });
  addUse({ world: 'digong', x: DG.book.x, z: DG.book.z, r: 2.6, label: '查看', cond: () => ch1.cp === 'chamber' && !ch1.flags.tome, fn: () => { ch1.flags.tome = true; } });
  addUse({ world: 'academy', x: ACAD.ling.x, z: ACAD.ling.z, r: 2.5, label: '触碰', cond: () => ch1.cp === 'lingen' && ch1.flags.atStone && !ch1.flags.ling, fn: () => { ch1.flags.ling = true; } });
  addUse({ world: 'academy', x: -56, z: -52.5, r: 2.8, label: '歇息', cond: () => ch1.cp === 'day3' && !ch1.flags.rest && !quest.cur, fn: () => { ch1.flags.rest = true; } });
  addUse({ world: 'academy', x: -56, z: -52.5, r: 2.8, label: '就寝', cond: () => ch1.cp === 'night' && ch1.flags.metMo && !ch1.flags.sleep, fn: () => { ch1.flags.sleep = true; } });
  ACAD.pages.forEach(([x, z], i) => addUse({ world: 'academy', x, z, r: 2.1, label: '收集', cond: () => pagesOpen() && !player.riding && !player.pages.includes(i), fn: () => collectPage(i) }));
  for (const [k, lines] of Object.entries(CHAT)) addUse({ world: 'academy', npc: k, get x() { return ch1.A[k].x; }, get z() { return ch1.A[k].z; }, r: 2.4, label: '交谈', cond: () => ch1.A[k].shown && ch1.A[k].world === 'academy' && !ch1.talking && !ch1.chatOff && (!CHAT_WHEN[k] || CHAT_WHEN[k]()), fn: () => { const a = ch1.A[k]; if (questChat(k)) return; a.ci = ((a.ci ?? -1) + 1) % lines.length; bark(a.name, lines[a.ci]); if (!a.lie) a.faceP = 1; setTimeout(() => { a.faceP = 0; }, 2500); } });
  addUse({ world: 'digong', x: DG.book.x, z: DG.book.z, r: 2.6, label: '收集', cond: () => ch1.cp === 'chamber' && ch1.flags.tome && ch1.flags.canTake && !ch1.flags.took, fn: () => { ch1.flags.took = true; } });
  addUse({ world: 'jingdian', x: JD.door.x, z: JD.door.z - .4, r: 4.6, label: '开启', cond: () => ch1.cp === 'door' && ch1.flags.doorReady && !ch1.flags.openDoor, fn: () => { ch1.flags.openDoor = true; } });
  addUse({ world: 'jingdian', x: JD.place.x, z: JD.place.z, r: 3.4, label: '放置', cond: () => ch1.cp === 'hall' && hasItem('tome') && !ch1.flags.placeBook, fn: () => { ch1.flags.placeBook = true; } });
  addUse({ world: 'jingdian', x: JD.crystal.x, z: JD.crystal.z, r: 3.6, label: '吸收', cond: () => ch1.cp === 'placed' && worlds.jingdian.crystal.visible && !ch1.flags.absorb, fn: () => { ch1.flags.absorb = true; } });
  addUse({ world: 'jingdian', x: JD.circle.x, z: JD.circle.z, r: 1.9, label: '传送', cond: () => ch1.cp === 'placed' && ch1.flags.absorbed && !ch1.flags.tp, fn: () => { ch1.flags.tp = true; } });
  addUse({ world: 'jingdian', x: JD.circle.x, z: JD.circle.z, r: 1.9, label: '传送', cond: () => ch1.jdVisit && worlds.jingdian.circle.visible, fn: () => jdReturn() });
  addUsesV45();
}
/* ---------- the script ---------- */
const SEG = {};
SEG.intro = function* () {
  const A = ch1.A; setCP('intro');
  yield wait(.9);
  yield say('青玄真人', '你醒了。');
  yield say('青玄真人', '三日前，为师追着一道紫光下山，却在山脚下发现了昏迷不醒的你。');
  yield say('青玄真人', '你整整睡了三天三夜，为师便将你带回了学院。');
  yield say('你', '多谢前辈救命之恩。此处是……？');
  yield say('青玄真人', '此乃天剑学院。院中弟子分为两派——仙修与魔修。仙修养心正气，魔修以力破法，各有其道。');
  yield say('青玄真人', '你既无处可去，便留下来，做为师的弟子吧。');
  A.master.pose = 'whisk'; placeActor(A.master, -2.6, 33, Math.PI * .8);
};
/* ---------- v4.3 第一章扩充: ambient NPCs, night look, 书页, 测灵石, 光环 ---------- */
const CHAT = {
  pharm: ['此乃凝气草，三年一熟，莫要乱碰。', '百年前仙魔一战，地脉尽染紫气，至今药性犹偏。'],
  cook: ['饭要趁热！练剑之人，腹中无食可不成。', '老夫掌勺四十年，天才见得多了，活得长的没几个。'],
  guard1: ['出入山门，须有令牌。', '山下近来不太平，夜里常见紫光。'],
  guard2: ['大比之日，山门外挤满了看热闹的。', '守门三年，从未见人自外闯入。'],
  d1: ['听说钟楼那口大钟，乃仙尊亲手所铸。'], d2: ['墨寒师兄的剑，快得看不清。'], d3: ['禁阁？我连门都没摸着过。'],
  liu: ['（鼾声如雷）……嗯？莫吵，酒还没醒。', '剑要快，酒要慢。你二者皆未得其味。', '天下事，一壶便够；不够，再来一壶。'],
  stone: ['师兄，湖里的锦鲤会咬人，莫伸手。', '我叫小石头，入门才半年。'],
  master: ['今日无课，你且四处走走。', '入夜之前，回居所歇息。'],
  mohan: ['看什么？', '离我远些。'],
};
const CHAT_WHEN = { master: () => ch1.cp === 'day3', mohan: () => ch1.cp === 'day3' };
const LIU = { x: 57.5, z: 33.5, yaw: -2.3 }, STONE = { x: -19.6, z: 35.6, yaw: -2.2 }, MOHAN_D3 = { x: 37.6, z: -19.5, yaw: -1.2 };
const AMB = { pharm: [55, -38.4], cook: [-56, -38.6], guard1: [-6.6, 39.4], guard2: [6.6, 39.4], d1: [-29, 12.4], d2: [-19, 25], d3: [44, 4] };
function placeAmbient(cp) {
  const A = ch1.A, i = cpIdx(cp), acad = world.name === 'academy'; A.mohan.walkAway = false;
  for (const k of ['pharm', 'cook', 'guard1', 'guard2', 'd1', 'd2', 'd3', 'dummy', 'liu', 'stone']) hideActor(A[k]);
  if (!acad || cp === 'intro') return;
  const night = cp === 'night';
  for (const k of ['pharm', 'cook', 'guard1', 'guard2']) { const [x, z] = AMB[k]; showActor(A[k], 'academy', x, z, k.startsWith('guard') ? Math.PI : 0, 'idle'); }
  if (!night) { showActor(A.liu, 'academy', LIU.x, LIU.z, LIU.yaw, 'idle'); A.liu.lie = true; }
  if (!night && cp !== 'lingen') { showActor(A.stone, 'academy', STONE.x, STONE.z, STONE.yaw, 'idle'); }
  if (cp === 'day3') showActor(A.mohan, 'academy', MOHAN_D3.x, MOHAN_D3.z, MOHAN_D3.yaw, 'idle');
  if (!night && cp !== 'lingen') for (const k of ['d1', 'd2', 'd3']) { const [x, z] = AMB[k]; showActor(A[k], 'academy', x, z, rand(-3, 3), 'idle'); }
  if (cp === 'lingen') { const L = ACAD.ling; [[-3.6, -11.2], [3.8, -10.6], [4.6, -4.4]].forEach(([dx, dz], j) => { const a = A['d' + (j + 1)]; showActor(a, 'academy', L.x + dx, L.z + dz + 2, faceYaw(L.x + dx, L.z + dz + 2, L.x, L.z), 'idle'); }); }
  if (cp === 'day1') { showActor(A.dummy, 'academy', ACAD.dummy.x, ACAD.dummy.z, 0, 'ready'); }
}
let NIGHT = null;
function setNight(on) {
  const W = worlds.academy; if (!NIGHT) NIGHT = { day: { sky: W.sky, fog: W.fog, hemi: W.hemi, sunL: W.sunL, sunDir: W.sunDir, sunCol: W.sunCol, ground: W.ground }, on: false };
  if (NIGHT.on === !!on) return; NIGHT.on = !!on;
  const N = on ? { sky: [0x050a1e, 0x101a3c, 0x1e2c50], fog: [0x141c34, 25, 150], hemi: [0x7080b8, 0x1a2030, 1.05], sunL: [0x9fb0ff, .55], sunDir: V3(-.4, .5, -.8).normalize(), sunCol: [.35, .4, .6], ground: 0x24302c } : NIGHT.day;
  Object.assign(W, N); W.lanternGlow.visible = W.moon.visible = !!on;
  if (world === W) setWorld('academy');
}
function lingReset() { const W = worlds.academy; W.lingM.emissive.set(0x6080a0); W.lingM.emissiveIntensity = .3; W.lingBeam.visible = false; }
const pagesOpen = () => cpIdx(ch1.cp) >= cpIdx('day3') && ch1.cp !== 'done' && !ch1.ended;
const PAGES = ['其一 · 魔神|吾生于北荒，父母皆亡于兽口。那年吾七岁，提一柄断剑，在尸山中守了三日三夜。', '其二 · 仙尊|初见魔神，他浑身是血，却仍挡在一群孩童身前。吾问其名，他说：“无名，只有剑。”', '其三 · 魔神|仙尊予吾一名，又予吾一杯酒。那是吾此生第一次，觉得这天地尚有温度。', '其四 · 仙尊|吾二人并肩百战，斩尽九州凶兽。立宗那日，他立于山巅，说：“从此再无人如我当年。”', '其五 · 魔神|众生愚弱，护之愈多，死之愈多。唯有一剑镇之，方得太平。仙尊不懂。', '其六 · 仙尊|太初降世，剑鸣三日不绝。吾见魔神眼中有光，那光，不似当年。', '其七 · 魔神|吾非为己。吾只是不愿再见尸山。可他说，以剑镇众生者，终为剑所噬。', '其八 · 仙尊|那一夜，他约吾于云海之上，未带酒，只带了剑。', '其九 · 魔神|吾败了？不，吾只是累了。仙尊，你封得住剑，封得住人心否？', '其十 · 仙尊|剑已封，人已散。若后世有人得见此页，切记：剑无善恶，执剑者有。'];
const pageEl = (() => { const d = document.createElement('div'); d.id = 'pagep'; d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(78vw,520px);padding:22px 26px 16px;background:linear-gradient(#f6ecd2,#e8d8b0);color:#3a2a18;border:2px solid #8a6a3a;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.5);font-family:serif;z-index:60;display:none;text-align:left';
  d.innerHTML = '<div style="font-size:12px;color:#8a6a3a;letter-spacing:2px">漂浮书页 · <span id="pagecnt"></span></div><b style="display:block;font-size:20px;margin:6px 0 10px"></b><p style="font-size:16px;line-height:1.75;margin:0"></p><div style="font-size:12px;color:#8a6a3a;text-align:right;margin-top:10px">▼ 轻触合上</div>';
  document.body.appendChild(d); d.addEventListener('pointerdown', e => { e.stopPropagation(); closePage(); }); return d; })();
function collectPage(i) {
  if (player.pages.includes(i)) return; player.pages.push(i); recalc(); player.hp = Math.min(player.maxHp, player.hp + 10); hudDirty = true; saveGame();
  const pg = worlds.academy.pages[i]; burst(pg.position.clone(), 24, 0xffe0a0, 4, .4, .6, 0); sfx('level');
  const [t, x] = PAGES[i].split('|'); pageEl.querySelector('b').textContent = t; pageEl.querySelector('p').textContent = x; pageEl.querySelector('#pagecnt').textContent = '气血上限 +10';
  pageEl.style.display = 'block'; ch1.reading = true; ch1.readPrev = state; if (state === 'play') state = 'cut'; resetInputs('page');
}
function closePage() { if (!ch1.reading) return; pageEl.style.display = 'none'; ch1.reading = false; if (state === 'cut') state = 'play'; sfx('swish'); }
function ch1Academy(dt) {
  const W = world, open = pagesOpen();
  W.pages.forEach((pg, i) => { const v = open && !player.pages.includes(i); pg.visible = v; if (v) { pg.rotation.y += dt * 1.2; pg.position.y = 1.4 + Math.sin(gameT * 1.8 + i) * .18; if (Math.random() < .15) emit(pg.position.x + rand(-.3, .3), pg.position.y, pg.position.z + rand(-.3, .3), 0, .6, 0, 0xffe0a0, .18, .9, 0); } });
  if (ch1.cp === 'rings' && ch1.flags.ringI !== undefined) {
    const N = ACAD.flyRings.length, i = ch1.flags.ringI;
    W.flyRings.forEach((rg, k) => { if (!rg.visible) return; rg.children[0].material.opacity = k === i ? .95 : .35; rg.scale.setScalar(k === i ? 1 + Math.sin(gameT * 5) * .05 : .85); });
    if (i < N) { const [x, z] = ACAD.flyRings[i]; if (player.riding && Math.hypot(player.x - x, player.z - z) < 2.3) { const rg = W.flyRings[i]; rg.visible = false; burst(rg.position.clone(), 40, 0xffd36a, 6, .5, .6, 0); shockRing(V3(x, .1, z), 0xffd36a, .3, 3, .5); sfx('ding'); ch1.flags.ringI = i + 1; $('objtxt').textContent = `御剑穿过光环 ${i + 1}/${N}`; } }
    if (!player.riding && SK.ride.t > 1.2) SK.ride.t = 1.2;
  }
  if (ch1.cp === 'shield' && SK.hudun.t > 2) SK.hudun.t = 2;
  ch1Decor(dt);
  if (ch1.cp === 'day1' && SK.s1.t > 1.2 && ch1.flags.trainS1 !== undefined && ch1.flags.trainS1 < 5) SK.s1.t = 1.2;
  if (ch1.cp === 'day1' && SK.s2.t > 1.2 && ch1.flags.trainS2 !== undefined) SK.s2.t = 1.2;
}
function* epilogue() { // 墨寒 in the dark, holding a purple 剑印 fragment
  const A = ch1.A, f = $('fade'); for (const k in A) hideActor(A[k]); setNight(false);
  setWorld('digong'); worlds.digong.setState({ d1: 1, d2: 1, br: 1 }); clearFx(); clearProj(); enemies.length = 0;
  showActor(A.mohan, 'digong', 0, -10.8, 0, 'cast'); A.mohan.headTilt = .15;
  placePlayer({ x: 0, z: -6.2, yaw: 0 }); player.pitch = .06;
  const shard = new THREE.Group(); shard.position.set(.05, 1.45, -10.25); scene.add(shard);
  mk(new THREE.OctahedronGeometry(.16, 0), new THREE.MeshBasicMaterial({ color: 0xe0b0ff }), shard, 0, 0, 0, 1, 1.8, 1); mk(G.sph, auraMat(0xb050ff, 1.6, 1.6), shard, 0, 0, 0, .55, .55, .55);
  let t = 0; ch1.anim = dt => { t += dt; shard.rotation.y += dt * 1.6; shard.position.y = 1.45 + Math.sin(t * 2) * .04; if (Math.random() < .5) emit(shard.position.x + rand(-.2, .2), shard.position.y, shard.position.z + rand(-.2, .2), 0, rand(.3, .8), 0, 0xc070ff, .22, .8, 0); return !shard.parent; };
  f.style.transition = 'opacity 1.4s'; f.style.opacity = 0; yield wait(1.8);
  state = 'play'; yield say('墨寒', '第一印……'); state = 'cut';
  yield wait(1.2); f.style.transition = 'opacity 1.2s'; f.style.opacity = 1; yield wait(1.3);
  scene.remove(shard); hideActor(A.mohan); A.mohan.headTilt = 0;
}
/* ---------- 测灵根 ---------- */
SEG.lingen = function* () {
  const A = ch1.A, W = worlds.academy, L = ACAD.ling; setCP('lingen');
  yield say('青玄真人', '且慢。入我门下，须先测灵根。随为师来。');
  A.master.path = [[-1.6, 22], [-3.2, 8], [-2.6, L.z + 3.2]]; A.master.speed = 3.2; A.master.leading = true;
  setObj('随师傅前往大广场', () => A.master, 'academy');
  yield until(() => (!A.master.path || !A.master.path.length) && Math.hypot(player.x - L.x, player.z - L.z) < 7);
  A.master.leading = false; faceActor(A.master, L.x, L.z, 1); ch1.flags.atStone = true;
  yield say('青玄真人', '此乃测灵石。以掌覆之，灵根自现。');
  setObj('以手触碰测灵石', { x: L.x, z: L.z, height: 2.2 }, 'academy');
  yield until(() => ch1.flags.ling);
  setObj(null); state = 'cut'; resetInputs('ling'); sfx('ding');
  { let k = 0; W.lingBeam.visible = true; ch1.anim = dt => { k += dt; const e = Math.min(1, k / 1.4); W.lingM.emissive.setRGB(.38 + .3 * e, .5 - .35 * e, .63 + .37 * e); W.lingM.emissiveIntensity = .3 + e * 2.2 + Math.sin(k * 14) * .2 * e; W.lingBeam.material.opacity = e * (.45 + Math.sin(k * 6) * .1);
      if (Math.random() < .8) emit(L.x + rand(-.6, .6), rand(1, 3), L.z + rand(-.6, .6), 0, rand(1, 3), 0, 0xc070ff, .35, .8, 0); if (k > .9 && !this_f) { this_f = 1; sfx('roar'); shake = Math.max(shake, .3); flashScreen('#c080ff', .35, .5); shockRing(V3(L.x, .1, L.z), 0xb060ff, .3, 6, .7); } return k > 2.2; }; var this_f = 0; }
  yield until(() => !ch1.anim);
  state = 'play';
  yield say('弟子甲', '紫光？从未见过……');
  yield say('弟子乙', '这是什么灵根？');
  yield say('弟子丙', '测灵石……莫不是坏了？');
  A.master.headTilt = .25; yield say('青玄真人', '……'); A.master.headTilt = 0;
  yield say('青玄真人', '灵根之相，因人而异，不必多问。');
  W.lingBeam.visible = false; W.lingM.emissiveIntensity = .9;
  A.master.pose = 'point'; yield say('青玄真人', '且慢。');
  yield say('青玄真人', '此符随为师多年，今日赠你。危难之际，可保你一命。');
  giveInv('amulet', 1, true); A.master.pose = 'whisk';
  showLearn('获得【青玄护身符】', '古玩 · 已佩戴 · 每战一次免死'); yield wait(1.6);
  yield say('你', '弟子拜谢师傅。');
  yield say('青玄真人', '同门都在学堂前的草坪上。去吧，见见他们。见过之后，入学堂来，为师授你神通。');
  for (const [k, p] of [['d1', [-29, 12.4]], ['d2', [-19, 25]], ['d3', [44, 4]]]) { A[k].path = [p]; A[k].speed = 2.4; }
};
SEG.school = function* () {
  const A = ch1.A; setCP('school');
  if (!A.lin.shown) { showActor(A.lin, 'academy', -27, -13, -1); showActor(A.mohan, 'academy', -33.5, -16.5, .6); }
  setObj('前往学堂', { x: -29, z: -12 }, 'academy');
  ch1Hint('左下摇杆移动 · 跟随<b>金色光柱</b>与左上角的<b>目标箭头</b>前进');
  ch1Timer(7, () => { if (ch1.cp === 'school') ch1HintOff(); });
  yield until(() => Math.hypot(player.x + 29, player.z + 13) < 9 || (player.x < -14 && player.z < -4 && player.z > -29));
  ch1HintOff(); setObj(null);
  A.lin.faceP = 1; A.mohan.faceP = 1;
  yield say('林清风', '你就是师傅带回来的那位新同门吧？我叫林清风，以后多多关照！');
  yield say('墨寒', '又来一个仙派的废物？');
  yield say('你', '我不会挡任何人的路，但也不会让路。');
  yield say('墨寒', '那就在比武场上见。');
  yield say('林清风', '别理他。他叫墨寒，魔派首席，向来目中无人。');
  yield say('林清风', '三日后便是学院大比。冠军可以进入图书馆的禁阁——听说那里藏着学院最古老的秘籍。');
  yield say('墨寒', '冠军，只会是我。');
  A.mohan.path = [[-30, -6], [-30, 0], [-6, 0]]; A.mohan.speed = 2.6;
  yield wait(1.6);
  yield say('林清风', '师傅已在学堂候着了。进去吧，迟了要挨戒尺。');
};
/* ---------- 学堂 · 护盾课 ---------- */
const CLASS = { door: { x: -30, z: -28.6 }, seat: { x: -27, z: -40, yaw: Math.atan2(3, 5.1) }, master: { x: -30, z: -45.1 } };
function inSchool() { const S = ACAD.school; return world.name === 'academy' && player.x > S.x0 && player.x < S.x1 && player.z > S.z0 && player.z < S.z1 - .2; }
function fireBolt(from, cb) {
  const g = new THREE.Group(); mk(G.sphLo, new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), g, 0, 0, 0, .14, .14, .14); mk(G.sph, auraMat(0xffd36a, 1.6, 1.6), g, 0, 0, 0, .42, .42, .42);
  const pos = V3(from.x, 1.45, from.z), tgt = V3(player.x, camY - .55, player.z), vel = tgt.sub(pos).normalize().multiplyScalar(9);
  spawnProj({ mesh: g, pos, vel, r: .7, dmg: 45, life: 3, col: 0xffd36a, onHitP: cb }); sfx('whoosh');
}
SEG.shield = function* () {
  const A = ch1.A, M = A.master; setCP('shield'); ch1.chatOff = true;
  if (!M.shown || M.world !== 'academy') showActor(M, 'academy', CLASS.master.x, CLASS.master.z, 0, 'whisk'); else placeActor(M, CLASS.master.x, CLASS.master.z, 0);
  setObj('入学堂听课', CLASS.door, 'academy');
  yield until(() => inSchool() || Math.hypot(player.x - CLASS.door.x, player.z - CLASS.door.z) < 1.6);
  setObj(null);
  yield* fadeSwap(() => { hideActor(A.mohan); showActor(A.lin, 'academy', -33.4, -38.6, Math.PI, 'idle'); ch1.follow = false; placeActor(M, CLASS.master.x, CLASS.master.z, 0); placePlayer(CLASS.seat); resetTrail(); }, '学堂', '神通初授');
  M.faceP = 1;
  yield say('青玄真人', '剑修之道，剑为形，神通为魂。');
  yield say('青玄真人', '神通者，以灵力化万象：或攻或守，或隐或遁，各随其性。');
  yield say('青玄真人', '今日先授你护盾。灵力凝于周身，外力难侵。');
  yield say('青玄真人', '盾之厚薄，约当你气血二成。盾破之前，刀剑难伤。');
  if (!hasSt('hudun')) player.unlocked.push('hudun'); SK.hudun.t = 0; hudDirty = true; saveGame();
  showLearn('领悟神通【护盾】', '左侧神通十字 · 下'); yield wait(1.4);
  M.pose = 'point'; yield say('青玄真人', '为师以光弹试你。凝盾，接下三弹。'); M.pose = 'whisk';
  ch1Hint('点击左侧神通十字下方的<b>【护盾】</b>，再以护盾接下光弹', 'st-hudun');
  const C = ch1.flags.cls = { n: 0 }; player.minHpFrac = .35;
  setObj('以护盾接下光弹 0/3', () => M, 'academy');
  while (C.n < 3) {
    yield wait(C.n === 0 && player.shield <= 0 ? 3.2 : 2.2);
    if (state !== 'play') { yield until(() => state === 'play'); continue; }
    M.pose = 'point'; faceActor(M, player.x, player.z, 1);
    fireBolt({ x: M.x + Math.sin(M.yaw) * .6, z: M.z + Math.cos(M.yaw) * .6 }, (r, sh0) => {
      if (sh0 > 0 && r !== 'block') { C.n++; $('objtxt').textContent = `以护盾接下光弹 ${C.n}/3`; sfx('ding'); if (C.n === 1) ch1HintOff(); }
      else if (r === 'block') toast('须以护盾接之，非格挡'); else toast('凝起护盾再接');
    });
    setTimeout(() => { if (M.pose === 'point') M.pose = 'whisk'; }, 500);
    yield wait(.9);
  }
  ch1HintOff(); setObj(null); player.minHpFrac = 0; clearProj(); yield wait(.8);
  M.pose = 'whisk'; player.hp = player.maxHp; hudDirty = true;
  yield say('青玄真人', '善。盾虽坚，终有尽时；慎用，方能久用。');
  yield say('青玄真人', '明日起，随为师习剑。');
  ch1.chatOff = false;
};
/* ---------- 第一日: 黑甲陪练 ---------- */
SEG.day1 = function* () {
  const A = ch1.A, D = A.dummy, P = ACAD.dummy;
  yield* fadeSwap(() => { setCP('day1'); hideActor(A.mohan); hideActor(A.lin); placeAmbient('day1'); placePlayer({ x: P.x, z: P.z + 8, yaw: 0 }); showActor(A.master, 'academy', P.x - 4.5, P.z + 4, -.6, 'whisk'); resetTrail(); }, '第一日', '学堂草坪 · 习剑');
  if (!D.shown) showActor(D, 'academy', P.x, P.z, 0, 'ready');
  Object.assign(D, { boss: true, hp: 1e7, maxHp: 1e7, floorHp: 1, dead: false, fighting: false, onHit(kind) { if (ch1.cp !== 'day1') return; const d = Math.hypot(player.x - D.x, player.z - D.z);
    if (kind === 's1' && ch1.flags.trainS1 !== undefined && ch1.flags.trainS1 < 5) { ch1.flags.trainS1++; $('objtxt').textContent = `斩马命中黑甲陪练 ${ch1.flags.trainS1}/5`; }
    else if (kind === 's2' && ch1.flags.trainS2 !== undefined && ch1.flags.trainS2 < 5) { if (d >= 6) { ch1.flags.trainS2++; $('objtxt').textContent = `退至6米外，以飞剑命中 ${ch1.flags.trainS2}/5`; } else toast('太近了——退远些再出飞剑'); } } });
  enemies.length = 0; enemies.push(D);
  A.master.faceP = 1;
  yield say('青玄真人', '剑修之道，先习其形。这具黑甲陪练，任你劈砍，不会还手。');
  yield say('青玄真人', '先试斩马。斩马一剑，力沉势猛，可破敌韧性。');
  ch1.flags.trainS1 = 0; ch1Hint('点击右下的<b>【斩马】</b>，劈向黑甲陪练', 'btn-s1');
  setObj('斩马命中黑甲陪练 0/5', () => D, 'academy');
  yield until(() => ch1.flags.trainS1 >= 5);
  ch1HintOff(); setObj(null);
  yield say('青玄真人', '善。再试飞剑——退至六步之外，以飞剑击之。');
  ch1.flags.trainS2 = 0; ch1Hint('退到<b>6米</b>之外，点击<b>【飞剑】</b>远程命中', 'btn-s2');
  setObj('退至6米外，以飞剑命中 0/5', () => D, 'academy');
  yield until(() => ch1.flags.trainS2 >= 5);
  ch1HintOff(); setObj(null); enemies.length = 0;
  yield say('青玄真人', '形已初具。明日，与清风切磋一场。');
};
/* ---------- 第二日: 与林清风切磋 (win or lose both pass) ---------- */
SEG.day2 = function* () {
  const A = ch1.A, R = ACAD.ring, L = A.lin;
  yield* fadeSwap(() => { setCP('day2'); placeAmbient('day2'); placePlayer({ x: R.x - 5, z: R.z, yaw: -Math.PI / 2 }); showActor(A.master, 'academy', R.x, -23.4, 0, 'whisk'); showActor(L, 'academy', R.x + 4.5, R.z, Math.PI / 2); L.pose = 'idle'; ch1.follow = false; resetTrail(); }, '第二日', '练武场 · 切磋');
  yield say('青玄真人', '今日切磋，点到为止。');
  yield say('林清风', '师弟，我可不会手下留情！');
  player.minHpFrac = .08;
  startFight(L, FOE_LIN, { ring: true, px: R.x - 5, pz: R.z, spar: true });
  ch1Hint('切磋不论胜负：留意<b>预警</b>，用上昨日所习'); ch1Timer(6, () => ch1HintOff());
  yield* fightIntro('切磋', '林清风 · Lv3');
  yield until(() => ch1.fight && ((ch1.fight.won && gameT - ch1.fight.wonT > 1.2) || ch1.fight.lost || player.hp <= player.maxHp * .08 + 1));
  const won = ch1.fight.won; ch1HintOff(); player.minHpFrac = 0;
  endFight(); L.dead = false; L.hp = L.maxHp; L.pose = won ? 'kneel' : 'idle'; L.fighting = false; L.solid = false; player.dead = false; player.hp = player.maxHp; hudDirty = true; timeScale = 1;
  yield wait(.8);
  if (won) { yield say('林清风', '好剑法！是我输了，心服口服。'); L.pose = 'idle'; yield say('青玄真人', '胜而不骄，方为剑修。'); }
  else { yield say('林清风', '承让。你根基尚浅，假以时日，必在我之上。'); yield say('青玄真人', '败亦是师。记住今日之痛。'); }
  ch1.flags.sparWon = won;
};
/* ---------- 第三日 · 晨: free roam (书页 are optional collectibles; NPC side quests hook in here) ---------- */
const DORM = { x: -56, z: -52.5 };
SEG.day3 = function* () {
  const A = ch1.A;
  yield* fadeSwap(() => { setCP('day3'); hideActor(A.lin); placeAmbient('day3'); placePlayer({ x: 4, z: -1, yaw: Math.PI * .8 }); showActor(A.master, 'academy', 2.6, -6.4, .4, 'whisk'); resetTrail(); }, '第三日', '晨 · 学院');
  A.master.faceP = 1;
  yield say('青玄真人', '今日无课。院中药房、食堂、钟楼……你且随意走走，熟悉熟悉。');
  yield say('青玄真人', '院里偶有旧书页随风飘落，若是遇见，不妨拾来一读。入夜之前，回弟子居所歇息。');
  A.master.faceP = 0;
  ch1Hint('今日<b>自由活动</b>：四处走走，与院中众人交谈，或有人相托；准备好后前往西侧<b>弟子居所</b>歇息'); ch1Timer(8, () => { if (ch1.cp === 'day3') ch1HintOff(); });
  const roam = () => setObj('在学院中闲逛，准备好后前往居所休息', DORM, 'academy');
  roam(); ch1.questOK = true;
  if (player.qcur) { const q = NPC_QUESTS.find(x => x.id === player.qcur.id); if (q && !(player.quests || []).includes(q.id)) ch1.questReq = { q, from: player.qcur.step | 0 }; player.qcur = null; }
  for (;;) {
    yield until(() => (ch1.flags.rest && !ch1.reading) || ch1.questReq);
    if (ch1.questReq) { const r = ch1.questReq; ch1.questReq = null; yield* runQuest(r.q || r, r.from || 0, !!r.q); roam(); continue; }
    break;
  }
  ch1.questOK = false; ch1HintOff(); setObj(null);
};
/* ---------- NPC side quests (hook) ----------
 * Push quest definitions into NPC_QUESTS. A quest is offered via the giver's 「交谈」 while its checkpoint allows quests (day3 roam).
 * { id: 'herb1', giver: 'pharm', cps: ['day3'], title: '采药',
 *   offer: [['药师', '……'], ['你', '……']],
 *   steps: [ { text: '去钟楼下采凝气草', reach: { x: -32, z: 14, r: 3 } },          // walk to a spot
 *            { text: '把药草交给药师', talk: 'pharm', done: [['药师', '多谢。']] },  // talk to an NPC (any CHAT key)
 *            { text: '……', cond: () => someFlag } ],                               // arbitrary condition
 *   outro: [['药师', '……']], reward() { ... } }
 * Completed quest ids are saved in player.quests. */
const NPC_QUESTS = [];
const quest = { cur: null, step: 0, talked: null };
function questFor(k) { if (!ch1.questOK || quest.cur) return null; return NPC_QUESTS.find(q => q.giver === k && (!q.cps || q.cps.includes(ch1.cp)) && !(player.quests || []).includes(q.id)) || null; }
function questChat(k) {
  const q = quest.cur; if (q) { const s = q.steps[quest.step]; const tk = s && (typeof s.talk === 'function' ? s.talk() : s.talk); if (tk === k) { quest.talked = k; return true; } return false; }
  const nq = questFor(k); if (nq) { ch1.questReq = nq; return true; } return false;
}
const qval = v => typeof v === 'function' ? v() : v;
function* runQuest(q, from = 0, resumed = false) {
  quest.cur = q; quest.step = from; ch1.sayQ = [];
  if (!resumed) { for (const [w, l] of q.offer || []) yield say(w, l); if (q.onAccept) q.onAccept(); saveGame(); }
  for (let i = from; i < q.steps.length; i++) {
    const s = q.steps[i]; quest.step = i; quest.talked = null; const wn = s.world || 'academy'; saveGame();
    if (s.choice) { const v = yield* chooseCo(s.choice.prompt, s.choice.opts); s.choice.pick(v); saveGame(); continue; }
    const tk = () => qval(s.talk);
    const objTxt = () => `【${q.title}】${qval(s.text)}`;
    setObj(objTxt(), s.target || s.reach || (s.talk ? () => ch1.A[tk()] : null), wn); ch1.qText = objTxt;
    const met = () => s.reach ? (world.name === wn && Math.hypot(player.x - s.reach.x, player.z - s.reach.z) < (s.reach.r || 2.5)) : s.talk ? quest.talked === tk() : s.cond ? !!s.cond() : true;
    for (;;) {
      yield until(() => met() || ch1.sayQ.length);
      while (ch1.sayQ.length) { const [w, l] = ch1.sayQ.shift(); yield say(w, l); }
      if (met()) break;
      if (ch1.obj) $('objtxt').textContent = objTxt();
    }
    ch1.qText = null;
    for (const [w, l] of qval(s.done) || []) yield say(w, l);
    if (s.after) s.after();
  }
  for (const [w, l] of qval(q.outro) || []) yield say(w, l);
  player.quests = [...(player.quests || []), q.id]; quest.cur = null;
  if (q.reward) yield* (q.reward() || []);
  saveGame(); toast(`完成：${q.title}`); sfx('level');
}
/* ---------- 第三日 · 夜: 墨寒 lurking by the library ---------- */
SEG.night = function* () {
  const A = ch1.A, M = A.mohan;
  yield* fadeSwap(() => { setCP('night'); setNight(true); placeAmbient('night'); hideActor(A.master); placePlayer({ x: -56, z: -45.4, yaw: -Math.PI / 2 }); resetTrail(); }, '入夜', '第三日 · 夜');
  M.walkAway = false; M.path = null; M.faceP = 0;
  showActor(M, 'academy', 15.4, -46, -Math.PI / 2, 'idle'); M.solid = false;
  bark('你', '……睡不着。出去走走。');
  setObj('夜色已深……图书馆旁似有人影', () => (M.shown ? { x: M.x, z: M.z } : null), 'academy');
  yield until(() => Math.hypot(player.x - M.x, player.z - M.z) < 6);
  setObj(null); faceActor(M, player.x, player.z, 1); M.faceP = 1;
  yield say('你', '墨寒？深夜在此作甚？');
  yield say('墨寒', '看什么？明日比武场上，有你好看的。');
  M.faceP = 0; M.path = [[17, -36], [17, -24], [24, -26]]; M.speed = 2.4; M.walkAway = true; ch1.flags.metMo = true;
  yield wait(1.2);
  setObj('回弟子居所就寝', { x: -56, z: -52.5 }, 'academy');
  yield until(() => ch1.flags.sleep);
  setObj(null); hideActor(M); M.walkAway = false;
};
SEG.arena = function* () {
  const A = ch1.A;
  yield* fadeSwap(() => {
    setCP('arena'); A.mohan.path = null; showActor(A.mohan, 'academy', 14.6, -16, Math.PI / 2); showActor(A.master, 'academy', ACAD.ring.x, -23.4, 0, 'whisk'); showActor(A.heavy, 'academy', 38, -15.5, -Math.PI / 2); showActor(A.dart, 'academy', 38, -8.5, -Math.PI / 2);
    setNight(false); placeAmbient('arena'); placePlayer({ x: -24, z: -11, yaw: Math.PI / 2 }); if (!A.lin.shown) showActor(A.lin, 'academy', -27.5, -11.5, 1.2); placeActor(A.lin, -26.5, -9.5, Math.PI * .7); resetTrail();
  }, '大比之日', '学院大比 · 练武场');
  yield say('林清风', '大比要开始了！跟我来，练武场在学院东边。');
  setObj('跟随林清风前往练武场', () => A.lin, 'academy');
  A.lin.path = [[-30, -6], [-30, 0], [0, 0], [12, 0], [14.6, -8]]; A.lin.speed = 4.2; A.lin.leading = true;
  yield until(() => !A.lin.path || !A.lin.path.length);
  A.lin.leading = false; faceActor(A.lin, player.x, player.z, 1);
  setObj('前往练武场', { x: 16, z: -8 }, 'academy');
  yield until(() => player.x > 11 && player.z < 2 && player.z > -26);
  setObj(null);
};
function* duel(n) {
  const A = ch1.A, R = ACAD.ring, foe = [null, A.heavy, A.dart, A.mohan][n], def = [null, FOE_HEAVY, FOE_DART, FOE_MOHAN][n];
  setCP('duel' + n); ch1.follow = false;
  if (n === 1) {
    yield say('青玄真人', '学院大比，现在开始！规矩只有一条——点到为止，倒地或认输者负。');
    yield say('青玄真人', '第一场——新弟子{name}，对重剑堂弟子！');
  } else if (n === 2) yield say('青玄真人', '第二场——{name}，对暗器堂弟子！');
  else { yield say('青玄真人', '决赛——{name}，对魔派首席，墨寒！'); }
  // opponent walks into the ring
  foe.solid = false; foe.path = [[R.x + 4.5, R.z]]; foe.speed = 3; setObj('走上比武台', { x: R.x - 2, z: R.z }, 'academy');
  yield until(() => !foe.path || !foe.path.length);
  faceActor(foe, player.x, player.z, 1);
  if (n === 1) yield say('重剑弟子', '新来的？挨我一剑可别哭鼻子！');
  else if (n === 2) yield say('暗器弟子', '我的暗器可不长眼睛，小心了。');
  else { yield say('墨寒', '我说过，我们会在比武场上见。'); yield say('你', '请。'); }
  yield until(() => Math.hypot(player.x - R.x, player.z - R.z) < R.r - 1.5);
  setObj(null);
  if (n === 1) ch1Hint('看清<b>红色预警</b>，闪避或<b>格挡</b>；斩马削韧最快，韧性打空即可<b>破防</b>');
  if (n === 2) ch1Hint('暗器弟子擅长远攻：用<b>飞剑</b>远程追击，飞镖也可以<b>格挡</b>');
  if (n === 3) ch1Hint('墨寒出手迅疾：连斩之间寻找<b>弹反</b>时机，留意他闪身到你身后');
  ch1Timer(6, () => ch1HintOff());
  startFight(foe, def, { ring: true, px: R.x - 5, pz: R.z, lose: ['重剑势大力沉，看准预警再闪避！', '拉近距离，用飞剑与斩马压制她！', '墨寒招式凌厉，格挡弹反是破局之道！'][n - 1] });
  if (n === 2) foe.orbit.visible = true;
  yield* fightIntro(['第一场', '第二场', '决赛'][n - 1], `${foe.name} · Lv${def.lv}`);
  yield until(() => ch1.fight && ch1.fight.won && gameT - ch1.fight.wonT > 1.4);
  ch1HintOff();
  endFight(); foe.pose = n === 3 ? 'stagger' : 'kneel';
  if (n === 1) yield say('重剑弟子', '……好快的身法，我输了。');
  if (n === 2) yield say('暗器弟子', '我的暗器……竟然一枚都没能留住你。');
  if (n === 3) yield say('墨寒', '……不可能。');
  levelUp(n === 3 ? 2 : 1);
  yield wait(1.4);
  yield say('青玄真人', n === 3 ? '胜者——{name}！' : '这一场，{name}胜！');
  foe.pose = 'idle'; foe.solid = true;
  foe.path = n === 3 ? [[R.x + 3, -15.8]] : [[38, n === 1 ? -15.5 : -8.5]]; foe.speed = 2.4;
  if (n === 2) foe.orbit.visible = false;
};
SEG.duel1 = function* () { yield* duel(1); };
SEG.duel2 = function* () { yield* duel(2); };
SEG.duel3 = function* () { yield* duel(3); };
SEG.ceremony = function* () {
  const A = ch1.A, R = ACAD.ring; setCP('ceremony');
  yield wait(.6);
  placeActor(A.master, R.x, -21, Math.PI); A.master.pose = 'whisk';
  if (A.lin.x < 18) { A.lin.path = [[R.x - 2.4, -15.2]]; A.lin.speed = 3.6; }
  setObj('前往领奖', { x: R.x, z: -16 }, 'academy');
  yield until(() => Math.hypot(player.x - R.x, player.z + 16) < 3.5);
  setObj(null);
  yield say('青玄真人', '本届学院大比——冠军，{name}！');
  yield say('青玄真人', '第二名，林清风！');
  A.lin.pose = 'cheer'; yield say('林清风', '哈哈，能和你一同站上领奖台，我也沾了光！'); A.lin.pose = 'idle';
  A.mohan.faceP = 1; yield say('墨寒', '……这笔账，我记下了。');
  // 墨寒 walks away slowly, dark-faced
  A.mohan.solid = false; A.mohan.path = [[R.x + 3, -2], [12, 0], [3, 0], [0, 8]]; A.mohan.speed = 1.5; A.mohan.pose = 'idle'; A.mohan.headTilt = .35; A.mohan.walkAway = true;
  yield wait(3.5);
  yield say('林清风', '别放在心上，他就是这个脾气。');
};
SEG.heart = function* () {
  const A = ch1.A;
  yield* fadeSwap(() => { setCP('heart'); hideActor(A.mohan); A.mohan.headTilt = 0; A.mohan.walkAway = false; hideActor(A.heavy); hideActor(A.dart); hideActor(A.master); ch1.follow = false; placePlayer({ x: -11.2, z: 24.4, yaw: 1.2 }); showActor(A.lin, 'academy', -13.2, 25.4, -2); A.lin.pose = 'idle'; resetTrail(); }, '黄昏', '荷塘 · 凉亭', 1.2);
  A.lin.faceP = 1;
  yield say('林清风', '今日一战，痛快。');
  yield say('你', '师兄为何修仙道？');
  yield say('林清风', '幼时家乡遭兽祸，一位仙修路过，一剑救下全村。那一剑，我记了十年。');
  yield say('林清风', '魔修求力，仙修求心。力可夺人，心可护人——我想做护人的那个。');
  yield say('你', '……我亦然。');
  yield say('林清风', '好！往后你我便是同道。有难同当，有酒同饮。');
  showActor(A.master, 'academy', -4.5, 22.5, -1.4, 'whisk'); A.master.path = [[-8.6, 23.6]]; A.master.speed = 2.6;
  yield until(() => !A.master.path || !A.master.path.length); A.master.faceP = 1;
  yield say('青玄真人', '按照规矩，冠军可入图书馆禁阁。清风，你也随他同去吧。');
  yield say('青玄真人', '随为师来。');
  yield* fadeSwap(() => { hideActor(A.mohan); A.mohan.headTilt = 0; A.mohan.walkAway = false; hideActor(A.heavy); hideActor(A.dart); setCP('library'); placePlayer({ x: 0, z: -35, yaw: 0 }); showActor(A.master, 'academy', 3.8, -38.6, -Math.PI * .75, 'whisk'); showActor(A.lin, 'academy', -1.8, -33.8, Math.PI); resetTrail(); ch1.follow = true; }, '片刻之后', '图书馆 · 门前', 1.2);
};
SEG.library = function* () {
  const A = ch1.A; setCP('library'); ch1.follow = true;
  yield say('青玄真人', '禁阁就在图书馆深处。为师便送到这里，你们自己进去吧。');
  yield say('青玄真人', '记住——眼睛看到的，未必便是全部。');
  setObj('进入图书馆，寻找秘籍', { x: ACAD.book.x, z: ACAD.book.z }, 'academy');
  yield until(() => ch1.flags.book);
  setObj(null);
  yield say(null, '《无影身法》\n身随心隐，形随意散。敌之所见，唯余残影。\n——隐于无形者，方见无形之物。');
  if (!hasSt('yinshen')) player.unlocked.push('yinshen'); hudDirty = true; SK.yinshen.t = 0;
  showLearn('习得【隐身】', '神通十字 · 右');
  setCP('hidden');
  yield wait(1.6);
};
SEG.hidden = function* () {
  const A = ch1.A; ch1.follow = true;
  yield say('林清风', '“隐于无形者，方见无形之物”……这话听着玄乎。要不你施展隐身试试？');
  ch1Hint('点击左侧神通十字右边的<b>【隐身】</b>：留下残影并向前冲刺，隐身 3 秒', 'st-yinshen');
  setObj('施展【隐身】', null, 'academy');
  yield until(() => player.stealthT > 0);
  ch1HintOff();
  yield wait(.5);
  bark('林清风', '咦？图书馆最里面那面墙上……好像闪过一道紫光！');
  setObj('隐身状态下，进入图书馆尽头的紫光之门', { x: ACAD.hidden.x, z: ACAD.hidden.z + .6 }, 'academy');
  yield until(() => ch1.flags.door);
  setObj(null);
  yield* fadeSwap(() => { setCP('digong'); player.stealthT = 0; endStealth(true); document.body.classList.remove('stealth'); worlds.digong.setState({}); goWorld('digong', DG.spawn); A.lin.world = 'digong'; placeActor(A.lin, 1.9, DG.spawn.z + .8, 0); }, '地宫', '紫光之门的另一侧');
};
/* ---------- 地宫机关 (v4.3) helpers ---------- */
function mkButton(x, z, h, r, opt) { // invisible "enemy" standing on a wall button so normal attacks / 飞剑 can hit it
  return Object.assign({ kind: 'btn', boss: true, noNum: true, noPush: true, passThrough: true, name: '机关', lvTxt: '-', x, z, y: 0, yaw: 0, radius: r, r, height: h, hp: 1e9, maxHp: 1e9, floorHp: 1, armor: 1, mats: [], holder: new THREE.Group(), dead: false, update() { } }, opt);
}
function hideAppr() { for (const a of (ch1.apprPool || [])) { a.fighting = false; a.dead = true; a.holder.visible = false; } ch1.appr = []; }
function spawnAppr(pts) { player.amuletUsed = false;
  const pool = ch1.apprPool = ch1.apprPool || []; ch1.appr = [];
  pts.forEach(([x, z], i) => {
    const a = pool[i] || (pool[i] = makeAppr());
    Object.assign(a, { fighting: true, def: FOE_APPR, ai: true, dead: false, hp: FOE_APPR.hp, maxHp: FOE_APPR.hp, lvTxt: String(FOE_APPR.lv), act: null, cd: rand(.9, 2.2), stagger: 0, warnT: 0, invuln: false, airY: 0, spin: 0, passThrough: false, falling: false, fade: 1, slowT: 0, kbT: 0, floorHp: 0, tough: false, world: 'digong', yaw: faceYaw(x, z, player.x, player.z) });
    a.holder.rotation.x = 0; a.holder.visible = true; a.model.mat.uniforms.op.value = 1; placeActor(a, x, z);
    smoke(V3(x, 1, z), 0x9030ff); burst(V3(x, .8, z), 18, 0xb060ff, 5, .4, .6, -3);
    ch1.appr.push(a); enemies.push(a);
  });
}
function startPlayerFall() { ch1.pfall = { t: 0 }; state = 'cut'; resetInputs('fall'); sfx('whoosh'); bark('林清风', '当心脚下！'); }
function updatePlayerFall(dt) {
  const p = ch1.pfall; p.t += dt; const f = $('fade');
  if (!p.moved) { camDrop = Math.min(9, p.t * p.t * 16); if (p.t > .3 && !p.fd) { p.fd = 1; f.style.transition = 'opacity .4s'; f.style.opacity = 1; } }
  if (p.t >= .85 && !p.moved) { p.moved = 1; camDrop = 0; placePlayer({ x: 0, z: DG.chasm.z1 + 1.6, yaw: 0 }); const d = Math.round(player.maxHp * .12); player.hp = Math.max(1, player.hp - d); player.lastHurt = gameT; hudDirty = true;
    const L = ch1.A.lin; if (L.shown) placeActor(L, 1.7, DG.chasm.z1 + 2.8, 0); resetTrail(); toast(`坠入深渊……重回桥头（气血 -${d}）`); f.style.transition = 'opacity .5s'; f.style.opacity = 0; ch1.falls = (ch1.falls || 0) + 1; }
  if (p.t >= 1.2) { ch1.pfall = null; if (state === 'cut') state = 'play'; }
}
function linAssist(a, dt) { // 林清风 slashes at an apprentice next to him during the bridge fight
  a.atkCd = (a.atkCd ?? 1.5) - dt; if (a.swingT > 0) { a.swingT -= dt; if (a.swingT <= 0 && a.tgt && !a.tgt.dead) { a.pose = 'slashR'; a.poseK = 24; sfx('swish'); foeSlashFx(a, 0x6ff0e0, .3, .8); allyHit(a.tgt, 24 + player.lv * 2, 0); setTimeout(() => { if (a.pose === 'slashR') a.pose = 'idle'; }, 260); } return; }
  if (a.atkCd > 0 || state !== 'play') return; let best = null, bd = 2.4;
  for (const e of ch1.appr || []) { if (e.dead) continue; const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd) { bd = d; best = e; } }
  if (best) { a.tgt = best; a.atkCd = rand(1.2, 1.7); a.yaw = faceYaw(a.x, a.z, best.x, best.z); a.pose = 'windR'; a.poseK = 14; a.swingT = .22; }
}
function ch1Digong(dt, dtR) {
  if (ch1.anim && ch1.anim(dtR) === true) ch1.anim = null;
  const A = ch1.A;
  if (world.name === 'academy') ch1Academy(dt);
  if (world.name === 'digong') {
    const W = world, C = DG.chasm, inCh = z => z > C.z0 - .2 && z < C.z1 + .2;
    if (W.bridgeK >= 1) {
      const L = A.lin; if (L.shown && L.world === 'digong' && inCh(L.z) && Math.abs(L.x) > 1.8) { L.x = clamp(L.x, -1.8, 1.8); syncActor(L); }
      if (!ch1.pfall && state === 'play' && !player.dead && !player.riding && player.z > C.z0 && player.z < C.z1 && Math.abs(player.x) > C.hw + .15) startPlayerFall();
    }
    if (W.barOn) { // solid unless 隐身; never leave the player embedded when 隐身 ends mid-crossing
      const B = W.barrierBox, st = player.stealthT > 0; B.off = st; if (ch1.cp === 'chamber' && player.z > B.z0 && SK.yinshen.t > 3) SK.yinshen.t = 3;
      if (!st && Math.abs(player.x) < 5.3 && player.z > B.z0 - .45 && player.z < B.z1 + .45) { const mid = (B.z0 + B.z1) / 2; player.z = player.z < mid ? B.z0 - .5 : B.z1 + .5; ch1.barPush = (ch1.barPush || 0) + 1; }
      const L = A.lin; if (!st && L.shown && Math.abs(L.x) < 5.3 && L.z > B.z0 - .45 && L.z < B.z1 + .45) { L.z = player.z < B.z0 ? B.z0 - .5 : B.z1 + .5; syncActor(L); }
      if (!st && L.shown && player.z < B.z0 - .5 && L.z > B.z1 && Math.hypot(L.x - player.x, L.z - player.z) > 3.5 && state === 'play') { smoke(V3(L.x, 1, L.z), 0x6fe0d0); placeActor(L, clamp(player.x + 1.2, -8, 8), Math.min(player.z + .8, B.z0 - .6)); smoke(V3(L.x, 1, L.z), 0x6fe0d0); resetTrail(); }
    }
    if (ch1.flags.bridgeFight && A.lin.shown) linAssist(A.lin, dt);
  }
  if (ch1.pfall) updatePlayerFall(dtR);
  if (world.name === 'jingdian') updateJdOrb(dt);
}
/* ---------- 地宫 · 石门机关 ---------- */
SEG.digong = function* () {
  const A = ch1.A, W = worlds.digong; setCP('digong'); ch1.follow = true;
  yield say('林清风', '这里……竟然是一座地宫。学院之下，怎会藏着这种地方？');
  yield say('林清风', '前路被石墙封死了。墙心那枚圆钮……怕是机关。');
  ch1Hint('用<b>普攻</b>攻击按钮试试', 'btn-atk');
  setObj('用普攻攻击石墙中央的圆钮', { x: 0, z: DG.door1Z + .6, height: 3.4 }, 'digong');
  enemies.length = 0; enemies.push(mkButton(0, DG.door1Z + .05, 4.7, 1.7, { onHit() { ch1.flags.btn1 = true; } }));
  yield until(() => ch1.flags.btn1);
  enemies.length = 0; ch1HintOff(); setObj(null); W.door1.btnM.emissiveIntensity = 2.4; shake = Math.max(shake, .3);
  W.openDoor(W.door1);
  yield wait(.9); bark('林清风', '石门开了！');
  yield until(() => W.door1.open);
  setCP('chasm');
};
/* ---------- 地宫 · 断崖 ---------- */
SEG.chasm = function* () {
  const W = worlds.digong; setCP('chasm'); ch1.follow = true;
  setObj('穿过石门', DG.nearEdge, 'digong');
  yield until(() => world.name === 'digong' && player.z < DG.chasm.z1 + 3.4);
  setObj(null);
  yield say('林清风', '好深的断崖……前面没路了。');
  yield say('林清风', '看对面石壁——又是一枚圆钮！隔着深渊，剑锋可够不着。');
  ch1Hint('用<b>飞剑</b>攻击按钮试试', 'btn-s2'); ch1.flags.needFly = true;
  setObj('用飞剑击中对面石壁的圆钮', { x: 0, z: DG.door2Z + .3, height: 4.4 }, 'digong');
  enemies.length = 0; enemies.push(mkButton(0, DG.door2Z + .3, 5.8, 2.3, { flyMagnet: true, onHit(kind) { if (kind === 's2') ch1.flags.btn2 = true; else if (!ch1.flags.btnMiss) { ch1.flags.btnMiss = 1; bark('林清风', '寻常剑招够不着——试试飞剑！'); } } }));
  yield until(() => ch1.flags.btn2);
  enemies.length = 0; ch1.flags.needFly = false; ch1HintOff(); setObj(null); W.door2.btnM.emissiveIntensity = 2.4; sfx('stone');
  yield wait(.5); W.raiseBridge(); bark('林清风', '深渊里……升起了一座石桥！');
  yield until(() => W.bridgeK >= 1);
  setCP('bridge');
};
/* ---------- 地宫 · 石桥 (6 apprentice phantoms) ---------- */
SEG.bridge = function* () {
  const W = worlds.digong, C = DG.chasm, zm = (C.z0 + C.z1) / 2; setCP('bridge'); ch1.follow = true;
  yield wait(.3);
  shake = .3; sfx('roar');
  spawnAppr([[-1.6, C.z1 - .6], [1.6, C.z1 - .6], [-1.6, zm], [1.6, zm], [-1.6, C.z0 + .6], [1.6, C.z0 + .6]]);
  yield say('林清风', '桥上有东西——是魔修残念所化的虚影！');
  ch1.flags.bridgeFight = true;
  ch1Hint('用<b>斩马</b>的击退效果，将虚影推下悬崖！', 'btn-s1'); ch1Timer(7, () => { if (ch1.cp === 'bridge') ch1HintOff(); });
  const left = () => ch1.appr.filter(a => !a.dead).length;
  setObj('击败虚影 0/6', null, 'digong'); let shown = -1;
  yield until(() => { const n = 6 - left(); if (n !== shown) { shown = n; $('objtxt').textContent = `击败虚影 ${n}/6`; } return n >= 6; });
  ch1.flags.bridgeFight = false; ch1HintOff(); setObj(null);
  yield wait(1.4); hideAppr(); enemies.length = 0;
  bark('林清风', '虚影尽散！对面的石门……也动了。');
  W.openDoor(W.door2); W.barOn = true; W.barrier.visible = true; W.barrierBox.off = false;
  yield until(() => W.door2.open);
  setCP('chamber');
};
/* ---------- 地宫 · 密室 ---------- */
SEG.chamber = function* () {
  const A = ch1.A; setCP('chamber'); ch1.follow = true;
  const W = worlds.digong;
  setObj('过桥，前往石门', { x: 0, z: DG.door2Z + 2.4 }, 'digong');
  yield until(() => world.name === 'digong' && player.z < DG.door2Z + 3.6);
  yield say('林清风', '门后有一道紫色屏障……灵力森然，硬闯不得。');
  yield say('林清风', '“隐于无形者，方见无形之物”——或许隐身便能穿过去。');
  ch1Hint('<b>隐身</b>才能穿过紫色屏障', 'st-yinshen');
  setObj('隐身穿过紫色屏障，进入密室', DG.hallIn, 'digong');
  yield until(() => world.name === 'digong' && player.z < DG.door2Z - 1.7);
  ch1HintOff(); setObj(null);
  { const L = A.lin; if (L.z > DG.door2Z - 1.6) { smoke(V3(L.x, 1, L.z), 0x6fe0d0); placeActor(L, clamp(player.x + 1.5, -8, 8), Math.min(player.z + .6, DG.door2Z - 2.2), 0); smoke(V3(L.x, 1, L.z), 0x6fe0d0); resetTrail(); } }
  yield wait(.4);
  yield say('林清风', '石门之后，竟藏着一间密室。');
  yield say('林清风', '你看祭台上——那本发着紫光的书。');
  setObj('查看祭台上的魔修圣书', { x: DG.book.x, z: DG.book.z }, 'digong');
  yield until(() => ch1.flags.tome);
  setObj(null);
  yield say(null, '天地第一剑，名曰\'太初\'。生于混沌未分之时，饮异兽之血，承天地之怒。持此剑者，一念可断山河，一剑可镇众生。然剑有灵，择主而栖。心正者得之，可护苍生；心魔者得之，必为剑所噬。仙尊封之于九幽之下，以七道剑印锁之。今印已松其三……欲得此剑，先集七印。');
  yield say('林清风', '太初……天地第一剑！七道剑印已松其三……这到底是怎么回事？');
  ch1.flags.canTake = true; ch1Hint('点击<b>收集</b>，将圣书带走');
  setObj('收集祭台上的魔修圣书', { x: DG.book.x, z: DG.book.z }, 'digong');
  yield until(() => ch1.flags.took);
  ch1HintOff(); setObj(null);
  { const W = worlds.digong, p = W.tome.getWorldPosition(V3(0, 0, 0)); burst(p, 30, 0xc080ff, 4, .4, .6, 0); W.tome.visible = W.bookGlow.visible = false; giveItem('tome'); saveGame(); showLearn('获得【魔修圣书】', '已收入行囊'); }
  yield wait(1.3);
  yield say('林清风', '你要带走它？……也好，留在此处，迟早落入魔修之手。');
};
/* ---------- 地宫 · 魔修虚影 (two phases → floor-shatter cutscene) ---------- */
SEG.phantom = function* () {
  const A = ch1.A, g = A.ghost, W = worlds.digong; setCP('phantom');
  shake = .4; sfx('roar'); smoke(V3(0, 1, -9.5), 0x9030ff); smoke(V3(0, 1.5, -9.5), 0x9030ff);
  showActor(g, 'digong', 0, -9.5, 0, 'float'); ghostCharMat.uniforms.op.value = 1; faceActor(g, player.x, player.z, 1);
  yield wait(.8);
  yield say('魔修虚影', '擅动圣书者……留下性命！');
  yield say('林清风', '小心！我来助你！');
  ch1.follow = false; startFight(g, FOE_GHOST, { ally: true, px: 0, pz: -2, lose: '与林清风前后夹击，留意紫色预警！' });
  ch1Hint('<b>林清风</b>会与你并肩作战；他气血不足时会暂退调息', null); ch1Timer(5, () => ch1HintOff());
  yield* fightIntro('魔修虚影', 'Lv5 · 与林清风并肩作战');
  yield until(() => ch1.fight && (ch1.fight.won || (!g.trans && g.hp <= g.floorHp + 1)));
  // ---- cutscene: the phantom smashes the floor ----
  g.ai = false; g.act = null; g.warnT = 0; g.invuln = true; g.stagger = 0; clearProj(); ch1HintOff();
  endFight(); g.holder.visible = true; ch1.follow = false; const L = A.lin; L.path = null; L.pose = 'ready';
  state = 'play'; timeScale = 1;
  yield say('魔修虚影', '……七印终将归位！吾虽残念，亦要尔等陪葬！');
  state = 'cut'; resetInputs('cut');
  const gs = g.model.root.scale.x; let t = 0, slam = false; g.pose = 'sky'; g.poseK = 5; sfx('roar');
  const px = player.x, pz = player.z, cx = (px + g.x) / 2, cz = (pz + g.z) / 2; const pr = Math.hypot(px - cx, pz - cz) + 4.5;
  placeActor(L, clamp(px + 1.6, -8.5, 8.5), pz + .4, faceYaw(px + 1.6, pz + .4, g.x, g.z));
  W.pit.position.set(cx, .035, cz); W.pit.scale.setScalar(.01); W.pit.visible = false;
  ch1.anim = dt => {
    t += dt;
    if (t < 1.1) { g.airY = Math.sin(Math.min(1, t / 1.1) * Math.PI / 2) * 2.6; faceActor(g, px, pz, dt * 4); if (Math.random() < .9) emit(g.x + rand(-1, 1), rand(0, 4), g.z + rand(-1, 1), 0, 2, 0, 0xc070ff, .5, .6, 0); }
    else if (!slam) { g.airY = Math.max(0, g.airY - dt * 22); if (g.airY <= 0) { slam = true; g.pose = 'slam'; g.poseK = 22; sfx('boom'); sfx('stone'); shake = 1.2; flashScreen('#e0b0ff', .5, .5); shockRing(V3(g.x, 0, g.z), 0xc070ff, .5, 12, .9); burst(V3(g.x, .4, g.z), 90, 0xb090c0, 10, .7, 1, -6, .8); W.pit.visible = true; t = 1.1; } }
    if (slam) {
      const k = Math.min(1, (t - 1.1) / .7); W.pit.scale.setScalar(.2 + pr * k); shake = Math.max(shake, .5);
      if (Math.random() < .8) { const a = rand(0, 6.28), r = rand(0, pr * k); emit(cx + Math.cos(a) * r, .1, cz + Math.sin(a) * r, 0, rand(1, 3), 0, 0x8a7a9a, .5, .8, -9); }
      if (t > 1.6) { const kk = t - 1.6; camDrop = Math.min(10, kk * kk * 9); L.airY = -Math.min(12, kk * kk * 11); g.airY = -kk * 2; ghostCharMat.uniforms.op.value = Math.max(0, 1 - kk); }
      if (t > 2.6) return true;
    }
  };
  yield wait(1.9); bark('林清风', '地面……要塌了——！');
  yield until(() => !ch1.anim);
  const f = $('fade'); f.style.transition = 'opacity .35s'; f.style.opacity = 1; yield wait(1.2);
  hideActor(g); L.airY = 0; W.pit.visible = false; camDrop = 0; ghostCharMat.uniforms.op.value = 1;
  setCP('tunnel');
};
/* ---------- 地底甬道: wake → follow the orb to the 七印巨门 ---------- */
function updateJdOrb(dt) {
  const W = world; if (!W.orbOn) return; const P = JD.orbPath, o = W.orb.position; W.orb.visible = true;
  if (ch1.flags.orbSeal) { const tx = 0, ty = JD.top + 17, tz = 45.3, dx = tx - o.x, dy = ty - o.y, dz = tz - o.z, d = Math.hypot(dx, dy, dz); if (d > .05) { const m = Math.min(d, 4 * dt); o.x += dx / d * m; o.y += dy / d * m; o.z += dz / d * m; } else { W.orbOn = false; W.orb.visible = false; burst(V3(o.x, o.y, o.z), 30, 0xd0a0ff, 4, .4, .6, 0); sfx('ding'); W.seals[6].material.opacity = .8; } return; }
  const tgt = P[Math.min(W.orbI, P.length - 1)];
  const dx = tgt[0] - o.x, dz = tgt[1] - o.z, d = Math.hypot(dx, dz);
  if (d > .02) { const m = Math.min(d, 3.6 * dt); o.x += dx / d * m; o.z += dz / d * m; }
  o.y = jdH(o.x, o.z) + 1.7 + Math.sin(gameT * 2.2) * .15;
  const pd = Math.hypot(player.x - o.x, player.z - o.z);
  if (d < .3) { if (W.orbI < P.length - 1) { const nx = P[W.orbI + 1]; if (pd < 4.8 || Math.hypot(player.x - nx[0], player.z - nx[1]) < 3) W.orbI++; } else if (pd < 6) ch1.flags.orbDone = true; }
}
function wakeUp(title, sub2) {
  const f = $('fade'); state = 'cut'; resetInputs('wake'); f.style.transition = 'opacity 1.6s'; f.style.opacity = 1; camDrop = 1.25; player.pitch = .5;
  let t = 0; ch1.anim = dt => { t += dt; if (t > .6) { camDrop = 1.25 * Math.max(0, 1 - (t - .6) / 1.6); player.pitch = lerp(player.pitch, -.04, Math.min(1, dt * 1.5)); } return t > 2.4; };
  return function* () { yield wait(.5); f.style.opacity = 0; banner(title, sub2, 2); yield wait(2.2); camDrop = 0; state = 'play'; };
}
SEG.tunnel = function* () {
  const A = ch1.A, W = worlds.jingdian, L = A.lin; setCP('tunnel'); ch1.follow = true;
  if (world.name !== 'jingdian') { setWorld('jingdian'); clearFx(); clearProj(); W.setState({}); placePlayer(JD.spawn); resetTrail(); showActor(L, 'jingdian', 1.5, JD.spawn.z - 1.2, Math.PI); ch1.follow = true; }
  yield* wakeUp('地底甬道', '地宫之下')();
  yield say('林清风', '醒醒！……你没事吧？');
  yield say('你', '……这是何处？圣书……还在。');
  yield say('林清风', '地宫之下，竟还有一条甬道。看——那团紫光，似在引路。');
  W.orbOn = true; W.orbI = 0; W.orb.visible = true;
  setObj('跟随紫光', () => W.orbOn ? { x: W.orb.position.x, z: W.orb.position.z } : null, 'jingdian');
  yield until(() => ch1.flags.orbDone);
  setCP('door');
};
/* ---------- 七印巨门 ---------- */
SEG.door = function* () {
  const W = worlds.jingdian; setCP('door'); ch1.follow = true;
  setObj('前往甬道尽头', { x: 0, z: 50 }, 'jingdian');
  yield until(() => world.name === 'jingdian' && player.z < 54);
  setObj(null); if (W.orbOn || W.orb.visible) { W.orbOn = true; ch1.flags.orbSeal = true; }
  yield say('林清风', '好大的一扇门……门上刻着七道印记。');
  yield say('林清风', '七道印……与圣书所言“七道剑印”，莫非有关？');
  ch1.flags.doorReady = true; ch1Hint('走近巨门，点击<b>开启</b>'); ch1Timer(7, () => { if (ch1.cp === 'door') ch1HintOff(); });
  setObj('开启七印巨门', { x: 0, z: 46.2, height: 6 }, 'jingdian');
  yield until(() => ch1.flags.openDoor);
  ch1HintOff(); setObj(null); state = 'cut'; resetInputs('door'); if (player.riding) endRide();
  { const sx = player.x, sz = player.z, tz = Math.max(48.6, Math.min(sz, 51)); let t = 0; ch1.anim = dt => { t += dt; const k = Math.min(1, t / 1.2); player.x = lerp(sx, 0, k); player.z = lerp(sz, tz, k); player.yaw += angDiff(player.yaw, 0) * Math.min(1, dt * 4); player.pitch = lerp(player.pitch, .32, Math.min(1, dt * 2)); return t > 1.3; }; }
  W.openDoor();
  yield wait(2.2); bark('林清风', '印记……一道一道亮了！');
  yield until(() => W.door.open);
  player.pitch = .05; state = 'play';
  yield say('林清风', '门后……是一道往下的石阶。好宽！');
  setObj('沿石阶而下', { x: 0, z: 20 }, 'jingdian');
  yield until(() => world.name === 'jingdian' && player.z < JD.hallZ);
  setObj(null);
  setCP('hall');
};
/* ---------- 七印镜殿: place the 圣书 → 3 of 7 mirrors light ---------- */
SEG.hall = function* () {
  const A = ch1.A, W = worlds.jingdian, L = A.lin; setCP('hall'); ch1.follow = true;
  banner('七印镜殿', '地宫最深处', 2.8); sfx('ding');
  yield wait(1.4);
  yield say('林清风', '好大的殿……四周立着七面古镜，却都黯淡无光。');
  yield say('林清风', '殿心那座书架空着一格，倒像在等什么。');
  ch1Hint('走到殿心书架前，点击<b>放置</b>'); ch1Timer(7, () => { if (ch1.cp === 'hall') ch1HintOff(); });
  setObj('将魔修圣书放上殿心书架', { x: JD.place.x, z: JD.place.z }, 'jingdian');
  yield until(() => ch1.flags.placeBook);
  ch1HintOff(); setObj(null); state = 'cut'; resetInputs('place'); if (player.riding) endRide();
  takeItem('tome'); W.shelfBook.visible = true; burst(W.shelfBook.position.clone(), 40, 0xd0a0ff, 4, .4, .7, 0); sfx('level'); saveGame();
  if (Math.hypot(L.x - JD.crystal.x, L.z - JD.crystal.z) < 3.2 || Math.hypot(L.x - JD.circle.x, L.z - JD.circle.z) < 2.4 || Math.abs(L.x) < 1.5) { smoke(V3(L.x, 1, L.z), 0x6fe0d0); placeActor(L, 3.2, -11.6, -.5); smoke(V3(L.x, 1, L.z), 0x6fe0d0); resetTrail(); }
  { const sx = player.x, sz = player.z; let t = 0; ch1.anim = dt => { t += dt; const k = Math.min(1, t / 1.1); const e = k * k * (3 - 2 * k); player.x = lerp(sx, 0, e); player.z = lerp(sz, -11.5, e); player.yaw += angDiff(player.yaw, 0) * Math.min(1, dt * 4); player.pitch = lerp(player.pitch, .06, Math.min(1, dt * 3)); W.discGlowM.opacity = Math.min(.75, t * .45); if (Math.random() < .7) { const a = rand(0, 6.28), r = rand(2, 13.5); emit(JD.shelf.x + Math.cos(a) * r, .15, JD.shelf.z + Math.sin(a) * r, 0, rand(.4, 1.2), 0, 0xc080ff, .3, .9, 0); } return t > 1.9; }; }
  yield until(() => !ch1.anim);
  shake = .4; sfx('roar'); shockRing(V3(JD.shelf.x, .1, JD.shelf.z), 0xc080ff, .5, 14, 1.1); W.lightMirrors();
  yield wait(2.9);
  state = 'play';
  yield say('林清风', '镜子……亮了三面！');
  yield say('林清风', '“今印已松其三”……七面古镜，七道剑印。亮起的这三面，莫非就是已经松动的三印？');
  setCP('placed');
};
SEG.placed = function* () {
  const A = ch1.A, W = worlds.jingdian, L = A.lin; setCP('placed'); ch1.follow = true;
  if (!W.crystal.visible) { W.crystal.visible = true; W.crystal.scale.setScalar(1); W.crystal.position.y = -1.6; W.crys.off = false; W.crL.intensity = 5; sfx('stone'); shake = .25; shockRing(V3(JD.crystal.x, .1, JD.crystal.z), 0xc080ff, .3, 4, .7); burst(V3(JD.crystal.x, .3, JD.crystal.z), 50, 0xb090c0, 6, .6, .8, -4); yield wait(1.4); }
  yield say('林清风', '书架前……升起了一块紫光晶石。灵气好浓，或可为你所用。');
  setObj('吸收紫光晶石', { x: JD.crystal.x, z: JD.crystal.z, height: 3.2 }, 'jingdian');
  yield until(() => ch1.flags.absorb);
  setObj(null); state = 'cut'; resetInputs('absorb'); sfx('roar');
  { let k = 0; const cr = W.crystal; ch1.anim = dt => { k += dt / 2; cr.scale.setScalar(Math.max(.01, 1 - k * k)); W.crL.intensity = 5 * (1 - k) + Math.sin(gameT * 20) * k;
      for (let i = 0; i < 4; i++) { const sx = cr.position.x + rand(-1, 1) * (1 - k), sy = cr.position.y + rand(-1, 1) * (1 - k), sz = cr.position.z + rand(-1, 1) * (1 - k), life = rand(.5, .8); emit(sx, sy, sz, (player.x - sx) / life, (camY - .5 - sy) / life, (player.z - sz) / life, i % 2 ? 0xc080ff : 0xf0d0ff, rand(.25, .45), life, 0); }
      if (k >= 1) { cr.visible = false; W.crys.off = true; W.crL.intensity = 0; return true; } }; }
  yield until(() => !ch1.anim);
  flashScreen('#c080ff', .45, .8); shockRing(V3(player.x, 0, player.z), 0xc080ff, .3, 5, .9); sfx('level'); player.hp = player.maxHp; hudDirty = true;
  banner('紫光入体', '灵台清明 · 气血尽复', 1.8); state = 'play'; ch1.flags.absorbed = true; giveItem('crystal'); saveGame();
  yield wait(1.4);
  W.circle.visible = true; sfx('ding'); shockRing(V3(JD.circle.x, 0, JD.circle.z), 0xc080ff, .3, 3, .6);
  yield say('林清风', '晶石既散，地上竟现出一座传送阵……走！');
  setObj('站上传送阵', { x: JD.circle.x, z: JD.circle.z }, 'jingdian');
  yield until(() => ch1.flags.tp);
  setObj(null); sfx('whoosh'); shockRing(V3(player.x, 0, player.z), 0xd0a0ff, .3, 3, .5);
  yield* fadeSwap(() => { player.jdTp = true; setCP('return'); goWorld('academy', { x: 0, z: -56.6, yaw: Math.PI }); L.world = 'academy'; showActor(L, 'academy', 1.6, -56.2, Math.PI); ch1.follow = true; showActor(A.master, 'academy', 3.8, -38.6, -Math.PI * .75, 'whisk'); }, '传送', '紫光一闪');
  toast('地图 · 七印镜殿传送点已解锁');
  yield say('林清风', '是图书馆……紫光之门外！我们回来了。');
  yield say('林清风', '此事非同小可，速去禀报师傅。');
};
SEG.return = function* () {
  const A = ch1.A; ch1.follow = true;
  setObj('走出图书馆，向师傅禀报', () => A.master, 'academy');
  yield until(() => world.name === 'academy' && Math.hypot(player.x - A.master.x, player.z - A.master.z) < 3.6);
  setObj(null); A.master.faceP = 1;
  yield say('你', '师傅，弟子有些事……必须亲自去做。');
  yield wait(1.2);
  yield say('青玄真人', '……你看到的东西，为师都知道。');
  yield say('青玄真人', '此去山高路远，单凭双脚，怕是走不到尽头。为师便传你一门本事。');
  A.master.pose = 'point';
  yield say('青玄真人', '剑修之剑，不止在手，亦在脚下。心神与剑相合，剑可载人，人可乘风。此乃御剑之术。');
  yield say('你', '弟子谨记。');
  A.master.pose = 'whisk'; player.rideOK = true; SK.ride.t = 0; hudDirty = true;
  showLearn('习得【御剑】', '底部中央 · 御剑飞行');
  setCP('rings');
  yield wait(1.4);
  ch1Hint('点击屏幕下方中央的<b>【御剑】</b>，踩剑飞行试试', 'btn-ride');
  setObj('试一试御剑', null, 'academy');
  yield until(() => player.riding);
  ch1HintOff(); yield wait(1.2);
};
SEG.rings = function* () {
  const A = ch1.A, W = worlds.academy, N = ACAD.flyRings.length; setCP('rings'); ch1.follow = true; player.rideOK = true;
  yield say('青玄真人', '御剑不难，难在收放自如。院中设下六道光环，你御剑一一穿过。');
  ch1.flags.ringI = 0; W.flyRings.forEach(r => r.visible = true);
  ch1Hint('<b>御剑</b>飞行，穿过金色光环；御剑时间耗尽可再次御剑', 'btn-ride'); ch1Timer(8, () => { if (ch1.cp === 'rings') ch1HintOff(); });
  setObj(`御剑穿过光环 0/${N}`, () => { const r = ACAD.flyRings[Math.min(ch1.flags.ringI, N - 1)]; return { x: r[0], z: r[1], height: 3 }; }, 'academy');
  yield until(() => ch1.flags.ringI >= N);
  ch1HintOff(); setObj(null); W.flyRings.forEach(r => r.visible = false);
  yield wait(.8);
  yield say('青玄真人', '……去吧。只是记住，御剑先御心，剑有灵，人亦有心。');
};
SEG.gate = function* () {
  ch1.follow = true;
  setObj('前往学院大门', { x: 0, z: 39 }, 'academy');
  yield until(() => world.name === 'academy' && player.z > 36.5 && Math.abs(player.x) < 5.5);
  setObj(null);
  yield* chapterEnd();
};
SEG.done = function* () {
  setObj('第一章已完成 · 第二章敬请期待', { x: 0, z: 39 }, 'academy');
  yield until(() => world.name === 'academy' && player.z > 37.2 && Math.abs(player.x) < 5.5 && gameT > 4);
  yield* chapterEnd();
};
function* chapterEnd() {
  state = 'cut'; resetInputs('end'); if (player.riding) endRide();
  const f = $('fade'); f.style.transition = 'opacity 1.2s'; f.style.opacity = 1; yield wait(1.3);
  yield* epilogue();
  setCP('done'); const ce = $('chend'); ce.style.display = 'flex'; yield wait(.2); $('chendtxt').style.opacity = 1; yield wait(1.2); $('chendsub').style.opacity = 1;
  ch1.ended = true; yield wait(4.2);
  if (!window.__noReload) toTitle();
}
function* chScript(from) { for (let i = Math.max(0, cpIdx(from)); i < CP_ORDER.length; i++) { const s = SEG[CP_ORDER[i]]; if (s) yield* s(); if (CP_ORDER[i] === 'gate' || CP_ORDER[i] === 'done') return; } }
/* ---------- start / resume ---------- */
function startCh1(cp) {
  if (!op.done) { op.done = true; clearTimeout(op.timer); $('opening').style.display = 'none'; }
  initAudio(); hideGuide(); tut.cur = null; $('skip').style.display = 'none';
  mode = 'ch1'; state = 'play'; clearFx(); clearProj(); resetSkills(); shixiong.holder.visible = false; zheng.holder.visible = false; enemies.length = 0;
  $('c').style.filter = ''; camDrop = 0; camRoll = 0; $('vign').style.opacity = 0; timeScale = 1; if (lostSword) { scene.remove(lostSword.g); lostSword = null; }
  recalc(); player.hp = player.maxHp; player.wine = player.wineMax; player.minHpFrac = 0; player.dead = false; player.lastHurt = -99;
  setOutfit(0x3c4a5e, 0x9aa8b8); $('avatar').textContent = '剑'; hudDirty = true;
  document.body.className = 'm-ch1'; for (const id of ['dead', 'win', 'story', 'chend']) $(id).style.display = 'none'; $('chendtxt').style.opacity = 0; $('chendsub').style.opacity = 0; ch1.ended = false; ch1.timers.length = 0;
  if (cp === 'done' && !CP_ORDER.includes(cp)) cp = 'intro';
  setupCP(cp); ch1.cp = cp; saveGame();
  $('fade').style.transition = 'opacity 1.2s'; $('fade').style.opacity = 1; requestAnimationFrame(() => requestAnimationFrame(() => $('fade').style.opacity = 0));
  banner(cp === 'intro' ? '第一章 · 学院' : '第一章 · ' + CP_CN[cp], cp === 'intro' ? '天剑学院' : '继续旅程', 2.6);
  runCo(chScript(cp));
}
function resumeCh1(d) {
  const ch = d.ch === 'cave' ? 'tunnel' : d.ch; let cp = d.stage === 'ch1' && CP_ORDER.includes(ch) ? ch : 'intro';
  if (d.stage !== 'ch1') { player.lv = 1; player.unlocked = []; player.rideOK = false; }
  startCh1(cp);
}
function ch1PlayerClamp() { const F = ch1.fight; if (F && F.ring) { const R = ACAD.ring, ox = player.x - R.x, oz = player.z - R.z, d = Math.hypot(ox, oz), mx = R.r - .6; if (d > mx) { player.x = R.x + ox / d * mx; player.z = R.z + oz / d * mx; } } }
/* ---------- per-frame ---------- */
function updateCh1(dt, dtR) {
  for (let i = ch1.timers.length - 1; i >= 0; i--) { const T = ch1.timers[i]; T.t -= dtR; if (T.t <= 0) { ch1.timers.splice(i, 1); T.fn(); } }
  if (ch1.wait && ch1.wait.t !== undefined) ch1.wait.t -= dtR;
  stepCo(); updateDlg(dtR);
  const A = ch1.A; if (!A) return;
  // actors (non-fighting) behaviour
  for (const k in A) {
    const a = A[k]; if (!a.shown || a.fighting) continue; // fighting actors are updated via the enemies loop
    a.holder.visible = a.world === world.name;
    if (a === A.lin && ch1.ally) { updateAlly(a, dt); animActor(a, dt); syncActor(a); continue; }
    if (a === A.lin && ch1.follow && !a.path) updateFollower(a, dt);
    else if (a.path) { if (a.leading) { const d = Math.hypot(player.x - a.x, player.z - a.z); if (d > 9) { a.moveAmt *= .9; faceActor(a, player.x, player.z, dt * 3); } else walkPath(a, dt); } else walkPath(a, dt); if (a.walkAway && Math.random() < .5) emit(a.x + rand(-.4, .4), rand(.2, 2), a.z + rand(-.4, .4), 0, .5, 0, 0x6a2a9a, .35, 1, 0); }
    else { a.moveAmt += (0 - a.moveAmt) * Math.min(1, dt * 6); if (!a.lie && (a.faceP || (ch1.talking && a.world === world.name && Math.hypot(player.x - a.x, player.z - a.z) < 9 && !a.fighting && a.pose !== 'kneel'))) faceActor(a, player.x, player.z, dt * 4); }
    if (a === A.lin && !player.riding) { a.float = false; a.rideSw.visible = false; }
    if (a.id === 'mohan' && a.shown && a.world === world.name && Math.random() < .35) emit(a.x + rand(-.5, .5), rand(.1, 2), a.z + rand(-.5, .5), 0, rand(.3, .9), 0, Math.random() < .4 ? 0x1a0828 : 0x8a40e0, rand(.25, .45), rand(.6, 1.1), 0);
    animActor(a, dt); syncActor(a);
  }
  if (A.mohan.walkAway && Math.hypot(A.mohan.x - player.x, A.mohan.z - player.z) > 26) hideActor(A.mohan);
  // camera toward speaker during dialogue
  if (state === 'talk') {
    const t = ch1.camT || ch1.lastSpeaker;
    if (t && t.shown && t.world === world.name) { const dx = t.x - player.x, dz = t.z - player.z, hy = actorY(t) + t.height * .92 - (camY), hd = Math.hypot(dx, dz); if (hd > .5) { player.yaw += angDiff(player.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 3.5); player.pitch = lerp(player.pitch, clamp(Math.atan2(hy, hd), -.5, .4), Math.min(1, dt * 3)); } }
    camera.fov = lerp(camera.fov, 60, Math.min(1, dt * 3)); camera.updateProjectionMatrix();
  }
  // hidden door (visible only while 隐身)
  if (world.name === 'academy') { const hd = world.hiddenDoor, op2 = world.hiddenMat; const want = player.stealthT > 0 ? 1 : 0; op2.opacity = lerp(op2.opacity, want, Math.min(1, dt * 6)); hd.visible = op2.opacity > .02; if (hd.visible && Math.random() < .5) emit(ACAD.hidden.x + rand(-1.2, 1.2), rand(.2, 3.4), ACAD.hidden.z + .2, 0, rand(.1, .5), rand(.1, .4), 0xc070ff, .3, .9, 0); if (ch1.cp === 'hidden' && player.stealthT > 0 && Math.hypot(player.x - ACAD.hidden.x, player.z - ACAD.hidden.z) < 1.5) ch1.flags.door = true; if (ch1.cp === 'hidden' && inLib() && SK.yinshen.t > 3) SK.yinshen.t = 3; }
  ch1Digong(dt, dtR);
  updateUse(); updateObj(dt); updateLabels();
  if (ch1.hl) { const el = $(ch1.hl), hl = $('hl'); if (el && state === 'play') { const r = el.getBoundingClientRect(), pad = 8; hl.style.display = 'block'; hl.style.left = (r.left - pad) + 'px'; hl.style.top = (r.top - pad) + 'px'; hl.style.width = (r.width + pad * 2) + 'px'; hl.style.height = (r.height + pad * 2) + 'px'; } else hl.style.display = 'none'; }
}
/* debug / test hooks */
Object.assign(window.__G, { closePage, FOE_LIN, setNight, ch1, startCh1, resumeCh1, setupCP, dlgTap, SEG, ACAD, DG, worlds, endFight, levelUp, CP_ORDER, useNow() { if (curUse && curUse.label !== '交谈') { curUse.fn(); return true; } return false; }, FOE_HEAVY, FOE_DART, FOE_MOHAN, FOE_GHOST, FOE_APPR, ZM_KB, JD, jdH, npcSolids, NPC_QUESTS, quest, hasItem, giveItem, takeItem });
Object.assign(window.__G, { tutForce() { completeStep(); }, skyTop() { return skyMat.uniforms.top.value.getHexString(); }, summon, demonPhantom, demonSky, startTutorial, phantomMat, get tutIdx() { return tut.i; } });
Object.defineProperties(window.__G, { appr: { get() { return ch1.appr || []; } }, curUse: { get() { return curUse; } }, world: { get() { return world; } } });
/* ================= v4.4 · 地图 (学院 / 地宫 two layers) + map teleports ================= */
const MAP = { open: false, tab: 'academy', hit: null };
const MAP_LOCK = ['intro', 'arena', 'duel1', 'duel2', 'duel3', 'ceremony', 'heart']; // story-locked checkpoints: no map teleport at all
const MAP_GATE = { x: 0, z: 34, yaw: 0 }; // inside the 山门 (kept short of the 下山 trigger at z>36.5)
(function buildMapUI() {
  const st = document.createElement('style');
  st.textContent = `#mapbtn{display:none;pointer-events:auto;margin-top:5px;font-size:13px;letter-spacing:2px;padding:5px 14px;border-radius:14px;background:rgba(20,14,30,.62);border:1px solid rgba(255,220,150,.6);color:#ffe6b0;font-family:var(--kai);min-width:62px;min-height:30px;-webkit-tap-highlight-color:transparent}
.m-ch1 #mapbtn{display:block}.m-ch1.talking #mapbtn{opacity:.35}
body.mapopen #hud,body.mapopen #labels,body.mapopen #btn-use{visibility:hidden}
#mapp{position:fixed;inset:0;z-index:80;display:none;background:rgba(8,5,14,.94);color:#eadff8;font-family:var(--kai);touch-action:none;box-sizing:border-box;padding:10px calc(12px + var(--sr)) 10px calc(12px + var(--sl))}
#mapp .wrap{display:flex;gap:12px;height:100%}
#mapcv{flex:1 1 auto;min-width:0;height:100%;background:#17111f;border:1px solid rgba(255,220,150,.35);border-radius:8px;touch-action:none}
#mapside{flex:0 0 200px;display:flex;flex-direction:column;gap:7px;min-height:0}
#mapside .tabs{display:flex;gap:6px}
#mapside button{font-family:inherit;-webkit-tap-highlight-color:transparent}
#mapside .tab{flex:1;padding:8px 0;font-size:15px;border-radius:8px;border:1px solid rgba(255,220,150,.4);background:rgba(255,255,255,.05);color:#e8dcc8}
#mapside .tab.on{background:rgba(255,200,110,.25);color:#fff1c8;border-color:#ffd77a}
#mapinfo{font-size:13px;line-height:1.55;color:#d8cce8;flex:1 1 auto;overflow:auto;min-height:0}
#mapinfo b{color:#ffe6b0;font-weight:normal}
#maptp{padding:9px 0;font-size:15px;border-radius:10px;border:1px solid #c890ff;background:rgba(150,80,255,.28);color:#f4e8ff}
#maptp:disabled{opacity:.5;border-color:#776;background:rgba(255,255,255,.05);color:#bbb}
#mapwhy{font-size:12px;color:#ffb8a8;min-height:15px;line-height:1.3}
#mapclose{padding:8px 0;font-size:15px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);color:#fff}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'mapbtn'; b.textContent = '地图'; $('tr').appendChild(b);
  const p = document.createElement('div'); p.id = 'mapp';
  p.innerHTML = '<div class="wrap"><canvas id="mapcv"></canvas><div id="mapside"><div class="tabs"><button class="tab" data-t="academy">学院</button><button class="tab" data-t="digong">地宫</button></div><div id="mapinfo"></div><div id="mapwhy"></div><button id="maptp">传送</button><button id="mapclose">关闭地图</button></div></div>';
  document.body.appendChild(p);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) { b.addEventListener(ev, e => e.stopPropagation(), { passive: true }); p.addEventListener(ev, e => e.stopPropagation(), { passive: true }); }
  onTap(b, () => openMap());
  onTap($('mapclose'), () => closeMap());
  p.querySelectorAll('.tab').forEach(t => onTap(t, () => { MAP.tab = t.dataset.t; drawMap(); }));
  onTap($('maptp'), () => mapTeleport(MAP.tab === 'academy' ? 'gate' : 'hall'));
  $('mapcv').addEventListener('pointerup', e => { const h = MAP.hit; if (!h) return; const r = e.target.getBoundingClientRect(); if (Math.hypot(e.clientX - r.left - h.x, e.clientY - r.top - h.y) < 30) mapTeleport('hall'); });
  addEventListener('keydown', e => { if (e.code === 'KeyM') { if (MAP.open) closeMap(); else openMap(); } else if (e.code === 'Escape' && MAP.open) closeMap(); });
  addEventListener('resize', () => { if (MAP.open) drawMap(); });
})();
function openMap() {
  if (mode !== 'ch1' || MAP.open) return false;
  if (state !== 'play') { if (state === 'talk' || state === 'cut') toast('剧情进行中'); return false; }
  MAP.open = true; state = 'map'; resetInputs('map'); MAP.tab = world.name === 'academy' ? 'academy' : 'digong';
  $('mapp').style.display = 'block'; document.body.classList.add('mapopen'); sfx('swish'); drawMap(); return true;
}
function closeMap() { if (!MAP.open) return; MAP.open = false; $('mapp').style.display = 'none'; document.body.classList.remove('mapopen'); if (state === 'map') state = 'play'; resetInputs('mapclose'); }
function mapTpReason(kind) {
  if (mode !== 'ch1') return '仅在第一章可用';
  if (world.name !== 'academy') return '地宫之中无法使用地图传送，只能借助传送阵';
  if (ch1.fight) return '战斗中无法传送';
  if (state !== 'play' && state !== 'map') return '剧情进行中，此刻无法传送';
  if (ch1.talking || ch1.anim || ch1.pfall || ch1.reading || ch1.ended || ch1.noMapTp || !ch1.obj || MAP_LOCK.includes(ch1.cp)) return '剧情进行中，此刻无法传送';
  if (kind === 'hall' && !player.jdTp) return '尚未解锁：需先经七印镜殿的传送阵返回地面';
  return null;
}
function mapTeleport(kind) {
  const why = mapTpReason(kind); if (why) { $('mapwhy').textContent = why; sfx('stone'); return false; }
  closeMap();
  if (kind === 'gate') tpFade(() => { goWorld('academy', MAP_GATE); }, ['天剑学院', '山门']);
  else tpFade(() => { ch1.jdVisit = true; goWorld('jingdian', JD.tp); worlds.jingdian.setState({ open: 1, placed: 1, absorbed: 1 }); }, ['七印镜殿', '传送阵旁']);
  ch1.mapTps = (ch1.mapTps || 0) + 1; return true;
}
function jdReturn() { tpFade(() => { ch1.jdVisit = false; goWorld('academy', { x: 0, z: -56.6, yaw: Math.PI }); }, ['图书馆', '紫光之门外']); }
function tpFade(fn, title) {
  state = 'cut'; resetInputs('tp'); if (player.riding) endRide(); const f = $('fade'); f.style.transition = 'opacity .45s'; f.style.opacity = 1; sfx('whoosh');
  ch1Timer(.5, () => { fn(); clearFx(); if (title) banner(title[0], title[1], 2); ch1Timer(.2, () => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; if (state === 'cut') state = ch1.talking ? 'talk' : 'play'; }); });
}
function drawMap() {
  const cv = $('mapcv'), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  document.querySelectorAll('#mapside .tab').forEach(t => t.classList.toggle('on', t.dataset.t === MAP.tab));
  MAP.hit = null; const where = { academy: '天剑学院', digong: '地宫', jingdian: world.name === 'jingdian' && player.z > 44 ? '地底甬道' : '七印镜殿' }[world.name] || '—';
  const lab = (t, x, y, col = '#f4e6c8', sz = 12) => { c.font = `${sz}px ${getComputedStyle(document.body).getPropertyValue('--kai') || 'serif'}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); };
  const arrow = (x, y, yaw, col) => { c.save(); c.translate(x, y); c.rotate(-yaw); c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.fill(); c.stroke(); c.restore(); };
  let tpName = '', why = '';
  if (MAP.tab === 'academy') {
    const B = worlds.academy.bounds, x0 = B.x0 - 2, x1 = B.x1 + 2, z0 = B.z0 - 2, z1 = B.z1 + 6, s = Math.min((W - 20) / (x1 - x0), (H - 20) / (z1 - z0)), ox = W / 2 - (x0 + x1) / 2 * s, oz = H / 2 - (z0 + z1) / 2 * s;
    const P = (x, z) => [ox + x * s, oz + z * s], R = (r, col, fill) => { const [a, b] = P(r[0], r[2]); c.fillStyle = fill; c.fillRect(a, b, (r[1] - r[0]) * s, (r[3] - r[2]) * s); c.strokeStyle = col; c.lineWidth = 1.5; c.strokeRect(a, b, (r[1] - r[0]) * s, (r[3] - r[2]) * s); };
    const Ci = (x, z, r, fill, stroke) => { const [a, b] = P(x, z); c.beginPath(); c.arc(a, b, r * s, 0, 6.283); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } };
    R([B.x0 - 1.2, B.x1 + 1.2, B.z0 - 1.2, B.z1 + 1.2], '#a89878', '#2a3326');
    { const [a, b] = P(B.x0, 16), [, b2] = P(0, 20); c.fillStyle = '#2f5f74'; c.fillRect(a, b, (B.x1 - B.x0) * s, b2 - b); }
    for (const p of ACAD.ponds) Ci(p.x, p.z, p.r, '#356f80');
    c.fillStyle = '#5a5648'; { const [a, b] = P(-3, -42), [a2, b2] = P(3, 42); c.fillRect(a, b, a2 - a, b2 - b); const [e, f] = P(-60, -3), [e2, f2] = P(60, 3); c.fillRect(e, f, e2 - e, f2 - f); }
    Ci(ACAD.square.x, ACAD.square.z, ACAD.square.r, '#6a6656', '#bfb38a'); Ci(ACAD.ling.x, ACAD.ling.z, 1.2, '#a8c8ff');
    Ci(ACAD.ring.x, ACAD.ring.z, ACAD.ring.r, '#5a4636', '#d0a060');
    for (const k of ['school', 'lib', 'pharm', 'dining', 'dorm']) { const r = ACAD[k]; R([r.x0, r.x1, r.z0, r.z1], '#d8c8a0', '#4a4038'); }
    R([-16.5, -10.5, 27, 33], '#c8b080', '#5a4a3a'); Ci(ACAD.bell.x, ACAD.bell.z, 3, '#6a4a3a', '#e0b070');
    { const [a, b] = P(-7, B.z1 + .6), [a2] = P(7, 0); c.fillStyle = '#a03a2a'; c.fillRect(a, b - 3, a2 - a, 6); }
    const L = [['大门 · 牌匾', 0, B.z1 + 4.2], ['大广场', ACAD.square.x, ACAD.square.z + 5.5], ['测灵石', 0, ACAD.ling.z - 2.2], ['钟楼', ACAD.bell.x, ACAD.bell.z + 5], ['学堂', -30, -38], ['图书馆', 0, -51], ['练武场', ACAD.ring.x, ACAD.ring.z], ['药房', 55, -36], ['食堂', -56, -34], ['居所', -56, -54], ['凉亭', -13.5, 30], ['溪流', 46, 18]];
    for (const [t, x, z] of L) { const [a, b] = P(x, z); lab(t, a, b, t === '溪流' ? '#9fd0e0' : '#f4e6c8', t === '大门 · 牌匾' ? 12 : 13); }
    if (world.name === 'academy') { const [a, b] = P(player.x, player.z); arrow(a, b, player.yaw, '#5fe8ff'); }
    tpName = '传送学院 · 山门'; why = mapTpReason('gate');
  } else {
    const seen = cpIdx(ch1.cp) >= cpIdx('digong'), deep = cpIdx(ch1.cp) >= cpIdx('tunnel') || player.jdTp;
    const half = W / 2;
    // left: 地宫 (x -12..12, z -16..59)
    { const x0 = -13, x1 = 13, z0 = -18, z1 = 60, s = Math.min((half - 24) / (x1 - x0), (H - 40) / (z1 - z0)), ox = half / 2, oz = 22 + (H - 40) / 2 - (z0 + z1) / 2 * s;
      const P = (x, z) => [ox + x * s, oz + z * s], R = (x0, x1, z0, z1, fill, col) => { const [a, b] = P(x0, z0); c.fillStyle = fill; c.fillRect(a, b, (x1 - x0) * s, (z1 - z0) * s); if (col) { c.strokeStyle = col; c.lineWidth = 1.2; c.strokeRect(a, b, (x1 - x0) * s, (z1 - z0) * s); } };
      lab('地宫', half / 2, 12, '#e0c8ff', 14);
      if (!seen) lab('（尚未探明）', half / 2, H / 2, '#8a7a9a', 13);
      else {
        R(-4.5, 4.5, 51, 58.6, '#3a3048', '#9a88b8'); R(-12, 12, 15, 51, '#3a3048', '#9a88b8'); R(-12, 12, 19, 45, '#0c0814'); if (cpIdx(ch1.cp) >= cpIdx('bridge')) R(-2.25, 2.25, 19, 45, '#6a5a80'); R(-10, 10, -16, 14, '#3a3048', '#9a88b8');
        R(-5, 5, 50.6, 51.4, '#c0a070'); R(-5, 5, 14.6, 15.4, '#c0a070'); R(-5, 5, 13.6, 14, '#b060ff'); const [ba, bb] = P(0, -12.6); c.fillStyle = '#c080ff'; c.beginPath(); c.arc(ba, bb, 3, 0, 6.283); c.fill();
        for (const [t, x, z] of [['入口', 0, 56], ['石门', 7.8, 51], ['断崖 · 石桥', 0, 32], ['紫色屏障', 0, 11.6], ['圣书密室', 0, -4]]) { const [a, b] = P(x, z); lab(t, a, b); }
        if (world.name === 'digong') { const [a, b] = P(player.x, player.z); arrow(a, b, player.yaw, '#5fe8ff'); }
      } }
    // right: 地底甬道 + 七印镜殿 (x -34..34, z -67..124)
    { const x0 = -36, x1 = 36, z0 = -68, z1 = 124, s = Math.min((half - 24) / (x1 - x0), (H - 40) / (z1 - z0)), ox = half + half / 2, oz = 22 + (H - 40) / 2 - (z0 + z1) / 2 * s;
      const P = (x, z) => [ox + x * s, oz + z * s];
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(half, 26); c.lineTo(half, H - 10); c.stroke();
      lab('七印镜殿', ox, 12, '#e0c8ff', 14);
      if (!deep) lab('（尚未探明）', ox, H / 2, '#8a7a9a', 13);
      else {
        c.fillStyle = '#3a3048'; for (const r of JD.rects) { const [a, b] = P(r[0], r[2]); c.fillRect(a, b, (r[1] - r[0]) * s, (r[3] - r[2]) * s); }
        { const [a, b] = P(-8, 22); c.fillStyle = '#4a4060'; c.fillRect(a, b, 16 * s, 22 * s); c.strokeStyle = 'rgba(200,170,255,.4)'; c.lineWidth = 1; for (let z = 23; z < 44; z += 3) { const [p1, q1] = P(-8, z), [p2] = P(8, z); c.beginPath(); c.moveTo(p1, q1); c.lineTo(p2, q1); c.stroke(); } }
        { const [a, b] = P(-8, 44.4); c.fillStyle = '#c0a070'; c.fillRect(a, b - 1.5, 16 * s, 3); }
        const [ex, ez] = P(0, JD.E.cz); c.beginPath(); c.ellipse(ex, ez, JD.E.ax * s, JD.E.az * s, 0, 0, 6.283); c.fillStyle = '#2e2440'; c.fill(); c.strokeStyle = '#b090e0'; c.lineWidth = 1.5; c.stroke();
        c.beginPath(); c.arc(ex, ez, 14 * s, 0, 6.283); c.strokeStyle = '#8a70c0'; c.stroke();
        const placed = cpIdx(ch1.cp) >= cpIdx('placed') || player.jdTp;
        JD.mirrors.forEach((m, k) => { const [a, b] = P(m.x, m.z), on = placed && JD.lit.includes(k); c.beginPath(); c.arc(a, b, on ? 4 : 3, 0, 6.283); c.fillStyle = on ? '#d090ff' : '#4a4058'; c.fill(); c.strokeStyle = on ? '#fff' : '#8a7a9a'; c.lineWidth = 1; c.stroke(); });
        for (const [t, x, z] of [['地底甬道', 6, 104], ['七印之门', 15, 45], ['石阶', 0, 33], ['书架', 0, -26]]) { const [a, b] = P(x, z); lab(t, a, b, '#f4e6c8', 11); }
        if (player.jdTp) { const [a, b] = P(JD.circle.x, JD.circle.z); const pulse = 7 + Math.sin(performance.now() / 200) * 1.5; c.beginPath(); c.arc(a, b, pulse, 0, 6.283); c.strokeStyle = '#e0b0ff'; c.lineWidth = 2.5; c.stroke(); c.beginPath(); c.arc(a, b, 3, 0, 6.283); c.fillStyle = '#e0b0ff'; c.fill(); lab('传送点', a, b + 15, '#f0d0ff', 12); MAP.hit = { x: a, y: b }; }
        if (world.name === 'jingdian') { const [a, b] = P(player.x, player.z); arrow(a, b, player.yaw, '#5fe8ff'); }
      } }
    tpName = '传送 · 七印镜殿'; why = mapTpReason('hall');
  }
  const pg = (player.pages || []).length, q = quest.cur;
  $('mapinfo').innerHTML = `所在：<b>${where}</b><br>书页：<b>${pg}/10</b>（每页气血上限 +10）` + (q ? `<br>进行中：<b>${q.title}</b>` : '') + (MAP.tab === 'digong' ? `<br><span style="color:#b8a8c8">地宫之中只能借助传送阵往来。</span>` : '');
  const btn = $('maptp'); btn.textContent = tpName; btn.disabled = !!why; $('mapwhy').textContent = why || '';
}
Object.assign(window.__G, { openMap, closeMap, mapTeleport, mapTpReason, jdReturn, MAP, drawMap });
/* ================= v4.5 · 背包 / 快捷栏 / 葫芦与酒 / 护身符 / 任务志 / 支线 / 剧情跳转 ================= */
/* ---- item table (var: read by recalc() before this file runs) ---- */
var ITEMS = {
  cutao: { cat: 'gourd', name: '粗陶葫芦', desc: '山下集市寻常之物，粗陶烧就。每战可饮一口。', drinks: 1 },
  zuixian: { cat: 'gourd', name: '醉仙葫芦', desc: '酒痴刘醉所赠。葫中别有洞天，每战可饮两口。', drinks: 2 },
  zhuo: { cat: 'wine', name: '浊酒', desc: '粗粮所酿，入口辛辣。每口恢复一成半气血。', heal: .15 },
  peiyuan: { cat: 'pill', name: '培元丹', desc: '白芷亲手所炼。服之固本培元，气血上限永增五十。', anytime: true, use() { player.hpBonus = (player.hpBonus || 0) + 50; recalc(); player.hp = Math.min(player.maxHp, player.hp + 50); hudDirty = true; return '气血上限 +50'; } },
  amulet: { cat: 'curio', name: '青玄护身符', desc: '青玄真人随身多年之物。每战一次，致命一击之下，留你一息。' },
  tome: { cat: 'special', name: '魔修圣书', desc: '密室祭台所得。书页泛紫，记太初剑之秘。' },
  crystal: { cat: 'special', name: '紫光晶石', desc: '已化入体内，灵台之中隐隐发烫。（已吸收）' },
  jade: { cat: 'special', name: '玉佩', desc: '湖中所得，温润生光，背面刻一“墨”字。' },
  herb_yue: { cat: 'special', name: '月见草', desc: '湖畔所采，叶上凝着夜露。' },
  herb_chi: { cat: 'special', name: '赤阳花', desc: '钟楼背阴处所采，花色如火。' },
  herb_qing: { cat: 'special', name: '青心兰', desc: '图书馆后墙石缝所采，幽香清冷。' },
};
const BAG_TABS = [['gourd', '葫芦'], ['wine', '酒'], ['pill', '丹药'], ['curio', '古玩'], ['special', '特殊']];
const JUMP_SLOT = 'jumptest';
const JUMP = { pending: false };
function invReset(tut) {
  player.inv = tut ? {} : { cutao: 1, zhuo: 1 }; player.eq = tut ? {} : { gourd: 'cutao', wine: 'zhuo', curio: null }; player.qs = [null, null, null, null];
  player.hpBonus = 0; player.jadeChoice = null; player.jadeTo = null; player.qcur = null; player.amuletUsed = false;
}
function invSaveData() { return { inv: { ...(player.inv || {}) }, eq: { ...(player.eq || {}) }, qs: (player.qs || []).slice(0, 4), hpBonus: player.hpBonus | 0, jadeChoice: player.jadeChoice || null, jadeTo: player.jadeTo || null, qcur: quest.cur ? { id: quest.cur.id, step: quest.step } : (player.qcur || null) }; }
function invLoad(d) {
  invReset(); const inv = d.inv && typeof d.inv === 'object' ? d.inv : null;
  if (inv) { player.inv = {}; for (const k in inv) if (ITEMS[k] && (inv[k] | 0) > 0) player.inv[k] = Math.min(99, inv[k] | 0); }
  if (!player.inv.cutao) player.inv.cutao = 1; if (!player.inv.zhuo) player.inv.zhuo = 1;
  const eq = d.eq || {}; for (const [slot, cat] of [['gourd', 'gourd'], ['wine', 'wine'], ['curio', 'curio']]) { const v = eq[slot]; player.eq[slot] = v && ITEMS[v] && ITEMS[v].cat === cat && player.inv[v] ? v : (slot === 'gourd' ? 'cutao' : slot === 'wine' ? 'zhuo' : null); }
  player.qs = [0, 1, 2, 3].map(i => { const v = Array.isArray(d.qs) ? d.qs[i] : null; return v && ITEMS[v] && ITEMS[v].cat === 'pill' ? v : null; });
  player.hpBonus = Math.max(0, Math.min(5000, d.hpBonus | 0)); player.jadeChoice = d.jadeChoice === 'mohan' || d.jadeChoice === 'master' ? d.jadeChoice : null; player.jadeTo = d.jadeTo === 'mohan' || d.jadeTo === 'master' ? d.jadeTo : null;
  player.qcur = d.qcur && typeof d.qcur.id === 'string' ? { id: d.qcur.id, step: d.qcur.step | 0 } : null;
  recalc(); player.wine = Math.min(player.wine, player.wineMax); refreshQS();
}
const invN = id => (player.inv && player.inv[id]) | 0;
function giveInv(id, n = 1, autoEq) {
  const it = ITEMS[id]; if (!it) return; if (!player.inv) invReset();
  if (it.cat === 'special') { giveItem(id); return; }
  player.inv[id] = Math.min(99, invN(id) + (it.cat === 'pill' ? n : 1)); if (it.cat !== 'pill') player.inv[id] = 1;
  if (autoEq && it.cat !== 'pill') equipItem(id, true);
  recalc(); hudDirty = true; refreshQS(); saveGame();
}
function equipItem(id, silent) {
  const it = ITEMS[id]; if (!it || !invN(id)) return false; const slot = it.cat === 'gourd' ? 'gourd' : it.cat === 'wine' ? 'wine' : it.cat === 'curio' ? 'curio' : null; if (!slot) return false;
  if (!silent && ch1.fight && slot !== 'curio') { toast('战斗之中，不可更换'); return false; }
  player.eq[slot] = id; const wasFull = player.wine >= player.wineMax; recalc(); if (slot === 'gourd' && !ch1.fight && wasFull) player.wine = player.wineMax; player.wine = Math.min(player.wine, player.wineMax);
  hudDirty = true; saveGame(); if (!silent) { toast(`已装备【${it.name}】`); sfx('ding'); } return true;
}
function wineHeal() { const w = player.eq && ITEMS[player.eq.wine]; return w && w.heal ? w.heal : TUNE.wineFrac; }
function canUsePill(id) { const it = ITEMS[id]; if (!it || it.cat !== 'pill') return '不可服用'; if (!invN(id)) return '已用尽'; if (!it.anytime && !ch1.fight) return '仅可于战斗中服用'; if (player.dead) return '不可服用'; return null; }
function usePill(id) {
  const why = canUsePill(id); if (why) { toast(why); return false; }
  const it = ITEMS[id], msg = it.use(); player.inv[id] = invN(id) - 1; if (player.inv[id] <= 0) delete player.inv[id];
  sfx('level'); burst(ppos(), 24, 0xffe08a, 3, .35, .8, 1); screenNum(msg || it.name, 'heal', innerWidth * .5 - 30, innerHeight * .45); toast(`服下【${it.name}】· ${msg}`);
  refreshQS(); hudDirty = true; saveGame(); return true;
}
/* ---- 青玄护身符: once per fight / encounter, a lethal hit leaves 1 气血 ---- */
function amuletSave() {
  if (mode !== 'ch1' || player.tutChar || !player.eq || player.eq.curio !== 'amulet' || player.amuletUsed || player.minHpFrac > 0) return false;
  player.amuletUsed = true; player.hp = 1; hudDirty = true; ch1.amuletSaves = (ch1.amuletSaves || 0) + 1;
  const el = $('amufx'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  flashScreen('#ffe7a0', .5, .9); sfx('shield'); shake = Math.max(shake, .3); swordGlow = 1.2;
  shockRing(V3(player.x, H(player.x, player.z), player.z), 0xffd36a, .3, 4.5, .8);
  for (let i = 0; i < 46; i++) { const a = rand(0, 6.28), r = rand(.5, 1.6); emit(player.x + Math.cos(a) * r, rand(.2, 2.2), player.z + Math.sin(a) * r, 0, rand(1, 3), 0, i % 2 ? 0xffd36a : 0xfff6d0, rand(.25, .45), rand(.7, 1.2), 0); }
  return true;
}
/* ---- state auto-fill for a checkpoint (resume / 剧情跳转 / old saves) ---- */
function ensureState(cp) {
  if (!player.inv) invReset();
  const i = cpIdx(cp);
  if (i > cpIdx('lingen') && !invN('amulet')) { player.inv.amulet = 1; if (!player.eq.curio) player.eq.curio = 'amulet'; }
  if (i > cpIdx('shield') && !hasSt('hudun')) player.unlocked.push('hudun');
  if (i > cpIdx('placed')) giveItem('crystal'); else takeItem('crystal');
  if (cp !== 'day3') { for (const h of ['herb_yue', 'herb_chi', 'herb_qing', 'jade']) takeItem(h); player.qcur = null; player.jadeTo = null; }
  recalc();
}
/* ---------------- academy decor: 刘醉's camp, 灵草, 湖中玉 ---------------- */
const HERBS = { herb_yue: { x: 19.4, z: 30.6, col: 0xe8f0ff, glow: 0xb8d8ff }, herb_chi: { x: -28.7, z: 11.4, col: 0xff5a3a, glow: 0xffa060 }, herb_qing: { x: 6, z: -61.9, col: 0x6ae0c0, glow: 0x80ffe0 } };
const JADE = { x: -21.6, z: 30 };
const DECOR = (() => {
  const W = worlds.academy, g = new THREE.Group(); W.group.add(g);
  const L = [], vm = new THREE.MeshLambertMaterial({ vertexColors: true });
  // 刘醉's tree + blanket + gourds
  const T = { x: LIU_T().x, z: LIU_T().z };
  L.push([G.cyl, 0x6a4a2e, M4(T.x, 1.6, T.z, .38, 3.2, .38)]); L.push([G.cyl, 0x5a3e26, M4(T.x + .5, 2.9, T.z - .2, .14, 1.6, .14, 0, 0, -.7)]);
  for (const [dx, dy, dz, s] of [[0, 4.2, 0, 2.6], [1.3, 3.7, .6, 1.8], [-1.2, 3.8, -.5, 1.9], [.3, 5.1, -.4, 1.7], [-.4, 3.6, 1.3, 1.6]]) L.push([G.sph, 0x4f8a3e, M4(T.x + dx, dy, T.z + dz, s, s * .8, s)]);
  const B = LIU_POS(), c = Math.cos(B.yaw), s2 = Math.sin(B.yaw);
  L.push([G.box, 0xa83a3a, M4(B.x, .03, B.z, 1.5, .05, 2.4, B.yaw)]); L.push([G.box, 0xe8c070, M4(B.x, .035, B.z, 1.1, .052, 2.0, B.yaw)]);
  let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 13; k++) { const a = k / 13 * Math.PI * 2 + rr() * .3, r = 1.6 + rr() * .9, x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r, sc = .7 + rr() * .5, tip = rr() < .35;
    const col = [0xc89a50, 0xa87838, 0xd8b070, 0x8a6a3a][k % 4];
    if (tip) { L.push([G.sph, col, M4(x, .2 * sc, z, .22 * sc, .2 * sc, .3 * sc, 0, a)]); L.push([G.sph, col, M4(x + Math.cos(a) * .3 * sc, .14 * sc, z + Math.sin(a) * .3 * sc, .14 * sc, .13 * sc, .14 * sc)]); }
    else { L.push([G.sph, col, M4(x, .22 * sc, z, .22 * sc, .22 * sc, .22 * sc)]); L.push([G.sph, col, M4(x, .5 * sc, z, .14 * sc, .14 * sc, .14 * sc)]); L.push([G.cyl, 0x8a2a2a, M4(x, .62 * sc, z, .04 * sc, .06 * sc, .04 * sc)]); L.push([G.cyl, 0x6a4028, M4(x, .68 * sc, z, .03 * sc, .08 * sc, .03 * sc)]); } }
  L.push([G.sph, 0xd8b070, M4(B.x + c * .75, .24, B.z - s2 * .75, .26, .26, .26)]); // one by his hand
  const decor = new THREE.Mesh(mergeColored(L), vm); g.add(decor);
  W.cols.push({ x: T.x, z: T.z, r: .75 }, { x: B.x, z: B.z, r: 1.05 });
  // 灵草 (glowing herbs) + 湖中玉
  const herbs = {}; const stemM = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });
  for (const k in HERBS) { const h = HERBS[k], hg = new THREE.Group(); hg.position.set(h.x, 0, h.z); hg.visible = false; g.add(hg);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; const st = mk(G.cyl, stemM, hg, Math.cos(a) * .12, .22, Math.sin(a) * .12, .025, .44, .025); st.rotation.z = Math.cos(a) * .3; st.rotation.x = Math.sin(a) * .3; }
    for (let i = 0; i < 3; i++) mk(G.sph, new THREE.MeshBasicMaterial({ color: h.col }), hg, Math.cos(i * 2.1) * .14, .5 + i * .04, Math.sin(i * 2.1) * .14, .08, .06, .08);
    const gl = mk(G.sph, auraMat(h.glow, 1.6, 1.4), hg, 0, .5, 0, .55, .55, .55); const ring = mk(ringGeo, addMat(h.glow, .55), hg, 0, .04, 0, .6, .6, .6); ring.rotation.x = -Math.PI / 2;
    herbs[k] = { g: hg, gl, ring }; }
  const jg = new THREE.Group(); jg.position.set(JADE.x, 0, JADE.z); jg.visible = false; g.add(jg);
  mk(G.sph, new THREE.MeshBasicMaterial({ color: 0xc8ffe8 }), jg, 0, .06, 0, .12, .04, .09); const jgl = mk(G.sph, auraMat(0x80ffd0, 1.8, 1.5), jg, 0, .1, 0, .6, .25, .6);
  const jr = mk(ringGeo, addMat(0x9fffe0, .6), jg, 0, .05, 0, .8, .8, .8); jr.rotation.x = -Math.PI / 2;
  return { g, herbs, jade: { g: jg, gl: jgl, ring: jr } };
})();
function LIU_POS() { return { x: 57.5, z: 33.5, yaw: -2.3 }; }
function LIU_T() { return { x: 60.4, z: 36.6 }; }
function herbActive(k) { return quest.cur && quest.cur.id === 'herbs' && quest.step === 0 && !hasItem(k) && world.name === 'academy'; }
function jadeActive() { return quest.cur && quest.cur.id === 'jade' && quest.step === 0 && !hasItem('jade'); }
function ch1Decor(dt) {
  for (const k in DECOR.herbs) { const h = DECOR.herbs[k], v = !!herbActive(k); h.g.visible = v; if (v) { h.gl.scale.setScalar(.5 + Math.sin(gameT * 3 + h.g.position.x) * .08); h.ring.scale.setScalar(.6 + (gameT * .6 % 1) * .6); h.ring.material.opacity = .6 * (1 - gameT * .6 % 1); if (Math.random() < .2) emit(h.g.position.x + rand(-.3, .3), rand(.3, 1), h.g.position.z + rand(-.3, .3), 0, .6, 0, HERBS[k].glow, .16, .9, 0); } }
  const J = DECOR.jade, jv = !!jadeActive(); J.g.visible = jv; if (jv) { J.gl.scale.set(.6 + Math.sin(gameT * 2.4) * .1, .25, .6 + Math.sin(gameT * 2.4) * .1); J.ring.scale.setScalar(.7 + (gameT * .5 % 1) * .9); J.ring.material.opacity = .6 * (1 - gameT * .5 % 1); if (Math.random() < .15) emit(JADE.x + rand(-.3, .3), .1, JADE.z + rand(-.3, .3), 0, .5, 0, 0x9fffe0, .14, .9, 0); }
}
function addUsesV45() {
  for (const k in HERBS) { const h = HERBS[k]; addUse({ world: 'academy', x: h.x, z: h.z, r: 2.2, label: '采摘', cond: () => herbActive(k) && !player.riding, fn: () => pickHerb(k) }); }
  addUse({ world: 'academy', x: JADE.x, z: JADE.z, r: 2.3, label: '打捞', cond: () => jadeActive() && !player.riding, fn: () => { giveItem('jade'); sfx('ding'); burst(V3(JADE.x, .3, JADE.z), 24, 0x9fffe0, 3, .3, .7, 0); saveGame(); } });
}
function pickHerb(k) {
  giveItem(k); sfx('ding'); const h = HERBS[k]; burst(V3(h.x, .5, h.z), 24, h.glow, 3, .3, .7, 0); saveGame();
  toast(`采得【${ITEMS[k].name}】`); if (k === 'herb_qing') ch1.sayQ.push([null, '石缝深处，似有紫光一闪而逝。']);
}
const herbN = () => ['herb_yue', 'herb_chi', 'herb_qing'].filter(hasItem).length;
/* ---------------- side quests (data) ---------------- */
NPC_QUESTS.push(
  { id: 'zuili', giver: 'liu', cps: ['day3'], title: '醉里乾坤', giverName: '刘醉', hint: '学院东北角树下，一位醉卧的师兄',
    offer: [['刘醉', '……嗝。又来个愣头青。坐，坐。'], ['刘醉', '你可知，剑修为何要饮酒？'], ['你', '弟子不知。'], ['刘醉', '剑太利，人便太紧。紧则易折。一口酒下去，心松了，剑才活。'], ['刘醉', '这只葫芦随我多年，装得下两口好酒。拿去，莫学我——醉了，便醒不过来。']],
    steps: [], summary: '刘醉赠你醉仙葫芦。',
    *reward() { giveInv('zuixian', 1, false); showLearn('获得【醉仙葫芦】', '葫芦 · 每战可饮两口'); yield wait(1.4); const v = yield* chooseCo('是否装备【醉仙葫芦】？', [['装备', 1], ['暂不', 0]]); if (v) equipItem('zuixian'); } },
  { id: 'herbs', giver: 'pharm', cps: ['day3'], title: '三味灵草', giverName: '白芷', hint: '药房的药师白芷似有难处',
    offer: [['白芷', '这位师弟，可否帮个忙？大比在即，弟子们伤药用得紧，药房缺了三味灵草。'], ['白芷', '月见草长在湖边，赤阳花开在钟楼背阴处，还有一株青心兰，只在图书馆后墙的石缝里才有。'], ['你', '弟子去去便回。']],
    steps: [
      { text: () => `采集三味灵草 ${herbN()}/3`, cond: () => herbN() >= 3, target: () => { let b = null, bd = 1e9; for (const k in HERBS) if (!hasItem(k)) { const h = HERBS[k], d = Math.hypot(h.x - player.x, h.z - player.z); if (d < bd) { bd = d; b = h; } } return b; } },
      { text: '回药房，将灵草交给白芷', talk: 'pharm', done: [['白芷', '一株不差，好眼力。'], ['白芷', '这颗培元丹是我亲手所炼，服下可固本培元。大比之上，莫要辜负。']], after() { for (const k in HERBS) takeItem(k); } },
    ], summary: '白芷赠你培元丹一颗。',
    *reward() { giveInv('peiyuan', 1); if (!player.qs.some(Boolean)) { player.qs[0] = 'peiyuan'; refreshQS(); } showLearn('获得【培元丹】×1', '丹药 · 可于背包或快捷栏服用'); yield wait(1.2); } },
  { id: 'jade', giver: 'stone', cps: ['day3'], title: '湖中玉', giverName: '小石头', hint: '西湖凉亭旁，小石头愁眉苦脸',
    offer: [['小石头', '师兄，前日我在湖边拾得一块会发光的玉佩，一失手又掉回水里了……能帮我捞上来吗？'], ['你', '在何处落水？'], ['小石头', '就在湖东岸浅处，夜里还会发光呢。']],
    steps: [
      { text: '打捞湖中玉佩', cond: () => hasItem('jade'), target: JADE, done: [[null, '玉佩温润，背面刻着一个‘墨’字。']] },
      { choice: { prompt: '玉佩背刻“墨”字。当归何人？', opts: [['还给墨寒', 'mohan'], ['交给师傅', 'master']], pick(v) { player.jadeTo = v; } } },
      { text: () => player.jadeTo === 'master' ? '将玉佩交给师傅' : '将玉佩还给墨寒', talk: () => player.jadeTo || 'mohan',
        done: () => player.jadeTo === 'master' ? [['青玄真人', '……'], ['青玄真人', '此物，你就当没见过。']] : [['墨寒', '……哪来的？'], ['你', '湖里捞的。'], ['墨寒', '……多事。']],
        after() { takeItem('jade'); player.jadeChoice = player.jadeTo || 'mohan'; const A = ch1.A; if (player.jadeChoice === 'mohan') { A.mohan.faceP = 0; A.mohan.path = [[44, -26], [52, -10]]; A.mohan.speed = 2.6; A.mohan.walkAway = true; } else { A.master.pose = 'whisk'; } } },
    ], summary: () => player.jadeChoice === 'master' ? '玉佩交予师傅。师傅：「此物，你就当没见过。」' : '玉佩还给了墨寒。他收下，未发一言讥讽。' },
);
/* ---------------- choice prompt (coroutine) ---------------- */
const CHO = { v: undefined };
function* chooseCo(prompt, opts) {
  const el = $('choice'); el.querySelector('.cq').textContent = prompt; const box = el.querySelector('.co'); box.innerHTML = '';
  CHO.v = undefined; CHO.opts = opts;
  opts.forEach(([label, v], i) => { const b = document.createElement('button'); b.textContent = label; b.dataset.i = i; box.appendChild(b); onTap(b, () => { CHO.v = v; }); });
  const prev = state; state = 'cut'; resetInputs('choice'); el.style.display = 'flex';
  yield until(() => CHO.v !== undefined);
  el.style.display = 'none'; if (state === 'cut') state = 'play'; sfx('ding'); return CHO.v;
}
/* ---------------- main-line quest log (data) ---------------- */
const MAIN_QUESTS = [
  { name: '初醒', cps: ['intro', 'lingen'], desc: '醒来见过师傅，往大广场测灵根。' },
  { name: '同门', cps: ['school', 'shield'], desc: '学堂前见过两位师兄，入学堂听师傅授神通。' },
  { name: '三日修行', cps: ['day1', 'day2', 'day3', 'night'], desc: '习剑、切磋、闲暇，三日修行。' },
  { name: '大比', cps: ['arena', 'duel1', 'duel2', 'duel3', 'ceremony'], desc: '学院大比，三战夺魁。' },
  { name: '禁阁', cps: ['heart', 'library', 'hidden'], desc: '凉亭谈心，入图书馆禁阁，寻无形之门。' },
  { name: '地宫', cps: ['digong', 'chasm', 'bridge', 'chamber', 'phantom'], desc: '破地宫机关，过石桥，入密室，斗魔修虚影。' },
  { name: '七印镜殿', cps: ['tunnel', 'door', 'hall', 'placed'], desc: '随紫光穿行甬道，启七印巨门，归书镜殿。' },
  { name: '御剑', cps: ['return', 'rings'], desc: '回禀师傅，习御剑之术，穿六道光环。' },
  { name: '下山', cps: ['gate'], desc: '前往学院大门。' },
];
function mainStatus(q) { const c = ch1.cp === 'done' ? 1e9 : cpIdx(ch1.cp), a = cpIdx(q.cps[0]), b = cpIdx(q.cps[q.cps.length - 1]); return c > b ? 'done' : c >= a ? 'active' : 'todo'; }
function sideStatus(q) {
  if ((player.quests || []).includes(q.id)) return 'done';
  if ((quest.cur && quest.cur.id === q.id) || (player.qcur && player.qcur.id === q.id)) return 'active';
  const c = ch1.cp === 'done' ? 1e9 : cpIdx(ch1.cp), last = Math.max(...(q.cps || ['done']).map(cpIdx));
  if (q.cps && q.cps.includes(ch1.cp)) return 'avail';
  return c > last ? 'missed' : 'todo';
}
function questLogData() {
  const main = MAIN_QUESTS.map(q => { const st = mainStatus(q); let obj = q.desc; if (st === 'active') { const o = ch1.obj && ch1.obj.text; obj = o && !ch1.qText && !o.startsWith('【') ? o : (CP_CN[ch1.cp] ? '当前：' + CP_CN[ch1.cp] : q.desc); } return { name: q.name, st, obj }; }).filter(q => q.st !== 'todo');
  const side = NPC_QUESTS.filter(q => q.title).map(q => { const st = sideStatus(q); let obj = '';
    if (st === 'active') { const s = quest.cur && quest.cur.id === q.id ? q.steps[quest.step] : null; obj = s ? (s.choice ? s.choice.prompt : qval(s.text)) : '续前事'; }
    else if (st === 'avail') obj = '可接取 · ' + (q.hint || ('寻' + (q.giverName || ''))); else if (st === 'done') obj = qval(q.summary) || '已完成'; else if (st === 'missed') obj = '已错过';
    return { name: q.title, st, obj }; }).filter(q => q.st !== 'todo');
  if (cpIdx(ch1.cp) >= cpIdx('day3') || (player.pages || []).length) { const n = (player.pages || []).length; side.push({ name: '散落的书页', st: n >= 10 ? 'done' : 'active', obj: `已集 ${n}/10（可选）· 每页气血上限 +10` }); }
  return { main, side };
}
const JUMP_NODES = [
  ['开场 / 教程', null], ['醒来见师傅', 'intro'], ['测灵根', 'lingen'], ['学堂见师兄', 'school'], ['护盾课', 'shield'], ['第一日 · 习剑', 'day1'], ['第二日 · 对练', 'day2'], ['第三日 · 闲逛', 'day3'], ['第三日 · 夜', 'night'],
  ['大比 · 第一场', 'duel1'], ['大比 · 第二场', 'duel2'], ['大比 · 决赛', 'duel3'], ['颁奖', 'ceremony'], ['凉亭谈心', 'heart'], ['图书馆禁阁', 'library'], ['无形之门', 'hidden'],
  ['地宫 · 第一道石门', 'digong'], ['地宫 · 悬崖', 'chasm'], ['地宫 · 石桥', 'bridge'], ['屏障 / 密室', 'chamber'], ['魔修虚影', 'phantom'], ['地底甬道', 'tunnel'], ['七印之门', 'door'], ['七印镜殿', 'hall'], ['归书之后', 'placed'],
  ['回程', 'return'], ['御剑', 'return', { pos: { x: 3.6, z: -35.2, yaw: Math.PI } }], ['圆环', 'rings'], ['尾声', 'gate', { pos: { x: 0, z: 35.6, yaw: Math.PI } }],
];
/* ---------------- UI: bag button + 4 quick slots, panels, quest log, choice, jump ---------------- */
(function buildV45UI() {
  const st = document.createElement('style');
  st.textContent = `#bagbar{display:none}.m-ch1 #bagbar{display:block}
#bagbar .bb{position:absolute;box-sizing:border-box;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-direction:column;touch-action:none;-webkit-tap-highlight-color:transparent;font-family:var(--kai);color:#ffe6b0;background:rgba(20,14,30,.6);border:1.5px solid rgba(255,220,150,.6);pointer-events:auto;user-select:none;-webkit-user-select:none}
#bagbar .bb.qs{border-style:dashed;border-color:rgba(255,220,150,.38);color:#d8f0d0}
#bagbar .bb.qs.has{border-style:solid;border-color:rgba(160,240,170,.7);background:rgba(20,40,26,.62)}
#bagbar .bb.qs.empty{opacity:.45;filter:grayscale(1)}
#bagbar .bb b{font-weight:normal;line-height:1}#bagbar .bb i{font-style:normal;position:absolute;right:3px;bottom:1px;font-size:calc(11px*var(--u));color:#fff}
#bagbar .bb.down{transform:scale(.92)}
#trbtns{display:none;gap:6px;margin-top:5px;pointer-events:auto}.m-ch1 #trbtns{display:flex}.m-ch1.talking #trbtns{opacity:.35}
#trbtns #mapbtn{margin-top:0}
#qbtn{pointer-events:auto;font-size:13px;letter-spacing:2px;padding:5px 14px;border-radius:14px;background:rgba(20,14,30,.62);border:1px solid rgba(255,220,150,.6);color:#ffe6b0;font-family:var(--kai);min-width:62px;min-height:30px;-webkit-tap-highlight-color:transparent}
#qbtn.new{box-shadow:0 0 10px rgba(255,210,120,.9)}
body.panelopen #hud,body.panelopen #labels,body.panelopen #btn-use{visibility:hidden}
.v45p{position:fixed;inset:0;z-index:80;display:none;background:rgba(8,5,14,.95);color:#eadff8;font-family:var(--kai);touch-action:none;box-sizing:border-box;padding:10px calc(12px + var(--sr)) 10px calc(12px + var(--sl))}
.v45p .wrap{display:flex;gap:12px;height:100%}
.v45p button{font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.v45p .close{padding:8px 0;font-size:15px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.08);color:#fff}
#bagp .tabs{display:flex;flex-direction:column;gap:6px;flex:0 0 72px}
#bagp .tab{padding:9px 0;font-size:15px;border-radius:8px;border:1px solid rgba(255,220,150,.4);background:rgba(255,255,255,.05);color:#e8dcc8}
#bagp .tab.on{background:rgba(255,200,110,.25);color:#fff1c8;border-color:#ffd77a}
#baglist{flex:1 1 auto;min-width:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:7px;align-content:start;padding:2px}
.bitem{border:1px solid rgba(255,220,150,.3);border-radius:8px;padding:7px 9px;background:rgba(255,255,255,.04);min-height:44px;box-sizing:border-box}
.bitem.on{border-color:#ffd77a;background:rgba(255,200,110,.16)}.bitem b{font-weight:normal;color:#ffe6b0;font-size:15px}.bitem em{font-style:normal;font-size:11px;color:#9fe0a0;margin-left:6px}.bitem small{display:block;font-size:11px;color:#b8acc8;margin-top:2px}
#bagside{flex:0 0 200px;display:flex;flex-direction:column;gap:7px;min-height:0}
#bagdet{flex:1 1 auto;overflow:auto;font-size:13px;line-height:1.6;color:#d8cce8;border:1px solid rgba(255,220,150,.2);border-radius:8px;padding:8px}
#bagdet h4{margin:0 0 4px;font-weight:normal;color:#ffe6b0;font-size:17px}
#bagact{display:flex;flex-wrap:wrap;gap:6px}#bagact button{flex:1 1 40%;padding:8px 0;font-size:14px;border-radius:9px;border:1px solid #ffd77a;background:rgba(255,200,110,.2);color:#fff1c8}
#bagact button:disabled{opacity:.45;border-color:#776;background:rgba(255,255,255,.04);color:#bbb}
#bagmsg{font-size:12px;color:#ffb8a8;min-height:15px}
#qlogp .col{flex:1 1 0;min-width:0;overflow:auto;border:1px solid rgba(255,220,150,.22);border-radius:8px;padding:8px 10px}
#qlogp h3{margin:0 0 6px;font-weight:normal;color:#ffe6b0;font-size:16px;letter-spacing:3px}
#qlogp .ql{padding:5px 0 6px;border-bottom:1px dashed rgba(255,255,255,.1)}#qlogp .ql b{font-weight:normal;font-size:15px;color:#fff1c8}#qlogp .ql small{display:block;font-size:12px;color:#d0c4e0;margin-top:2px;line-height:1.45}
#qlogp .ql.active b:before{content:'◆ ';color:#ffd36a}#qlogp .ql.avail b:before{content:'◇ ';color:#9fe0a0}
#qlogp .ql.done,#qlogp .ql.missed{opacity:.42}#qlogp .ql.done small,#qlogp .ql.missed small{display:none}#qlogp .ql.done b:after{content:' · 已完成';font-size:11px}#qlogp .ql.missed b:after{content:' · 已错过';font-size:11px}
#qlogp .hdr{font-size:13px;color:#c8b8e0;letter-spacing:4px;margin-bottom:6px}
#qside{flex:0 0 150px;display:flex;flex-direction:column;gap:8px;justify-content:flex-end}
#choice{position:fixed;inset:0;z-index:85;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(6,4,12,.55);font-family:var(--kai)}
#choice .cq{font-size:19px;color:#fff1c8;text-shadow:0 2px 4px #000;padding:0 20px;text-align:center}
#choice .co{display:flex;gap:16px}#choice .co button{font-family:inherit;font-size:17px;letter-spacing:3px;padding:10px 26px;border-radius:22px;border:2px solid #f3d27a;background:linear-gradient(180deg,#b8862a,#6f4a12);color:#fff;touch-action:manipulation}
#amufx{position:fixed;left:50%;top:34%;z-index:60;pointer-events:none;transform:translate(-50%,-50%);font-family:var(--kai);font-size:38px;letter-spacing:8px;color:#fff3c0;text-shadow:0 0 18px #ffb020,0 0 5px #fff,0 2px 4px #000;opacity:0;white-space:nowrap}
#amufx.show{animation:amu 1.6s ease-out forwards}@keyframes amu{0%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}
#jumpbtn{touch-action:manipulation;-webkit-tap-highlight-color:transparent;margin-top:14px;margin-left:12px;font-size:17px;padding:9px 22px;border-radius:30px;border:2px solid #b89ae8;background:linear-gradient(180deg,#5a4682,#2a2040);color:#fff;font-family:inherit;letter-spacing:3px}
#jumpp .hd{display:flex;align-items:center;gap:10px;margin-bottom:6px}#jumpp .hd b{font-weight:normal;font-size:18px;color:#fff1c8;letter-spacing:3px}#jumpp .hd small{flex:1;font-size:12px;color:#b8acc8}
#jumplist{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px;overflow:auto;max-height:calc(100% - 44px);align-content:start}
#jumplist button{padding:9px 4px;font-size:14px;border-radius:9px;border:1px solid rgba(255,220,150,.45);background:rgba(255,255,255,.06);color:#f4e8d0}
#jumplist button i{display:block;font-style:normal;font-size:10px;color:#a898c0}
#jumpp .close{padding:6px 18px}`;
  document.head.appendChild(st);
  const stop = el => { for (const ev of ['pointerdown', 'touchstart', 'mousedown']) el.addEventListener(ev, e => e.stopPropagation(), { passive: true }); };
  // top-right: [任务][地图]
  const row = document.createElement('div'); row.id = 'trbtns'; $('tr').appendChild(row);
  const qb = document.createElement('button'); qb.id = 'qbtn'; qb.textContent = '任务'; row.appendChild(qb); row.appendChild($('mapbtn')); stop(row);
  onTap(qb, () => openPanel('qlog'));
  // bottom-left: 背包 + 4 quick slots
  const bar = document.createElement('div'); bar.id = 'bagbar'; $('hud').appendChild(bar);
  const bag = document.createElement('div'); bag.className = 'bb'; bag.id = 'bagbtn'; bag.innerHTML = '<b>背包</b>'; bar.appendChild(bag);
  for (let i = 0; i < 4; i++) { const q = document.createElement('div'); q.className = 'bb qs'; q.id = 'qs' + i; q.dataset.i = i; q.innerHTML = '<b></b><i></i>'; bar.appendChild(q); }
  for (const el of bar.children) { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); }, { passive: false }); const up = () => el.classList.remove('down'); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); }
  onTap(bag, () => openPanel('bag'));
  for (let i = 0; i < 4; i++) onTap($('qs' + i), () => quickUse(i));
  // panels
  const bp = document.createElement('div'); bp.id = 'bagp'; bp.className = 'v45p';
  bp.innerHTML = '<div class="wrap"><div class="tabs">' + BAG_TABS.map(([k, n]) => `<button class="tab" data-t="${k}">${n}</button>`).join('') + '</div><div id="baglist"></div><div id="bagside"><div id="bagdet"></div><div id="bagmsg"></div><div id="bagact"></div><button class="close" id="bagclose">关闭背包</button></div></div>';
  document.body.appendChild(bp); stop(bp);
  bp.querySelectorAll('.tab').forEach(t => onTap(t, () => { BAG.tab = t.dataset.t; BAG.sel = null; drawBag(); }));
  onTap($('baglist'), e => { const it = e.target.closest && e.target.closest('.bitem'); if (!it) return; BAG.sel = it.dataset.id; drawBag(); });
  onTap($('bagclose'), () => closePanel());
  const qp = document.createElement('div'); qp.id = 'qlogp'; qp.className = 'v45p';
  qp.innerHTML = '<div class="wrap"><div class="col" id="qmain"></div><div class="col" id="qsidecol"></div><div id="qside"><div class="hdr">第一章·天剑学院</div><button class="close" id="qclose">关闭</button></div></div>';
  document.body.appendChild(qp); stop(qp); onTap($('qclose'), () => closePanel());
  const ch = document.createElement('div'); ch.id = 'choice'; ch.innerHTML = '<div class="cq"></div><div class="co"></div>'; document.body.appendChild(ch); stop(ch);
  const af = document.createElement('div'); af.id = 'amufx'; af.textContent = '护身符护主！'; document.body.appendChild(af);
  // title: 剧情跳转
  const jb = document.createElement('button'); jb.id = 'jumpbtn'; jb.textContent = '剧情跳转'; $('go').parentNode.appendChild(jb);
  const jp = document.createElement('div'); jp.id = 'jumpp'; jp.className = 'v45p'; jp.style.zIndex = 90;
  jp.innerHTML = '<div class="hd"><b>剧情跳转 · 第一章</b><small>选一节点，以「跳转测试」专用存档开局（会覆盖上一次的跳转存档，不影响其他存档）</small><button class="close" id="jumpclose">返回</button></div><div id="jumplist"></div>';
  document.body.appendChild(jp); stop(jp);
  $('jumplist').innerHTML = JUMP_NODES.map((n, i) => `<button data-i="${i}">${n[0]}<i>${n[1] ? (CP_CN[n[1]] || '') + ' · Lv' + (CP_LV[n[1]] || 1) : '开场旁白 → 仙尊教程'}</i></button>`).join('');
  onTap(jb, () => { resetInputs('jump'); jp.style.display = 'block'; });
  onTap($('jumpclose'), () => { jp.style.display = 'none'; });
  onTap($('jumplist'), e => { const b = e.target.closest && e.target.closest('button'); if (!b) return; const n = JUMP_NODES[+b.dataset.i]; jp.style.display = 'none'; if (!n[1]) jumpOpening(); else jumpStart(n[1], n[2]); });
  addEventListener('keydown', e => { if (e.code === 'KeyB' && state === 'play') openPanel('bag'); else if (e.code === 'KeyL' && state === 'play') openPanel('qlog'); else if (e.code === 'Escape' && PANEL.open) closePanel(); });
  addEventListener('resize', layoutBag); addEventListener('orientationchange', () => setTimeout(layoutBag, 220));
})();
const BAG = { tab: 'gourd', sel: null };
const PANEL = { open: null };
function openPanel(which) {
  if (mode !== 'ch1' || PANEL.open || (typeof MAP !== 'undefined' && MAP.open)) return false;
  if (state !== 'play') { if (state === 'talk' || state === 'cut') toast('剧情进行中'); return false; }
  PANEL.open = which; PANEL.prev = state; state = 'panel'; resetInputs('panel'); document.body.classList.add('panelopen'); sfx('swish');
  if (which === 'bag') { BAG.sel = null; $('bagp').style.display = 'block'; drawBag(); } else { $('qlogp').style.display = 'block'; drawQlog(); $('qbtn').classList.remove('new'); }
  return true;
}
function closePanel() { if (!PANEL.open) return; $(PANEL.open === 'bag' ? 'bagp' : 'qlogp').style.display = 'none'; PANEL.open = null; document.body.classList.remove('panelopen'); if (state === 'panel') state = 'play'; resetInputs('panelclose'); refreshQS(); }
function bagItems(cat) {
  if (cat === 'special') return (player.items || []).filter(id => ITEMS[id] && ITEMS[id].cat === 'special');
  return Object.keys(player.inv || {}).filter(id => ITEMS[id] && ITEMS[id].cat === cat && invN(id) > 0);
}
function drawBag() {
  document.querySelectorAll('#bagp .tab').forEach(t => t.classList.toggle('on', t.dataset.t === BAG.tab));
  const ids = bagItems(BAG.tab), eq = player.eq || {};
  if (!BAG.sel || !ids.includes(BAG.sel)) BAG.sel = ids[0] || null;
  const isEq = id => eq.gourd === id || eq.wine === id || eq.curio === id;
  $('baglist').innerHTML = ids.length ? ids.map(id => { const it = ITEMS[id]; const tag = isEq(id) ? '<em>已装备</em>' : it.cat === 'pill' ? `<em>×${invN(id)}</em>` : (player.qs || []).includes(id) ? '<em>快捷</em>' : ''; const sub = it.cat === 'gourd' ? `每战 ${it.drinks} 口` : it.cat === 'wine' ? `每口回复 ${Math.round(it.heal * 100)}%` : it.cat === 'special' ? '要物' : it.cat === 'curio' ? '古玩' : '丹药'; return `<div class="bitem${id === BAG.sel ? ' on' : ''}" data-id="${id}"><b>${it.name}</b>${tag}<small>${sub}</small></div>`; }).join('') : '<div style="color:#988aa8;font-size:13px;padding:8px">（空）</div>';
  const det = $('bagdet'), act = $('bagact'); $('bagmsg').textContent = ''; act.innerHTML = '';
  const id = BAG.sel, it = id && ITEMS[id];
  if (!it) { det.innerHTML = `<h4>${BAG_TABS.find(t => t[0] === BAG.tab)[1]}</h4>` + (BAG.tab === 'special' ? '要物在此，不可丢弃、不可使用。' : '尚无此类物品。'); return; }
  det.innerHTML = `<h4>${it.name}</h4>${it.desc}` + (it.cat === 'pill' ? `<br><span style="color:#9fe0a0">持有 ×${invN(id)}</span>` : '') + (it.cat === 'special' ? '<br><span style="color:#a898c0">要物 · 不可丢弃或使用</span>' : '');
  const btn = (label, fn, dis) => { const b = document.createElement('button'); b.textContent = label; b.disabled = !!dis; act.appendChild(b); onTap(b, () => { if (!b.disabled) { fn(); drawBag(); } }); return b; };
  if (it.cat === 'gourd' || it.cat === 'wine' || it.cat === 'curio') { if (isEq(id)) { if (it.cat === 'curio') btn('卸下', () => { player.eq.curio = null; saveGame(); toast(`已卸下【${it.name}】`); }); else btn('已装备', () => { }, true); } else btn('装备', () => { if (!equipItem(id)) $('bagmsg').textContent = '战斗之中，不可更换'; }); }
  if (it.cat === 'pill') {
    const why = canUsePill(id); btn('服用', () => { usePill(id); }, !!why); if (why) $('bagmsg').textContent = why;
    for (let i = 0; i < 4; i++) { const cur = player.qs[i]; btn(cur === id ? `快捷${i + 1} ✓` : `设快捷${i + 1}`, () => { player.qs[i] = cur === id ? null : id; refreshQS(); saveGame(); }); }
  }
}
function drawQlog() {
  const d = questLogData();
  const li = q => `<div class="ql ${q.st}"><b>${q.name}</b><small>${q.obj || ''}</small></div>`;
  const ord = a => [...a.filter(q => q.st === 'active' || q.st === 'avail'), ...a.filter(q => q.st === 'done' || q.st === 'missed')];
  $('qmain').innerHTML = '<h3>主线</h3>' + ord(d.main).map(li).join('');
  $('qsidecol').innerHTML = '<h3>支线</h3>' + (d.side.length ? ord(d.side).map(li).join('') : '<div style="color:#988aa8;font-size:13px">暂无</div>');
}
function quickUse(i) {
  const id = player.qs && player.qs[i]; if (state !== 'play') return;
  if (!id) { toast('快捷栏为空 · 可于背包中设置丹药'); return; }
  usePill(id);
}
function refreshQS() {
  for (let i = 0; i < 4; i++) { const el = $('qs' + i); if (!el) continue; const id = player.qs && player.qs[i], n = id ? invN(id) : 0;
    el.classList.toggle('has', !!id); el.classList.toggle('empty', !!id && n <= 0);
    el.querySelector('b').textContent = id ? ITEMS[id].name.slice(0, 2) : ''; el.querySelector('i').textContent = id ? String(n) : ''; }
}
function layoutBag() {
  const u = uScale, Hh = innerHeight, b = Math.round(40 * u), gap = Math.round(6 * u), x0 = Math.round(150 * u), y = Hh - Math.round(12 * u) - b;
  const els = $('bagbar').children; for (let i = 0; i < els.length; i++) { const e = els[i]; e.style.width = e.style.height = b + 'px'; e.style.left = (x0 + i * (b + gap)) + 'px'; e.style.top = y + 'px'; e.style.fontSize = Math.round(13 * u) + 'px'; }
}
layoutBag(); refreshQS();
/* ---------------- 剧情跳转 ---------------- */
function jumpReset() {
  deleteSave(JUMP_SLOT); player.tutChar = false; activeSlot = JUMP_SLOT;
  player.name = '跳转测试'; player.lv = 1; player.xp = 0; player.unlocked = []; player.pages = []; player.items = []; player.jdTp = false; player.quests = []; player.wins = 0; player.rideOK = false; invReset(); recalc();
}
function jumpStart(cp, opt = {}) {
  JUMP.pending = false; initAudio(); for (const id of ['start', 'slots', 'jumpp', 'namebox', 'story']) $(id).style.display = 'none'; goFull();
  jumpReset();
  if (cpIdx(cp) > cpIdx('day3')) { player.quests = ['zuili', 'herbs']; player.inv.zuixian = 1; player.eq.gourd = 'zuixian'; player.inv.peiyuan = 1; player.qs[0] = 'peiyuan'; recalc(); }
  ch1.cp = cp; startCh1(cp); refreshQS();
  if (opt.pos) placePlayer(opt.pos);
  JUMP.last = cp;
}
function jumpOpening() { JUMP.pending = true; activeSlot = null; initAudio(); $('start').style.display = 'none'; $('slots').style.display = 'none'; goFull(); playOpening(); }
Object.assign(window.__G, { cpIdx, ITEMS, giveInv, equipItem, usePill, invN, openPanel, closePanel, quickUse, refreshQS, questLogData, jumpStart, JUMP_NODES, JUMP_SLOT, HERBS, JADE, MAIN_QUESTS, ensureState, drawBag, BAG, PANEL, chooseCo, CHO, herbN, LIU: LIU_POS(), STONE, MOHAN_D3, CLASS, layoutBag, killEnemy, amuletSave });
