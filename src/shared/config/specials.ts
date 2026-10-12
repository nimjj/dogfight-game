export type SpecialId = 'barrage' | 'rail' | 'emp';

export interface SpecialDef {
  id: SpecialId;
  name: string;
  blurb: string;
}

export const SPECIAL_CHARGE_NEEDED = 100;

export const SPECIALS: Record<SpecialId, SpecialDef> = {
  barrage: { id: 'barrage', name: 'Missile Barrage', blurb: 'Fires six homing missiles in a fan.' },
  rail: { id: 'rail', name: 'Rail Shot', blurb: 'A piercing beam that cuts through every enemy in line.' },
  emp: { id: 'emp', name: 'EMP Burst', blurb: 'Wipes nearby enemy fire and stuns enemy planes.' },
};

export const SPECIAL_IDS = Object.keys(SPECIALS) as SpecialId[];

export const BARRAGE = { count: 6, spread: 0.7 };
export const RAIL = { length: 2200, damage: 60, width: 14 };
export const EMP = { radius: 520, stun: 2.5 };
