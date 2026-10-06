// Shared pieces for the little people and Clover: soft rim-lit materials,
// vertex-coloured part merging (one mesh per accessory, however many bits it
// has), a few cached shapes (capsules, hearts, stars, petals), springs for
// follow-through, and the tiny animation maths the rigs are written in.

import { THREE, GEO, TAU, clamp, lerp } from '../kit.mjs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, GEO, TAU, clamp, lerp };

/* ------------------------------------------------------------ materials */

const mats = new Map();
/**
 * A cached MeshStandardMaterial with a soft warm fresnel rim, so the
 * characters lift off the grass. Same arguments, same material. Every rim
 * material shares one shader program.
 */
export function cmat(color, o = {}) {
  const {
    roughness = 0.7, metalness = 0, emissive = null, emissiveIntensity = 1, transparent = false, opacity = 1,
    map = null, emissiveMap = null, vertexColors = false, side = THREE.FrontSide, rim = 0.22, depthWrite = true,
    flat = false, alphaTest = 0,
  } = o;
  const key = [color, roughness, metalness, emissive, emissiveIntensity, transparent, opacity, map?.uuid, emissiveMap?.uuid,
    vertexColors, side, rim, depthWrite, flat, alphaTest].join('|');
  let m = mats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color, roughness, metalness, transparent, opacity, map, vertexColors, side, depthWrite, flatShading: flat, alphaTest,
    ...(emissive ? { emissive, emissiveIntensity } : {}), ...(emissiveMap ? { emissiveMap } : {}),
  });
  if (rim > 0) addRim(m, rim);
  mats.set(key, m);
  return m;
}

/** Adds the soft fresnel rim to any standard material (also used for per-character materials). */
export function addRim(m, strength = 0.22) {
  const uniform = { value: strength };
  m.userData.rim = uniform;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = uniform;
    shader.fragmentShader = 'uniform float uRim;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
      {
        float rimF = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
        rimF = rimF * rimF * rimF;
        outgoingLight += uRim * rimF * mix( vec3( 1.0, 0.95, 0.88 ), diffuseColor.rgb, 0.45 );
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'chars-rim';
  return m;
}

/** One white material that shows baked vertex colours (merged accessories). */
export const vcol = (o = {}) => cmat('#ffffff', { vertexColors: true, ...o });

/* --------------------------------------------------------- merged parts */

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

/** A matrix from [x,y,z] position, scale and Euler rotation arrays. */
export function mtx(pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], order = 'XYZ') {
  _e.set(rot[0], rot[1], rot[2], order);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
}

/**
 * Collects geometry pieces with a colour each and bakes them into one
 * vertex-coloured BufferGeometry. Children can be nested with `push(matrix)`.
 */
export class Parts {
  /** `metres` = how many metres one local unit is (head-space builders pass the head radius). */
  constructor(metres = 1) { this.list = []; this.stack = [new THREE.Matrix4()]; this.metres = metres; }
  get top() { return this.stack[this.stack.length - 1]; }
  push(m) { this.stack.push(this.top.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  /** Add `geo` coloured `color`, placed by pos/scale/rot (or a Matrix4 in pos). */
  add(geo, color, pos, scale, rot, order) {
    const m = pos instanceof THREE.Matrix4 ? (scale || rot ? pos.clone().multiply(mtx([0, 0, 0], scale, rot, order)) : pos) : mtx(pos, scale, rot, order);
    const full = this.top.clone().multiply(m);
    // Small bits don't need smooth geometry: swap in low-poly versions.
    const size = full.getMaxScaleOnAxis() * this.metres;
    if (geo === GEO.sphere && size < 0.12) geo = size < 0.015 ? tinySphere() : size < 0.045 ? GEO.lowSphere : midSphere();
    else if (geo === GEO.torus && size < 0.08) geo = lowTorus();
    this.list.push({ geo, color, m: full });
    return this;
  }
  /** A rod from a to b with radius r (a cylinder, or capsule-ended with caps). */
  rod(a, b, r, color, caps = false) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
    this.list.push({ geo: GEO.cyl, color, m: this.top.clone().multiply(m) });
    if (caps) { this.add(GEO.lowSphere, color, a, [r, r, r]); this.add(GEO.lowSphere, color, b, [r, r, r]); }
    return this;
  }
  get empty() { return this.list.length === 0; }
  build() {
    if (!this.list.length) return null;
    const pieces = this.list.map(({ geo, color, m }) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(m);
      if (m.determinant() < 0) flipWinding(g);
      _c.set(color);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const out = mergeGeometries(pieces, false);
    for (const g of pieces) g.dispose();
    for (const { geo } of this.list) if (!isShared(geo)) geo.dispose();
    out.computeBoundingSphere();
    return out;
  }
}

function flipWinding(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    for (const a of [p, n, uv]) {
      if (!a) continue;
      for (let k = 0; k < a.itemSize; k++) {
        const t = a.array[(i + 1) * a.itemSize + k];
        a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k];
        a.array[(i + 2) * a.itemSize + k] = t;
      }
    }
  }
}

/* ------------------------------------------------------- cached shapes */

const geos = new Map();
/** Cache a geometry by key: shared by every character, never disposed. */
export function cached(key, make) {
  let g = geos.get(key);
  if (!g) { g = make(); g.userData.shared = true; geos.set(key, g); }
  return g;
}
export const isShared = (g) => !!g?.userData?.shared || Object.values(GEO).includes(g);

const tinySphere = () => cached('tinySphere', () => new THREE.SphereGeometry(1, 7, 5));
const midSphere = () => cached('midSphere', () => new THREE.SphereGeometry(1, 14, 10));
const lowTorus = () => cached('lowTorus', () => new THREE.TorusGeometry(1, 0.25, 6, 14));

/** A smooth sphere for heads and shells. */
export const smoothSphere = (w = 28, h = 20) => cached(`sphere:${w}:${h}`, () => new THREE.SphereGeometry(1, w, h));

/**
 * A capsule hanging down from the origin: a ball of radius r1 at the joint,
 * tapering to radius r2 at length L. Joints rotate cleanly with no gaps.
 */
export function limb(r1, r2, L, seg = 14) {
  return cached(`limb:${r1}:${r2}:${L}:${seg}`, () => {
    const pts = [];
    const cap = 6;
    for (let i = 0; i <= cap; i++) { const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r2 + 1e-4, -L + Math.sin(a) * r2)); }
    for (let i = 1; i <= cap; i++) { const a = (i / cap) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, Math.sin(a) * r1)); }
    return new THREE.LatheGeometry(pts, seg);
  });
}

/** Revolve a profile of [radius, y] pairs (bottom to top). */
export function lathe(key, profile, seg = 20) {
  return cached(`lathe:${key}:${seg}`, () => {
    // Lathe faces point outwards when the profile runs bottom to top.
    const pts = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), seg);
  });
}

/** A smooth curve through [r, y] control points, resampled for a lathe. */
export function smoothProfile(points, steps = 4) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints((points.length - 1) * steps).map((p) => [p.x, p.y]);
}

export function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-0.25 * s, -0.62 * s, -1.0 * s, -0.25 * s, -0.98 * s, 0.22 * s);
  h.bezierCurveTo(-0.96 * s, 0.72 * s, -0.36 * s, 0.9 * s, 0, 0.45 * s);
  h.bezierCurveTo(0.36 * s, 0.9 * s, 0.96 * s, 0.72 * s, 0.98 * s, 0.22 * s);
  h.bezierCurveTo(1.0 * s, -0.25 * s, 0.25 * s, -0.62 * s, 0, -0.9 * s);
  return h;
}
/** A puffy heart about 2 units across, centred, facing +z. */
export const heartGeo = (depth = 0.35, lite = false) => cached(`heart:${depth}:${lite}`, () => {
  const g = new THREE.ExtrudeGeometry(heartShape(1), { depth, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.18, bevelSegments: lite ? 1 : 3, curveSegments: lite ? 5 : 10 });
  g.translate(0, 0, -depth / 2);
  return g;
});

export function starShape(points = 5, inner = 0.45, outer = 1) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = Math.PI / 2 + (i / (points * 2)) * TAU, r = i % 2 ? inner : outer;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
/** A soft chunky star, points x inner radius, about 2 units across. */
export const starGeo = (points = 5, inner = 0.45, depth = 0.3) => cached(`star:${points}:${inner}:${depth}`, () => {
  const g = new THREE.ExtrudeGeometry(starShape(points, inner, 1), { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
});
/** A flat leaf (pointed ellipse) in the XY plane, 1 unit long along +y. */
export const leafGeo = (w = 0.42, bend = 0.12) => cached(`leaf:${w}:${bend}`, () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, 0.45, 0, 1);
  s.quadraticCurveTo(-w, 0.45, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -bend * (x * x) / (w * w) * 1.5 + bend * Math.sin(y * Math.PI) * 0.6); }
  g.computeVertexNormals();
  return g;
});
/** A plump petal: a squashed sphere pointing along +y from the origin. */
export const petal = (key = 'p') => cached(`petal:${key}`, () => {
  const g = new THREE.SphereGeometry(1, 8, 6);
  g.translate(0, 1, 0);
  return g;
});

/* ------------------------------------------------------------- springs */

/** A damped spring on one number. Semi-implicit, frame-rate independent enough. */
export class Spring {
  constructor(k = 90, c = 9) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  step(target, dt, force = 0) {
    const n = dt > 0.02 ? Math.ceil(dt / 0.02) : 1, h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = this.k * (target - this.x) - this.c * this.v + force;
      this.v += a * h;
      this.x += this.v * h;
    }
    if (!Number.isFinite(this.x)) { this.x = 0; this.v = 0; }
    return this.x;
  }
  kick(v) { this.v += v; }
  reset(x = 0) { this.x = x; this.v = 0; }
}

/* --------------------------------------------------------- anim maths */

export const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 0 before a, rises to 1 by b. */
export const ramp = (u, a, b) => sm((u - a) / (b - a));
/** Rises a→b, holds, falls c→d. */
export const env = (u, a, b, c, d) => Math.min(ramp(u, a, b), 1 - ramp(u, c, d));
/** A soft bump peaking at m, zero outside [a, b]. */
export const bump = (u, a, m, b) => (u <= a || u >= b ? 0 : u < m ? sm((u - a) / (m - a)) : 1 - sm((u - m) / (b - m)));
/** Overshooting ease-out (anticipation-friendly). */
export const backOut = (t, s = 1.7) => { t = clamp(t, 0, 1) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const hop = (u) => (u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u));
export const S = Math.sin, C = Math.cos;

/** Dispose per-character geometry under an object (shared ones are kept). */
export function disposeOwned(root) {
  root.traverse((n) => {
    if (n.geometry && !isShared(n.geometry)) n.geometry.dispose();
    if (n.userData?.ownMaterial) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose());
  });
}

/** An empty shared geometry for meshes waiting for their look. */
export const EMPTY_GEO = new THREE.BufferGeometry();
EMPTY_GEO.userData.shared = true;

/** Add a mesh with shadows. */
export function part(geo, material, parent, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo || EMPTY_GEO, material);
  if (!geo) m.visible = false;
  m.position.set(pos[0], pos[1], pos[2]);
  m.scale.set(scale[0], scale[1], scale[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}

/** A named group at a position. */
export function node(parent, pos = [0, 0, 0], name = '') {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(pos[0], pos[1], pos[2]);
  if (parent) parent.add(g);
  return g;
}

/** Colour helpers for canvas painting. */
export function shade(hex, k) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l + k, 0, 1));
  return '#' + c.getHexString();
}
export function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }

/** Point on a sphere: phi 0 = front (+z), +phi towards +x (the character's left); theta from the top. */
export function onSphere(phi, theta, r = 1) {
  return [r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.cos(phi)];
}
/** A partial sphere shell used for face decals, centred on the front (+z). */
export function decalGeo(r, phiLen, thetaStart, thetaLen, w = 24, h = 12) {
  return cached(`decal:${r}:${phiLen}:${thetaStart}:${thetaLen}:${w}:${h}`, () =>
    new THREE.SphereGeometry(r, w, h, Math.PI / 2 - phiLen / 2, phiLen, thetaStart, thetaLen));
}
