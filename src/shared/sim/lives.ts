import { TEAM_PLAYERS, WORLD_W } from '../constants.ts';
import { PLAYER_BASE } from './stats.ts';
import { newPlane } from './waves.ts';
import type { World } from './World.ts';

export const RESPAWN_TIME = 3;
export const RESPAWN_INVULN = 2;
export const SPAWN_Y = 900;

export function spawnPlayerPlane(w: World, slot: number): void {
  const pl = w.players[slot];
  if (!pl) return;
  const plane = newPlane(w, {
    kind: 'player',
    team: TEAM_PLAYERS,
    slot,
    x: WORLD_W / 2 + (slot === 0 ? -250 : 250),
    y: SPAWN_Y,
    heading: slot === 0 ? 0 : Math.PI,
    speed: 320,
    hp: PLAYER_BASE.hp,
    maxHp: PLAYER_BASE.hp,
    invuln: RESPAWN_INVULN,
    missiles: 0,
    missileCd: 0,
  });
  plane.missiles = w.statsFor(plane).missileMax;
  plane.missileReload = w.statsFor(plane).missileReload;
  pl.planeId = plane.id;
  pl.respawnTimer = 0;
  w.planes.push(plane);
}

/** Team lives are a shared pool: every death spends one; with none left that pilot is out for good. */
export function onPlayerKilled(w: World, slot: number): void {
  const pl = w.players[slot];
  if (!pl) return;
  pl.planeId = 0;
  pl.streak = 0;
  if (w.lives > 0) {
    w.lives--;
    pl.respawnTimer = RESPAWN_TIME;
  } else {
    pl.out = true;
  }
}

export function stepLives(w: World, dt: number): void {
  for (const pl of w.players) {
    if (!pl || pl.out || pl.planeId !== 0 || pl.respawnTimer <= 0) continue;
    pl.respawnTimer -= dt;
    if (pl.respawnTimer <= 0) {
      spawnPlayerPlane(w, pl.slot);
      w.emit({ t: 'respawn', slot: pl.slot });
    }
  }
  if (!w.gameOver && w.players.every((p) => p.out)) {
    w.gameOver = true;
    w.emit({ t: 'gameover' });
  }
}
