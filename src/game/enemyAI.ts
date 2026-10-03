// Pure enemy decision-making. For now every enemy "rushes": it attacks a
// hostile unit if it can reach one this phase, and otherwise marches as far
// as it can toward the nearest one. No Phaser, no rendering, no hidden
// state — the caller carries out the plan.

import { getAttackTargets, type TargetTile } from './combat.ts';
import { getCell, type Grid, type Point } from './grid.ts';
import {
  getMovePath,
  getMovementRange,
  getPathCost,
  TERRAIN_MOVE_COSTS,
  type MovementOptions,
  type RangeTile,
} from './movement.ts';

// What planning reads off the unit.
export interface Mover {
  movement: number;
  range: number;
}

export interface RushPlan {
  path: Point[];
  target: TargetTile | null;
}

// Movement budget for "anywhere on the map". Finite on purpose: impassable
// terrain costs Infinity, and Infinity + 1 > Infinity is false.
const UNLIMITED_MOVEMENT = Number.MAX_SAFE_INTEGER;

// Plans one unit's phase. `unit` needs `movement` and `range`; `isHostile`
// (unitId) says who it wants to hit; `options` are the movement options
// (terrainCosts, canPassThrough) from movement.ts.
//
// Returns { path, target }: path is the route to walk ([{ x, y }], starting
// at origin — just [origin] to stay put), target the { x, y, unitId } to
// attack from the end of it, or null.
//
// When several tiles allow an attack, the cheapest one to reach wins, so a
// unit already next to a foe stays put and strikes.
export function planRushAction(
  grid: Grid,
  origin: Point,
  unit: Mover,
  isHostile: (unitId: string) => boolean,
  options: MovementOptions = {},
): RushPlan {
  const reachable = getMovementRange(grid, origin, unit.movement, options);

  let best: { tile: RangeTile; target: TargetTile } | null = null;
  for (const tile of reachable) {
    const [target] = getAttackTargets(grid, tile, unit.range, isHostile);
    if (target && (!best || tile.cost < best.tile.cost)) best = { tile, target };
  }
  if (best) {
    // The tile came from the movement range, so a path to it exists.
    const path = getMovePath(grid, origin, best.tile, unit.movement, options)!;
    return { path, target: best.target };
  }

  return { path: approachNearest(grid, origin, unit, isHostile, options), target: null };
}

// The route toward the closest tile the unit could attack a hostile from,
// ignoring its movement limit, cut back to the furthest tile it can
// actually reach and stop on this phase. [origin] if no hostile is
// reachable at all.
function approachNearest(
  grid: Grid,
  origin: Point,
  unit: Mover,
  isHostile: (unitId: string) => boolean,
  options: MovementOptions,
): Point[] {
  const { terrainCosts = TERRAIN_MOVE_COSTS } = options;
  const everywhere = getMovementRange(grid, origin, UNLIMITED_MOVEMENT, options);

  let goal: RangeTile | null = null;
  for (const tile of everywhere) {
    if (getAttackTargets(grid, tile, unit.range, isHostile).length === 0) continue;
    if (!goal || tile.cost < goal.cost) goal = tile;
  }
  if (!goal) return [origin];

  const route = getMovePath(grid, origin, goal, UNLIMITED_MOVEMENT, options)!;
  let end = 0;
  for (let i = 1; i < route.length; i++) {
    if (getPathCost(grid, route.slice(0, i + 1), terrainCosts) > unit.movement) break;
    // Allies can be walked through but not stood on.
    if (!getCell(grid, route[i].x, route[i].y)!.unitId) end = i;
  }
  return route.slice(0, end + 1);
}
