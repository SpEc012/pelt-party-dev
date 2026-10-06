// What crosses the garden's live socket, and what a person may look like.
//
// Shared by the GardenRoom Durable Object, the garden rules (the `appearance`
// action stores a look) and the 3D client. Everything that arrives from a
// browser is passed through one of these cleaners before anyone else sees it:
// the relay never trusts a shape it has not rebuilt itself.

/* ------------------------------------------------------------------ looks */

/** Every option an avatar can wear. Index 0 of each list is the plain choice. */
export const LOOK = {
  skin: ['#ffe3d3', '#f7d0b5', '#eab792', '#cf9570', '#a9714c', '#7b4b33', '#5a3726'],
  hair: ['bob', 'long', 'bun', 'pigtails', 'curly', 'short', 'wavy', 'buzz', 'ponytail', 'afro', 'bangs', 'spiky'],
  hairColor: ['#2e211b', '#5b3825', '#8d5c38', '#c58d56', '#ecc987', '#d9745f', '#f3a9c4', '#9b86dc', '#76bccd', '#f3efe6'],
  eyes: ['round', 'happy', 'sleepy', 'sparkle', 'wink', 'lashes'],
  top: ['tee', 'hoodie', 'sweater', 'dress', 'overalls', 'flannel', 'cardigan', 'jersey', 'tank', 'kimono'],
  bottom: ['jeans', 'shorts', 'skirt', 'joggers', 'leggings', 'cargo'],
  shoes: ['sneakers', 'boots', 'sandals', 'flats', 'rainboots', 'slippers'],
  hat: ['none', 'cap', 'beanie', 'sunhat', 'flower', 'bow', 'bucket', 'crown', 'frog', 'headband'],
  extra: ['none', 'glasses', 'sunnies', 'blush', 'freckles', 'scarf', 'backpack', 'earrings', 'bandaid', 'heartpin'],
};

/** Suggested cloth colours for the editor. Any #rrggbb is accepted. */
export const SWATCHES = ['#f4a6bd', '#e76f8f', '#f7d77a', '#9fd39a', '#7fc3c9', '#8ea6e6', '#b69be0', '#f6efe4', '#3f4a5c', '#c98b5a', '#e25b4f', '#6b8f5e'];

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
const hex = (value, fallback) => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback);

/** A small stable number from a string, for defaults that differ per person. */
export function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The look someone has before they ever open the editor. */
export function defaultLook(id = '') {
  const n = seedOf(id);
  const at = (list, shift) => list[(n >>> shift) % list.length];
  return {
    skin: at(LOOK.skin, 1),
    hair: at(LOOK.hair, 4),
    hairColor: at(LOOK.hairColor, 8),
    eyes: 'round',
    top: at(['tee', 'hoodie', 'sweater', 'overalls', 'cardigan'], 12),
    topColor: at(SWATCHES, 15),
    bottom: at(['jeans', 'shorts', 'skirt', 'joggers'], 19),
    bottomColor: at(['#3f4a5c', '#6b8f5e', '#c98b5a', '#8ea6e6'], 22),
    shoes: 'sneakers',
    shoeColor: '#f6efe4',
    hat: 'none',
    hatColor: at(SWATCHES, 25),
    extra: 'none',
  };
}

/** Rebuild a look from untrusted input. Unknown values fall back to the default. */
export function cleanLook(look, id = '') {
  const base = defaultLook(id);
  if (!look || typeof look !== 'object') return base;
  return {
    skin: pick(LOOK.skin, look.skin, base.skin),
    hair: pick(LOOK.hair, look.hair, base.hair),
    hairColor: hex(look.hairColor, base.hairColor),
    eyes: pick(LOOK.eyes, look.eyes, base.eyes),
    top: pick(LOOK.top, look.top, base.top),
    topColor: hex(look.topColor, base.topColor),
    bottom: pick(LOOK.bottom, look.bottom, base.bottom),
    bottomColor: hex(look.bottomColor, base.bottomColor),
    shoes: pick(LOOK.shoes, look.shoes, base.shoes),
    shoeColor: hex(look.shoeColor, base.shoeColor),
    hat: pick(LOOK.hat, look.hat, base.hat),
    hatColor: hex(look.hatColor, base.hatColor),
    extra: pick(LOOK.extra, look.extra, base.extra),
  };
}
