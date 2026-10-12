import { ENEMIES } from '../config/enemies.ts';
import type { EnemyKind } from '../config/enemies.ts';
import { WAVE, waveComposition, waveHpScale } from '../config/waves.ts';
import { COOP_SCALE, TEAM_ENEMIES, WORLD_W } from '../constants.ts';
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

function spawnEnemy(w: World, kind: EnemyKind): void {
  const def = ENEMIES[kind];
  const fromLeft = w.rng.chance(0.5);
  const coopScale = w.connectedCount() > 1 ? COOP_SCALE : 1;
  const hp = Math.round(def.hp * waveHpScale(w.wave) * coopScale);
  w.planes.push(
    newPlane(w, {
      kind,
      team: TEAM_ENEMIES,
      x: fromLeft ? 80 : WORLD_W - 80,
      y: w.rng.range(300, 1300),
      heading: fromLeft ? 0 : Math.PI,
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
