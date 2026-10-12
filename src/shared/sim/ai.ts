import { ENEMIES } from '../config/enemies.ts';
import { GROUND_Y } from '../constants.ts';
import { angleDiff, clamp } from '../math.ts';
import type { InputState, PlaneState } from '../types.ts';
import { enemyStats } from './stats.ts';
import type { World } from './World.ts';

/** Produces the same input a human would, so enemies use exactly the flight and weapon rules players do. */
export function aiInput(w: World, p: PlaneState): InputState {
  if (p.kind === 'player') return { turn: 0, thrust: false, gun: false, missile: false, special: false, flare: false };
  const def = ENEMIES[p.kind];
  const st = enemyStats(p.kind);
  const tgt = w.nearestHostile(p);

  let desired = p.heading;
  let dist = Infinity;
  if (tgt) {
    dist = Math.hypot(tgt.x - p.x, tgt.y - p.y);
    // aim ahead of the target by roughly its flight time
    const lead = Math.min(0.8, dist / 900) * 0.6;
    const lx = tgt.x + Math.cos(tgt.heading) * tgt.speed * lead;
    const ly = tgt.y + Math.sin(tgt.heading) * tgt.speed * lead;
    desired = Math.atan2(ly - p.y, lx - p.x);
    // overshooting: when very close and already facing the target, pull away and come around
    if (dist < 160 && Math.abs(angleDiff(p.heading, desired)) < 0.5) desired += 1.2;
  }

  // terrain and ceiling avoidance override pursuit
  const sinH = Math.sin(p.heading);
  if (p.y > GROUND_Y - 330 && sinH > -0.25) desired = -Math.PI / 2 + (Math.cos(p.heading) >= 0 ? 0.4 : -0.4);
  else if (p.y < 160 && sinH < 0.25) desired = Math.PI / 2;

  // aces weave
  if (p.kind === 'ace' && dist > 350) desired += Math.sin(p.aiTime * 1.8 + p.id) * 0.5;

  const diff = angleDiff(p.heading, desired);
  const aimed = Math.abs(diff) < 0.13 && dist < def.fireRange;
  const input: InputState = {
    turn: clamp(diff * 2.5, -1, 1),
    thrust: p.speed < def.cruise,
    gun: aimed && def.gunRate > 0,
    missile: def.missiles && dist > 450 && dist < 1200 && Math.abs(diff) < 0.4,
    special: false,
    flare: false,
  };

  if (def.flares) {
    for (const m of w.missiles) {
      if (m.targetId === p.id && (m.x - p.x) ** 2 + (m.y - p.y) ** 2 < 450 * 450) {
        input.flare = true;
        input.turn = Math.sign(Math.sin(p.aiTime * 3)) || 1; // hard break turn
        break;
      }
    }
  }
  return input;
}
