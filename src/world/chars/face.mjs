// Painted faces. Every expression is a frame in a small canvas atlas that is
// shared by everyone with the same eye style; each character clones the
// texture (same GPU upload) and just moves its UV window to change frame, so
// blinking and talking never redraw or re-upload anything.

import { THREE, canvasTexture } from '../kit.mjs';

/* -------------------------------------------------------------- frames */

/** Chibi eye frames: 4 x 4 grid of 256 x 128. */
export const EYE = { OPEN: 0, HALF: 1, CLOSED: 2, HAPPY: 3, HEART: 4, SLEEPY: 5, WINK: 6, WIDE: 7, SAD: 8, DOWN: 9, STAR: 10, SQUINT: 11 };
/** Chibi mouth frames: 4 x 3 grid of 128 x 128 (the last row is mostly room to grow). */
export const MOUTH = { SMILE: 0, OPEN: 1, O: 2, FLAT: 3, GRIN: 4, KISS: 5, CAT: 6, WOBBLE: 7, TONGUE: 8 };
export const MOUTH_GRID = [4, 3];
/** Ladybug eye frames: 4 x 2 grid of 256 x 128. */
export const BUG_EYE = { OPEN: 0, HALF: 1, CLOSED: 2, HAPPY: 3, HEART: 4, WIDE: 5, SAD: 6, STAR: 7 };
/** Ladybug mouth frames (blush painted in every one): 4 x 2 grid of 256 x 128. */
export const BUG_MOUTH = { SMILE: 0, O: 1, MUNCH: 2, CHEW: 3, SAD: 4, GRIN: 5, YAWN: 6, FLAT: 7 };

/* ---------------------------------------------------------- painting */

function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + 0.9 * s);
  g.bezierCurveTo(x - 0.25 * s, y + 0.62 * s, x - 1.0 * s, y + 0.25 * s, x - 0.98 * s, y - 0.22 * s);
  g.bezierCurveTo(x - 0.96 * s, y - 0.72 * s, x - 0.36 * s, y - 0.9 * s, x, y - 0.45 * s);
  g.bezierCurveTo(x + 0.36 * s, y - 0.9 * s, x + 0.96 * s, y - 0.72 * s, x + 0.98 * s, y - 0.22 * s);
  g.bezierCurveTo(x + 1.0 * s, y + 0.25 * s, x + 0.25 * s, y + 0.62 * s, x, y + 0.9 * s);
  g.closePath();
}

function sparklePath(g, x, y, r, inner = 0.28) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
}

const INK = '#2a1b17';

/** One chibi eye. `side` is -1 for the viewer's left eye, +1 for the right. */
function chibiEye(g, cx, cy, kind, style, side) {
  const lashes = style === 'lashes';
  const sparkle = style === 'sparkle' || kind === 'star';
  const big = kind === 'wide' ? 1.1 : sparkle ? 1.06 : 1;
  const rx = 21 * big, ry = 29 * big;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const line = (pts, w = 6, color = INK) => {
    g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
    g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); g.stroke();
  };
  const lashFlicks = (y, open = 1) => {
    if (!lashes) return;
    g.strokeStyle = INK; g.lineWidth = 4.5;
    const ox = cx + side * rx * 0.78;
    g.beginPath(); g.moveTo(ox, y + 2); g.quadraticCurveTo(ox + side * 8, y - 4 * open, ox + side * 13, y - 9 * open); g.stroke();
    g.beginPath(); g.moveTo(ox - side * 6, y - 3 * open); g.quadraticCurveTo(ox, y - 9 * open, ox + side * 3, y - 14 * open); g.stroke();
  };

  if (kind === 'closed') {
    line([cx - rx * 0.9, cy + 4, cx, cy + 13, cx + rx * 0.9, cy + 4], 6.5);
    lashFlicks(cy + 6, -0.6);
    return;
  }
  if (kind === 'happy') {
    line([cx - rx * 0.88, cy + 9, cx, cy - 16, cx + rx * 0.88, cy + 9], 7);
    lashFlicks(cy + 2, 0.7);
    return;
  }
  if (kind === 'squint') { // > <
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath();
    g.moveTo(cx - side * 15, cy - 14); g.lineTo(cx + side * 12, cy); g.lineTo(cx - side * 15, cy + 14); g.stroke();
    return;
  }
  if (kind === 'heart') {
    const grad = g.createLinearGradient(cx, cy - 24, cx, cy + 24);
    grad.addColorStop(0, '#ff8fb3'); grad.addColorStop(1, '#e2456f');
    heartPath(g, cx, cy + 2, 25); g.fillStyle = grad; g.fill();
    g.strokeStyle = '#b32d57'; g.lineWidth = 3; g.stroke();
    ellipse(g, cx - 9, cy - 8, 6, 4.5, -0.5); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
    return;
  }

  // Open-ish eyes: draw the iris, then cover the top with a lid if needed.
  let lid = 0, tilt = 0, lookY = 0;
  if (kind === 'half') lid = 0.5;
  if (kind === 'sleepy') { lid = 0.5; tilt = -0.12 * side; }
  if (kind === 'down') { lid = 0.38; lookY = 5; }
  if (kind === 'sad') { lid = 0.28; tilt = 0.28 * side; }

  g.save();
  if (lid > 0) {
    // Everything above the lid line is hidden.
    const top = cy - ry + lid * ry * 2;
    g.beginPath();
    g.moveTo(cx - rx - 8, top - tilt * rx);
    g.lineTo(cx + rx + 8, top + tilt * rx);
    g.lineTo(cx + rx + 8, cy + ry + 10);
    g.lineTo(cx - rx - 8, cy + ry + 10);
    g.closePath();
    g.clip();
  }
  const ey = cy + lookY;
  const grad = g.createLinearGradient(cx, ey - ry, cx, ey + ry);
  if (sparkle) {
    grad.addColorStop(0, '#1f1530'); grad.addColorStop(0.5, '#3d2a63'); grad.addColorStop(0.82, '#8e6bd1'); grad.addColorStop(1, '#d7a3e8');
  } else {
    grad.addColorStop(0, '#231612'); grad.addColorStop(0.55, '#3a2520'); grad.addColorStop(0.86, '#7b4c3b'); grad.addColorStop(1, '#a86a4e');
  }
  ellipse(g, cx, ey, rx, ry); g.fillStyle = grad; g.fill();
  // A darker upper rim gives the eye a lid line even when fully open.
  g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  // Highlights.
  g.fillStyle = '#ffffff';
  if (sparkle) {
    sparklePath(g, cx + side * -2 + 6, ey - 11, 13, 0.3); g.fill();
    ellipse(g, cx - 7, ey + 11, 4.5, 4.5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; ellipse(g, cx + 9, ey + 6, 2.6, 2.6); g.fill();
  } else {
    ellipse(g, cx + 6, ey - 11, 8.5, 9.5, -0.3); g.fill();
    ellipse(g, cx - 7, ey + 11, 4.2, 4.2); g.fill();
    if (kind === 'wide') { g.fillStyle = 'rgba(255,255,255,.85)'; ellipse(g, cx + 10, ey + 3, 3, 3); g.fill(); }
  }
  if (kind === 'sad') { // a wobbly tear shine along the bottom
    g.strokeStyle = 'rgba(210,240,255,.9)'; g.lineWidth = 3.5; g.beginPath();
    g.ellipse(cx, ey + 4, rx * 0.72, ry * 0.72, 0, 0.35, Math.PI - 0.35); g.stroke();
  }
  g.restore();
  if (lid > 0) {
    const top = cy - ry + lid * ry * 2;
    g.strokeStyle = INK; g.lineWidth = 6.5; g.beginPath();
    g.moveTo(cx - rx * 1.02, top - tilt * rx + 2);
    g.quadraticCurveTo(cx, top - 3, cx + rx * 1.02, top + tilt * rx + 2);
    g.stroke();
    lashFlicks(top + (side > 0 ? tilt : -tilt) * rx * 0.8, 0.8);
  } else {
    lashFlicks(ey - ry * 0.62, 1);
  }
}

function eyeKinds(frame, style) {
  const base = {
    [EYE.OPEN]: ['open', 'open'], [EYE.HALF]: ['half', 'half'], [EYE.CLOSED]: ['closed', 'closed'],
    [EYE.HAPPY]: ['happy', 'happy'], [EYE.HEART]: ['heart', 'heart'], [EYE.SLEEPY]: ['sleepy', 'sleepy'],
    [EYE.WINK]: ['open', 'happy'], [EYE.WIDE]: ['wide', 'wide'], [EYE.SAD]: ['sad', 'sad'],
    [EYE.DOWN]: ['down', 'down'], [EYE.STAR]: ['star', 'star'], [EYE.SQUINT]: ['squint', 'squint'],
  }[frame] || ['open', 'open'];
  if (style === 'happy' && [EYE.OPEN, EYE.HALF, EYE.DOWN].includes(frame)) return ['happy', 'happy'];
  if (style === 'sleepy') {
    if (frame === EYE.OPEN) return ['sleepy', 'sleepy'];
    if (frame === EYE.HALF) return ['closed', 'closed'];
    if (frame === EYE.DOWN) return ['sleepy', 'sleepy'];
  }
  if (style === 'wink') {
    if (frame === EYE.OPEN || frame === EYE.DOWN || frame === EYE.STAR) return [frame === EYE.STAR ? 'star' : 'open', 'happy'];
    if (frame === EYE.HALF) return ['half', 'happy'];
  }
  return base;
}

const eyeAtlases = new Map();
/** The shared eye atlas for one LOOK.eyes style. */
export function chibiEyeAtlas(style = 'round') {
  if (!eyeAtlases.has(style)) {
    eyeAtlases.set(style, canvasTexture(1024, 512, (g) => {
      g.clearRect(0, 0, 1024, 512);
      for (let f = 0; f < 12; f++) {
        const ox = (f % 4) * 256, oy = Math.floor(f / 4) * 128;
        const [l, r] = eyeKinds(f, style);
        chibiEye(g, ox + 72, oy + 62, l, style, -1);
        chibiEye(g, ox + 184, oy + 62, r, style, 1);
      }
    }));
  }
  return eyeAtlases.get(style);
}

let mouthAtlas = null;
export function chibiMouthAtlas() {
  mouthAtlas ??= canvasTexture(512, 384, (g) => {
    g.clearRect(0, 0, 512, 384);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const dark = '#6e2b2b', inside = '#8f3438', tongue = '#f08a8f';
    for (let f = 0; f < 9; f++) {
      const x = (f % 4) * 128 + 64, y = Math.floor(f / 4) * 128 + 60;
      g.strokeStyle = dark; g.lineWidth = 6.5;
      if (f === MOUTH.SMILE) {
        g.beginPath(); g.moveTo(x - 20, y - 4); g.quadraticCurveTo(x, y + 18, x + 20, y - 4); g.stroke();
      } else if (f === MOUTH.OPEN || f === MOUTH.GRIN) {
        const w = f === MOUTH.GRIN ? 30 : 20, h = f === MOUTH.GRIN ? 34 : 24;
        g.beginPath(); g.moveTo(x - w, y - 8); g.quadraticCurveTo(x, y - 12, x + w, y - 8);
        g.bezierCurveTo(x + w, y + h * 0.7, x - w, y + h * 0.7, x - w, y - 8); g.closePath();
        g.fillStyle = inside; g.fill();
        g.save(); g.clip(); ellipse(g, x, y + h * 0.55, w * 0.7, h * 0.35); g.fillStyle = tongue; g.fill(); g.restore();
        g.lineWidth = 4.5; g.stroke();
      } else if (f === MOUTH.O) {
        ellipse(g, x, y + 2, 10, 13); g.fillStyle = inside; g.fill();
        g.save(); g.clip(); ellipse(g, x, y + 12, 8, 6); g.fillStyle = tongue; g.fill(); g.restore();
        g.lineWidth = 4.5; g.stroke();
      } else if (f === MOUTH.FLAT) {
        g.beginPath(); g.moveTo(x - 13, y + 2); g.quadraticCurveTo(x, y + 5, x + 13, y + 2); g.stroke();
      } else if (f === MOUTH.KISS) {
        g.strokeStyle = '#c0425d'; g.lineWidth = 5.5;
        g.beginPath(); g.moveTo(x - 4, y - 12); g.quadraticCurveTo(x + 11, y - 8, x - 1, y); g.quadraticCurveTo(x + 11, y + 8, x - 4, y + 12); g.stroke();
      } else if (f === MOUTH.CAT) {
        g.beginPath(); g.moveTo(x - 20, y - 4); g.quadraticCurveTo(x - 10, y + 12, x, y - 1); g.quadraticCurveTo(x + 10, y + 12, x + 20, y - 4); g.stroke();
      } else if (f === MOUTH.TONGUE) {
        // A cheeky "bleh": a wide smile with the tongue poking out below it.
        g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y);
        g.bezierCurveTo(x + 17, y + 38, x - 17, y + 38, x - 14, y); g.closePath();
        g.fillStyle = tongue; g.fill();
        g.strokeStyle = '#c75d68'; g.lineWidth = 4; g.stroke();
        g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x, y + 20); g.stroke();
        g.strokeStyle = dark; g.lineWidth = 6.5;
        g.beginPath(); g.moveTo(x - 22, y - 6); g.quadraticCurveTo(x, y + 10, x + 22, y - 6); g.stroke();
      } else if (f === MOUTH.WOBBLE) {
        g.beginPath(); g.moveTo(x - 18, y + 2);
        for (let i = 1; i <= 4; i++) g.quadraticCurveTo(x - 18 + (i - 0.5) * 9, y + (i % 2 ? -5 : 7), x - 18 + i * 9, y + 1);
        g.stroke();
      }
    }
  });
  return mouthAtlas;
}

const cheekCache = new Map();
/** Blush, freckles, bandaid and a hint of a nose. Canvas 512 x 176. */
export function chibiCheeks(extra = 'none', skin = '#f7d0b5') {
  const dark = ['#a9714c', '#7b4b33', '#5a3726'].includes(skin);
  const key = `${extra}:${dark}`;
  if (!cheekCache.has(key)) {
    cheekCache.set(key, canvasTexture(512, 176, (g) => {
      g.clearRect(0, 0, 512, 176);
      const strong = extra === 'blush';
      for (const x of [118, 394]) {
        const grad = g.createRadialGradient(x, 98, 2, x, 98, 52);
        const a = strong ? 0.85 : dark ? 0.6 : 0.5;
        grad.addColorStop(0, `rgba(255,${dark ? 105 : 125},${dark ? 125 : 145},${a})`);
        grad.addColorStop(0.6, `rgba(255,${dark ? 105 : 125},${dark ? 125 : 145},${a * 0.45})`);
        grad.addColorStop(1, 'rgba(255,130,150,0)');
        g.save(); g.translate(x, 98); g.scale(1, 0.55); g.translate(-x, -98);
        g.fillStyle = grad; g.beginPath(); g.arc(x, 98, 52, 0, Math.PI * 2); g.fill(); g.restore();
        if (strong) {
          g.strokeStyle = 'rgba(226,80,110,.75)'; g.lineWidth = 4; g.lineCap = 'round';
          for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 14 - 5, 106); g.lineTo(x + i * 14 + 5, 90); g.stroke(); }
        }
      }
      if (extra === 'freckles') {
        g.fillStyle = dark ? 'rgba(60,30,20,.75)' : 'rgba(170,100,65,.8)';
        for (const [x, y] of [[-30, -18], [-14, -8], [-38, -2], [-20, 6], [-4, -16]]) {
          for (const side of [-1, 1]) { g.beginPath(); g.arc(256 + side * (110 + x) , 90 + y, 3.6, 0, Math.PI * 2); g.fill(); }
        }
      }
      if (extra === 'bandaid') {
        g.save(); g.translate(150, 84); g.rotate(-0.45);
        g.fillStyle = '#f3cfa6'; g.strokeStyle = '#d9a979'; g.lineWidth = 3;
        g.beginPath(); g.roundRect(-34, -11, 68, 22, 11); g.fill(); g.stroke();
        g.fillStyle = '#fbe3c6'; g.beginPath(); g.roundRect(-12, -9, 24, 18, 4); g.fill();
        g.fillStyle = '#d9a979'; for (const [dx, dy] of [[-5, -3], [5, -3], [-5, 4], [5, 4]]) { g.beginPath(); g.arc(dx, dy, 1.6, 0, 6.3); g.fill(); }
        g.restore();
      }
      // The smallest nose.
      g.fillStyle = dark ? 'rgba(60,25,20,.35)' : 'rgba(200,110,95,.45)';
      ellipse(g, 256, 70, 6, 4); g.fill();
    }));
  }
  return cheekCache.get(key);
}

/* ------------------------------------------------------------ ladybug */

let bugEyes = null;
export function bugEyeAtlas() {
  bugEyes ??= canvasTexture(1024, 256, (g) => {
    g.clearRect(0, 0, 1024, 256);
    g.lineCap = 'round';
    const cream = '#fff7e2', pupil = '#223a30';
    for (let f = 0; f < 8; f++) {
      const ox = (f % 4) * 256, oy = Math.floor(f / 4) * 128;
      for (const side of [-1, 1]) {
        const cx = ox + 128 + side * 64, cy = oy + 62;
        if (f === BUG_EYE.CLOSED) { // peaceful u
          g.strokeStyle = cream; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 26, cy + 2); g.quadraticCurveTo(cx, cy + 26, cx + 26, cy + 2); g.stroke();
          continue;
        }
        if (f === BUG_EYE.HAPPY) {
          g.strokeStyle = cream; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 26, cy + 12); g.quadraticCurveTo(cx, cy - 22, cx + 26, cy + 12); g.stroke();
          continue;
        }
        if (f === BUG_EYE.HEART) {
          heartPath(g, cx, cy + 2, 34); g.fillStyle = '#f06d98'; g.fill(); g.strokeStyle = cream; g.lineWidth = 4; g.stroke();
          ellipse(g, cx - 12, cy - 10, 8, 6, -0.5); g.fillStyle = '#fff'; g.fill();
          continue;
        }
        const wide = f === BUG_EYE.WIDE || f === BUG_EYE.STAR;
        const rx = wide ? 36 : 33, ry = wide ? 50 : 46;
        g.save();
        if (f === BUG_EYE.HALF || f === BUG_EYE.SAD) {
          const top = cy - ry + ry * (f === BUG_EYE.HALF ? 1.0 : 0.55);
          const tilt = f === BUG_EYE.SAD ? side * 0.3 : 0;
          g.beginPath(); g.moveTo(cx - rx - 6, top + tilt * rx); g.lineTo(cx + rx + 6, top - tilt * rx);
          g.lineTo(cx + rx + 6, cy + ry + 6); g.lineTo(cx - rx - 6, cy + ry + 6); g.closePath(); g.clip();
        }
        ellipse(g, cx, cy, rx, ry); g.fillStyle = cream; g.fill();
        const pr = wide ? 1.1 : 1;
        const pg = g.createLinearGradient(cx, cy - 30, cx, cy + 36);
        pg.addColorStop(0, '#16261f'); pg.addColorStop(0.7, pupil); pg.addColorStop(1, '#3f6a58');
        ellipse(g, cx + 3, cy + 6, 20 * pr, 30 * pr); g.fillStyle = pg; g.fill();
        g.fillStyle = '#fff';
        if (f === BUG_EYE.STAR) { sparklePath(g, cx - 2, cy - 6, 15, 0.3); g.fill(); ellipse(g, cx + 10, cy + 18, 4, 4); g.fill(); }
        else { ellipse(g, cx - 4, cy - 8, 9, 10); g.fill(); ellipse(g, cx + 10, cy + 18, 4, 4); g.fill(); }
        if (f === BUG_EYE.SAD) { g.strokeStyle = 'rgba(200,236,255,.95)'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx + 3, cy + 8, 17, 24, 0, 0.4, Math.PI - 0.4); g.stroke(); }
        g.restore();
        if (f === BUG_EYE.HALF || f === BUG_EYE.SAD) {
          const top = cy - ry + ry * (f === BUG_EYE.HALF ? 1.0 : 0.55);
          const tilt = f === BUG_EYE.SAD ? side * 0.3 : 0;
          g.strokeStyle = cream; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - rx, top + tilt * rx); g.lineTo(cx + rx, top - tilt * rx); g.stroke();
        }
      }
    }
  });
  return bugEyes;
}

let bugMouth = null;
export function bugMouthAtlas() {
  bugMouth ??= canvasTexture(1024, 256, (g) => {
    g.clearRect(0, 0, 1024, 256);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const cream = '#f9e8c8', inside = '#7a2f3c', tongue = '#f08a9a';
    for (let f = 0; f < 8; f++) {
      const ox = (f % 4) * 256, oy = Math.floor(f / 4) * 128;
      // Blush in every frame.
      for (const side of [-1, 1]) {
        const x = ox + 128 + side * 96, y = oy + 52;
        const grad = g.createRadialGradient(x, y, 1, x, y, 30);
        grad.addColorStop(0, 'rgba(240,150,170,.95)'); grad.addColorStop(0.6, 'rgba(240,150,170,.6)'); grad.addColorStop(1, 'rgba(240,150,170,0)');
        g.save(); g.translate(x, y); g.scale(1, 0.6); g.translate(-x, -y); g.fillStyle = grad; g.beginPath(); g.arc(x, y, 30, 0, 6.3); g.fill(); g.restore();
      }
      const x = ox + 128, y = oy + 70;
      g.strokeStyle = cream; g.lineWidth = 7;
      if (f === BUG_MOUTH.SMILE) { g.beginPath(); g.moveTo(x - 22, y - 8); g.quadraticCurveTo(x, y + 16, x + 22, y - 8); g.stroke(); }
      else if (f === BUG_MOUTH.FLAT) { g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x, y + 4, x + 14, y); g.stroke(); }
      else if (f === BUG_MOUTH.SAD) { g.beginPath(); g.moveTo(x - 18, y + 8); g.quadraticCurveTo(x, y - 12, x + 18, y + 8); g.stroke(); }
      else if (f === BUG_MOUTH.CHEW) { g.beginPath(); g.moveTo(x - 20, y - 4); g.quadraticCurveTo(x - 10, y + 10, x, y - 2); g.quadraticCurveTo(x + 10, y + 10, x + 20, y - 4); g.stroke(); }
      else {
        const w = f === BUG_MOUTH.GRIN ? 26 : f === BUG_MOUTH.MUNCH ? 18 : f === BUG_MOUTH.YAWN ? 16 : 11;
        const h = f === BUG_MOUTH.GRIN ? 26 : f === BUG_MOUTH.MUNCH ? 22 : f === BUG_MOUTH.YAWN ? 32 : 14;
        g.beginPath();
        if (f === BUG_MOUTH.GRIN) { g.moveTo(x - w, y - 10); g.quadraticCurveTo(x, y - 13, x + w, y - 10); g.bezierCurveTo(x + w, y + h * 0.8, x - w, y + h * 0.8, x - w, y - 10); }
        else g.ellipse(x, y, w, h * 0.6, 0, 0, 6.3);
        g.closePath(); g.fillStyle = inside; g.fill();
        g.save(); g.clip(); ellipse(g, x, y + h * 0.5, w * 0.8, h * 0.4); g.fillStyle = tongue; g.fill(); g.restore();
        g.lineWidth = 4.5; g.stroke();
      }
    }
  });
  return bugMouth;
}

/**
 * A per-character window onto a shared atlas. Returns { material, set(frame) }.
 * The material is the character's own (disposed with it); the image is shared.
 */
export function atlasMaterial(atlas, cols, rows, { roughness = 0.45, opacity = 1 } = {}) {
  const tex = atlas.clone();
  tex.repeat.set(1 / cols, 1 / rows);
  const material = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, roughness, metalness: 0, opacity,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  let current = -1;
  const set = (frame) => {
    if (frame === current) return;
    current = frame;
    const c = frame % cols, r = Math.floor(frame / cols);
    tex.offset.set(c / cols, 1 - (r + 1) / rows);
  };
  set(0);
  return { material, set, texture: tex, get frame() { return current; } };
}
