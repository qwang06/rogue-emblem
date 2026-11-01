// Pure geometry for skills that move their user (see the `leap`, `straight`,
// `retreat` and `strafe` fields of a skill in skills.ts): where a leap
// lands, where a retreat ends, and where a strafing run flies. Each reads
// only the grid: a unit stands only on an empty, in-bounds tile it could
// walk onto (getMoveCost is finite). No Phaser, no hidden state.

import { getCell, getDistance, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';

// Whether a unit could stand on `tile`: in bounds, empty and walkable.
// `self`, the unit that's moving, counts its own tile as free.
export function canStandOn(grid: Grid, tile: Point, self: string | null = null): boolean {
  const cell = getCell(grid, tile.x, tile.y);
  if (!cell) return false;
  if (cell.unitId !== null && cell.unitId !== self) return false;
  return Number.isFinite(getMoveCost(cell.terrain));
}

// The unit step from `from` toward `to` along the longer axis (x on a
// tie), or null when they're the same tile.
export function getStep(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
}

// Whether `a` and `b` share a row or a column.
export function isInLine(a: Point, b: Point): boolean {
  return a.x === b.x || a.y === b.y;
}

const AROUND: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// Where a unit `self` on `from` lands to strike `target` with a leap of up
// to `leap` tiles: the free tile next to `target` nearest to `from`
// (north, east, south, west on a tie), `from` itself when it's already
// next to the target, or null when there's none in reach. A `straight`
// leap (a charge) only goes along a row or column, to the tile just short
// of `target`, and every tile it crosses must be free.
export function getLeapLanding(
  grid: Grid,
  self: string,
  from: Point,
  target: Point,
  leap: number,
  straight = false,
): Point | null {
  if (getDistance(from, target) === 1) return { x: from.x, y: from.y };
  if (straight) {
    if (!isInLine(from, target)) return null;
    const step = getStep(from, target)!;
    const distance = getDistance(from, target) - 1;
    if (distance > leap) return null;
    for (let i = 1; i <= distance; i++) {
      if (!canStandOn(grid, { x: from.x + step.x * i, y: from.y + step.y * i }, self)) return null;
    }
    return { x: from.x + step.x * distance, y: from.y + step.y * distance };
  }
  let best: Point | null = null;
  for (const offset of AROUND) {
    const tile = { x: target.x + offset.x, y: target.y + offset.y };
    const distance = getDistance(from, tile);
    if (distance > leap || !canStandOn(grid, tile, self)) continue;
    if (!best || distance < getDistance(from, best)) best = tile;
  }
  return best;
}

// Where a unit `self` on `from` ends up stepping up to `steps` tiles
// straight away from `target`: as far as free tiles allow, or `from`
// itself when the first is blocked.
export function getRetreatTile(grid: Grid, self: string, from: Point, target: Point, steps: number): Point {
  const toward = getStep(from, target);
  let at = { x: from.x, y: from.y };
  if (!toward) return at;
  for (let i = 0; i < steps; i++) {
    const next = { x: at.x - toward.x, y: at.y - toward.y };
    if (!canStandOn(grid, next, self)) break;
    at = next;
  }
  return at;
}

// A strafing run by `self` from `from` toward `target` (in its row or
// column), flying up to `reach` tiles: { landing, passed }, where
// `landing` is the farthest free tile it can reach that way, and `passed`
// the tiles it flies over on the way (whoever stands there); null when
// `target` isn't in line or no landing lies past it.
export function getStrafePath(
  grid: Grid,
  self: string,
  from: Point,
  target: Point,
  reach: number,
): { landing: Point; passed: Point[] } | null {
  if (!isInLine(from, target)) return null;
  const step = getStep(from, target);
  if (!step) return null;
  const tileAt = (i: number) => ({ x: from.x + step.x * i, y: from.y + step.y * i });
  let landing = 0;
  for (let i = 1; i <= reach; i++) if (canStandOn(grid, tileAt(i), self)) landing = i;
  if (landing <= getDistance(from, target)) return null;
  return { landing: tileAt(landing), passed: Array.from({ length: landing - 1 }, (_, i) => tileAt(i + 1)) };
}
