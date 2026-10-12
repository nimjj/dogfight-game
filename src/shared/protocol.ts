import type { PilotId } from './config/pilots.ts';
import type { SpecialId } from './config/specials.ts';
import type { EnemyKind } from './config/enemies.ts';
import type { InputState, PlaneKind, SimEvent, Team } from './types.ts';

export interface SnapPlane {
  id: number;
  team: Team;
  kind: PlaneKind;
  slot: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  hp: number;
  maxHp: number;
  heat: number;
  overheated: boolean;
  missiles: number;
  flares: number;
  special: number;
  lockId: number;
  invuln: number;
  stun: number;
}

export interface SnapBullet {
  id: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SnapMissile {
  id: number;
  team: Team;
  x: number;
  y: number;
  heading: number;
  targetId: number;
}

export interface SnapFlare {
  id: number;
  team: Team;
  x: number;
  y: number;
}

export interface SnapPlayer {
  slot: number;
  pilot: PilotId;
  special: SpecialId;
  planeId: number;
  respawnIn: number;
  out: boolean;
  connected: boolean;
  kills: number;
  streak: number;
  mult: number;
}

/** Everything a renderer needs. Solo builds it locally; co-op receives it from the server. */
export interface Snapshot {
  tick: number;
  /** Last input sequence number the server applied, per slot (for client prediction). */
  ack: number[];
  planes: SnapPlane[];
  bullets: SnapBullet[];
  missiles: SnapMissile[];
  flares: SnapFlare[];
  players: SnapPlayer[];
  lives: number;
  score: number;
  wave: number;
  waveState: 'break' | 'active';
  nextWaveIn: number;
  enemiesLeft: number;
  gameOver: boolean;
  events: SimEvent[];
}

export interface LobbyPlayer {
  slot: number;
  pilot: PilotId;
  special: SpecialId;
}

export type ClientMsg =
  | { t: 'create'; pilot: PilotId; special: SpecialId }
  | { t: 'join'; code: string; pilot: PilotId; special: SpecialId }
  | { t: 'rejoin'; code: string; slot: number; token: string }
  | { t: 'start' }
  | { t: 'input'; seq: number; i: InputState }
  | { t: 'ping'; c: number };

export type ServerMsg =
  | { t: 'joined'; code: string; slot: number; token: string; host: boolean }
  | { t: 'lobby'; code: string; players: LobbyPlayer[]; hostSlot: number }
  | { t: 'start'; seed: number; slot: number }
  | { t: 'snap'; s: Snapshot }
  | { t: 'peer'; slot: number; connected: boolean }
  | { t: 'error'; msg: string }
  | { t: 'pong'; c: number };

export type { EnemyKind };
