// The little people: big heads, tiny bodies, soft everything.
//
// A plain transform rig (no skinning) driven by the pose functions in
// chibi-anim.mjs:
//
//   root ─ body (squash) ─ hips ─ spine ─ neck ─ head ─ skull
//                                        │       └ shoulder ─ elbow ─ hand
//                                        └ thigh ─ knee ─ ankle
//
// Metres, feet at y = 0, facing +z. Everything a person wears is built from
// their LOOK (src/shared-look.mjs); setLook only rebuilds what changed.

import { THREE, shadowBlob, ease } from '../kit.mjs';
import { cleanLook } from '../../shared-look.mjs';
import {
  clamp, lerp, cmat, vcol, Parts, cached, smoothSphere, lathe, decalGeo, Spring, part, node,
  disposeOwned, isShared, shade, onSphere, sm, GEO, EMPTY_GEO,
} from './common.mjs';
import { EYE, MOUTH, MOUTH_GRID, chibiEyeAtlas, chibiMouthAtlas, chibiCheeks, atlasMaterial } from './face.mjs';
import {
  buildHair, buildHat, buildHeadExtra, buildBodyExtra, buildTopDetail, buildSkirt, buildArm, buildLeg, buildShoe,
  pelvisColor, clothTexture, crownOf, HAIR_STYLES, TORSO, TOP_KIND, ANKLE, LEG_L, ARM_U, ARM_F,
} from './chibi-parts.mjs';
import { newPose, rest, copyPose, blendPose, STATES } from './chibi-anim.mjs';

/* ------------------------------------------------------------ measures */

export const CHIBI = {
  HIP: LEG_L * 2 + ANKLE,     // hip joint above the soles
  SPINE_Y: 0.035,
  NECK_Y: TORSO.neckY,
  HEAD_Y: 0.27,               // head centre above the neck pivot
  R: 0.265,                   // skull radius
  SKULL: [1, 0.94, 0.96],
  HAND: 0.036,                // hand centre below the wrist
};
const { HIP, SPINE_Y, NECK_Y, HEAD_Y, R } = CHIBI;

const HAT_TOP = { none: 0, cap: 1.22, beanie: 1.62, sunhat: 1.3, flower: 1.12, bow: 1.36, bucket: 1.24, crown: 1.62, frog: 1.42, headband: 1.14 };
const HAIR_TOP = { bun: 1.5, spiky: 1.45, afro: 1.42, curly: 1.22, short: 1.35 };

/* ------------------------------------------------------ cached geometry */

const skullGeo = (ears, q) => cached(`skull:${ears}:${q}`, () => {
  const P = new Parts();
  P.add(smoothSphere(q === 'low' ? 22 : 30, q === 'low' ? 16 : 22), '#fff');
  if (ears) for (const s of [-1, 1]) P.add(GEO.sphere, '#fff', onSphere(s * Math.PI / 2, 1.72, 0.97), [0.16, 0.21, 0.12], [0, s * 0.25, s * -0.12]);
  const g = P.build(); g.deleteAttribute('color'); return g;
});
const handGeo = (side) => cached(`hand:${side}`, () => {
  const P = new Parts();
  P.add(GEO.sphere, '#fff', [0, 0, 0], [0.046, 0.05, 0.041]);
  P.add(GEO.sphere, '#fff', [-side * 0.024, 0.008, 0.026], [0.02, 0.024, 0.018], [0.3, 0, 0]);
  const g = P.build(); g.deleteAttribute('color'); return g;
});
const browGeo = () => cached('brow', () => {
  const g = new THREE.TorusGeometry(0.22, 0.036, 6, 12, 1.0);
  g.rotateZ(Math.PI / 2 - 0.5);
  g.translate(0, -0.22, 0);
  g.scale(1, 1, 0.6);
  return g;
});
const pelvisGeo = () => cached('pelvis', () => new THREE.SphereGeometry(1, 18, 12));
/* ---------------------------------------------------------------- scratch */

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
const DOWN = new THREE.Vector3(0, -1, 0);

/** Transform a point from `obj` space to `stop` space by walking up local matrices. */
function toSpace(obj, stop, v) {
  _m.identity();
  for (let n = obj; n && n !== stop; n = n.parent) { n.updateMatrix(); _m.premultiply(n.matrix); }
  return v.applyMatrix4(_m);
}
function quatTo(obj, stop, q) {
  q.identity();
  for (let n = obj; n && n !== stop; n = n.parent) q.premultiply(n.quaternion);
  return q;
}

/* ================================================================ chibi */

class Chibi {
  constructor(look, quality) {
    this.quality = quality;
    this.keys = {};
    this.look = null;
    this.own = [];          // per-character materials to dispose

    /* ---- rig ---- */
    const root = this.root = new THREE.Group();
    root.name = 'chibi';
    this.shadow = shadowBlob(0.27, 0.34);
    root.add(this.shadow);
    this.body = node(root, [0, 0, 0], 'body');
    this.hips = node(this.body, [0, HIP, 0], 'hips');
    this.spine = node(this.hips, [0, SPINE_Y, 0], 'spine');
    this.neck = node(this.spine, [0, NECK_Y, 0], 'neck');
    this.head = node(this.neck, [0, 0, 0], 'head');
    this.skull = node(this.head, [0, HEAD_Y, 0], 'skull');
    this.skull.scale.set(R * CHIBI.SKULL[0], R * CHIBI.SKULL[1], R * CHIBI.SKULL[2]);

    this.skinMat = null;
    const vc = vcol({ roughness: 0.74 });
    this.vc = vc;
    this.pelvis = part(pelvisGeo(), vc, this.hips, [0, 0.028, -0.004], [0.138, 0.098, 0.118]);
    this.skirt = part(null, vc, this.hips);
    this.torso = part(lathe('torso', TORSO.profile, 26), vc, this.spine, [0, 0, 0], [1, 1, TORSO.depth]);
    this.topDetail = part(null, vc, this.spine);
    this.bodyExtra = part(null, vc, this.spine);

    this.skullMesh = part(skullGeo(true, quality), vc, this.skull);
    this.cheeks = { material: new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) };
    this.own.push(this.cheeks.material);
    this.cheekMesh = part(decalGeo(1.01, 1.9, 1.6, 0.65), this.cheeks.material, this.skull, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    this.mouth = atlasMaterial(chibiMouthAtlas(), MOUTH_GRID[0], MOUTH_GRID[1], { roughness: 0.5 });
    this.own.push(this.mouth.material, this.mouth.texture);
    this.mouthMesh = part(decalGeo(1.014, 0.5, 1.74, 0.5), this.mouth.material, this.skull, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    this.eyesMesh = part(decalGeo(1.018, 1.6, 1.29, 0.8, 28, 14), vc, this.skull, [0, 0, 0], [1, 1, 1], [0, 0, 0], false);
    this.eyes = null;
    this.brows = [-1, 1].map((s) => {
      const pivot = node(this.skull);
      const m = part(browGeo(), vc, pivot, [0, 0, 1.03], [1, 1, 1], [0, 0, 0], false);
      return { pivot, mesh: m, side: s };
    });
    this.hairMesh = part(null, vc, this.skull);
    this.hairSprings = [];
    this.hatMesh = part(null, vc, this.skull);
    this.hatSpring = null;
    this.headExtra = part(null, vc, this.skull);

    this.arms = [1, -1].map((s) => {   // [left, right]
      const shoulder = node(this.spine, [s * TORSO.shoulderX, TORSO.shoulderY, -0.005]);
      const upper = part(null, vc, shoulder);
      const elbow = node(shoulder, [0, -ARM_U, 0]);
      const fore = part(null, vc, elbow);
      const hand = node(elbow, [0, -ARM_F, 0]);
      const handMesh = part(handGeo(s), vc, hand, [0, -CHIBI.HAND, 0]);
      return { side: s, shoulder, upper, elbow, fore, hand, handMesh };
    });
    this.legs = [1, -1].map((s) => {
      const thigh = node(this.hips, [s * 0.064, 0, 0]);
      const thighMesh = part(null, vc, thigh);
      const knee = node(thigh, [0, -LEG_L, 0]);
      const shin = part(null, vc, knee);
      const ankle = node(knee, [0, -LEG_L, 0]);
      const shoe = part(null, vc, ankle);
      return { side: s, thigh, thighMesh, knee, shin, ankle, shoe };
    });

    /* ---- animation state ---- */
    this.P = newPose(); rest(this.P);
    this.base = newPose(); rest(this.base);
    this.snap = newPose(); rest(this.snap);
    this.state = 'idle'; this.stateT = 0; this.fade = 1; this.fadeTime = 0.22;
    this.speed = 0; this.phase = 0;
    this.blinkT = -1; this.nextBlink = 1 + Math.random() * 3;
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };
    this.target = null; this.look3 = { yaw: 0, pitch: 0, w: 0 };
    this.time = 0;
    this.headSpring = new Spring(170, 13);
    this.skirtSpring = new Spring(120, 10);
    this.prevHead = null; this.prevVel = new THREE.Vector3(); this.acc = new THREE.Vector3();
    this.prevNeck = null; this.prevNeckVel = new THREE.Vector3(); this.neckAcc = new THREE.Vector3();
    this.prevHipRy = 0;
    this.topY = 1.15;

    this.setLook(look);
    this.update(0, 0);
    this.api = this.makeApi();
  }

  /* =========================================================== looks */

  setLook(input) {
    const look = cleanLook(input, input?.id || '');
    const k = (...f) => f.map((x) => look[x]).join('|');
    const want = {
      skin: k('skin'),
      eyes: k('eyes'),
      cheeks: k('extra', 'skin'),
      hair: k('hair', 'hairColor', 'hat', 'hatColor'),
      hat: k('hat', 'hatColor', 'hair'),
      headExtra: k('extra'),
      bodyExtra: k('extra', 'hatColor'),
      top: k('top', 'topColor', 'skin'),
      skirt: k('top', 'topColor', 'bottom', 'bottomColor'),
      legs: k('top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'skin'),
      shoes: k('shoes', 'shoeColor', 'skin'),
    };
    const changed = (name) => { if (this.keys[name] === want[name]) return false; this.keys[name] = want[name]; return true; };
    this.look = look;
    const swap = (mesh, geo) => { if (mesh.geometry && !isShared(mesh.geometry)) mesh.geometry.dispose(); mesh.geometry = geo || EMPTY_GEO; mesh.visible = !!geo; };

    if (changed('skin')) {
      this.skinMat = cmat(look.skin, { roughness: 0.62, emissive: look.skin, emissiveIntensity: 0.11, rim: 0.26 });
      for (const a of this.arms) { a.handMesh.material = this.skinMat; }
      this.skullMesh.material = this.skinMat;
    }
    if (changed('eyes')) {
      if (this.eyes) { this.eyes.material.dispose(); this.eyes.texture.dispose(); }
      this.eyes = atlasMaterial(chibiEyeAtlas(look.eyes), 4, 4, { roughness: 0.32 });
      this.eyesMesh.material = this.eyes.material;
    }
    if (changed('cheeks')) {
      this.cheeks.material.map = chibiCheeks(look.extra, look.skin);
      this.cheeks.material.needsUpdate = true;
    }
    if (changed('hair')) {
      const style = HAIR_STYLES[look.hair] || HAIR_STYLES.bob;
      this.skullMesh.geometry = skullGeo(!style.covers, this.quality);
      const hair = buildHair(look);
      swap(this.hairMesh, hair.cap);
      this.hairMesh.material = vcol({ roughness: 0.5, rim: 0.3 });
      for (const s of this.hairSprings) { s.mesh.geometry.dispose(); s.pivot.removeFromParent(); }
      this.hairSprings = hair.springs.map((d) => {
        const pivot = node(this.skull, d.pivot);
        pivot.rotation.set(...d.rot);
        const mesh = part(d.geo, this.hairMesh.material, pivot);
        const stiff = d.kind === 'ahoge' ? [220, 9, 0.0, 0.004] : d.kind === 'drape' ? [70, 7, 0.55, 0.006] : [55, 5, 0.8, 0.008];
        return { pivot, mesh, rest: d.rot, kind: d.kind, side: d.side || 0, sx: new Spring(stiff[0], stiff[1]), sz: new Spring(stiff[0], stiff[1]), gw: stiff[2], gain: stiff[3] };
      });
      const browCol = cmat(shade(look.hairColor, -0.16), { roughness: 0.6, rim: 0 });
      for (const b of this.brows) b.mesh.material = browCol;
    }
    if (changed('hat')) {
      const hat = buildHat(look);
      swap(this.hatMesh, hat?.geo);
      this.hatOn = !!hat?.geo;
      this.hatMesh.material = hat?.gold ? vcol({ roughness: 0.3, metalness: 0.45, rim: 0.3 }) : this.vc;
      if (this.hatSpring) { this.hatSpring.mesh.geometry.dispose(); this.hatSpring.pivot.removeFromParent(); this.hatSpring = null; }
      if (hat?.spring) {
        const pivot = node(this.skull, hat.spring.pivot);
        pivot.rotation.x = -0.3;
        const mesh = part(hat.spring.geo, this.vc, pivot);
        this.hatSpring = { pivot, mesh, rest: [-0.3, 0, 0], sx: new Spring(150, 7), sz: new Spring(150, 7), gw: 0, gain: 0.006, kind: 'pom' };
      }
    }
    if (changed('headExtra')) swap(this.headExtra, buildHeadExtra(look));
    if (changed('bodyExtra')) swap(this.bodyExtra, buildBodyExtra(look, TORSO));
    if (changed('top')) {
      const kind = TOP_KIND[look.top] || TOP_KIND.tee;
      const map = look.top === 'flannel' ? clothTexture('plaid') : ['sweater', 'cardigan'].includes(look.top) ? clothTexture('knit') : null;
      this.torso.material = cmat(kind.shirt || look.topColor, { roughness: 0.84, map });
      swap(this.topDetail, buildTopDetail(look, look.skin));
      for (const a of this.arms) {
        swap(a.upper, buildArm(look, look.skin, 'upper', a.side));
        swap(a.fore, buildArm(look, look.skin, 'fore', a.side));
      }
    }
    if (changed('skirt')) {
      swap(this.skirt, buildSkirt(look));
      this.pelvis.material = cmat(pelvisColor(look), { roughness: 0.84 });
    }
    if (changed('legs')) for (const l of this.legs) { swap(l.thighMesh, buildLeg(look, look.skin, 'thigh')); swap(l.shin, buildLeg(look, look.skin, 'shin')); }
    if (changed('shoes')) for (const l of this.legs) swap(l.shoe, buildShoe(look, look.skin, l.side));
    this.crownTop = look.hat !== 'none' ? Math.max(HAT_TOP[look.hat] || 1.2, crownOf(look) + 0.1) : (HAIR_TOP[look.hair] || crownOf(look));
  }

  /* ======================================================= commands */

  play(name) {
    if (!STATES[name]) name = 'idle';
    if (name === this.state) return;
    copyPose(this.snap, this.base);
    this.state = name; this.stateT = 0; this.fade = 0;
  }
  setSpeed(v) { this.speed = Number.isFinite(v) ? Math.max(0, v) : 0; }
  lookAt(v) {
    if (v && Number.isFinite(v.x)) { this.target ??= new THREE.Vector3(); this.target.copy(v); }
    else this.target = null;
  }
  headTop() { return this.topY; }

  /** World position of a hand (side 'l' | 'r'). */
  handWorld(side = 'r', out = new THREE.Vector3()) {
    const a = this.arms[side === 'l' ? 0 : 1];
    this.root.updateMatrixWorld(true);
    return a.handMesh.getWorldPosition(out);
  }

  /* ========================================================= update */

  update(dt = 0, t = 0) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this.time += dt;
    const P = this.P, ctx = this.ctx ??= { phase: 0, speed: 0, HIP };

    // Gait phase: steps per second grow with speed; chibi legs are short.
    if (this.state === 'walk' || this.state === 'run') {
      const steps = this.state === 'run' ? 3.4 + this.speed * 0.55 : 2.3 + this.speed * 0.95;
      this.phase += dt * Math.PI * steps;
    }
    ctx.phase = this.phase; ctx.speed = this.speed;

    /* ---- base state with crossfade ---- */
    this.stateT += dt;
    rest(P);
    STATES[this.state](P, this.stateT, ctx);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / this.fadeTime);
      blendPose(P, this.snap, P, sm(this.fade));
    }
    copyPose(this.base, P);
    /* ---- look-at and eye wander ---- */
    this.applyLook(P, dt);

    /* ---- face ---- */
    this.applyFace(P, dt);

    /* ---- rig ---- */
    this.applyPose(P, dt);
    this.secondary(dt);
  }

  applyLook(P, dt) {
    const L3 = this.look3;
    let yaw = 0, pitch = 0, want = 0;
    if (this.target) {
      _v.copy(this.target);
      this.root.updateMatrix();
      if (this.root.parent) this.root.updateMatrixWorld(true);
      this.root.worldToLocal(_v);
      const dy = _v.y - (this.topY - 0.28), d = Math.hypot(_v.x, _v.z);
      yaw = Math.atan2(_v.x, _v.z); pitch = Math.atan2(dy, Math.max(0.1, d));
      want = Math.abs(yaw) > 2.0 || d < 0.05 ? 0 : 1;
      yaw = clamp(yaw, -1.15, 1.15); pitch = clamp(pitch, -0.55, 0.5);
    }
    const k = ease(0.1, dt);
    L3.yaw += (yaw - L3.yaw) * k; L3.pitch += (pitch - L3.pitch) * k; L3.w += (want - L3.w) * ease(0.08, dt);
    const w = L3.w * P.lookW;
    P.headRy += L3.yaw * 0.6 * w; P.spineRy += L3.yaw * 0.2 * w;
    P.headRx -= L3.pitch * 0.6 * w;
    // Eyes lead the head, and drift about on their own.
    const g = this.gaze;
    g.next -= dt;
    if (g.next <= 0) { g.next = 1 + Math.random() * 2.5; g.tx = (Math.random() - 0.5) * 0.12; g.ty = (Math.random() - 0.5) * 0.06; }
    const gk = ease(0.25, dt);
    g.x += (g.tx * (1 - w) - g.x) * gk; g.y += (g.ty * (1 - w) - g.y) * gk;
    P.gazeX += g.x + clamp(L3.yaw * 0.3, -0.13, 0.13) * w;
    P.gazeY += g.y + clamp(L3.pitch * 0.25, -0.08, 0.08) * w;
  }

  applyFace(P, dt) {
    let eyes = P.eyes, mouth = P.mouth;
    // Blink.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = 1.8 + Math.random() * 3.6; this.double = Math.random() < 0.2; }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const bt = this.blinkT, end = this.double ? 0.36 : 0.16;
      const open = [EYE.OPEN, EYE.WIDE, EYE.STAR, EYE.DOWN, EYE.SLEEPY, EYE.SAD, EYE.HEART].includes(eyes);
      if (open) {
        const ph = bt % 0.2;
        if (ph < 0.045 || (ph > 0.11 && ph < 0.16)) eyes = eyes === EYE.SLEEPY ? EYE.CLOSED : EYE.HALF;
        else if (ph < 0.16) eyes = EYE.CLOSED;
      }
      if (bt > end) this.blinkT = -1;
    }
    const brow = { [EYE.HAPPY]: 0.35, [EYE.SQUINT]: 0.2, [EYE.STAR]: 0.5, [EYE.WIDE]: 0.9, [EYE.HEART]: 0.45, [EYE.CLOSED]: -0.1, [EYE.SLEEPY]: -0.3, [EYE.DOWN]: -0.15 }[eyes] || 0;
    P.browUp += brow;
    if (eyes === EYE.SAD) P.browTilt += 0.7;
    this.eyes.set(eyes);
    this.mouth.set(mouth);
    this.cheeks.material.opacity = clamp(0.72 + 0.45 * P.blush, 0, 1);
    this.eyesMesh.rotation.set(-clamp(P.gazeY, -0.12, 0.12), clamp(P.gazeX, -0.16, 0.16), 0);
    for (const b of this.brows) {
      const th = 1.3 - 0.075 * P.browUp, ph = b.side * 0.35 + clamp(P.gazeX, -0.16, 0.16) * 0.25;
      b.pivot.rotation.set(th - Math.PI / 2, ph, -b.side * (0.18 * P.browTilt), 'YXZ');
    }
  }

  applyPose(P) {
    const body = this.body, hips = this.hips;
    body.position.set(P.bodyX, P.bodyY, P.bodyZ);
    body.rotation.set(P.bodyRx, P.bodyRy, P.bodyRz);
    const sq = 1 + clamp(P.squash, -0.3, 0.3), w = 1 / Math.sqrt(sq);
    body.scale.set(w, sq, w);
    hips.position.set(P.hipX, HIP + P.hipY, P.hipZ);
    hips.rotation.set(P.hipRx, P.hipRy, P.hipRz);
    this.spine.rotation.set(P.spineRx, P.spineRy, P.spineRz);
    const b = P.breathe * 0.012;
    this.torso.scale.set(1 + b, 1 + b * 0.7, TORSO.depth * (1 + b * 1.3));
    this.neck.position.y = NECK_Y + b * 0.25;
    this.head.rotation.set(P.headRx + this.headSpring.x, P.headRy, P.headRz);

    const [la, ra] = this.arms;
    // Twist about the arm first, then raise sideways, then swing forwards.
    la.shoulder.rotation.set(-P.lFwd, -P.lTwist, P.lOut, 'XZY');
    ra.shoulder.rotation.set(-P.rFwd, P.rTwist, -P.rOut, 'XZY');
    la.elbow.rotation.set(-P.lElbow, 0, 0);
    ra.elbow.rotation.set(-P.rElbow, 0, 0);
    la.hand.rotation.set(-P.lWrist, 0, P.lWristZ);
    ra.hand.rotation.set(-P.rWrist, 0, P.rWristZ);
    const st = clamp(P.armStretch || 1, 0.8, 1.5), lst = clamp(P.lArmStretch || 1, 0.8, 1.5);
    ra.upper.scale.y = st; ra.fore.scale.y = st;
    ra.elbow.position.y = -ARM_U * st; ra.hand.position.y = -ARM_F * st;
    la.upper.scale.y = lst; la.fore.scale.y = lst;
    la.elbow.position.y = -ARM_U * lst; la.hand.position.y = -ARM_F * lst;
    this.hatMesh.visible = !!this.hatOn;
    if (this.hatSpring) this.hatSpring.pivot.visible = true;

    const [ll, rl] = this.legs;
    ll.thigh.rotation.set(-P.lLeg, 0, P.lLegOut);
    rl.thigh.rotation.set(-P.rLeg, 0, -P.rLegOut);
    ll.knee.rotation.x = P.lKnee; rl.knee.rotation.x = P.rKnee;
    ll.ankle.rotation.x = P.lFoot - P.footFlat * (P.hipRx - P.lLeg + P.lKnee);
    rl.ankle.rotation.x = P.rFoot - P.footFlat * (P.hipRx - P.rLeg + P.rKnee);

    // Keep the lowest foot (or knee) on the ground.
    if (P.ground > 0.001) {
      let lo = Infinity;
      for (const l of this.legs) {
        lo = Math.min(lo,
          toSpace(l.ankle, this.root, _v.set(0, -ANKLE, -0.04)).y,
          toSpace(l.ankle, this.root, _v.set(0, -ANKLE, 0.08)).y,
          toSpace(l.knee, this.root, _v.set(0, 0, 0)).y - 0.045,
          toSpace(l.ankle, this.root, _v.set(0, 0, 0)).y - 0.045);
      }
      hips.position.y -= (lo / body.scale.y) * P.ground;
    }
    hips.position.y += P.lift;

    // Shadow follows the body loosely and fades as it hops.
    toSpace(this.hips, this.root, _v.set(0, 0, 0));
    this.shadow.position.set(_v.x * 0.8, 0.015, _v.z * 0.8);
    const lifted = clamp((_v.y - HIP) / 0.4, -0.2, 1);
    this.shadow.scale.set(0.54 * (1 - 0.4 * lifted), 0.54 * (1 - 0.4 * lifted), 1);
    this.shadow.material.opacity = 0.34 * (1 - 0.5 * clamp(lifted, 0, 1));

    // Where the top of the head is right now (for labels).
    toSpace(this.skull, this.root, _v.set(0, this.crownTop, 0));
    this.topY += (_v.y + 0.02 - this.topY) * (this.time < 0.05 ? 1 : 0.2);
  }

  /** Follow-through: hair, hats, the head itself and skirts lag and settle. */
  secondary(dt) {
    if (dt <= 0) return;
    this.root.updateMatrix();
    // Head motion in the world.
    toSpace(this.skull, this.root, _v.set(0, 0, 0)).applyMatrix4(this.root.matrix);
    if (!this.prevHead) { this.prevHead = _v.clone(); }
    const vel = _v2.copy(_v).sub(this.prevHead).divideScalar(dt);
    this.prevHead.copy(_v);
    const acc = vel.clone().sub(this.prevVel).divideScalar(dt);
    this.prevVel.copy(vel);
    this.acc.lerp(acc.clampLength(0, 60), 0.5);
    // Into head space.
    quatTo(this.skull, this.root, _q).premultiply(this.root.quaternion);
    _q2.copy(_q).invert();
    const aLocal = _v.copy(this.acc).applyQuaternion(_q2);
    const g = _v2.copy(DOWN).applyQuaternion(_q2);
    const drive = (s) => {
      const tx = s.gw * Math.atan2(-g.z, -g.y), tz = s.gw * Math.atan2(g.x, -g.y);
      s.sx.step(tx, dt, aLocal.z * s.gain * s.sx.k * 0.1 + aLocal.y * s.gain * s.sx.k * 0.04);
      s.sz.step(tz, dt, -aLocal.x * s.gain * s.sz.k * 0.1);
      s.sx.x = clamp(s.sx.x, -0.9, 0.9); s.sz.x = clamp(s.sz.x, -0.9, 0.9);
      s.pivot.rotation.set(s.rest[0] + s.sx.x, s.rest[1], s.rest[2] + s.sz.x);
    };
    for (const s of this.hairSprings) drive(s);
    if (this.hatSpring) drive(this.hatSpring);
    // The big head nods a little after landings and starts.
    const bodyAcc = _v.copy(this.acc).applyQuaternion(_q3.copy(this.root.quaternion).invert());
    this.headSpring.step(0, dt, clamp(bodyAcc.y * 0.02 - bodyAcc.z * 0.012, -3, 3) * 10);
    this.headSpring.x = clamp(this.headSpring.x, -0.2, 0.2);
    // Skirts flare when spinning or running.
    const hipVel = (this.hips.rotation.y - this.prevHipRy) / dt;
    this.prevHipRy = this.hips.rotation.y;
    this.skirtSpring.step(clamp(Math.abs(hipVel) * 0.05 + (this.state === 'run' ? 0.08 : 0), 0, 0.35), dt);
    const f = 1 + Math.max(0, this.skirtSpring.x);
    this.skirt.scale.set(f, 1 - (f - 1) * 0.5, f);
  }

  dispose() {
    this.root.removeFromParent();
    disposeOwned(this.root);
    for (const m of this.own) m.dispose();
    if (this.eyes) { this.eyes.material.dispose(); this.eyes.texture.dispose(); }
    this.shadow.material.dispose();
    this.disposed = true;
  }

  makeApi() {
    const c = this;
    return {
      root: c.root,
      setLook: (l) => c.setLook(l),
      play: (a, o) => c.play(a, o),
      setSpeed: (v) => c.setSpeed(v),
      lookAt: (v) => c.lookAt(v),
      update: (dt, t) => c.update(dt, t),
      headTop: () => c.headTop(),
      handWorld: (s, o) => c.handWorld(s, o),
      dispose: () => c.dispose(),
      get state() { return c.state; },
      get look() { return c.look; },
      /** Skull attachment for hats and head accessories. */
      get skull() { return c.skull; },
      _rig: c,
    };
  }
}


/**
 * Make a little person.
 * @param {object} look  a LOOK (see src/shared-look.mjs); cleaned on the way in
 * @param {{quality?: 'low'|'mid'|'high'}} opts
 */
export function createChibi(look, { quality = 'mid' } = {}) {
  return new Chibi(look, quality).api;
}
