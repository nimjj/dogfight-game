import { ENEMIES } from '../config/enemies.ts';
import { FLARE, MISSILE } from '../config/weapons.ts';
import { SPECIAL_CHARGE_NEEDED } from '../config/specials.ts';
import { GROUND_Y, TEAM_ENEMIES, WORLD_W } from '../constants.ts';
import { angleDiff, clamp, dist2 } from '../math.ts';
import type { PlaneState, Team } from '../types.ts';
import { onPlayerKilled } from './lives.ts';
import { statsOf } from './stats.ts';
import type { World } from './World.ts';

export type KillHow = 'gun' | 'missile' | 'special' | 'crash';

export function comboMult(streak: number): number {
  return Math.min(8, 1 + Math.floor(streak / 2));
}

/**
 * The single place where damage is decided. A hit from the same team as the target is ignored, which is
 * what makes friendly fire impossible: every projectile carries its team and nothing else gates damage.
 */
export function damagePlane(
  w: World,
  target: PlaneState,
  dmg: number,
  srcTeam: Team,
  srcSlot: number,
  how: KillHow,
): boolean {
  if (!target.alive || target.team === srcTeam || target.invuln > 0) return false;
  target.hp -= dmg;
  w.emit({ t: 'hit', x: target.x, y: target.y });
  if (target.kind === 'player') {
    const pl = w.players[target.slot];
    if (pl) pl.streak = 0;
  }
  if (target.hp <= 0) killPlane(w, target, srcSlot, how);
  return true;
}

export function killPlane(w: World, p: PlaneState, killerSlot: number, how: KillHow): void {
  if (!p.alive) return;
  p.alive = false;
  p.hp = 0;
  w.emit({ t: 'explosion', x: p.x, y: p.y, size: p.kind === 'carrier' ? 2 : 1.4 });

  if (p.kind === 'player') {
    onPlayerKilled(w, p.slot);
    return;
  }

  const killer = w.players[killerSlot];
  if (!killer || how === 'crash') return;
  const def = ENEMIES[p.kind];
  killer.kills++;
  killer.streak++;
  const mult = comboMult(killer.streak);
  w.score += def.score * mult;
  const kp = w.planeById(killer.planeId);
  if (kp) kp.special = Math.min(SPECIAL_CHARGE_NEEDED, kp.special + def.charge);
  if (how === 'missile') w.emit({ t: 'callout', text: 'Bullseye!', slot: killer.slot });
  if (killer.streak > 1 && killer.streak % 2 === 0) {
    w.emit({ t: 'callout', text: `x${mult} Combo!`, slot: killer.slot });
  }
}

function detonate(w: World, x: number, y: number, team: Team, slot: number, dmg: number): void {
  w.emit({ t: 'explosion', x, y, size: 1 });
  for (const p of w.planes) {
    if (!p.alive || p.team === team) continue;
    const r = MISSILE.blastRadius + statsOf(w, p).radius;
    if (dist2(x, y, p.x, p.y) <= r * r) damagePlane(w, p, dmg, team, slot, 'missile');
  }
}

export function stepProjectiles(w: World, dt: number): void {
  // bullets
  for (const b of w.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.y >= GROUND_Y || b.x < -200 || b.x > WORLD_W + 200) b.life = -1;
    if (b.life <= 0) continue;
    for (const p of w.planes) {
      if (!p.alive || p.team === b.team) continue;
      const r = statsOf(w, p).radius + 4;
      if (dist2(b.x, b.y, p.x, p.y) <= r * r) {
        if (damagePlane(w, p, b.dmg, b.team, b.ownerSlot, 'gun') || p.invuln > 0) b.life = -1;
        break;
      }
    }
  }
  w.bullets = w.bullets.filter((b) => b.life > 0);

  // flares
  for (const f of w.flares) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 80 * dt;
    f.life -= dt;
    if (f.y >= GROUND_Y) f.life = -1;
  }

  // missiles
  for (const m of w.missiles) {
    // flares lure missiles away from planes (only hostile flares count)
    let target: { x: number; y: number } | undefined;
    const lure = w.nearestFlare(m.x, m.y, m.team, FLARE.lureRadius);
    if (lure) m.targetId = lure.id;
    const tp = w.planeById(m.targetId);
    if (tp && tp.alive) target = tp;
    else {
      const tf = w.flares.find((f) => f.id === m.targetId && f.life > 0);
      if (tf) target = tf;
      else m.targetId = 0;
    }
    if (target) {
      const desired = Math.atan2(target.y - m.y, target.x - m.x);
      const maxTurn = MISSILE.turnRate * dt;
      m.heading += clamp(angleDiff(m.heading, desired), -maxTurn, maxTurn);
    }
    m.speed = Math.min(MISSILE.speed, m.speed + 500 * dt);
    m.x += Math.cos(m.heading) * m.speed * dt;
    m.y += Math.sin(m.heading) * m.speed * dt;
    m.life -= dt;

    let boom = m.y >= GROUND_Y;
    if (!boom) {
      for (const p of w.planes) {
        if (!p.alive || p.team === m.team) continue;
        const r = statsOf(w, p).radius + MISSILE.hitRadius;
        if (dist2(m.x, m.y, p.x, p.y) <= r * r) {
          boom = true;
          break;
        }
      }
    }
    if (!boom) {
      for (const f of w.flares) {
        if (f.team === m.team || f.life <= 0) continue;
        if (dist2(m.x, m.y, f.x, f.y) <= FLARE.hitRadius * FLARE.hitRadius) {
          f.life = -1;
          boom = true;
          break;
        }
      }
    }
    if (boom) {
      detonate(w, m.x, m.y, m.team, m.ownerSlot, m.dmg);
      m.life = -1;
    } else if (m.life <= 0) {
      w.emit({ t: 'explosion', x: m.x, y: m.y, size: 0.6 });
    }
  }
  w.missiles = w.missiles.filter((m) => m.life > 0);
  w.flares = w.flares.filter((f) => f.life > 0);
}

export function isEnemyTeam(team: Team): boolean {
  return team === TEAM_ENEMIES;
}
