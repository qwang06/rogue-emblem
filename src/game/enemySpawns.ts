// Where a generated map's enemies stand. A region lists its enemies as
// groups, each a count plus optional limits on where they may go:
// - area: a box given as fractions of the map (0 is the west/north
//   edge, 1 the east/south edge), so the same box fits any map size
// - minDistance / maxDistance: how many steps a unit would walk from the
//   nearest deployment tile, going around water, mountains and walls
// Groups are placed in order, each on random tiles that pass all of its
// limits and aren't already taken. Pure: the same inputs and Rng always
// give the same tiles.

import type { Rng } from './combatStats.ts';
import { getCell, getNeighbors, type Grid, type Point } from './grid.ts';
import { getMoveCost } from './movement.ts';
import { shuffle } from './rng.ts';

type Fractions = readonly [number, number];

export interface SpawnArea {
  // The columns and rows the box covers, as [from, to] fractions of the
  // map's width and height; the whole axis when unset.
  x?: Fractions;
  y?: Fractions;
}

export interface EnemyGroup {
  count: number;
  area?: SpawnArea;
  minDistance?: number;
  maxDistance?: number;
}

// The north third of the map: where enemies stood before regions could
// place them, and still where an old file's `enemyCount` puts them.
export const NORTH_THIRD: SpawnArea = Object.freeze({ y: Object.freeze([0, 1 / 3] as const) });

const key = ({ x, y }: Point) => `${x},${y}`;

// How many steps each tile is from the nearest of `starts`, as keys "x,y",
// walking through any tile with a finite move cost. Tiles no start can
// reach are left out.
export function getWalkingDistances(grid: Grid, starts: readonly Point[]): Map<string, number> {
  const walkable = (p: Point) => Number.isFinite(getMoveCost(getCell(grid, p.x, p.y)?.terrain ?? null));
  const distances = new Map<string, number>();
  const queue = starts.filter(walkable);
  queue.forEach((p) => distances.set(key(p), 0));
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const next = distances.get(key(p))! + 1;
    for (const n of getNeighbors(grid, p.x, p.y)) {
      if (distances.has(key(n)) || !walkable(n)) continue;
      distances.set(key(n), next);
      queue.push(n);
    }
  }
  return distances;
}

// Whether index `i` on an axis `size` tiles long falls in [from, to): the
// tiles from from·size up to, not including, to·size, both rounded down.
// [0, 0.5] and [0.5, 1] split a map into halves that never overlap.
function inSpan(i: number, size: number, [from, to]: Fractions = [0, 1]): boolean {
  return i >= Math.floor(from * size) && i < Math.floor(to * size);
}

// Whether `p` lies in `area` on a map `width` x `height` tiles.
export function isInArea(p: Point, area: SpawnArea, width: number, height: number): boolean {
  return inSpan(p.x, width, area.x) && inSpan(p.y, height, area.y);
}

// The tiles for each group, in order: one list per group, at most `count`
// long (shorter when too few tiles pass its limits). A tile qualifies when
// it's walkable, reachable from the deployment zone, not in it, in the
// group's area and within its distances, and no earlier group took it.
export function pickEnemyTiles(
  grid: Grid,
  groups: readonly EnemyGroup[],
  deploymentZone: readonly Point[],
  rng: Rng,
): Point[][] {
  const distances = getWalkingDistances(grid, deploymentZone);
  const taken = new Set(deploymentZone.map(key));
  return groups.map(({ count, area = {}, minDistance = 0, maxDistance = Infinity }) => {
    const candidates = grid.cells.filter((c) => {
      const distance = distances.get(key(c));
      return (
        distance !== undefined &&
        distance >= minDistance &&
        distance <= maxDistance &&
        !taken.has(key(c)) &&
        isInArea(c, area, grid.width, grid.height)
      );
    });
    const tiles = shuffle(rng, candidates)
      .slice(0, count)
      .map(({ x, y }) => ({ x, y }));
    tiles.forEach((p) => taken.add(key(p)));
    return tiles;
  });
}

// How much room `group` has on its own (ignoring other groups), to explain
// a group that can't be placed:
// - inArea: walkable tiles in its area the deployment zone can reach
//   (the zone itself left out)
// - nearest / farthest: the fewest and most steps to one of them (null for none)
// - fits: how many of them are also within its distances
export interface GroupRoom {
  inArea: number;
  nearest: number | null;
  farthest: number | null;
  fits: number;
}

export function getGroupRoom(grid: Grid, group: EnemyGroup, deploymentZone: readonly Point[]): GroupRoom {
  const distances = getWalkingDistances(grid, deploymentZone);
  const zone = new Set(deploymentZone.map(key));
  const steps = grid.cells
    .filter((c) => distances.has(key(c)) && !zone.has(key(c)) && isInArea(c, group.area ?? {}, grid.width, grid.height))
    .map((c) => distances.get(key(c))!);
  const { minDistance = 0, maxDistance = Infinity } = group;
  return {
    inArea: steps.length,
    nearest: steps.length > 0 ? Math.min(...steps) : null,
    farthest: steps.length > 0 ? Math.max(...steps) : null,
    fits: steps.filter((s) => s >= minDistance && s <= maxDistance).length,
  };
}

// How many enemies the groups ask for in all.
export function countEnemies(groups: readonly EnemyGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
