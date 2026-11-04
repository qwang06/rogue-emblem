// The loop pass: when a battle map leaves only one way from the player to
// the enemy (every route runs through one tile), opens a second way round
// that tile, the way roguelikes like Brogue add loops so a level is never
// a single corridor. It looks for the cheapest detour, wading water as a
// ford and cutting a pass through mountains, so the map changes as little
// as it can. Pure.

import { getCell, getNeighbors, setTerrain, type Grid, type Point } from './grid.ts';
import { getWalkingDistances } from './enemySpawns.ts';
import { countRoutes } from './mapScore.ts';
import { getMoveCost } from './movement.ts';

const key = ({ x, y }: Point) => `${x},${y}`;

// What each terrain a detour may open becomes. Walls (a ruin, a fort)
// stay: they're built, not grown.
export const OPENINGS: Readonly<Record<string, string>> = Object.freeze({ water: 'ford', mountain: 'grass' });

// What a detour pays per tile it opens, against 1 per tile it walks, so it
// walks a few tiles further rather than open one more.
export const OPEN_COST = 4;

// How many chokepoints one pass works round at most.
export const MAX_LOOPS = 3;

const isWalkable = (grid: Grid, p: Point) => Number.isFinite(getMoveCost(getCell(grid, p.x, p.y)?.terrain ?? null));

// Whether any of `to` can be walked to from `from`.
function isConnected(grid: Grid, from: readonly Point[], to: readonly Point[]): boolean {
  const distances = getWalkingDistances(grid, from);
  return to.some((p) => distances.has(key(p)));
}

// A tile every way from `from` to `to` walks through (other than their
// own tiles), the nearest to `from` if there are several; null when there
// are two or more separate ways, or none.
export function findChokepoint(grid: Grid, from: readonly Point[], to: readonly Point[]): Point | null {
  if (countRoutes(grid, from, to, 2) !== 1) return null;
  const ends = new Set([...from, ...to].map(key));
  const distances = getWalkingDistances(grid, from);
  // Every tile walkable from `from`, nearest first.
  const candidates = grid.cells
    .filter((c) => distances.has(key(c)) && !ends.has(key(c)))
    .sort((a, b) => distances.get(key(a))! - distances.get(key(b))! || a.y - b.y || a.x - b.x);
  const choke = candidates.find((c) => !isConnected(setTerrain(grid, c.x, c.y, 'wall'), from, to));
  return choke ? { x: choke.x, y: choke.y } : null;
}

// The cheapest way from `from` to any of `to` that keeps off `avoid`:
// each walkable tile costs 1, each tile of an OPENINGS terrain
// OPEN_COST, anything else can't be crossed. Null when there is none.
export function findDetour(grid: Grid, from: readonly Point[], to: readonly Point[], avoid: Point): Point[] | null {
  const goals = new Set(to.map(key));
  const cost = new Map<string, number>();
  const previous = new Map<string, Point>();
  const open: Point[] = [];
  for (const p of from) {
    cost.set(key(p), 0);
    open.push(p);
  }
  while (open.length > 0) {
    open.sort((a, b) => cost.get(key(a))! - cost.get(key(b))! || a.y - b.y || a.x - b.x);
    const p = open.shift()!;
    if (goals.has(key(p))) {
      const way = [p];
      for (let at = previous.get(key(p)); at; at = previous.get(key(at))) way.unshift(at);
      return way;
    }
    for (const n of getNeighbors(grid, p.x, p.y)) {
      if (key(n) === key(avoid)) continue;
      const terrain = getCell(grid, n.x, n.y)!.terrain ?? '';
      const step = isWalkable(grid, n) ? 1 : OPENINGS[terrain] ? OPEN_COST : Infinity;
      const total = cost.get(key(p))! + step;
      if (total >= (cost.get(key(n)) ?? Infinity)) continue;
      if (!cost.has(key(n))) open.push(n);
      cost.set(key(n), total);
      previous.set(key(n), p);
    }
  }
  return null;
}

// `grid` with a second way opened past each chokepoint between `from`
// and `to` (up to MAX_LOOPS of them): the cheapest detour round it
// (findDetour), its water turned to fords and its mountains to grass.
// Unchanged when there are already two separate ways, or no way at all,
// or no detour can be opened.
export function openLoops(grid: Grid, from: readonly Point[], to: readonly Point[]): Grid {
  let next = grid;
  for (let i = 0; i < MAX_LOOPS; i++) {
    const choke = findChokepoint(next, from, to);
    if (!choke) break;
    const detour = findDetour(next, from, to, choke);
    if (!detour) break;
    next = detour.reduce((g, p) => {
      const opened = OPENINGS[getCell(g, p.x, p.y)!.terrain ?? ''];
      return opened && !isWalkable(g, p) ? setTerrain(g, p.x, p.y, opened) : g;
    }, next);
  }
  return next;
}
