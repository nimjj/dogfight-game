export type EnemyKind = 'fighter' | 'carrier' | 'ace';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  radius: number;
  maxSpeed: number;
  cruise: number;
  thrust: number;
  turnRate: number;
  gunRate: number; // shots/s while firing (0 = no gun)
  fireRange: number;
  missiles: boolean;
  missileCooldown: number;
  flares: boolean;
  score: number;
  charge: number; // special charge awarded to the killer
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  fighter: {
    kind: 'fighter',
    name: 'Fighter',
    hp: 24,
    radius: 18,
    maxSpeed: 430,
    cruise: 330,
    thrust: 330,
    turnRate: 2.3,
    gunRate: 3.5,
    fireRange: 700,
    missiles: false,
    missileCooldown: 0,
    flares: false,
    score: 50,
    charge: 20,
  },
  carrier: {
    kind: 'carrier',
    name: 'Carrier',
    hp: 55,
    radius: 26,
    maxSpeed: 340,
    cruise: 260,
    thrust: 300,
    turnRate: 1.5,
    gunRate: 0,
    fireRange: 0,
    missiles: true,
    missileCooldown: 5.5,
    flares: false,
    score: 100,
    charge: 30,
  },
  ace: {
    kind: 'ace',
    name: 'Ace',
    hp: 38,
    radius: 18,
    maxSpeed: 480,
    cruise: 380,
    thrust: 360,
    turnRate: 2.8,
    gunRate: 4.5,
    fireRange: 750,
    missiles: false,
    missileCooldown: 0,
    flares: true,
    score: 150,
    charge: 40,
  },
};
