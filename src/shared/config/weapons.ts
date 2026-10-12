export const GUN = {
  rate: 12, // shots per second
  speed: 900,
  life: 1.1,
  damage: 8,
  heatPerShot: 0.03,
  coolPerSec: 0.35,
  recoverAt: 0.35, // overheated guns work again below this heat
  assistCone: 0.2, // rad; bullets bend slightly toward a target this close to the nose
  assistBend: 0.07,
  assistRange: 950,
} as const;

export const MISSILE = {
  speed: 640,
  launchBoost: 120,
  turnRate: 3.0,
  life: 4.2,
  damage: 45,
  blastRadius: 60,
  hitRadius: 12,
  cooldown: 0.4,
  lockRange: 1000,
  lockStickyRange: 1300,
  lockCone: 0.6, // rad half-angle to acquire
  lockStickyCone: 1.0,
  lockTime: 0.45,
} as const;

export const FLARE = {
  perUse: 3,
  max: 3,
  life: 3,
  cooldown: 0.9,
  rechargeTime: 8,
  lureRadius: 280,
  hitRadius: 20,
} as const;

export const ENEMY_BULLET = { speed: 620, life: 1.4, damage: 5 } as const;
export const ENEMY_MISSILE_DAMAGE = 30;
