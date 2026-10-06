// Necessary locomotion and pose blending from the owner's supplied chibi rig.
// Pelt Party combat poses are added by ../characters.js.
import { clamp, lerp, S, C } from './common.mjs';
import { EYE, MOUTH } from './face.mjs';

export const KEYS = [
  'bodyX', 'bodyY', 'bodyZ', 'bodyRx', 'bodyRy', 'bodyRz',
  'hipX', 'hipY', 'hipZ', 'hipRx', 'hipRy', 'hipRz', 'lift',
  'spineRx', 'spineRy', 'spineRz', 'breathe',
  'headRx', 'headRy', 'headRz',
  'lFwd', 'lOut', 'lTwist', 'lElbow', 'lWrist', 'lWristZ',
  'rFwd', 'rOut', 'rTwist', 'rElbow', 'rWrist', 'rWristZ',
  'lLeg', 'lLegOut', 'lKnee', 'lFoot',
  'rLeg', 'rLegOut', 'rKnee', 'rFoot',
  'squash', 'ground', 'footFlat', 'handLock', 'propTilt', 'armStretch', 'lArmStretch',
  'lPeace', 'rPeace', 'heartHold',
  'browUp', 'browTilt', 'blush', 'gazeX', 'gazeY', 'lookW',
];

export function newPose() {
  const p = {};
  for (const k of KEYS) p[k] = 0;
  p.eyes = EYE.OPEN; p.mouth = MOUTH.SMILE;
  return p;
}
export function rest(p) {
  for (const k of KEYS) p[k] = 0;
  p.lOut = p.rOut = 0.32; p.lElbow = p.rElbow = 0.22; p.lFwd = p.rFwd = 0.05; p.lTwist = p.rTwist = 0.25;
  p.lLegOut = p.rLegOut = 0.02;
  p.ground = 1; p.footFlat = 1; p.lookW = 1; p.armStretch = 1; p.lArmStretch = 1;
  p.eyes = EYE.OPEN; p.mouth = MOUTH.SMILE;
  return p;
}
export function copyPose(dst, src) { for (const k of KEYS) dst[k] = src[k]; dst.eyes = src.eyes; dst.mouth = src.mouth; return dst; }
/** out = a + (b - a) * w, channel by channel. */
export function blendPose(out, a, b, w) {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * w;
  out.eyes = w > 0.5 ? b.eyes : a.eyes;
  out.mouth = w > 0.5 ? b.mouth : a.mouth;
  return out;
}

export const STATES = {
  idle(p, t) {
    const b = S(t * 2.1);
    p.breathe = b;
    p.hipX = 0.007 * S(t * 0.55); p.hipRz = -0.02 * S(t * 0.55);
    p.spineRz = 0.02 * S(t * 0.55 + 0.5); p.spineRx = 0.02;
    p.headRz = 0.04 * S(t * 0.55 + 1.1); p.headRx = -0.02 + 0.012 * S(t * 2.1 + 0.6);
    p.lOut = p.rOut = 0.32 + 0.025 * b;
    p.lElbow = 0.25 + 0.04 * S(t * 1.3); p.rElbow = 0.25 + 0.04 * S(t * 1.3 + 1);
  },
  walk(p, t, c) {
    const a = clamp(c.speed / 1.8, 0, 1.15), ph = c.phase, s = S(ph), co = C(ph), c2 = C(2 * ph);
    const m = clamp(c.speed / 0.35, 0, 1);
    if (m < 1) STATES.idle(p, t);
    const k = (x, y) => lerp(x, y, m);
    p.lLeg = k(p.lLeg, 0.62 * a * s); p.rLeg = k(p.rLeg, -0.62 * a * s);
    p.lKnee = k(p.lKnee, 0.1 + 1.05 * a * Math.max(0, co) ** 1.3 + 0.12 * a * Math.max(0, -s));
    p.rKnee = k(p.rKnee, 0.1 + 1.05 * a * Math.max(0, -co) ** 1.3 + 0.12 * a * Math.max(0, s));
    p.lFoot = k(0, -0.28 * a * s + 0.4 * a * Math.max(0, co) * Math.max(0, -s));
    p.rFoot = k(0, 0.28 * a * s + 0.4 * a * Math.max(0, -co) * Math.max(0, s));
    p.lFwd = k(p.lFwd, 0.05 - 0.72 * a * s); p.rFwd = k(p.rFwd, 0.05 + 0.72 * a * s);
    p.lElbow = k(p.lElbow, 0.3 + 0.55 * a * Math.max(0, -s)); p.rElbow = k(p.rElbow, 0.3 + 0.55 * a * Math.max(0, s));
    p.lOut = p.rOut = k(p.lOut, 0.34 + 0.05 * a);
    p.lTwist = p.rTwist = k(p.lTwist, 0.35);
    p.spineRy = k(0, 0.14 * a * s); p.hipRy = k(0, -0.11 * a * s);
    p.headRy = k(0, -(p.spineRy + p.hipRy) * 0.85);
    p.hipX = k(p.hipX, -0.014 * a * co); p.hipRz = k(p.hipRz, 0.05 * a * co);
    p.spineRz = k(p.spineRz, -0.035 * a * co); p.headRz = k(p.headRz, 0.03 * a * co);
    p.spineRx = k(p.spineRx, 0.07 + 0.05 * a);
    p.headRx = k(p.headRx, -0.05 + 0.04 * c2);
    p.lift = k(0, 0.04 * a * Math.max(0, c2) ** 1.5);
    p.squash = k(0, -0.045 * a * Math.max(0, -c2) ** 2 + 0.025 * a * Math.max(0, c2));
    p.breathe = k(p.breathe, 0);
  },
  run(p, t, c) {
    const a = clamp(c.speed / 4, 0.6, 1.2), ph = c.phase, s = S(ph), co = C(ph), c2 = C(2 * ph);
    p.lLeg = 1.0 * a * s + 0.15; p.rLeg = -1.0 * a * s + 0.15;
    p.lKnee = 0.45 + 1.6 * a * Math.max(0, co) + 0.25 * Math.max(0, -s);
    p.rKnee = 0.45 + 1.6 * a * Math.max(0, -co) + 0.25 * Math.max(0, s);
    p.lFoot = -0.3 * a * s + 0.5 * Math.max(0, -s); p.rFoot = 0.3 * a * s + 0.5 * Math.max(0, s);
    p.lFwd = 0.25 - 1.05 * a * s; p.rFwd = 0.25 + 1.05 * a * s;
    p.lElbow = p.rElbow = 1.5; p.lOut = p.rOut = 0.42; p.lTwist = p.rTwist = 0.5;
    p.spineRx = 0.32; p.spineRy = 0.22 * a * s; p.hipRy = -0.15 * a * s;
    p.headRy = -(p.spineRy + p.hipRy) * 0.8; p.headRx = -0.22 + 0.06 * c2;
    p.hipX = -0.014 * co; p.hipRz = 0.05 * co;
    p.lift = 0.1 * a * Math.max(0, c2) ** 1.2;
    p.squash = -0.08 * a * Math.max(0, -c2) ** 2 + 0.06 * a * Math.max(0, c2);
    p.mouth = MOUTH.OPEN; p.browUp = 0.3; p.eyes = (t % 3) < 1.2 ? EYE.HAPPY : EYE.OPEN;
  },
};
