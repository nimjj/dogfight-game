import type { PilotId } from '../config/pilots.ts';
import type { SpecialId } from '../config/specials.ts';
import { WAVE } from '../config/waves.ts';
import type { EnemyKind } from '../config/enemies.ts';
import { DT, TEAM_ENEMIES } from '../constants.ts';
import { round } from '../math.ts';
import type { Snapshot } from '../protocol.ts';
import { Rng } from '../rng.ts';
import { NO_INPUT } from '../types.ts';
import type {
  BulletState,
  FlareState,
  InputState,
  MissileState,
  PlaneState,
  PlayerState,
  SimEvent,
  Team,
} from '../types.ts';
import { aiInput } from './ai.ts';
import { comboMult, killPlane, stepProjectiles } from './combat.ts';
import { stepFlight } from './flight.ts';
import { spawnPlayerPlane, stepLives } from './lives.ts';
import { statsOf } from './stats.ts';
import type { PlaneStats } from './stats.ts';
import { stepWaves } from './waves.ts';
import { stepWeapons } from './weapons.ts';

export interface WorldOptions {
  seed: number;
  players: { slot: number; pilot: PilotId; special: SpecialId }[];
  lives: number;
}

/**
 * The whole game simulation. It has no engine, DOM or network dependencies: the solo client, the
 * authoritative server and the unit tests all run this same class.
 */
export class World {
  tick = 0;
  rng: Rng;
  private idCounter = 1;
  planes: PlaneState[] = [];
  bullets: BulletState[] = [];
  missiles: MissileState[] = [];
  flares: FlareState[] = [];
  players: PlayerState[] = [];
  lives: number;
  score = 0;
  wave = 0;
  waveState: 'break' | 'active' = 'break';
  waveTimer: number = WAVE.firstDelay;
  queue: EnemyKind[] = [];
  spawnTimer = 0;
  gameOver = false;
  events: SimEvent[] = [];

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.lives = opts.lives;
    for (const p of opts.players) {
      this.players[p.slot] = {
        slot: p.slot,
        pilot: p.pilot,
        special: p.special,
        planeId: 0,
        respawnTimer: 0,
        out: false,
        connected: true,
        kills: 0,
        streak: 0,
      };
    }
    for (const pl of this.players) if (pl) spawnPlayerPlane(this, pl.slot);
  }

  newId(): number {
    return this.idCounter++;
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  planeById(id: number): PlaneState | undefined {
    if (!id) return undefined;
    return this.planes.find((p) => p.id === id);
  }

  statsFor(p: PlaneState): PlaneStats {
    return statsOf(this, p);
  }

  connectedCount(): number {
    let n = 0;
    for (const pl of this.players) if (pl && pl.connected && !pl.out) n++;
    return Math.max(1, n);
  }

  nearestHostile(from: PlaneState): PlaneState | undefined {
    let best: PlaneState | undefined;
    let bestD = Infinity;
    for (const p of this.planes) {
      if (!p.alive || p.team === from.team) continue;
      const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  nearestFlare(x: number, y: number, team: Team, radius: number): FlareState | undefined {
    let best: FlareState | undefined;
    let bestD = radius * radius;
    for (const f of this.flares) {
      if (f.team === team || f.life <= 0) continue;
      const d = (f.x - x) ** 2 + (f.y - y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  /** A pilot left the match: their plane vanishes without costing the team a life. */
  disconnectPlayer(slot: number): void {
    const pl = this.players[slot];
    if (!pl || !pl.connected) return;
    pl.connected = false;
    pl.out = true;
    const plane = this.planeById(pl.planeId);
    if (plane) plane.alive = false;
    pl.planeId = 0;
    this.planes = this.planes.filter((p) => p.alive);
  }

  /** Advance one fixed tick. `inputs` is indexed by player slot. */
  step(inputs: ReadonlyArray<InputState | undefined>): void {
    if (this.gameOver) return;
    this.tick++;
    const dt = DT;

    for (const p of this.planes) {
      if (!p.alive) continue;
      p.invuln = Math.max(0, p.invuln - dt);
      p.aiTime += dt;
      let input: InputState;
      if (p.stun > 0) {
        p.stun -= dt;
        input = NO_INPUT;
      } else if (p.kind === 'player') {
        input = inputs[p.slot] ?? NO_INPUT;
      } else {
        input = aiInput(this, p);
      }
      const crashed = stepFlight(p, input, statsOf(this, p), dt);
      stepWeapons(this, p, input, dt);
      if (crashed) killPlane(this, p, -1, 'crash');
    }

    stepProjectiles(this, dt);
    this.planes = this.planes.filter((p) => p.alive);
    stepWaves(this, dt);
    stepLives(this, dt);
  }

  enemiesLeft(): number {
    let n = this.queue.length;
    for (const p of this.planes) if (p.alive && p.team === TEAM_ENEMIES) n++;
    return n;
  }

  snapshot(events: SimEvent[] = [], ack: number[] = []): Snapshot {
    return {
      tick: this.tick,
      ack,
      planes: this.planes.map((p) => ({
        id: p.id,
        team: p.team,
        kind: p.kind,
        slot: p.slot,
        x: round(p.x),
        y: round(p.y),
        heading: round(p.heading, 3),
        speed: round(p.speed),
        hp: Math.max(0, round(p.hp)),
        maxHp: p.maxHp,
        heat: round(p.heat, 2),
        overheated: p.overheated,
        missiles: p.missiles,
        flares: p.flares,
        special: Math.floor(p.special),
        lockId: p.lockId,
        invuln: round(p.invuln, 2),
        stun: round(p.stun, 2),
      })),
      bullets: this.bullets.map((b) => ({ id: b.id, team: b.team, x: round(b.x), y: round(b.y), vx: round(b.vx, 0), vy: round(b.vy, 0) })),
      missiles: this.missiles.map((m) => ({
        id: m.id,
        team: m.team,
        x: round(m.x),
        y: round(m.y),
        heading: round(m.heading, 3),
        targetId: m.targetId,
      })),
      flares: this.flares.map((f) => ({ id: f.id, team: f.team, x: round(f.x), y: round(f.y) })),
      players: this.players
        .filter((p) => p)
        .map((p) => ({
          slot: p.slot,
          pilot: p.pilot,
          special: p.special,
          planeId: p.planeId,
          respawnIn: round(Math.max(0, p.respawnTimer), 1),
          out: p.out,
          connected: p.connected,
          kills: p.kills,
          streak: p.streak,
          mult: comboMult(p.streak),
        })),
      lives: this.lives,
      score: this.score,
      wave: this.wave,
      waveState: this.waveState,
      nextWaveIn: round(Math.max(0, this.waveTimer), 1),
      enemiesLeft: this.enemiesLeft(),
      gameOver: this.gameOver,
      events,
    };
  }
}
