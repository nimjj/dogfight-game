import { ENEMIES } from '../config/enemies.ts';
import type { EnemyKind } from '../config/enemies.ts';
import { WAVE, waveComposition, waveHpScale } from '../config/waves.ts';
import { COOP_SCALE, GROUND_Y, TEAM_ENEMIES, TEAM_PLAYERS, WORLD_W } from '../constants.ts';
import { clamp } from '../math.ts';
import type { PlaneState } from '../types.ts';
import type { World } from './World.ts';

export function newPlane(w: World, over: Partial<PlaneState> & Pick<PlaneState, 'kind' | 'team' | 'x' | 'y'>): PlaneState {
  return {
    id: w.newId(),
    slot: -1,
    heading: 0,
    speed: 300,
    hp: 1,
    maxHp: 1,
    alive: true,
    invuln: 0,
    stun: 0,
    heat: 0,
    overheated: false,
    gunCd: 0,
    missiles: 0,
    missileCd: 1.5,
    missileReload: 0,
    flares: 3,
    flareCd: 0,
    flareReload: 0,
    special: 0,
    lockId: 0,
    lockCand: 0,
    lockTimer: 0,
    aiTime: 0,
    ...over,
  };
}

/** Enemies arrive just outside the players' view, flying toward them, so fights start within seconds. */
function spawnEnemy(w: World, kind: EnemyKind): void {
  const def = ENEMIES[kind];
  const coopScale = w.connectedCount() > 1 ? COOP_SCALE : 1;
  const hp = Math.round(def.hp * waveHpScale(w.wave) * coopScale);
  const anchors = w.planes.filter((p) => p.alive && p.team === TEAM_PLAYERS);
  const anchor = anchors.length ? (anchors[w.rng.int(anchors.length)] as PlaneState) : undefined;
  const fromLeft = anchor ? anchor.x > WORLD_W / 2 || (anchor.x > 900 && w.rng.chance(0.5)) : w.rng.chance(0.5);
  const dx = w.rng.range(1000, 1400);
  const x = clamp((anchor ? anchor.x : WORLD_W / 2) + (fromLeft ? -dx : dx), 80, WORLD_W - 80);
  const y = clamp((anchor ? anchor.y : 800) + w.rng.range(-450, 450), 220, GROUND_Y - 500);
  w.planes.push(
    newPlane(w, {
      kind,
      team: TEAM_ENEMIES,
      x,
      y,
      heading: x < (anchor ? anchor.x : WORLD_W / 2) ? 0 : Math.PI,
      speed: def.cruise,
      hp,
      maxHp: hp,
      missileCd: 2 + w.rng.range(0, 3),
    }),
  );
}

function aliveEnemies(w: World): number {
  let n = 0;
  for (const p of w.planes) if (p.alive && p.team === TEAM_ENEMIES) n++;
  return n;
}

export function stepWaves(w: World, dt: number): void {
  if (w.waveState === 'break') {
    w.waveTimer -= dt;
    if (w.waveTimer > 0) return;
    w.wave++;
    const base = waveComposition(w.wave);
    const scale = w.connectedCount() > 1 ? COOP_SCALE : 1;
    const target = Math.round(base.length * scale);
    w.queue = [];
    for (let i = 0; i < target; i++) w.queue.push(base[i % base.length] as EnemyKind);
    w.spawnTimer = 0;
    w.waveState = 'active';
    w.emit({ t: 'callout', text: `Wave ${w.wave}`, slot: -1 });
    return;
  }

  w.spawnTimer -= dt;
  if (w.queue.length > 0 && w.spawnTimer <= 0 && aliveEnemies(w) < WAVE.maxAlive) {
    spawnEnemy(w, w.queue.shift() as EnemyKind);
    w.spawnTimer = WAVE.spawnInterval;
  }
  if (w.queue.length === 0 && aliveEnemies(w) === 0) {
    w.score += WAVE.clearBonus * w.wave;
    w.waveState = 'break';
    w.waveTimer = WAVE.breakTime;
    w.emit({ t: 'callout', text: 'Wave Cleared!', slot: -1 });
  }
}
