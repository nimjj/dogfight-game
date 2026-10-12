export type PilotId = 'kestrel' | 'bulldog' | 'siren';

export interface PilotDef {
  id: PilotId;
  name: string;
  blurb: string;
  maxSpeedMult: number;
  heatMult: number;
  extraMissiles: number;
  missileReloadMult: number;
}

export const PILOTS: Record<PilotId, PilotDef> = {
  kestrel: {
    id: 'kestrel',
    name: 'Kestrel',
    blurb: "Kestrel's experimental fuel makes her jet fly faster.",
    maxSpeedMult: 1.15,
    heatMult: 1,
    extraMissiles: 0,
    missileReloadMult: 1,
  },
  bulldog: {
    id: 'bulldog',
    name: 'Bulldog',
    blurb: "Bulldog's tuned cannon runs cooler, so he can hold the trigger longer.",
    maxSpeedMult: 1,
    heatMult: 0.6,
    extraMissiles: 0,
    missileReloadMult: 1,
  },
  siren: {
    id: 'siren',
    name: 'Siren',
    blurb: 'Siren carries an extra missile and reloads her racks faster.',
    maxSpeedMult: 1,
    heatMult: 1,
    extraMissiles: 1,
    missileReloadMult: 0.7,
  },
};

export const PILOT_IDS = Object.keys(PILOTS) as PilotId[];
