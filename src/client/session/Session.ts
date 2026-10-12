import type { Snapshot } from '../../shared/protocol.ts';
import type { InputState, SimEvent } from '../../shared/types.ts';

/** What the game scene needs from "a running match", whether it is simulated locally or by the server. */
export interface Session {
  readonly localSlot: number;
  readonly coop: boolean;
  /** Advance with the real elapsed time and this frame's input. */
  update(deltaMs: number, input: InputState): void;
  /** Interpolated state to draw, or null before the first state arrives. */
  view(): Snapshot | null;
  /** Gameplay events (explosions, callouts...) since the last call. */
  drainEvents(): SimEvent[];
  /** True once the connection to the server dropped. */
  connectionLost(): boolean;
  destroy(): void;
}
