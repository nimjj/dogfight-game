import Phaser from 'phaser';
import type { PilotId } from '../../shared/config/pilots.ts';
import { C } from '../ui.ts';

type Pt = { x: number; y: number };

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function poly(g: Phaser.GameObjects.Graphics, pts: Pt[], fill: number, line: number, lw = 2): void {
  g.fillStyle(fill, 1).fillPoints(pts, true);
  g.lineStyle(lw, line, 1).strokePoints(pts, true);
}

/** Every sprite is drawn in code, so the game ships with no image files. Planes face right. */
export function generateTextures(scene: Phaser.Scene): void {
  const body: Pt[] = [
    { x: 46, y: 16 }, { x: 38, y: 12 }, { x: 24, y: 11 }, { x: 15, y: 4 }, { x: 8, y: 4 },
    { x: 10, y: 11 }, { x: 3, y: 12 }, { x: 3, y: 18 }, { x: 10, y: 19 }, { x: 24, y: 21 }, { x: 38, y: 20 },
  ];
  const wing: Pt[] = [{ x: 28, y: 14 }, { x: 14, y: 29 }, { x: 8, y: 29 }, { x: 18, y: 14 }];

  // player planes (tinted per slot at runtime)
  make(scene, 'plane', 50, 32, (g) => {
    poly(g, wing, 0xcfeea0, 0x2b3a2e);
    poly(g, body, 0xffffff, 0x2b3a2e);
    g.fillStyle(0x2b3a2e, 1).fillRect(30, 13, 7, 3);
  });

  // enemy fighter: dark fill, bright outline so it reads as hostile
  make(scene, 'enemy_fighter', 50, 32, (g) => {
    poly(g, wing, 0x1f2b21, C.bright);
    poly(g, body, 0x1f2b21, C.bright);
    g.fillStyle(C.bright, 1).fillRect(30, 13, 7, 3);
  });

  make(scene, 'enemy_carrier', 74, 40, (g) => {
    const fuselage: Pt[] = [
      { x: 72, y: 20 }, { x: 60, y: 14 }, { x: 24, y: 13 }, { x: 14, y: 4 }, { x: 5, y: 4 },
      { x: 8, y: 13 }, { x: 2, y: 14 }, { x: 2, y: 26 }, { x: 8, y: 27 }, { x: 24, y: 28 }, { x: 60, y: 27 },
    ];
    poly(g, [{ x: 44, y: 20 }, { x: 22, y: 38 }, { x: 12, y: 38 }, { x: 26, y: 20 }], 0x1f2b21, C.bright);
    poly(g, fuselage, 0x1f2b21, C.bright);
    g.fillStyle(C.bright, 1).fillRect(46, 17, 10, 4);
    g.fillRect(30, 22, 6, 2);
  });

  make(scene, 'enemy_ace', 54, 30, (g) => {
    const sleek: Pt[] = [
      { x: 52, y: 15 }, { x: 40, y: 11 }, { x: 22, y: 10 }, { x: 10, y: 2 }, { x: 4, y: 2 },
      { x: 8, y: 10 }, { x: 2, y: 12 }, { x: 2, y: 18 }, { x: 8, y: 20 }, { x: 22, y: 20 }, { x: 40, y: 19 },
    ];
    poly(g, [{ x: 34, y: 15 }, { x: 14, y: 28 }, { x: 6, y: 28 }, { x: 22, y: 15 }], 0x1f2b21, C.light);
    poly(g, sleek, 0x1f2b21, C.light);
    g.fillStyle(C.light, 1).fillRect(34, 13, 8, 3);
  });

  make(scene, 'bullet', 10, 4, (g) => {
    g.fillStyle(C.light, 1).fillRect(0, 0, 10, 4);
  });
  make(scene, 'ebullet', 10, 10, (g) => {
    g.fillStyle(0x1f2b21, 1).fillCircle(5, 5, 5);
    g.lineStyle(2, C.light, 1).strokeCircle(5, 5, 4);
  });
  make(scene, 'missile', 22, 8, (g) => {
    poly(g, [{ x: 22, y: 4 }, { x: 16, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 8 }, { x: 4, y: 7 }, { x: 16, y: 7 }], 0xe8ffc8, 0x2b3a2e, 1);
  });
  make(scene, 'emissile', 22, 8, (g) => {
    poly(g, [{ x: 22, y: 4 }, { x: 16, y: 1 }, { x: 4, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 8 }, { x: 4, y: 7 }, { x: 16, y: 7 }], 0x1f2b21, C.bright, 1);
  });
  make(scene, 'flare', 12, 12, (g) => {
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 5);
    g.lineStyle(1, C.light, 1).strokeCircle(6, 6, 6);
  });
  make(scene, 'dot', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
  });
  make(scene, 'sun', 120, 120, (g) => {
    g.fillStyle(0xa8f070, 1).fillCircle(60, 60, 58);
  });
  make(scene, 'cloud', 150, 64, (g) => {
    g.fillStyle(0x6bd35a, 1);
    g.fillCircle(30, 40, 22);
    g.fillCircle(58, 28, 26);
    g.fillCircle(92, 34, 24);
    g.fillCircle(118, 42, 18);
    g.fillRect(24, 40, 100, 20);
  });

  for (const id of ['kestrel', 'bulldog', 'siren'] as PilotId[]) makePortrait(scene, id);
}

function makePortrait(scene: Phaser.Scene, id: PilotId): void {
  make(scene, `portrait_${id}`, 96, 96, (g) => {
    const skin = 0xa8e66e;
    const dark = 0x2b3a2e;
    const mid = 0x4a9d44;
    g.fillStyle(0x6bd35a, 1).fillRect(0, 0, 96, 96);
    // shoulders / flight suit
    g.fillStyle(mid, 1).fillRect(10, 74, 76, 22);
    g.fillStyle(dark, 1).fillRect(22, 80, 8, 8).fillRect(66, 80, 8, 8);
    // neck + face
    g.fillStyle(skin, 1).fillRect(40, 62, 16, 14);
    g.fillStyle(skin, 1).fillRect(26, 22, 44, 44);
    g.fillStyle(dark, 1);
    if (id === 'kestrel') {
      // bob cut with fringe
      g.fillRect(20, 14, 56, 14).fillRect(20, 14, 10, 52).fillRect(66, 14, 10, 52);
      g.fillRect(30, 28, 36, 6);
    } else if (id === 'bulldog') {
      // helmet and jaw
      g.fillStyle(mid, 1).fillRect(20, 12, 56, 20).fillRect(20, 12, 8, 40).fillRect(68, 12, 8, 40);
      g.fillStyle(dark, 1).fillRect(30, 54, 36, 6);
    } else {
      // long swept hair
      g.fillRect(18, 12, 60, 16).fillRect(14, 12, 14, 70).fillRect(68, 12, 14, 60);
      g.fillRect(30, 28, 22, 6);
    }
    // eyes + mouth
    g.fillStyle(dark, 1).fillRect(34, 42, 8, 4).fillRect(54, 42, 8, 4).fillRect(42, 56, 12, 2);
  });
}
