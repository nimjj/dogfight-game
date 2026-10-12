import Phaser from 'phaser';
import type { Snapshot } from '../../shared/protocol.ts';
import type { SimEvent } from '../../shared/types.ts';
import { C } from '../ui.ts';
import { sfx } from './Audio.ts';

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

/** Trails, explosions, rings and beams, plus the sound that goes with each gameplay event. */
export class Effects {
  private parts: Particle[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private g: Phaser.GameObjects.Graphics;
  private trailAt = new Map<number, number>();
  private frame = 0;
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Layer;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.layer = layer;
    this.g = scene.add.graphics().setDepth(9);
    layer.add(this.g);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, s0: number, s1: number, tint: number, a0 = 1): void {
    if (this.parts.length > 700) return;
    let img = this.pool.pop();
    if (!img) {
      img = this.scene.add.image(0, 0, 'dot');
      this.layer.add(img);
    }
    img.setPosition(x, y).setTint(tint).setAlpha(a0).setScale(s0).setVisible(true).setDepth(8);
    this.parts.push({ img, vx, vy, life, max: life, s0, s1, a0 });
  }

  private explosion(x: number, y: number, size: number): void {
    const n = Math.round(14 * size);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const sp = 60 + Math.random() * 240 * size;
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 1.2 * size, 0.1, i % 3 ? C.light : C.bright);
    }
    for (let i = 0; i < 6; i++) {
      this.spawn(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40, -20 - Math.random() * 40, 1.1, 2 * size, 3 * size, 0x2b3a2e, 0.7);
    }
    this.rings.push({ x, y, r: 70 * size, life: 0.35, max: 0.35 });
  }

  handle(ev: SimEvent, camX: number, camY: number): void {
    const vol = (x: number, y: number) => Math.max(0.12, 1 - Math.hypot(x - camX, y - camY) / 2200);
    switch (ev.t) {
      case 'explosion':
        this.explosion(ev.x, ev.y, ev.size);
        sfx.explosion(vol(ev.x, ev.y) * Math.min(1.4, ev.size));
        break;
      case 'hit':
        for (let i = 0; i < 4; i++) {
          this.spawn(ev.x, ev.y, (Math.random() - 0.5) * 260, (Math.random() - 0.5) * 260, 0.25, 0.8, 0.1, 0xffffff);
        }
        sfx.hit(vol(ev.x, ev.y));
        break;
      case 'shot':
        sfx.shot(vol(ev.x, ev.y));
        break;
      case 'missile':
        sfx.missile(vol(ev.x, ev.y));
        break;
      case 'flare':
        sfx.flare(vol(ev.x, ev.y));
        break;
      case 'beam':
        this.beams.push({ x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, life: 0.25 });
        sfx.special();
        break;
      case 'emp':
        this.rings.push({ x: ev.x, y: ev.y, r: ev.r, life: 0.5, max: 0.5 });
        sfx.special();
        break;
      default:
        break;
    }
  }

  /** Spawn trails for the current frame and advance every live particle. */
  update(dt: number, v: Snapshot | null, timeMs: number): void {
    this.frame++;
    if (v) {
      for (const m of v.missiles) {
        this.spawn(m.x, m.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.7, 1.1, 2.2, m.team === 0 ? 0xe8ffc8 : 0x2b3a2e, 0.55);
      }
      const seen = new Set<number>();
      for (const p of v.planes) {
        seen.add(p.id);
        const last = this.trailAt.get(p.id) ?? 0;
        if (timeMs - last > 70) {
          this.trailAt.set(p.id, timeMs);
          const bx = p.x - Math.cos(p.heading) * 24;
          const by = p.y - Math.sin(p.heading) * 24;
          this.spawn(bx, by, 0, 0, 0.9, 0.55, 0.15, p.team === 0 ? C.light : C.bright, 0.7);
          if (p.hp < p.maxHp * 0.4) this.spawn(bx, by, (Math.random() - 0.5) * 30, -30, 0.8, 1, 2, 0x2b3a2e, 0.6);
        }
      }
      for (const id of this.trailAt.keys()) if (!seen.has(id)) this.trailAt.delete(id);
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i] as Particle;
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.pool.push(p.img);
        this.parts.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.img.setScale(p.s0 + (p.s1 - p.s0) * k).setAlpha(p.a0 * (1 - k));
    }

    this.g.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i] as Ring;
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.max;
      this.g.lineStyle(4, C.light, 1 - k).strokeCircle(r.x, r.y, r.r * (0.2 + 0.8 * k));
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i] as Beam;
      b.life -= dt;
      if (b.life <= 0) {
        this.beams.splice(i, 1);
        continue;
      }
      this.g.lineStyle(10 * (b.life / 0.25) + 2, 0xffffff, b.life / 0.25).lineBetween(b.x1, b.y1, b.x2, b.y2);
    }
  }
}
