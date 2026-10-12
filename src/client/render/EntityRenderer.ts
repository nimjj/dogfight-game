import Phaser from 'phaser';
import type { Snapshot } from '../../shared/protocol.ts';

type Img = Phaser.GameObjects.Image;

const PLAYER_TINT = [0xa8e66e, 0xf0ffcc];

/** Draws a snapshot with pooled sprites keyed by entity id, so nothing is allocated per shot. */
export class EntityRenderer {
  private planes = new Map<number, Img>();
  private bullets = new Map<number, Img>();
  private missiles = new Map<number, Img>();
  private flares = new Map<number, Img>();
  private free: Img[] = [];
  private scene: Phaser.Scene;
  private layer: Phaser.GameObjects.Layer;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.layer = layer;
  }

  private get(map: Map<number, Img>, seen: Set<number>, id: number, tex: string, depth: number): Img {
    seen.add(id);
    let s = map.get(id);
    if (!s) {
      s = this.free.pop();
      if (!s) {
        s = this.scene.add.image(0, 0, tex);
        this.layer.add(s);
      }
      s.setTexture(tex).setVisible(true).setActive(true).clearTint().setAlpha(1).setFlipY(false).setScale(1);
      s.setDepth(depth);
      map.set(id, s);
    }
    return s;
  }

  private sweep(map: Map<number, Img>, seen: Set<number>): void {
    for (const [id, s] of map) {
      if (!seen.has(id)) {
        s.setVisible(false).setActive(false);
        this.free.push(s);
        map.delete(id);
      }
    }
  }

  render(v: Snapshot, timeMs: number): void {
    const seenP = new Set<number>();
    for (const p of v.planes) {
      const tex = p.kind === 'player' ? 'plane' : `enemy_${p.kind}`;
      const s = this.get(this.planes, seenP, p.id, tex, p.team === 0 ? 6 : 5);
      s.setPosition(p.x, p.y).setRotation(p.heading).setFlipY(Math.cos(p.heading) < 0);
      if (p.kind === 'player') s.setTint(PLAYER_TINT[p.slot] ?? 0xa8e66e);
      s.setAlpha(p.invuln > 0 ? (Math.floor(timeMs / 90) % 2 ? 0.35 : 1) : p.stun > 0 ? 0.6 : 1);
      if (p.stun > 0) s.setTint(0x888888);
    }
    this.sweep(this.planes, seenP);

    const seenB = new Set<number>();
    for (const b of v.bullets) {
      const s = this.get(this.bullets, seenB, b.id, b.team === 0 ? 'bullet' : 'ebullet', 4);
      s.setPosition(b.x, b.y);
      if (b.team === 0) s.setRotation(Math.atan2(b.vy, b.vx));
    }
    this.sweep(this.bullets, seenB);

    const seenM = new Set<number>();
    for (const m of v.missiles) {
      const s = this.get(this.missiles, seenM, m.id, m.team === 0 ? 'missile' : 'emissile', 4);
      s.setPosition(m.x, m.y).setRotation(m.heading);
    }
    this.sweep(this.missiles, seenM);

    const seenF = new Set<number>();
    for (const f of v.flares) {
      const s = this.get(this.flares, seenF, f.id, 'flare', 3);
      s.setPosition(f.x, f.y);
      s.setAlpha(0.6 + 0.4 * Math.sin(timeMs / 40 + f.id));
    }
    this.sweep(this.flares, seenF);
  }

  planeSprite(id: number): Img | undefined {
    return this.planes.get(id);
  }
}
