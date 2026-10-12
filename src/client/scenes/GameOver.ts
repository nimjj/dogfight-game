import Phaser from 'phaser';
import { MenuNav } from '../input/MenuNav.ts';
import { sfx } from '../render/Audio.ts';
import { REJOIN_KEY } from './Menu.ts';
import { H, state, W } from '../state.ts';
import { C, makeText, panel } from '../ui.ts';

export class GameOverScene extends Phaser.Scene {
  private nav!: MenuNav;

  constructor() {
    super('GameOver');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.bgDark);
    this.nav = new MenuNav(this);
    sessionStorage.removeItem(REJOIN_KEY);
    state.net?.close();
    state.net = null;

    const l = state.last;
    makeText(this, W / 2, 70, 'GAME OVER', 72, 'center', '#e6ffc8');
    panel(this, 380, 190, 520, 270);
    makeText(this, W / 2, 220, `SCORE   ${String(l.score).padStart(6, '0')}`, 38, 'center', '#ffffff');
    makeText(this, W / 2, 290, `WAVE REACHED   ${l.wave}`, 26, 'center');
    makeText(this, W / 2, 335, l.coop ? `TEAM KILLS   ${l.kills}` : `KILLS   ${l.kills}`, 26, 'center');
    makeText(this, W / 2, 380, l.coop ? 'Nice teamwork, pilots.' : 'Fly again?', 22, 'center', C.dimHex);
    makeText(
      this,
      W / 2,
      H - 90,
      state.mode === 'solo' ? 'ENTER fly again      ESC menu' : 'ENTER or ESC back to menu',
      22,
      'center',
    );
  }

  update(): void {
    const n = this.nav.poll();
    if (n.ok) {
      sfx.callout();
      this.scene.start(state.mode === 'solo' ? 'Game' : 'Menu');
    } else if (n.back) this.scene.start('Menu');
  }
}
