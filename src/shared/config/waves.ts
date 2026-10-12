import type { EnemyKind } from './enemies.ts';

export const WAVE = {
  firstDelay: 3,
  breakTime: 4,
  spawnInterval: 0.9,
  maxAlive: 12,
  clearBonus: 100, // per wave number
} as const;

/** Enemy list for wave `n` (1-based), before co-op scaling. */
export function waveComposition(n: number): EnemyKind[] {
  const fighters = 2 + Math.floor(n * 0.8);
  const carriers = Math.min(4, Math.floor((n - 1) / 2));
  const aces = Math.min(4, Math.floor((n - 2) / 3));
  const list: EnemyKind[] = [];
  for (let i = 0; i < fighters; i++) list.push('fighter');
  for (let i = 0; i < carriers; i++) list.push('carrier');
  for (let i = 0; i < Math.max(0, aces); i++) list.push('ace');
  return list;
}

/** Enemies get a little tougher every few waves. */
export function waveHpScale(n: number): number {
  return 1 + Math.min(1, (n - 1) * 0.06);
}
