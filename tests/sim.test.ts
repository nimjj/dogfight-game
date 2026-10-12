import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/shared/config/enemies.ts';
import type { EnemyKind } from '../src/shared/config/enemies.ts';
import { GROUND_Y, TEAM_ENEMIES, TEAM_PLAYERS } from '../src/shared/constants.ts';
import type { SpecialId } from '../src/shared/config/specials.ts';
import { NO_INPUT } from '../src/shared/types.ts';
import type { InputState } from '../src/shared/types.ts';
import { damagePlane } from '../src/shared/sim/combat.ts';
import { stepFlight } from '../src/shared/sim/flight.ts';
import { playerStats } from '../src/shared/sim/stats.ts';
import { newPlane } from '../src/shared/sim/waves.ts';
import { World } from '../src/shared/sim/World.ts';
import { launchMissile } from '../src/shared/sim/weapons.ts';

function mk(players = 1, lives = 3, special: SpecialId = 'barrage'): World {
  const w = new World({
    seed: 42,
    lives,
    players: Array.from({ length: players }, (_, slot) => ({ slot, pilot: 'kestrel' as const, special })),
  });
  w.waveTimer = 1e9; // keep the wave spawner out of unit tests
  return w;
}

function addEnemy(w: World, kind: EnemyKind, x: number, y: number, heading = 0, speed = 0) {
  const def = ENEMIES[kind];
  const e = newPlane(w, { kind, team: TEAM_ENEMIES, x, y, heading, speed, hp: def.hp, maxHp: def.hp });
  w.planes.push(e);
  return e;
}

const plane = (w: World, slot: number) => w.planeById(w.players[slot]!.planeId)!;
const inp = (o: Partial<InputState>): InputState => ({ ...NO_INPUT, ...o });
const run = (w: World, ticks: number, ...inputs: (InputState | undefined)[]) => {
  for (let i = 0; i < ticks; i++) w.step(inputs);
};

describe('flight', () => {
  const f = playerStats('kestrel');
  const body = () => ({ x: 2000, y: 900, heading: 0, speed: 250 });

  it('accelerates under thrust and caps at max speed', () => {
    const b = body();
    for (let i = 0; i < 600; i++) stepFlight(b, { turn: 0, thrust: true }, f, 1 / 60);
    expect(b.speed).toBeGreaterThan(400);
    expect(b.speed).toBeLessThanOrEqual(f.maxSpeed * 1.25 + 1e-6);
  });

  it('diving gains speed and climbing loses it (gravity)', () => {
    const dive = { x: 2000, y: 300, heading: Math.PI / 2, speed: 250 };
    const climb = { x: 2000, y: 1500, heading: -Math.PI / 2, speed: 250 };
    for (let i = 0; i < 40; i++) {
      stepFlight(dive, { turn: 0, thrust: false }, f, 1 / 60);
      stepFlight(climb, { turn: 0, thrust: false }, f, 1 / 60);
    }
    expect(dive.speed).toBeGreaterThan(250);
    expect(climb.speed).toBeLessThan(250);
  });

  it('stalls: the nose falls when speed is too low', () => {
    const b = { x: 2000, y: 900, heading: -Math.PI / 2, speed: 100 };
    for (let i = 0; i < 120; i++) stepFlight(b, { turn: 0, thrust: false }, f, 1 / 60);
    expect(Math.sin(b.heading)).toBeGreaterThan(0.5);
  });

  it('reports a ground crash', () => {
    const b = { x: 2000, y: GROUND_Y - 5, heading: Math.PI / 2, speed: 300 };
    expect(stepFlight(b, { turn: 0, thrust: false }, f, 1 / 60)).toBe(true);
  });
});

describe('gun', () => {
  it('overheats while held, then recovers after cooling', () => {
    const w = mk();
    const p = plane(w, 0);
    p.y = 500;
    let overheated = false;
    for (let i = 0; i < 60 * 6 && !overheated; i++) {
      p.y = 500;
      w.step([inp({ gun: true, thrust: true })]);
      overheated = p.overheated;
    }
    expect(overheated).toBe(true);
    const bullets = w.bullets.length;
    w.step([inp({ gun: true })]);
    expect(w.bullets.length).toBeLessThanOrEqual(bullets); // cannot fire while overheated
    for (let i = 0; i < 60 * 4; i++) {
      p.y = 500;
      w.step([inp({ thrust: true })]);
    }
    expect(p.overheated).toBe(false);
  });

  it('kills an enemy fighter in front of the nose', () => {
    const w = mk();
    const p = plane(w, 0);
    p.x = 1000;
    p.y = 600;
    p.heading = 0;
    const e = addEnemy(w, 'fighter', 1400, 600, 0, 0);
    for (let i = 0; i < 60 * 3 && e.alive; i++) {
      p.y = 600;
      p.speed = 300;
      e.x = 1400; // hold the target still so only the gun is under test
      e.y = 600;
      e.heading = 0;
      w.step([inp({ gun: true, thrust: true })]);
    }
    expect(e.alive).toBe(false);
    expect(w.score).toBeGreaterThan(0);
  });
});

describe('missiles and flares', () => {
  it('locks on and a missile kills the target', () => {
    const w = mk();
    const p = plane(w, 0);
    p.x = 1000;
    p.y = 600;
    p.heading = 0;
    const e = addEnemy(w, 'fighter', 1500, 650, Math.PI, 0);
    e.hp = 10;
    const hold = () => {
      p.x = 1000;
      p.y = 600;
      p.speed = 300;
      e.x = 1500;
      e.y = 650;
    };
    for (let i = 0; i < 60; i++) {
      hold();
      w.step([inp({ thrust: true })]);
    }
    expect(p.lockId).toBe(e.id);
    hold();
    w.step([inp({ missile: true })]);
    expect(w.missiles.length).toBe(1);
    expect(w.missiles[0]!.targetId).toBe(e.id);
    for (let i = 0; i < 60 * 4 && e.alive; i++) w.step([inp({})]);
    expect(e.alive).toBe(false);
  });

  it('flares lure a missile away from its target', () => {
    const w = mk();
    const p = plane(w, 0);
    p.y = 300;
    const e = addEnemy(w, 'ace', 2000, 800, 0, 0);
    e.invuln = 0;
    launchMissile(w, p, Math.atan2(e.y - p.y, e.x - p.x), e.id, 45);
    w.flares.push({ id: w.newId(), team: TEAM_ENEMIES, x: w.missiles[0]!.x + 150, y: w.missiles[0]!.y + 40, vx: 0, vy: 0, life: 3 });
    w.step([inp({})]);
    expect(w.missiles[0]!.targetId).not.toBe(e.id);
  });
});

describe('no friendly fire', () => {
  it('ignores damage from the same team and applies cross-team damage', () => {
    const w = mk(2);
    const a = plane(w, 0);
    const b = plane(w, 1);
    b.invuln = 0;
    expect(damagePlane(w, b, 50, TEAM_PLAYERS, 0, 'gun')).toBe(false);
    expect(b.hp).toBe(b.maxHp);
    expect(damagePlane(w, b, 50, TEAM_ENEMIES, -1, 'gun')).toBe(true);
    expect(b.hp).toBe(b.maxHp - 50);
    expect(a.hp).toBe(a.maxHp);
  });

  it('teammate bullets pass through without harm', () => {
    const w = mk(2);
    const a = plane(w, 0);
    const b = plane(w, 1);
    a.invuln = b.invuln = 0;
    a.x = 1000;
    a.y = 600;
    a.heading = 0;
    b.x = 1200;
    b.y = 600;
    b.heading = 0;
    for (let i = 0; i < 90; i++) {
      a.y = 600;
      b.y = 600;
      b.x = 1200;
      a.speed = 300;
      w.step([inp({ gun: true, thrust: true }), inp({})]);
    }
    expect(b.hp).toBe(b.maxHp);
  });

  it('teammate missiles never home in on or hurt a teammate', () => {
    const w = mk(2);
    const a = plane(w, 0);
    const b = plane(w, 1);
    a.invuln = b.invuln = 0;
    a.x = 1000;
    a.y = 600;
    b.x = 1300;
    b.y = 600;
    launchMissile(w, a, 0, b.id, 45); // even if aimed at the teammate on purpose
    for (let i = 0; i < 60; i++) {
      b.x = 1300;
      b.y = 600;
      w.step([inp({}), inp({})]);
    }
    expect(b.hp).toBe(b.maxHp);
  });

  it.each(['barrage', 'rail', 'emp'] as const)('%s special never hurts or stuns a teammate', (special) => {
    const w = mk(2, 3, special);
    const a = plane(w, 0);
    const b = plane(w, 1);
    a.invuln = b.invuln = 0;
    a.special = 100;
    a.x = 1000;
    a.y = 600;
    a.heading = 0;
    b.x = 1200;
    b.y = 600;
    for (let i = 0; i < 120; i++) {
      b.x = 1200;
      b.y = 600;
      w.step([inp({ special: i === 0 }), inp({})]);
    }
    expect(b.hp).toBe(b.maxHp);
    expect(b.stun).toBe(0);
  });

  it('EMP does stun enemies and remove enemy fire', () => {
    const w = mk(1, 3, 'emp');
    const a = plane(w, 0);
    a.special = 100;
    a.x = 1000;
    a.y = 600;
    const e = addEnemy(w, 'fighter', 1200, 600, Math.PI, 0);
    w.bullets.push({ id: w.newId(), team: TEAM_ENEMIES, ownerSlot: -1, x: 1100, y: 600, vx: 0, vy: 0, life: 2, dmg: 5 });
    w.step([inp({ special: true })]);
    expect(e.stun).toBeGreaterThan(0);
    expect(w.bullets.length).toBe(0);
  });
});

describe('shared lives', () => {
  it('spends a team life per death, respawns, and ends the run when everyone is out', () => {
    const w = mk(2, 1);
    const a = plane(w, 0);
    a.invuln = 0;
    damagePlane(w, a, 999, TEAM_ENEMIES, -1, 'gun');
    expect(w.lives).toBe(0);
    expect(w.players[0]!.out).toBe(false);
    run(w, 60 * 3 + 5, inp({}), inp({}));
    expect(w.players[0]!.planeId).not.toBe(0); // respawned

    const a2 = plane(w, 0);
    a2.invuln = 0;
    damagePlane(w, a2, 999, TEAM_ENEMIES, -1, 'gun');
    expect(w.players[0]!.out).toBe(true);
    expect(w.gameOver).toBe(false); // teammate still flying

    const b = plane(w, 1);
    b.invuln = 0;
    damagePlane(w, b, 999, TEAM_ENEMIES, -1, 'gun');
    w.step([inp({}), inp({})]);
    expect(w.gameOver).toBe(true);
  });

  it('respawned planes are briefly invulnerable', () => {
    const w = mk(1, 2);
    const a = plane(w, 0);
    a.invuln = 0;
    damagePlane(w, a, 999, TEAM_ENEMIES, -1, 'gun');
    run(w, 60 * 3 + 5, inp({}));
    const fresh = plane(w, 0);
    expect(damagePlane(w, fresh, 50, TEAM_ENEMIES, -1, 'gun')).toBe(false);
  });

  it('a disconnecting player does not cost a life', () => {
    const w = mk(2, 5);
    w.disconnectPlayer(1);
    expect(w.lives).toBe(5);
    expect(w.players[1]!.out).toBe(true);
    expect(w.gameOver).toBe(false);
  });
});

describe('waves and scoring', () => {
  it('starts wave 1, spawns enemies, and pays out when cleared', () => {
    const w = new World({ seed: 7, lives: 3, players: [{ slot: 0, pilot: 'kestrel', special: 'rail' }] });
    run(w, 60 * 5);
    expect(w.wave).toBe(1);
    expect(w.enemiesLeft()).toBeGreaterThan(0);
    // wipe the wave out
    w.queue = [];
    for (const p of w.planes) if (p.team === TEAM_ENEMIES) p.alive = false;
    const before = w.score;
    w.step([inp({})]);
    expect(w.score).toBeGreaterThan(before);
    expect(w.waveState).toBe('break');
    expect(w.drainEvents().some((e) => e.t === 'callout' && e.text === 'Wave Cleared!')).toBe(true);
  });

  it('combo multiplier grows on consecutive kills and resets when hit', () => {
    const w = mk();
    const p = plane(w, 0);
    p.invuln = 0;
    for (let i = 0; i < 4; i++) {
      const e = addEnemy(w, 'fighter', 100, 100);
      damagePlane(w, e, 999, TEAM_PLAYERS, 0, 'gun');
    }
    expect(w.players[0]!.streak).toBe(4);
    expect(w.snapshot().players[0]!.mult).toBe(3);
    damagePlane(w, p, 1, TEAM_ENEMIES, -1, 'gun');
    expect(w.players[0]!.streak).toBe(0);
  });

  it('scales enemy count up for co-op', () => {
    const solo = mk(1);
    const duo = mk(2);
    for (const w of [solo, duo]) {
      w.waveTimer = 0;
      w.step([]);
    }
    expect(duo.enemiesLeft()).toBeGreaterThan(solo.enemiesLeft());
  });
});

describe('determinism', () => {
  it('same seed and same inputs give identical state', () => {
    const script = (t: number): InputState[] => [
      inp({ turn: Math.sin(t / 30), thrust: true, gun: t % 90 < 50, missile: t % 200 === 0, flare: t % 333 === 0 }),
      inp({ turn: Math.cos(t / 25), thrust: t % 7 !== 0, gun: true, special: t === 400 }),
    ];
    const make = () => {
      const w = new World({
        seed: 1234,
        lives: 5,
        players: [
          { slot: 0, pilot: 'kestrel', special: 'barrage' },
          { slot: 1, pilot: 'siren', special: 'rail' },
        ],
      });
      w.waveTimer = 0.5;
      return w;
    };
    const a = make();
    const b = make();
    for (let t = 0; t < 1500; t++) {
      a.step(script(t));
      b.step(script(t));
    }
    expect(JSON.stringify(a.snapshot())).toEqual(JSON.stringify(b.snapshot()));
    expect(a.tick).toBe(1500);
  });
});

describe('client prediction parity', () => {
  it('replaying inputs with stepFlight matches what the server world does to the same plane', () => {
    const w = mk(1);
    const p = plane(w, 0);
    p.invuln = 99; // keep crashes and stray fire out of the comparison
    const params = playerStats('kestrel');
    const body = { x: p.x, y: p.y, heading: p.heading, speed: p.speed };
    for (let t = 0; t < 600; t++) {
      const input = inp({ turn: 0.2 * Math.sin(t / 30), thrust: t % 50 < 40 });
      w.step([input]);
      stepFlight(body, input, params, 1 / 60);
    }
    expect(p.alive).toBe(true); // a crash would end the comparison early
    expect(p.x).toBeCloseTo(body.x, 6);
    expect(p.y).toBeCloseTo(body.y, 6);
    expect(p.heading).toBeCloseTo(body.heading, 6);
    expect(p.speed).toBeCloseTo(body.speed, 6);
  });
});
