// All audio is synthesised at runtime: no files to download, nothing to license.
// Sound effects are short noise/oscillator recipes; music is a small step sequencer
// that plays a seasonal arrangement and gets more intense as a match heats up.

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 11] };
const KEYS = {
  frost: { root: 60, scale: 'major', bell: true, prog: [0, 5, 3, 4] },
  halloween: { root: 62, scale: 'minor', bell: false, prog: [0, 5, 3, 4] },
  harvest: { root: 55, scale: 'major', bell: false, prog: [0, 3, 5, 4] },
  meadow: { root: 65, scale: 'major', bell: true, prog: [0, 3, 4, 3] }
};
// Melody motifs: [step, chord-tone offset in scale degrees, length in steps].
const MOTIFS = [
  [[0, 4, 2], [2, 2, 2], [4, 0, 2], [6, 2, 2], [8, 4, 3], [12, 7, 4]],
  [[0, 7, 2], [3, 6, 1], [4, 4, 2], [6, 2, 2], [8, 3, 2], [10, 4, 2], [12, 2, 4]],
  [[0, 0, 1], [1, 2, 1], [2, 4, 2], [4, 7, 2], [6, 4, 2], [8, 9, 4], [14, 7, 2]],
  [[0, 4, 4], [4, 5, 2], [6, 4, 2], [8, 2, 4], [12, 0, 4]]
];
const midi = n => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.vol = { master: .8, music: .55, sfx: .9 }; this.track = null; this.season = 'frost'; this.level = 0; this.step = 0; this.bar = 0; this.timer = null; }
  unlock() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.out = c.createDynamicsCompressor(); this.out.threshold.value = -14; this.out.ratio.value = 4; this.out.connect(c.destination);
        this.master = c.createGain(); this.master.connect(this.out);
        this.musicBus = c.createGain(); this.musicBus.connect(this.master);
        this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
        const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf; this.apply();
        if (this.wanted) this.music(this.wanted.track, this.wanted.season);
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch { /* audio is optional */ }
  }
  setVolumes(v) { Object.assign(this.vol, v); this.apply(); }
  setMuted(m) { this.muted = m; if (m) this.ctx?.suspend(); else { this.unlock(); this.ctx?.resume(); } }
  apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.vol.master, t, .05); this.musicBus.gain.setTargetAtTime(this.vol.music * .5, t, .1); this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, .05); }
  get live() { return !this.muted && this.ctx && this.ctx.state === 'running'; }

  /* ------------------------------------------------------------ building blocks */
  env(g, t, a, peak, d, end = .0001) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  osc(type, f0, f1, t, a, peak, d, bus = this.sfxBus, pan = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    this.env(g, t, a, peak, d); o.connect(g); this.route(g, bus, pan); o.start(t); o.stop(t + a + d + .05); return o;
  }
  noise(type, f0, f1, q, t, a, peak, d, bus = this.sfxBus, pan = 0) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; s.playbackRate.value = .7 + Math.random() * .6;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + a + d);
    this.env(g, t, a, peak, d); s.connect(f); f.connect(g); this.route(g, bus, pan); s.start(t, Math.random()); s.stop(t + a + d + .05);
  }
  route(node, bus, pan) { if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(bus); } else node.connect(bus); }

  /* ---------------------------------------------------------------- effects */
  play(kind, { pan = 0, vol = 1, pitch = 1 } = {}) {
    if (!this.live) return;
    const t = this.ctx.currentTime + .005, v = Math.min(1.5, vol), p = pitch;
    switch (kind) {
      case 'tap': this.osc('triangle', 880 * p, 660 * p, t, .004, .08 * v, .07); break;
      case 'hover': this.osc('sine', 1320, 1100, t, .003, .025 * v, .05); break;
      case 'throw': this.noise('bandpass', 2400 * p, 500, 2.2, t, .01, .3 * v, .14, undefined, pan); this.osc('triangle', 420 * p, 200, t, .005, .05 * v, .09, undefined, pan); break;
      case 'charged': this.noise('bandpass', 1600, 220, 1.6, t, .02, .45 * v, .3, undefined, pan); this.osc('sawtooth', 160, 55, t, .01, .09 * v, .3, undefined, pan); break;
      case 'chargeReady': this.osc('sine', 1180, 1180, t, .004, .07 * v, .16); this.osc('sine', 1770, 1770, t + .05, .004, .05 * v, .2); break;
      case 'impact': this.noise('lowpass', 900, 180, 1, t, .004, .22 * v, .12, undefined, pan); this.osc('sine', 140, 60, t, .004, .12 * v, .1, undefined, pan); break;
      case 'thud': this.noise('lowpass', 600, 120, 1, t, .003, .3 * v, .16, undefined, pan); this.osc('sine', 95, 45, t, .003, .2 * v, .14, undefined, pan); break;
      case 'burst': this.noise('lowpass', 1800, 90, .8, t, .005, .6 * v, .45, undefined, pan); this.osc('sine', 110, 32, t, .005, .35 * v, .45, undefined, pan); break;
      case 'hitConfirm': this.osc('square', 1900, 1900, t, .002, .05 * v, .05); this.osc('sine', 2600, 2600, t + .03, .002, .04 * v, .06); this.noise('lowpass', 1400, 300, 1, t, .003, .25 * v, .1); break;
      case 'hurt': this.noise('lowpass', 1200, 150, 1.4, t, .003, .5 * v, .22); this.osc('triangle', 300, 90, t, .004, .18 * v, .2); break;
      case 'splat': this.noise('lowpass', 3000, 140, 1.2, t, .003, .55 * v, .3, undefined, pan); this.osc('sine', 340, 70, t, .004, .22 * v, .3, undefined, pan); [784, 988, 1319].forEach((f, i) => this.osc('triangle', f, f, t + .06 + i * .055, .004, .07 * v, .16)); break;
      case 'splatted': this.noise('lowpass', 900, 80, 1, t, .004, .6 * v, .6); this.osc('sawtooth', 220, 55, t, .01, .12 * v, .7); break;
      case 'dive': this.noise('bandpass', 500, 2600, 1.4, t, .03, .32 * v, .24, undefined, pan); break;
      case 'dodge': this.noise('highpass', 3000, 6000, .8, t, .01, .18 * v, .14); this.osc('sine', 1480, 1980, t, .003, .05 * v, .12); break;
      case 'slide': this.noise('lowpass', 1400, 500, .7, t, .05, .26 * v, .55, undefined, pan); break;
      case 'scoop': this.noise('bandpass', 900 + Math.random() * 400, 500, 2, t, .005, .16 * v, .08); break;
      case 'build': for (let i = 0; i < 3; i++) this.noise('lowpass', 1500, 300, 1, t + i * .06, .004, .3 * v, .09, undefined, pan); this.osc('sine', 120, 70, t + .12, .005, .2 * v, .18, undefined, pan); break;
      case 'break': this.noise('lowpass', 2200, 150, .8, t, .004, .5 * v, .35, undefined, pan); this.noise('highpass', 4000, 2000, 1, t + .03, .004, .12 * v, .2, undefined, pan); break;
      case 'block': this.osc('sine', 1560, 1500, t, .002, .12 * v, .35); this.osc('sine', 2340, 2300, t, .002, .06 * v, .3); break;
      case 'power': [0, 4, 7, 12, 16].forEach((s, i) => this.osc('triangle', midi(72 + s), midi(72 + s), t + i * .045, .004, .08 * v, .18)); break;
      case 'empty': this.osc('square', 180, 150, t, .003, .05 * v, .06); break;
      case 'tick': this.osc('square', 880, 880, t, .003, .07 * v, .09); break;
      case 'go': this.osc('sawtooth', 523, 523, t, .01, .1 * v, .4); this.osc('sawtooth', 784, 784, t, .01, .08 * v, .4); this.osc('sawtooth', 1047, 1047, t, .01, .06 * v, .5); break;
      case 'callout': [0, 7, 12, 19].forEach((s, i) => this.osc('square', midi(67 + s), midi(67 + s), t + i * .05, .004, .05 * v, .14)); break;
      case 'frenzy': this.osc('sawtooth', 220, 880, t, .02, .1 * v, .6); this.osc('sawtooth', 330, 1320, t + .05, .02, .07 * v, .6); this.noise('highpass', 2000, 8000, .5, t, .1, .1 * v, .6); break;
      case 'spawn': this.osc('sine', 523, 1047, t, .01, .06 * v, .25); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => this.osc('triangle', midi(67 + s), midi(67 + s), t + i * .09, .005, .09 * v, .25)); break;
      case 'lose': [7, 5, 3, 0].forEach((s, i) => this.osc('triangle', midi(64 + s), midi(64 + s), t + i * .16, .005, .08 * v, .35)); break;
      default: this.osc('sine', 520, 520, t, .005, .05 * v, .1);
    }
  }

  /* ------------------------------------------------------------------ music */
  music(track, season = 'frost') {
    this.wanted = { track, season };
    if (!this.ctx) return;
    if (this.track === track && this.season === season) return;
    this.track = track; this.season = season; this.step = 0; this.bar = 0; this.level = 0;
    clearInterval(this.timer); this.timer = null;
    if (!track) return;
    this.bpm = track === 'battle' ? 150 : 108; this.next = this.ctx.currentTime + .1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  intensity(n) { this.level = n; }
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') { if (this.ctx) this.next = this.ctx.currentTime + .1; return; }
    const spb = 60 / this.bpm / 4;
    while (this.next < this.ctx.currentTime + .12) {
      const swing = this.track === 'menu' && this.step % 2 ? spb * .18 : 0;
      this.note(this.step, this.next + swing, spb);
      this.next += spb; this.step = (this.step + 1) % 16; if (!this.step) this.bar++;
    }
  }
  note(s, t, spb) {
    const k = KEYS[this.season] || KEYS.frost, scale = SCALES[k.scale], bus = this.musicBus, lvl = this.level, battle = this.track === 'battle';
    const chordDeg = k.prog[this.bar % 4], deg = n => { const d = chordDeg + n, o = Math.floor(d / 7); return k.root + scale[((d % 7) + 7) % 7] + 12 * o; };
    const spooky = this.season === 'halloween';
    if (battle) {
      if (s % 4 === 0) this.kick(t, .9);
      if (s === 4 || s === 12) this.snare(t, .5);
      if (lvl >= 1 && (s === 14 && this.bar % 2)) this.snare(t, .3);
      if (s % 2 === 1 || lvl >= 1) this.hat(t, s % 4 === 2 ? .16 : .07);
      if (!spooky || s % 2) this.shaker(t, s % 4 === 0 ? .09 : .05);
      if (s % 4 === 2) this.bass(midi(deg(0) - 24), t, spb * 1.6, .32);
      if (s === 0 || s === 7 || s === 10) this.bass(midi(deg(s === 10 ? 4 : 0) - 24), t, spb * .9, .22);
      const arp = [0, 2, 4, 7][s % 4]; this.pluck(midi(deg(arp) + (lvl >= 1 ? 12 : 0)), t, spb * .9, k.bell ? .05 : .035, k.bell);
      const motif = MOTIFS[(Math.floor(this.bar / 2) + (lvl >= 1 ? 2 : 0)) % MOTIFS.length];
      if (this.bar % 8 >= 2) for (const [st, d, len] of motif) if (st === s) this.lead(midi(deg(d) + 12), t, spb * len, .07, spooky);
      if (s === 0) this.pad([deg(0), deg(2), deg(4)].map(n => midi(n - 12)), t, spb * 16, .03);
    } else {
      if (s === 0 || s === 8) this.kick(t, .35);
      if (s === 4 || s === 12) this.snare(t, .14);
      if (s % 2 === 0) this.shaker(t, .04);
      if ([0, 6, 8, 14].includes(s)) this.pluck(midi(deg(s === 6 || s === 14 ? 4 : 0) - 12), t, spb * 1.5, .12, false, true);
      if (s % 2 === 0) this.pluck(midi(deg([0, 2, 4, 2, 4, 7, 4, 2][s / 2]) + 12), t, spb * 2, .035, k.bell);
      const motif = MOTIFS[Math.floor(this.bar / 2) % 2 ? 3 : 0];
      if (this.bar % 4 >= 1) for (const [st, d, len] of motif) if (st === s) this.lead(midi(deg(d) + 12), t, spb * len * 1.2, .055, spooky);
      if (s === 0) this.pad([deg(0), deg(2), deg(4)].map(n => midi(n - 12)), t, spb * 16, .035);
    }
  }
  kick(t, v) { this.osc('sine', 150, 42, t, .002, v * .5, .2, this.musicBus); }
  snare(t, v) { this.noise('highpass', 1800, 1000, .7, t, .002, v * .45, .14, this.musicBus); this.osc('triangle', 220, 160, t, .002, v * .15, .08, this.musicBus); }
  hat(t, v) { this.noise('highpass', 8000, 8000, 1, t, .001, v, .04, this.musicBus); }
  shaker(t, v) { this.noise('bandpass', 9000, 7000, 3, t, .004, v, .06, this.musicBus); }
  bass(f, t, d, v) { const c = this.ctx, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(200, t + d); this.env(g, t, .005, v, d); o.connect(fl); fl.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + d + .05); }
  pluck(f, t, d, v, bell = false, round = false) {
    if (bell) { this.osc('sine', f * 2, f * 2, t, .002, v, d * 2.2, this.musicBus); this.osc('sine', f * 5.04, f * 5.04, t, .001, v * .25, d, this.musicBus); }
    else this.osc(round ? 'triangle' : 'square', f, f, t, .003, round ? v : v * .7, d, this.musicBus);
  }
  lead(f, t, d, v, spooky) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = spooky ? 'sine' : 'triangle'; o.frequency.setValueAtTime(spooky ? f * .97 : f, t); if (spooky) o.frequency.exponentialRampToValueAtTime(f, t + .08);
    lfo.frequency.value = spooky ? 6.5 : 5; lg.gain.value = f * (spooky ? .018 : .006); lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .02); g.gain.setValueAtTime(v, t + Math.max(.03, d - .05)); g.gain.exponentialRampToValueAtTime(.0001, t + d + .12);
    o.connect(g); g.connect(this.musicBus); o.start(t); lfo.start(t); o.stop(t + d + .15); lfo.stop(t + d + .15);
  }
  pad(freqs, t, d, v) {
    const c = this.ctx, fl = c.createBiquadFilter(), g = c.createGain(); fl.type = 'lowpass'; fl.frequency.value = 1100; fl.connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .4); g.gain.setValueAtTime(v, t + d - .3); g.gain.exponentialRampToValueAtTime(.0001, t + d + .2);
    for (const f of freqs) for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + d + .3); }
  }
}
