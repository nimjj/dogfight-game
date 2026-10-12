import Phaser from 'phaser';
import { sfx } from './render/Audio.ts';
import { BootScene } from './scenes/Boot.ts';
import { GameScene } from './scenes/Game.ts';
import { GameOverScene } from './scenes/GameOver.ts';
import { HudScene } from './scenes/Hud.ts';
import { LobbyScene } from './scenes/Lobby.ts';
import { MenuScene } from './scenes/Menu.ts';
import { PilotSelectScene } from './scenes/PilotSelect.ts';
import { H, W } from './state.ts';

// Browsers only start audio after a user gesture, so unlock on the first key or click.
window.addEventListener('keydown', () => sfx.unlock());
window.addEventListener('pointerdown', () => sfx.unlock());

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  pixelArt: true,
  backgroundColor: '#2b3a2e',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  scene: [BootScene, MenuScene, PilotSelectScene, LobbyScene, GameScene, HudScene, GameOverScene],
});
