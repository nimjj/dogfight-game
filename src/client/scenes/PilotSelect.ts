import Phaser from 'phaser';
import { PILOTS, PILOT_IDS } from '../../shared/config/pilots.ts';
import { SPECIALS, SPECIAL_IDS } from '../../shared/config/specials.ts';
import { MenuNav } from '../input/MenuNav.ts';
import { sfx } from '../render/Audio.ts';
import { H, state, W } from '../state.ts';
import { C, makeText, panel } from '../ui.ts';

/** Two steps: choose a pilot (perk), then the special weapon that charges from kills. */
export class PilotSelectScene extends Phaser.Scene {
  private nav!: MenuNav;
  private phase: 0 | 1 = 0;
  private pilotIdx = 0;
  private specialIdx = 0;
  private g!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private names: Phaser.GameObjects.Text[] = [];
  private desc!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private portraits: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('PilotSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.bgDark);
    this.phase = 0;
    this.pilotIdx = Math.max(0, PILOT_IDS.indexOf(state.pilot));
    this.specialIdx = Math.max(0, SPECIAL_IDS.indexOf(state.special));
    this.nav = new MenuNav(this);

    this.title = makeText(this, W / 2, 36, 'SELECT PILOT', 44, 'center', '#e6ffc8');
    panel(this, 256, 120, 768, 330);
    this.g = this.add.graphics();
    this.portraits = PILOT_IDS.map((id, i) => this.add.image(384 + i * 256 - 128 + 128, 270, `portrait_${id}`).setScale(1.7));
    this.portraits.forEach((p, i) => {
      p.x = 384 + i * 256;
    });
    this.names = PILOT_IDS.map((id, i) => makeText(this, 384 + i * 256, 360, PILOTS[id].name, 24, 'center'));
    panel(this, 256, 480, 768, 100);
    this.desc = makeText(this, 276, 496, '', 22);
    this.desc.setWordWrapWidth(730);
    this.hint = makeText(this, W - 56, H - 56, '', 18, 'right');
    this.refresh();
  }

  private refresh(): void {
    const g = this.g;
    g.clear();
    if (this.phase === 0) {
      this.title.setText('SELECT PILOT');
      this.portraits.forEach((p, i) => {
        p.setVisible(true);
        const id = PILOT_IDS[i]!;
        p.setTexture(`portrait_${id}`).setAlpha(i === this.pilotIdx ? 1 : 0.55);
        this.names[i]!.setText(PILOTS[id].name).setColor(i === this.pilotIdx ? '#ffffff' : C.textHex);
      });
      const x = 384 + this.pilotIdx * 256;
      g.lineStyle(4, 0xffffff, 1).strokeRect(x - 86, 184, 172, 172);
      this.desc.setText(PILOTS[PILOT_IDS[this.pilotIdx]!].blurb);
      this.hint.setText('A / D choose    ENTER confirm    ESC back');
    } else {
      this.title.setText('SELECT SPECIAL WEAPON');
      this.portraits.forEach((p) => p.setVisible(false));
      SPECIAL_IDS.forEach((id, i) => {
        const on = i === this.specialIdx;
        this.names[i]!.setText(SPECIALS[id].name).setColor(on ? '#ffffff' : C.textHex).setY(250);
        if (on) g.lineStyle(4, 0xffffff, 1).strokeRect(384 + i * 256 - 110, 200, 220, 110);
      });
      this.desc.setText(`${SPECIALS[SPECIAL_IDS[this.specialIdx]!].blurb}\nCharges as you score kills. Press K to fire it when full.`);
      this.hint.setText('A / D choose    ENTER start    ESC back');
    }
  }

  update(): void {
    const n = this.nav.poll();
    const count = this.phase === 0 ? PILOT_IDS.length : SPECIAL_IDS.length;
    if (n.dx !== 0) {
      if (this.phase === 0) this.pilotIdx = (this.pilotIdx + n.dx + count) % count;
      else this.specialIdx = (this.specialIdx + n.dx + count) % count;
      sfx.hit();
      this.refresh();
    }
    if (n.ok) {
      sfx.unlock();
      sfx.callout();
      if (this.phase === 0) {
        state.pilot = PILOT_IDS[this.pilotIdx]!;
        this.phase = 1;
        this.names.forEach((t, i) => t.setX(384 + i * 256));
        this.refresh();
      } else {
        state.special = SPECIAL_IDS[this.specialIdx]!;
        this.scene.start(state.mode === 'solo' ? 'Game' : 'Lobby');
      }
    }
    if (n.back) {
      if (this.phase === 1) {
        this.phase = 0;
        this.names.forEach((t) => t.setY(360));
        this.refresh();
      } else this.scene.start('Menu');
    }
  }
}
