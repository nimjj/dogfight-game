export const WORLD_W = 3200;
export const WORLD_H = 2000;
export const GROUND_Y = 1880;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_RATE = 20;
export const SNAPSHOT_EVERY = TICK_RATE / SNAPSHOT_RATE;

export const TEAM_PLAYERS = 0;
export const TEAM_ENEMIES = 1;

export const MAX_PLAYERS = 2;
export const COOP_SCALE = 1.6;
export const COOP_LIVES = 5;

/** HUD shows speed in "knots"; the sim uses px/s. */
export const SPEED_DISPLAY_MULT = 1.6;

export const PALETTE = {
  sky: 0x3f6246,
  dark: 0x2b3a2e,
  mid: 0x4a9d44,
  bright: 0x6bd35a,
  light: 0xa8e66e,
  text: '#b9f58a',
} as const;
