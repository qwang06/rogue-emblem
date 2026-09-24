// Pure movement-range rules: which tiles a unit can reach from where it
// stands, given its movement points and the terrain it has to cross.
// No Phaser, no rendering, no hidden state.

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

// Returns every tile the unit at origin can end its move on, as
// [{ x, y, cost }] where cost is the cheapest total to get there. The
// origin is always included (cost 0) so "stay put" is a valid move.
//
// Other units block by default. Pass canPassThrough(unitId) to let the
// mover walk through some of them (e.g. allies); tiles holding another
// unit are still never valid destinations.
export function getMovementRange(grid, origin, movement, options = {}) {
  const { terrainCosts = TERRAIN_MOVE_COSTS, canPassThrough = () => false } = options;
  if (!isInBounds(grid, origin.x, origin.y)) return [];

  const key = (x, y) => y * grid.width + x;
  const best = new Map([[key(origin.x, origin.y), 0]]);
  const frontier = [{ x: origin.x, y: origin.y, cost: 0 }];

  // Dijkstra with a linear scan for the cheapest entry — maps are small
  // enough that a heap isn't worth it.
  while (frontier.length > 0) {
    let min = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[min].cost) min = i;
    }
    const current = frontier.splice(min, 1)[0];
    if (current.cost > best.get(key(current.x, current.y))) continue;

    for (const { x, y } of getNeighbors(grid, current.x, current.y)) {
      const cell = getCell(grid, x, y);
      if (cell.unitId && !canPassThrough(cell.unitId)) continue;

      const cost = current.cost + getMoveCost(cell.terrain, terrainCosts);
      if (cost > movement) continue;

      const k = key(x, y);
      if (best.has(k) && best.get(k) <= cost) continue;
      best.set(k, cost);
      frontier.push({ x, y, cost });
    }
  }

  const range = [];
  for (const [k, cost] of best) {
    const x = k % grid.width;
    const y = Math.floor(k / grid.width);
    const isOrigin = x === origin.x && y === origin.y;
    if (!isOrigin && getCell(grid, x, y).unitId) continue;
    range.push({ x, y, cost });
  }
  return range;
}
