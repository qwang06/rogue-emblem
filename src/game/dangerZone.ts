// Pure danger-zone rule: every tile some enemy could strike on its next
// phase, from anywhere it can end its move. No Phaser, no hidden state.

import { getAttackRange } from './combat.ts';
import { getMovementRange, type MovementOptions } from './movement.ts';
import type { Grid, Point } from './grid.ts';

// The span one weapon strikes, in tiles.
export interface WeaponRange {
  minRange: number;
  maxRange: number;
}

// One unit whose reach counts toward the zone: where it stands, how far it
// moves, the ranges of the weapons it can wield (none for a unit that
// can't attack), and the movement options it moves with (who blocks it).
export interface DangerSource {
  origin: Point;
  movement: number;
  ranges: readonly WeaponRange[];
  options?: MovementOptions;
}

// Every tile any source could attack after moving, as [{ x, y }] with no
// duplicates. Each weapon range counts on its own, so a unit with a sword
// (1) and a longbow (3) threatens 1 and 3 tiles out but not 2. Tiles a
// source can move to count too when it could strike them from another
// tile it can reach. Sources without a weapon add nothing.
export function getDangerZone(grid: Grid, sources: readonly DangerSource[]): Point[] {
  const seen = new Set<string>();
  const zone: Point[] = [];
  for (const { origin, movement, ranges, options } of sources) {
    if (ranges.length === 0) continue;
    const spans = uniqueRanges(ranges);
    for (const stop of getMovementRange(grid, origin, movement, options)) {
      for (const { minRange, maxRange } of spans) {
        for (const tile of getAttackRange(grid, stop, maxRange, minRange)) {
          const key = `${tile.x},${tile.y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          zone.push(tile);
        }
      }
    }
  }
  return zone;
}

function uniqueRanges(ranges: readonly WeaponRange[]): WeaponRange[] {
  const byKey = new Map(ranges.map((r) => [`${r.minRange}-${r.maxRange}`, r]));
  return [...byKey.values()];
}
