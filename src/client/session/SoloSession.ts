import type { PilotId } from '../../shared/config/pilots.ts';
import type { SpecialId } from '../../shared/config/specials.ts';
import { DT } from '../../shared/constants.ts';
import type { Snapshot } from '../../shared/protocol.ts';
import { World } from '../../shared/sim/World.ts';
import type { InputState, SimEvent } from '../../shared/types.ts';
import { lerpSnapshot } from '../render/interp.ts';
import type { Session } from './Session.ts';

const STEP_MS = DT * 1000;
export const SOLO_LIVES = 3;

/** Runs the shared simulation right in the browser; Phaser only draws what it produces. */
export class SoloSession implements Session {
  readonly localSlot = 0;
  readonly coop = false;
  readonly world: World;
  private acc = 0;
  private prev: Snapshot;
  private cur: Snapshot;
  private events: SimEvent[] = [];

  constructor(pilot: PilotId, special: SpecialId, seed = Date.now() >>> 0) {
    this.world = new World({ seed, lives: SOLO_LIVES, players: [{ slot: 0, pilot, special }] });
    this.cur = this.world.snapshot();
    this.prev = this.cur;
  }

  update(deltaMs: number, input: InputState): void {
    this.acc += Math.min(deltaMs, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.prev = this.cur;
      this.world.step([input]);
      this.events.push(...this.world.drainEvents());
      this.cur = this.world.snapshot();
      if (this.world.gameOver) {
        this.acc = 0;
        break;
      }
    }
  }

  view(): Snapshot {
    return lerpSnapshot(this.prev, this.cur, this.acc / STEP_MS);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  connectionLost(): boolean {
    return false;
  }

  destroy(): void {}
}
