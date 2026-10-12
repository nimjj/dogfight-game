import Phaser from 'phaser';
import { GROUND_Y, WORLD_W } from '../../shared/constants.ts';
import { C } from '../ui.ts';
import { H, W } from '../state.ts';

interface Cloud {
  img: Phaser.GameObjects.Image;
  bx: number;
  by: number;
  p: number;
}

/**
 * Two layers: a screen-space backdrop (sun, parallax clouds) drawn by the plain camera, and the world
 * dressing (ground, hills, arena edges) that lives in world coordinates.
 */
export class Background {
  private sun: Phaser.GameObjects.Image;
  private clouds: Cloud[] = [];

  constructor(scene: Phaser.Scene, bgLayer: Phaser.GameObjects.Layer, worldLayer: Phaser.GameObjects.Layer) {
    this.sun = scene.add.image(240, 120, 'sun');
    bgLayer.add(this.sun);
    for (let i = 0; i < 8; i++) {
      const img = scene.add.image(0, 0, 'cloud');
      const p = 0.12 + (i % 4) * 0.09;
      img.setScale(0.6 + p * 1.6).setAlpha(0.9);
      bgLayer.add(img);
      this.clouds.push({ img, bx: (i * 937) % 2600, by: 60 + ((i * 211) % 560), p });
    }

    const g = scene.add.graphics();
    // ground and hill silhouettes
    g.fillStyle(C.mid, 1).fillRect(-1500, GROUND_Y, WORLD_W + 3000, 900);
    g.fillStyle(C.bright, 1);
    g.beginPath();
    g.moveTo(-1500, GROUND_Y);
    for (let x = -1500; x <= WORLD_W + 1500; x += 30) {
      const h = Math.max(0, Math.sin(x * 0.0042) * 46 + Math.sin(x * 0.0131) * 26 + Math.sin(x * 0.037) * 10 + 14);
      g.lineTo(x, GROUND_Y - h);
    }
    g.lineTo(WORLD_W + 1500, GROUND_Y);
    g.closePath();
    g.fillPath();
    g.lineStyle(4, C.light, 1).lineBetween(-1500, GROUND_Y, WORLD_W + 1500, GROUND_Y);
    // arena edges
    g.lineStyle(3, C.light, 0.28);
    for (let y = 0; y < GROUND_Y; y += 36) {
      g.lineBetween(0, y, 0, y + 18);
      g.lineBetween(WORLD_W, y, WORLD_W, y + 18);
    }
    for (let x = 0; x < WORLD_W; x += 36) g.lineBetween(x, 0, x + 18, 0);
    g.setDepth(0);
    worldLayer.add(g);
  }

  /** Position the backdrop for the world camera centre (cx, cy). */
  update(cx: number, cy: number): void {
    this.sun.setPosition(220 - cx * 0.01 + 900 * 0, 110 - (cy - 700) * 0.02);
    for (const c of this.clouds) {
      const span = W + 400;
      let sx = (c.bx - cx * c.p) % span;
      if (sx < 0) sx += span;
      c.img.setPosition(sx - 200, c.by - (cy - 700) * c.p * 0.5);
    }
    void H;
  }
}
