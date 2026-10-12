import { GROUND_Y } from '../shared/constants.ts';
import { angleDiff, clamp } from '../shared/math.ts';
import type { Snapshot } from '../shared/protocol.ts';
import { NO_INPUT } from '../shared/types.ts';
import type { InputState } from '../shared/types.ts';

/** Demo pilot used by `?bot=1` so the game can be watched (and screenshotted) without a human. */
export function botInput(v: Snapshot, slot: number, timeMs: number): InputState {
  const me = v.planes.find((p) => p.kind === 'player' && p.slot === slot);
  if (!me) return NO_INPUT;
  let target: (typeof v.planes)[number] | undefined;
  let best = Infinity;
  for (const p of v.planes) {
    if (p.team === me.team) continue;
    const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2;
    if (d < best) {
      best = d;
      target = p;
    }
  }
  let desired = me.heading;
  let dist = Infinity;
  if (target) {
    dist = Math.sqrt(best);
    desired = Math.atan2(target.y - me.y, target.x - me.x);
  }
  if (me.y > GROUND_Y - 350 && Math.sin(me.heading) > -0.2) desired = -Math.PI / 2;
  else if (me.y < 200 && Math.sin(me.heading) < 0.2) desired = Math.PI / 2;
  const diff = angleDiff(me.heading, desired);
  return {
    turn: clamp(diff * 3, -1, 1),
    thrust: me.speed < 460 || Math.sin(me.heading) < -0.3,
    gun: Math.abs(diff) < 0.15 && dist < 800,
    missile: me.lockId !== 0 && Math.abs(diff) < 0.5,
    special: me.special >= 100,
    flare: v.missiles.some((m) => m.targetId === me.id) && Math.floor(timeMs / 400) % 2 === 0,
  };
}
