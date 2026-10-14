// Attacking straight from the move range: when the player picks a hostile
// unit while choosing where to move, which of the reachable tiles to strike
// it from and with which weapon. Pure — no Phaser, no hidden state.

import { findTileAt, getDistance, type Point } from './grid.ts';
import type { RangeTile } from './movement.ts';

export interface Reach {
  minRange: number;
  maxRange: number;
}

// Where to stand and which weapon (an index into the weapons passed in) to
// attack with.
export interface AttackPlan {
  tile: RangeTile;
  weaponIndex: number;
}

function reaches(from: Point, target: Point, { minRange, maxRange }: Reach): boolean {
  const distance = getDistance(from, target);
  return distance >= Math.max(1, minRange) && distance <= maxRange;
}

// Picks a tile in `range` (the mover's movement range) that one of
// `weapons` strikes `target` from, or null if none does. Tiles are tried in
// order: the end of the planned route `path` (where the player steered the
// arrow), then the mover's own tile (path[0]), then the rest from cheapest
// to reach. From the chosen tile the first weapon in reach wins, so pass
// the equipped weapon first to keep it when it can.
export function pickAttackPlan(
  range: readonly RangeTile[],
  path: readonly Point[],
  target: Point,
  weapons: readonly Reach[],
): AttackPlan | null {
  const preferred = [path[path.length - 1], path[0]]
    .filter((tile): tile is Point => tile !== undefined)
    .map((tile) => findTileAt(range, tile))
    .filter((tile): tile is RangeTile => tile !== null);
  const byCost = [...range].sort((a, b) => a.cost - b.cost);
  for (const tile of [...preferred, ...byCost]) {
    const weaponIndex = weapons.findIndex((weapon) => reaches(tile, target, weapon));
    if (weaponIndex !== -1) return { tile, weaponIndex };
  }
  return null;
}
