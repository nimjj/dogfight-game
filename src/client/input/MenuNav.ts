import Phaser from 'phaser';

export interface NavEvent {
  dx: number;
  dy: number;
  ok: boolean;
  back: boolean;
}

/** Edge-triggered menu navigation from keyboard and gamepad (one event per press, not per frame). */
export class MenuNav {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private prev = { dx: 0, dy: 0, ok: false, back: false };

  private scene: Phaser.Scene;
  private backspaceBack: boolean;

  constructor(scene: Phaser.Scene, backspaceBack = true) {
    this.scene = scene;
    this.backspaceBack = backspaceBack;
    this.keys = scene.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,ENTER,SPACE,ESC,BACKSPACE') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  poll(): NavEvent {
    const k = this.keys;
    const down = (n: string) => !!k[n]?.isDown;
    let dx = (down('RIGHT') || down('D') ? 1 : 0) - (down('LEFT') || down('A') ? 1 : 0);
    let dy = (down('DOWN') || down('S') ? 1 : 0) - (down('UP') || down('W') ? 1 : 0);
    let ok = down('ENTER') || down('SPACE');
    let back = down('ESC') || (this.backspaceBack && down('BACKSPACE'));

    const gp = this.scene.input.gamepad;
    const pad = gp && gp.total > 0 ? gp.getPad(0) : null;
    if (pad) {
      if (pad.leftStick.x > 0.6) dx = 1;
      else if (pad.leftStick.x < -0.6) dx = -1;
      if (pad.leftStick.y > 0.6) dy = 1;
      else if (pad.leftStick.y < -0.6) dy = -1;
      ok = ok || pad.A;
      back = back || pad.B;
    }
    const out = {
      dx: dx !== this.prev.dx ? dx : 0,
      dy: dy !== this.prev.dy ? dy : 0,
      ok: ok && !this.prev.ok,
      back: back && !this.prev.back,
    };
    this.prev = { dx, dy, ok, back };
    return out;
  }
}
