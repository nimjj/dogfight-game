import { lerp, lerpAngle } from '../../shared/math.ts';
import type { Snapshot } from '../../shared/protocol.ts';

type Pos = { id: number; x: number; y: number };

function index<T extends Pos>(list: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const e of list) m.set(e.id, e);
  return m;
}

/**
 * Blend two snapshots: entities present in both are interpolated, entities only in `b` appear at
 * their latest position, entities only in `a` have already vanished. Everything else comes from `b`.
 */
export function lerpSnapshot(a: Snapshot, b: Snapshot, t: number): Snapshot {
  const pa = index(a.planes);
  const ma = index(a.missiles);
  const fa = index(a.flares);
  const ba = index(a.bullets);
  return {
    ...b,
    planes: b.planes.map((p) => {
      const o = pa.get(p.id);
      if (!o) return p;
      return { ...p, x: lerp(o.x, p.x, t), y: lerp(o.y, p.y, t), heading: lerpAngle(o.heading, p.heading, t), speed: lerp(o.speed, p.speed, t) };
    }),
    missiles: b.missiles.map((m) => {
      const o = ma.get(m.id);
      return o ? { ...m, x: lerp(o.x, m.x, t), y: lerp(o.y, m.y, t), heading: lerpAngle(o.heading, m.heading, t) } : m;
    }),
    flares: b.flares.map((f) => {
      const o = fa.get(f.id);
      return o ? { ...f, x: lerp(o.x, f.x, t), y: lerp(o.y, f.y, t) } : f;
    }),
    bullets: b.bullets.map((u) => {
      const o = ba.get(u.id);
      return o ? { ...u, x: lerp(o.x, u.x, t), y: lerp(o.y, u.y, t) } : u;
    }),
  };
}
