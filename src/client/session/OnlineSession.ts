import { DT } from '../../shared/constants.ts';
import type { ServerMsg, Snapshot } from '../../shared/protocol.ts';
import { playerStats } from '../../shared/sim/stats.ts';
import { stepFlight } from '../../shared/sim/flight.ts';
import type { FlightParams } from '../../shared/sim/flight.ts';
import type { InputState, SimEvent } from '../../shared/types.ts';
import type { NetClient } from '../net/NetClient.ts';
import { lerpSnapshot } from '../render/interp.ts';
import type { Session } from './Session.ts';

const STEP_MS = DT * 1000;
/** Other players and enemies are drawn this far in the past so jittery packets still look smooth. */
const INTERP_DELAY_MS = 100;
const MAX_PENDING = 180;

interface Timed {
  at: number;
  s: Snapshot;
}

interface Predicted {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
}

/**
 * Co-op client. Sends inputs to the authoritative server, predicts only its own plane's flight so
 * controls feel instant, and interpolates everything else between server snapshots.
 */
export class OnlineSession implements Session {
  readonly coop = true;
  readonly localSlot: number;
  private net: NetClient;
  private snaps: Timed[] = [];
  private pending: { seq: number; input: InputState }[] = [];
  private seq = 0;
  private acc = 0;
  private pred: Predicted | null = null;
  private params: FlightParams | null = null;
  private events: SimEvent[] = [];
  private lost = false;

  constructor(net: NetClient, localSlot: number) {
    this.net = net;
    this.localSlot = localSlot;
    net.onMessage = (m) => this.onMsg(m);
    net.onClose = () => {
      this.lost = true;
    };
  }

  private onMsg(m: ServerMsg): void {
    if (m.t === 'snap') this.onSnap(m.s);
    else if (m.t === 'peer' && !m.connected) {
      this.events.push({ t: 'callout', text: 'Partner disconnected', slot: -1 });
    } else if (m.t === 'peer' && m.connected) {
      this.events.push({ t: 'callout', text: 'Partner is back', slot: -1 });
    }
  }

  private onSnap(s: Snapshot): void {
    this.snaps.push({ at: performance.now(), s });
    if (this.snaps.length > 30) this.snaps.shift();
    this.events.push(...s.events);

    const me = s.planes.find((p) => p.kind === 'player' && p.slot === this.localSlot);
    const pl = s.players.find((p) => p.slot === this.localSlot);
    if (pl) this.params = playerStats(pl.pilot);
    if (!me || !this.params) {
      this.pred = null;
      this.pending = [];
      return;
    }
    // reconcile: start from the server's truth, then replay the inputs it has not processed yet
    const ack = s.ack[this.localSlot] ?? 0;
    this.pending = this.pending.filter((p) => p.seq > ack);
    const pred: Predicted = { id: me.id, x: me.x, y: me.y, heading: me.heading, speed: me.speed };
    for (const p of this.pending) stepFlight(pred, p.input, this.params, DT);
    this.pred = pred;
  }

  update(deltaMs: number, input: InputState): void {
    this.acc += Math.min(deltaMs, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.seq++;
      this.net.send({ t: 'input', seq: this.seq, i: input });
      this.pending.push({ seq: this.seq, input });
      if (this.pending.length > MAX_PENDING) this.pending.shift();
      if (this.pred && this.params) stepFlight(this.pred, input, this.params, DT);
    }
  }

  view(): Snapshot | null {
    const n = this.snaps.length;
    if (n === 0) return null;
    const t = performance.now() - INTERP_DELAY_MS;
    let out: Snapshot;
    const last = this.snaps[n - 1] as Timed;
    const first = this.snaps[0] as Timed;
    if (t >= last.at) out = last.s;
    else if (t <= first.at) out = first.s;
    else {
      out = last.s;
      for (let i = 0; i < n - 1; i++) {
        const a = this.snaps[i] as Timed;
        const b = this.snaps[i + 1] as Timed;
        if (t >= a.at && t < b.at) {
          out = lerpSnapshot(a.s, b.s, (t - a.at) / (b.at - a.at));
          break;
        }
      }
    }
    const pred = this.pred;
    if (!pred) return out;
    return {
      ...out,
      planes: out.planes.map((p) =>
        p.id === pred.id ? { ...p, x: pred.x, y: pred.y, heading: pred.heading, speed: pred.speed } : p,
      ),
    };
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  connectionLost(): boolean {
    return this.lost;
  }

  destroy(): void {
    this.net.onMessage = () => {};
    this.net.onClose = () => {};
    this.net.close();
  }
}
