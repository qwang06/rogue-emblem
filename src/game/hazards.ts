// Pure hazard rules: terrain that hurts a unit forced onto it (a Shove,
// see push.ts), and where a stage's map puts its spike traps. Walking onto
// a hazard is safe: a unit picks its way between the spikes, and nobody
// walks into deep water. Only being shoved there hurts. No Phaser, no
// hidden state.

import type { Rng } from './combatStats.ts';
import { getDistance, type Grid, type Point, type Terrain } from './grid.ts';
import { shuffle } from './rng.ts';

// What being shoved onto a terrain does: `damage` HP lost, or, when
// `drowns`, the unit is lost outright.
export interface Hazard {
  damage: number;
  drowns: boolean;
}

// The spike trap's terrain name.
export const SPIKES = 'spikes';

// Terrain name -> what being shoved onto it does. Terrain not listed is
// harmless. A ford is shallow enough to wade, so only open water drowns.
export const HAZARDS: Readonly<Record<string, Hazard>> = Object.freeze({
  [SPIKES]: Object.freeze({ damage: 5, drowns: false }),
  water: Object.freeze({ damage: 0, drowns: true }),
});

// The hazard on `terrain`, or null if it's harmless.
export function getHazard(terrain: Terrain, hazards: Readonly<Record<string, Hazard>> = HAZARDS): Hazard | null {
  return (terrain !== null && hazards[terrain]) || null;
}

// The terrain spike traps are laid on: open ground.
const TRAP_GROUND = new Set(['grass', 'dirt', 'meadow']);

export interface SpikePlacement {
  // How many traps to lay (fewer when too few tiles qualify).
  count: number;
  // Where the enemies start: traps go 1 to `reach` tiles from one, where
  // the fighting starts and a shove can use them.
  enemyTiles: readonly Point[];
  reach: number;
  // Tiles no trap goes on (the deployment zone, decorations).
  avoid: readonly Point[];
}

// The tiles to lay spike traps on: open ground with no unit, not on or
// next to an avoided tile, within `reach` of an enemy's start but not on
// one, picked at random from those. Traps are never next to each other,
// so they stay single tiles a unit can be shoved onto.
export function pickSpikeTiles(grid: Grid, { count, enemyTiles, reach, avoid }: SpikePlacement, rng: Rng): Point[] {
  const candidates = grid.cells.filter(
    (cell) =>
      cell.terrain !== null &&
      TRAP_GROUND.has(cell.terrain) &&
      !cell.unitId &&
      !avoid.some((tile) => getDistance(tile, cell) <= 1) &&
      enemyTiles.some((tile) => getDistance(tile, cell) <= reach),
  );
  const picked: Point[] = [];
  for (const { x, y } of shuffle(rng, candidates)) {
    if (picked.length >= count) break;
    if (picked.some((tile) => getDistance(tile, { x, y }) <= 1)) continue;
    picked.push({ x, y });
  }
  return picked;
}
