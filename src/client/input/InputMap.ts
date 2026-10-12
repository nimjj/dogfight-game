import Phaser from 'phaser';
import type { InputState } from '../../shared/types.ts';

const DEAD_ZONE = 0.2;

type KeyMap = Record<string, Phaser.Input.Keyboard.Key>;

/**
 * Turns keyboard and gamepad hardware into one action snapshot per frame. Game code only ever reads
 * InputState, so rebinding or adding local players never touches gameplay.
 */
export class InputMap {
  private keys: KeyMap;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    this.keys = kb.addKeys('A,D,W,L,P,K,O,LEFT,RIGHT,UP,SPACE') as KeyMap;
  }

  read(): InputState {
    const k = this.keys as Record<string, Phaser.Input.Keyboard.Key>;
    const down = (n: string) => !!k[n]?.isDown;

    let turn = 0;
    if (down('A') || down('LEFT')) turn -= 1;
    if (down('D') || down('RIGHT')) turn += 1;
    let thrust = down('W') || down('UP');
    let gun = down('L') || down('SPACE');
    let missile = down('P');
    let special = down('K');
    let flare = down('O');

    const gp = this.scene.input.gamepad;
    const pad = gp && gp.total > 0 ? gp.getPad(0) : null;
    if (pad) {
      const x = pad.leftStick.x;
      const y = pad.leftStick.y;
      if (Math.abs(x) > DEAD_ZONE) turn += x;
      if (y < -0.4) thrust = true;
      gun = gun || pad.A;
      missile = missile || pad.B;
      special = special || pad.X;
      flare = flare || pad.Y;
    }
    return { turn: Math.max(-1, Math.min(1, turn)), thrust, gun, missile, special, flare };
  }
}
