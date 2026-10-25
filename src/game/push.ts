// Pure push rules (a Shove, see skills.ts): a unit shoved one tile in a
// direction slides onto the next tile if it's open, taking whatever hazard
// is there (hazards.ts): spikes hurt, deep water drowns. Anything that
// stops it, the map's edge, a wall, a mountain or another unit, leaves it
// where it stood and bumps it for BUMP_DAMAGE, and a unit it slams into
// takes the same. A unit holding its ground (a boss) can't be moved at all.
// No Phaser, no hidden state: it says what would happen, and the caller
// carries it out.

import { getCell, isInBounds, type Grid, type Point } from './grid.ts';
import { getHazard, HAZARDS, type Hazard } from './hazards.ts';
import { getMoveCost, TERRAIN_MOVE_COSTS, type TerrainCosts } from './movement.ts';

// HP a shoved unit loses when something stops it, and that the unit it
// slams into loses too.
export const BUMP_DAMAGE = 2;

export interface PushResult {
  // The shoved unit.
  unitId: string;
  from: Point;
  // The one-step direction it was shoved in.
  direction: Point;
  // Where it ends up: the next tile when it slid (or sank), else `from`.
  to: Point;
  // Whether it slid off `from`.
  moved: boolean;
  // Why it didn't move: something in the way, or it holds its ground.
  blocked: 'edge' | 'terrain' | 'unit' | 'steadfast' | null;
  // HP the shoved unit loses: a bump, or the hazard it slid onto.
  damage: number;
  // The unit it slammed into, and the HP that one loses.
  collidedId: string | null;
  collisionDamage: number;
  // The hazard it slid onto, if any.
  hazard: Hazard | null;
  // Whether it slid into deep water and is lost.
  drowned: boolean;
}

// What a push reads off the units: whether one holds its ground.
export interface Pushable {
  holdsPosition?: boolean;
}

export interface PushOptions {
  terrainCosts?: TerrainCosts;
  hazards?: Readonly<Record<string, Hazard>>;
}

// The one-step direction from `from` toward `to` along the larger axis,
// e.g. the way a shover at `from` pushes the unit at `to`. { 0, 0 } when
// they're the same tile.
export function getPushDirection(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
}

// What shoving the unit on `from` one tile in `direction` would do, or
// null when there's no unit there. `units` says which units hold their
// ground. Impassable terrain (TERRAIN_MOVE_COSTS) stops it, except terrain
// with a hazard that drowns: deep water is impassable on foot but takes a
// shoved unit.
export function getPushResult(
  grid: Grid,
  units: ReadonlyMap<string, Pushable>,
  from: Point,
  direction: Point,
  { terrainCosts = TERRAIN_MOVE_COSTS, hazards = HAZARDS }: PushOptions = {},
): PushResult | null {
  const unitId = getCell(grid, from.x, from.y)?.unitId;
  if (!unitId) return null;
  const stay = { x: from.x, y: from.y };
  const result: PushResult = {
    unitId,
    from: stay,
    direction: { x: direction.x, y: direction.y },
    to: stay,
    moved: false,
    blocked: null,
    damage: 0,
    collidedId: null,
    collisionDamage: 0,
    hazard: null,
    drowned: false,
  };
  if (units.get(unitId)?.holdsPosition) return { ...result, blocked: 'steadfast' };

  const to = { x: from.x + direction.x, y: from.y + direction.y };
  if ((direction.x === 0 && direction.y === 0) || !isInBounds(grid, to.x, to.y)) {
    return { ...result, blocked: 'edge', damage: BUMP_DAMAGE };
  }
  const cell = getCell(grid, to.x, to.y)!;
  if (cell.unitId) {
    return { ...result, blocked: 'unit', damage: BUMP_DAMAGE, collidedId: cell.unitId, collisionDamage: BUMP_DAMAGE };
  }
  const hazard = getHazard(cell.terrain, hazards);
  if (hazard?.drowns) return { ...result, to, moved: true, hazard, drowned: true };
  if (!Number.isFinite(getMoveCost(cell.terrain, terrainCosts))) {
    return { ...result, blocked: 'terrain', damage: BUMP_DAMAGE };
  }
  return { ...result, to, moved: true, hazard, damage: hazard?.damage ?? 0 };
}
