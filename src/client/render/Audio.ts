/** Tiny WebAudio synth so the game has sound without any audio files. Browsers only allow audio after a user gesture. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ok(key: string, minGapMs: number): boolean {
    const now = performance.now();
    if ((this.last[key] ?? 0) + minGapMs > now) return false;
    this.last[key] = now;
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const c = this.ctx;
    if (!c || this.muted || c.state !== 'running') return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private burst(dur: number, vol: number, lowpass = 1200): void {
    const c = this.ctx;
    if (!c || this.muted || c.state !== 'running') return;
    if (!this.noise) {
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lowpass, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shot(v = 1): void {
    if (this.ok('shot', 60)) this.tone(520, 0.06, 'square', 0.05 * v, 180);
  }
  missile(v = 1): void {
    if (this.ok('missile', 120)) {
      this.tone(220, 0.35, 'sawtooth', 0.07 * v, 700);
      this.burst(0.3, 0.05 * v, 3000);
    }
  }
  explosion(v = 1): void {
    if (this.ok('boom', 50)) {
      this.burst(0.5, 0.2 * v, 1400);
      this.tone(110, 0.4, 'triangle', 0.12 * v, 40);
    }
  }
  hit(v = 1): void {
    if (this.ok('hit', 50)) this.tone(300, 0.05, 'square', 0.04 * v, 120);
  }
  flare(v = 1): void {
    if (this.ok('flare', 150)) this.burst(0.25, 0.08 * v, 5000);
  }
  lock(): void {
    if (this.ok('lock', 200)) {
      this.tone(880, 0.07, 'square', 0.06);
      this.tone(1320, 0.09, 'square', 0.06, undefined, 0.08);
    }
  }
  warn(): void {
    if (this.ok('warn', 350)) this.tone(660, 0.12, 'square', 0.07);
  }
  overheat(): void {
    if (this.ok('overheat', 400)) this.tone(160, 0.3, 'sawtooth', 0.08, 70);
  }
  special(): void {
    if (this.ok('special', 200)) {
      this.tone(120, 0.7, 'sawtooth', 0.12, 900);
      this.burst(0.6, 0.12, 4000);
    }
  }
  callout(): void {
    if (this.ok('callout', 300)) {
      this.tone(660, 0.08, 'triangle', 0.07);
      this.tone(990, 0.12, 'triangle', 0.07, undefined, 0.08);
    }
  }
  respawn(): void {
    if (this.ok('respawn', 300)) this.tone(300, 0.4, 'triangle', 0.08, 900);
  }
  gameOver(): void {
    this.tone(400, 0.8, 'sawtooth', 0.1, 60);
  }
}

export const sfx = new Sfx();
