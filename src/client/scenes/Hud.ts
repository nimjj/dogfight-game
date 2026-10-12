import Phaser from 'phaser';
import { SPEED_DISPLAY_MULT } from '../../shared/constants.ts';
import { PILOTS } from '../../shared/config/pilots.ts';
import { SPECIALS, SPECIAL_CHARGE_NEEDED } from '../../shared/config/specials.ts';
import { playerStats } from '../../shared/sim/stats.ts';
import type { GameScene } from './Game.ts';
import { H, W } from '../state.ts';
import { C, makeText, setIfChanged } from '../ui.ts';

type T = Phaser.GameObjects.Text;

interface Callout {
  text: string;
  age: number;
}

/** Screen-space overlay drawn by its own scene so camera zoom and shake never move the UI. */
export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private score!: T;
  private mult!: T;
  private lives!: T;
  private wave!: T;
  private speedL!: T;
  private speedV!: T;
  private altL!: T;
  private altV!: T;
  private heatL!: T;
  private special!: T;
  private ammo!: T;
  private mate!: T;
  private status!: T;
  private center!: T;
  private warn!: T;
  private callTexts: T[] = [];
  private callouts: Callout[] = [];
  private onCallout = (text: string) => {
    this.callouts.push({ text, age: 0 });
    if (this.callouts.length > 3) this.callouts.shift();
  };

  constructor() {
    super('Hud');
  }

  create(): void {
    // Phaser reuses this scene object on restart, so drop references to the previous run's destroyed texts.
    this.callouts = [];
    this.callTexts = [];
    this.g = this.add.graphics();
    this.score = makeText(this, W - 24, 18, '000000', 30, 'right');
    this.mult = makeText(this, W - 24, 56, 'x1', 40, 'right');
    this.lives = makeText(this, 24, 18, '', 22);
    this.wave = makeText(this, W / 2, 18, '', 22, 'center');
    this.speedL = makeText(this, 60, 322, 'SPEED', 22);
    this.speedV = makeText(this, 64, 348, '0', 20);
    this.altL = makeText(this, W - 60, 322, 'ALT', 22, 'right');
    this.altV = makeText(this, W - 64, 348, '0', 20, 'right');
    this.heatL = makeText(this, W - 24, H - 138, 'GUN TEMP', 14, 'right');
    this.ammo = makeText(this, W - 24, H - 62, '', 16, 'right');
    this.special = makeText(this, W - 24, H - 40, '', 16, 'right');
    this.status = makeText(this, 24, H - 90, '', 18);
    this.mate = makeText(this, 24, H - 62, '', 16);
    this.center = makeText(this, W / 2, 110, '', 26, 'center', '#ffffff');
    this.warn = makeText(this, W / 2, 150, 'MISSILE!', 30, 'center', '#ffffff').setVisible(false);
    for (let i = 0; i < 3; i++) this.callTexts.push(makeText(this, W / 2, H - 150 + i * 34, '', 26, 'center'));

    this.game.events.on('callout', this.onCallout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('callout', this.onCallout));
  }

  update(_t: number, delta: number): void {
    const gs = this.scene.get('Game') as unknown as GameScene;
    const v = gs.view;
    const g = this.g;
    g.clear();

    setIfChanged(this.center, gs.notice);
    if (!v) return;

    const me = v.planes.find((p) => p.kind === 'player' && p.slot === gs.localSlot);
    const mePl = v.players.find((p) => p.slot === gs.localSlot);
    const coop = v.players.length > 1;

    setIfChanged(this.score, String(v.score).padStart(6, '0'));
    setIfChanged(this.mult, `x${mePl?.mult ?? 1}`);
    setIfChanged(this.lives, `LIVES ${v.lives}`);
    setIfChanged(
      this.wave,
      v.waveState === 'active' ? `WAVE ${v.wave}   ENEMIES ${v.enemiesLeft}` : `WAVE ${v.wave + 1} IN ${Math.ceil(v.nextWaveIn)}`,
    );

    // flight readouts (frame boxes like the original's instrument tags)
    g.lineStyle(2, C.light, 1);
    g.strokeRect(60, 346, 80, 24).strokeRect(W - 140, 346, 80, 24);
    setIfChanged(this.speedV, String(me ? Math.round(me.speed * SPEED_DISPLAY_MULT) : 0));
    setIfChanged(this.altV, String(me ? Math.max(0, Math.round((1880 - me.y) * 0.9)) : 0));

    if (me && mePl) {
      const st = playerStats(mePl.pilot);
      // gun heat
      const bx = W - 24 - 140;
      g.lineStyle(2, C.light, 1).strokeRect(bx, H - 118, 140, 12);
      g.fillStyle(me.overheated ? 0xffffff : C.light, 1).fillRect(bx + 2, H - 116, 136 * me.heat, 8);
      setIfChanged(this.heatL, me.overheated ? 'OVERHEATED' : 'GUN TEMP');
      // missiles and flares as little icons
      for (let i = 0; i < st.missileMax; i++) {
        const x = W - 30 - i * 16;
        g.fillStyle(C.light, i < me.missiles ? 1 : 0.2).fillRect(x - 5, H - 100, 5, 22).fillTriangle(x - 5, H - 100, x, H - 100, x - 2.5, H - 107);
      }
      setIfChanged(this.ammo, `FLARES ${'o'.repeat(me.flares)}`);
      // special charge
      const ready = me.special >= SPECIAL_CHARGE_NEEDED;
      setIfChanged(this.special, ready ? `[K] ${SPECIALS[mePl.special].name} READY` : `${SPECIALS[mePl.special].name} ${me.special}%`);
      this.special.setColor(ready ? '#ffffff' : C.textHex);
      // hull
      g.lineStyle(2, C.light, 1).strokeRect(24, H - 112, 180, 14);
      g.fillStyle(me.hp / me.maxHp < 0.35 ? 0xffffff : C.light, 1).fillRect(26, H - 110, 176 * (me.hp / me.maxHp), 10);
      setIfChanged(this.status, `${PILOTS[mePl.pilot].name.toUpperCase()}  HULL`);
    } else if (mePl) {
      this.heatL.setText('');
      setIfChanged(this.ammo, '');
      setIfChanged(this.special, '');
      setIfChanged(
        this.status,
        mePl.out ? 'OUT OF LIVES - SPECTATING' : `SHOT DOWN - RESPAWN IN ${Math.ceil(mePl.respawnIn)}`,
      );
    }

    // teammate status
    const mate = v.players.find((p) => p.slot !== gs.localSlot);
    if (coop && mate) {
      const mp = v.planes.find((p) => p.kind === 'player' && p.slot === mate.slot);
      const name = PILOTS[mate.pilot].name.toUpperCase();
      let line: string;
      if (!mate.connected) line = `${name}: DISCONNECTED`;
      else if (mate.out) line = `${name}: OUT`;
      else if (!mp) line = `${name}: DOWN (${Math.ceil(mate.respawnIn)}s)`;
      else line = `${name}  ${Math.round((mp.hp / mp.maxHp) * 100)}%  x${mate.mult}`;
      setIfChanged(this.mate, line);
    } else setIfChanged(this.mate, '');

    // missile warning
    const flash = Math.floor(performance.now() / 150) % 2 === 0;
    this.warn.setVisible(gs.warning && flash);

    // callouts fade out
    for (const c of this.callouts) c.age += delta / 1000;
    this.callouts = this.callouts.filter((c) => c.age < 2);
    this.callTexts.forEach((t, i) => {
      const c = this.callouts[this.callouts.length - 1 - i];
      setIfChanged(t, c ? c.text : '');
      t.setAlpha(c ? Math.min(1, 2 - c.age) : 0);
    });

    this.drawArrows(gs, v, me);
  }

  /** Edge-of-screen pointers to enemies and the teammate that are outside the camera view. */
  private drawArrows(gs: GameScene, v: NonNullable<GameScene['view']>, me: { x: number; y: number } | undefined): void {
    const cam = gs.worldCam;
    const wv = cam.worldView;
    const z = cam.zoom;
    const g = this.g;
    const margin = 46;
    const cx = W / 2;
    const cy = H / 2;
    const items: { sx: number; sy: number; mate: boolean; d: number }[] = [];
    for (const p of v.planes) {
      const isMine = p.kind === 'player' && p.slot === gs.localSlot;
      if (isMine) continue;
      const sx = (p.x - wv.centerX) * z + cx;
      const sy = (p.y - wv.centerY) * z + cy;
      if (sx > margin && sx < W - margin && sy > margin && sy < H - margin) continue;
      const d = me ? Math.hypot(p.x - me.x, p.y - me.y) : 0;
      items.push({ sx, sy, mate: p.kind === 'player', d });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items.slice(0, 8)) {
      const dx = it.sx - cx;
      const dy = it.sy - cy;
      const t = Math.min((cx - margin) / Math.abs(dx || 1e-6), (cy - margin) / Math.abs(dy || 1e-6));
      const x = cx + dx * t;
      const y = cy + dy * t;
      const a = Math.atan2(dy, dx);
      if (it.mate) {
        g.fillStyle(C.light, 1).fillCircle(x, y, 9);
        g.lineStyle(3, 0xffffff, 1).strokeCircle(x, y, 13);
      } else {
        const s = 10;
        const pts = [
          { x: x + Math.cos(a) * s * 1.4, y: y + Math.sin(a) * s * 1.4 },
          { x: x + Math.cos(a + 2.5) * s, y: y + Math.sin(a + 2.5) * s },
          { x: x + Math.cos(a - 2.5) * s, y: y + Math.sin(a - 2.5) * s },
        ];
        g.lineStyle(3, C.light, 0.9).strokePoints(pts, true);
      }
    }
  }
}
