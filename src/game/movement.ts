// Pure movement rules: which tiles a unit can reach from where it stands,
// and the tile-by-tile route to any one of them, given its movement points
// and the terrain it has to cross. No Phaser, no rendering, no hidden state.

import { getCell, getNeighbors, isInBounds, type Grid, type Point, type Terrain } from './grid.ts';

export type TerrainCosts = Readonly<Record<string, number>>;

export interface MovementOptions {
  terrainCosts?: TerrainCosts;
  canPassThrough?: (unitId: string) => boolean;
}

// A reachable tile and the cheapest total cost to get there.
export interface RangeTile extends Point {
  cost: number;
}

// Movement points spent to enter a tile of each terrain. Infinity means
// impassable. Terrain missing from the table (including null) costs 1.
export const TERRAIN_MOVE_COSTS: TerrainCosts = Object.freeze({
  grass: 1,
  dirt: 1,
  water: Infinity,
  wall: Infinity,
});

export function getMoveCost(terrain: Terrain, terrainCosts: TerrainCosts = TERRAIN_MOVE_COSTS): number {
  return (terrain !== null ? terrainCosts[terrain] : undefined) ?? 1;
}

function tileKey(grid: Grid, x: number, y: number): number {
  return y * grid.width + x;
}

function keyToTile(grid: Grid, key: number): Point {
  return { x: key % grid.width, y: Math.floor(key / grid.width) };
}

// Dijkstra from origin, bounded by movement. Returns the cheapest cost to
// every reachable tile (keyed by tileKey) and the tile each was reached
// from, so callers can read off either the range or a route.
//
// Other units block unless canPassThrough(unitId) allows them.
function explore(grid: Grid, origin: Point, movement: number, options: MovementOptions) {
  const { terrainCosts = TERRAIN_MOVE_COSTS, canPassThrough = () => false } = options;
  const originKey = tileKey(grid, origin.x, origin.y);
  const best = new Map<number, number>([[originKey, 0]]);
  const cameFrom = new Map<number, number>();
  const frontier: RangeTile[] = [{ x: origin.x, y: origin.y, cost: 0 }];

  // Linear scan for the cheapest entry — maps are small enough that a heap
  // isn't worth it.
  while (frontier.length > 0) {
    let min = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[min].cost) min = i;
    }
    const current = frontier.splice(min, 1)[0];
    const currentKey = tileKey(grid, current.x, current.y);
    if (current.cost > best.get(currentKey)!) continue;

    for (const { x, y } of getNeighbors(grid, current.x, current.y)) {
      const cell = getCell(grid, x, y)!;
      if (cell.unitId && !canPassThrough(cell.unitId)) continue;

      const cost = current.cost + getMoveCost(cell.terrain, terrainCosts);
      if (cost > movement) continue;

      const k = tileKey(grid, x, y);
      if (best.has(k) && best.get(k)! <= cost) continue;
      best.set(k, cost);
      cameFrom.set(k, currentKey);
      frontier.push({ x, y, cost });
    }
  }

  return { best, cameFrom };
}

// A tile the mover may end on: anywhere reached, except tiles holding
// another unit. The origin is always fine — the mover is the one on it.
function isDestination(grid: Grid, origin: Point, x: number, y: number): boolean {
  if (x === origin.x && y === origin.y) return true;
  return !getCell(grid, x, y)!.unitId;
}

// Returns every tile the unit at origin can end its move on, as
// [{ x, y, cost }] where cost is the cheapest total to get there. The
// origin is always included (cost 0) so "stay put" is a valid move.
//
// Other units block by default. Pass canPassThrough(unitId) to let the
// mover walk through some of them (e.g. allies); tiles holding another
// unit are still never valid destinations.
export function getMovementRange(
  grid: Grid,
  origin: Point,
  movement: number,
  options: MovementOptions = {},
): RangeTile[] {
  if (!isInBounds(grid, origin.x, origin.y)) return [];

  const { best } = explore(grid, origin, movement, options);
  const range: RangeTile[] = [];
  for (const [k, cost] of best) {
    const { x, y } = keyToTile(grid, k);
    if (isDestination(grid, origin, x, y)) range.push({ x, y, cost });
  }
  return range;
}

// Returns the cheapest route from origin to destination as a list of
// orthogonally adjacent tiles [{ x, y }], starting with origin and ending
// with destination — one entry per step the unit takes. Returns null if
// the destination isn't in the unit's movement range. Takes the same
// options as getMovementRange.
export function getMovePath(
  grid: Grid,
  origin: Point,
  destination: Point,
  movement: number,
  options: MovementOptions = {},
): Point[] | null {
  if (!isInBounds(grid, origin.x, origin.y)) return null;
  if (!isInBounds(grid, destination.x, destination.y)) return null;
  if (!isDestination(grid, origin, destination.x, destination.y)) return null;

  const { best, cameFrom } = explore(grid, origin, movement, options);
  let k = tileKey(grid, destination.x, destination.y);
  if (!best.has(k)) return null;

  const path = [keyToTile(grid, k)];
  while (cameFrom.has(k)) {
    k = cameFrom.get(k)!;
    path.unshift(keyToTile(grid, k));
  }
  return path;
}

// Total movement points spent walking path (the origin, path[0], is free).
export function getPathCost(
  grid: Grid,
  path: readonly Point[],
  terrainCosts: TerrainCosts = TERRAIN_MOVE_COSTS,
): number {
  let cost = 0;
  for (const { x, y } of path.slice(1)) {
    cost += getMoveCost(getCell(grid, x, y)!.terrain, terrainCosts);
  }
  return cost;
}

function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

// Updates a planned route as the cursor moves to target, so the route
// follows the way the player traced it rather than snapping to the
// cheapest one. path starts at the mover's origin. In order:
//   - target already on the path: cut the path back to it (backtracking);
//   - target one step past the end, enterable, and still within movement:
//     append it;
//   - otherwise: the cheapest route to target, from getMovePath;
//   - and if target can't be reached at all, the path is left unchanged.
// May end on a tile the mover can pass through but not stop on (an ally);
// callers check the end is a valid destination before moving. Takes the
// same options as getMovementRange. Never mutates path.
export function extendMovePath(
  grid: Grid,
  path: readonly Point[],
  target: Point,
  movement: number,
  options: MovementOptions = {},
): readonly Point[] {
  const { terrainCosts = TERRAIN_MOVE_COSTS, canPassThrough = () => false } = options;
  if (!isInBounds(grid, target.x, target.y)) return path;

  const index = path.findIndex(({ x, y }) => x === target.x && y === target.y);
  if (index !== -1) return index === path.length - 1 ? path : path.slice(0, index + 1);

  const cell = getCell(grid, target.x, target.y)!;
  const enterable = !cell.unitId || canPassThrough(cell.unitId);
  if (enterable && isAdjacent(path[path.length - 1], target)) {
    const extended = [...path, { x: target.x, y: target.y }];
    if (getPathCost(grid, extended, terrainCosts) <= movement) return extended;
  }

  return getMovePath(grid, path[0], target, movement, options) ?? path;
}
