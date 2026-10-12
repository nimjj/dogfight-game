import type { PilotId } from '../shared/config/pilots.ts';
import type { SpecialId } from '../shared/config/specials.ts';
import type { NetClient } from './net/NetClient.ts';

export type Mode = 'solo' | 'host' | 'join' | 'rejoin';

/** Choices that travel between scenes (menu -> pilot select -> lobby -> game -> game over). */
export const state = {
  mode: 'solo' as Mode,
  pilot: 'kestrel' as PilotId,
  special: 'barrage' as SpecialId,
  net: null as NetClient | null,
  slot: 0,
  seed: 1,
  roomCode: '',
  last: { score: 0, wave: 0, kills: 0, coop: false },
};

export const W = 1280;
export const H = 720;
