// Pure movement rules: which tiles a unit can reach from where it stands,
// and the tile-by-tile route to any one of them, given its movement points
// and the terrain it has to cross. No Phaser, no rendering, no hidden state.

import { getCell, getNeighbors, isInBounds } from './grid.js';

// Movement points spent to enter a tile of each terrain. Infinity means
// impassable. Terrain missing from the table (including null) costs 1.
export const TERRAIN_MOVE_COSTS = Object.freeze({
  grass: 1,
  water: Infinity,
});

export function getMoveCost(terrain, terrainCosts = TERRAIN_MOVE_COSTS) {
  return terrainCosts[terrain] ?? 1;
}

function tileKey(grid, x, y) {
  return y * grid.width + x;
}

function keyToTile(grid, key) {
  return { x: key % grid.width, y: Math.floor(key / grid.width) };
}

// Dijkstra from origin, bounded by movement. Returns the cheapest cost to
// every reachable tile (keyed by tileKey) and the tile each was reached
// from, so callers can read off either the range or a route.
//
// Other units block unless canPassThrough(unitId) allows them.
function explore(grid, origin, movement, options) {
  const { terrainCosts = TERRAIN_MOVE_COSTS, canPassThrough = () => false } = options;
  const originKey = tileKey(grid, origin.x, origin.y);
  const best = new Map([[originKey, 0]]);
  const cameFrom = new Map();
  const frontier = [{ x: origin.x, y: origin.y, cost: 0 }];

  // Linear scan for the cheapest entry — maps are small enough that a heap
  // isn't worth it.
  while (frontier.length > 0) {
    let min = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[min].cost) min = i;
    }
    const current = frontier.splice(min, 1)[0];
    const currentKey = tileKey(grid, current.x, current.y);
    if (current.cost > best.get(currentKey)) continue;

    for (const { x, y } of getNeighbors(grid, current.x, current.y)) {
      const cell = getCell(grid, x, y);
      if (cell.unitId && !canPassThrough(cell.unitId)) continue;

      const cost = current.cost + getMoveCost(cell.terrain, terrainCosts);
      if (cost > movement) continue;

      const k = tileKey(grid, x, y);
      if (best.has(k) && best.get(k) <= cost) continue;
      best.set(k, cost);
      cameFrom.set(k, currentKey);
      frontier.push({ x, y, cost });
    }
  }

  return { best, cameFrom };
}

// A tile the mover may end on: anywhere reached, except tiles holding
// another unit. The origin is always fine — the mover is the one on it.
function isDestination(grid, origin, x, y) {
  if (x === origin.x && y === origin.y) return true;
  return !getCell(grid, x, y).unitId;
}

// Returns every tile the unit at origin can end its move on, as
// [{ x, y, cost }] where cost is the cheapest total to get there. The
// origin is always included (cost 0) so "stay put" is a valid move.
//
// Other units block by default. Pass canPassThrough(unitId) to let the
// mover walk through some of them (e.g. allies); tiles holding another
// unit are still never valid destinations.
export function getMovementRange(grid, origin, movement, options = {}) {
  if (!isInBounds(grid, origin.x, origin.y)) return [];

  const { best } = explore(grid, origin, movement, options);
  const range = [];
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
export function getMovePath(grid, origin, destination, movement, options = {}) {
  if (!isInBounds(grid, origin.x, origin.y)) return null;
  if (!isInBounds(grid, destination.x, destination.y)) return null;
  if (!isDestination(grid, origin, destination.x, destination.y)) return null;

  const { best, cameFrom } = explore(grid, origin, movement, options);
  let k = tileKey(grid, destination.x, destination.y);
  if (!best.has(k)) return null;

  const path = [keyToTile(grid, k)];
  while (cameFrom.has(k)) {
    k = cameFrom.get(k);
    path.unshift(keyToTile(grid, k));
  }
  return path;
}
