'use strict';
/* 山海剑侠 — first-person swordsman, three.js r160 (vendored) */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// deterministic world generation (seeded) — restored after spawn
const _mathRandom = Math.random; { let a = 20261001; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = V3(0, 1, 0);

/* ---------------- noise / terrain ---------------- */
function hash(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= .5; } return s / .9375; }

const LAKE = { x: -55, z: -5, r: 38 };
const RIVER = [[-40, 20], [-15, 22], [5, 34], [40, 46], [78, 50], [110, 64], [150, 70], [200, 66], [270, 80]];
const PEAKS = [{ x: 125, z: -160, h: 38, r: 32 }, { x: 45, z: 168, h: 30, r: 26 }, { x: -150, z: 150, h: 48, r: 34 }, { x: -25, z: -135, h: 26, r: 28 }, { x: 160, z: -35, h: 22, r: 24 }, { x: -130, z: 30, h: 20, r: 22 }, { x: 70, z: -60, h: 9, r: 16 }];
function distSeg(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
function riverDist(x, z) { let d = 1e9; for (let i = 0; i < RIVER.length - 1; i++) d = Math.min(d, distSeg(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1])); return d; }
function H(x, z) {
  let h = 2.6 + (fbm(x * .012 + 3.1, z * .012 - 1.7) - .5) * 9 + (vnoise(x * .09, z * .09) - .5) * 1.0;
  const r = Math.hypot(x, z);
  const m = smooth(165, 255, r); h += m * (30 + fbm(x * .018 + 5, z * .018) * 70);
  for (const p of PEAKS) { const dx = x - p.x, dz = z - p.z; h += p.h * Math.exp(-(dx * dx + dz * dz) / (p.r * p.r)) * (.75 + .5 * vnoise(x * .05, z * .05)); }
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r * 1.7) { const tgt = -4.5 + 5.2 * (dl / LAKE.r) * (dl / LAKE.r); const w = 1 - smooth(LAKE.r * .85, LAKE.r * 1.6, dl); h = lerp(h, Math.min(h, tgt), w); }
  const rd = riverDist(x, z), W = 5.5;
  if (rd < W * 3) { const tgt = -1.05 + (rd / W) * (rd / W) * 1.6; const w = 1 - smooth(W * .9, W * 2.8, rd); h = lerp(h, Math.min(h, tgt), w); }
  return h;
}

/* ---------------- renderer ---------------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
const scene = new THREE.Scene();
const FOGC = new THREE.Color(0xc4d8e4);
scene.fog = new THREE.Fog(FOGC, 70, 420);
const camera = new THREE.PerspectiveCamera(70, 1, .1, 1600);
camera.rotation.order = 'YXZ';
const vScene = new THREE.Scene();
const vCam = new THREE.PerspectiveCamera(55, 1, .01, 10);
const SUN = V3(-.45, .62, -.55).normalize();

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x2f6cc6) }, mid: { value: new THREE.Color(0x8fbfe8) }, bot: { value: new THREE.Color(0xd2e4ee) }, sunDir: { value: SUN } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }',
  fragmentShader: 'uniform vec3 top,mid,bot,sunDir; varying vec3 vP; void main(){ vec3 d=normalize(vP); float h=d.y; vec3 c=mix(bot,mid,smoothstep(-0.02,0.18,h)); c=mix(c,top,smoothstep(0.18,0.75,h)); float s=max(dot(d,sunDir),0.); c+=vec3(1.,.92,.75)*(pow(s,900.)*4.+pow(s,10.)*.22); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);
{ // environment map for metals
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshBasicMaterial({ color: 0x4d5a3a }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -3; envScene.add(gnd);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(envScene, .02).texture;
  scene.environment = env; vScene.environment = env;
}
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x55623a, .75); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xfff0d8, 2.0); sunL.position.copy(SUN).multiplyScalar(100); scene.add(sunL);
vScene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3a30, .9));
const vSun = new THREE.DirectionalLight(0xfff3e0, 2.2); vSun.position.set(-1, 2, 1.2); vScene.add(vSun);
const vRim = new THREE.DirectionalLight(0x9fd0ff, 1.0); vRim.position.set(1.5, .5, -1); vScene.add(vRim);

/* ---------------- terrain ---------------- */
const WORLD = 620, SEG = 210;
{
  const g = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { p.setY(i, H(p.getX(i), p.getZ(i))); }
  g.computeVertexNormals();
  const n = g.attributes.normal, c = new THREE.Color();
  const sand = new THREE.Color(0xcbb98a), grass1 = new THREE.Color(0x5d9a3a), grass2 = new THREE.Color(0x86ad4c), rock = new THREE.Color(0x857a6c), rock2 = new THREE.Color(0x6a6560), snow = new THREE.Color(0xf4f7fb), mud = new THREE.Color(0x6f6a4a);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i);
    const v = fbm(x * .05, z * .05);
    c.copy(grass1).lerp(grass2, v);
    if (y < .9) c.lerp(sand, smooth(.9, .2, y));
    if (y < -.6) c.copy(mud);
    const rk = Math.max(smooth(.88, .72, ny), smooth(16, 30, y));
    c.lerp(v > .5 ? rock : rock2, rk);
    c.lerp(snow, smooth(50, 66, y + v * 10) * smooth(.6, .78, ny));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(terrain);
}
// water
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2c7896, roughness: .06, metalness: .1, transparent: true, opacity: .84, envMapIntensity: 1.3 });
{
  const w = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD, 1, 1), waterMat); w.rotation.x = -Math.PI / 2; w.position.y = 0; w.renderOrder = 1; scene.add(w);
}
// lotus / lily pads
{
  const pad = new THREE.CylinderGeometry(.7, .7, .05, 10); const lot = new THREE.ConeGeometry(.22, .35, 6);
  const N = 40; const im = new THREE.InstancedMesh(pad, new THREE.MeshLambertMaterial({ color: 0x3f8a3a }), N);
  const im2 = new THREE.InstancedMesh(lot, new THREE.MeshLambertMaterial({ color: 0xf28bb0, emissive: 0x401020 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(); let k = 0, tries = 0;
  while (k < N && tries++ < 2000) { const a = rand(0, Math.PI * 2), r = rand(LAKE.r * .5, LAKE.r * .95); const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r; if (H(x, z) > -.5) continue; const sc = rand(.6, 1.3); s.set(sc, 1, sc); m.compose(V3(x, .03, z), q.setFromAxisAngle(Y_AXIS, rand(0, 6)), s); im.setMatrixAt(k, m); m.compose(V3(x + .2, .2, z), q, V3(sc, sc, sc)); im2.setMatrixAt(k, Math.random() < .5 ? m : m.clone().scale(V3(0, 0, 0))); k++; }
  im.count = k; im2.count = k; scene.add(im, im2);
}

/* merge helper for instanced decor */
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
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, ry), V3(sx, sy, sz));

/* ---------------- areas ---------------- */
const SPAWN = { x: 10, z: 8 };
const AREAS = [
  { name: '招摇山', x: 8, z: -42, lv: [1, 5], type: 'xingxing', n: 6, color: 0x9dff6a },
  { name: '青丘', x: -70, z: -62, lv: [8, 16], type: 'fox', n: 6, color: 0xff9a4a },
  { name: '章莪山', x: 72, z: -108, lv: [20, 32], type: 'bifang', n: 5, color: 0x5ad8ff },
  { name: '南泽', x: 108, z: 34, lv: [36, 50], type: 'snake', n: 5, color: 0xc07aff },
  { name: '符惕山', x: 18, z: 118, lv: [55, 72], type: 'jiangyi', n: 5, color: 0x8fe8ff },
  { name: '钟山', x: -98, z: 112, lv: [86, 100], type: 'zhulong', n: 2, extra: { type: 'jiangyi', n: 3, lv: [78, 84] }, color: 0xff5040 },
];

/* trees, rocks */
const treeCols = [];
{
  const trunkG = new THREE.CylinderGeometry(.18, .3, 2.2, 6);
  const pine = mergeColored([[trunkG, 0x5a3d26, M4(0, 1.1, 0)], [new THREE.ConeGeometry(2.1, 3.2, 8), 0x2f5f32, M4(0, 3.2, 0)], [new THREE.ConeGeometry(1.6, 2.7, 8), 0x376b37, M4(0, 4.8, 0)], [new THREE.ConeGeometry(1.05, 2.3, 8), 0x3f7a3c, M4(0, 6.3, 0)]]);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const broad = mergeColored([[trunkG, 0x6a4a2e, M4(0, 1.1, 0, 1.2, 1.3, 1.2)], [blob, 0x5c9440, M4(0, 3.9, 0, 2, 1.7, 2)], [blob, 0x6aa448, M4(.9, 4.5, .3, 1.4, 1.3, 1.4)], [blob, 0x4f8a3a, M4(-.8, 4.3, -.4, 1.5, 1.3, 1.5)], [blob, 0x78b052, M4(.1, 5.3, .1, 1.2, 1.1, 1.2)]]);
  const blossom = mergeColored([[trunkG, 0x5b3a2a, M4(0, 1.1, 0, 1.1, 1.2, 1.1)], [blob, 0xffc9da, M4(0, 3.6, 0, 1.9, 1.5, 1.9)], [blob, 0xffe0ea, M4(.8, 4.1, .2, 1.3, 1.1, 1.3)], [blob, 0xf7b2c8, M4(-.7, 4.0, -.3, 1.3, 1.1, 1.3)]]);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const kinds = [[pine, 320], [broad, 200], [blossom, 50]];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const [geo, N] of kinds) {
    const im = new THREE.InstancedMesh(geo, mat, N); let k = 0, tries = 0;
    while (k < N && tries++ < 20000) {
      const x = rand(-235, 235), z = rand(-235, 235); const h = H(x, z); const r = Math.hypot(x, z);
      if (h < .7 || h > (geo === pine ? 42 : 18) || r > 245) continue;
      if (geo === blossom && Math.hypot(x - AREAS[1].x, z - AREAS[1].z) > 55 && Math.hypot(x - LAKE.x, z - LAKE.z) > 60) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 12) continue;
      let bad = false; for (const a of AREAS) if (Math.hypot(x - a.x, z - a.z) < 13) bad = true; if (bad) continue;
      if (H(x + 2, z) - h > 2.2 || H(x, z + 2) - h > 2.2) continue;
      const s = rand(.75, 1.35); m.compose(V3(x, h - .2, z), q.setFromAxisAngle(Y_AXIS, rand(0, 6.3)), V3(s, s * rand(.85, 1.2), s)); im.setMatrixAt(k++, m);
      treeCols.push({ x, z, r: .55 * s });
    }
    im.count = k; scene.add(im);
  }
  // rocks
  const rg = new THREE.IcosahedronGeometry(1, 0); const rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * rand(.8, 1.2), rp.getY(i) * rand(.7, 1.1), rp.getZ(i) * rand(.8, 1.2));
  rg.computeVertexNormals();
  const N = 190, im = new THREE.InstancedMesh(rg, new THREE.MeshLambertMaterial({ color: 0x8c877d, flatShading: true }), N); let k = 0, tries = 0;
  while (k < N && tries++ < 10000) {
    const x = rand(-230, 230), z = rand(-230, 230), h = H(x, z); if (h > 45 || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8) continue;
    const s = Math.random() < .15 ? rand(2.5, 4.5) : rand(.5, 1.6);
    m.compose(V3(x, h - s * .25, z), q.setFromEuler(new THREE.Euler(rand(0, 1), rand(0, 6), rand(0, 1))), V3(s, s * rand(.6, 1), s)); im.setMatrixAt(k++, m);
    if (s > 1.2) treeCols.push({ x, z, r: s * .85 });
  }
  im.count = k; scene.add(im);
  // clouds
  const cl = []; for (let i = 0; i < 16; i++) { const a = rand(0, 6.3), r = rand(320, 520), y = rand(110, 190); const cx = Math.cos(a) * r, cz = Math.sin(a) * r; const s = rand(14, 26); for (let j = 0; j < 5; j++) cl.push([blob, 0xffffff, M4(cx + rand(-1.5, 1.5) * s, y + rand(-.2, .3) * s, cz + rand(-1.5, 1.5) * s, s * rand(.8, 1.3), s * rand(.35, .55), s * rand(.8, 1.3))]); }
  const cm = new THREE.Mesh(mergeColored(cl), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa6b6, fog: false, transparent: true, opacity: .92 }));
  scene.add(cm);
}
// tree collision hash
const colGrid = new Map();
for (const t of treeCols) { const k = Math.floor(t.x / 8) + ',' + Math.floor(t.z / 8); if (!colGrid.has(k)) colGrid.set(k, []); colGrid.get(k).push(t); }
function pushOutTrees(p, rad) {
  const gx = Math.floor(p.x / 8), gz = Math.floor(p.z / 8);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = colGrid.get((gx + i) + ',' + (gz + j)); if (!a) continue; for (const t of a) { const dx = p.x - t.x, dz = p.z - t.z, d = Math.hypot(dx, dz), m = t.r + rad; if (d < m && d > 1e-4) { p.x = t.x + dx / d * m; p.z = t.z + dz / d * m; } } }
}
// steles + light pillars
const steles = [];
{
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a8f8c, roughness: .9 });
  for (const a of AREAS) {
    const g = new THREE.Group(); const h = H(a.x, a.z); g.position.set(a.x + 6, h, a.z + 6);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, .5, 1.2), stoneM); base.position.y = .25; g.add(base);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, .45), stoneM); slab.position.y = 2; g.add(slab);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, .35, .7), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: .8 })); cap.position.y = 3.65; g.add(cap);
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 140, 16, 1, true), new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    pil.position.y = 72; g.add(pil);
    scene.add(g); steles.push({ a, g, pos: V3(a.x + 6, h + 4.6, a.z + 6) });
  }
}

/* ---------------- shared geometry ---------------- */
const G = {
  sph: new THREE.SphereGeometry(1, 16, 12), sphLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cylT: new THREE.CylinderGeometry(.6, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12), box: new THREE.BoxGeometry(1, 1, 1),
  cap: new THREE.CapsuleGeometry(1, 1, 6, 12), tor: new THREE.TorusGeometry(1, .18, 8, 20), torF: new THREE.TorusGeometry(1, .46, 8, 16, Math.PI * 1.45),
};
function mk(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; }

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
  const bladeM = new THREE.MeshStandardMaterial({ color: 0xe9f0f7, metalness: 1, roughness: .14, envMapIntensity: 1.5, emissive: 0x66ccff, emissiveIntensity: 0, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: .9, roughness: .3, envMapIntensity: 1.2 });
  const gripM = new THREE.MeshStandardMaterial({ color: 0x3a1512, roughness: .8 });
  const wrapM = new THREE.MeshStandardMaterial({ color: 0x0e0b0a, roughness: .6 });
  const jade = new THREE.MeshStandardMaterial({ color: 0x3fd59a, emissive: 0x0f6644, roughness: .2, metalness: .2 });
  const blade = new THREE.Mesh(BLADE_G, bladeM); blade.position.y = GUARD_Y + .006; g.add(blade);
  // fuller line
  const ful = mk(G.box, new THREE.MeshStandardMaterial({ color: 0x9fb2c6, metalness: 1, roughness: .25 }), g, 0, GUARD_Y + .006 + .4, 0, .0035, .74, .0118);
  mk(G.cyl, gripM, g, 0, 0, 0, .0125, .13, .0125);
  for (let i = 0; i < 6; i++) { const t = mk(G.tor, wrapM, g, 0, -.05 + i * .02, 0, .0135, .0135, .0135); t.rotation.x = Math.PI / 2; }
  mk(G.box, gold, g, 0, GUARD_Y, 0, .03, .016, .026);
  for (const s of [-1, 1]) { const arm = mk(G.cone, gold, g, s * .03, GUARD_Y - .002, 0, .009, .045, .009); arm.rotation.z = s * (Math.PI / 2 + .35); mk(G.sph, gold, g, s * .05, GUARD_Y + .006, 0, .0075, .0075, .0075); }
  mk(G.sph, jade, g, 0, GUARD_Y, .012, .0075, .0075, .004);
  mk(G.sph, jade, g, 0, GUARD_Y, -.012, .0075, .0075, .004);
  mk(G.cylT, gold, g, 0, -.072, 0, .016, .014, .016);
  mk(G.sph, gold, g, 0, -.085, 0, .015, .013, .015);
  let tassel = null;
  if (opts.tassel) {
    tassel = new THREE.Group(); tassel.position.y = -.095; g.add(tassel);
    const red = new THREE.MeshStandardMaterial({ color: 0xc0172a, roughness: .7 });
    mk(G.cyl, red, tassel, 0, -.03, 0, .002, .06, .002);
    mk(G.sph, red, tassel, 0, -.062, 0, .008, .008, .008);
    const tc = mk(G.cone, red, tassel, 0, -.1, 0, .012, .07, .012); tc.rotation.x = Math.PI;
  }
  if (opts.scale) g.scale.setScalar(opts.scale);
  return { g, bladeM, tassel };
}

/* ---------------- view model: black leather gloves + sword ---------------- */
const leather = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: .42, metalness: 0, clearcoat: .6, clearcoatRoughness: .35, envMapIntensity: .9 });
const leatherSeam = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .7 });
const sleeveM = new THREE.MeshStandardMaterial({ color: 0x1c2a46, roughness: .85 });
const sleeveTrim = new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: .5, metalness: .6 });
const vRoot = new THREE.Group(); vScene.add(vRoot);
function addForearm() {
  // independent forearm (cuff + sleeve) along -Z, oriented each frame from wrist toward an elbow anchor
  const g = new THREE.Group(); vRoot.add(g);
  const cuff = mk(G.cylT, leather, g, 0, 0, -.06, .034, .11, .034); cuff.rotation.x = -Math.PI / 2;
  mk(G.tor, leatherSeam, g, 0, 0, -.1, .036, .036, .036);
  mk(G.tor, sleeveTrim, g, 0, 0, -.135, .05, .05, .05);
  const sl = mk(G.cylT, sleeveM, g, 0, 0, -.42, .062, .56, .062); sl.rotation.x = -Math.PI / 2;
  return g;
}
const rFore = addForearm(), lFore = addForearm();
const R_ELBOW = V3(.34, -.66, -.1), L_ELBOW = V3(-.34, -.66, -.1), NEG_Z = V3(0, 0, -1);
function placeForearm(fore, hand, wristLocal, elbow) {
  const w = wristLocal.clone().applyQuaternion(hand.quaternion).add(hand.position);
  fore.position.copy(w); fore.quaternion.setFromUnitVectors(NEG_Z, elbow.clone().sub(w).normalize());
}
// right fist (grip along Y, knuckles toward +Z, forearm toward -Z, back of hand +X)
const rHand = new THREE.Group(); vRoot.add(rHand);
{
  mk(G.sph, leather, rHand, .012, 0, -.018, .036, .052, .04);          // palm mass
  mk(G.sph, leather, rHand, .022, .002, -.004, .022, .05, .036);       // back of hand
  for (let i = 0; i < 4; i++) {                                         // curled fingers
    const y = .036 - i * .023, r = i === 3 ? .0085 : .0105;
    const f = mk(G.torF, leather, rHand, -.001, y, .002, .022, .022, .022); f.rotation.x = Math.PI / 2;
    mk(G.sph, leather, rHand, .014, y, .022, r * 1.25, r * 1.1, r * 1.2); // knuckle
    mk(G.sph, leather, rHand, -.014, y, .02, r, r, r * 1.1);              // finger tip side
  }
  const th = mk(G.cap, leather, rHand, -.02, .03, -.012, .011, .03, .011); th.rotation.set(.4, 0, .9);
  mk(G.sph, leatherSeam, rHand, .03, .0, -.02, .006, .04, .02);         // seam/strap
}
const vSword = buildSword({ tassel: true }); rHand.add(vSword.g);
// left hand 剑指 (fingers along +Z, forearm -Z, palm facing -X)
const lHand = new THREE.Group(); vRoot.add(lHand);
{
  mk(G.sph, leather, lHand, 0, 0, 0, .03, .038, .045);
  for (const [x, len] of [[.0062, .06], [-.0062, .056]]) { const f = mk(G.cap, leather, lHand, x, .016, .062, .0095, len * .5, .0095); f.rotation.x = Math.PI / 2; mk(G.sph, leather, lHand, x, .016, .03, .0115, .0115, .0115); }
  mk(G.sph, leather, lHand, -.006, -.012, .036, .014, .012, .016);
  mk(G.sph, leather, lHand, -.006, -.028, .03, .012, .011, .014);
  const th = mk(G.cap, leather, lHand, -.022, -.012, .026, .01, .025, .01); th.rotation.set(1.2, 0, -.6);
}
function handQuat(d, f, out) { // d: sword dir (local +Y), f: forearm dir (local -Z)
  const y = d.clone().normalize(); const fz = f.clone().sub(y.clone().multiplyScalar(f.dot(y))).normalize().negate();
  const x = y.clone().cross(fz); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, fz));
}
function lHandQuat(d, up, out) { // fingers +Z = d
  const z = d.clone().normalize(); const y = up.clone().sub(z.clone().multiplyScalar(up.dot(z))).normalize(); const x = y.clone().cross(z);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const RF = V3(.4, -.8, .45); // default forearm direction for right hand
function RK(k, p, d, f) { return { k, p: V3(...p), q: handQuat(V3(...d), f ? V3(...f) : RF, new THREE.Quaternion()) }; }
function LK(k, p, d, up) { return { k, p: V3(...p), q: lHandQuat(V3(...d), V3(...(up || [-1, .3, 0])), new THREE.Quaternion()) }; }
const R_IDLE = RK(0, [.22, -.22, -.56], [-.2, .74, -.64], [.4, -.8, .45]);
const L_IDLE = LK(0, [-.2, -.21, -.5], [.3, .7, -.6], [-.25, -.35, 1]);

/* ---------------- 山海经 monsters ---------------- */
function matFactory() {
  const cache = {}, list = [];
  const f = (hex, o = {}) => { const k = hex + JSON.stringify(o); if (!cache[k]) { const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: .72, metalness: 0, envMapIntensity: .6 }, o)); m.userData.glow = !!o.emissive; m.userData.e0 = m.emissive.clone(); m.userData.ei = m.emissiveIntensity; cache[k] = m; list.push(m); } return cache[k]; };
  f.list = list; return f;
}
function limb(parent, x, y, z, r, len, mat, r2) { // pivot at top, extends -Y
  const pv = new THREE.Group(); pv.position.set(x, y, z); parent.add(pv);
  const m = new THREE.Mesh(r2 ? G.cylT : G.cyl, mat); m.scale.set(r, len, r); m.position.y = -len / 2; pv.add(m);
  const end = new THREE.Group(); end.position.y = -len; pv.add(end);
  return { pv, end };
}
const glowM = (M, hex, i = 1.6) => M(hex, { emissive: hex, emissiveIntensity: i, roughness: .3 });

function buildXingxing(M) { // 狌狌: ape-like, white ears
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = M(0x7b5a40), fur2 = M(0x5e4430), light = M(0xdcc29e), white = M(0xf6f3ec), dark = M(0x1a1410), pink = M(0xe0a39a);
  mk(G.sph, fur, body, 0, .95, 0, .42, .5, .36);
  mk(G.sph, light, body, 0, .9, .19, .3, .38, .2);
  mk(G.sph, fur2, body, 0, 1.3, -.05, .44, .2, .34);
  const head = new THREE.Group(); head.position.set(0, 1.55, .06); body.add(head);
  mk(G.sph, fur, head, 0, 0, 0, .3, .29, .28);
  mk(G.sph, light, head, 0, -.04, .16, .22, .2, .15);
  mk(G.sph, light, head, 0, -.13, .24, .13, .085, .09);
  mk(G.sph, dark, head, 0, -.1, .325, .035, .022, .02);
  mk(G.box, dark, head, 0, -.19, .29, .08, .012, .02);
  for (const s of [-1, 1]) {
    mk(G.sph, white, head, s * .09, .03, .27, .055, .055, .03);
    mk(G.sph, dark, head, s * .09, .03, .295, .03, .03, .02);
    mk(G.sph, white, head, s * .08, .045, .31, .008, .008, .006);
    const b = mk(G.box, dark, head, s * .09, .11, .27, .1, .022, .025); b.rotation.z = -s * .3;
    const ear = mk(G.sph, white, head, s * .31, .06, -.02, .05, .19, .14); ear.rotation.z = s * .3;
    const ei = mk(G.sph, pink, head, s * .335, .06, 0, .02, .12, .085); ei.rotation.z = s * .3;
  }
  mk(G.cone, fur2, head, 0, .31, -.03, .12, .22, .1);
  mk(G.cone, fur2, head, .06, .28, -.06, .07, .16, .07).rotation.z = -.5;
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = limb(body, s * .43, 1.28, .02, .095, .48, fur); mk(G.sph, fur, a.pv, 0, 0, 0, .13, .13, .13);
    const fa = limb(a.end, 0, 0, 0, .085, .45, fur2); mk(G.sph, light, fa.end, 0, -.05, 0, .11, .1, .12);
    a.pv.rotation.z = s * .15; arms.push({ a, fa });
    const l = limb(body, s * .19, .6, 0, .11, .32, fur2); const f = mk(G.sph, light, l.end, 0, -.03, .08, .1, .06, .16); legs.push(l);
  }
  return {
    root, anim(m, t) {
      const w = m.moveAmt, ph = m.walkPh;
      legs[0].pv.rotation.x = Math.sin(ph) * .7 * w; legs[1].pv.rotation.x = -Math.sin(ph) * .7 * w;
      body.position.y = Math.abs(Math.sin(ph)) * .07 * w + Math.sin(t * 2 + m.seed) * .015;
      body.rotation.x = .12 * w;
      head.rotation.y = Math.sin(t * .8 + m.seed) * .35 * (1 - w);
      let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; arms[i].a.pv.rotation.x = Math.sin(ph) * .8 * w * s - 2.8 * ak; arms[i].fa.pv.rotation.x = -.3 - .4 * w - .5 * ak; }
      body.rotation.x += ak * -.25; if (m.atkT > .5) body.rotation.x = lerp(-.25, .45, (m.atkT - .5) * 2) * Math.sin(m.atkT * Math.PI);
    }
  };
}

function buildFox(M) { // 九尾狐
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const org = M(0xe4762a), org2 = M(0xc95e1e), white = M(0xfbf4ea), dark = M(0x231710), eye = glowM(M, 0xffc23a, 2.2);
  const b = mk(G.cap, org, body, 0, .66, 0, .27, .34, .27); b.rotation.x = Math.PI / 2;
  mk(G.sph, white, body, 0, .58, .05, .22, .2, .42);
  mk(G.sph, white, body, 0, .74, .42, .23, .25, .2);
  mk(G.sph, org2, body, 0, .82, -.05, .22, .12, .4);
  const head = new THREE.Group(); head.position.set(0, 1.0, .6); body.add(head);
  mk(G.sph, org, head, 0, 0, 0, .2, .18, .2);
  for (const s of [-1, 1]) { mk(G.sph, white, head, s * .12, -.06, .06, .1, .09, .1); }
  const sn = mk(G.cone, org, head, 0, -.03, .23, .085, .26, .075); sn.rotation.x = Math.PI / 2;
  const jaw = mk(G.cone, white, head, 0, -.075, .2, .06, .2, .05); jaw.rotation.x = Math.PI / 2;
  mk(G.sph, dark, head, 0, -.025, .36, .025, .02, .02);
  for (const s of [-1, 1]) {
    const e = mk(G.cone, org, head, s * .1, .2, -.02, .075, .2, .04); e.rotation.z = -s * .25;
    const ei = mk(G.cone, dark, head, s * .1, .2, .005, .045, .14, .02); ei.rotation.z = -s * .25;
    const ey = mk(G.sph, eye, head, s * .085, .04, .165, .04, .022, .02); ey.rotation.z = s * .35;
    mk(G.sph, dark, head, s * .085, .04, .18, .012, .02, .01);
  }
  const legs = [];
  for (const [x, z] of [[-.14, .34], [.14, .34], [-.14, -.32], [.14, -.32]]) {
    const u = limb(body, x, .6, z, .065, .3, org); const lo = limb(u.end, 0, 0, 0, .05, .3, dark); mk(G.sph, dark, lo.end, 0, -.01, .04, .06, .04, .08); legs.push({ u, lo });
  }
  const tails = []; const tb = new THREE.Group(); tb.position.set(0, .78, -.5); body.add(tb);
  for (let i = 0; i < 9; i++) {
    const pv = new THREE.Group(); pv.rotation.order = 'YXZ'; pv.rotation.y = (i - 4) / 4 * 1.05; pv.rotation.x = .75 + Math.abs(i - 4) * -.06; tb.add(pv);
    let par = pv; const segs = [];
    const R = [.075, .11, .13, .12];
    for (let k = 0; k < 4; k++) { const sg = new THREE.Group(); par.add(sg); if (k) sg.position.z = -.3; mk(G.sph, k === 3 ? white : org, sg, 0, 0, -.16, R[k], R[k], .2); segs.push(sg); par = sg; }
    tails.push(segs);
  }
  const wisps = []; const wm = M(0x7fd8ff, { emissive: 0x5ac8ff, emissiveIntensity: 2.5, transparent: true, opacity: .85 });
  for (let i = 0; i < 2; i++) { wisps.push(mk(G.sphLo, wm, root, 0, 1.3, 0, .08, .11, .08)); }
  return {
    root, anim(m, t) {
      const w = m.moveAmt, ph = m.walkPh * 1.3;
      legs.forEach((l, i) => { const s = (i === 0 || i === 3) ? 1 : -1; l.u.pv.rotation.x = Math.sin(ph) * .8 * w * s; l.lo.pv.rotation.x = Math.max(0, Math.sin(ph * s)) * .6 * w; });
      body.position.y = Math.abs(Math.cos(ph)) * .06 * w;
      tails.forEach((segs, i) => segs.forEach((sg, k) => { sg.rotation.x = Math.sin(t * 2.4 + i * .7 + k * .6) * .16 + (k ? .12 : 0) + w * -.1; sg.rotation.y = Math.sin(t * 1.7 + i * 1.3 + k) * .2; }));
      let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      body.position.z = ak * .55; head.rotation.x = ak * .35 + Math.sin(t * 1.3 + m.seed) * .05; head.rotation.y = Math.sin(t * .6 + m.seed) * .3 * (1 - w);
      jaw.rotation.x = Math.PI / 2 + ak * .5;
      wisps.forEach((o, i) => { const a = t * 1.5 + i * Math.PI; o.position.set(Math.cos(a) * .9, 1.3 + Math.sin(t * 3 + i) * .15, Math.sin(a) * .9); });
    }
  };
}

function buildBifang(M) { // 毕方: one-legged crane, 青质赤文白喙
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const teal = M(0x2a8f8a), teal2 = M(0x1f6f73), red = M(0xd2352a), white = M(0xf3efe6), legM = M(0x7a2a22), dark = M(0x111111), gold = glowM(M, 0xffd04a, 1.2);
  const fire = M(0xff7a1a, { emissive: 0xff5a00, emissiveIntensity: 2.5, transparent: true, opacity: .85 });
  const leg = limb(root, 0, 1.25, 0, .045, .6, legM); const shin = limb(leg.end, 0, 0, 0, .035, .62, legM);
  mk(G.sph, legM, leg.end, 0, 0, 0, .06, .06, .06);
  for (const a of [-.5, 0, .5]) { const toe = mk(G.box, legM, shin.end, Math.sin(a) * .1, -.01, Math.cos(a) * .1, .025, .02, .2); toe.rotation.y = a; }
  mk(G.box, legM, shin.end, 0, -.01, -.06, .025, .02, .12);
  body.position.y = 1.35; root.add(body);
  mk(G.sph, teal, body, 0, 0, 0, .38, .34, .6);
  mk(G.sph, white, body, 0, -.12, .1, .3, .22, .45);
  const spots = [[.6, .4], [-.6, .4], [1.1, .1], [-1.1, .1], [.3, -.2], [-.3, -.2], [.9, .6], [-.9, .6], [0, .7]];
  for (const [u, v] of spots) { mk(G.sph, red, body, .38 * Math.sin(u) * Math.cos(v), .34 * Math.sin(v) + .02, .6 * Math.cos(u) * Math.cos(v) * -.6, .07, .07, .07); }
  const neck = new THREE.Group(); neck.position.set(0, .15, .45); body.add(neck);
  const n1 = limb(neck, 0, 0, 0, .065, .35, teal); n1.pv.rotation.x = -(Math.PI - .5);
  const n2 = limb(n1.end, 0, 0, 0, .055, .35, teal); n2.pv.rotation.x = -.35;
  const head = new THREE.Group(); n2.end.add(head); const HB = Math.PI - .5 + .35; head.rotation.x = HB;
  mk(G.sph, teal, head, 0, 0, 0, .12, .11, .13);
  const beak = mk(G.cone, white, head, 0, -.02, .23, .04, .34, .035); beak.rotation.x = Math.PI / 2;
  const crest = mk(G.cone, red, head, 0, .12, -.02, .05, .16, .05); crest.rotation.x = -.4;
  for (const s of [-1, 1]) { mk(G.sph, gold, head, s * .085, .03, .05, .03, .03, .03); mk(G.sph, dark, head, s * .1, .03, .055, .014, .014, .014); }
  const wings = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * .3, .12, .05); body.add(pv);
    mk(G.box, teal, pv, s * .35, 0, 0, .72, .05, .42);
    mk(G.box, red, pv, s * .35, .01, -.12, .6, .052, .07);
    const outer = new THREE.Group(); outer.position.x = s * .7; pv.add(outer);
    mk(G.box, teal2, outer, s * .3, 0, -.02, .6, .04, .34);
    for (let k = 0; k < 5; k++) { const f = mk(G.box, k % 2 ? red : teal, outer, s * (.5 + k * .06), 0, -.18 - k * .02, .38, .02, .07); f.rotation.y = -s * (.3 + k * .18); }
    wings.push({ pv, outer, s });
  }
  for (let k = 0; k < 5; k++) { const f = mk(G.box, k % 2 ? red : teal2, body, (k - 2) * .07, .05, -.85, .06, .02, .7); f.rotation.x = .35; f.rotation.y = (k - 2) * .12; }
  const flames = []; for (let k = 0; k < 3; k++) { const a = k * 2.1; flames.push(mk(G.cone, fire, root, Math.cos(a) * .15, .15, Math.sin(a) * .15, .07, .3, .07)); }
  return {
    root, anim(m, t) {
      const w = m.moveAmt, ph = m.walkPh;
      const hop = Math.abs(Math.sin(ph * 1.2)) * .22 * w;
      body.position.y = 1.35 + hop + Math.sin(t * 2 + m.seed) * .02; leg.pv.position.y = 1.25 + hop;
      shin.pv.rotation.x = -.15 - Math.sin(ph * 1.2) * .2 * w; leg.pv.rotation.x = .15;
      let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      const flap = Math.sin(t * (3 + ak * 10) + m.seed) * (.25 + ak * .6 + w * .3) + .15;
      wings.forEach(o => { o.pv.rotation.z = o.s * flap; o.outer.rotation.z = o.s * flap * .6; });
      neck.rotation.x = ak * .6 + Math.sin(t * 1.5 + m.seed) * .06; head.rotation.x = HB - ak * .4;
      flames.forEach((f, i) => { const k = .7 + .5 * Math.abs(Math.sin(t * 9 + i * 2)); f.scale.set(.07 * k, .3 * k, .07 * k); });
    }
  };
}

function buildSnake(M) { // 霕蛇
  const root = new THREE.Group();
  const s1 = M(0x45306e), s2 = M(0x5f43a0), belly = M(0xd9c46a), spike = M(0xc0362a), bone = M(0xe6dbb8), eye = glowM(M, 0xffe14a, 2.4), dark = M(0x100810), redM = M(0xd02040);
  const N = 15, segs = [];
  for (let i = 0; i < N; i++) {
    const r = .44 * (1 - i / N * .82) + .05; const g = new THREE.Group(); root.add(g);
    mk(G.sph, i % 2 ? s1 : s2, g, 0, 0, 0, r, r * .9, r * 1.25);
    mk(G.sph, belly, g, 0, -r * .35, 0, r * .8, r * .55, r * 1.1);
    if (i % 2 === 0 && i < N - 2) { const sp = mk(G.cone, spike, g, 0, r * .95, 0, r * .3, r * .7, r * .3); sp.rotation.x = -.5; }
    segs.push({ g, r });
  }
  const head = new THREE.Group(); root.add(head);
  mk(G.sph, s2, head, 0, .05, .1, .36, .26, .48);
  mk(G.sph, s1, head, 0, .16, 0, .3, .12, .36);
  const jaw = new THREE.Group(); jaw.position.set(0, -.06, -.1); head.add(jaw);
  mk(G.sph, belly, jaw, 0, -.05, .25, .28, .1, .38);
  for (const s of [-1, 1]) {
    mk(G.sph, eye, head, s * .22, .17, .3, .07, .055, .06); mk(G.box, dark, head, s * .26, .17, .32, .01, .06, .02);
    const h = mk(G.cone, bone, head, s * .18, .3, -.12, .05, .38, .05); h.rotation.x = -1.0; h.rotation.z = -s * .35;
    const f = mk(G.cone, bone, head, s * .1, -.08, .5, .022, .12, .022); f.rotation.x = Math.PI;
  }
  const tongue = new THREE.Group(); tongue.position.set(0, -.04, .55); head.add(tongue);
  mk(G.box, redM, tongue, 0, 0, .12, .02, .01, .24); mk(G.box, redM, tongue, .03, 0, .27, .015, .01, .08).rotation.y = .5; mk(G.box, redM, tongue, -.03, 0, .27, .015, .01, .08).rotation.y = -.5;
  return {
    root, anim(m, t) {
      const w = m.moveAmt; const sp = t * (2 + w * 4) + m.seed;
      let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      const lift = .7 + ak * .7;
      for (let i = 0; i < N; i++) { const s = segs[i]; const amp = .45 * Math.min(1, i / 3); s.g.position.set(Math.sin(sp - i * .55) * amp, s.r * .85 + Math.max(0, 1 - i / 4) * lift, -i * .46 + .1); }
      head.position.set(Math.sin(sp + .4) * .1, segs[0].r + lift + .25, .45 + ak * 1.3);
      head.rotation.x = -ak * .35; jaw.rotation.x = .1 + ak * .8;
      tongue.visible = Math.sin(t * 5 + m.seed) > .3; head.rotation.y = Math.sin(t * .9) * .2;
    }
  };
}

function buildJiangyi(M) { // 江疑: 符惕山之神, 风雨之主
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const robe = M(0x2b4c86), robe2 = M(0x1d335c), trim = M(0xd8b960, { metalness: .6, roughness: .4 }), skin = M(0xcfe6f2), hair = M(0xeef3ff), orbM = glowM(M, 0x8cf0ff, 2.8), ringM = glowM(M, 0xbff6ff, 2), eye = glowM(M, 0x6ff7ff, 3), cloud = M(0x6c7a90, { transparent: true, opacity: .9 });
  const rb = mk(G.cone, robe, body, 0, .95, 0, .62, 1.55, .62);
  const hem = mk(G.tor, trim, body, 0, .2, 0, .6, .6, .6); hem.rotation.x = Math.PI / 2;
  mk(G.cyl, trim, body, 0, 1.35, 0, .3, .08, .3);
  mk(G.sph, robe2, body, 0, 1.65, 0, .33, .38, .27);
  mk(G.cone, hair, body, 0, 1.92, .12, .14, .16, .08).rotation.x = Math.PI;
  const head = new THREE.Group(); head.position.set(0, 2.22, 0); head.scale.setScalar(1.3); body.add(head);
  mk(G.sph, skin, head, 0, 0, 0, .21, .24, .21);
  const hr = mk(G.cone, hair, head, 0, -.35, -.12, .22, .85, .12); hr.rotation.x = .12;
  mk(G.sph, hair, head, 0, .09, -.07, .215, .19, .19);
  for (const s of [-1, 1]) { mk(G.box, eye, head, s * .075, .02, .19, .06, .018, .02); }
  const beard = mk(G.cone, hair, head, 0, -.27, .1, .09, .3, .06); beard.rotation.x = Math.PI;
  for (let k = -1; k <= 1; k++) { const c = mk(G.cone, trim, head, k * .1, .26, 0, .035, .16, .035); c.rotation.z = -k * .3; }
  const arms = [];
  for (const s of [-1, 1]) { const a = limb(body, s * .33, 1.85, 0, .12, .55, robe, true); a.pv.rotation.z = s * .4; a.pv.rotation.x = -.9; mk(G.cone, robe2, a.end, 0, .02, 0, .16, .2, .16); mk(G.sph, skin, a.end, 0, -.1, 0, .06, .06, .06); arms.push(a); }
  const orb = new THREE.Group(); orb.position.set(0, 2.0, .62); body.add(orb);
  mk(G.sph, orbM, orb, 0, 0, 0, .17, .17, .17);
  const r1 = mk(G.tor, ringM, orb, 0, 0, 0, .27, .27, .27), r2 = mk(G.tor, ringM, orb, 0, 0, 0, .23, .23, .23);
  const clouds = [];
  for (let i = 0; i < 3; i++) { const c = new THREE.Group(); body.add(c); for (let k = 0; k < 4; k++) mk(G.sphLo, cloud, c, (k - 1.5) * .22, Math.sin(k * 2) * .06, Math.cos(k * 3) * .1, .22, .15, .2); clouds.push(c); }
  return {
    root, anim(m, t) {
      body.position.y = .55 + Math.sin(t * 1.6 + m.seed) * .15;
      let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      arms.forEach((a, i) => { a.pv.rotation.x = -.9 - ak * 1.3; });
      orb.position.y = 2.0 + ak * .7; orb.scale.setScalar(1 + ak * .5);
      r1.rotation.set(t * 2, t * 1.3, 0); r2.rotation.set(-t * 1.5, 0, t * 2.2);
      clouds.forEach((c, i) => { const a = t * .7 + i * 2.1; c.position.set(Math.cos(a) * 1.25, .6 + i * .7 + Math.sin(t + i) * .1, Math.sin(a) * 1.25); c.rotation.y = -a; });
      rb.rotation.y = Math.sin(t) * .1; head.rotation.y = Math.sin(t * .5 + m.seed) * .25;
    }
  };
}

function buildZhulong(M) { // 烛龙: 人面蛇身而赤, 直目正乘
  const root = new THREE.Group();
  const r1 = M(0xb3221a), r2 = M(0x8a1510), gold = M(0xe2b850, { metalness: .7, roughness: .35 }), face = M(0xeac3a0), dark = M(0x1a0a08), mane = M(0xff6a1a, { emissive: 0xff3a00, emissiveIntensity: 1.2 }), eye = glowM(M, 0xfff07a, 3), flame = M(0xffc04a, { emissive: 0xffa020, emissiveIntensity: 3, transparent: true, opacity: .9 }), white = M(0xf4efe4), belly = M(0xe6a84a);
  const N = 22, segs = [];
  for (let i = 0; i < N; i++) { const r = .95 * (1 - i / N * .78); const g = new THREE.Group(); root.add(g); mk(G.sph, i % 2 ? r1 : r2, g, 0, 0, 0, r, r, r * 1.2); mk(G.sph, belly, g, 0, -r * .4, 0, r * .75, r * .5, r * 1.05); if (i % 2 === 0) { const c = mk(G.cone, mane, g, 0, r * .95, 0, r * .3, r * .9, r * .3); c.rotation.x = -.6; } segs.push({ g, r }); }
  const head = new THREE.Group(); root.add(head);
  mk(G.sph, r1, head, 0, 0, 0, 1.15, 1.05, 1.05);
  mk(G.sph, face, head, 0, -.05, .62, .78, .85, .5);
  for (const s of [-1, 1]) {
    mk(G.sph, white, head, s * .3, .2, 1.04, .1, .25, .05); mk(G.sph, eye, head, s * .3, .2, 1.08, .045, .2, .03); mk(G.box, dark, head, s * .3, .5, 1.02, .22, .05, .05).rotation.z = s * .25;
    const h = mk(G.cone, gold, head, s * .55, .95, -.1, .1, .8, .1); h.rotation.z = -s * .4; h.rotation.x = -.5;
    const wh = mk(G.cone, mane, head, s * .5, -.6, .7, .04, .7, .04); wh.rotation.z = s * .9;
  }
  mk(G.cone, face, head, 0, .02, 1.13, .09, .25, .09).rotation.x = .3;
  mk(G.box, dark, head, 0, -.35, 1.05, .32, .06, .06);
  for (let k = 0; k < 9; k++) { const a = (k / 8 - .5) * 2.6; const c = mk(G.cone, mane, head, Math.sin(a) * .9, .5 + Math.cos(a) * .4, -.5, .2, 1.1, .2); c.rotation.x = -1.9; c.rotation.z = -Math.sin(a) * .8; }
  const candle = new THREE.Group(); candle.position.set(0, -.42, 1.2); head.add(candle);
  const cw = mk(G.cyl, white, candle, 0, .15, .1, .07, .45, .07); cw.rotation.x = -.6;
  const fl = mk(G.cone, flame, candle, 0, .45, .3, .1, .3, .1);
  const halo = mk(G.sph, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }), candle, 0, .45, .3, .35, .35, .35);
  return {
    root, anim(m, t) {
      const w = m.moveAmt; let ak = m.atkT >= 0 ? Math.sin(m.atkT * Math.PI) : 0;
      for (let i = 0; i < N; i++) { const s = segs[i]; s.g.position.set(Math.sin(t * 1.4 - i * .38 + m.seed) * 1.6 * Math.min(1, i / 4), 2.8 + Math.sin(t * 1.9 - i * .5) * .6 + i * .05, -i * .9 - .4); }
      head.position.set(Math.sin(t * 1.4 + m.seed + .3) * .3, 3.6 + Math.sin(t * 1.9 + .5) * .3 + ak * .6, .8 + ak * 1.2);
      head.rotation.x = -ak * .3 + Math.sin(t) * .05;
      fl.scale.set(.1, .3 + Math.sin(t * 12) * .06, .1); halo.scale.setScalar(.35 + Math.sin(t * 8) * .05 + ak * .3);
    }
  };
}

const MT = {
  xingxing: { name: '狌狌', build: buildXingxing, radius: .65, height: 2.0, speed: 3.4, range: 1.7, atkCd: 1.6, aggro: 13 },
  fox: { name: '九尾狐', build: buildFox, radius: .8, height: 1.7, speed: 5.2, range: 1.9, atkCd: 1.4, aggro: 16 },
  bifang: { name: '毕方', build: buildBifang, radius: .8, height: 2.9, speed: 3.6, range: 17, ranged: 'fire', atkCd: 2.6, aggro: 21, keep: 9 },
  snake: { name: '霕蛇', build: buildSnake, radius: 1.2, height: 2.0, speed: 4.2, range: 2.8, atkCd: 1.8, hpMul: 1.4, aggro: 16 },
  jiangyi: { name: '江疑', build: buildJiangyi, radius: .9, height: 3.3, speed: 3.0, range: 19, ranged: 'bolt', atkCd: 3.2, aggro: 23, keep: 11, fly: true },
  zhulong: { name: '烛龙', build: buildZhulong, radius: 2.4, height: 5.2, speed: 4.5, range: 22, ranged: 'fire3', atkCd: 2.8, hpMul: 7, dmgMul: 1.4, xpMul: 6, aggro: 30, boss: true, keep: 8, fly: true },
};

/* ---------------- particles ---------------- */
const PMAX = 900;
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
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
const _c = new THREE.Color();
function emit(x, y, z, vx, vy, vz, hex, size, life, grav = 0) {
  let i = parts.n < PMAX ? parts.n++ : Math.floor(Math.random() * PMAX);
  parts.pos.set([x, y, z], i * 3); parts.vel.set([vx, vy, vz], i * 3); _c.set(hex); parts.col.set([_c.r, _c.g, _c.b], i * 3);
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
function addFx(obj, life, upd) { if (obj) scene.add(obj); effects.push({ obj, t: 0, life, upd }); }
function updateFx(dt) { for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i]; e.t += dt; const k = e.t / e.life; if (k >= 1) { if (e.obj) scene.remove(e.obj); effects.splice(i, 1); continue; } e.upd && e.upd(k, dt, e); } }
const ringGeo = new THREE.RingGeometry(.8, 1, 48);
function shockRing(p, hex, r0, r1, life, op = .9) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += .15;
  addFx(m, life, k => { const r = lerp(r0, r1, easeOut(k)); m.scale.set(r, r, r); m.material.opacity = op * (1 - k); });
}
// slash arc (crescent) geometry with per-vertex t
function crescentGeo(r0, r1, a0, a1, n = 40) {
  const pos = [], tt = [], idx = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = lerp(a0, a1, u), th = Math.sin(u * Math.PI) * .9 + .1; const ri = lerp(r1, r0, th); pos.push(Math.cos(a) * ri, Math.sin(a) * ri, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0); tt.push(u, u); if (i) { const b = i * 2; idx.push(b - 2, b - 1, b, b - 1, b + 1, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('tt', new THREE.Float32BufferAttribute(tt, 1)); g.setIndex(idx); return g;
}
function slashMat(hex) { return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { prog: { value: 0 }, fade: { value: 1 }, col: { value: new THREE.Color(hex) } }, vertexShader: 'attribute float tt; varying float vT; void main(){ vT=tt; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float prog,fade; uniform vec3 col; varying float vT; void main(){ if(vT>prog) discard; float a=smoothstep(prog-.55,prog,vT)*fade; gl_FragColor=vec4(mix(col,vec3(1.),.5)*a,a); }' }); }
const ARC_WIDE = crescentGeo(1.5, 3.3, .2, Math.PI - .2), ARC_SMALL = crescentGeo(1.3, 2.3, .5, Math.PI - .5);
function slashArc(wide, tilt, dir, hex) { // dir: +1 right->left
  const holder = new THREE.Group(); holder.position.set(player.x, camY - (wide ? .5 : .4), player.z); holder.rotation.y = player.yaw;
  const tg = new THREE.Group(); tg.rotation.z = tilt; holder.add(tg);
  const m = new THREE.Mesh(wide ? ARC_WIDE : ARC_SMALL, slashMat(hex)); m.rotation.x = -Math.PI / 2 + .22; if (dir < 0) m.scale.x = -1; tg.add(m);
  addFx(holder, wide ? .42 : .3, k => { m.material.uniforms.prog.value = Math.min(1.25, k * 2.2); m.material.uniforms.fade.value = k < .5 ? 1 : 1 - (k - .5) * 2; holder.position.set(player.x, camY - (wide ? .5 : .4), player.z); });
}
function lightning(p) {
  const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xcff8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  let a = V3(p.x + rand(-2, 2), p.y + 30, p.z + rand(-2, 2));
  for (let i = 0; i < 10; i++) { const b = i === 9 ? p.clone() : V3(lerp(a.x, p.x, .3) + rand(-1.5, 1.5), a.y - 3, lerp(a.z, p.z, .3) + rand(-1.5, 1.5)); const len = a.distanceTo(b); const c = new THREE.Mesh(G.cyl, mat); c.scale.set(.12, len, .12); c.position.copy(a).add(b).multiplyScalar(.5); c.quaternion.setFromUnitVectors(Y_AXIS, b.clone().sub(a).normalize()); g.add(c); a = b; }
  addFx(g, .35, k => { mat.opacity = (1 - k) * (Math.random() < .3 ? .3 : 1); });
  burst(p, 24, 0x9ff4ff, 8, .5, .5, -8, .6);
}

/* ---------------- floating numbers & labels ---------------- */
const labelsEl = $('labels');
const dnums = [];
const _v = V3();
function project(p) { _v.copy(p).project(camera); if (_v.z > 1 || _v.z < -1) return null; return { x: (_v.x * .5 + .5) * innerWidth, y: (-_v.y * .5 + .5) * innerHeight }; }
function showNum(p, txt, cls) { const el = document.createElement('div'); el.className = 'dn ' + cls; el.textContent = txt; labelsEl.appendChild(el); dnums.push({ el, p: p.clone().add(V3(rand(-.4, .4), 0, rand(-.4, .4))), t: 0, dx: rand(-20, 20) }); }
function updateNums(dt) { for (let i = dnums.length - 1; i >= 0; i--) { const d = dnums[i]; d.t += dt; if (d.t > 1.0) { d.el.remove(); dnums.splice(i, 1); continue; } const s = project(d.p); if (!s) { d.el.style.opacity = 0; continue; } const k = d.t; const sc = k < .12 ? 1.6 - k * 5 : 1; d.el.style.transform = `translate(${s.x + d.dx * k - 15}px,${s.y - 40 * k - 20}px) scale(${sc})`; d.el.style.opacity = k < .7 ? 1 : 1 - (k - .7) / .3; } }
function screenNum(txt, cls, x, y) { const el = document.createElement('div'); el.className = 'dn ' + cls; el.textContent = txt; labelsEl.appendChild(el); const t0 = performance.now(); const f = () => { const k = (performance.now() - t0) / 900; if (k >= 1) { el.remove(); return; } el.style.transform = `translate(${x}px,${y - 30 * k}px)`; el.style.opacity = 1 - k * k; requestAnimationFrame(f); }; f(); }
let bannerT = 0; function banner(t, s, dur = 2.2) { $('banner').querySelector('b').textContent = t; $('banner').querySelector('span').textContent = s || ''; $('banner').style.opacity = 1; bannerT = dur; }
let toastT = 0; function toast(t) { $('toast').textContent = t; $('toast').style.opacity = 1; toastT = 1.6; }

/* ---------------- audio (synth) ---------------- */
let actx = null, noiseBuf = null;
function initAudio() { try { actx = new (window.AudioContext || window.webkitAudioContext)(); noiseBuf = actx.createBuffer(1, actx.sampleRate * .5, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { actx = null; } }
function sfx(type) {
  if (!actx) return; const t = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
  if (type === 'swish' || type === 'whoosh') { const s = actx.createBufferSource(); s.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; const L = type === 'whoosh' ? .5 : .22; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3500, t + L); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .04); g.gain.exponentialRampToValueAtTime(.0001, t + L); s.connect(f); f.connect(g); s.start(t); s.stop(t + L); }
  else if (type === 'hit' || type === 'boom') { const o = actx.createOscillator(); o.type = 'triangle'; const L = type === 'boom' ? .7 : .15; o.frequency.setValueAtTime(type === 'boom' ? 120 : 260, t); o.frequency.exponentialRampToValueAtTime(40, t + L); g.gain.setValueAtTime(type === 'boom' ? .6 : .25, t); g.gain.exponentialRampToValueAtTime(.0001, t + L); o.connect(g); o.start(t); o.stop(t + L); const s = actx.createBufferSource(); s.buffer = noiseBuf; const g2 = actx.createGain(); g2.gain.setValueAtTime(type === 'boom' ? .5 : .15, t); g2.gain.exponentialRampToValueAtTime(.0001, t + L * .7); s.connect(g2); g2.connect(actx.destination); s.start(t); s.stop(t + L); }
  else if (type === 'level') { [523, 659, 784, 1046].forEach((f, i) => { const o = actx.createOscillator(), gg = actx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.setValueAtTime(.0001, t + i * .09); gg.gain.exponentialRampToValueAtTime(.2, t + i * .09 + .02); gg.gain.exponentialRampToValueAtTime(.0001, t + i * .09 + .5); o.connect(gg); gg.connect(actx.destination); o.start(t + i * .09); o.stop(t + i * .09 + .55); }); }
  else if (type === 'hurt') { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + .2); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); o.start(t); o.stop(t + .2); }
  else if (type === 'ding') { const o = actx.createOscillator(); o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(2200, t + .3); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(g); o.start(t); o.stop(t + .6); }
}

/* ---------------- player ---------------- */
const player = { x: SPAWN.x, z: SPAWN.z, yaw: .7, pitch: -.04, lv: 1, xp: 0, hp: 120, maxHp: 120, atk: 14, dead: false, riding: false, rideT: 0, lastHurt: -99, moveAmt: 0, bob: 0, deadT: 0 };
let rideTilt = 0, camY = H(SPAWN.x, SPAWN.z) + 1.7, gameT = 0, state = 'title', shake = 0, yawVel = 0;
const needXp = l => Math.round(25 * Math.pow(l, 1.55) + 20);
function recalc() { const L = player.lv - 1; player.maxHp = Math.round(120 + 32 * L + .25 * L * L); player.atk = Math.round(14 + 4.2 * L + .02 * L * L); }
const fwd = () => V3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
const ppos = () => V3(player.x, camY - .5, player.z);

/* ---------------- monsters ---------------- */
const monsters = [];
function makeMonster(type, lv, x, z, area) {
  const def = MT[type]; const M = matFactory(); const b = def.build(M);
  const sc = 1 + clamp((lv - area.lv[0]) / Math.max(1, area.lv[1] - area.lv[0]), 0, 1) * .18;
  b.root.scale.setScalar(sc);
  const holder = new THREE.Group(); holder.add(b.root); scene.add(holder);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(def.radius * sc * 1.1, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .06; holder.add(sh);
  const hp = Math.round((45 + 20 * Math.pow(lv, 1.18)) * (def.hpMul || 1));
  const el = document.createElement('div'); el.className = 'ml' + (def.boss ? ' boss' : ''); el.innerHTML = `<div class="mn">${def.name}<small>Lv${lv}</small></div><div class="mb"><i></i></div>`; labelsEl.appendChild(el);
  const m = { type, def, lv, sc, holder, b, mats: M.list, hp, maxHp: hp, dmg: Math.round((5 + 2.4 * lv) * (def.dmgMul || 1)), xp: Math.round((12 + 6 * Math.pow(lv, 1.3)) * (def.xpMul || 1) * 1.4), home: V3(x, 0, z), x, z, yaw: rand(0, 6.28), dead: false, deadT: 0, atkCd: rand(0, 1), atkT: -1, atkDone: false, moveAmt: 0, walkPh: 0, seed: rand(0, 100), flash: 0, aggroT: 0, wander: null, wanderT: rand(1, 4), el, barEl: el.querySelector('i'), nameEl: el.querySelector('.mn'), returning: false, area, lastBar: -1 };
  monsters.push(m); placeMonster(m); return m;
}
function placeMonster(m) { const y = H(m.x, m.z); m.holder.position.set(m.x, m.def.fly ? Math.max(y, 0) : Math.max(y, -.6), m.z); m.holder.rotation.y = m.yaw; }
function spawnAll() {
  for (const a of AREAS) {
    const groups = [{ type: a.type, n: a.n, lv: a.lv }]; if (a.extra) groups.push(a.extra);
    for (const gr of groups) for (let i = 0; i < gr.n; i++) {
      let x, z, tries = 0; do { const ang = rand(0, 6.28), r = rand(4, gr.type === 'zhulong' ? 10 : 20); x = a.x + Math.cos(ang) * r; z = a.z + Math.sin(ang) * r; } while (H(x, z) < .3 && tries++ < 40);
      makeMonster(gr.type, Math.round(rand(gr.lv[0], gr.lv[1])), x, z, a);
    }
  }
}
function setFlash(m, k) { for (const mt of m.mats) { if (mt.userData.glow) continue; mt.emissive.setRGB(k, k * .9, k * .8); mt.emissiveIntensity = 1; } }
const monsterProj = [];
function monsterShoot(m, kind) {
  const from = V3(m.x, m.holder.position.y + m.def.height * m.sc * .75, m.z).add(V3(Math.sin(m.yaw), 0, Math.cos(m.yaw)).multiplyScalar(m.def.radius));
  if (kind === 'bolt') { // telegraph then lightning at player pos
    const p = V3(player.x, H(player.x, player.z), player.z); if (p.y < 0) p.y = 0;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(p).y += .12;
    addFx(ring, .85, (k, dt, e) => { const r = 2.4 * (1 - k * .3); ring.scale.set(r, r, r); ring.material.opacity = .4 + .5 * Math.abs(Math.sin(k * 20)); if (k > .97 && !e.done) { e.done = true; lightning(p); sfx('boom'); if (!player.dead && Math.hypot(player.x - p.x, player.z - p.z) < 2.4) hurtPlayer(m.dmg * 1.3); } });
    return;
  }
  const n = kind === 'fire3' ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const target = V3(player.x, camY - .6, player.z); const dir = target.sub(from).normalize();
    if (n > 1) dir.applyAxisAngle(Y_AXIS, (i - 1) * .2);
    const mesh = new THREE.Mesh(G.sphLo, new THREE.MeshBasicMaterial({ color: kind === 'fire3' ? 0xff6a2a : 0xffa030 })); mesh.scale.setScalar(kind === 'fire3' ? .55 : .35); mesh.position.copy(from); scene.add(mesh);
    monsterProj.push({ mesh, vel: dir.multiplyScalar(kind === 'fire3' ? 15 : 13), t: 0, dmg: m.dmg, col: kind === 'fire3' ? 0xff5020 : 0xff9a30 });
  }
}
function updateMonsterProj(dt) {
  for (let i = monsterProj.length - 1; i >= 0; i--) {
    const p = monsterProj[i]; p.t += dt; p.mesh.position.addScaledVector(p.vel, dt);
    const mp = p.mesh.position; emit(mp.x, mp.y, mp.z, rand(-.5, .5), rand(0, 1), rand(-.5, .5), p.col, .55, .35, 1);
    const hit = !player.dead && Math.hypot(mp.x - player.x, mp.z - player.z) < .9 && Math.abs(mp.y - (camY - .6)) < 1.3;
    if (hit || p.t > 3 || mp.y < H(mp.x, mp.z)) { if (hit) hurtPlayer(p.dmg); burst(mp, 14, p.col, 5, .5, .45, -4); scene.remove(p.mesh); monsterProj.splice(i, 1); }
  }
}
function updateMonsters(dt) {
  for (const m of monsters) {
    const dx = player.x - m.x, dz = player.z - m.z, dist = Math.hypot(dx, dz);
    const far = dist > (m.def.boss ? 120 : 80);
    m.holder.visible = dist < (m.def.boss ? 120 : 80);
    if (m.dead) {
      m.deadT += dt;
      if (m.deadT < 1.2) { const k = m.deadT / 1.2; m.b.root.rotation.z = easeOut(Math.min(1, k * 1.5)) * 1.4; m.b.root.position.y = -k * .6; }
      else m.holder.visible = false;
      if (m.deadT > 22) respawnMonster(m);
      continue;
    }
    if (far) { m.el.style.display = 'none'; continue; }
    const d = m.def; let moving = false;
    if (m.flash > 0) { m.flash = Math.max(0, m.flash - dt * 5); setFlash(m, m.flash * .8); }
    m.aggroT -= dt;
    const homeD = Math.hypot(m.x - m.home.x, m.z - m.home.z);
    const aggro = !player.dead && (dist < d.aggro || m.aggroT > 0);
    if (homeD > 45) { m.returning = true; m.aggroT = 0; }
    if (m.returning && homeD < 3) { m.returning = false; m.hp = m.maxHp; }
    let tx = null, tz = null, sp = d.speed;
    m.atkCd -= dt;
    if (m.atkT >= 0) {
      m.atkT += dt / (d.ranged ? .7 : .55);
      if (m.atkT > .5 && !m.atkDone) { m.atkDone = true; if (d.ranged) monsterShoot(m, d.ranged); else if (dist < d.range + d.radius * m.sc + .6 && !player.dead) hurtPlayer(m.dmg); }
      if (m.atkT >= 1) m.atkT = -1;
      m.yaw += angDiff(m.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
    } else if (m.returning) { tx = m.home.x; tz = m.home.z; sp *= 1.4; }
    else if (aggro) {
      m.yaw += angDiff(m.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      const reach = d.range + d.radius * m.sc;
      if (dist <= reach && m.atkCd <= 0) { m.atkT = 0; m.atkDone = false; m.atkCd = d.atkCd * rand(.85, 1.15); }
      else if (d.keep ? dist > d.keep : dist > reach * .85) { tx = player.x; tz = player.z; }
    } else {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = rand(3, 7); m.wander = Math.random() < .6 ? V3(m.home.x + rand(-12, 12), 0, m.home.z + rand(-12, 12)) : null; }
      if (m.wander) { tx = m.wander.x; tz = m.wander.z; sp *= .4; if (Math.hypot(tx - m.x, tz - m.z) < 1) m.wander = null; }
    }
    if (tx !== null) {
      const ddx = tx - m.x, ddz = tz - m.z, dd = Math.hypot(ddx, ddz);
      if (dd > .3) {
        m.yaw += angDiff(m.yaw, Math.atan2(ddx, ddz)) * Math.min(1, dt * 5);
        const nx = m.x + Math.sin(m.yaw) * sp * dt, nz = m.z + Math.cos(m.yaw) * sp * dt;
        if (d.fly || H(nx, nz) > -.7) { m.x = nx; m.z = nz; moving = true; } else m.wander = null;
      }
    }
    // separation
    for (const o of monsters) { if (o === m || o.dead) continue; const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz), mn = (m.def.radius * m.sc + o.def.radius * o.sc) * .9; if (od < mn && od > 1e-3) { m.x += ox / od * (mn - od) * .5; m.z += oz / od * (mn - od) * .5; } }
    m.moveAmt += ((moving ? (sp > d.speed * .6 ? 1 : .5) : 0) - m.moveAmt) * Math.min(1, dt * 6);
    m.walkPh += dt * sp * 2.2 * (moving ? 1 : 0);
    placeMonster(m);
    m.b.anim(m, gameT, dt);
    // label
    const lp = V3(m.x, m.holder.position.y + d.height * m.sc + .35, m.z);
    const s = dist < 55 ? project(lp) : null;
    if (s) {
      const sc = clamp(14 / Math.max(dist, 4), .55, 1.15);
      m.el.style.display = 'block'; m.el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%) scale(${sc})`;
      const r = Math.max(0, m.hp / m.maxHp); if (r !== m.lastBar) { m.barEl.style.width = (r * 100) + '%'; m.lastBar = r; }
      const diff = m.lv - player.lv; const c = diff > 8 ? '#ff5a4a' : diff > 2 ? '#ffd24a' : diff < -10 ? '#b9c2cc' : '#ffffff';
      if (m.nameEl.style.color !== c) m.nameEl.style.color = c;
    } else m.el.style.display = 'none';
  }
}
function respawnMonster(m) {
  m.dead = false; m.hp = m.maxHp; m.x = m.home.x + rand(-6, 6); m.z = m.home.z + rand(-6, 6); if (!m.def.fly && H(m.x, m.z) < .2) { m.x = m.home.x; m.z = m.home.z; }
  m.b.root.rotation.z = 0; m.b.root.position.y = 0; m.holder.visible = true; m.atkT = -1; m.returning = false; m.aggroT = 0; m.lastBar = -1;
  m.b.root.scale.setScalar(.01); addFx(null, .5, k => m.b.root.scale.setScalar(m.sc * easeOut(k) + .01)); setTimeout(() => m.b.root.scale.setScalar(m.sc), 520);
  burst(V3(m.x, H(m.x, m.z) + 1, m.z), 20, 0xb0e0ff, 4, .5, .8, 1);
}
function mCenter(m) { return V3(m.x, m.holder.position.y + m.def.height * m.sc * .5, m.z); }
function hitMonster(m, base, kind) {
  if (m.dead) return;
  const crit = Math.random() < .15; const d = Math.round(base * (crit ? 1.8 : 1) * rand(.92, 1.08));
  m.hp -= d; m.flash = 1; m.aggroT = 12; m.returning = false;
  const c = mCenter(m);
  showNum(V3(m.x, m.holder.position.y + m.def.height * m.sc * .8, m.z), d, kind === 'ult' ? 'big' : crit ? 'crit' : 'n');
  burst(c, kind === 'ult' ? 40 : 14, crit ? 0xffd040 : 0xbfe8ff, kind === 'ult' ? 12 : 6, .45, .4, -6);
  if (!m.def.boss) { const f = V3(m.x - player.x, 0, m.z - player.z).normalize().multiplyScalar(kind === 'ult' ? 1.2 : .45); const nx = m.x + f.x, nz = m.z + f.z; if (m.def.fly || H(nx, nz) > -.6) { m.x = nx; m.z = nz; } }
  sfx('hit');
  if (m.hp <= 0) killMonster(m);
}
function killMonster(m) {
  m.dead = true; m.deadT = 0; m.hp = 0; m.el.style.display = 'none'; setFlash(m, 0); m.flash = 0;
  let xp = m.xp; if (m.lv < player.lv - 8) xp = Math.max(1, Math.round(xp * .25));
  burst(mCenter(m), 30, 0xffe9a0, 5, .6, 1, 2);
  showNum(V3(m.x, m.holder.position.y + m.def.height * m.sc + .8, m.z), '+' + xp + ' 经验', 'xp');
  gainXp(xp);
  if (m.def.boss) banner('击败 烛龙', '钟山之神已被斩落！');
}
function gainXp(x) {
  if (player.lv >= 100) return;
  player.xp += x; let up = false;
  while (player.lv < 100 && player.xp >= needXp(player.lv)) { player.xp -= needXp(player.lv); player.lv++; up = true; }
  if (player.lv >= 100) player.xp = 0;
  if (up) { recalc(); player.hp = player.maxHp; levelUpFx(); }
  hudDirty = true;
}
function levelUpFx() {
  sfx('level'); banner('等级提升', `Lv ${player.lv}　气血 ${player.maxHp}　攻击 ${player.atk}`);
  const p = V3(player.x, H(player.x, player.z), player.z); if (p.y < 0) p.y = 0;
  shockRing(p, 0xffd860, .5, 6, 1.0); shockRing(p, 0xfff2b0, .3, 3.5, .8);
  for (let i = 0; i < 60; i++) { const a = rand(0, 6.28), r = rand(.6, 1.6); emit(p.x + Math.cos(a) * r, p.y + rand(0, 1), p.z + Math.sin(a) * r, 0, rand(2, 5), 0, Math.random() < .5 ? 0xffd860 : 0xfff6c8, .35, 1.4, 0); }
  $('flash').style.transition = 'none'; $('flash').style.background = '#ffe9a0'; $('flash').style.opacity = .35; requestAnimationFrame(() => { $('flash').style.transition = 'opacity .8s'; $('flash').style.opacity = 0; });
}
function hurtPlayer(d) {
  if (player.dead) return; d = Math.round(d * rand(.9, 1.1));
  player.hp -= d; player.lastHurt = gameT; shake = Math.max(shake, .25); hudDirty = true; sfx('hurt');
  screenNum('-' + d, 'hurt', innerWidth * .5 + rand(-40, 40), innerHeight * .42);
  $('vign').style.opacity = .9; setTimeout(() => $('vign').style.opacity = player.hp / player.maxHp < .3 ? .45 : 0, 160);
  if (player.hp <= 0) { player.hp = 0; die(); }
}
function die() {
  player.dead = true; player.deadT = 3.5; if (player.riding) endRide(true);
  $('dead').style.display = 'flex';
  for (const m of monsters) { m.aggroT = 0; m.returning = true; }
}
function respawn() {
  player.dead = false; player.x = SPAWN.x; player.z = SPAWN.z; player.hp = player.maxHp; hudDirty = true; $('dead').style.display = 'none'; $('vign').style.opacity = 0;
  shockRing(V3(player.x, H(player.x, player.z), player.z), 0x9fe8ff, .5, 4, .8);
}

/* ---------------- view-model animation ---------------- */
const VM = { act: null, t: 0, dur: 1, keys: null, lkeys: null, events: [], fired: 0 };
function playVM(name, dur, keys, lkeys, events = []) { VM.act = name; VM.t = 0; VM.dur = dur; VM.keys = keys; VM.lkeys = lkeys; VM.events = events.slice().sort((a, b) => a.at - b.at); VM.fired = 0; }
const _q = new THREE.Quaternion(), _p = V3();
function sampleKeys(keys, k, outP, outQ) {
  let i = 0; while (i < keys.length - 2 && k > keys[i + 1].k) i++;
  const a = keys[i], b = keys[i + 1]; const u = easeIO(clamp((k - a.k) / Math.max(1e-4, b.k - a.k), 0, 1));
  outP.lerpVectors(a.p, b.p, u); outQ.slerpQuaternions(a.q, b.q, u);
}
const vmR = { p: V3(), q: new THREE.Quaternion() }, vmL = { p: V3(), q: new THREE.Quaternion() };
let swordInHand = true, slashFlip = false, swordGlow = 0;
function updateVM(dt) {
  let kR = R_IDLE, kL = L_IDLE;
  if (VM.act) {
    VM.t += dt; const k = Math.min(1, VM.t / VM.dur);
    while (VM.fired < VM.events.length && VM.events[VM.fired].at <= k) VM.events[VM.fired++].fn();
    if (VM.keys) sampleKeys(VM.keys, k, vmR.p, vmR.q); else { vmR.p.copy(R_IDLE.p); vmR.q.copy(R_IDLE.q); }
    if (VM.lkeys) sampleKeys(VM.lkeys, k, vmL.p, vmL.q); else { vmL.p.copy(L_IDLE.p); vmL.q.copy(L_IDLE.q); }
    if (k >= 1) { VM.act = null; }
  } else {
    const rp = player.riding ? RIDE_R : R_IDLE;
    vmR.p.lerp(rp.p, Math.min(1, dt * 10)); vmR.q.slerp(rp.q, Math.min(1, dt * 10));
    vmL.p.lerp(kL.p, Math.min(1, dt * 10)); vmL.q.slerp(kL.q, Math.min(1, dt * 10));
  }
  const ph = player.bob, w = player.moveAmt * (player.riding ? .25 : 1), br = Math.sin(gameT * 1.8) * .004;
  const bx = Math.cos(ph) * .014 * w, by = -Math.abs(Math.sin(ph)) * .016 * w + br;
  const sway = clamp(-yawVel * .012, -.05, .05);
  rHand.position.set(vmR.p.x + bx + sway, vmR.p.y + by, vmR.p.z); rHand.quaternion.copy(vmR.q);
  lHand.position.set(vmL.p.x + bx * .8 + sway, vmL.p.y + by * 1.1 - br, vmL.p.z); lHand.quaternion.copy(vmL.q);
  placeForearm(rFore, rHand, V3(.006, 0, -.035), R_ELBOW); placeForearm(lFore, lHand, V3(0, 0, -.035), L_ELBOW);
  vSword.g.visible = swordInHand;
  if (vSword.tassel) { vSword.tassel.rotation.x = Math.sin(gameT * 3) * .2 + w * Math.sin(ph * 2) * .3; vSword.tassel.rotation.z = Math.cos(gameT * 2.3) * .15 - sway * 3; }
  swordGlow = Math.max(0, swordGlow - dt * 1.5);
  vSword.bladeM.emissiveIntensity = Math.min(1.3, swordGlow * .9);
  vRoot.position.y = player.riding ? -.02 : 0;
}
const RIDE_R = RK(0, [.25, -.17, -.52], [.1, .95, -.2], [.5, -.8, .4]);

/* ---------------- targeting / combat helpers ---------------- */
function monstersInCone(range, halfAng) {
  const f = fwd(), out = [];
  for (const m of monsters) { if (m.dead) continue; const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz) - m.def.radius * m.sc; if (d > range) continue; const a = Math.acos(clamp((dx * f.x + dz * f.z) / Math.max(1e-3, Math.hypot(dx, dz)), -1, 1)); if (a <= halfAng || d < .6) out.push(m); }
  return out;
}
function pickTarget(maxD = 40) {
  const f = fwd(); let best = null, bs = 1e9;
  for (const m of monsters) { if (m.dead) continue; const dx = m.x - player.x, dz = m.z - player.z, d = Math.hypot(dx, dz); if (d > maxD) continue; const a = Math.acos(clamp((dx * f.x + dz * f.z) / Math.max(1e-3, d), -1, 1)); if (a > 1.2) continue; const s = d + a * 18; if (s < bs) { bs = s; best = m; } }
  return best;
}
const SK = { atk: { cd: .42, t: 0 }, s1: { cd: 5, t: 0 }, s2: { cd: 7, t: 0 }, s3: { cd: 16, t: 0 }, ride: { cd: 8, t: 0 } };
let pendingSkill = null;
function canAct() { return !player.dead && state === 'play'; }
function tryCast(id) {
  if (!canAct()) return false;
  if (player.riding && id !== 'ride') { endRide(); pendingSkill = id; return false; }
  const s = SK[id]; if (s.t > 0) { if (id !== 'atk') toast('技能冷却中'); return false; }
  if (id !== 'ride' && (!swordInHand || (VM.act && VM.act !== 'atk'))) { if (!swordInHand && id !== 'atk') toast('飞剑未归'); return false; }
  if (id === 'atk' && VM.act) return false;
  ({ atk: doAttack, s1: doZhanma, s2: doFeijian, s3: doUlt, ride: toggleRide })[id]();
  return true;
}
function doAttack() {
  SK.atk.t = SK.atk.cd; slashFlip = !slashFlip; sfx('swish');
  const keys = slashFlip ? [R_IDLE, RK(.3, [.36, .02, -.55], [.45, .85, .25], [.5, -.5, .7]), RK(.65, [-.2, -.17, -.55], [-.9, -.35, -.4], [.8, -.35, .5]), { ...R_IDLE, k: 1 }]
    : [R_IDLE, RK(.3, [-.16, -.16, -.55], [-.9, -.15, -.4], [.8, -.4, .45]), RK(.65, [.36, .0, -.55], [.7, .65, -.3], [.45, -.6, .65]), { ...R_IDLE, k: 1 }];
  playVM('atk', .4, keys, null, [{ at: .42, fn: () => { slashArc(false, slashFlip ? .55 : -.5, slashFlip ? 1 : -1, 0xbfe6ff); for (const m of monstersInCone(3.4, .75)) hitMonster(m, player.atk, 'atk'); } }]);
}
function doZhanma() {
  SK.s1.t = SK.s1.cd; swordGlow = 1; sfx('whoosh');
  const keys = [R_IDLE, RK(.25, [.4, -.12, -.5], [1, .1, -.15], [.3, -.6, .75]), RK(.45, [0, -.14, -.56], [-.25, .12, -1], [.5, -.7, .5]), RK(.66, [-.38, -.12, -.5], [-1, .05, -.2], [.8, -.5, .3]), { ...R_IDLE, k: 1 }];
  const lk = [L_IDLE, LK(.3, [-.32, -.3, -.5], [-.3, .5, -.8], [-.25, -.35, 1]), LK(.7, [-.32, -.3, -.5], [-.3, .5, -.8], [-.25, -.35, 1]), { ...L_IDLE, k: 1 }];
  playVM('s1', .62, keys, lk, [{ at: .38, fn: () => { slashArc(true, 0, 1, 0x7fd8ff); shake = Math.max(shake, .12); let n = 0; for (const m of monstersInCone(5.6, 1.05)) { hitMonster(m, player.atk * 2.6, 's1'); n++; } } }]);
}
/* flying sword */
const fly = { active: false, phase: 0, pos: V3(), dir: V3(), dist: 0, hit: new Set(), obj: buildSword({ scale: 1.9 }), roll: 0, t: 0 };
fly.obj.bladeM.emissive.set(0x7fd8ff); fly.obj.bladeM.emissiveIntensity = .9; fly.obj.g.visible = false; scene.add(fly.obj.g);
function doFeijian() {
  SK.s2.t = SK.s2.cd; swordGlow = 1;
  const keys = [R_IDLE, RK(.35, [.22, -.12, -.55], [.1, .2, -1], [.5, -.6, .7]), RK(.55, [.18, -.13, -.72], [0, .05, -1], [.4, -.5, .8]), { ...R_IDLE, k: 1 }];
  const lk = [L_IDLE, LK(.4, [-.1, -.12, -.6], [.05, .25, -1], [0, .4, .9]), LK(1, [-.12, -.13, -.6], [.05, .25, -1], [0, .4, .9])];
  playVM('s2', .45, keys, lk, [{ at: .55, fn: launchFly }]);
}
function launchFly() {
  swordInHand = false; sfx('whoosh');
  const f = fwd(); const r = V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  fly.active = true; fly.phase = 0; fly.dist = 0; fly.t = 0; fly.hit.clear();
  fly.pos.set(player.x, camY - .35, player.z).addScaledVector(r, .25).addScaledVector(f, .8);
  fly.dir.copy(f); fly.obj.g.visible = true;
}
function updateFly(dt) {
  if (!fly.active) return;
  fly.t += dt; const SP = fly.phase === 0 ? 34 : 40;
  if (fly.phase === 0) { fly.pos.addScaledVector(fly.dir, SP * dt); fly.dist += SP * dt; const gy = H(fly.pos.x, fly.pos.z); if (fly.pos.y < gy + .5) fly.pos.y = gy + .5; if (fly.dist > 26) { fly.phase = 1; fly.hit.clear(); } }
  else { const target = V3(player.x, camY - .4, player.z); const d = target.clone().sub(fly.pos); const len = d.length(); const SPr = Math.max(SP, len * 2.5); if (len < 1.2) { fly.active = false; fly.obj.g.visible = false; swordInHand = true; swordGlow = .8; sfx('ding'); playVM('catch', .25, [RK(0, [.22, -.14, -.7], [0, .3, -1]), { ...R_IDLE, k: 1 }], null); return; } fly.dir.copy(d.normalize()); fly.pos.addScaledVector(fly.dir, Math.min(len, SPr * dt)); }
  fly.roll += dt * 2;
  const q = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, fly.dir); q.multiply(new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI / 2 + Math.sin(fly.roll) * .3));
  fly.obj.g.quaternion.copy(q); fly.obj.g.position.copy(fly.pos).addScaledVector(fly.dir, -1.0);
  for (let i = 0; i < 3; i++) { const b = fly.pos.clone().addScaledVector(fly.dir, -rand(0, 1.6)); emit(b.x, b.y, b.z, rand(-.3, .3), rand(-.3, .3), rand(-.3, .3), 0x8fe0ff, .3, .35, 0); }
  for (const m of monsters) { if (m.dead || fly.hit.has(m)) continue; const c = mCenter(m); const dx = c.x - fly.pos.x, dz = c.z - fly.pos.z; if (Math.hypot(dx, dz) < m.def.radius * m.sc + .9 && Math.abs(c.y - fly.pos.y) < m.def.height * m.sc * .7 + .6) { fly.hit.add(m); hitMonster(m, player.atk * 3, 's2'); } }
}
/* ultimate 锋芒毕露 */
const GS = 9; const giant = buildSword({ scale: GS }); giant.g.scale.set(GS * 2.8, GS, GS * 2.8);
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 80, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.visible = false; scene.add(beam); giant.bladeM.emissive.set(0xffe08a); giant.g.visible = false; scene.add(giant.g);
const ult = { active: false, t: 0, target: null, pt: V3(), hit: false, mark: null };
function doUlt() {
  SK.s3.t = SK.s3.cd;
  const tgt = pickTarget(42); ult.target = tgt;
  if (tgt) ult.pt.set(tgt.x, 0, tgt.z); else { const f = fwd(); ult.pt.set(player.x + f.x * 12, 0, player.z + f.z * 12); }
  const C = RK(.2, [.02, -.2, -.85], [0, 1, 0], [.05, -1, .3]);
  const keys = [R_IDLE, C, { ...C, k: .82 }, { ...R_IDLE, k: 1 }];
  const LC = LK(.25, [-.085, -.18, -.8], [.05, 1, -.1], [0, -.1, 1]);
  const lk = [L_IDLE, LC, { ...LC, k: .8 }, { ...L_IDLE, k: 1 }];
  sfx('ding');
  vSword.bladeM.emissive.set(0xffc860);
  playVM('s3', 2.3, keys, lk, [{ at: .12, fn: () => { swordGlow = 1; } }, { at: .3, fn: startGiant }, { at: .5, fn: () => { swordGlow = .8; } }, { at: .99, fn: () => vSword.bladeM.emissive.set(0x66ccff) }]);
}
function startGiant() {
  ult.active = true; ult.t = 0; ult.hit = false; giant.g.visible = true; giant.g.rotation.set(Math.PI, 0, 0); giant.bladeM.emissiveIntensity = .6;
  ult.mark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ult.mark.rotation.x = -Math.PI / 2; scene.add(ult.mark); sfx('whoosh');
}
function updateUlt(dt) {
  if (!ult.active) return;
  ult.t += dt;
  if (ult.target && !ult.target.dead && !ult.hit) ult.pt.set(ult.target.x, 0, ult.target.z);
  const gy = Math.max(H(ult.pt.x, ult.pt.z), 0); const L = (BLADE_LEN + GUARD_Y) * GS;
  const endY = gy + L - 1.6, startY = endY + 40;
  const DESC = .55, HOLD = 1.1;
  ult.mark.position.set(ult.pt.x, gy + .15, ult.pt.z); const mr = 3.2 + Math.sin(ult.t * 18) * .2; ult.mark.scale.set(mr, mr, mr);
  let y;
  if (ult.t < DESC) { const k = ult.t / DESC; y = lerp(startY, endY, k * k * k); }
  else { y = endY; if (!ult.hit) { ult.hit = true; impactUlt(gy); } }
  giant.g.position.set(ult.pt.x, y, ult.pt.z);
  beam.visible = true; beam.position.set(ult.pt.x, gy + 40, ult.pt.z); beam.material.opacity = ult.t < DESC ? .25 * (ult.t / DESC) : Math.max(0, .25 - (ult.t - DESC) * .3);
  giant.g.rotation.y = 0;
  if (ult.t > DESC) { ult.mark.material.opacity = Math.max(0, .9 - (ult.t - DESC) * 2); giant.bladeM.emissiveIntensity = Math.max(0, 1.5 - (ult.t - DESC) * 1.5); }
  if (ult.t > DESC + HOLD) { const k = (ult.t - DESC - HOLD) / .5; giant.g.position.y = endY + easeIO(Math.min(1, k)) * 60; if (k >= 1) { ult.active = false; giant.g.visible = false; beam.visible = false; scene.remove(ult.mark); } }
  if (ult.t < DESC) for (let i = 0; i < 4; i++) emit(ult.pt.x + rand(-1, 1), y - L + rand(0, L), ult.pt.z + rand(-1, 1), 0, 6, 0, 0xffe7a0, .6, .4, 0);
}
function impactUlt(gy) {
  const p = V3(ult.pt.x, gy, ult.pt.z);
  shake = .7; sfx('boom');
  shockRing(p, 0xffd060, 1, 13, .9); shockRing(p, 0xffffff, .5, 7, .5); shockRing(p, 0xff9a30, 2, 18, 1.3, .6);
  burst(V3(p.x, p.y + 1, p.z), 90, 0xffd27a, 16, .8, .9, -10, .8);
  burst(V3(p.x, p.y + .5, p.z), 50, 0xc8b89a, 7, 1.2, 1.2, -2, .3);
  const fl = $('flash'); fl.style.transition = 'none'; fl.style.background = '#fff6d8'; fl.style.opacity = .55; requestAnimationFrame(() => { fl.style.transition = 'opacity .6s'; fl.style.opacity = 0; });
  if (ult.target && !ult.target.dead) hitMonster(ult.target, player.atk * 8, 'ult');
  for (const m of monsters) { if (m.dead || m === ult.target) continue; if (Math.hypot(m.x - p.x, m.z - p.z) < 6 + m.def.radius) hitMonster(m, player.atk * 3, 's1'); }
}
/* 御剑 riding */
const rideSword = buildSword({ scale: 3.0 }); rideSword.bladeM.emissive.set(0x9fe8ff); rideSword.bladeM.emissiveIntensity = .5; rideSword.g.visible = false; scene.add(rideSword.g);
const RIDE_DUR = 10;
function toggleRide() { if (player.riding) endRide(); else startRide(); }
function startRide() {
  if (!swordInHand) { toast('飞剑未归'); return; }
  const keys = [R_IDLE, RK(.5, [.12, -.62, -.5], [0, .05, -1], [.4, -.4, .8]), RK(1, [.1, -.95, -.45], [0, -.1, -1], [.4, -.3, .8])];
  playVM('ridein', .42, keys, null, [{ at: 1, fn: () => { swordInHand = false; player.riding = true; player.rideT = RIDE_DUR; rideSword.g.visible = true; sfx('whoosh'); shockRing(V3(player.x, Math.max(0, H(player.x, player.z)), player.z), 0x9fe8ff, .3, 3.5, .6); toast('御剑飞行！'); } }]);
  vmR.p.copy(R_IDLE.p);
}
function endRide(silent) {
  if (!player.riding) return;
  player.riding = false; rideSword.g.visible = false; SK.ride.t = SK.ride.cd;
  swordInHand = true;
  playVM('rideout', .38, [RK(0, [.1, -.95, -.45], [0, -.1, -1], [.4, -.3, .8]), RK(.5, [.14, -.6, -.5], [0, .2, -1], [.4, -.4, .8]), { ...R_IDLE, k: 1 }], null, [{ at: 1, fn: () => { if (pendingSkill) { const s = pendingSkill; pendingSkill = null; setTimeout(() => tryCast(s), 30); } } }]);
}

/* ---------------- input (multi-touch via pointer events) ---------------- */
const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0, R: 52 };
let camPtr = null, camLast = null;
const joyEl = $('joy'), knob = $('joyknob'), touchEl = $('touch');
function joyHome() { joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = ''; knob.style.transform = ''; joyEl.classList.remove('active'); }
touchEl.addEventListener('pointerdown', e => {
  e.preventDefault(); if (state !== 'play') return;
  const W = innerWidth, Hh = innerHeight;
  if (joy.id === null && e.clientX < W * .45 && e.clientY > Hh * .28) {
    joy.id = e.pointerId; const half = 66;
    joy.cx = clamp(e.clientX, half + 6, W * .45); joy.cy = clamp(e.clientY, half + 40, Hh - half - 6);
    joyEl.style.left = (joy.cx - half) + 'px'; joyEl.style.top = (joy.cy - half) + 'px'; joyEl.style.bottom = 'auto'; joyEl.classList.add('active');
    moveJoy(e);
  } else if (camPtr === null) { camPtr = e.pointerId; camLast = { x: e.clientX, y: e.clientY }; }
  try { touchEl.setPointerCapture(e.pointerId); } catch (_) { }
}, { passive: false });
function moveJoy(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const d = Math.hypot(dx, dy); if (d > joy.R) { dx *= joy.R / d; dy *= joy.R / d; } joy.x = dx / joy.R; joy.y = dy / joy.R; knob.style.transform = `translate(${dx}px,${dy}px)`; }
touchEl.addEventListener('pointermove', e => {
  e.preventDefault();
  if (e.pointerId === joy.id) moveJoy(e);
  else if (e.pointerId === camPtr && camLast) { const dx = e.clientX - camLast.x, dy = e.clientY - camLast.y; camLast = { x: e.clientX, y: e.clientY }; const s = 4.2 / Math.max(innerWidth, 600); player.yaw -= dx * s; yawVel = dx * s / (1 / 60); player.pitch = clamp(player.pitch - dy * s * .8, -1.15, .7); }
}, { passive: false });
function endPtr(e) { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyHome(); } if (e.pointerId === camPtr) { camPtr = null; camLast = null; } }
touchEl.addEventListener('pointerup', endPtr); touchEl.addEventListener('pointercancel', endPtr); touchEl.addEventListener('lostpointercapture', endPtr);
let atkHeld = false;
function bindBtn(id, skill) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); if (skill === 'atk') atkHeld = true; tryCast(skill); }, { passive: false });
  const up = e => { el.classList.remove('down'); if (skill === 'atk') atkHeld = false; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}
bindBtn('btn-atk', 'atk'); bindBtn('btn-s1', 's1'); bindBtn('btn-s2', 's2'); bindBtn('btn-s3', 's3'); bindBtn('btn-ride', 'ride');
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
// optional keyboard for desktop testing
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; const map = { KeyJ: 'atk', Digit1: 's1', Digit2: 's2', Digit3: 's3', KeyR: 'ride', Space: 'atk' }; if (map[e.code]) tryCast(map[e.code]); });
addEventListener('keyup', e => keys[e.code] = false);

/* ---------------- HUD ---------------- */
let hudDirty = true;
const btnEls = { atk: $('btn-atk'), s1: $('btn-s1'), s2: $('btn-s2'), s3: $('btn-s3'), ride: $('btn-ride') };
function layout() {
  const W = innerWidth, Hh = innerHeight;
  renderer.setSize(W, Hh, false); camera.aspect = W / Hh; camera.updateProjectionMatrix(); vCam.aspect = W / Hh; vCam.updateProjectionMatrix();
  pMat.uniforms.scale.value = Hh * renderer.getPixelRatio() * .9;
  const u = Math.min(Hh / 390, W / 844 * 1.1, 1.35);
  const A = 88 * u, S = 60 * u, R = A / 2 + S / 2 + 22 * u;
  const ax = W - 34 * u - A / 2, ay = Hh - 26 * u - A / 2;
  const place = (el, cx, cy, sz) => { el.style.width = el.style.height = sz + 'px'; el.style.left = (cx - sz / 2) + 'px'; el.style.top = (cy - sz / 2) + 'px'; };
  place(btnEls.atk, ax, ay, A);
  [[btnEls.s1, 186], [btnEls.s2, 136], [btnEls.s3, 88]].forEach(([el, deg]) => { const r = deg * Math.PI / 180; place(el, ax + Math.cos(r) * R, ay - Math.sin(r) * R, S); });
  place(btnEls.ride, W / 2, Hh - 18 * u - S * .5, S * .95);
  joyEl.style.width = joyEl.style.height = (132 * u) + 'px'; joy.R = 52 * u;
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 200));
let lastHp = -1, lastXp = -1;
function updateHUD() {
  for (const id in SK) {
    const s = SK[id], el = btnEls[id]; const cd = el.querySelector('.cd');
    if (s.t > 0 && id !== 'atk') { el.classList.add('cooling'); cd.style.setProperty('--p', (s.t / s.cd).toFixed(3)); cd.textContent = s.t >= 1 ? Math.ceil(s.t) : s.t.toFixed(1); }
    else el.classList.remove('cooling');
  }
  const lock = !swordInHand && !player.riding;
  for (const id of ['atk', 's1', 's3']) btnEls[id].classList.toggle('lock', lock);
  btnEls.ride.classList.toggle('on', player.riding);
  if (player.riding) btnEls.ride.querySelector('.dur').style.setProperty('--q', (player.rideT / RIDE_DUR).toFixed(3));
  if (hudDirty) {
    hudDirty = false;
    $('lvnum').textContent = player.lv;
    const need = needXp(player.lv);
    $('xpfill').style.width = (player.lv >= 100 ? 100 : player.xp / need * 100) + '%';
    $('xptxt').textContent = player.lv >= 100 ? '已满级' : `${player.xp}/${need}`;
    const r = player.hp / player.maxHp;
    $('hpfill').style.width = (r * 100) + '%'; $('hpghost').style.width = (r * 100) + '%';
    $('hptxt').textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    $('hpbar').classList.toggle('low', r < .3);
  }
}
let curArea = '';
const areaLabels = steles.map(s => { const el = document.createElement('div'); el.className = 'al'; el.innerHTML = `<b style="color:#${s.a.color.toString(16).padStart(6, '0')}">${s.a.name}</b><span></span>`; labelsEl.appendChild(el); return { s, el, sp: el.querySelector('span') }; });
function updateAreaLabels() {
  let near = null, nd = 1e9;
  const ds = areaLabels.map(l => Math.hypot(player.x - l.s.a.x, player.z - l.s.a.z)); const order = ds.map((d, i) => i).filter(i => ds[i] > 40).sort((a, b) => ds[a] - ds[b]).slice(0, 2);
  for (const l of areaLabels) {
    const a = l.s.a, d = Math.hypot(player.x - a.x, player.z - a.z);
    if (d < nd) { nd = d; near = a; }
    if (!order.includes(areaLabels.indexOf(l))) { l.el.style.display = 'none'; continue; }
    const p = l.s.pos.clone(); if (d > 30) p.y += Math.min(60, d * .25);
    const s = d < 400 ? project(p) : null;
    if (s) { l.el.style.display = 'block'; l.el.style.transform = `translate(${s.x}px,${Math.max(s.y, 95)}px) translate(-50%,-100%)`; l.sp.textContent = `Lv${a.lv[0]}-${a.lv[1]} · ${Math.round(d)}米`; } else l.el.style.display = 'none';
  }
  const name = nd < 38 ? near.name : (Math.hypot(player.x - SPAWN.x, player.z - SPAWN.z) < 25 ? '招摇山麓' : Math.hypot(player.x - LAKE.x, player.z - LAKE.z) < LAKE.r + 8 ? '青丘泽' : '山野');
  if (name !== curArea) {
    curArea = name; $('area').textContent = name;
    if (nd < 38) banner(near.name, `推荐等级 Lv${near.lv[0]}-${near.lv[1]} · ${MT[near.type].name}出没`);
  }
}

/* ---------------- main update ---------------- */
function update(dt) {
  gameT += dt;
  for (const id in SK) SK[id].t = Math.max(0, SK[id].t - dt);
  if (player.dead) { player.deadT -= dt; $('deadtxt').textContent = `${Math.max(0, Math.ceil(player.deadT))} 秒后于招摇山麓复活`; if (player.deadT <= 0) respawn(); }
  // movement
  let jx = joy.x, jy = joy.y;
  if (keys.KeyW) jy = -1; if (keys.KeyS) jy = 1; if (keys.KeyA) jx = -1; if (keys.KeyD) jx = 1;
  if (keys.ArrowLeft) player.yaw += dt * 2; if (keys.ArrowRight) player.yaw -= dt * 2;
  const mag = Math.min(1, Math.hypot(jx, jy));
  let moving = false;
  if (!player.dead && mag > .08) {
    const f = fwd(), r = V3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const dir = f.multiplyScalar(-jy).add(r.multiplyScalar(jx)); if (dir.lengthSq() > 1) dir.normalize();
    const sp = player.riding ? 17 : (jy > .3 ? 4.2 : 6.2);
    const nx = player.x + dir.x * sp * dt, nz = player.z + dir.z * sp * dt;
    const ok = (x, z) => { const h = H(x, z), r2 = Math.hypot(x, z); if (r2 > 250) return false; if (player.riding) return h < 48; return h > -1.35 && h < 26; };
    if (ok(nx, nz)) { player.x = nx; player.z = nz; } else if (ok(nx, player.z)) player.x = nx; else if (ok(player.x, nz)) player.z = nz;
    moving = true;
  }
  if (!player.riding) pushOutTrees(player, .4);
  for (const m of monsters) { if (m.dead) continue; const dx = player.x - m.x, dz = player.z - m.z, d = Math.hypot(dx, dz), mn = m.def.radius * m.sc + .9; if (d < mn && d > 1e-3) { player.x = m.x + dx / d * mn; player.z = m.z + dz / d * mn; } }
  player.moveAmt += ((moving ? mag : 0) - player.moveAmt) * Math.min(1, dt * 8);
  player.bob += dt * (player.riding ? 4 : 9) * player.moveAmt;
  if (player.riding) { player.rideT -= dt; if (player.rideT <= 0) endRide(); }
  // regen
  if (!player.dead && gameT - player.lastHurt > 5 && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * .03 * dt); hudDirty = true; }
  if (atkHeld) tryCast('atk');
  // camera
  const gh = H(player.x, player.z);
  const tY = (player.riding ? Math.max(gh, 0) + 2.45 : gh + 1.7) + (moving && !player.riding ? Math.abs(Math.sin(player.bob)) * .05 : 0);
  camY += (tY - camY) * Math.min(1, dt * (player.riding ? 6 : 14));
  yawVel *= Math.pow(.001, dt);
  shake = Math.max(0, shake - dt * 1.2);
  camera.position.set(player.x + (Math.random() - .5) * shake * .35, camY + (Math.random() - .5) * shake * .35, player.z);
  rideTilt += ((player.riding ? -.24 : 0) - rideTilt) * Math.min(1, dt * 3);
  camera.rotation.set(player.pitch + rideTilt + (player.riding ? Math.sin(gameT * 2) * .01 : 0), player.yaw, player.riding ? -clamp(jx, -1, 1) * .06 : 0);
  camera.fov += ((player.riding && moving ? 82 : 70) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  if (player.riding) {
    rideSword.g.rotation.set(-Math.PI / 2, player.yaw, 0, 'YXZ');
    const f = fwd(); rideSword.g.position.set(player.x + f.x * .25, camY - 1.72 + Math.sin(gameT * 3) * .03, player.z - f.z * .5);
    const tail = V3(player.x - f.x * .8, camY - 1.72, player.z - f.z * .8);
    for (let i = 0; i < 2; i++) emit(tail.x + rand(-.15, .15), tail.y, tail.z + rand(-.15, .15), -f.x * 2 + rand(-.3, .3), rand(-.2, .2), -f.z * 2 + rand(-.3, .3), 0x9fe8ff, .25, .6, 0);
    if (moving && Math.random() < .5) { const a = rand(0, 6.28), rr = rand(1.5, 3); const sp = V3(player.x + Math.cos(a) * rr, camY + rand(-1, 1), player.z + Math.sin(a) * rr).addScaledVector(fwd(), 4); emit(sp.x, sp.y, sp.z, -fwd().x * 25, 0, -fwd().z * 25, 0xffffff, .12, .25, 0); }
  }
  updateVM(dt); updateMonsters(dt); updateMonsterProj(dt); updateFly(dt); updateUlt(dt); updateFx(dt); updateParticles(dt); updateNums(dt);
  updateAreaLabels(); updateHUD();
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = 0; }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  waterMat.color.setHSL(.54, .55, .33 + Math.sin(gameT * .5) * .01);
}
function render() { renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); renderer.render(vScene, vCam); }
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (window.__freeze) { }
  else if (state === 'play') update(dt);
  else { gameT += dt; player.yaw += dt * .05; camera.position.set(player.x, camY, player.z); camera.rotation.set(-.02, player.yaw, 0); sky.position.copy(camera.position); updateVM(dt); updateMonsters(dt); updateParticles(dt); }
  render();
}
recalc(); spawnAll(); Math.random = _mathRandom; layout();
for (const m of monsters) m.el.style.display = 'none';
$('go').addEventListener('click', () => {
  initAudio(); state = 'play'; $('start').style.display = 'none'; hudDirty = true;
  const de = document.documentElement; try { if (de.requestFullscreen && !/Headless/.test(navigator.userAgent)) de.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }); } catch (_) { }
  banner('山海剑侠', '前往招摇山，斩杀狌狌，开启修行');
});
requestAnimationFrame(frame);
// debug / test hooks
window.__G = { renderer, camera, get camY() { return camY; }, player, monsters, SK, tryCast, AREAS, H, get state() { return state; }, start() { $('go').click(); }, tp(x, z, yaw) { player.x = x; player.z = z; if (yaw !== undefined) player.yaw = yaw; camY = H(x, z) + 1.7; }, setLv(l) { player.lv = l; player.xp = 0; recalc(); player.hp = player.maxHp; hudDirty = true; }, resetCd() { for (const k in SK) SK[k].t = 0; }, fly, ult, VM, step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) update(dt); } };
