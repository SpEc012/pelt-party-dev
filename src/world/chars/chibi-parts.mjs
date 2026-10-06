// Everything a little person can wear or carry, as vertex-coloured merged
// geometry: each accessory is one mesh however many bits it is made of.
//
// Head-space pieces (hair, hats, glasses, earrings) are built around a unit
// sphere (the skull, radius 1) with the face towards +z. Body pieces are in
// metres in the space of the bone they ride on.

import { canvasTexture } from '../kit.mjs';
import { THREE, GEO, TAU, clamp, Parts, cached, limb, lathe, smoothProfile, heartGeo, starGeo, leafGeo, petal, onSphere, shade, mixHex, sm } from './common.mjs';

const WHITE = '#ffffff';
const CREAM = '#fbf3e6';
const GOLD = '#f2c96b';

/* =============================================================== hair */

/**
 * A hair shell: from the crown down to a hairline that can change all the
 * way round, finished with a soft rolled edge tucked back into the head.
 */
function shellGeo(line, radius, { seg = 40, rows = 13, rim = 0.075, inner = 0.96 } = {}) {
  const pos = [], idx = [];
  let top = 0;
  for (let i = 0; i < 8; i++) top += radius(-Math.PI + (i / 8) * TAU, 0) / 8;
  pos.push(0, top, 0);
  const R = rows + 2;
  for (let j = 1; j <= R; j++) {
    for (let i = 0; i < seg; i++) {
      const phi = -Math.PI + (i / seg) * TAU;
      const tm = line(phi);
      let th, r;
      if (j <= rows) { th = tm * (j / rows); r = radius(phi, th); }
      else if (j === rows + 1) { th = tm + 0.045; r = radius(phi, tm) - rim * 0.5; }
      else { th = tm - 0.02; r = Math.min(inner, radius(phi, tm) - rim); }
      pos.push(...onSphere(phi, th, r));
    }
  }
  const at = (j, i) => 1 + (j - 1) * seg + ((i + seg) % seg);
  for (let i = 0; i < seg; i++) idx.push(0, at(1, i), at(1, i + 1));
  for (let j = 1; j < R; j++) {
    for (let i = 0; i < seg; i++) {
      const a = at(j, i), b = at(j + 1, i), c = at(j, i + 1), d = at(j + 1, i + 1);
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Smoothly go from the front value to the side value as |phi| grows. */
const fs = (phi, front, side, a = 0.8, b = 1.2) => front + (side - front) * sm((Math.abs(phi) - a) / (b - a));
/** Rounded clumps along the fringe: 0 at the gaps, 1 at a clump's tip. */
const clump = (phi, width, sharp = 0.6) => Math.pow(0.5 + 0.5 * Math.cos((phi / width) * TAU), sharp);
/** Pointy zigzag (spiky fringe). */
const zig = (phi, width) => 1 - Math.abs(((phi / width) % 1 + 1) % 1 * 2 - 1);

/** A teardrop lock hanging down -y from the origin, length L, widest w. */
function lockGeo(L, w, key, tip = 0.25) {
  return cached(`lock:${key}:${L}:${w}`, () => {
    const pts = smoothProfile([[0.001, -L], [w * tip, -L * 0.93], [w * 0.85, -L * 0.65], [w, -L * 0.35], [w * 0.8, -L * 0.08], [w * 0.4, 0.02], [0.001, 0.04]], 5);
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), 14);
  });
}

/** A rolled edge and a crisp hair colour a touch darker underneath. */
export const HAIR_STYLES = {
  bob: {
    covers: true,
    line: (p) => fs(p, 1.0 + 0.13 * clump(p, 0.42), 2.02, 0.78, 1.18) + (Math.abs(p) > 2.4 ? -0.04 : 0),
    rad: (p, t) => 1.075 + 0.1 * sm((t - 1.0) / 1.0) + 0.02 * sm((0.9 - Math.abs(p)) / 0.5),
  },
  long: {
    covers: true,
    line: (p) => fs(p, 1.02 + 0.22 * sm(Math.abs(p) / 0.8) + 0.06 * clump(p, 0.35), 2.12, 0.85, 1.2),
    rad: (p, t) => 1.07 + 0.07 * sm((t - 1.1) / 1.0),
    drape: { L: 2.0, w: 0.92, d: 0.4, y: -0.25, z: -0.62, tilt: 0.28 },
  },
  bun: {
    covers: false,
    line: (p) => fs(p, 0.96 + 0.12 * clump(p + 0.2, 0.5) + 0.12 * sm((p + 0.4) / 0.9), fs(p, 1.55, 2.02, 1.8, 2.5), 0.85, 1.15),
    rad: (p, t) => 1.06 + 0.01 * sm((t - 1.2) / 0.5),
    bun: true,
  },
  pigtails: {
    covers: false,
    line: (p) => fs(p, 1.08 + 0.1 * clump(p, 0.36), fs(p, 1.72, 2.02, 1.7, 2.3), 0.85, 1.12),
    rad: (p, t) => 1.07 + 0.015 * sm((t - 1.0) / 0.6),
    tails: 'pig',
  },
  curly: {
    covers: true,
    line: (p) => fs(p, 1.0 + 0.12 * clump(p, 0.3, 1), 1.85 + 0.08 * clump(p, 0.5), 0.8, 1.15),
    rad: (p, t) => 1.12 + 0.07 * Math.abs(Math.sin(p * 5) * Math.sin(t * 6)) + 0.05 * sm((t - 1.0) / 0.8),
    curls: true,
  },
  short: {
    covers: false,
    line: (p) => fs(p, 0.92 + 0.26 * sm((p + 0.7) / 1.4) + 0.08 * clump(p, 0.38), fs(p, 1.5, 1.98, 1.8, 2.5), 0.9, 1.15),
    rad: (p, t) => 1.06 + 0.03 * sm((0.9 - t) / 0.9),
    ahoge: true,
  },
  wavy: {
    covers: true,
    line: (p) => fs(p, 0.96 + 0.3 * sm((0.5 - p) / 1.3) + 0.07 * clump(p, 0.45), 2.2 + 0.07 * Math.sin(p * 7), 0.8, 1.2),
    rad: (p, t) => 1.075 + 0.045 * Math.sin(t * 9 + p * 2) * sm((t - 1.1) / 0.5) + 0.1 * sm((t - 1.2) / 1.0),
    drape: { L: 1.25, w: 0.86, d: 0.36, y: -0.3, z: -0.6, tilt: 0.3, wavy: true },
  },
  buzz: {
    covers: false,
    line: (p) => fs(p, 0.78 + 0.04 * Math.cos(p * 3), fs(p, 1.42, 1.96, 1.7, 2.4), 0.95, 1.3),
    rad: () => 1.03,
    rim: 0.03,
  },
  ponytail: {
    covers: false,
    line: (p) => fs(p, 0.98 + 0.18 * sm((p + 0.5) / 1.2) + 0.07 * clump(p, 0.45), fs(p, 1.58, 2.0, 1.7, 2.4), 0.85, 1.15),
    rad: (p, t) => 1.065,
    tails: 'pony',
  },
  afro: {
    covers: true,
    crown: 1.42,
    line: (p) => fs(p, 0.92 + 0.06 * clump(p, 0.3, 1), 1.95, 0.95, 1.35),
    rad: (p, t) => {
      const front = sm((1.25 - Math.abs(p)) / 0.5);
      const edge = sm((t - 0.3) / 0.62);
      return 1.34 - 0.24 * front * edge - 0.12 * sm((t - 1.6) / 0.4) + 0.05 * Math.abs(Math.sin(p * 9) * Math.sin(t * 10));
    },
    rim: 0.09,
  },
  bangs: {
    covers: true,
    line: (p) => fs(p, 1.3 + 0.035 * clump(p, 0.2, 1), fs(p, 2.35, 2.15, 1.4, 2.0), 0.9, 1.08),
    rad: (p, t) => 1.085 + 0.04 * sm((t - 1.3) / 0.8),
    drape: { L: 2.1, w: 0.9, d: 0.36, y: -0.25, z: -0.62, tilt: 0.22 },
  },
  spiky: {
    covers: false,
    line: (p) => fs(p, 0.92 + 0.28 * zig(p + 0.12, 0.34), fs(p, 1.55, 1.95, 1.7, 2.4), 0.9, 1.15),
    rad: (p, t) => 1.075,
    spikes: true,
  },
};

const COVERING_HATS = new Set(['cap', 'beanie', 'sunhat', 'bucket', 'frog']);

/** How big the hair is at the crown, so hats sit on top of it. */
export function crownOf(look) {
  const s = HAIR_STYLES[look.hair] || HAIR_STYLES.bob;
  return s.crown || (s.spikes ? 1.12 : s.bun ? 1.08 : 1.09);
}

/**
 * Build the hair for a look. Returns { cap, springs: [{ geo, pivot:[x,y,z], rot:[x,y,z], kind }] }.
 * The springy locks (drape, tails, ahoge) are separate so they can swing.
 */
export function buildHair(look) {
  const style = HAIR_STYLES[look.hair] || HAIR_STYLES.bob;
  const color = look.hairColor;
  const under = shade(color, -0.06);
  const hatted = COVERING_HATS.has(look.hat);
  const tie = look.hatColor || '#f4a6bd';
  const P = new Parts(0.265);
  const rad = hatted && !style.crown ? (p, t) => Math.min(style.rad(p, t), t < 1.0 ? 1.075 : 9) : style.rad;
  P.add(shellGeo(style.line, rad, { rim: style.rim ?? 0.075 }), color);

  if (style.bun) {
    const at = hatted ? onSphere(Math.PI, 1.75, 1.1) : onSphere(Math.PI, 0.62, 1.12);
    P.add(GEO.sphere, color, at, [0.4, 0.38, 0.4]);
    P.add(GEO.torus, tie, onSphere(Math.PI, hatted ? 1.55 : 0.82, 1.05), [0.3, 0.3, 0.3], [hatted ? 0.2 : -0.8, 0, 0]);
  }
  if (style.curls) {
    for (let i = 0; i < 16; i++) {
      const phi = -Math.PI + (i / 16) * TAU + 0.1;
      if (Math.abs(phi) < 0.95) continue;
      const th = style.line(phi) - 0.05;
      P.add(GEO.lowSphere, i % 2 ? color : under, onSphere(phi, th, 1.13), [0.2, 0.2, 0.2]);
    }
    if (!hatted) for (let i = 0; i < 9; i++) P.add(GEO.lowSphere, i % 2 ? color : under, onSphere(i * 0.7 + 0.2, 0.3 + (i % 3) * 0.22, 1.14), [0.16, 0.16, 0.16]);
  }
  if (style.spikes) {
    const spikes = hatted
      ? [[1.9, 1.35], [-1.9, 1.35], [2.4, 1.45], [-2.4, 1.45], [Math.PI, 1.5]]
      : [[0, 0.62], [0.7, 0.55], [-0.7, 0.55], [1.5, 0.75], [-1.5, 0.75], [2.3, 0.85], [-2.3, 0.85], [Math.PI, 0.9], [2.9, 0.4], [-2.9, 0.4], [0.3, 0.12], [1.9, 1.3], [-1.9, 1.3]];
    for (const [phi, th] of spikes) {
      const dir = new THREE.Vector3(...onSphere(phi, th * 0.85, 1));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...onSphere(phi, th, 1.02)), q, new THREE.Vector3(0.24, 0.5, 0.24));
      P.add(GEO.cone, color, m.multiply(new THREE.Matrix4().makeTranslation(0, 0.5, 0)));
    }
  }
  if (look.hair === 'bangs') {
    // Straight side locks framing the face.
    for (const s of [-1, 1]) P.add(lockGeo(0.9, 0.2, 'side', 0.9), color, onSphere(s * 1.08, 1.55, 1.02), [1, 1, 0.55], [0, s * 1.08, s * 0.06]);
  }
  if (look.hair === 'long' || look.hair === 'wavy') {
    for (const s of [-1, 1]) P.add(lockGeo(0.75, 0.2, 'front', 0.5), color, onSphere(s * 1.2, 1.6, 1.02), [1, 1, 0.6], [0, s * 1.2, s * 0.12]);
  }

  const springs = [];
  if (style.drape) {
    const d = style.drape;
    const q = new Parts(0.265);
    q.add(lockGeo(d.L, d.w, d.wavy ? 'drapeW' : 'drape', 0.55), color, [0, 0, 0], [1, 1, d.d / d.w * 1.1]);
    if (d.wavy) for (let i = 0; i < 5; i++) q.add(GEO.lowSphere, under, [(i - 2) * 0.32, -d.L * 0.92, 0.02], [0.2, 0.18, 0.16]);
    springs.push({ geo: q.build(), pivot: [0, d.y, d.z], rot: [d.tilt, 0, 0], kind: 'drape' });
  }
  if (style.tails === 'pig') {
    for (const s of [-1, 1]) {
      const q = new Parts(0.265);
      q.add(GEO.torus, tie, [0, 0, 0], [0.16, 0.16, 0.2], [Math.PI / 2, 0, 0]);
      q.add(GEO.sphere, tie, [s * 0.05, 0.07, 0.08], [0.1, 0.1, 0.1]);
      q.add(lockGeo(1.0, 0.3, 'pig', 0.3), color, [0, -0.04, 0]);
      springs.push({ geo: q.build(), pivot: onSphere(s * 1.78, 1.3, 1.07), rot: [0.15, 0, s * 0.62], kind: 'tail', side: s });
    }
  }
  if (style.tails === 'pony') {
    const q = new Parts(0.265);
    q.add(GEO.torus, tie, [0, 0, 0], [0.17, 0.17, 0.22], [Math.PI / 2, 0, 0]);
    q.add(lockGeo(1.25, 0.3, 'pony', 0.25), color, [0, -0.03, -0.02]);
    springs.push({ geo: q.build(), pivot: onSphere(Math.PI, hatted ? 1.45 : 1.02, 1.08), rot: [hatted ? 0.35 : 0.9, 0, 0], kind: 'tail' });
  }
  if (style.ahoge && !hatted) {
    const q = new Parts(0.265);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.32, 0.12), new THREE.Vector3(0.14, 0.4, -0.08));
    q.add(new THREE.TubeGeometry(curve, 10, 0.045, 6, false), color);
    q.add(GEO.sphere, color, [0.14, 0.4, -0.08], [0.045, 0.045, 0.045]);
    springs.push({ geo: q.build(), pivot: onSphere(0.4, 0.25, 1.04), rot: [0, 0, 0], kind: 'ahoge' });
  }
  return { cap: P.build(), springs, covers: style.covers };
}

/* =============================================================== hats */

/** Builds the hat for a look into Parts. Returns { geo, spring?: {geo, pivot} , gold } */
export function buildHat(look) {
  const hat = look.hat;
  if (!hat || hat === 'none') return null;
  const c = crownOf(look);
  const col = look.hatColor || '#f4a6bd';
  const light = shade(col, 0.12), dark = shade(col, -0.1);
  const P = new Parts(0.265);
  let spring = null, gold = false;
  if (hat === 'cap') {
    P.push(new THREE.Matrix4().makeRotationX(-0.52));
    P.add(GEO.hemi, col, [0, 0, 0], [c * 1.04, c * 1.02, c * 1.04]);
    P.pop();
    // Brim: a curved half-disc out over the brow.
    P.push(new THREE.Matrix4().compose(new THREE.Vector3(...onSphere(0, 1.02, c * 0.98)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, 0)), new THREE.Vector3(1, 1, 1)));
    P.add(capBrim(), dark, [0, 0, -0.08], [0.78, 1, 0.78]);
    P.pop();
    P.add(GEO.sphere, dark, onSphere(0, 0.12, c * 1.03), [0.1, 0.07, 0.1]);
    P.add(heartGeo(), CREAM, onSphere(0, 0.62, c * 1.06), [0.14, 0.14, 0.06], [-0.62, 0, 0]);
  } else if (hat === 'beanie') {
    P.push(new THREE.Matrix4().makeRotationX(-0.42));
    P.add(lathe('beanie', smoothProfile([[1.0, 0.0], [1.02, 0.3], [0.9, 0.72], [0.55, 1.02], [0.001, 1.1]], 4), 32), col, [0, 0.02, 0], [c * 1.03, c, c * 1.03]);
    P.add(new THREE.TorusGeometry(1, 0.14, 10, 40), light, [0, 0.07, 0], [c * 1.04, c * 1.04, c * 1.2], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; P.add(GEO.box, dark, [Math.sin(a) * c * 1.155, 0.07, Math.cos(a) * c * 1.155], [0.03, 0.2, 0.03], [0, a, 0]); }
    P.pop();
    const q = new Parts(0.265);
    q.add(GEO.sphere, light, [0, 0.2, 0], [0.24, 0.23, 0.24]);
    for (let i = 0; i < 7; i++) q.add(GEO.lowSphere, col, [Math.sin(i * 0.9) * 0.14, 0.2 + Math.cos(i * 1.7) * 0.12, Math.cos(i * 0.9) * 0.14], [0.12, 0.12, 0.12]);
    spring = { geo: q.build(), pivot: onSphere(Math.PI, 0.42, c * 1.06), kind: 'pom' };
  } else if (hat === 'sunhat') {
    const straw = '#efd9a0';
    P.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.22, 0, 0.1)));
    P.add(lathe('sunbrim', smoothProfile([[0.7, 0.02], [1.1, 0.0], [1.45, -0.06], [1.72, -0.2], [1.68, -0.23], [1.4, -0.1], [1.05, -0.04], [0.7, -0.03]], 3), 40), straw, [0, 0.3, 0], [c, 1, c]);
    P.add(lathe('suncrown', smoothProfile([[0.98, 0], [1.02, 0.25], [0.95, 0.5], [0.7, 0.72], [0.001, 0.8]], 4), 32), straw, [0, 0.28, 0], [c, 1, c]);
    P.add(GEO.cyl, col, [0, 0.39, 0], [c * 1.03, 0.16, c * 1.03]);
    P.add(GEO.sphere, col, [-0.25, 0.38, -c * 0.98], [0.2, 0.14, 0.1], [0, 0, 0.5]);
    P.add(GEO.sphere, col, [0.25, 0.38, -c * 0.98], [0.2, 0.14, 0.1], [0, 0, -0.5]);
    flower(P, [c * 0.72, 0.45, c * 0.72], [0, Math.PI / 4, 0], 0.16, '#f4a6bd', GOLD);
    P.pop();
  } else if (hat === 'flower') {
    const at = onSphere(1.05, 0.95, 1.12);
    P.push(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...at).normalize()), new THREE.Vector3(1, 1, 1)));
    for (const s of [-1, 1]) P.add(leafGeo(0.45, 0.1), '#7cc47a', [s * 0.1, -0.05, -0.04], [0.32, 0.32, 0.32], [0, 0, s * 2.2]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      P.add(petal('f'), col, [0, 0, 0.02], [0.14, 0.19, 0.07], [0, 0, a]);
    }
    P.add(GEO.sphere, '#f7d77a', [0, 0, 0.07], [0.1, 0.1, 0.07]);
    P.pop();
  } else if (hat === 'bow') {
    const at = onSphere(0.55, 0.52, c * 1.02);
    P.push(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0.45, -0.35)), new THREE.Vector3(1, 1, 1)));
    for (const s of [-1, 1]) {
      P.add(GEO.sphere, col, [s * 0.3, 0.06, 0], [0.3, 0.22, 0.13], [0, 0, s * -0.35]);
      P.add(GEO.sphere, dark, [s * 0.36, 0.07, 0.035], [0.14, 0.1, 0.1], [0, 0, s * -0.35]);
      P.add(GEO.capsule, col, [s * 0.12, -0.2, -0.02], [0.13, 0.22, 0.07], [0, 0, s * 0.35]);
    }
    P.add(GEO.sphere, light, [0, 0.03, 0.03], [0.12, 0.12, 0.11]);
    P.pop();
  } else if (hat === 'bucket') {
    P.push(new THREE.Matrix4().makeRotationX(-0.16));
    P.add(lathe('bucketcrown', smoothProfile([[1.0, 0], [1.02, 0.3], [0.93, 0.62], [0.55, 0.78], [0.001, 0.8]], 4), 32), col, [0, 0.26, 0], [c, 1, c]);
    P.add(lathe('bucketbrim', [[1.0, 0.02], [1.45, -0.28], [1.48, -0.32], [1.42, -0.31], [0.98, -0.02]], 36), col, [0, 0.3, 0], [c, 1, c]);
    P.add(GEO.cyl, light, [0, 0.36, 0], [c * 1.02, 0.1, c * 1.02]);
    P.pop();
  } else if (hat === 'crown') {
    gold = true;
    P.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.1, 0, 0.22)).setPosition(0.12, c * 0.86, 0));
    P.add(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), GOLD, [0, 0.08, 0], [0.42, 0.18, 0.42]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      P.add(GEO.cone, GOLD, [Math.sin(a) * 0.4, 0.3, Math.cos(a) * 0.4], [0.12, 0.28, 0.12]);
      P.add(GEO.sphere, '#fff1b8', [Math.sin(a) * 0.4, 0.46, Math.cos(a) * 0.4], [0.055, 0.055, 0.055]);
    }
    P.add(GEO.torus, shade(GOLD, -0.08), [0, -0.01, 0], [0.43, 0.43, 0.3], [Math.PI / 2, 0, 0]);
    P.add(GEO.sphere, '#e76f8f', [0, 0.1, 0.43], [0.08, 0.08, 0.05]);
    P.add(GEO.sphere, '#7fc3c9', [0.38, 0.1, 0.2], [0.06, 0.06, 0.04]);
    P.add(GEO.sphere, '#7fc3c9', [-0.38, 0.1, 0.2], [0.06, 0.06, 0.04]);
    P.pop();
  } else if (hat === 'frog') {
    const green = '#8fc97a', dg = '#6aa35d';
    P.push(new THREE.Matrix4().makeRotationX(-0.14));
    P.add(lathe('frogcrown', smoothProfile([[1.0, 0], [1.03, 0.3], [0.9, 0.62], [0.5, 0.78], [0.001, 0.8]], 4), 32), green, [0, 0.26, 0], [c, 1, c]);
    P.add(lathe('frogbrim', [[1.0, 0.02], [1.32, -0.14], [1.35, -0.18], [1.3, -0.18], [0.98, -0.02]], 36), dg, [0, 0.3, 0], [c, 1, c]);
    for (const s of [-1, 1]) {
      P.add(GEO.sphere, green, [s * 0.42, 1.02, 0.34], [0.27, 0.25, 0.25]);
      P.add(GEO.sphere, WHITE, [s * 0.44, 1.05, 0.54], [0.17, 0.17, 0.08]);
      P.add(GEO.sphere, '#26331f', [s * 0.44, 1.05, 0.59], [0.09, 0.11, 0.05]);
      P.add(GEO.sphere, WHITE, [s * 0.41, 1.1, 0.63], [0.03, 0.03, 0.02]);
      P.add(GEO.sphere, '#f59ab0', [s * 0.7, 0.58, 0.72], [0.12, 0.07, 0.04], [0, s * 0.7, 0]);
    }
    P.pop();
  } else if (hat === 'headband') {
    P.push(new THREE.Matrix4().makeRotationX(0.38));
    P.add(new THREE.TorusGeometry(1, 0.075, 8, 40, Math.PI), col, [0, -0.02, 0], [c * 1.0, c * 1.0, c * 1.25]);
    P.pop();
    const at = onSphere(-0.62, 0.62, c * 1.05);
    P.push(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...at).normalize()), new THREE.Vector3(1, 1, 1)));
    for (const s of [-1, 1]) P.add(GEO.sphere, col, [s * 0.14, 0, 0.02], [0.15, 0.1, 0.06], [0, 0, s * -0.35]);
    P.add(GEO.sphere, dark, [0, 0, 0.05], [0.065, 0.065, 0.05]);
    P.pop();
  }
  return { geo: P.build(), spring, gold };
}

/** A cap brim: a half disc with a soft downward curve, pointing +z. */
const capBrim = () => cached('capBrim', () => {
  const g = new THREE.CylinderGeometry(1, 1, 0.07, 28, 1, false, -Math.PI / 2, Math.PI);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) - 0.22 * x * x - 0.1 * z * z); }
  g.computeVertexNormals();
  return g;
});

function flower(P, pos, rot, s, color, center) {
  P.push(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(s, s, s)));
  for (let i = 0; i < 5; i++) P.add(petal('f'), color, [0, 0, 0], [0.7, 0.95, 0.35], [0, 0, (i / 5) * TAU]);
  P.add(GEO.sphere, center, [0, 0, 0.25], [0.5, 0.5, 0.35]);
  P.pop();
}

/* ============================================================ extras */

/** Head-space extras (glasses, sunnies, earrings, heart pin). */
export function buildHeadExtra(look) {
  const e = look.extra;
  const P = new Parts(0.265);
  const eyeT = 1.69, eyeP = 0.34;
  if (e === 'glasses' || e === 'sunnies') {
    const frame = e === 'glasses' ? '#6b4a3a' : '#f06d98';
    for (const s of [-1, 1]) {
      const at = onSphere(s * eyeP, eyeT, 1.1);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, s * eyeP, 0));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), q, new THREE.Vector3(1, 1, 1));
      P.push(m);
      if (e === 'glasses') P.add(new THREE.TorusGeometry(0.2, 0.03, 8, 28), frame, [0, 0, 0], [1, 1.08, 1]);
      else {
        P.add(heartGeo(0.2), '#2c2233', [0, -0.01, 0], [0.2, 0.2, 0.09]);
        P.add(GEO.sphere, '#f5f0ff', [-0.07, 0.06, 0.05], [0.04, 0.025, 0.01]);
      }
      P.pop();
      // Temples back to the ears.
      P.rod(onSphere(s * 0.58, eyeT - 0.05, 1.07), onSphere(s * 1.45, eyeT - 0.1, 1.04), 0.022, frame);
    }
    P.rod(onSphere(-0.13, eyeT - 0.04, 1.12), onSphere(0.13, eyeT - 0.04, 1.12), 0.025, frame);
  } else if (e === 'earrings') {
    for (const s of [-1, 1]) {
      const at = onSphere(s * 1.55, 1.98, 1.14);
      P.add(GEO.sphere, GOLD, at, [0.05, 0.05, 0.05]);
      P.add(GEO.torus, GOLD, [at[0], at[1] - 0.1, at[2]], [0.07, 0.07, 0.07], [0, Math.PI / 2, 0]);
      P.add(heartGeo(), '#e76f8f', [at[0], at[1] - 0.2, at[2]], [0.06, 0.06, 0.04], [0, s * Math.PI / 2, 0]);
    }
  } else if (e === 'heartpin') {
    const at = onSphere(0.72, 0.98, 1.13);
    P.add(heartGeo(0.3), '#e85d84', at, [0.14, 0.14, 0.1], [-0.3, 0.72, -0.35]);
    P.add(GEO.sphere, '#ffe3ec', [at[0] - 0.03, at[1] + 0.05, at[2] + 0.05], [0.03, 0.02, 0.02]);
  } else return null;
  return P.build();
}

/** Chest-space extras (scarf, backpack). Metres, spine space. */
export function buildBodyExtra(look, dims) {
  const e = look.extra;
  const col = look.hatColor || '#e76f8f';
  const P = new Parts();
  if (e === 'scarf') {
    const light = CREAM;
    P.add(new THREE.TorusGeometry(1, 0.42, 10, 28), col, [0, dims.neckY - 0.02, 0.005], [0.095, 0.095, 0.1], [Math.PI / 2 - 0.12, 0, 0]);
    // The knotted end hanging over the chest, knitted stripes.
    const q = new THREE.Matrix4().compose(new THREE.Vector3(-0.055, dims.neckY - 0.05, 0.105), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, -0.14)), new THREE.Vector3(1, 1, 1));
    P.push(q);
    P.add(GEO.sphere, col, [0, 0.005, 0], [0.04, 0.035, 0.03]);
    for (let i = 0; i < 4; i++) P.add(GEO.box, i % 2 ? light : col, [0, -0.03 - i * 0.026, -0.004 * i], [0.058, 0.028, 0.022]);
    P.add(GEO.box, col, [0, -0.14, -0.018], [0.058, 0.035, 0.02]);
    for (let i = 0; i < 4; i++) P.add(GEO.cyl, light, [-0.021 + i * 0.014, -0.17, -0.02], [0.006, 0.03, 0.006]);
    P.pop();
  } else if (e === 'backpack') {
    const z = -dims.backZ;
    P.add(GEO.capsule, col, [0, dims.neckY * 0.55, z - 0.045], [0.2, 0.1, 0.11]);
    P.add(GEO.sphere, shade(col, -0.08), [0, dims.neckY * 0.55 + 0.08, z - 0.05], [0.1, 0.05, 0.065]);
    P.add(GEO.capsule, shade(col, 0.1), [0, dims.neckY * 0.46, z - 0.1], [0.12, 0.06, 0.04]);
    P.add(heartGeo(), CREAM, [0, dims.neckY * 0.47, z - 0.125], [0.025, 0.025, 0.012], [0, Math.PI, 0]);
    for (const s of [-1, 1]) {
      P.add(new THREE.TorusGeometry(1, 0.12, 6, 20, Math.PI * 1.1), shade(col, -0.15), [s * 0.075, dims.neckY * 0.68, -0.005], [0.12, 0.15, 0.1], [0, Math.PI / 2, -0.3]);
    }
  } else return null;
  return P.build();
}

/* ============================================================ clothes */

/** Limb lengths (metres, joint to joint). */
export const LEG_L = 0.11, ARM_U = 0.095, ARM_F = 0.085;

/** Torso dimensions shared by clothes and rig (metres, spine space). */
export const TORSO = {
  profile: smoothProfile([[0.001, -0.035], [0.1, -0.03], [0.145, 0.0], [0.152, 0.06], [0.142, 0.13], [0.125, 0.2], [0.1, 0.25], [0.066, 0.285], [0.04, 0.3]], 4),
  depth: 0.84,
  neckY: 0.29,
  shoulderY: 0.232,
  shoulderX: 0.108,
  backZ: 0.118,
};

/** What each top does to arms and legs. */
export const TOP_KIND = {
  tee: { sleeve: 'short' }, hoodie: { sleeve: 'long' }, sweater: { sleeve: 'long' }, dress: { sleeve: 'puff', skirt: 'dress' },
  overalls: { sleeve: 'short', shirt: CREAM }, flannel: { sleeve: 'long' }, cardigan: { sleeve: 'long' }, jersey: { sleeve: 'short' },
  tank: { sleeve: 'none' }, kimono: { sleeve: 'wide', skirt: 'kimono' },
};

/** Grey-scale cloth textures multiplied by the cloth colour. */
const clothTex = new Map();
export function clothTexture(kind) {
  if (!clothTex.has(kind)) {
    clothTex.set(kind, canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      if (kind === 'plaid') {
        g.fillStyle = 'rgba(40,20,20,.22)';
        for (let i = 0; i < 4; i++) { g.fillRect(i * 32 + 6, 0, 12, h); g.fillRect(0, i * 32 + 6, w, 12); }
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 4; i++) { g.fillRect(i * 32 + 24, 0, 3, h); g.fillRect(0, i * 32 + 24, w, 3); }
      } else if (kind === 'knit') {
        g.strokeStyle = 'rgba(60,40,40,.12)'; g.lineWidth = 2;
        for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 6); g.lineTo(x + 8, y); g.stroke(); }
      } else if (kind === 'stripe') {
        g.fillStyle = 'rgba(255,255,255,1)'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(40,30,30,.14)'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 12);
      }
    }, { repeat: kind === 'plaid' ? [5, 3] : kind === 'knit' ? [6, 4] : [1, 4] }));
  }
  return clothTex.get(kind);
}

/** Front-of-torso details for a top, spine space. */
export function buildTopDetail(look, skin) {
  const top = look.top, col = look.topColor;
  const dark = shade(col, -0.1), light = shade(col, 0.1);
  const { neckY } = TORSO;
  const P = new Parts();
  // A little neck so a tilted head never floats.
  P.add(GEO.cyl, skin, [0, neckY + 0.03, 0.0], [0.042, 0.1, 0.038]);
  const front = (y) => { // surface point on the torso front at height y
    const prof = TORSO.profile; let r = 0.1;
    for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; r = r0 + (r1 - r0) * ((y - y0) / (y1 - y0)); break; }
    return r * TORSO.depth;
  };
  if (top === 'tee') {
    P.add(GEO.torus, dark, [0, neckY - 0.012, 0], [0.05, 0.05, 0.05], [Math.PI / 2 - 0.15, 0, 0]);
    P.add(heartGeo(), CREAM, [0.045, 0.14, front(0.14) + 0.002], [0.025, 0.025, 0.01], [-0.15, 0.3, 0]);
  } else if (top === 'hoodie') {
    P.add(GEO.sphere, light, [0, neckY - 0.03, -0.06], [0.12, 0.075, 0.08], [0.4, 0, 0]);
    P.add(GEO.torus, dark, [0, neckY - 0.015, 0], [0.056, 0.056, 0.06], [Math.PI / 2 - 0.15, 0, 0]);
    for (const s of [-1, 1]) { P.rod([s * 0.022, neckY - 0.02, front(neckY - 0.02) + 0.004], [s * 0.028, neckY - 0.1, front(neckY - 0.1) + 0.006], 0.006, CREAM); P.add(GEO.sphere, CREAM, [s * 0.028, neckY - 0.105, front(neckY - 0.1) + 0.006], [0.011, 0.014, 0.011]); }
    P.add(GEO.capsule, dark, [0, 0.07, front(0.07) - 0.014], [0.13, 0.05, 0.05], [0, 0, Math.PI / 2]);
  } else if (top === 'sweater') {
    P.add(GEO.torus, light, [0, neckY - 0.014, 0], [0.056, 0.056, 0.07], [Math.PI / 2 - 0.15, 0, 0]);
    P.add(GEO.torus, light, [0, -0.02, 0], [0.142, 0.142 * TORSO.depth, 0.1], [Math.PI / 2, 0, 0]);
    P.add(heartGeo(), light, [0, 0.13, front(0.13) + 0.003], [0.035, 0.035, 0.012], [-0.15, 0, 0]);
  } else if (top === 'dress') {
    for (const s of [-1, 1]) P.add(GEO.sphere, CREAM, [s * 0.03, neckY - 0.025, front(neckY - 0.025) - 0.012], [0.045, 0.02, 0.035], [0.3, 0, s * 0.45]);
    P.add(GEO.sphere, dark, [0, neckY - 0.05, front(neckY - 0.05) + 0.004], [0.018, 0.016, 0.012]);
    for (const s of [-1, 1]) P.add(GEO.sphere, dark, [s * 0.022, neckY - 0.05, front(neckY - 0.05)], [0.022, 0.014, 0.01], [0, 0, s * 0.4]);
  } else if (top === 'overalls') {
    P.add(GEO.box, col, [0, 0.1, front(0.1) - 0.018], [0.15, 0.13, 0.045]);
    P.add(GEO.capsule, col, [0, 0.165, front(0.165) - 0.014], [0.15, 0.03, 0.04], [0, 0, Math.PI / 2]);
    P.add(GEO.box, dark, [0, 0.09, front(0.09) + 0.006], [0.06, 0.045, 0.006]);
    for (const s of [-1, 1]) {
      P.add(GEO.sphere, GOLD, [s * 0.052, 0.168, front(0.168) + 0.01], [0.014, 0.014, 0.01]);
      P.rod([s * 0.052, 0.17, front(0.17) - 0.005], [s * 0.078, 0.268, 0.02], 0.014, col);
      P.rod([s * 0.078, 0.268, 0.02], [s * 0.07, 0.1, -front(0.1) + 0.006], 0.014, col);
    }
  } else if (top === 'flannel') {
    for (const s of [-1, 1]) P.add(GEO.cone, dark, [s * 0.03, neckY - 0.03, front(neckY - 0.03) - 0.005], [0.035, 0.05, 0.012], [0.3, 0, Math.PI + s * 0.6]);
    for (let i = 0; i < 3; i++) P.add(GEO.sphere, CREAM, [0, 0.2 - i * 0.07, front(0.2 - i * 0.07) + 0.003], [0.009, 0.009, 0.006]);
    P.add(GEO.box, dark, [-0.05, 0.17, front(0.17) - 0.002], [0.045, 0.04, 0.008], [-0.25, 0.3, 0]);
  } else if (top === 'cardigan') {
    P.add(GEO.capsule, CREAM, [0, 0.19, front(0.19) - 0.013], [0.045, 0.1, 0.03]);
    for (let i = 0; i < 3; i++) P.add(GEO.sphere, light, [0.028, 0.17 - i * 0.06, front(0.17 - i * 0.06) + 0.004], [0.01, 0.01, 0.007]);
    P.add(GEO.torus, dark, [0, -0.02, 0], [0.142, 0.142 * TORSO.depth, 0.08], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) P.add(GEO.box, dark, [s * 0.075, 0.06, front(0.06) - 0.004], [0.04, 0.035, 0.008], [0, s * 0.5, 0]);
  } else if (top === 'jersey') {
    for (const s of [-1, 1]) P.rod([s * 0.004, neckY - 0.07, front(neckY - 0.07) + 0.004], [s * 0.042, neckY - 0.01, front(neckY - 0.01) + 0.004], 0.008, CREAM);
    P.add(starGeo(5, 0.48, 0.2), CREAM, [0, 0.12, front(0.12) + 0.004], [0.045, 0.045, 0.02], [-0.12, 0, 0]);
    for (const s of [-1, 1]) P.add(GEO.box, CREAM, [s * 0.148, 0.09, 0], [0.012, 0.16, 0.03], [0, 0, s * 0.08]);
  } else if (top === 'tank') {
    P.add(GEO.sphere, skin, [0, neckY - 0.045, 0.012], [0.07, 0.04, front(neckY - 0.045) - 0.004]);
    for (const s of [-1, 1]) P.add(GEO.box, col, [s * 0.058, neckY - 0.03, 0], [0.022, 0.03, 0.1]);
  } else if (top === 'kimono') {
    const trim = mixHex(CREAM, col, 0.15);
    P.rod([0.045, neckY - 0.005, front(neckY) + 0.006], [-0.03, 0.08, front(0.08) + 0.006], 0.012, trim);
    P.rod([-0.045, neckY - 0.005, front(neckY) + 0.004], [0.0, 0.14, front(0.14) + 0.004], 0.011, trim);
    const obi = mixHex('#f7d77a', col, 0.2);
    P.add(GEO.cyl, obi, [0, 0.035, 0], [0.152, 0.07, 0.152 * TORSO.depth]);
    P.add(GEO.cyl, shade(obi, -0.12), [0, 0.035, 0], [0.154, 0.012, 0.154 * TORSO.depth]);
    for (const s of [-1, 1]) P.add(GEO.sphere, obi, [s * 0.06, 0.05, -0.14], [0.07, 0.045, 0.035], [0, 0, s * -0.3]);
    P.add(GEO.sphere, shade(obi, -0.05), [0, 0.045, -0.14], [0.03, 0.03, 0.03]);
  }
  return P.build();
}

/** Hip-space skirt/dress flare (null for trousers). */
export function buildSkirt(look) {
  const kind = TOP_KIND[look.top]?.skirt || (look.bottom === 'skirt' ? 'skirt' : null);
  if (!kind) return null;
  const P = new Parts();
  if (kind === 'dress') {
    const col = look.topColor;
    P.add(lathe('dressSkirt', smoothProfile([[0.13, 0.1], [0.155, 0.04], [0.19, -0.04], [0.215, -0.1], [0.2, -0.115], [0.001, -0.115]], 4), 28), col, [0, 0.03, 0], [1, 1, 0.92]);
    P.add(GEO.torus, CREAM, [0, 0.03 - 0.108, 0], [0.207, 0.207 * 0.92, 0.1], [Math.PI / 2, 0, 0]);
  } else if (kind === 'kimono') {
    const col = look.topColor;
    P.add(lathe('kimonoSkirt', smoothProfile([[0.14, 0.1], [0.15, 0.0], [0.145, -0.14], [0.15, -0.21], [0.14, -0.225], [0.001, -0.225]], 4), 28), col, [0, 0.03, 0], [1, 1, 0.9]);
    P.rod([0.07, 0.1, 0.13], [0.02, -0.19, 0.137], 0.008, shade(col, -0.12));
    P.add(GEO.torus, shade(col, -0.1), [0, 0.03 - 0.215, 0], [0.147, 0.147 * 0.9, 0.08], [Math.PI / 2, 0, 0]);
  } else {
    const col = look.bottomColor;
    P.add(lathe('skirtSkirt', smoothProfile([[0.14, 0.07], [0.16, 0.03], [0.2, -0.04], [0.205, -0.055], [0.001, -0.055]], 4), 28), col, [0, 0.03, 0], [1, 1, 0.92]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; P.add(GEO.box, shade(col, -0.08), [Math.sin(a) * 0.178, -0.005, Math.cos(a) * 0.178 * 0.92], [0.006, 0.09, 0.006], [0, a, Math.sin(a) * 0.4]); }
  }
  return P.build();
}

/** Upper arm / forearm for a look (arm space, hanging down -y). */
export function buildArm(look, skin, segment, side) {
  const sleeve = TOP_KIND[look.top]?.sleeve || 'short';
  const col = look.top === 'overalls' ? CREAM : look.topColor;
  const P = new Parts();
  const L = segment === 'upper' ? ARM_U : ARM_F;
  if (segment === 'upper') {
    if (sleeve === 'none') P.add(limb(0.041, 0.037, L), skin);
    else if (sleeve === 'short') { P.add(limb(0.041, 0.037, L), skin); P.add(limb(0.052, 0.049, 0.06), col); P.add(GEO.torus, shade(col, -0.08), [0, -0.062, 0], [0.047, 0.047, 0.05], [Math.PI / 2, 0, 0]); }
    else if (sleeve === 'puff') { P.add(limb(0.041, 0.037, L), skin); P.add(GEO.sphere, col, [0, -0.02, 0], [0.062, 0.06, 0.06]); P.add(GEO.torus, CREAM, [0, -0.055, 0], [0.04, 0.04, 0.05], [Math.PI / 2, 0, 0]); }
    else P.add(limb(0.046, 0.042, L), col);
  } else {
    if (sleeve === 'long') { P.add(limb(0.042, 0.04, L), col); P.add(GEO.torus, shade(col, 0.08), [0, -L, 0], [0.038, 0.038, 0.06], [Math.PI / 2, 0, 0]); }
    else if (sleeve === 'wide') { P.add(limb(0.036, 0.033, L), skin); P.add(lathe('wideSleeve', smoothProfile([[0.043, 0.01], [0.055, -0.04], [0.078, -0.085], [0.07, -0.09], [0.045, -0.06]], 3), 18), col); }
    else P.add(limb(0.037, 0.034, L), skin);
  }
  return P.build();
}

/** Thigh or shin for a look (leg space, hanging down -y). */
export function buildLeg(look, skin, segment) {
  const skirt = TOP_KIND[look.top]?.skirt;
  const overalls = look.top === 'overalls';
  const bottom = skirt ? 'bare' : look.bottom;
  const col = overalls ? look.topColor : look.bottomColor;
  const dark = shade(col, -0.08), light = shade(col, 0.1);
  const P = new Parts();
  const L = LEG_L;
  if (segment === 'thigh') {
    if (bottom === 'bare' || bottom === 'skirt') P.add(limb(0.05, 0.043, L), skin);
    else if (bottom === 'shorts') { P.add(limb(0.049, 0.043, L), skin); P.add(limb(0.064, 0.062, 0.055), col); P.add(GEO.torus, dark, [0, -0.057, 0], [0.058, 0.058, 0.05], [Math.PI / 2, 0, 0]); }
    else if (bottom === 'leggings') P.add(limb(0.053, 0.046, L), col);
    else if (bottom === 'cargo') { P.add(limb(0.062, 0.056, L), col); P.add(GEO.box, dark, [0.045, -0.055, 0.0], [0.03, 0.04, 0.045], [0, 0, 0.1]); }
    else if (bottom === 'joggers') P.add(limb(0.061, 0.055, L), col);
    else P.add(limb(0.058, 0.052, L), col);
  } else {
    const boot = look.shoes === 'rainboots' ? 0.094 : look.shoes === 'boots' ? 0.055 : 0;
    if (bottom === 'bare' || bottom === 'skirt' || bottom === 'shorts') P.add(limb(0.043, 0.037, L), skin);
    else if (bottom === 'leggings') P.add(limb(0.046, 0.04, L), col);
    else if (bottom === 'joggers') { P.add(limb(0.055, 0.05, L - 0.012), col); P.add(GEO.cyl, dark, [0, -L + 0.006, 0], [0.045, 0.022, 0.045]); for (const s of [-1, 1]) P.add(GEO.box, CREAM, [s * 0.052, -0.05, 0], [0.006, 0.09, 0.012]); }
    else if (bottom === 'cargo') { P.add(limb(0.056, 0.052, L - 0.01), col); P.add(GEO.cyl, dark, [0, -L + 0.004, 0], [0.05, 0.02, 0.05]); }
    else { P.add(limb(0.052, 0.049, L - 0.01), col); if (!boot) P.add(GEO.torus, light, [0, -L + 0.012, 0], [0.047, 0.047, 0.07], [Math.PI / 2, 0, 0]); }
    if (boot) {
      const sc = look.shoeColor;
      P.add(GEO.cyl, sc, [0, -L + boot / 2 - 0.01, 0], [0.056, boot + 0.02, 0.056]);
      P.add(GEO.torus, look.shoes === 'boots' ? CREAM : shade(sc, 0.12), [0, -L + boot, 0], [0.056, 0.056, 0.1], [Math.PI / 2, 0, 0]);
    }
  }
  return P.build();
}

/** A shoe in ankle space: sole at y = -ANKLE, toe towards +z. */
export const ANKLE = 0.058;
export function buildShoe(look, skin, side) {
  const s = look.shoes, col = look.shoeColor;
  const P = new Parts();
  const lightShoe = new THREE.Color(col).getHSL({}).l > 0.78;
  const y0 = -ANKLE;
  if (s === 'sneakers') {
    const sole = lightShoe ? '#f2a9bd' : '#fbf4ea';
    P.add(GEO.sphere, col, [0, y0 + 0.036, 0.022], [0.05, 0.04, 0.078]);
    P.add(GEO.cyl, sole, [0, y0 + 0.01, 0.022], [0.054, 0.02, 0.083]);
    P.add(GEO.sphere, sole, [0, y0 + 0.024, 0.074], [0.04, 0.025, 0.03]);
    for (let i = 0; i < 2; i++) P.add(GEO.box, sole, [0, y0 + 0.07 - i * 0.004, 0.012 + i * 0.024], [0.045, 0.008, 0.009], [0.5, 0, 0]);
  } else if (s === 'boots') {
    P.add(GEO.sphere, col, [0, y0 + 0.036, 0.02], [0.054, 0.042, 0.078]);
    P.add(GEO.cyl, shade(col, -0.25), [0, y0 + 0.009, 0.02], [0.057, 0.018, 0.082]);
  } else if (s === 'sandals') {
    P.add(GEO.sphere, skin, [0, y0 + 0.03, 0.022], [0.043, 0.033, 0.07]);
    P.add(GEO.cyl, col, [0, y0 + 0.009, 0.022], [0.05, 0.018, 0.08]);
    P.add(GEO.torus, col, [0, y0 + 0.032, 0.05], [0.042, 0.03, 0.05], [Math.PI / 2 - 0.2, 0, 0]);
    P.add(GEO.torus, col, [0, y0 + 0.03, -0.01], [0.042, 0.036, 0.05], [Math.PI / 2 + 0.3, 0, 0]);
    P.add(GEO.sphere, '#f7d77a', [0, y0 + 0.058, 0.045], [0.014, 0.014, 0.014]);
  } else if (s === 'flats') {
    P.add(GEO.sphere, skin, [0, y0 + 0.036, 0.018], [0.042, 0.03, 0.062]);
    P.add(GEO.sphere, col, [0, y0 + 0.028, 0.022], [0.049, 0.03, 0.078]);
    P.add(GEO.cyl, shade(col, -0.12), [0, y0 + 0.007, 0.022], [0.05, 0.014, 0.08]);
    for (const k of [-1, 1]) P.add(GEO.sphere, shade(col, 0.12), [k * 0.013, y0 + 0.05, 0.068], [0.016, 0.011, 0.008], [0, 0, k * 0.4]);
  } else if (s === 'rainboots') {
    P.add(GEO.sphere, col, [0, y0 + 0.038, 0.02], [0.057, 0.045, 0.08]);
    P.add(GEO.cyl, shade(col, -0.15), [0, y0 + 0.009, 0.02], [0.059, 0.018, 0.083]);
  } else { // slippers: fluffy bunnies
    P.add(GEO.sphere, col, [0, y0 + 0.036, 0.02], [0.058, 0.044, 0.084]);
    P.add(GEO.cyl, shade(col, -0.12), [0, y0 + 0.008, 0.02], [0.058, 0.016, 0.082]);
    for (const k of [-1, 1]) {
      P.add(GEO.sphere, col, [k * 0.026, y0 + 0.095, -0.0], [0.016, 0.042, 0.011], [-0.3, 0, k * 0.25]);
      P.add(GEO.sphere, '#f59ab0', [k * 0.026, y0 + 0.095, 0.006], [0.009, 0.03, 0.007], [-0.3, 0, k * 0.25]);
      P.add(GEO.sphere, '#2b2020', [k * 0.018, y0 + 0.058, 0.086], [0.006, 0.007, 0.004]);
    }
    P.add(GEO.sphere, '#f59ab0', [0, y0 + 0.045, 0.1], [0.008, 0.006, 0.005]);
  }
  return P.build();
}

/** The rounded "shorts" part of the bottoms, hip space. */
export function pelvisColor(look) {
  if (TOP_KIND[look.top]?.skirt) return look.topColor;
  if (look.top === 'overalls') return look.topColor;
  return look.bottomColor;
}

export { COVERING_HATS };
