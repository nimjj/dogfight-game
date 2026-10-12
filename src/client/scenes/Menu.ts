import Phaser from 'phaser';
import { MenuNav } from '../input/MenuNav.ts';
import { sfx } from '../render/Audio.ts';
import { H, state, W } from '../state.ts';
import type { Mode } from '../state.ts';
import { C, makeText } from '../ui.ts';

interface Item {
  label: string;
  mode: Mode;
  note: string;
}

export const REJOIN_KEY = 'dogfight-coop-rejoin';

export class MenuScene extends Phaser.Scene {
  private nav!: MenuNav;
  private sel = 0;
  private items: Item[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private jet!: Phaser.GameObjects.Image;
  private trail!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.sky);
    state.net?.close();
    state.net = null;

    this.items = [
      { label: 'SOLO', mode: 'solo', note: 'Fly alone against endless waves.' },
      { label: 'HOST CO-OP', mode: 'host', note: 'Open a room and share the 4-letter code.' },
      { label: 'JOIN CO-OP', mode: 'join', note: 'Enter a friend’s room code.' },
    ];
    if (sessionStorage.getItem(REJOIN_KEY)) {
      this.items.push({ label: 'REJOIN MATCH', mode: 'rejoin', note: 'Reconnect to the match you were in.' });
    }
    this.sel = 0;

    this.add.image(W - 200, 130, 'sun').setScale(1.1);
    for (const [cx, cy] of [[110, 110], [210, 330], [1080, 360], [1130, 520], [90, 560]] as const) {
      this.add.image(cx, cy, 'cloud').setAlpha(0.8);
    }
    this.trail = this.add.graphics();
    this.jet = this.add.image(-60, 520, 'plane').setTint(C.light).setScale(1.6);

    makeText(this, W / 2, 70, 'DOGFIGHT CO-OP', 64, 'center', '#e6ffc8');
    makeText(this, W / 2, 148, 'two pilots. one sky. no friendly fire.', 22, 'center');

    this.texts = this.items.map((it, i) => makeText(this, W / 2, 260 + i * 60, it.label, 38, 'center'));
    this.add.text(0, 0, '').setVisible(false);
    makeText(this, W / 2, H - 150, 'A / D  turn     W  engine     L  gun     P  missile     K  special     O  flares', 18, 'center');
    makeText(this, W / 2, H - 120, 'Gamepad: left stick, A gun, B missile, X special, Y flares', 16, 'center', C.dimHex);
    makeText(this, W / 2, H - 56, 'W / S choose     ENTER confirm', 16, 'center', C.dimHex);

    this.nav = new MenuNav(this);
    this.items.forEach((_, i) => {
      const t = this.texts[i]!;
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => (this.sel = i));
      t.on('pointerup', () => this.choose());
    });
    this.refresh();
  }

  private refresh(): void {
    this.texts.forEach((t, i) => {
      const on = i === this.sel;
      t.setText(on ? `> ${this.items[i]!.label} <` : this.items[i]!.label);
      t.setColor(on ? '#ffffff' : C.textHex);
    });
  }

  private choose(): void {
    sfx.unlock();
    sfx.callout();
    const it = this.items[this.sel]!;
    state.mode = it.mode;
    if (it.mode === 'rejoin') this.scene.start('Lobby');
    else this.scene.start('PilotSelect');
  }

  update(time: number): void {
    const n = this.nav.poll();
    if (n.dy !== 0) {
      this.sel = (this.sel + n.dy + this.items.length) % this.items.length;
      sfx.hit();
      this.refresh();
    }
    if (n.ok) this.choose();

    // a jet drifts across the title screen leaving a dotted trail
    this.jet.x += 4;
    this.jet.y = 540 + Math.sin(time / 600) * 30;
    this.jet.setRotation(Math.cos(time / 600) * 0.12);
    if (this.jet.x > W + 80) this.jet.x = -80;
    this.trail.clear().fillStyle(C.light, 0.6);
    for (let i = 1; i < 18; i++) {
      const x = this.jet.x - i * 22;
      this.trail.fillCircle(x, 540 + Math.sin((time - i * 130) / 600) * 30 + 2, 3 - i * 0.13);
    }
  }
}
