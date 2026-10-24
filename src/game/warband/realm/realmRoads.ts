// The roads of a Warband realm: which sites link to which, and the route
// each road takes across the land. Sites stand in columns by depth (how
// many stops from the start), and every road joins a site to one in the
// next column east, so a run always moves toward the Hold. Links between
// two columns never cross, every site has a way in and a way on, and a
// road picks its way around lakes and mountains (bridging a lake or
// cutting a pass only when there's no reasonable way around), sharing
// road already laid where it can. Pure.

import type { Rng } from '../../combatStats.ts';
import type { Point } from '../../grid.ts';
import { landAt, setLand, type RealmLand, type RealmTerrain } from './realmTerrain.ts';

// How much a road "costs" to lay through each terrain: roads prefer open
// ground and old road, skirt forests, and only bridge water or cut through
// mountains when going around is far longer.
export const ROAD_COSTS: Readonly<Record<RealmTerrain, number>> = Object.freeze({
  grass: 1,
  meadow: 1,
  dirt: 0.6,
  bridge: 0.6,
  forest: 2.5,
  water: 7,
  mountain: 25,
});

// Extra cost for passing right beside a site that isn't the road's own
// end, so roads don't crowd past villages they don't enter.
const BESIDE_SITE_COST = 3;

// The links between two neighboring columns of sites, `west` and `east`,
// each sorted north to south (by y): pairs of indexes [westIndex,
// eastIndex]. Walks both lists together from their north ends, each step
// moving on in one list or both, so every site gets at least one link,
// links never cross, and a diagonal step (both at once) is a fork. Which
// list moves is random, weighted toward keeping linked sites level.
export function linkColumns(west: readonly Point[], east: readonly Point[], rng: Rng): [number, number][] {
  const links: [number, number][] = [[0, 0]];
  let i = 0;
  let j = 0;
  while (i < west.length - 1 || j < east.length - 1) {
    const options: { i: number; j: number; weight: number }[] = [];
    const add = (ni: number, nj: number) => {
      if (ni >= west.length || nj >= east.length) return;
      const gap = Math.abs(west[ni].y - east[nj].y);
      options.push({ i: ni, j: nj, weight: 1 / (1 + gap) });
    };
    add(i + 1, j);
    add(i, j + 1);
    add(i + 1, j + 1);
    const total = options.reduce((sum, option) => sum + option.weight, 0);
    let roll = rng() * total;
    const pick = options.find((option) => (roll -= option.weight) < 0) ?? options[options.length - 1];
    i = pick.i;
    j = pick.j;
    links.push([i, j]);
  }
  return links;
}

// Lays a road from `from` to `to` (two site tiles) on `land`, changing the
// tiles it passes to road (bridge over water, dirt anywhere else, a
// mountain pass included), and returns the tiles between the two sites, in
// order.
// `sites` are every site's tile: none is passed through, and passing
// beside one costs extra. A road stays between the two sites' columns,
// off the top and bottom rows. A road never completes a 2x2 block of road
// tiles (site tiles count as road, since they're laid as dirt too), since
// the dirt art can't draw one cleanly (see tileset.ts),
// unless `avoidBlocks` is false (for when no road can be laid without one).
export function carveRoad(
  land: RealmLand,
  from: Point,
  to: Point,
  sites: readonly Point[],
  avoidBlocks = true,
): Point[] {
  const { width, height } = land;
  const index = (x: number, y: number) => y * width + x;
  const siteTiles = new Set(sites.map((p) => index(p.x, p.y)));
  const goal = index(to.x, to.y);
  const besideSite = new Set<number>();
  for (const site of sites) {
    if ((site.x === from.x && site.y === from.y) || (site.x === to.x && site.y === to.y)) continue;
    for (const [dx, dy] of NEIGHBORS) besideSite.add(index(site.x + dx, site.y + dy));
  }
  const isRoad = (i: number) => {
    const terrain = land.cells[i];
    return terrain === 'dirt' || terrain === 'bridge' || siteTiles.has(i);
  };
  // A road keeps between its two sites' columns and off the map's edge rows.
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const best = new Float64Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const start = index(from.x, from.y);
  best[start] = 0;
  const heap = new MinHeap();
  heap.push(start, 0);
  // Whether stepping from `current` onto (x, y) would close a 2x2 block
  // of road, counting laid road and the last few tiles of this one.
  const closesBlock = (current: number, x: number, y: number) => {
    const chain = new Set<number>();
    for (let c = current, n = 0; c >= 0 && n < 4; c = cameFrom[c], n++) if (c !== start) chain.add(c);
    const road = (cx: number, cy: number) => {
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) return false;
      const i = index(cx, cy);
      return chain.has(i) || isRoad(i);
    };
    for (const [ox, oy] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ]) {
      const sx = x + ox;
      const sy = y + oy;
      const others = [
        [sx, sy],
        [sx + 1, sy],
        [sx, sy + 1],
        [sx + 1, sy + 1],
      ].filter(([cx, cy]) => cx !== x || cy !== y);
      if (others.every(([cx, cy]) => road(cx, cy))) return true;
    }
    return false;
  };
  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goal) break;
    const cx = current % width;
    const cy = Math.floor(current / width);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < minX || nx > maxX || ny < 1 || ny > height - 2) continue;
      const next = index(nx, ny);
      if (next !== goal && siteTiles.has(next)) continue;
      if (avoidBlocks && next !== goal && closesBlock(current, nx, ny)) continue;
      const step = next === goal ? 1 : ROAD_COSTS[land.cells[next]] + (besideSite.has(next) ? BESIDE_SITE_COST : 0);
      const cost = best[current] + step;
      if (cost < best[next]) {
        best[next] = cost;
        cameFrom[next] = current;
        heap.push(next, cost + Math.abs(nx - to.x) + Math.abs(ny - to.y) * 0.5);
      }
    }
  }
  if (cameFrom[goal] < 0) throw new Error(`No road from ${from.x},${from.y} to ${to.x},${to.y}`);
  const path: Point[] = [];
  for (let c = cameFrom[goal]; c !== start; c = cameFrom[c]) path.unshift({ x: c % width, y: Math.floor(c / width) });
  for (const { x, y } of path) {
    const terrain = landAt(land, x, y);
    setLand(land, x, y, terrain === 'water' || terrain === 'bridge' ? 'bridge' : 'dirt');
  }
  return path;
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// A binary min-heap of indexes by priority, for carveRoad's search.
class MinHeap {
  private items: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.priorities[left] < this.priorities[smallest]) smallest = left;
        if (right < this.items.length && this.priorities[right] < this.priorities[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}
