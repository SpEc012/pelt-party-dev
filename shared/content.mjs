export const BUILD = '0.2.0';
export const TITLE = 'Pelt Party';
export const SEASONS = {
  halloween: { name: 'Pumpkin Panic', label: 'HALLOWEEN EDITION', pelt: 'pumpkins', ground: '#839675', sky: '#484a76', fog: '#9296b2', accent: '#ffa54d', tree: '#c77545' },
  harvest: { name: 'Leaf Fort Frenzy', label: 'HARVEST EDITION', pelt: 'leaf balls', ground: '#b0985f', sky: '#c7aa8c', fog: '#ccb58d', accent: '#f2ba59', tree: '#cb6c3c' },
  frost: { name: 'Snowball Showdown', label: 'FROST EDITION', pelt: 'snowballs', ground: '#d9e8ee', sky: '#91aec9', fog: '#b4ccde', accent: '#b6eafa', tree: '#477d79' },
  meadow: { name: 'Meadow Mischief', label: 'MEADOW EDITION', pelt: 'flower puffs', ground: '#82a56b', sky: '#a8d1cc', fog: '#bcd0ae', accent: '#f4d37c', tree: '#73a16a' }
};
export function seasonFor(date = new Date(), override) {
  if (Object.hasOwn(SEASONS, override)) return override;
  const month = date.getUTCMonth();
  return month === 9 ? 'halloween' : month === 10 ? 'harvest' : month === 11 || month === 0 ? 'frost' : 'meadow';
}
export const CHARACTERS = [
  { id: 'pip', name: 'Pip', title: 'THE ALL-ROUNDER', color: '#8bc9ba', hair: '#754d35', skin: '#f7d0b5', stats: [3,3,3,3,3] },
  { id: 'dot', name: 'Dot', title: 'THE COZY COMPETITOR', color: '#d97565', hair: '#ede5d5', skin: '#f7d0b5', stats: [2,3,3,4,3] },
  { id: 'chad', name: 'Chad', title: 'ALWAYS IN A HURRY', color: '#dab764', hair: '#302b2b', skin: '#cf9570', stats: [5,2,4,2,2] },
  { id: 'luna', name: 'Luna', title: 'THE MOONLIGHT MOTH', color: '#b19fd6', hair: '#8b79b8', skin: '#ffe3d3', stats: [3,2,5,2,3] }
];
export const COSMETICS = [
  { id: 'none', name: 'Just me', price: 0, rarity: 'Starter' },
  { id: 'pumpkin', name: 'Pumpkin cap', price: 40, rarity: 'Common' },
  { id: 'witch', name: 'Midnight witch', price: 120, rarity: 'Rare' },
  { id: 'cat', name: 'Cat ears', price: 80, rarity: 'Common' },
  { id: 'crown', name: 'Gourd royalty', price: 200, rarity: 'Epic' }
];
export const MAPS = [
  { id: 'patch', name: 'Pumpkin Patch Panic', caption: 'Homegrown chaos', icon: '◉' },
  { id: 'hollow', name: 'Haunted Hollow', caption: 'A very lively graveyard', icon: '♧' },
  { id: 'cove', name: 'Cauldron Cove', caption: 'Something is bubbling', icon: '◒' }
];
export function makeMap(id = 'patch', count = 8) {
  const scale = count > 10 ? 1.5 : 1, width = 44 * scale, depth = 30 * scale;
  const props = [{ x: 0, z: 0, r: id === 'cove' ? 2.7 : 2.2, h: 2.4, kind: id === 'cove' ? 'cauldron' : id === 'hollow' ? 'tree' : 'pumpkin' }];
  for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
    props.push({ x: sign * (7 + i * 4) * scale, z: (i % 2 ? -5 : 5) * scale, r: 1.15, h: .85, kind: id === 'hollow' ? 'stone' : 'hay' });
    props.push({ x: sign * (6 + i * 5) * scale, z: (i % 2 ? 10 : -10) * scale, r: .7, h: 2.3, kind: 'tree' });
  }
  for(const sign of [-1,1])for(const z of [-3.5,7])props.push({x:sign*11*scale,z:z*scale,r:1.05,h:1.55,kind:'bunker',team:sign<0?0:1});
  const piles = [[-17,-9],[-17,9],[17,-9],[17,9],[0,-11],[0,11]].map(([x,z],i)=>({id:i,x:x*scale,z:z*scale}));
  if(count>18) piles.push({id:6,x:-10*scale,z:0},{id:7,x:10*scale,z:0});
  const pads = [[-9,0],[9,0],[0,-6],[0,6]].map(([x,z],id)=>({id,x:x*scale,z:z*scale}));
  return { id, scale, width, depth, props, piles, pads };
}
export function spawnPoint(slot, map) {
  const side = slot % 2 ? 1 : -1, row = Math.floor(slot / 2);
  return { x: side * (map.width / 2 - 3), z: ((row%5)-2)*((map.depth-8)/5)+(row>=5?1.8:0) };
}
