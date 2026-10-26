/**
 * Sound effects synthesised with the Web Audio API — no audio files, nothing downloaded.
 * Footsteps per surface, jump / land, UI clicks, info-panel chime, soft hall ambience and
 * occasional air-hockey puck clacks near the tables. Starts only after a user gesture.
 */
export type Surface = "tile" | "stairs" | "carpet" | "street" | "wood";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: { stop: () => void } | null = null;
  private enabled = true;
  private volume = 0.7;

  /** Call from a click/tap handler (browsers block audio before a gesture). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  pause() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === "running" && this.enabled;
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Filtered noise burst. */
  private burst(opts: { freq: number; q?: number; type?: BiquadFilterType; gain: number; attack?: number; decay: number; at?: number; rate?: number }) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = opts.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + opts.decay + 0.05);
  }

  /** Short pitched tone. */
  private tone(freq: number, opts: { gain: number; decay: number; type?: OscillatorType; at?: number; slideTo?: number }) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? "sine";
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + opts.decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + opts.decay + 0.05);
  }

  step(surface: Surface, running: boolean) {
    const k = running ? 1.25 : 1;
    const jitter = 0.85 + Math.random() * 0.3;
    switch (surface) {
      case "stairs": // open steel treads: a dull metallic knock
        this.burst({ freq: 900 * jitter, q: 6, gain: 0.22 * k, decay: 0.12 });
        this.tone(190 * jitter, { gain: 0.08 * k, decay: 0.09, type: "triangle" });
        break;
      case "carpet":
        this.burst({ freq: 380 * jitter, q: 0.8, type: "lowpass", gain: 0.08 * k, decay: 0.07 });
        break;
      case "street":
        this.burst({ freq: 1600 * jitter, q: 0.7, gain: 0.12 * k, decay: 0.09, rate: 0.7 });
        break;
      case "wood":
        this.burst({ freq: 600 * jitter, q: 2, gain: 0.14 * k, decay: 0.08 });
        break;
      default: // glossy ceramic tiles: short click
        this.burst({ freq: 2400 * jitter, q: 1.4, gain: 0.11 * k, decay: 0.05 });
        this.burst({ freq: 500, q: 0.7, type: "lowpass", gain: 0.06 * k, decay: 0.05 });
    }
  }

  jump() {
    this.burst({ freq: 700, q: 0.6, gain: 0.08, attack: 0.03, decay: 0.22, rate: 1.4 });
  }

  land(strength: number) {
    const s = Math.min(1, strength);
    this.burst({ freq: 260, q: 0.7, type: "lowpass", gain: 0.25 * s + 0.05, decay: 0.16 });
  }

  click() {
    this.tone(1250, { gain: 0.06, decay: 0.05, type: "triangle" });
  }

  openPanel() {
    this.tone(660, { gain: 0.07, decay: 0.18 });
    this.tone(990, { gain: 0.06, decay: 0.25, at: 0.07 });
  }

  closePanel() {
    this.tone(740, { gain: 0.05, decay: 0.12, slideTo: 520 });
  }

  // ── mini-games
  /** Mallet / puck hit; v = speed (0..5). */
  hockeyHit(v: number) {
    const k = Math.min(1, v / 4);
    this.tone(1300 + k * 600, { gain: 0.05 + 0.1 * k, decay: 0.04, type: "square" });
    this.burst({ freq: 3000, q: 1.2, gain: 0.06 + 0.08 * k, decay: 0.04 });
  }

  hockeyWall(v: number) {
    const k = Math.min(1, v / 4);
    this.burst({ freq: 1800, q: 2, gain: 0.04 + 0.07 * k, decay: 0.05 });
  }

  /** Goal horn: rising for the player, falling for the computer. */
  goal(good: boolean) {
    const notes = good ? [523, 659, 784, 1047] : [440, 370, 311];
    notes.forEach((f, i) => this.tone(f, { gain: 0.08, decay: 0.22, type: "triangle", at: i * 0.11 }));
  }

  /** Bucket biting into the soil. */
  dig() {
    this.burst({ freq: 240, q: 0.8, type: "lowpass", gain: 0.12, decay: 0.12, rate: 0.6 });
  }

  /** Soil pouring (call a few times per second while pouring). */
  pour() {
    this.burst({ freq: 1400, q: 0.5, gain: 0.05, attack: 0.03, decay: 0.25, rate: 0.5 });
  }

  /** Hydraulics straining against a limit. */
  blocked() {
    this.tone(120, { gain: 0.05, decay: 0.12, type: "sawtooth" });
  }

  /** Foot hitting the white football (0..1). */
  footKick(power: number) {
    this.burst({ freq: 320, q: 0.9, type: "lowpass", gain: 0.12 + 0.18 * power, decay: 0.12 });
    this.tone(150, { gain: 0.06 + 0.06 * power, decay: 0.1, type: "triangle" });
  }

  /** Two footballs knocking together. */
  footBall(v: number) {
    const k = Math.min(1, v / 4);
    this.burst({ freq: 700, q: 1.2, gain: 0.05 + 0.1 * k, decay: 0.07 });
  }

  /** Ball dropping into a pocket. */
  pocket() {
    this.burst({ freq: 260, q: 0.8, type: "lowpass", gain: 0.16, decay: 0.2 });
    this.tone(660, { gain: 0.06, decay: 0.2, at: 0.08 });
    this.tone(880, { gain: 0.05, decay: 0.25, at: 0.16 });
  }

  truckHorn() {
    this.tone(392, { gain: 0.07, decay: 0.3, type: "square" });
    this.tone(392, { gain: 0.07, decay: 0.35, type: "square", at: 0.38 });
  }

  /** Controller challenge: right button (pitch climbs with the streak). */
  padHit(combo: number) {
    this.tone(660 * 2 ** (Math.min(combo, 24) / 24), { gain: 0.07, decay: 0.09, type: "triangle" });
  }

  /** Controller challenge: wrong button / too late. */
  padMiss() {
    this.tone(180, { gain: 0.07, decay: 0.18, type: "sawtooth", slideTo: 120 });
  }

  countdown(last: boolean) {
    this.tone(last ? 1175 : 784, { gain: 0.08, decay: last ? 0.35 : 0.15 });
  }

  /** Match result jingle. */
  result(won: boolean) {
    const notes = won ? [523, 659, 784, 1047, 1319] : [392, 349, 330, 262];
    notes.forEach((f, i) => this.tone(f, { gain: 0.07, decay: 0.28, type: "triangle", at: i * 0.13 }));
  }

  /** Air-hockey puck clacks, louder when closer (0..1). */
  puck(near: number) {
    if (near <= 0.02) return;
    this.tone(2100 + Math.random() * 500, { gain: 0.05 * near, decay: 0.03, type: "square" });
    if (Math.random() < 0.5) this.tone(1700 + Math.random() * 400, { gain: 0.04 * near, decay: 0.03, type: "square", at: 0.09 + Math.random() * 0.1 });
  }

  /** Very soft room tone (filtered noise loop). */
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.ambient = {
      stop: () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      },
    };
  }

  stopAmbient() {
    this.ambient?.stop();
    this.ambient = null;
  }
}

export const audio = new AudioManager();
