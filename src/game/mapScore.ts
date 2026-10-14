// Grades a generated battle map for pace and fairness, so the stage
// generator can build several candidates from one seed and keep the best
// (see createStageLevel in warband/stageLevel.ts). Pure: it reads the
// terrain and where each side starts, nothing else.
//
// The metrics:
// - nearestEnemy: the fewest steps from a deployment tile to an enemy,
//   walking around water, mountains and walls. Most units move 5 and
//   strike 1 tile away, so at 6 or less a fight can start on turn 1.
// - routes: how many separate ways lead from the deployment zone to the
//   enemy, i.e. how many tiles would have to be blocked to cut them off
//   (counted up to MAX_ROUTES). One route makes the battle a single lane.
// - openShare: the share of the map's tiles a unit can stand on.
// - playerCover / enemyCover: forest tiles within COVER_REACH steps of
//   each side's starting tiles.

import { getCell, getNeighbors, type Grid, type Point } from './grid.ts';
import { getWalkingDistances } from './enemySpawns.ts';
import { getMoveCost } from './movement.ts';

export interface MapMetrics {
  // Null when no enemy can be reached (or there are none).
  nearestEnemy: number | null;
  routes: number;
  openShare: number;
  playerCover: number;
  enemyCover: number;
}

// Routes are counted up to this many; more than that doesn't change the
// score.
export const MAX_ROUTES = 3;

// How far from a side's starting tiles a forest still counts as its cover.
export const COVER_REACH = 2;

// What scoreMap aims for. A map that meets every target scores 0; every
// miss adds to its score, and lower is better.
export const MAP_SCORE_TARGETS = Object.freeze({
  // Farther than this and nobody can fight on turn 1.
  maxNearestEnemy: 6,
  minRoutes: 2,
  minOpenShare: 0.75,
});

const PENALTIES = Object.freeze({
  // Per step past maxNearestEnemy.
  distance: 3,
  // Per route short of minRoutes.
  route: 10,
  // Per tenth of the map short of minOpenShare.
  openShare: 4,
  // Per forest tile one side has more of than the other.
  cover: 1,
  // A map whose enemies can't be reached at all.
  unreachable: 1000,
});

const key = ({ x, y }: Point) => `${x},${y}`;

function isWalkable(grid: Grid, { x, y }: Point): boolean {
  return Number.isFinite(getMoveCost(getCell(grid, x, y)?.terrain ?? null));
}

// How many paths from `from` to `to` share no tile (other than their
// starting and ending tiles), counted up to `limit`: the number of tiles
// that would have to be blocked to cut every `from` off from every `to`.
// Paths walk through tiles with a finite move cost. `limit` when a `from`
// tile is also a `to` tile or next to one, since nothing in between can be
// blocked; 0 when either list is empty.
export function countRoutes(grid: Grid, from: readonly Point[], to: readonly Point[], limit = MAX_ROUTES): number {
  const sources = new Set(from.filter((p) => isWalkable(grid, p)).map(key));
  const sinks = new Set(to.filter((p) => isWalkable(grid, p)).map(key));
  if (sources.size === 0 || sinks.size === 0) return 0;
  for (const s of sources) {
    const [x, y] = s.split(',').map(Number);
    if (sinks.has(s) || getNeighbors(grid, x, y).some((n) => sinks.has(key(n)))) return limit;
  }

  // Max flow with every tile split into an "in" and an "out" node joined
  // by an edge of capacity 1, so each tile carries at most one path. The
  // starting and ending tiles are merged into a source and a sink, which
  // any number of paths may share.
  const node = (p: Point, side: 'in' | 'out') => {
    const k = key(p);
    if (sources.has(k)) return 'source';
    if (sinks.has(k)) return 'sink';
    return `${k}:${side}`;
  };
  const capacity = new Map<string, Map<string, number>>();
  const addEdge = (a: string, b: string, c: number) => {
    if (a === b) return;
    if (!capacity.has(a)) capacity.set(a, new Map());
    if (!capacity.has(b)) capacity.set(b, new Map());
    capacity.get(a)!.set(b, (capacity.get(a)!.get(b) ?? 0) + c);
    if (!capacity.get(b)!.has(a)) capacity.get(b)!.set(a, 0);
  };
  for (const cell of grid.cells) {
    if (!isWalkable(grid, cell)) continue;
    addEdge(node(cell, 'in'), node(cell, 'out'), 1);
    for (const n of getNeighbors(grid, cell.x, cell.y)) {
      if (isWalkable(grid, n)) addEdge(node(cell, 'out'), node(n, 'in'), 1);
    }
  }

  // Each breadth-first search pushes one more path, until none is left
  // or `limit` is reached.
  let flow = 0;
  while (flow < limit) {
    const cameFrom = new Map<string, string>([['source', '']]);
    const queue = ['source'];
    for (let i = 0; i < queue.length && !cameFrom.has('sink'); i++) {
      for (const [next, c] of capacity.get(queue[i]) ?? []) {
        if (c <= 0 || cameFrom.has(next)) continue;
        cameFrom.set(next, queue[i]);
        queue.push(next);
      }
    }
    if (!cameFrom.has('sink')) break;
    for (let at = 'sink'; at !== 'source'; at = cameFrom.get(at)!) {
      const prev = cameFrom.get(at)!;
      capacity.get(prev)!.set(at, capacity.get(prev)!.get(at)! - 1);
      capacity.get(at)!.set(prev, capacity.get(at)!.get(prev)! + 1);
    }
    flow++;
  }
  return flow;
}

// Forest tiles within `reach` steps of any of `starts`.
function countCover(grid: Grid, starts: readonly Point[], reach: number): number {
  const distances = getWalkingDistances(grid, starts);
  return grid.cells.filter((c) => c.terrain === 'forest' && (distances.get(key(c)) ?? Infinity) <= reach).length;
}

// The metrics (see the top of this file) for a map whose player deploys
// on `deploymentZone` and whose enemies start on `enemyTiles`.
export function getMapMetrics(grid: Grid, deploymentZone: readonly Point[], enemyTiles: readonly Point[]): MapMetrics {
  const distances = getWalkingDistances(grid, deploymentZone);
  const steps = enemyTiles.map((p) => distances.get(key(p))).filter((d) => d !== undefined);
  return {
    nearestEnemy: steps.length > 0 ? Math.min(...steps) : null,
    routes: countRoutes(grid, deploymentZone, enemyTiles),
    openShare: grid.cells.filter((c) => isWalkable(grid, c)).length / grid.cells.length,
    playerCover: countCover(grid, deploymentZone, COVER_REACH),
    enemyCover: countCover(grid, enemyTiles, COVER_REACH),
  };
}

// How far `metrics` miss MAP_SCORE_TARGETS: 0 when they meet every
// target, more the further they miss. Lower is better.
export function scoreMap(metrics: MapMetrics): number {
  const { nearestEnemy, routes, openShare, playerCover, enemyCover } = metrics;
  const { maxNearestEnemy, minRoutes, minOpenShare } = MAP_SCORE_TARGETS;
  if (nearestEnemy === null) return PENALTIES.unreachable;
  return (
    Math.max(0, nearestEnemy - maxNearestEnemy) * PENALTIES.distance +
    Math.max(0, minRoutes - routes) * PENALTIES.route +
    Math.max(0, minOpenShare - openShare) * 10 * PENALTIES.openShare +
    Math.abs(playerCover - enemyCover) * PENALTIES.cover
  );
}
