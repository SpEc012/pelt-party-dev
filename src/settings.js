// Player settings live in this browser only. Every value is clamped on load.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export const DEFAULTS = {
  quality: coarse ? 'medium' : 'high', renderScale: 1, fpsCap: 0, shadows: true, weather: true,
  fov: 72, sens: 1, aimSens: .6, invertY: false, toggleCrouch: false, toggleSprint: false,
  master: .8, music: .5, sfx: .9, muted: false,
  shake: true, reduced: false, showFps: false, hints: true, aimAssist: coarse
};
const RANGES = { renderScale: [.5, 1.5], fpsCap: [0, 360], fov: [55, 100], sens: [.1, 4], aimSens: [.2, 1], master: [0, 1], music: [0, 1], sfx: [0, 1] };
export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pelt-settings') || '{}') || {}; } catch { saved = {}; }
  const s = { ...DEFAULTS };
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in DEFAULTS) || typeof v !== typeof DEFAULTS[k]) continue;
    s[k] = RANGES[k] ? Math.min(RANGES[k][1], Math.max(RANGES[k][0], v)) : v;
  }
  if (!['low', 'medium', 'high', 'ultra'].includes(s.quality)) s.quality = DEFAULTS.quality;
  return s;
}
export function saveSettings(s) { try { localStorage.setItem('pelt-settings', JSON.stringify(s)); return true; } catch { return false; } }
export const FPS_CAPS = [0, 30, 60, 120, 144, 165, 240];
