import { BARRAGE, EMP, RAIL, SPECIAL_CHARGE_NEEDED } from '../config/specials.ts';
import { ENEMY_MISSILE_DAMAGE, FLARE, GUN, MISSILE } from '../config/weapons.ts';
import { angleDiff, clamp, distToSegment } from '../math.ts';
import type { InputState, PlaneState } from '../types.ts';
import { damagePlane } from './combat.ts';
import { statsOf } from './stats.ts';
import type { World } from './World.ts';

export function stepWeapons(w: World, p: PlaneState, input: InputState, dt: number): void {
  const st = statsOf(w, p);
  p.gunCd -= dt;
  p.missileCd -= dt;
  p.flareCd -= dt;

  // --- gun + heat ---
  if (input.gun && p.gunCd <= 0 && !p.overheated && st.gunRate > 0) {
    fireGun(w, p, st.bulletSpeed, st.bulletLife, st.bulletDamage);
    p.gunCd = 1 / st.gunRate;
    if (st.hasHeat) {
      p.heat += GUN.heatPerShot * st.heatMult;
      if (p.heat >= 1) {
        p.heat = 1;
        p.overheated = true;
        w.emit({ t: 'overheat', slot: p.slot });
      }
    }
  }
  // the barrel only cools while the trigger is released (or the gun is locked out by overheating)
  if (st.hasHeat && !(input.gun && !p.overheated)) {
    p.heat = Math.max(0, p.heat - GUN.coolPerSec * dt);
    if (p.overheated && p.heat <= GUN.recoverAt) p.overheated = false;
  }

  // --- lock-on (players only) ---
  if (p.kind === 'player') trackLock(w, p, dt);

  // --- missiles ---
  if (st.infiniteMissiles || st.missileMax > 0) {
    if (!st.infiniteMissiles && p.missiles < st.missileMax) {
      p.missileReload -= dt;
      if (p.missileReload <= 0) {
        p.missiles++;
        p.missileReload = st.missileReload;
      }
    }
    const hasAmmo = st.infiniteMissiles || p.missiles > 0;
    if (input.missile && p.missileCd <= 0 && hasAmmo) {
      let targetId = p.lockId;
      if (p.kind !== 'player') targetId = w.nearestHostile(p)?.id ?? 0;
      launchMissile(w, p, p.heading, targetId, p.kind === 'player' ? MISSILE.damage : ENEMY_MISSILE_DAMAGE);
      p.missileCd = st.missileCd;
      if (!st.infiniteMissiles) {
        if (p.missiles === st.missileMax) p.missileReload = st.missileReload;
        p.missiles--;
      }
    }
  }

  // --- flares ---
  if (st.canFlare) {
    if (p.flares < st.flareMax) {
      p.flareReload -= dt;
      if (p.flareReload <= 0) {
        p.flares++;
        p.flareReload = FLARE.rechargeTime;
      }
    }
    if (input.flare && p.flareCd <= 0 && (p.kind !== 'player' || p.flares > 0)) {
      dropFlares(w, p);
      p.flareCd = p.kind === 'player' ? FLARE.cooldown : 3;
      if (p.kind === 'player') {
        if (p.flares === st.flareMax) p.flareReload = FLARE.rechargeTime;
        p.flares--;
      }
    }
  }

  // --- special ---
  if (input.special && p.kind === 'player' && p.special >= SPECIAL_CHARGE_NEEDED) {
    const pl = w.players[p.slot];
    if (pl) {
      p.special = 0;
      activateSpecial(w, p, pl.special);
    }
  }
}

function fireGun(w: World, p: PlaneState, speed: number, life: number, dmg: number): void {
  let angle = p.heading;
  if (p.kind === 'player') {
    // slight aim assist: bend toward the closest enemy nearly in front of the nose
    let best: PlaneState | undefined;
    let bestAbs: number = GUN.assistCone;
    for (const e of w.planes) {
      if (!e.alive || e.team === p.team) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > GUN.assistRange * GUN.assistRange) continue;
      const d = Math.abs(angleDiff(p.heading, Math.atan2(dy, dx)));
      if (d < bestAbs) {
        bestAbs = d;
        best = e;
      }
    }
    if (best) {
      const diff = angleDiff(p.heading, Math.atan2(best.y - p.y, best.x - p.x));
      angle += clamp(diff, -GUN.assistBend, GUN.assistBend);
    }
  }
  const r = statsOf(w, p).radius + 6;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  w.bullets.push({
    id: w.newId(),
    team: p.team,
    ownerSlot: p.slot,
    x: p.x + ca * r,
    y: p.y + sa * r,
    vx: ca * speed + Math.cos(p.heading) * p.speed * 0.5,
    vy: sa * speed + Math.sin(p.heading) * p.speed * 0.5,
    life,
    dmg,
  });
  w.emit({ t: 'shot', x: p.x, y: p.y, team: p.team });
}

export function launchMissile(w: World, p: PlaneState, heading: number, targetId: number, dmg: number): void {
  const r = statsOf(w, p).radius + 8;
  w.missiles.push({
    id: w.newId(),
    team: p.team,
    ownerSlot: p.slot,
    x: p.x + Math.cos(heading) * r,
    y: p.y + Math.sin(heading) * r,
    heading,
    speed: Math.max(p.speed, 300) + MISSILE.launchBoost,
    life: MISSILE.life,
    targetId,
    dmg,
  });
  w.emit({ t: 'missile', x: p.x, y: p.y });
}

function dropFlares(w: World, p: PlaneState): void {
  const back = p.heading + Math.PI;
  for (let i = 0; i < FLARE.perUse; i++) {
    const a = back + (i - 1) * 0.5;
    w.flares.push({
      id: w.newId(),
      team: p.team,
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * 160 + Math.cos(p.heading) * p.speed * 0.3,
      vy: Math.sin(a) * 160 + Math.sin(p.heading) * p.speed * 0.3,
      life: FLARE.life,
    });
  }
  w.emit({ t: 'flare', x: p.x, y: p.y });
}

function trackLock(w: World, p: PlaneState, dt: number): void {
  // keep an existing lock while the target stays in a generous envelope
  if (p.lockId) {
    const t = w.planeById(p.lockId);
    if (t && t.alive && t.team !== p.team) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const inRange = dx * dx + dy * dy <= MISSILE.lockStickyRange * MISSILE.lockStickyRange;
      const inCone = Math.abs(angleDiff(p.heading, Math.atan2(dy, dx))) <= MISSILE.lockStickyCone;
      if (inRange && inCone) return;
    }
    p.lockId = 0;
    p.lockCand = 0;
    p.lockTimer = 0;
  }
  // look for the enemy closest to the nose
  let cand: PlaneState | undefined;
  let bestAbs: number = MISSILE.lockCone;
  for (const e of w.planes) {
    if (!e.alive || e.team === p.team) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > MISSILE.lockRange * MISSILE.lockRange) continue;
    const d = Math.abs(angleDiff(p.heading, Math.atan2(dy, dx)));
    if (d < bestAbs) {
      bestAbs = d;
      cand = e;
    }
  }
  if (!cand) {
    p.lockCand = 0;
    p.lockTimer = 0;
    return;
  }
  if (p.lockCand !== cand.id) {
    p.lockCand = cand.id;
    p.lockTimer = 0;
    return;
  }
  p.lockTimer += dt;
  if (p.lockTimer >= MISSILE.lockTime) {
    p.lockId = cand.id;
    w.emit({ t: 'lock', slot: p.slot });
  }
}

function activateSpecial(w: World, p: PlaneState, id: 'barrage' | 'rail' | 'emp'): void {
  if (id === 'barrage') {
    const targets = w.planes
      .filter((e) => e.alive && e.team !== p.team)
      .sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
    for (let i = 0; i < BARRAGE.count; i++) {
      const off = (i / (BARRAGE.count - 1) - 0.5) * 2 * BARRAGE.spread;
      const t = targets.length ? targets[i % targets.length] : undefined;
      launchMissile(w, p, p.heading + off, t ? t.id : 0, MISSILE.damage);
    }
  } else if (id === 'rail') {
    const x2 = p.x + Math.cos(p.heading) * RAIL.length;
    const y2 = p.y + Math.sin(p.heading) * RAIL.length;
    w.emit({ t: 'beam', x1: p.x, y1: p.y, x2, y2 });
    for (const e of w.planes) {
      if (!e.alive || e.team === p.team) continue;
      if (distToSegment(e.x, e.y, p.x, p.y, x2, y2) <= statsOf(w, e).radius + RAIL.width) {
        damagePlane(w, e, RAIL.damage, p.team, p.slot, 'special');
      }
    }
  } else {
    w.emit({ t: 'emp', x: p.x, y: p.y, r: EMP.radius });
    const r2 = EMP.radius * EMP.radius;
    w.bullets = w.bullets.filter((b) => b.team === p.team || (b.x - p.x) ** 2 + (b.y - p.y) ** 2 > r2);
    w.missiles = w.missiles.filter((m) => m.team === p.team || (m.x - p.x) ** 2 + (m.y - p.y) ** 2 > r2);
    for (const e of w.planes) {
      if (!e.alive || e.team === p.team) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= r2) e.stun = EMP.stun;
    }
  }
}
