import type { WebSocket } from 'ws';
import type { PilotId } from '../shared/config/pilots.ts';
import type { SpecialId } from '../shared/config/specials.ts';
import { COOP_LIVES, DT, MAX_PLAYERS, SNAPSHOT_EVERY } from '../shared/constants.ts';
import type { LobbyPlayer, ServerMsg } from '../shared/protocol.ts';
import { World } from '../shared/sim/World.ts';
import { NO_INPUT } from '../shared/types.ts';
import type { InputState, SimEvent } from '../shared/types.ts';

const STEP_MS = DT * 1000;
const MAX_QUEUE = 4; // inputs waiting per player; more than this means the client runs ahead, so catch up
export const REJOIN_WINDOW_MS = 30_000;

export interface Member {
  slot: number;
  ws: WebSocket | null;
  token: string;
  pilot: PilotId;
  special: SpecialId;
  queue: { seq: number; i: InputState }[];
  last: InputState;
  ack: number;
  leftAt: number;
}

/**
 * One co-op match. The server owns the simulation: clients only send inputs, and every player sees
 * the same authoritative state, which is also why no one can cheat or desync.
 */
export class Room {
  readonly code: string;
  phase: 'lobby' | 'playing' | 'over' = 'lobby';
  members: (Member | undefined)[] = [];
  world: World | null = null;
  seed = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;
  private acc = 0;
  private events: SimEvent[] = [];
  private onEmpty: (room: Room) => void;
  private overAt = 0;

  constructor(code: string, onEmpty: (room: Room) => void) {
    this.code = code;
    this.onEmpty = onEmpty;
  }

  // ---------- membership ----------

  freeSlot(): number {
    for (let i = 0; i < MAX_PLAYERS; i++) if (!this.members[i]) return i;
    return -1;
  }

  add(ws: WebSocket, pilot: PilotId, special: SpecialId, token: string): Member | null {
    const slot = this.freeSlot();
    if (slot < 0 || this.phase !== 'lobby') return null;
    const m: Member = { slot, ws, token, pilot, special, queue: [], last: NO_INPUT, ack: 0, leftAt: 0 };
    this.members[slot] = m;
    this.broadcastLobby();
    return m;
  }

  connected(): Member[] {
    return this.members.filter((m): m is Member => !!m && !!m.ws);
  }

  send(m: Member, msg: ServerMsg): void {
    if (m.ws && m.ws.readyState === 1) m.ws.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMsg, except?: Member): void {
    const data = JSON.stringify(msg);
    for (const m of this.members) {
      if (m && m !== except && m.ws && m.ws.readyState === 1) m.ws.send(data);
    }
  }

  lobbyPlayers(): LobbyPlayer[] {
    return this.members.filter((m): m is Member => !!m).map((m) => ({ slot: m.slot, pilot: m.pilot, special: m.special }));
  }

  broadcastLobby(): void {
    this.broadcast({ t: 'lobby', code: this.code, players: this.lobbyPlayers(), hostSlot: 0 });
  }

  // ---------- messages ----------

  start(from: Member): string | null {
    if (this.phase !== 'lobby') return 'The match has already started.';
    if (from.slot !== 0) return 'Only the host can start the match.';
    const players = this.members.filter((m): m is Member => !!m);
    if (players.length < 2) return 'Waiting for a partner to join.';
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.world = new World({
      seed: this.seed,
      lives: COOP_LIVES,
      players: players.map((m) => ({ slot: m.slot, pilot: m.pilot, special: m.special })),
    });
    this.phase = 'playing';
    for (const m of players) this.send(m, { t: 'start', seed: this.seed, slot: m.slot });
    this.lastTime = performance.now();
    this.acc = 0;
    this.timer = setInterval(() => this.loop(), 4);
    return null;
  }

  input(m: Member, seq: number, i: InputState): void {
    if (this.phase !== 'playing') return;
    m.queue.push({ seq, i });
    if (m.queue.length > 30) m.queue.splice(0, m.queue.length - 30);
  }

  /** A returning player takes their slot back (new socket, same token). */
  rejoin(m: Member, ws: WebSocket): string | null {
    if (this.phase !== 'playing' || !this.world) return 'The match is over.';
    if (m.ws) return 'That pilot is already connected.';
    if (!this.world.reconnectPlayer(m.slot)) return 'Could not rejoin the match.';
    m.ws = ws;
    m.queue = [];
    m.leftAt = 0;
    this.send(m, { t: 'start', seed: this.seed, slot: m.slot });
    this.broadcast({ t: 'peer', slot: m.slot, connected: true }, m);
    return null;
  }

  /** Socket closed. In the lobby the member just leaves; mid-match they get a rejoin window. */
  leave(m: Member, ws: WebSocket): void {
    if (m.ws !== ws) return;
    m.ws = null;
    m.leftAt = Date.now();
    if (this.phase === 'lobby') {
      this.members[m.slot] = undefined;
      if (m.slot === 0) {
        // host left: nobody can start the room any more
        for (const o of this.members) if (o) this.send(o, { t: 'error', msg: 'The host left the lobby.' });
        this.destroy();
      } else this.broadcastLobby();
      return;
    }
    if (this.phase === 'playing' && this.world) {
      this.world.disconnectPlayer(m.slot);
      this.broadcast({ t: 'peer', slot: m.slot, connected: false }, m);
    }
    if (this.connected().length === 0 && this.phase !== 'playing') this.destroy();
  }

  // ---------- simulation ----------

  private loop(): void {
    const now = performance.now();
    this.acc = Math.min(this.acc + (now - this.lastTime), 250);
    this.lastTime = now;
    while (this.acc >= STEP_MS && this.phase === 'playing') {
      this.acc -= STEP_MS;
      this.stepOnce();
    }
    if (this.phase === 'playing') this.expireRejoins();
    if (this.phase === 'over' && Date.now() > this.overAt) this.destroy();
  }

  private stepOnce(): void {
    const world = this.world;
    if (!world) return;
    const inputs: InputState[] = [];
    for (const m of this.members) {
      if (!m) continue;
      // too many queued inputs means the client is ahead of us: drop the oldest to stay in step
      while (m.queue.length > MAX_QUEUE) {
        const d = m.queue.shift();
        if (d) {
          m.last = d.i;
          m.ack = d.seq;
        }
      }
      const next = m.queue.shift();
      if (next) {
        m.last = next.i;
        m.ack = next.seq;
      }
      inputs[m.slot] = m.last;
    }
    world.step(inputs);
    this.events.push(...world.drainEvents());

    if (world.tick % SNAPSHOT_EVERY === 0 || world.gameOver) {
      const ack: number[] = [];
      for (const m of this.members) if (m) ack[m.slot] = m.ack;
      const snap = world.snapshot(this.events, ack);
      this.events = [];
      this.broadcast({ t: 'snap', s: snap });
    }
    if (world.gameOver) {
      this.phase = 'over';
      this.overAt = Date.now() + 15_000;
    }
  }

  private expireRejoins(): void {
    let anyone = false;
    for (const m of this.members) {
      if (!m) continue;
      if (m.ws) anyone = true;
      else if (m.leftAt && Date.now() - m.leftAt > REJOIN_WINDOW_MS) m.token = ''; // window closed
    }
    if (!anyone && this.members.every((m) => !m || !m.token)) {
      this.destroy();
    }
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.phase = 'over';
    this.onEmpty(this);
  }
}
