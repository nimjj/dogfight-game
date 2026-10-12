import Phaser from 'phaser';
import { PILOT_IDS } from '../../shared/config/pilots.ts';
import type { PilotId } from '../../shared/config/pilots.ts';
import { SPECIAL_IDS } from '../../shared/config/specials.ts';
import type { SpecialId } from '../../shared/config/specials.ts';
import { generateTextures } from '../render/textures.ts';
import { state } from '../state.ts';
import { C } from '../ui.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.bgDark);
    generateTextures(this);

    // `?auto=solo` jumps straight into a run (handy for demos and screenshots); `&bot=1` lets a bot fly.
    const q = new URLSearchParams(location.search);
    if (q.get('auto') === 'solo') {
      const pilot = q.get('pilot') as PilotId | null;
      const special = q.get('special') as SpecialId | null;
      if (pilot && PILOT_IDS.includes(pilot)) state.pilot = pilot;
      if (special && SPECIAL_IDS.includes(special)) state.special = special;
      state.mode = 'solo';
      this.scene.start('Game');
      return;
    }
    if (q.get('auto') === 'join' && q.get('code')) {
      const pilot = q.get('pilot') as PilotId | null;
      if (pilot && PILOT_IDS.includes(pilot)) state.pilot = pilot;
      state.mode = 'join';
      this.scene.start('Lobby');
      return;
    }
    this.scene.start('Menu');
  }
}
