import { ENEMIES } from '../config/enemies.ts';
import { PILOTS } from '../config/pilots.ts';
import type { PilotId } from '../config/pilots.ts';
import { ENEMY_BULLET, GUN } from '../config/weapons.ts';
import type { PlaneState } from '../types.ts';
import type { World } from './World.ts';

export interface PlaneStats {
  maxSpeed: number;
  stallSpeed: number;
  thrust: number;
  turnRate: number;
  radius: number;
  hasHeat: boolean;
  heatMult: number;
  missileMax: number;
  missileReload: number;
  missileCd: number;
  infiniteMissiles: boolean;
  gunRate: number;
  bulletSpeed: number;
  bulletLife: number;
  bulletDamage: number;
  flareMax: number;
  canFlare: boolean;
}

export const PLAYER_BASE = {
  maxSpeed: 520,
  stallSpeed: 150,
  thrust: 340,
  turnRate: 2.6,
  hp: 100,
  radius: 18,
  missiles: 4,
  missileReload: 6,
} as const;

export function playerStats(pilot: PilotId): PlaneStats {
  const def = PILOTS[pilot];
  return {
    maxSpeed: PLAYER_BASE.maxSpeed * def.maxSpeedMult,
    stallSpeed: PLAYER_BASE.stallSpeed,
    thrust: PLAYER_BASE.thrust,
    turnRate: PLAYER_BASE.turnRate,
    radius: PLAYER_BASE.radius,
    hasHeat: true,
    heatMult: def.heatMult,
    missileMax: PLAYER_BASE.missiles + def.extraMissiles,
    missileReload: PLAYER_BASE.missileReload * def.missileReloadMult,
    missileCd: 0.4,
    infiniteMissiles: false,
    gunRate: GUN.rate,
    bulletSpeed: GUN.speed,
    bulletLife: GUN.life,
    bulletDamage: GUN.damage,
    flareMax: 3,
    canFlare: true,
  };
}

const enemyCache = new Map<string, PlaneStats>();

export function enemyStats(kind: 'fighter' | 'carrier' | 'ace'): PlaneStats {
  let s = enemyCache.get(kind);
  if (!s) {
    const d = ENEMIES[kind];
    s = {
      maxSpeed: d.maxSpeed,
      stallSpeed: 110,
      thrust: d.thrust,
      turnRate: d.turnRate,
      radius: d.radius,
      hasHeat: false,
      heatMult: 0,
      missileMax: 0,
      missileReload: 0,
      missileCd: d.missileCooldown,
      infiniteMissiles: d.missiles,
      gunRate: d.gunRate,
      bulletSpeed: ENEMY_BULLET.speed,
      bulletLife: ENEMY_BULLET.life,
      bulletDamage: ENEMY_BULLET.damage,
      flareMax: 3,
      canFlare: d.flares,
    };
    enemyCache.set(kind, s);
  }
  return s;
}

export function statsOf(w: World, p: PlaneState): PlaneStats {
  if (p.kind === 'player') {
    const pl = w.players[p.slot];
    return playerStats(pl ? pl.pilot : 'kestrel');
  }
  return enemyStats(p.kind);
}
