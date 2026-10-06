// Authored arenas. Every piece of cover is a finite cylinder (x, z, r, h) so the room,
// the client prediction and the camera all share one exact collision model. Long
// shapes (hedges, cars, fences, forts) are rows of overlapping segments. `kind` and
// `rot` only tell the renderer what to draw.

export const MAPS = [
  { id: 'commons', name: 'Frosty Commons', caption: 'A city park, a frozen fountain, two ice ponds', icon: '❄' },
  { id: 'street', name: 'Maple Street', caption: 'Parked cars, front yards, zero mercy', icon: '⌂' },
  { id: 'patch', name: 'Pumpkin Patch', caption: 'Hay lanes around a giant jack-o’-lantern', icon: '◉' },
  { id: 'hollow', name: 'Haunted Hollow', caption: 'Tombstones, a crypt and very bad vibes', icon: '✝' }
];

function builder() {
  const props = [];
  const add = (kind, x, z, r, h, rot = 0, extra = {}) => { props.push({ kind, x, z, r, h, rot, ...extra }); };
  const line = (kind, x1, z1, x2, z2, r, h, gap = r * 1.5) => {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / gap)), rot = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) add(kind, x1 + dx * i / n, z1 + dz * i / n, r, h, rot, { seg: i, segs: n + 1 });
  };
  const arc = (kind, cx, cz, R, a0, a1, n, r, h) => {
    for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (n === 1 ? .5 : i / (n - 1)); add(kind, cx + Math.sin(a) * R, cz + Math.cos(a) * R, r, h, a + Math.PI / 2, { seg: i, segs: n }); }
  };
  // Copy everything added inside fn into the other three quadrants (or the other half).
  const mirror = (fn, axes = 'xz') => {
    const start = props.length; fn(); const made = props.slice(start);
    for (const o of made) {
      if (axes.includes('x')) props.push({ ...o, x: -o.x, rot: -o.rot });
      if (axes.includes('z')) props.push({ ...o, z: -o.z, rot: Math.PI - o.rot });
      if (axes === 'xz') props.push({ ...o, x: -o.x, z: -o.z, rot: o.rot + Math.PI });
    }
  };
  return { props, add, line, arc, mirror };
}

const LAYOUTS = {
  commons() {
    const b = builder(), { add, arc, mirror, line } = b;
    add('fountain', 0, 0, 2.4, 1.35);
    mirror(() => {
      arc('hedge', 0, 0, 9.5, .38, 1.18, 4, .62, 1.12);
      add('bench', 4.2, 5.4, .55, .8, -Math.PI / 4);
      add('pine', 15, 10, .75, 4.6); add('pine', 21, 17.5, .75, 5.2); add('pine', 9.5, 19.5, .75, 4.4); add('pine', 31, 19, .75, 5);
      add('snowman', 16.5, 3.5, .72, 1.95);
      add('lamp', 6.6, 10.8, .2, 4.2); add('lamp', 12.6, 1.6, .2, 4.2);
      add('rock', 25, 9, 1.15, 1.25);
      line('hedge', 19, 2.8, 19, 6.2, .6, 1.12, .85);
      add('sled', 27.5, 14.5, .65, .7, .6);
      add('crate', 11, 15.5, .7, 1.2);
    });
    // Team snow forts guard each spawn side.
    mirror(() => { arc('fort', 34.5, 0, 6, -Math.PI / 2 - .7, -Math.PI / 2 + .7, 6, .62, 1.18); }, 'x');
    return {
      width: 72, depth: 50, props: b.props,
      ice: [{ x: 0, z: 17, r: 4.6 }, { x: 0, z: -17, r: 4.6 }],
      piles: [[-25, 0], [25, 0], [-12, 14], [12, 14], [-12, -14], [12, -14], [0, 7.6], [0, -7.6]],
      pads: [[-16, 0], [16, 0], [0, 12.4], [0, -12.4]]
    };
  },
  street() {
    const b = builder(), { add, line, mirror, arc } = b;
    const car = (x, z) => line('car', x - 1.15, z, x + 1.15, z, .88, 1.38, 1.15);
    mirror(() => {
      car(6, 3.1); car(23, 3.1);
      line('fence', 4, 10.5, 13, 10.5, .3, 1.0, .9); line('fence', 19, 10.5, 30, 10.5, .3, 1.0, .9);
      add('mailbox', 15.8, 9.2, .28, 1.25);
      add('snowman', 9.5, 15.2, .72, 1.95); add('snowman', 27.5, 16.5, .72, 1.95);
      add('oak', 2.5, 18.5, .8, 4.6); add('oak', 17.5, 20, .8, 5); add('oak', 35, 12.5, .8, 4.8);
      line('hedge', 23, 14, 23, 19, .6, 1.1, .85);
      arc('fort', 13.5, 18.5, 2.6, Math.PI - .9, Math.PI + .9, 4, .58, 1.12);
      add('lamp', 12, 6.2, .2, 4.2); add('lamp', 31, 6.2, .2, 4.2);
      add('crate', 33, 19.5, .7, 1.2);
    });
    add('shelter', 0, 7.8, 1.3, 2.5); add('shelter', 0, -7.8, 1.3, 2.5);
    return {
      width: 78, depth: 46, props: b.props, ice: [],
      road: true,
      piles: [[-34, 0], [34, 0], [-9.5, -13], [9.5, 13], [-9.5, 13], [9.5, -13], [-23, 0], [23, 0]],
      pads: [[-14, 0], [14, 0], [0, 16.5], [0, -16.5]]
    };
  },
  patch() {
    const b = builder(), { add, line, mirror } = b;
    add('jack', 0, 0, 2.6, 3.2);
    mirror(() => {
      line('hay', 8, 4.5, 8, 11.5, .95, 1.05, 1.4);
      line('hay', 18.5, 2.5, 18.5, 8.5, .95, 1.05, 1.4);
      line('hay', 27, 8.5, 27, 15.5, .95, 1.05, 1.4);
      add('scarecrow', 13, 6.5, .42, 2.3); add('scarecrow', 22.5, 16.5, .42, 2.3);
      add('crate', 14.5, 13.5, .72, 1.2); add('crate', 4, 16.5, .72, 1.2); add('crate', 31, 3, .72, 1.2);
      add('gourds', 9.5, 20.5, 1.05, .95); add('gourds', 32, 20, 1.05, .95);
      add('oak', 18, 21.5, .8, 4.8); add('oak', 33.5, 12, .8, 4.6);
      add('cart', 24, 2.5, .95, 1.3, .3);
    });
    return {
      width: 74, depth: 50, props: b.props, ice: [],
      piles: [[-30.5, -9], [30.5, 9], [-13.5, 18.5], [13.5, -18.5], [-13.5, -18.5], [13.5, 18.5], [-5, 0], [5, 0]],
      pads: [[-18.5, -15], [18.5, 15], [0, 13.5], [0, -13.5]]
    };
  },
  hollow() {
    const b = builder(), { add, line, mirror } = b;
    add('crypt', 0, 0, 2.5, 3.3);
    mirror(() => {
      for (const [x, z] of [[7.5, 6], [10.5, 6], [13.5, 6], [9, 10.2], [12, 10.2]]) add('tomb', x, z, .52, 1.2, 0);
      add('deadtree', 18.5, 14.5, .5, 4.4); add('deadtree', 27, 5.5, .5, 4.2); add('deadtree', 6, 19.5, .5, 4.6);
      line('ironfence', 21, 9, 21, 15, .26, 1.4, .7);
      add('obelisk', 16, 2.2, .58, 2.7); add('obelisk', 30.5, 15, .58, 2.7);
      add('gourds', 25, 20.5, 1.05, .95);
      for (const [x, z] of [[26.5, 10], [29.5, 10], [28, 12.5]]) add('tomb', x, z, .52, 1.2, 0);
      add('crate', 4.2, 14.5, .72, 1.2);
    });
    return {
      width: 70, depth: 50, props: b.props, ice: [],
      piles: [[-28.5, 0], [28.5, 0], [-11, 16.5], [11, -16.5], [-11, -16.5], [11, 16.5], [0, 9.5], [0, -9.5]],
      pads: [[-20, 0], [20, 0], [0, 18], [0, -18]]
    };
  }
};

// Scale once for big lobbies so twenty players still have room to flank.
export function makeMap(id = 'commons', count = 8) {
  if (!LAYOUTS[id]) id = 'commons';
  const base = LAYOUTS[id](), s = count > 12 ? 1.2 : 1;
  const props = base.props.map((o, i) => ({ ...o, id: i, x: +(o.x * s).toFixed(3), z: +(o.z * s).toFixed(3) }));
  const width = base.width * s, depth = base.depth * s;
  const piles = base.piles.map(([x, z], i) => ({ id: i, x: x * s, z: z * s }));
  const pads = base.pads.map(([x, z], i) => ({ id: i, x: x * s, z: z * s }));
  const ice = (base.ice || []).map(o => ({ x: o.x * s, z: o.z * s, r: o.r * s }));
  // Spawns hug each team's back line; free-for-all picks the safest one at respawn.
  const spawns = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) spawns.push({ x: side * (width / 2 - 2.5), z: (i - 2) * (depth - 10) / 4, side });
    for (const zs of [-1, 1]) spawns.push({ x: side * (width / 2 - 11), z: zs * (depth / 2 - 2.5), side });
  }
  const safe = spawns.map(p => {
    let { x, z } = p;
    for (let pass = 0; pass < 4; pass++) for (const o of props) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), r = o.r + 1; if (d < r) { x = o.x + (d > .001 ? dx / d : 1) * r; z = o.z + (d > .001 ? dz / d : 0) * r; } }
    return { ...p, x: Math.max(-width / 2 + 1, Math.min(width / 2 - 1, x)), z: Math.max(-depth / 2 + 1, Math.min(depth / 2 - 1, z)) };
  });
  return { id, scale: s, width, depth, props, piles, pads, ice, spawns: safe, road: !!base.road };
}

export function spawnPoint(slot, map) {
  const side = slot % 2 ? 1 : -1, list = map.spawns.filter(p => p.side === side), p = list[Math.floor(slot / 2) % list.length];
  return { x: p.x, z: p.z };
}
