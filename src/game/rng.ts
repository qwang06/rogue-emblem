// Seeded randomness. The same seed always gives the same sequence, so a
// procedurally generated map can be rebuilt (or tested) from its seed alone.

import type { Rng } from './combatStats.ts';

// A Mulberry32 generator: a fast 32-bit PRNG, good enough for games. Returns
// an Rng (numbers in [0, 1), like Math.random) that advances each call.
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh random seed, e.g. for a new generated map. Not seeded itself:
// it's where a seed comes from.
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

// A whole number from min to max, both included.
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// One item of a non-empty list, picked uniformly.
export function randomItem<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Cannot pick from an empty list');
  return items[Math.floor(rng() * items.length)];
}

// A shuffled copy of items (Fisher–Yates); items itself is left alone.
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
