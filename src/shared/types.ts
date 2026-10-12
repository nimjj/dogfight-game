import type { PilotId } from './config/pilots.ts';
import type { SpecialId } from './config/specials.ts';

export type Team = 0 | 1;
export type PlaneKind = 'player' | 'fighter' | 'carrier' | 'ace';

/** What a player (or the AI) wants the plane to do this tick. */
export interface InputState {
  turn: number; // -1 (left/up-arc) .. 1
  thrust: boolean;
  gun: boolean;
  missile: boolean;
  special: boolean;
  flare: boolean;
}

export const NO_INPUT: InputState = Object.freeze({
  turn: 0,
  thrust: false,
  gun: false,
  missile: false,
  special: false,
  flare: false,
});

export interface PlaneState {
  id: number;
  team: Team;
  kind: PlaneKind;
  slot: number; // player slot, -1 for enemies
  x: number;
  y: number;
  heading: number;
  speed: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  invuln: number;
  stun: number;
  heat: number;
  overheated: boolean;
  gunCd: number;
  missiles: number;
  missileCd: number;
  missileReload: number;
  flares: number;
  flareCd: number;
  flareReload: number;
  special: number; // charge 0..100
  lockId: number;
  lockCand: number;
  lockTimer: number;
  aiTime: number;
}

export interface BulletState {
  id: number;
  team: Team;
  ownerSlot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
}

export interface MissileState {
  id: number;
  team: Team;
  ownerSlot: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  life: number;
  targetId: number;
  dmg: number;
}

export interface FlareState {
  id: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface PlayerState {
  slot: number;
  pilot: PilotId;
  special: SpecialId;
  planeId: number;
  respawnTimer: number;
  out: boolean;
  connected: boolean;
  kills: number;
  streak: number;
}

export type SimEvent =
  | { t: 'explosion'; x: number; y: number; size: number }
  | { t: 'hit'; x: number; y: number }
  | { t: 'shot'; x: number; y: number; team: Team }
  | { t: 'missile'; x: number; y: number }
  | { t: 'flare'; x: number; y: number }
  | { t: 'beam'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'emp'; x: number; y: number; r: number }
  | { t: 'callout'; text: string; slot: number }
  | { t: 'lock'; slot: number }
  | { t: 'overheat'; slot: number }
  | { t: 'respawn'; slot: number }
  | { t: 'gameover' };
